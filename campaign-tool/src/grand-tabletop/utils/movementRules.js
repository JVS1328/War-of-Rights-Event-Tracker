// Movement point rules for Grand Campaign tabletop.
// Per rules:
//   - 2 MP/turn
//   - March 2 hex/MP, River 3 hex/MP, Train 4 hex/MP
//   - MP ends when a new movement mode starts
//   - Embarking/disembarking a river ends your turn
//   - Train embark only at city/fort/station
//   - Disembarking a train ends your turn (Rails card exception)
//   - Cross river costs 1 MP
//   - Replenishing costs 1 MP and ends turn

import { hexKey, neighbors, parseKey } from './hexMath';
import { getCityByHex, hexHasEmbarkableMarker, isRailConnected } from '../data/defaultBoard';
import { TERRAIN } from '../data/defaultBoard';

export const MOVE_MODE = {
  MARCH: 'march',
  RIVER: 'river',
  TRAIN: 'train'
};

export const getTerrainAt = (board, hexK) => {
  return board.hexes[hexK]?.terrain || null;
};

export const unitAtHex = (units, hexK) =>
  units.find(u => u.hexKey === hexK && !u.wiped) || null;

export const hexIsPassable = (board, hexK) => {
  const t = getTerrainAt(board, hexK);
  return t != null && t !== TERRAIN.WATER;
};

// Given movement mode + entering terrain, return MP cost (fractional) to enter a hex.
export const costToEnter = (mode, entryTerrain, settings, activeEventEffects = {}) => {
  const march = settings.marchHexPerMP + (activeEventEffects.marchBonus || 0);
  const river = settings.riverHexPerMP;
  const train = settings.trainHexPerMP;
  if (mode === MOVE_MODE.MARCH) return 1 / march;
  if (mode === MOVE_MODE.RIVER) {
    const riverCost = 1 / river;
    return activeEventEffects.riverCostMultiplier
      ? riverCost * activeEventEffects.riverCostMultiplier
      : riverCost;
  }
  if (mode === MOVE_MODE.TRAIN) return 1 / train;
  return 1 / march;
};

export const canEmbarkTrain = (board, hexK) => {
  const city = getCityByHex(board, hexK);
  if (!city) return false;
  return ['city', 'fort', 'station', 'capital'].includes(city.kind);
};

// Pure pathfinder: BFS to get all reachable hexes within MP budget in a single mode
// (a real path that mixes modes ends previous MP, so we plan per mode segment).
export const reachableInMode = (board, units, startKey, mode, mpBudget, settings, activeEventEffects = {}) => {
  if (activeEventEffects.noTrains && mode === MOVE_MODE.TRAIN) {
    return { [startKey]: { mpUsed: 0, from: null } };
  }
  const visited = { [startKey]: { mpUsed: 0, from: null } };
  const queue = [{ key: startKey, mpUsed: 0 }];

  while (queue.length > 0) {
    const { key, mpUsed } = queue.shift();
    const { q, r } = parseKey(key);

    if (mode === MOVE_MODE.TRAIN) {
      // train hops are city-to-city along rail connections
      const currentCity = getCityByHex(board, key);
      if (!currentCity) continue;
      for (const rail of board.rails) {
        let nextCityId = null;
        if (rail.from === currentCity.id) nextCityId = rail.to;
        else if (rail.to === currentCity.id) nextCityId = rail.from;
        if (!nextCityId) continue;
        const nextCity = board.cities.find(c => c.id === nextCityId);
        if (!nextCity) continue;
        const nk = nextCity.hexKey;
        if (unitAtHex(units, nk)) continue;
        const cost = costToEnter(mode, getTerrainAt(board, nk), settings, activeEventEffects);
        const next = mpUsed + cost;
        if (next > mpBudget + 1e-9) continue;
        if (!visited[nk] || visited[nk].mpUsed > next) {
          visited[nk] = { mpUsed: next, from: key };
          queue.push({ key: nk, mpUsed: next });
        }
      }
      continue;
    }

    for (const { q: nq, r: nr } of neighbors(q, r)) {
      const nk = hexKey(nq, nr);
      if (!hexIsPassable(board, nk)) continue;
      const terrain = getTerrainAt(board, nk);
      if (mode === MOVE_MODE.RIVER && terrain !== TERRAIN.RIVER) continue;
      if (mode === MOVE_MODE.MARCH && terrain === TERRAIN.RIVER) {
        // crossing a river costs an extra MP per rules
        const baseCost = costToEnter(mode, terrain, settings, activeEventEffects);
        const crossCost = baseCost + 1;
        const next = mpUsed + crossCost;
        if (next > mpBudget + 1e-9) continue;
        if (unitAtHex(units, nk)) continue;
        if (!visited[nk] || visited[nk].mpUsed > next) {
          visited[nk] = { mpUsed: next, from: key };
          queue.push({ key: nk, mpUsed: next });
        }
        continue;
      }
      const cost = costToEnter(mode, terrain, settings, activeEventEffects);
      const next = mpUsed + cost;
      if (next > mpBudget + 1e-9) continue;
      if (unitAtHex(units, nk) && nk !== startKey) continue;
      if (!visited[nk] || visited[nk].mpUsed > next) {
        visited[nk] = { mpUsed: next, from: key };
        queue.push({ key: nk, mpUsed: next });
      }
    }
  }
  return visited;
};

export const reachableForUnit = (campaign, unit, mode, activeEventEffects = {}) => {
  if (!unit || !unit.hexKey) return {};
  const mp = unit.remainingMP ?? campaign.settings.mpPerTurn;
  return reachableInMode(
    campaign.board,
    campaign.units,
    unit.hexKey,
    mode,
    mp,
    campaign.settings,
    activeEventEffects
  );
};

export const executeMove = (campaign, unitId, targetHex, mode, mpCost) => {
  const units = campaign.units.map(u => {
    if (u.id !== unitId) return u;
    const currentMP = u.remainingMP ?? campaign.settings.mpPerTurn;
    const remainingMP = Math.max(0, currentMP - mpCost);
    return {
      ...u,
      hexKey: targetHex,
      remainingMP,
      currentMode: mode,
      onTrain: mode === MOVE_MODE.TRAIN,
      onRiver: mode === MOVE_MODE.RIVER,
      turnActedThisDraw: true
    };
  });
  return { ...campaign, units };
};

export const endUnitTurn = (campaign, unitId) => {
  const units = campaign.units.map(u =>
    u.id === unitId ? { ...u, remainingMP: 0, turnActedThisDraw: true } : u
  );
  return { ...campaign, units };
};

export const resetMovementForUnit = (campaign, unitId) => {
  const units = campaign.units.map(u =>
    u.id === unitId ? { ...u, remainingMP: campaign.settings.mpPerTurn, currentMode: null, turnActedThisDraw: false } : u
  );
  return { ...campaign, units };
};
