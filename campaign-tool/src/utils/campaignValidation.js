/**
 * Campaign State Validation Utility
 *
 * Provides comprehensive validation for campaign import/export operations.
 * Ensures all critical state fields are present and valid.
 *
 * Following SOLID principles:
 * - Single Responsibility: Only handles campaign state validation
 * - Open/Closed: Extendable for new validation rules
 */

export const CAMPAIGN_VERSION = '1.0.0';

/**
 * Validates the complete campaign state structure
 * @param {Object} data - The campaign data to validate
 * @returns {Object} { isValid: boolean, errors: string[] }
 */
export const validateCampaignState = (data) => {
  const errors = [];

  // === CORE IDENTIFICATION ===
  if (!data.id || typeof data.id !== 'string') {
    errors.push('Missing or invalid campaign ID');
  }
  if (!data.name || typeof data.name !== 'string') {
    errors.push('Missing or invalid campaign name');
  }
  if (!data.startDate || typeof data.startDate !== 'string') {
    errors.push('Missing or invalid start date');
  }

  // === TURN & TIME SYSTEM ===
  if (typeof data.currentTurn !== 'number' || data.currentTurn < 1) {
    errors.push('Missing or invalid current turn (must be >= 1)');
  }

  // Validate campaign date object
  if (!data.campaignDate || typeof data.campaignDate !== 'object') {
    errors.push('Missing campaign date object');
  } else {
    const { month, year, turn, displayString } = data.campaignDate;

    if (typeof month !== 'number' || month < 1 || month > 12) {
      errors.push('Invalid campaign date month (must be 1-12)');
    }
    if (typeof year !== 'number' || year < 1861 || year > 1865) {
      errors.push('Invalid campaign date year (must be 1861-1865)');
    }
    if (typeof turn !== 'number' || turn < 1) {
      errors.push('Invalid campaign date turn');
    }
    if (!displayString || typeof displayString !== 'string') {
      errors.push('Missing campaign date display string');
    }
  }

  // === VICTORY POINTS ===
  if (typeof data.victoryPointsUSA !== 'number' || data.victoryPointsUSA < 0) {
    errors.push('Missing or invalid USA victory points');
  }
  if (typeof data.victoryPointsCSA !== 'number' || data.victoryPointsCSA < 0) {
    errors.push('Missing or invalid CSA victory points');
  }

  // === TERRITORIES ===
  if (!Array.isArray(data.territories)) {
    errors.push('Missing or invalid territories array');
  } else if (data.territories.length === 0) {
    errors.push('Territories array is empty');
  } else {
    // Validate territory structure
    data.territories.forEach((territory, index) => {
      if (!territory.id || typeof territory.id !== 'string') {
        errors.push(`Territory ${index}: Missing or invalid ID`);
      }
      if (!territory.name || typeof territory.name !== 'string') {
        errors.push(`Territory ${index}: Missing or invalid name`);
      }
      if (!['USA', 'CSA', 'NEUTRAL'].includes(territory.owner)) {
        errors.push(`Territory ${index}: Invalid owner (must be USA, CSA, or NEUTRAL)`);
      }
      if (typeof territory.pointValue !== 'number' || territory.pointValue < 0) {
        errors.push(`Territory ${index}: Invalid point value`);
      }
      if (!Array.isArray(territory.adjacentTerritories)) {
        errors.push(`Territory ${index}: Missing or invalid adjacent territories`);
      }
      if (!territory.svgPath || typeof territory.svgPath !== 'string') {
        errors.push(`Territory ${index}: Missing or invalid SVG path`);
      }
      if (!territory.center || typeof territory.center.x !== 'number' || typeof territory.center.y !== 'number') {
        errors.push(`Territory ${index}: Missing or invalid center coordinates`);
      }
    });
  }

  // === COMBAT POWER SYSTEM ===
  if (typeof data.combatPowerUSA !== 'number' || data.combatPowerUSA < 0) {
    errors.push('Missing or invalid USA combat power');
  }
  if (typeof data.combatPowerCSA !== 'number' || data.combatPowerCSA < 0) {
    errors.push('Missing or invalid CSA combat power');
  }
  if (typeof data.cpSystemEnabled !== 'boolean') {
    errors.push('Missing or invalid CP system enabled flag');
  }

  if (!Array.isArray(data.cpHistory)) {
    errors.push('Missing or invalid CP history array');
  }

  // === BATTLES ===
  if (!Array.isArray(data.battles)) {
    errors.push('Missing or invalid battles array');
  } else {
    // Validate battle structure for non-empty arrays
    data.battles.forEach((battle, index) => {
      if (!battle.id || typeof battle.id !== 'string') {
        errors.push(`Battle ${index}: Missing or invalid ID`);
      }
      if (typeof battle.turn !== 'number' || battle.turn < 1) {
        errors.push(`Battle ${index}: Invalid turn number`);
      }
      if (!battle.territoryId || typeof battle.territoryId !== 'string') {
        errors.push(`Battle ${index}: Missing or invalid territory ID`);
      }
      if (!battle.mapName || typeof battle.mapName !== 'string') {
        errors.push(`Battle ${index}: Missing or invalid map name`);
      }
      if (!['USA', 'CSA'].includes(battle.attacker)) {
        errors.push(`Battle ${index}: Invalid attacker (must be USA or CSA)`);
      }
      if (!['USA', 'CSA'].includes(battle.winner)) {
        errors.push(`Battle ${index}: Invalid winner (must be USA or CSA)`);
      }
    });
  }

  // === SETTINGS ===
  if (!data.settings || typeof data.settings !== 'object') {
    errors.push('Missing settings object');
  } else {
    const { allowTerritoryRecapture, requireAdjacentAttack, casualtyTracking } = data.settings;

    if (typeof allowTerritoryRecapture !== 'boolean') {
      errors.push('Settings: Invalid allowTerritoryRecapture flag');
    }
    if (typeof requireAdjacentAttack !== 'boolean') {
      errors.push('Settings: Invalid requireAdjacentAttack flag');
    }
    if (typeof casualtyTracking !== 'boolean') {
      errors.push('Settings: Invalid casualtyTracking flag');
    }

    // Validate CP system settings
    if (data.cpSystemEnabled) {
      if (typeof data.settings.startingCP !== 'number' || data.settings.startingCP < 0) {
        errors.push('Settings: Invalid starting CP value');
      }
      if (typeof data.settings.cpGenerationEnabled !== 'boolean') {
        errors.push('Settings: Invalid CP generation enabled flag');
      }
      if (typeof data.settings.turnsPerYear !== 'number' || data.settings.turnsPerYear < 1) {
        errors.push('Settings: Invalid turns per year');
      }

      // Validate campaign date settings
      if (!data.settings.campaignStartDate || typeof data.settings.campaignStartDate !== 'object') {
        errors.push('Settings: Missing campaign start date');
      }
      if (!data.settings.campaignEndDate || typeof data.settings.campaignEndDate !== 'object') {
        errors.push('Settings: Missing campaign end date');
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validates and sanitizes imported campaign data
 * @param {Object} data - Raw imported data
 * @returns {Object} { success: boolean, campaign?: Object, error?: string }
 */
export const validateImportedCampaign = (data) => {
  // Check if data exists
  if (!data || typeof data !== 'object') {
    return {
      success: false,
      error: 'Invalid data: Not a valid JSON object'
    };
  }

  // Perform comprehensive validation
  const validation = validateCampaignState(data);

  if (!validation.isValid) {
    const errorList = validation.errors.join('\n• ');
    return {
      success: false,
      error: `Campaign validation failed:\n\n• ${errorList}`
    };
  }

  // Version compatibility check (for future use)
  if (data.version && data.version !== CAMPAIGN_VERSION) {
    console.warn(`Campaign version mismatch: imported ${data.version}, expected ${CAMPAIGN_VERSION}`);
    // For now, we'll allow different versions, but log a warning
  }

  return {
    success: true,
    campaign: data
  };
};

/**
 * Prepares campaign data for export
 * Adds metadata and version information
 * @param {Object} campaign - Current campaign state
 * @returns {Object} Export-ready campaign data
 */
export const prepareCampaignExport = (campaign) => {
  return {
    ...campaign,
    version: CAMPAIGN_VERSION,
    exportDate: new Date().toISOString(),
    exportedBy: 'War of Rights Campaign Tracker'
  };
};

/**
 * Generate a human-readable error message for import failures
 * @param {string} errorMessage - The error message
 * @returns {string} Formatted error message
 */
export const formatImportError = (errorMessage) => {
  return `Failed to import campaign file.\n\n${errorMessage}\n\nPlease ensure you're importing a valid campaign file exported from this application.`;
};
