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
 * Base CP cost for defending a territory (before VP multiplier)
 */
export const BASE_DEFENSE_COST = 25;

/**
 * Maximum CP loss caps for defenders who lose
 */
export const DEFENDER_MAX_LOSS = {
  NEUTRAL: 50,   // Max loss when defending neutral territory
  FRIENDLY: 25   // Max loss when defending friendly territory
};

/**
 * VP multipliers based on territory point value
 */
export const VP_MULTIPLIERS = {
  5: 1,   // 5 VP territory
  10: 2,  // 10 VP territory
  15: 3   // 15 VP territory
};

/**
 * Default starting CP for both sides
 */
export const DEFAULT_STARTING_CP = 200;

// ============================================================================
// CP COST CALCULATION FUNCTIONS
// ============================================================================

/**
 * Get VP multiplier for a territory based on its point value
 *
 * @param {number} pointValue - Territory point value (5, 10, or 15)
 * @returns {number} VP multiplier (1, 2, or 3)
 * @throws {Error} If territory point value is invalid
 */
export function getVPMultiplier(pointValue) {
  if (![5, 10, 15].includes(pointValue)) {
    throw new Error(`Invalid territory point value: ${pointValue}. Must be 5, 10, or 15.`);
  }
  return VP_MULTIPLIERS[pointValue];
}

/**
 * Calculate CP loss for attacker based on casualties and territory ownership
 * Formula: BASE_ATTACK_COST * vpMultiplier * (casualties / totalCasualties)
 * Base cost is 50 for neutral territories, 75 for enemy territories
 * Maximum possible: BASE_ATTACK_COST * vpMultiplier
 *
 * @param {number} pointValue - Territory point value (5, 10, or 15)
 * @param {number} casualties - Attacker casualties
 * @param {number} totalCasualties - Total casualties in the battle (both sides)
 * @param {boolean} isNeutralTerritory - Whether attacking neutral (true) or enemy (false) territory
 * @returns {number} CP loss (rounded to nearest integer)
 */
export function calculateAttackerCPLoss(pointValue, casualties, totalCasualties, isNeutralTerritory = false) {
  // Validate inputs
  if (![5, 10, 15].includes(pointValue)) {
    throw new Error(`Invalid territory point value: ${pointValue}. Must be 5, 10, or 15.`);
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
  
  const vpMultiplier = getVPMultiplier(pointValue);
  const maxLoss = baseCost * vpMultiplier;
  
  // Calculate loss based on casualty ratio (capped at 100%)
  const casualtyRatio = Math.min(1, casualties / totalCasualties);
  const cpLoss = maxLoss * casualtyRatio;
  
  return Math.round(cpLoss);
}

/**
 * Calculate CP loss for defender based on casualties and battle outcome
 *
 * If defender WINS: BASE_DEFENSE_COST * vpMultiplier * (casualties / totalCasualties), capped at max for territory type
 * If defender LOSES: Capped maximum (25 for friendly, 50 for neutral - NOT scaled by VP)
 *
 * @param {number} pointValue - Territory point value (5, 10, or 15)
 * @param {number} casualties - Defender casualties
 * @param {number} totalCasualties - Total casualties in the battle (both sides)
 * @param {boolean} defenderWon - Whether the defender won the battle
 * @param {boolean} isFriendlyTerritory - Whether defending friendly (true) or neutral (false) territory
 * @returns {number} CP loss (rounded to nearest integer)
 */
export function calculateDefenderCPLoss(pointValue, casualties, totalCasualties, defenderWon, isFriendlyTerritory) {
  // Validate inputs
  if (![5, 10, 15].includes(pointValue)) {
    throw new Error(`Invalid territory point value: ${pointValue}. Must be 5, 10, or 15.`);
  }
  
  if (typeof casualties !== 'number' || casualties < 0) {
    throw new Error(`Invalid casualties: ${casualties}`);
  }
  
  if (typeof totalCasualties !== 'number' || totalCasualties < 0) {
    throw new Error(`Invalid total casualties: ${totalCasualties}`);
  }
  
  // Determine the maximum CP loss for this territory type
  const maxCPLoss = isFriendlyTerritory ? DEFENDER_MAX_LOSS.FRIENDLY : DEFENDER_MAX_LOSS.NEUTRAL;
  
  // If defender lost, return the capped maximum
  if (!defenderWon) {
    return maxCPLoss;
  }
  
  // Handle edge case of zero casualties
  if (totalCasualties === 0) {
    return 0;
  }
  
  // If defender won, calculate based on casualties (same formula as attacker but with defense base cost)
  const vpMultiplier = getVPMultiplier(pointValue);
  const calculatedLoss = BASE_DEFENSE_COST * vpMultiplier;
  
  const casualtyRatio = Math.min(1, casualties / totalCasualties);
  const cpLoss = calculatedLoss * casualtyRatio;
  
  // Cap the loss at the maximum for this territory type (50 for neutral, 25 for friendly)
  const finalLoss = Math.min(cpLoss, maxCPLoss);
  
  return Math.round(finalLoss);
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
 * @returns {Object} { attackerLoss: number, defenderLoss: number, defender: string }
 */
export function calculateBattleCPCost({
  territoryPointValue,
  territoryOwner,
  attacker,
  winner,
  attackerCasualties,
  defenderCasualties
}) {
  // Determine defender (the side that is NOT attacking)
  // For neutral territories, the defender is the opposing side
  const defender = attacker === 'USA' ? 'CSA' : 'USA';
  
  const totalCasualties = attackerCasualties + defenderCasualties;
  
  // Determine if attacking neutral territory
  const isNeutralTerritory = territoryOwner === 'NEUTRAL';
  
  // Calculate attacker CP loss (based on casualties and territory ownership)
  const attackerLoss = calculateAttackerCPLoss(
    territoryPointValue,
    attackerCasualties,
    totalCasualties,
    isNeutralTerritory
  );
  
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
      isFriendlyTerritory
    );
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
  return [5, 10, 15].includes(pointValue);
}

/**
 * Get maximum possible CP losses for a battle (for display purposes)
 *
 * @param {number} territoryPointValue - Territory VP value (5, 10, or 15)
 * @param {string} territoryOwner - Current territory owner
 * @param {string} defender - Defending side
 * @returns {Object} { attackerMax: number, defenderMax: number }
 */
export function getMaxBattleCPCosts(territoryPointValue, territoryOwner, defender) {
  const vpMultiplier = getVPMultiplier(territoryPointValue);
  
  // Determine attacker max based on territory ownership
  const isNeutralTerritory = territoryOwner === 'NEUTRAL';
  const baseCost = isNeutralTerritory ? BASE_ATTACK_COST_NEUTRAL : BASE_ATTACK_COST_ENEMY;
  const attackerMax = baseCost * vpMultiplier;
  
  let defenderMax = 0;
  if (defender !== 'NEUTRAL') {
    const isFriendlyTerritory = territoryOwner === defender;
    defenderMax = isFriendlyTerritory ? DEFENDER_MAX_LOSS.FRIENDLY : DEFENDER_MAX_LOSS.NEUTRAL;
  }
  
  return { attackerMax, defenderMax };
}