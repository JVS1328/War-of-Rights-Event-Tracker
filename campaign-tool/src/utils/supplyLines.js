/**
 * Supply Line System
 * Territories must be connected to friendly territories to generate CP.
 * Isolated territories cost 2x to defend and generate 0 CP.
 */

/**
 * Check if a territory is connected to at least one other friendly territory
 * A territory is "supplied" if it has an adjacent territory owned by the same side
 *
 * @param {Object} territory - Territory to check
 * @param {Array} allTerritories - All territories in the campaign
 * @returns {boolean} True if territory is connected to friendly supply lines
 */
export function isTerritorySupplied(territory, allTerritories) {
  if (!territory || !allTerritories) return false;

  // Neutral territories are never "supplied" in the traditional sense
  if (territory.owner === 'NEUTRAL') return false;

  const adjacentIds = territory.adjacentTerritories || [];

  // Check if any adjacent territory is owned by the same side
  return adjacentIds.some(adjId => {
    const adjacent = allTerritories.find(t => t.id === adjId);
    return adjacent && adjacent.owner === territory.owner;
  });
}

/**
 * Get all isolated territories for a given side
 *
 * @param {Array} territories - All territories
 * @param {string} side - 'USA' or 'CSA'
 * @returns {Array} Array of isolated territory objects
 */
export function getIsolatedTerritories(territories, side) {
  if (!territories || !side) return [];

  return territories.filter(t =>
    t.owner === side && !isTerritorySupplied(t, territories)
  );
}

/**
 * Get supply status for all territories owned by a side
 *
 * @param {Array} territories - All territories
 * @param {string} side - 'USA' or 'CSA'
 * @returns {Object} { supplied: Territory[], isolated: Territory[] }
 */
export function getSupplyStatus(territories, side) {
  if (!territories || !side) return { supplied: [], isolated: [] };

  const ownedTerritories = territories.filter(t => t.owner === side);

  const supplied = [];
  const isolated = [];

  ownedTerritories.forEach(t => {
    if (isTerritorySupplied(t, territories)) {
      supplied.push(t);
    } else {
      isolated.push(t);
    }
  });

  return { supplied, isolated };
}

/**
 * Isolated territory defense cost multiplier
 */
export const ISOLATED_DEFENSE_MULTIPLIER = 2;
