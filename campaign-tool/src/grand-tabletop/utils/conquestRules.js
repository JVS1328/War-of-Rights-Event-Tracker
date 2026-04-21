// Conquest roll: on Fields/Woods defender terrain, D20 ≤ threshold → Conquest deck.
// Then coin flip to decide if factions swap sides on the WoR map.

import { TERRAIN } from '../data/defaultBoard';

export const rollD20 = () => Math.floor(Math.random() * 20) + 1;
export const coinFlip = () => (Math.random() < 0.5 ? 'heads' : 'tails');

export const isConquestTerrain = (terrain) =>
  terrain === TERRAIN.FIELD || terrain === TERRAIN.FOREST;

export const resolveTerrainDeckKey = (terrain, city) => {
  if (city) {
    if (city.kind === 'fort') return 'terrainForts';
    if (city.kind === 'capital' || city.kind === 'city') return 'terrainCities';
    if (city.kind === 'station') return 'terrainFields';
  }
  if (terrain === TERRAIN.FIELD) return 'terrainFields';
  if (terrain === TERRAIN.FOREST) return 'terrainWoods';
  if (terrain === TERRAIN.RIVER) return 'terrainRiver';
  return 'terrainFields';
};

export const maybeTriggerConquest = (terrain, city, conquestThreshold) => {
  if (city) return { conquest: false, roll: null };
  if (!isConquestTerrain(terrain)) return { conquest: false, roll: null };
  const roll = rollD20();
  return {
    conquest: roll <= conquestThreshold,
    roll
  };
};
