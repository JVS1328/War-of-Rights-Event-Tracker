/**
 * Combat Power (CP) System Utilities
 * Based on Rising Storm 2: Vietnam mechanics
 *
 * This module provides CP cost calculation functions for the campaign system.
 * CP costs are based on territory VP value, casualties, and battle outcomes.
 */

// ============================================================================
// CONSTANTS - CP Cost Base Values
// ============================================================================

/**
 * Base CP cost for attacking a neutral territory (before VP multiplier)
 */
export const BASE_ATTACK_COST_NEUTRAL = 50;

/**
 * Base CP cost for attacking an enemy territory (before VP multiplier)
 */
export const BASE_ATTACK_COST_ENEMY = 75;

/**
 * Base CP cost for defending a neutral territory (before VP multiplier)
 */
export const BASE_DEFENSE_COST_NEUTRAL = 50;

/**
 * @deprecated BASE_DEFENSE_COST is replaced by BASE_DEFENSE_COST_FRIENDLY and BASE_DEFENSE_COST_NEUTRAL
 * Kept for backward compatibility
 */
export const BASE_DEFENSE_COST = 25;

/**
 * @deprecated DEFENDER_MAX_LOSS is no longer used - defender CP loss is now proportional like attacker
 * Kept for backward compatibility with any code that references it
 */
export const DEFENDER_MAX_LOSS = {
  NEUTRAL: 50,
  FRIENDLY: 25
};

/**
 * Base VP value for 1x multiplier
 * VP multipliers are calculated as: pointValue / VP_BASE
 * With rebalanced VP scale (1-5), minimum VP gets 1x multiplier.
 * Examples: 1 VP = 1x, 2 VP = 2x, 3 VP = 3x, 5 VP = 5x
 */
export const VP_BASE = 1;

/**
 * Default starting CP for both sides
 */
export const DEFAULT_STARTING_CP = 500;

// ============================================================================
// CP COST CALCULATION FUNCTIONS
// ============================================================================

/**
 * Get VP multiplier for a territory based on its point value
 * Calculates multiplier dynamically: pointValue / vpBase
 *
 * @param {number} pointValue - Territory point value (any positive number)
 * @param {number} vpBase - Base VP value for 1x multiplier (default: VP_BASE constant)
 * @returns {number} VP multiplier
 * @throws {Error} If territory point value is invalid
 */
export function getVPMultiplier(pointValue, vpBase = VP_BASE) {
  if (typeof pointValue !== 'number' || pointValue <= 0) {
    throw new Error(`Invalid territory point value: ${pointValue}. Must be a positive number.`);
  }
  return pointValue / vpBase;
}

/**
 * Calculate CP loss for attacker based on casualties and territory ownership
 * Formula: BASE_ATTACK_COST * vpMultiplier * (casualties / totalCasualties)
 * Base cost is 50 for neutral territories, 75 for enemy territories
 * Maximum possible: BASE_ATTACK_COST * vpMultiplier
 *
 * @param {number} pointValue - Territory point value (any positive number)
 * @param {number} casualties - Attacker casualties
 * @param {number} totalCasualties - Total casualties in the battle (both sides)
 * @param {boolean} isNeutralTerritory - Whether attacking neutral (true) or enemy (false) territory
 * @param {number} vpBase - Base VP value for 1x multiplier (from campaign settings)
 * @returns {number} CP loss (rounded to nearest integer)
 */
export function calculateAttackerCPLoss(pointValue, casualties, totalCasualties, isNeutralTerritory = false, vpBase = VP_BASE) {
  // Validate inputs
  if (typeof pointValue !== 'number' || pointValue <= 0) {
    throw new Error(`Invalid territory point value: ${pointValue}. Must be a positive number.`);
  }

  if (typeof casualties !== 'number' || casualties < 0) {
    throw new Error(`Invalid casualties: ${casualties}`);
  }

  if (typeof totalCasualties !== 'number' || totalCasualties < 0) {
    throw new Error(`Invalid total casualties: ${totalCasualties}`);
  }

  // Handle edge case of zero casualties
  if (totalCasualties === 0) {
    return 0;
  }

  // Determine base cost based on territory ownership
  const baseCost = isNeutralTerritory ? BASE_ATTACK_COST_NEUTRAL : BASE_ATTACK_COST_ENEMY;

  const vpMultiplier = getVPMultiplier(pointValue, vpBase);
  const maxLoss = baseCost * vpMultiplier;

  // Calculate loss based on casualty ratio (capped at 100%)
  const casualtyRatio = Math.min(1, casualties / totalCasualties);
  const cpLoss = maxLoss * casualtyRatio;

  return Math.round(cpLoss);
}

/**
 * Calculate CP loss for defender based on casualties
 *
 * Formula: BASE_DEFENSE_COST * vpMultiplier * (casualties / totalCasualties)
 * Base cost is 25 for friendly territories, 50 for neutral territories
 * Proportional to casualties taken - the more casualties you take, the more CP you lose
 *
 * @param {number} pointValue - Territory point value (any positive number)
 * @param {number} casualties - Defender casualties
 * @param {number} totalCasualties - Total casualties in the battle (both sides)
 * @param {boolean} defenderWon - Whether the defender won the battle (no longer affects calculation)
 * @param {boolean} isFriendlyTerritory - Whether defending friendly (true) or neutral (false) territory
 * @param {number} vpBase - Base VP value for 1x multiplier (from campaign settings)
 * @returns {number} CP loss (rounded to nearest integer)
 */
export function calculateDefenderCPLoss(pointValue, casualties, totalCasualties, defenderWon, isFriendlyTerritory, vpBase = VP_BASE) {
  // Validate inputs
  if (typeof pointValue !== 'number' || pointValue <= 0) {
    throw new Error(`Invalid territory point value: ${pointValue}. Must be a positive number.`);
  }

  if (typeof casualties !== 'number' || casualties < 0) {
    throw new Error(`Invalid casualties: ${casualties}`);
  }

  if (typeof totalCasualties !== 'number' || totalCasualties < 0) {
    throw new Error(`Invalid total casualties: ${totalCasualties}`);
  }

  // Handle edge case of zero casualties
  if (totalCasualties === 0) {
    return 0;
  }

  // Determine base cost based on territory ownership
  // Defending neutral territory is more costly (50) than defending friendly territory (25)
  const baseCost = isFriendlyTerritory ? BASE_DEFENSE_COST : BASE_DEFENSE_COST_NEUTRAL;

  // Calculate based on casualties - proportional to casualties taken
  const vpMultiplier = getVPMultiplier(pointValue, vpBase);
  const maxLoss = baseCost * vpMultiplier;

  // Calculate loss based on casualty ratio (capped at 100%)
  const casualtyRatio = Math.min(1, casualties / totalCasualties);
  const cpLoss = maxLoss * casualtyRatio;

  return Math.round(cpLoss);
}

/**
 * Calculate CP losses for both sides in a battle
 * This is the main function to use for battle CP calculations
 *
 * @param {Object} params - Battle parameters
 * @param {number} params.territoryPointValue - Territory VP value (5, 10, or 15)
 * @param {string} params.territoryOwner - Current territory owner ('USA', 'CSA', or 'NEUTRAL')
 * @param {string} params.attacker - Attacking side ('USA' or 'CSA')
 * @param {string} params.winner - Battle winner ('USA' or 'CSA')
 * @param {number} params.attackerCasualties - Attacker casualties
 * @param {number} params.defenderCasualties - Defender casualties
 * @param {boolean} params.abilityActive - Whether the attacker's ability is active
 * @returns {Object} { attackerLoss: number, defenderLoss: number, defender: string }
 */
export function calculateBattleCPCost({
  territoryPointValue,
  territoryOwner,
  attacker,
  winner,
  attackerCasualties,
  defenderCasualties,
  abilityActive = false,
  vpBase = VP_BASE
}) {
  // Determine defender (the side that is NOT attacking)
  // For neutral territories, the defender is the opposing side
  const defender = attacker === 'USA' ? 'CSA' : 'USA';

  const totalCasualties = attackerCasualties + defenderCasualties;

  // Determine if attacking neutral territory
  const isNeutralTerritory = territoryOwner === 'NEUTRAL';

  // Calculate attacker CP loss (based on casualties and territory ownership)
  let attackerLoss = calculateAttackerCPLoss(
    territoryPointValue,
    attackerCasualties,
    totalCasualties,
    isNeutralTerritory,
    vpBase
  );

  // Apply CSA ability: "Valley Supply Lines" - reduces attack CP loss by 50%
  if (abilityActive && attacker === 'CSA') {
    attackerLoss = Math.round(attackerLoss * 0.5);
  }

  // Calculate defender CP loss (if not NEUTRAL)
  let defenderLoss = 0;
  if (defender !== 'NEUTRAL') {
    const defenderWon = winner !== attacker;
    const isFriendlyTerritory = territoryOwner === defender;

    defenderLoss = calculateDefenderCPLoss(
      territoryPointValue,
      defenderCasualties,
      totalCasualties,
      defenderWon,
      isFriendlyTerritory,
      vpBase
    );

    // Apply USA ability: "Special Orders 191" - triples CSA CP loss on attacker victory
    if (abilityActive && attacker === 'USA' && winner === 'USA' && defender === 'CSA') {
      defenderLoss = Math.round(defenderLoss * 3);
    }
  }

  return {
    attackerLoss,
    defenderLoss,
    defender
  };
}

/**
 * Check if a side can afford a battle based on CP cost
 * 
 * @param {Object} side - Side object with CP pool
 * @param {number} side.combatPower - Current CP pool
 * @param {number} cpCost - CP cost of the battle
 * @returns {boolean} True if side can afford the battle
 */
export function canAffordBattle(side, cpCost) {
  if (!side || typeof side.combatPower !== 'number') {
    throw new Error('Invalid side object');
  }
  
  if (typeof cpCost !== 'number' || cpCost < 0) {
    throw new Error(`Invalid CP cost: ${cpCost}`);
  }
  
  return side.combatPower >= cpCost;
}

/**
 * Calculate CP generation for both sides based on controlled territories
 * 
 * @param {Array} territories - Array of all territories
 * @returns {Object} CP generation for each side { usa: number, csa: number }
 */
export function calculateCPGeneration(territories) {
  if (!Array.isArray(territories)) {
    throw new Error('Territories must be an array');
  }
  
  let usaCP = 0;
  let csaCP = 0;
  
  territories.forEach(territory => {
    const cpValue = territory.pointValue || 0;
    
    if (territory.owner === 'USA') {
      usaCP += cpValue;
    } else if (territory.owner === 'CSA') {
      csaCP += cpValue;
    }
    // NEUTRAL territories generate no CP
  });
  
  return { usa: usaCP, csa: csaCP };
}

/**
 * Validate territory point value
 *
 * @param {number} pointValue - Point value to validate
 * @returns {boolean} True if valid
 */
export function isValidPointValue(pointValue) {
  return typeof pointValue === 'number' && pointValue > 0;
}

/**
 * Get maximum possible CP losses for a battle (for display purposes)
 *
 * @param {number} territoryPointValue - Territory VP value (any positive number)
 * @param {string} territoryOwner - Current territory owner
 * @param {string} defender - Defending side
 * @param {number} vpBase - Base VP value for 1x multiplier (from campaign settings)
 * @returns {Object} { attackerMax: number, defenderMax: number }
 */
export function getMaxBattleCPCosts(territoryPointValue, territoryOwner, defender, vpBase = VP_BASE) {
  const vpMultiplier = getVPMultiplier(territoryPointValue, vpBase);

  // Determine attacker max based on territory ownership
  const isNeutralTerritory = territoryOwner === 'NEUTRAL';
  const attackerBaseCost = isNeutralTerritory ? BASE_ATTACK_COST_NEUTRAL : BASE_ATTACK_COST_ENEMY;
  const attackerMax = attackerBaseCost * vpMultiplier;

  // Defender max based on whether defending friendly or neutral territory
  let defenderMax = 0;
  if (defender !== 'NEUTRAL') {
    const isFriendlyTerritory = territoryOwner === defender;
    const defenderBaseCost = isFriendlyTerritory ? BASE_DEFENSE_COST : BASE_DEFENSE_COST_NEUTRAL;
    defenderMax = defenderBaseCost * vpMultiplier;
  }

  return { attackerMax, defenderMax };
}