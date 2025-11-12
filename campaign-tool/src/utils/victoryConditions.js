/**
 * Victory Condition Checking Logic
 * 
 * Supports both legacy VP system and new CP system
 * Priority order (CP system):
 * 1. CP Depletion (≤0 CP)
 * 2. Total Territorial Control (100% of territories)
 * 3. Date-based Victory (December 1865 - VP comparison)
 * 
 * Legacy system checks VP targets and territorial dominance
 */

import { isCampaignOver } from './dateSystem';

/**
 * Main victory condition checker
 * Automatically detects which system to use based on campaign data
 * 
 * @param {Object} campaign - Campaign state
 * @returns {Object|null} Victory result or null if no victory
 */
export const checkVictoryConditions = (campaign) => {
  // Determine which system to use
  const useCPSystem = campaign.cpSystemEnabled && 
                      typeof campaign.combatPowerUSA === 'number' &&
                      typeof campaign.combatPowerCSA === 'number';

  if (useCPSystem) {
    // New CP system checks (priority order)
    const checks = [
      checkCPDepletion,
      checkTotalTerritorialControl,
      checkDateVictory
    ];

    for (const check of checks) {
      const result = check(campaign);
      if (result) return result;
    }
  } else {
    // Legacy VP system checks
    const checks = [
      checkVictoryPoints,
      checkTerritorialControl,
      checkCapitalControl
    ];

    for (const check of checks) {
      const result = check(campaign);
      if (result) return result;
    }
  }

  return null;
};

// ============================================================================
// NEW CP SYSTEM VICTORY CONDITIONS
// ============================================================================

/**
 * Check if either side has depleted CP (≤0)
 * Highest priority victory condition
 * 
 * @param {Object} campaign - Campaign state
 * @returns {Object|null} Victory result or null
 */
const checkCPDepletion = (campaign) => {
  if (campaign.combatPowerUSA <= 0) {
    return {
      winner: 'CSA',
      type: 'Combat Power Depletion',
      description: 'USA has exhausted their combat power and can no longer sustain the war effort',
      cpUSA: campaign.combatPowerUSA,
      cpCSA: campaign.combatPowerCSA
    };
  }

  if (campaign.combatPowerCSA <= 0) {
    return {
      winner: 'USA',
      type: 'Combat Power Depletion',
      description: 'CSA has exhausted their combat power and can no longer sustain the war effort',
      cpUSA: campaign.combatPowerUSA,
      cpCSA: campaign.combatPowerCSA
    };
  }

  return null;
};

/**
 * Check if either side controls ALL territories (100%)
 * Second priority victory condition
 * 
 * @param {Object} campaign - Campaign state
 * @returns {Object|null} Victory result or null
 */
const checkTotalTerritorialControl = (campaign) => {
  const usaTerritories = campaign.territories.filter(t => t.owner === 'USA');
  const csaTerritories = campaign.territories.filter(t => t.owner === 'CSA');
  const total = campaign.territories.length;

  if (usaTerritories.length === total) {
    return {
      winner: 'USA',
      type: 'Total Territorial Control',
      description: `USA controls all ${total} territories`,
      territoriesUSA: usaTerritories.length,
      territoriesCSA: csaTerritories.length
    };
  }

  if (csaTerritories.length === total) {
    return {
      winner: 'CSA',
      type: 'Total Territorial Control',
      description: `CSA controls all ${total} territories`,
      territoriesUSA: usaTerritories.length,
      territoriesCSA: csaTerritories.length
    };
  }

  return null;
};

/**
 * Check if campaign has reached end date (December 1865)
 * Winner determined by VP (sum of controlled territory points)
 * Third priority victory condition
 * 
 * @param {Object} campaign - Campaign state
 * @returns {Object|null} Victory result or null
 */
const checkDateVictory = (campaign) => {
  // Check if we have a campaign date
  if (!campaign.campaignDate) {
    return null;
  }

  // Get end date from settings or use default
  const endDate = campaign.settings?.campaignEndDate || {
    month: 12,
    year: 1865
  };

  // Check if campaign is over
  if (!isCampaignOver(campaign.campaignDate, endDate)) {
    return null;
  }

  // Calculate VP from controlled territories
  const vpCounts = calculateTerritoryVP(campaign.territories);

  if (vpCounts.usa > vpCounts.csa) {
    return {
      winner: 'USA',
      type: 'Campaign End - Victory Points',
      description: `Campaign ended in ${campaign.campaignDate.displayString}. USA controls ${vpCounts.usa} VP worth of territory vs CSA's ${vpCounts.csa} VP`,
      vpUSA: vpCounts.usa,
      vpCSA: vpCounts.csa,
      date: campaign.campaignDate.displayString
    };
  } else if (vpCounts.csa > vpCounts.usa) {
    return {
      winner: 'CSA',
      type: 'Campaign End - Victory Points',
      description: `Campaign ended in ${campaign.campaignDate.displayString}. CSA controls ${vpCounts.csa} VP worth of territory vs USA's ${vpCounts.usa} VP`,
      vpUSA: vpCounts.usa,
      vpCSA: vpCounts.csa,
      date: campaign.campaignDate.displayString
    };
  } else {
    return {
      winner: 'DRAW',
      type: 'Campaign End - Draw',
      description: `Campaign ended in ${campaign.campaignDate.displayString} with both sides controlling ${vpCounts.usa} VP worth of territory`,
      vpUSA: vpCounts.usa,
      vpCSA: vpCounts.csa,
      date: campaign.campaignDate.displayString
    };
  }
};

/**
 * Calculate total VP from controlled territories
 * Used for date-based victory condition
 * 
 * @param {Array} territories - All campaign territories
 * @returns {Object} VP totals { usa: number, csa: number }
 */
const calculateTerritoryVP = (territories) => {
  let usaVP = 0;
  let csaVP = 0;

  territories.forEach(territory => {
    // Support both pointValue (new) and victoryPoints (old)
    const vpValue = territory.pointValue || territory.victoryPoints || 0;

    if (territory.owner === 'USA') {
      usaVP += vpValue;
    } else if (territory.owner === 'CSA') {
      csaVP += vpValue;
    }
    // NEUTRAL territories contribute no VP
  });

  return { usa: usaVP, csa: csaVP };
};

// ============================================================================
// LEGACY VP SYSTEM VICTORY CONDITIONS (Backward Compatibility)
// ============================================================================

/**
 * Legacy: Check if either side reached VP target
 * 
 * @param {Object} campaign - Campaign state
 * @returns {Object|null} Victory result or null
 */
const checkVictoryPoints = (campaign) => {
  if (campaign.victoryPointsUSA >= campaign.victoryPointTarget) {
    return {
      winner: 'USA',
      type: 'Victory Points',
      description: `USA reached ${campaign.victoryPointTarget} victory points`,
      vpUSA: campaign.victoryPointsUSA,
      vpCSA: campaign.victoryPointsCSA
    };
  }
  if (campaign.victoryPointsCSA >= campaign.victoryPointTarget) {
    return {
      winner: 'CSA',
      type: 'Victory Points',
      description: `CSA reached ${campaign.victoryPointTarget} victory points`,
      vpUSA: campaign.victoryPointsUSA,
      vpCSA: campaign.victoryPointsCSA
    };
  }
  return null;
};

/**
 * Legacy: Check for territorial dominance (75% control)
 * 
 * @param {Object} campaign - Campaign state
 * @returns {Object|null} Victory result or null
 */
const checkTerritorialControl = (campaign) => {
  const usaTerritories = campaign.territories.filter(t => t.owner === 'USA');
  const csaTerritories = campaign.territories.filter(t => t.owner === 'CSA');
  const total = campaign.territories.length;

  if (usaTerritories.length / total >= 0.75) {
    return {
      winner: 'USA',
      type: 'Territorial Dominance',
      description: `USA controls ${usaTerritories.length}/${total} territories`,
      territoriesUSA: usaTerritories.length,
      territoriesCSA: csaTerritories.length
    };
  }
  if (csaTerritories.length / total >= 0.75) {
    return {
      winner: 'CSA',
      type: 'Territorial Dominance',
      description: `CSA controls ${csaTerritories.length}/${total} territories`,
      territoriesUSA: usaTerritories.length,
      territoriesCSA: csaTerritories.length
    };
  }
  return null;
};

/**
 * Legacy: Check for control of all capitals
 * 
 * @param {Object} campaign - Campaign state
 * @returns {Object|null} Victory result or null
 */
const checkCapitalControl = (campaign) => {
  const capitals = campaign.territories.filter(t => t.isCapital);
  const usaCapitals = capitals.filter(t => t.owner === 'USA');
  const csaCapitals = capitals.filter(t => t.owner === 'CSA');

  if (usaCapitals.length === capitals.length) {
    return {
      winner: 'USA',
      type: 'Capital Control',
      description: 'USA controls all capital territories',
      capitalsUSA: usaCapitals.length,
      capitalsCSA: csaCapitals.length
    };
  }
  if (csaCapitals.length === capitals.length) {
    return {
      winner: 'CSA',
      type: 'Capital Control',
      description: 'CSA controls all capital territories',
      capitalsUSA: usaCapitals.length,
      capitalsCSA: csaCapitals.length
    };
  }
  return null;
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get current campaign status summary
 * Useful for displaying campaign progress
 * 
 * @param {Object} campaign - Campaign state
 * @returns {Object} Status summary
 */
export const getCampaignStatus = (campaign) => {
  const useCPSystem = campaign.cpSystemEnabled;
  const territoryVP = calculateTerritoryVP(campaign.territories);
  const usaTerritories = campaign.territories.filter(t => t.owner === 'USA').length;
  const csaTerritories = campaign.territories.filter(t => t.owner === 'CSA').length;
  const neutralTerritories = campaign.territories.filter(t => t.owner === 'NEUTRAL').length;

  const status = {
    turn: campaign.currentTurn,
    totalTerritories: campaign.territories.length,
    territoriesUSA: usaTerritories,
    territoriesCSA: csaTerritories,
    territoriesNeutral: neutralTerritories,
    territoryVPUSA: territoryVP.usa,
    territoryVPCSA: territoryVP.csa
  };

  if (useCPSystem) {
    status.cpUSA = campaign.combatPowerUSA;
    status.cpCSA = campaign.combatPowerCSA;
    status.campaignDate = campaign.campaignDate?.displayString || 'Unknown';
  } else {
    status.vpUSA = campaign.victoryPointsUSA;
    status.vpCSA = campaign.victoryPointsCSA;
    status.vpTarget = campaign.victoryPointTarget;
  }

  return status;
};