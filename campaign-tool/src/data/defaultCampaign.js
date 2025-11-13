import { INITIAL_TERRITORIES } from './territories';
import { getDefaultStartDate } from '../utils/dateSystem';
import { DEFAULT_STARTING_CP } from '../utils/cpSystem';
import { getStateByAbbr, calculateGroupCenter } from './usaStates';
import { CAMPAIGN_VERSION } from '../utils/campaignValidation';

/**
 * Helper to add SVG path data to a territory based on state abbreviation
 */
function addSvgPath(territory, stateAbbr) {
  const state = getStateByAbbr(stateAbbr);
  if (state) {
    return {
      ...territory,
      svgPath: state.svgPath,
      center: state.center
    };
  }
  return territory;
}

/**
 * Create default Civil War campaign with 20 territories
 * Based on CP System Specification
 */
function createCivilWarTerritories() {
  // Territory definitions with strategic groupings
  const territories = [
    // === USA STARTING TERRITORIES (50 VP total) ===
    // Capital region (15pt)
    addSvgPath({
      id: 'maryland',
      name: 'Maryland',
      owner: 'USA',
      pointValue: 15,
      victoryPoints: 15,
      adjacentTerritories: ['pennsylvania', 'virginia', 'west-virginia', 'delaware'],
      captureHistory: []
    }, 'MD'),
    // Major territories (10pt each = 20pt)
    addSvgPath({
      id: 'pennsylvania',
      name: 'Pennsylvania',
      owner: 'USA',
      pointValue: 10,
      victoryPoints: 10,
      adjacentTerritories: ['ohio', 'maryland', 'new-york'],
      captureHistory: []
    }, 'PA'),
    addSvgPath({
      id: 'ohio',
      name: 'Ohio',
      owner: 'USA',
      pointValue: 10,
      victoryPoints: 10,
      adjacentTerritories: ['pennsylvania', 'indiana', 'kentucky', 'west-virginia'],
      captureHistory: []
    }, 'OH'),
    // Minor territories (5pt each = 15pt)
    addSvgPath({
      id: 'new-york',
      name: 'New York',
      owner: 'USA',
      pointValue: 5,
      victoryPoints: 5,
      adjacentTerritories: ['pennsylvania', 'new-england'],
      captureHistory: []
    }, 'NY'),
    addSvgPath({
      id: 'illinois',
      name: 'Illinois',
      owner: 'USA',
      pointValue: 5,
      victoryPoints: 5,
      adjacentTerritories: ['indiana', 'missouri', 'iowa'],
      captureHistory: []
    }, 'IL'),
    addSvgPath({
      id: 'michigan',
      name: 'Michigan',
      owner: 'USA',
      pointValue: 5,
      victoryPoints: 5,
      adjacentTerritories: ['indiana', 'ohio', 'wisconsin'],
      captureHistory: []
    }, 'MI'),

    // === CSA STARTING TERRITORIES (55 VP total) ===
    // Capital (15pt)
    addSvgPath({
      id: 'virginia',
      name: 'Virginia',
      owner: 'CSA',
      pointValue: 15,
      victoryPoints: 15,
      adjacentTerritories: ['maryland', 'west-virginia', 'north-carolina'],
      captureHistory: []
    }, 'VA'),
    // Major territories (10pt each = 20pt)
    addSvgPath({
      id: 'south-carolina',
      name: 'South Carolina',
      owner: 'CSA',
      pointValue: 10,
      victoryPoints: 10,
      adjacentTerritories: ['north-carolina', 'georgia'],
      captureHistory: []
    }, 'SC'),
    addSvgPath({
      id: 'georgia',
      name: 'Georgia',
      owner: 'CSA',
      pointValue: 10,
      victoryPoints: 10,
      adjacentTerritories: ['south-carolina', 'alabama', 'tennessee', 'north-carolina'],
      captureHistory: []
    }, 'GA'),
    // Minor territories (5pt each = 20pt)
    addSvgPath({
      id: 'alabama',
      name: 'Alabama',
      owner: 'CSA',
      pointValue: 5,
      victoryPoints: 5,
      adjacentTerritories: ['georgia', 'mississippi', 'tennessee'],
      captureHistory: []
    }, 'AL'),
    addSvgPath({
      id: 'mississippi',
      name: 'Mississippi',
      owner: 'CSA',
      pointValue: 5,
      victoryPoints: 5,
      adjacentTerritories: ['alabama', 'louisiana', 'tennessee', 'arkansas'],
      captureHistory: []
    }, 'MS'),
    addSvgPath({
      id: 'louisiana',
      name: 'Louisiana',
      owner: 'CSA',
      pointValue: 5,
      victoryPoints: 5,
      adjacentTerritories: ['mississippi', 'arkansas', 'texas'],
      captureHistory: []
    }, 'LA'),
    addSvgPath({
      id: 'texas',
      name: 'Texas',
      owner: 'CSA',
      pointValue: 5,
      victoryPoints: 5,
      adjacentTerritories: ['louisiana', 'arkansas'],
      captureHistory: []
    }, 'TX'),

    // === NEUTRAL BORDER STATES (45 VP total) ===
    // Major border states (10pt each = 30pt)
    addSvgPath({
      id: 'kentucky',
      name: 'Kentucky',
      owner: 'NEUTRAL',
      pointValue: 10,
      victoryPoints: 10,
      adjacentTerritories: ['ohio', 'west-virginia', 'virginia', 'tennessee', 'missouri', 'indiana'],
      captureHistory: []
    }, 'KY'),
    addSvgPath({
      id: 'missouri',
      name: 'Missouri',
      owner: 'NEUTRAL',
      pointValue: 10,
      victoryPoints: 10,
      adjacentTerritories: ['illinois', 'kentucky', 'tennessee', 'arkansas', 'kansas'],
      captureHistory: []
    }, 'MO'),
    addSvgPath({
      id: 'tennessee',
      name: 'Tennessee',
      owner: 'CSA',
      pointValue: 10,
      victoryPoints: 10,
      adjacentTerritories: ['kentucky', 'virginia', 'north-carolina', 'georgia', 'alabama', 'mississippi', 'arkansas', 'missouri'],
      captureHistory: []
    }, 'TN'),
    // Minor border states (5pt each = 15pt)
    addSvgPath({
      id: 'delaware',
      name: 'Delaware',
      owner: 'USA',
      pointValue: 5,
      victoryPoints: 5,
      adjacentTerritories: ['maryland', 'pennsylvania'],
      captureHistory: []
    }, 'DE'),
    addSvgPath({
      id: 'west-virginia',
      name: 'West Virginia',
      owner: 'NEUTRAL',
      pointValue: 5,
      victoryPoints: 5,
      adjacentTerritories: ['ohio', 'pennsylvania', 'maryland', 'virginia', 'kentucky'],
      captureHistory: []
    }, 'WV'),
    addSvgPath({
      id: 'north-carolina',
      name: 'North Carolina',
      owner: 'CSA',
      pointValue: 5,
      victoryPoints: 5,
      adjacentTerritories: ['virginia', 'tennessee', 'georgia', 'south-carolina'],
      captureHistory: []
    }, 'NC'),
    addSvgPath({
      id: 'arkansas',
      name: 'Arkansas',
      owner: 'CSA',
      pointValue: 5,
      victoryPoints: 5,
      adjacentTerritories: ['missouri', 'tennessee', 'mississippi', 'louisiana', 'texas'],
      captureHistory: []
    }, 'AR')
  ];

  return territories;
}

/**
 * Create a default campaign template
 * Now includes CP system fields
 */
export const createDefaultCampaign = (customMap = null) => {
  // Use custom map territories if provided, otherwise use Civil War default
  const territories = customMap
    ? customMap.territories.map(t => ({
        ...t,
        captureHistory: [],
        owner: t.initialOwner,
        pointValue: t.victoryPoints || t.pointValue || 10, // Ensure pointValue exists
      }))
    : createCivilWarTerritories();

  // Get default campaign start date (April 1861)
  const campaignDate = getDefaultStartDate();

  // Calculate initial VP from territories
  const initialVP = calculateTerritoryVP(territories);

  return {
    // === VERSION ===
    version: CAMPAIGN_VERSION,

    // === EXISTING FIELDS (preserved for backward compatibility) ===
    id: Date.now().toString(),
    name: 'New Campaign',
    startDate: new Date().toISOString(),
    currentTurn: 1,
    victoryPointsUSA: initialVP.usa, // Calculate from territories
    victoryPointsCSA: initialVP.csa, // Calculate from territories
    territories,
    battles: [],
    customMap: customMap || null,
    mapTemplate: customMap ? 'custom' : 'civil-war-default',

    // === NEW CP SYSTEM FIELDS ===
    combatPowerUSA: DEFAULT_STARTING_CP,
    combatPowerCSA: DEFAULT_STARTING_CP,
    campaignDate: campaignDate,
    cpSystemEnabled: true,
    cpHistory: [],

    // Settings with both old and new fields
    settings: {
      // Core settings
      allowTerritoryRecapture: true,
      requireAdjacentAttack: false,
      casualtyTracking: true,

      // New CP system settings
      startingCP: DEFAULT_STARTING_CP,
      cpGenerationEnabled: true,
      campaignStartDate: getDefaultStartDate(),
      campaignEndDate: {
        month: 12,
        year: 1865,
        turn: 30,
        displayString: 'December 1865'
      },
      turnsPerYear: 6
    }
  };
};

/**
 * Default settings factory (backward compatible)
 */
export const getDefaultSettings = () => ({
  // Core settings
  allowTerritoryRecapture: true,
  requireAdjacentAttack: false,
  casualtyTracking: true,
  
  // New CP settings
  startingCP: DEFAULT_STARTING_CP,
  cpGenerationEnabled: true,
  campaignStartDate: getDefaultStartDate(),
  campaignEndDate: {
    month: 12,
    year: 1865,
    turn: 30,
    displayString: 'December 1865'
  },
  turnsPerYear: 6
});

/**
 * Helper to calculate total VP for each side from territories
 * Used for victory condition checks
 */
export const calculateTerritoryVP = (territories) => {
  let usaVP = 0;
  let csaVP = 0;
  
  territories.forEach(territory => {
    const vpValue = territory.pointValue || territory.victoryPoints || 0;
    
    if (territory.owner === 'USA') {
      usaVP += vpValue;
    } else if (territory.owner === 'CSA') {
      csaVP += vpValue;
    }
  });
  
  return { usa: usaVP, csa: csaVP };
};