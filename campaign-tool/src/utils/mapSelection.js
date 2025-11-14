import { ALL_MAPS } from '../data/territories';

/**
 * Get available maps for a territory, considering:
 * 1. Maps assigned to the territory (or all maps if none assigned)
 * 2. Cooldown period - maps played in the last 2 turns cannot be played
 *
 * @param {Object} territory - The territory object with optional 'maps' array
 * @param {Array} battles - All battles in the campaign
 * @param {number} currentTurn - The current turn number
 * @returns {Object} { availableMaps: string[], cooldownMaps: Map<string, number> }
 */
export const getAvailableMapsForTerritory = (territory, battles = [], currentTurn = 1) => {
  // Determine base map pool for this territory
  const territoryMaps = territory?.maps && territory.maps.length > 0
    ? territory.maps
    : ALL_MAPS;

  // Find maps on cooldown (played in last 2 turns for this territory)
  const cooldownMaps = new Map(); // Map name -> turn it was last played

  if (battles && battles.length > 0 && territory) {
    battles
      .filter(battle => battle.territoryId === territory.id)
      .forEach(battle => {
        const turnsSincePlay = currentTurn - battle.turn;

        // Map is on cooldown if played in current turn or within last 2 full turns
        // Example: Map played in turn 5 is unavailable in turns 5, 6, 7 and available again in turn 8
        // turnsSincePlay: 0 (turn 5), 1 (turn 6), 2 (turn 7) - all on cooldown
        // turnsSincePlay: 3 (turn 8) - available again
        if (turnsSincePlay <= 2) {
          // Store the most recent turn this map was played
          if (!cooldownMaps.has(battle.mapName) || battle.turn > cooldownMaps.get(battle.mapName)) {
            cooldownMaps.set(battle.mapName, battle.turn);
          }
        }
      });
  }

  // Filter out maps on cooldown
  const availableMaps = territoryMaps.filter(map => !cooldownMaps.has(map));

  return {
    availableMaps,
    cooldownMaps
  };
};

/**
 * Get a human-readable message about why a map is unavailable
 *
 * @param {string} mapName - Name of the map
 * @param {Map} cooldownMaps - Map of map names to turn they were last played
 * @param {number} currentTurn - Current turn number
 * @returns {string} Human-readable cooldown message
 */
export const getMapCooldownMessage = (mapName, cooldownMaps, currentTurn) => {
  if (!cooldownMaps.has(mapName)) {
    return '';
  }

  const lastPlayedTurn = cooldownMaps.get(mapName);
  const turnsSince = currentTurn - lastPlayedTurn;
  const turnsUntilAvailable = 3 - turnsSince; // Available after 3 turns (played + 2 cooldown)

  if (turnsUntilAvailable <= 0) {
    return '(Available now)';
  }

  return `(Turn ${lastPlayedTurn}, available in ${turnsUntilAvailable} turn${turnsUntilAvailable !== 1 ? 's' : ''})`;
};
