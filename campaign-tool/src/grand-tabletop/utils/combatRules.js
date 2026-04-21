// Combat rules engine. Wraps outcome from BattleRecorder and applies:
//   fatigue, train/river ambush, winter attrition, garrison pre-damage,
//   reinforce 40%, retreat 4 hex, last stand, wipe under 100, capture payouts.

import { hexKey, parseKey, distance, neighbors } from './hexMath';
import { getCityByHex, isRailConnected, TERRAIN } from '../data/defaultBoard';

export const STATUS = {
  NORMAL: 'normal',
  LAST_STAND: 'lastStand',
  WIPED: 'wiped'
};

export const evaluateStatus = (manpower, settings) => {
  if (manpower < settings.lastStandLow) return STATUS.WIPED;
  if (manpower <= settings.lastStandHigh) return STATUS.LAST_STAND;
  return STATUS.NORMAL;
};

export const applyFatigueCasualties = (baseCasualties, fatigue, settings, cardEffects = {}) => {
  if (cardEffects.ignoreFatigue || cardEffects.skipFatigue) return baseCasualties;
  const mult = 1 + (fatigue * settings.fatigueCasPctPerPoint / 100);
  return Math.round(baseCasualties * mult);
};

export const applyAmbushCasualties = (casualties, unit, settings) => {
  if (unit.onTrain || unit.onRiver) {
    return Math.round(casualties * (1 + settings.trainRiverAmbushPct / 100));
  }
  return casualties;
};

export const applyWinterCasualties = (casualties, isAttacker, isWinter, settings, eventEffects = {}) => {
  if (!isWinter || !isAttacker) return casualties;
  const extra = eventEffects.extraWinterPct || 0;
  return Math.round(casualties * (1 + (settings.winterAttritionPct + extra) / 100));
};

export const applyFlatCardCas = (casualties, side, battleCards = {}) => {
  let cas = casualties;
  const effects = battleCards[side] || {};
  if (effects.allCasReduction) cas = Math.round(cas * (1 - effects.allCasReduction / 100));
  if (effects.defenderCasReduction && side === 'defender') {
    cas = Math.round(cas * (1 - effects.defenderCasReduction / 100));
  }
  if (effects.attackerCasExtra && side === 'attacker') {
    cas = Math.round(cas * (1 + effects.attackerCasExtra / 100));
  }
  if (effects.casPctAgainstAttacker && side === 'attacker') {
    cas = Math.round(cas * (1 + effects.casPctAgainstAttacker / 100));
  }
  if (effects.casPctAgainstDefender && side === 'defender') {
    cas = Math.round(cas * (1 + effects.casPctAgainstDefender / 100));
  }
  return cas;
};

export const garrisonPreDamage = (attackerUnit, defenderHex, board, settings, battleCards = {}) => {
  const city = getCityByHex(board, defenderHex);
  if (!city || city.garrison <= 0) return 0;
  const mult = (battleCards.attacker?.garrisonMultiplier) || 1;
  return Math.floor(city.garrison / 100) * 100 * mult;
};

export const splitCasualtiesGarrisonFirst = (hex, board, casualties) => {
  const city = getCityByHex(board, hex);
  if (!city || city.garrison <= 0) return { toGarrison: 0, toToken: casualties };
  const toGarrison = Math.min(city.garrison, casualties);
  return { toGarrison, toToken: casualties - toGarrison };
};

export const adjacentFriendly = (board, units, unitId, hexK) => {
  const unit = units.find(u => u.id === unitId);
  if (!unit) return [];
  const { q, r } = parseKey(hexK);
  const nb = neighbors(q, r).map(n => hexKey(n.q, n.r));
  return units.filter(u => u.id !== unitId && !u.wiped && u.faction === unit.faction && nb.includes(u.hexKey));
};

export const retreatPath = (board, units, fromHex, faction, maxHops, ignoreIds = []) => {
  // Retreat up to N hexes toward nearest friendly city/fort, ignoring terrain penalties.
  const friendlyCityHexes = board.cities.filter(c => c.owner === faction).map(c => c.hexKey);
  if (friendlyCityHexes.length === 0) return [];
  // Pick nearest friendly city/fort
  const { q, r } = parseKey(fromHex);
  let nearest = null;
  let nearestD = Infinity;
  for (const targetHex of friendlyCityHexes) {
    const t = parseKey(targetHex);
    const d = distance({ q, r }, t);
    if (d < nearestD) {
      nearestD = d;
      nearest = targetHex;
    }
  }
  if (!nearest) return [];
  // Walk up to maxHops toward nearest (greedy, skip occupied)
  const path = [];
  let currentKey = fromHex;
  const blockedSet = new Set(units.filter(u => !u.wiped && !ignoreIds.includes(u.id)).map(u => u.hexKey));
  for (let step = 0; step < maxHops; step++) {
    const { q: cq, r: cr } = parseKey(currentKey);
    const target = parseKey(nearest);
    let bestKey = null;
    let bestDist = Infinity;
    for (const { q: nq, r: nr } of neighbors(cq, cr)) {
      const nk = hexKey(nq, nr);
      const tile = board.hexes[nk];
      if (!tile || tile.terrain === TERRAIN.WATER) continue;
      if (blockedSet.has(nk)) continue;
      const d = distance({ q: nq, r: nr }, target);
      if (d < bestDist) {
        bestDist = d;
        bestKey = nk;
      }
    }
    if (!bestKey) break;
    path.push(bestKey);
    blockedSet.add(bestKey);
    currentKey = bestKey;
    if (bestKey === nearest) break;
  }
  return path;
};

export const processBattleOutcome = (campaign, battle) => {
  const {
    attackerUnitId,
    defenderUnitId,
    targetHex,
    winner,
    casualties,
    battleCards = {},
    reinforcingUnitIds = [],
    isConquest = false
  } = battle;

  const settings = campaign.settings;
  const isWinter = campaign.turn.winter;
  const board = campaign.board;
  let units = [...campaign.units];
  let factions = { ...campaign.factions };
  let log = [...(campaign.log || [])];

  const attacker = units.find(u => u.id === attackerUnitId);
  const defender = defenderUnitId ? units.find(u => u.id === defenderUnitId) : null;
  if (!attacker) return campaign;

  // === 1. garrison pre-damage against attacker
  let attCas = casualties.attacker || 0;
  let defCas = casualties.defender || 0;
  if (defender) {
    const garrDmg = garrisonPreDamage(attacker, targetHex, board, settings, battleCards);
    attCas += garrDmg;
  }

  // === 2. card flat modifiers
  attCas = applyFlatCardCas(attCas, 'attacker', battleCards);
  defCas = applyFlatCardCas(defCas, 'defender', battleCards);

  // === 3. fatigue casualties
  attCas = applyFatigueCasualties(attCas, attacker.fatigue || 0, settings, battleCards.attacker);
  if (defender) defCas = applyFatigueCasualties(defCas, defender.fatigue || 0, settings, battleCards.defender);

  // === 4. ambush (train/river)
  attCas = applyAmbushCasualties(attCas, attacker, settings);
  if (defender) defCas = applyAmbushCasualties(defCas, defender, settings);

  // === 5. winter attrition (attacker)
  attCas = applyWinterCasualties(attCas, true, isWinter, settings, battle.eventEffects || {});

  // === 6. last stand: if loser is in Last Stand, winner caps casualties at 2x LS manpower
  const defenderWasLastStand = defender && evaluateStatus(defender.manpower, settings) === STATUS.LAST_STAND;
  const attackerWasLastStand = evaluateStatus(attacker.manpower, settings) === STATUS.LAST_STAND;

  if (defenderWasLastStand && winner === 'attacker') {
    attCas = Math.min(attCas, defender.manpower * 2);
  }
  if (attackerWasLastStand && winner === 'defender' && defender) {
    defCas = Math.min(defCas, attacker.manpower * 2);
  }
  // LS winner takes no casualties
  if (defenderWasLastStand && winner === 'defender') defCas = 0;
  if (attackerWasLastStand && winner === 'attacker') attCas = 0;

  // === 7. garrison eats casualties first on defender hex
  if (defender) {
    const city = getCityByHex(board, targetHex);
    if (city && city.garrison > 0) {
      const { toGarrison, toToken } = splitCasualtiesGarrisonFirst(targetHex, board, defCas);
      defCas = toToken;
      const newCities = board.cities.map(c =>
        c.id === city.id ? { ...c, garrison: Math.max(0, c.garrison - toGarrison) } : c
      );
      campaign = { ...campaign, board: { ...board, cities: newCities } };
    }
  }

  // === 8. reinforcement 40% share
  const reinforceShare = settings.reinforceShare + (battleCards[winner]?.reinforceShareBonus || 0);
  const applyReinforce = (loserId, loserCas) => {
    if (!loserId) return { remaining: loserCas, splits: [] };
    const reinforcers = reinforcingUnitIds
      .map(id => units.find(u => u.id === id))
      .filter(u => u && !u.wiped);
    if (reinforcers.length === 0) return { remaining: loserCas, splits: [] };
    const perReinforcer = Math.round((loserCas * reinforceShare) / reinforcers.length);
    const remaining = loserCas - perReinforcer * reinforcers.length;
    return {
      remaining,
      splits: reinforcers.map(u => ({ id: u.id, cas: perReinforcer }))
    };
  };

  let attackerReinforceSplit = { remaining: attCas, splits: [] };
  let defenderReinforceSplit = { remaining: defCas, splits: [] };

  if (winner === 'defender') {
    attackerReinforceSplit = applyReinforce(attackerUnitId, attCas);
  } else {
    defenderReinforceSplit = applyReinforce(defenderUnitId, defCas);
  }

  // === 9. apply manpower loss
  const applyLoss = (u, loss) => ({
    ...u,
    manpower: Math.max(0, u.manpower - loss),
    fatigue: (u.fatigue || 0) + 1
  });

  units = units.map(u => {
    if (u.id === attackerUnitId) return applyLoss(u, attackerReinforceSplit.remaining);
    if (u.id === defenderUnitId) return applyLoss(u, defenderReinforceSplit.remaining);
    const rSplit = attackerReinforceSplit.splits.concat(defenderReinforceSplit.splits).find(s => s.id === u.id);
    if (rSplit) return applyLoss(u, rSplit.cas);
    return u;
  });

  // === 10. wipe check
  units = units.map(u => {
    const s = evaluateStatus(u.manpower, settings);
    if (s === STATUS.WIPED) return { ...u, wiped: true, manpower: 0, hexKey: null };
    if (s === STATUS.LAST_STAND) return { ...u, lastStand: true };
    if (s === STATUS.NORMAL) return { ...u, lastStand: false };
    return u;
  });

  // === 11. special wipe rules: losing while in last stand → wipe
  const afterAttacker = units.find(u => u.id === attackerUnitId);
  const afterDefender = defenderUnitId ? units.find(u => u.id === defenderUnitId) : null;

  if (attackerWasLastStand && winner === 'defender') {
    units = units.map(u => u.id === attackerUnitId ? { ...u, wiped: true, manpower: 0, hexKey: null } : u);
  }
  if (defenderWasLastStand && winner === 'attacker') {
    units = units.map(u => u.id === defenderUnitId ? { ...u, wiped: true, manpower: 0, hexKey: null } : u);
  }

  // === 12. retreat loser
  const retreatHops = settings.retreatHops || 4;
  const extraRetreat = battleCards[winner === 'attacker' ? 'defender' : 'attacker']?.retreatExtra || 0;
  const hops = retreatHops + extraRetreat;

  const retreatUnitId = winner === 'attacker' ? defenderUnitId : attackerUnitId;
  if (retreatUnitId) {
    const loser = units.find(u => u.id === retreatUnitId);
    if (loser && !loser.wiped) {
      const path = retreatPath(board, units, loser.hexKey, loser.faction, hops, [retreatUnitId]);
      if (path.length > 0) {
        const finalHex = path[path.length - 1];
        units = units.map(u => u.id === retreatUnitId ? { ...u, hexKey: finalHex, engagedBattleId: null } : u);
      } else {
        // nowhere to retreat; stays in place
        units = units.map(u => u.id === retreatUnitId ? { ...u, engagedBattleId: null } : u);
      }
    }
  }
  // Last Stand winner also retreats 4 hex toward friendly city
  if (defenderWasLastStand && winner === 'defender') {
    const winUnit = units.find(u => u.id === defenderUnitId);
    if (winUnit && !winUnit.wiped) {
      const path = retreatPath(board, units, winUnit.hexKey, winUnit.faction, hops, [defenderUnitId]);
      if (path.length > 0) {
        units = units.map(u => u.id === defenderUnitId ? { ...u, hexKey: path[path.length - 1], engagedBattleId: null } : u);
      }
    }
  }
  if (attackerWasLastStand && winner === 'attacker') {
    const winUnit = units.find(u => u.id === attackerUnitId);
    if (winUnit && !winUnit.wiped) {
      const path = retreatPath(board, units, winUnit.hexKey, winUnit.faction, hops, [attackerUnitId]);
      if (path.length > 0) {
        units = units.map(u => u.id === attackerUnitId ? { ...u, hexKey: path[path.length - 1], engagedBattleId: null } : u);
      }
    }
  }

  // === 13. draw outcome: both retreat 2, split money evenly (conquest only per rules)
  if (winner === 'draw' && isConquest) {
    const drawHops = 2;
    for (const id of [attackerUnitId, defenderUnitId].filter(Boolean)) {
      const u = units.find(x => x.id === id);
      if (u && !u.wiped) {
        const p = retreatPath(board, units, u.hexKey, u.faction, drawHops, [id]);
        if (p.length > 0) {
          units = units.map(x => x.id === id ? { ...x, hexKey: p[p.length - 1], engagedBattleId: null } : x);
        }
      }
    }
    const share = Math.floor(settings.winBonus / 2);
    factions = {
      ...factions,
      USA: { ...factions.USA, money: factions.USA.money + share },
      CSA: { ...factions.CSA, money: factions.CSA.money + share }
    };
  } else if (winner === 'attacker' || winner === 'defender') {
    // winner collects $400
    const winFaction = winner === 'attacker' ? attacker.faction : defender?.faction;
    if (winFaction) {
      factions = { ...factions, [winFaction]: { ...factions[winFaction], money: factions[winFaction].money + settings.winBonus, victories: factions[winFaction].victories + 1 } };
    }
  }

  // === 14. capture city/fort if attacker wins & defender retreats off the hex
  let newBoard = campaign.board;
  let capturedCityVP = 0;
  if (winner === 'attacker') {
    const city = getCityByHex(newBoard, targetHex);
    if (city && city.owner !== attacker.faction) {
      const isCapital = city.kind === 'capital';
      const newCities = newBoard.cities.map(c =>
        c.id === city.id ? { ...c, owner: attacker.faction, garrison: 0 } : c
      );
      newBoard = { ...newBoard, cities: newCities };
      factions = {
        ...factions,
        [attacker.faction]: {
          ...factions[attacker.faction],
          money: factions[attacker.faction].money + settings.captureBonus,
          vp: factions[attacker.faction].vp + (isCapital ? settings.vpPerCapital : 0)
        }
      };
      capturedCityVP = isCapital ? settings.vpPerCapital : 0;
    }
  }

  // === 15. VP from wipes
  const newlyWiped = units.filter(u => u.wiped && !campaign.units.find(o => o.id === u.id && o.wiped));
  for (const w of newlyWiped) {
    const enemy = w.faction === 'USA' ? 'CSA' : 'USA';
    factions = {
      ...factions,
      [enemy]: { ...factions[enemy], vp: factions[enemy].vp + settings.vpPerWipe }
    };
  }

  // === 16. map cooldown tracking
  const mapHistory = [...(campaign.mapHistory || []), {
    mapName: battle.mapName,
    turn: campaign.turn.turnNumber
  }];

  // === 17. log
  log.push({
    type: 'battle',
    turn: campaign.turn.turnNumber,
    date: `${campaign.turn.month}/${campaign.turn.year}`,
    attacker: attacker.faction,
    defender: defender?.faction || 'Neutral',
    winner,
    targetHex,
    mapName: battle.mapName,
    finalCasualties: { attacker: attackerReinforceSplit.remaining, defender: defenderReinforceSplit.remaining },
    wipedUnits: newlyWiped.map(u => u.id),
    capturedCityVP
  });

  return {
    ...campaign,
    units,
    factions,
    board: newBoard,
    log,
    mapHistory,
    battles: [...(campaign.battles || []), battle]
  };
};
