/**
 * Victory Condition Checking Logic
 *
 * Supports both legacy system and new CP system
 * Priority order (CP system):
 * 1. CP Depletion (≤0 CP)
 * 2. Total Territorial Control (100% of territories)
 * 3. Date-based Victory (December 1865 - VP comparison)
 *
 * Legacy system checks only total territorial control (100% of territories)
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
    // Legacy system - only total territorial control (100%)
    const result = checkTotalTerritorialControl(campaign);
    if (result) return result;
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
      type: 'Supply Point Depletion',
      description: 'USA has exhausted their supply points and can no longer sustain the war effort',
      cpUSA: campaign.combatPowerUSA,
      cpCSA: campaign.combatPowerCSA
    };
  }

  if (campaign.combatPowerCSA <= 0) {
    return {
      winner: 'USA',
      type: 'Supply Point Depletion',
      description: 'CSA has exhausted their supply points and can no longer sustain the war effort',
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
  }

  return status;
};