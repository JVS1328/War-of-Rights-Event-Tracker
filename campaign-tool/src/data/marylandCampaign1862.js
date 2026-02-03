/**
 * Maryland Campaign 1862 County-Based Map
 *
 * Historical campaign: August-September 1862
 * Lee's first invasion of the North, culminating in the Battle of Antietam.
 *
 * Geographic scope:
 * - Maryland (all counties - main theater)
 * - West Virginia (Eastern Panhandle - Harpers Ferry area)
 * - Virginia (Northern Virginia and Shenandoah - Lee's route)
 * - Pennsylvania (Southern border counties - threatened by invasion)
 *
 * DESIGN PRINCIPLES:
 * - Each region has 2-3 counties MAX for tactical maneuverability
 * - More regions allow for encirclement and flanking opportunities
 * - VP is balanced so both sides start equal
 * - Scale: 5=key objective, 3=important, 2=moderate, 1=peripheral
 */

// ============================================================================
// WAR OF RIGHTS MAP ASSIGNMENTS
// Each region gets appropriate maps based on terrain and historical context
// ============================================================================
export const MARYLAND_1862_MAPS = {
  // Antietam maps - for Washington County MD area (the actual battlefield)
  antietam: [
    "East Woods Skirmish", "Hooker's Push", "Hagerstown Turnpike",
    "Miller's Cornfield", "East Woods", "Nicodemus Hill",
    "Bloody Lane", "Pry Ford", "Pry Grist Mill", "Pry House",
    "West Woods", "Dunker Church", "Burnside's Bridge",
    "Cooke's Countercharge", "Otto and Sherrick Farms",
    "Roulette Lane", "Piper Farm", "Hill's Counterattack"
  ],

  // Harpers Ferry maps - for Jefferson County WV area
  harpersFerry: [
    "Maryland Heights", "River Crossing", "Downtown",
    "School House Ridge", "Bolivar Heights Camp", "High Street",
    "Shenandoah Street", "Harpers Ferry Graveyard", "Washington Street",
    "Bolivar Heights Redoubt"
  ],

  // South Mountain maps - for Frederick County MD area
  southMountain: [
    "Garland's Stand", "Cox's Push", "Hatch's Attack",
    "Anderson's Counterattack", "Reno's Fall", "Colquitt's Defense"
  ],

  // Drill Camp maps - generic maps for other territories
  drillCamp: [
    "Alexander Farm", "Crossroads", "Smith Field",
    "Crecy's Cornfield", "Crossley Creek", "Larsen Homestead",
    "South Woodlot", "Flemming's Meadow", "Wagon Road",
    "Union Camp", "Pat's Turnpike", "Stefan's Lot",
    "Confederate Encampment"
  ],

  // Rural/farm maps for rural counties
  rural: [
    "Alexander Farm", "Smith Field", "Crecy's Cornfield",
    "Crossley Creek", "Larsen Homestead", "South Woodlot",
    "Flemming's Meadow", "Wagon Road"
  ],

  // Urban/town maps for urban areas
  urban: [
    "Downtown", "High Street", "Washington Street",
    "Union Camp", "Confederate Encampment"
  ]
};

// ============================================================================
// MARYLAND CAMPAIGN 1862 REGIONS
// Redesigned for tactical gameplay: 2-3 counties max per region
// VP Scale: 5=key objective, 3=important, 2=moderate, 1=peripheral
// ============================================================================
export const MARYLAND_1862_REGIONS = {
  // ==========================================================================
  // MARYLAND - Main Theater (detailed single/paired counties)
  // ==========================================================================

  // THE BATTLEFIELD - Washington County (Antietam, Sharpsburg)
  'md-antietam': {
    name: 'Antietam (Washington Co.)',
    stateAbbr: 'MD',
    owner: 'NEUTRAL',
    pointValue: 5, // KEY OBJECTIVE - Main battle site
    isUrban: false,
    countyFips: ['24043'], // Washington County
    maps: MARYLAND_1862_MAPS.antietam,
    adjacentTerritories: ['md-frederick', 'md-allegany', 'wv-harpers-ferry', 'pa-adams', 'pa-franklin'],
  },

  // SOUTH MOUNTAIN - Frederick County
  'md-frederick': {
    name: 'Frederick County',
    stateAbbr: 'MD',
    owner: 'NEUTRAL',
    pointValue: 3, // Important - South Mountain battles, strategic crossroads
    isUrban: false,
    countyFips: ['24021'], // Frederick County
    maps: MARYLAND_1862_MAPS.southMountain,
    adjacentTerritories: ['md-antietam', 'md-carroll', 'md-howard', 'md-montgomery', 'wv-harpers-ferry', 'pa-adams'],
  },

  // WESTERN MARYLAND - Allegany County
  'md-allegany': {
    name: 'Allegany County',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['24001'], // Allegany County
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['md-antietam', 'md-garrett', 'wv-mineral', 'pa-somerset'],
  },

  // FAR WESTERN MARYLAND - Garrett County
  'md-garrett': {
    name: 'Garrett County',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['24023'], // Garrett County
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['md-allegany', 'wv-mineral', 'pa-somerset'],
  },

  // NORTHERN MARYLAND - Carroll County
  'md-carroll': {
    name: 'Carroll County',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['24013'], // Carroll
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['md-frederick', 'md-baltimore-county', 'md-howard', 'pa-york'],
  },

  // BALTIMORE CITY - Major urban center
  'md-baltimore-city': {
    name: 'Baltimore City',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 3, // Important - Major city, key Union stronghold
    isUrban: true,
    countyFips: ['24510'], // Baltimore City
    maps: MARYLAND_1862_MAPS.urban,
    adjacentTerritories: ['md-baltimore-county', 'md-anne-arundel'],
  },

  // BALTIMORE COUNTY
  'md-baltimore-county': {
    name: 'Baltimore County',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['24005'], // Baltimore County
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['md-baltimore-city', 'md-harford', 'md-carroll', 'md-howard', 'md-anne-arundel'],
  },

  // HARFORD COUNTY
  'md-harford': {
    name: 'Harford County',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['24025'], // Harford
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['md-baltimore-county', 'md-cecil', 'pa-chester'],
  },

  // CECIL COUNTY
  'md-cecil': {
    name: 'Cecil County',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['24015'], // Cecil
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['md-harford', 'md-kent', 'pa-chester'],
  },

  // HOWARD COUNTY - Central
  'md-howard': {
    name: 'Howard County',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['24027'], // Howard
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['md-frederick', 'md-carroll', 'md-baltimore-county', 'md-montgomery', 'md-anne-arundel', 'md-prince-georges'],
  },

  // MONTGOMERY COUNTY - Near DC
  'md-montgomery': {
    name: 'Montgomery County',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 1, // Near Washington DC
    isUrban: true,
    countyFips: ['24031'], // Montgomery
    maps: MARYLAND_1862_MAPS.urban,
    adjacentTerritories: ['md-frederick', 'md-howard', 'md-prince-georges', 'va-loudoun', 'va-fairfax'],
  },

  // PRINCE GEORGE'S COUNTY - Near DC
  'md-prince-georges': {
    name: "Prince George's County",
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 1, // Near Washington DC
    isUrban: true,
    countyFips: ['24033'], // Prince George's
    maps: MARYLAND_1862_MAPS.urban,
    adjacentTerritories: ['md-howard', 'md-montgomery', 'md-anne-arundel', 'md-charles', 'va-fairfax'],
  },

  // ANNE ARUNDEL COUNTY - Annapolis
  'md-anne-arundel': {
    name: 'Anne Arundel (Annapolis)',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 1, // State capital
    isUrban: true,
    countyFips: ['24003'], // Anne Arundel
    maps: MARYLAND_1862_MAPS.urban,
    adjacentTerritories: ['md-baltimore-city', 'md-baltimore-county', 'md-howard', 'md-prince-georges', 'md-calvert', 'md-eastern-upper'],
  },

  // CHARLES COUNTY - Southern MD
  'md-charles': {
    name: 'Charles County',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['24017'], // Charles
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['md-prince-georges', 'md-calvert', 'md-st-marys', 'va-northern-neck'],
  },

  // CALVERT COUNTY
  'md-calvert': {
    name: 'Calvert County',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['24009'], // Calvert
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['md-anne-arundel', 'md-charles', 'md-st-marys'],
  },

  // ST. MARY'S COUNTY
  'md-st-marys': {
    name: "St. Mary's County",
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['24037'], // St. Mary's
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['md-charles', 'md-calvert', 'va-northern-neck'],
  },

  // KENT COUNTY - Upper Eastern Shore
  'md-kent': {
    name: 'Kent County',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['24029'], // Kent
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['md-cecil', 'md-eastern-upper'],
  },

  // UPPER EASTERN SHORE - Queen Anne's, Talbot
  'md-eastern-upper': {
    name: 'Upper Eastern Shore',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['24035', '24041'], // Queen Anne's, Talbot
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['md-kent', 'md-anne-arundel', 'md-eastern-mid'],
  },

  // MID EASTERN SHORE - Caroline, Dorchester
  'md-eastern-mid': {
    name: 'Mid Eastern Shore',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['24011', '24019'], // Caroline, Dorchester
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['md-eastern-upper', 'md-eastern-lower'],
  },

  // LOWER EASTERN SHORE - Wicomico, Somerset, Worcester
  'md-eastern-lower': {
    name: 'Lower Eastern Shore',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['24045', '24039', '24047'], // Wicomico, Somerset, Worcester
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['md-eastern-mid', 'va-eastern-shore'],
  },

  // ==========================================================================
  // WEST VIRGINIA - Eastern Panhandle (Key strategic area)
  // ==========================================================================

  // HARPERS FERRY - Jefferson County (Critical objective)
  'wv-harpers-ferry': {
    name: "Harper's Ferry",
    stateAbbr: 'WV',
    owner: 'NEUTRAL',
    pointValue: 5, // KEY OBJECTIVE - Critical strategic point
    isUrban: true,
    countyFips: ['54037'], // Jefferson County
    maps: MARYLAND_1862_MAPS.harpersFerry,
    adjacentTerritories: ['md-antietam', 'md-frederick', 'wv-berkeley', 'va-loudoun', 'va-clarke'],
  },

  // BERKELEY COUNTY
  'wv-berkeley': {
    name: 'Berkeley County',
    stateAbbr: 'WV',
    owner: 'NEUTRAL',
    pointValue: 2,
    isUrban: false,
    countyFips: ['54003'], // Berkeley
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['wv-harpers-ferry', 'wv-morgan', 'va-clarke', 'va-frederick'],
  },

  // MORGAN COUNTY
  'wv-morgan': {
    name: 'Morgan County',
    stateAbbr: 'WV',
    owner: 'NEUTRAL',
    pointValue: 1,
    isUrban: false,
    countyFips: ['54065'], // Morgan
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['wv-berkeley', 'wv-hampshire', 'va-frederick'],
  },

  // HAMPSHIRE & HARDY - Eastern WV
  'wv-hampshire': {
    name: 'Hampshire & Hardy',
    stateAbbr: 'WV',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['54027', '54031'], // Hampshire, Hardy
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['wv-morgan', 'wv-mineral', 'va-shenandoah-upper'],
  },

  // MINERAL, GRANT, PENDLETON - Mountain counties
  'wv-mineral': {
    name: 'Mineral Region',
    stateAbbr: 'WV',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['54057', '54023', '54071'], // Mineral, Grant, Pendleton
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['md-allegany', 'md-garrett', 'wv-hampshire', 'wv-interior', 'va-shenandoah-upper'],
  },

  // WV INTERIOR - Interior counties (consolidated)
  'wv-interior': {
    name: 'West Virginia Interior',
    stateAbbr: 'WV',
    owner: 'USA',
    pointValue: 2, // Wheeling area - Union sympathies
    isUrban: false,
    countyFips: [
      '54093', '54083', '54075', '54101', '54025', '54067', '54007', '54015', '54019',
      '54039', '54079', '54043', '54005', '54045', '54059', '54047', '54055', '54081',
      '54089', '54063', '54109', '54029', '54009', '54051', '54069', '54095', '54103',
      '54073', '54107', '54105', '54035', '54053', '54011', '54099', '54087', '54013',
      '54021', '54017', '54033', '54041', '54049', '54061', '54091', '54077', '54097', '54001', '54085'
    ],
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['wv-mineral', 'va-shenandoah-lower', 'va-southwest', 'pa-somerset', 'pa-fayette'],
  },

  // ==========================================================================
  // VIRGINIA - Northern Region (Lee's staging area - detailed for maneuver)
  // ==========================================================================

  // LOUDOUN COUNTY - Key crossing point
  'va-loudoun': {
    name: 'Loudoun County',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 2, // Key Potomac crossing area
    isUrban: false,
    countyFips: ['51107'], // Loudoun
    maps: MARYLAND_1862_MAPS.drillCamp,
    adjacentTerritories: ['md-montgomery', 'wv-harpers-ferry', 'va-fairfax', 'va-clarke'],
  },

  // FAIRFAX REGION - Arlington, Alexandria, Fairfax
  'va-fairfax': {
    name: 'Fairfax Region',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 3, // Near Washington DC
    isUrban: true,
    countyFips: ['51059', '51013', '51510', '51600', '51610'], // Fairfax, Arlington, Alexandria, Fairfax City, Falls Church
    maps: MARYLAND_1862_MAPS.urban,
    adjacentTerritories: ['md-montgomery', 'md-prince-georges', 'va-loudoun', 'va-prince-william', 'va-fauquier'],
  },

  // PRINCE WILLIAM & MANASSAS
  'va-prince-william': {
    name: 'Prince William',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 2,
    isUrban: false,
    countyFips: ['51153', '51683', '51685'], // Prince William, Manassas, Manassas Park
    maps: MARYLAND_1862_MAPS.drillCamp,
    adjacentTerritories: ['va-fairfax', 'va-fauquier', 'va-stafford'],
  },

  // FAUQUIER COUNTY
  'va-fauquier': {
    name: 'Fauquier County',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['51061'], // Fauquier
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['va-fairfax', 'va-prince-william', 'va-clarke', 'va-rappahannock', 'va-culpeper'],
  },

  // CLARKE COUNTY - Winchester entrance
  'va-clarke': {
    name: 'Clarke County',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 2, // Entrance to Shenandoah
    isUrban: false,
    countyFips: ['51043'], // Clarke
    maps: MARYLAND_1862_MAPS.drillCamp,
    adjacentTerritories: ['wv-harpers-ferry', 'wv-berkeley', 'va-loudoun', 'va-fauquier', 'va-frederick'],
  },

  // FREDERICK COUNTY VA - Winchester
  'va-frederick': {
    name: 'Frederick (Winchester)',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 3, // Winchester - important supply hub
    isUrban: true,
    countyFips: ['51069', '51840'], // Frederick, Winchester city
    maps: MARYLAND_1862_MAPS.urban,
    adjacentTerritories: ['wv-berkeley', 'wv-morgan', 'va-clarke', 'va-warren', 'va-shenandoah-upper'],
  },

  // WARREN COUNTY
  'va-warren': {
    name: 'Warren County',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['51187'], // Warren
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['va-frederick', 'va-rappahannock', 'va-shenandoah-upper'],
  },

  // RAPPAHANNOCK COUNTY
  'va-rappahannock': {
    name: 'Rappahannock County',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['51157'], // Rappahannock
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['va-fauquier', 'va-warren', 'va-culpeper', 'va-madison'],
  },

  // CULPEPER COUNTY
  'va-culpeper': {
    name: 'Culpeper County',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['51047'], // Culpeper
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['va-fauquier', 'va-rappahannock', 'va-madison', 'va-stafford', 'va-orange'],
  },

  // MADISON COUNTY
  'va-madison': {
    name: 'Madison County',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['51113'], // Madison
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['va-rappahannock', 'va-culpeper', 'va-shenandoah-upper', 'va-greene'],
  },

  // STAFFORD & SPOTSYLVANIA
  'va-stafford': {
    name: 'Stafford & Spotsylvania',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 2,
    isUrban: false,
    countyFips: ['51179', '51177', '51630'], // Stafford, Spotsylvania, Fredericksburg
    maps: MARYLAND_1862_MAPS.drillCamp,
    adjacentTerritories: ['va-prince-william', 'va-culpeper', 'va-orange', 'va-northern-neck', 'va-caroline'],
  },

  // UPPER SHENANDOAH - Shenandoah, Page counties
  'va-shenandoah-upper': {
    name: 'Upper Shenandoah',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 2, // Strategic valley
    isUrban: false,
    countyFips: ['51171', '51139'], // Shenandoah, Page
    maps: MARYLAND_1862_MAPS.drillCamp,
    adjacentTerritories: ['wv-hampshire', 'wv-mineral', 'va-frederick', 'va-warren', 'va-madison', 'va-shenandoah-lower'],
  },

  // LOWER SHENANDOAH - Rockingham, Augusta, Staunton, etc.
  'va-shenandoah-lower': {
    name: 'Lower Shenandoah',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 2, // Strategic valley, Lee's supply route
    isUrban: false,
    countyFips: ['51165', '51660', '51015', '51790', '51820'], // Rockingham, Harrisonburg, Augusta, Staunton, Waynesboro
    maps: MARYLAND_1862_MAPS.drillCamp,
    adjacentTerritories: ['wv-interior', 'va-shenandoah-upper', 'va-greene', 'va-central', 'va-southwest'],
  },

  // GREENE COUNTY
  'va-greene': {
    name: 'Greene County',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['51079'], // Greene
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['va-madison', 'va-shenandoah-lower', 'va-orange', 'va-albemarle'],
  },

  // ORANGE COUNTY
  'va-orange': {
    name: 'Orange County',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['51137'], // Orange
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['va-culpeper', 'va-stafford', 'va-greene', 'va-albemarle', 'va-louisa'],
  },

  // NORTHERN NECK - Coastal VA
  'va-northern-neck': {
    name: 'Northern Neck',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['51099', '51193', '51133', '51103'], // King George, Westmoreland, Northumberland, Lancaster
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['md-charles', 'md-st-marys', 'va-stafford', 'va-caroline'],
  },

  // CAROLINE & HANOVER
  'va-caroline': {
    name: 'Caroline & Hanover',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['51033', '51085'], // Caroline, Hanover
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['va-stafford', 'va-northern-neck', 'va-louisa', 'va-richmond'],
  },

  // LOUISA COUNTY
  'va-louisa': {
    name: 'Louisa County',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['51109'], // Louisa
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['va-orange', 'va-caroline', 'va-albemarle', 'va-fluvanna'],
  },

  // ALBEMARLE - Charlottesville
  'va-albemarle': {
    name: 'Albemarle (Charlottesville)',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 2,
    isUrban: true,
    countyFips: ['51003', '51540'], // Albemarle, Charlottesville
    maps: MARYLAND_1862_MAPS.urban,
    adjacentTerritories: ['va-greene', 'va-orange', 'va-louisa', 'va-fluvanna', 'va-nelson', 'va-shenandoah-lower'],
  },

  // FLUVANNA & GOOCHLAND
  'va-fluvanna': {
    name: 'Fluvanna & Goochland',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['51065', '51075'], // Fluvanna, Goochland
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['va-louisa', 'va-albemarle', 'va-richmond', 'va-central'],
  },

  // NELSON & BUCKINGHAM
  'va-nelson': {
    name: 'Nelson & Buckingham',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['51125', '51029'], // Nelson, Buckingham
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['va-albemarle', 'va-central', 'va-southwest'],
  },

  // RICHMOND - Confederate Capital
  'va-richmond': {
    name: 'Richmond',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 5, // KEY OBJECTIVE - Confederate Capital
    isUrban: true,
    countyFips: ['51760', '51087', '51041'], // Richmond City, Henrico, Chesterfield
    maps: MARYLAND_1862_MAPS.urban,
    adjacentTerritories: ['va-caroline', 'va-fluvanna', 'va-central', 'va-petersburg', 'va-tidewater'],
  },

  // CENTRAL VIRGINIA - Interior (consolidated peripheral)
  'va-central': {
    name: 'Central Virginia',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['51163', '51530', '51678', '51009', '51019', '51515', '51023', '51007', '51145', '51011', '51037', '51147', '51135', '51111'],
    // Rockbridge, Buena Vista, Lexington, Amherst, Bedford, Bedford City, Botetourt, Amelia, Powhatan, Appomattox, Charlotte, Prince Edward, Nottoway, Lunenburg
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['va-shenandoah-lower', 'va-fluvanna', 'va-nelson', 'va-richmond', 'va-petersburg', 'va-southwest', 'va-southside'],
  },

  // PETERSBURG REGION
  'va-petersburg': {
    name: 'Petersburg Region',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 2, // Important rail hub
    isUrban: true,
    countyFips: ['51730', '51053', '51149', '51570', '51670', '51036', '51127'], // Petersburg, Dinwiddie, Prince George, Colonial Heights, Hopewell, Charles City, New Kent
    maps: MARYLAND_1862_MAPS.urban,
    adjacentTerritories: ['va-richmond', 'va-central', 'va-southside', 'va-tidewater'],
  },

  // SOUTHWEST VIRGINIA
  'va-southwest': {
    name: 'Southwest Virginia',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1,
    isUrban: false,
    countyFips: [
      '51005', '51017', '51091', '51045', '51071', '51021', '51027', '51035', '51051',
      '51063', '51077', '51105', '51121', '51141', '51155', '51167', '51169', '51173',
      '51185', '51191', '51195', '51197', '51520', '51640', '51720', '51750', '51680',
      '51031', '51770', '51161', '51775', '51067'
    ],
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['wv-interior', 'va-shenandoah-lower', 'va-nelson', 'va-central', 'va-southside'],
  },

  // SOUTHSIDE VIRGINIA
  'va-southside': {
    name: 'Southside Virginia',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['51025', '51081', '51175', '51183', '51083', '51089', '51117', '51143', '51590', '51690'],
    // Brunswick, Greensville, Southampton, Sussex, Halifax, Henry, Mecklenburg, Pittsylvania, Danville, Martinsville
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['va-central', 'va-petersburg', 'va-southwest', 'va-tidewater'],
  },

  // TIDEWATER VIRGINIA - Norfolk area
  'va-tidewater': {
    name: 'Tidewater Virginia',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 2, // Norfolk - port city
    isUrban: true,
    countyFips: ['51073', '51093', '51095', '51115', '51199', '51650', '51700', '51710', '51735', '51740', '51800', '51810', '51830', '51550', '51595'],
    // Gloucester, Isle of Wight, James City, Mathews, York, Hampton, Newport News, Norfolk, Poquoson, Portsmouth, Suffolk, Virginia Beach, Williamsburg, Chesapeake, Emporia
    maps: MARYLAND_1862_MAPS.urban,
    adjacentTerritories: ['va-richmond', 'va-petersburg', 'va-southside', 'va-eastern-shore'],
  },

  // VIRGINIA EASTERN SHORE
  'va-eastern-shore': {
    name: 'Virginia Eastern Shore',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['51001', '51131'], // Accomack, Northampton
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['md-eastern-lower', 'va-tidewater'],
  },

  // ==========================================================================
  // PENNSYLVANIA - Southern border (detailed - threatened by invasion)
  // ==========================================================================

  // ADAMS COUNTY - Gettysburg area
  'pa-adams': {
    name: 'Adams County',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 1, // Gettysburg area
    isUrban: false,
    countyFips: ['42001'], // Adams
    maps: MARYLAND_1862_MAPS.drillCamp,
    adjacentTerritories: ['md-antietam', 'md-frederick', 'pa-franklin', 'pa-york', 'pa-cumberland'],
  },

  // FRANKLIN COUNTY
  'pa-franklin': {
    name: 'Franklin County',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['42055'], // Franklin
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['md-antietam', 'pa-adams', 'pa-cumberland', 'pa-fulton'],
  },

  // FULTON COUNTY
  'pa-fulton': {
    name: 'Fulton County',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['42057'], // Fulton
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['pa-franklin', 'pa-bedford', 'pa-cumberland'],
  },

  // YORK COUNTY
  'pa-york': {
    name: 'York County',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['42133'], // York
    maps: MARYLAND_1862_MAPS.drillCamp,
    adjacentTerritories: ['md-carroll', 'pa-adams', 'pa-cumberland', 'pa-dauphin', 'pa-lancaster'],
  },

  // CUMBERLAND COUNTY
  'pa-cumberland': {
    name: 'Cumberland County',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['42041'], // Cumberland
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['pa-adams', 'pa-franklin', 'pa-fulton', 'pa-york', 'pa-dauphin', 'pa-perry'],
  },

  // DAUPHIN - Harrisburg (State Capital)
  'pa-dauphin': {
    name: 'Dauphin (Harrisburg)',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 3, // State capital
    isUrban: true,
    countyFips: ['42043'], // Dauphin
    maps: MARYLAND_1862_MAPS.urban,
    adjacentTerritories: ['pa-york', 'pa-cumberland', 'pa-perry', 'pa-lancaster', 'pa-lebanon'],
  },

  // LANCASTER COUNTY
  'pa-lancaster': {
    name: 'Lancaster County',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['42071'], // Lancaster
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['pa-york', 'pa-dauphin', 'pa-chester', 'pa-lebanon', 'pa-berks'],
  },

  // CHESTER COUNTY
  'pa-chester': {
    name: 'Chester County',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['42029'], // Chester
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['md-harford', 'md-cecil', 'pa-lancaster', 'pa-delaware', 'pa-berks'],
  },

  // PERRY COUNTY
  'pa-perry': {
    name: 'Perry County',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['42099'], // Perry
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['pa-cumberland', 'pa-dauphin', 'pa-interior'],
  },

  // LEBANON COUNTY
  'pa-lebanon': {
    name: 'Lebanon County',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['42075'], // Lebanon
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['pa-dauphin', 'pa-lancaster', 'pa-berks', 'pa-interior'],
  },

  // BERKS COUNTY
  'pa-berks': {
    name: 'Berks County',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['42011'], // Berks
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['pa-lancaster', 'pa-chester', 'pa-lebanon', 'pa-philadelphia'],
  },

  // DELAWARE COUNTY
  'pa-delaware': {
    name: 'Delaware County',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['42045'], // Delaware
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['pa-chester', 'pa-philadelphia'],
  },

  // PHILADELPHIA - Major city
  'pa-philadelphia': {
    name: 'Philadelphia Region',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 3, // Major city
    isUrban: true,
    countyFips: ['42101', '42091', '42017'], // Philadelphia, Montgomery, Bucks
    maps: MARYLAND_1862_MAPS.urban,
    adjacentTerritories: ['pa-berks', 'pa-delaware', 'pa-interior'],
  },

  // BEDFORD COUNTY
  'pa-bedford': {
    name: 'Bedford County',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['42009'], // Bedford
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['pa-fulton', 'pa-somerset', 'pa-interior'],
  },

  // SOMERSET COUNTY
  'pa-somerset': {
    name: 'Somerset County',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['42111'], // Somerset
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['md-allegany', 'md-garrett', 'pa-bedford', 'pa-fayette'],
  },

  // FAYETTE COUNTY
  'pa-fayette': {
    name: 'Fayette County',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['42051'], // Fayette
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['wv-interior', 'pa-somerset', 'pa-interior'],
  },

  // PA INTERIOR - Consolidated interior counties
  'pa-interior': {
    name: 'Pennsylvania Interior',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: [
      '42027', '42061', '42013', '42021', '42063', '42065', '42005', '42033', '42047',
      '42023', '42053', '42035', '42081', '42113', '42037', '42079', '42131', '42109',
      '42097', '42093', '42119', '42107', '42025', '42003', '42007', '42129', '42125',
      '42059', '42019', '42073', '42085', '42031', '42121', '42039', '42049', '42123',
      '42083', '42105', '42117', '42015', '42069', '42089', '42103', '42115', '42127',
      '42077', '42095'
    ],
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['pa-perry', 'pa-lebanon', 'pa-philadelphia', 'pa-bedford', 'pa-fayette'],
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get all region IDs
 */
export const getAllRegionIds = () => Object.keys(MARYLAND_1862_REGIONS);

/**
 * Get region data by ID
 */
export const getRegionById = (id) => MARYLAND_1862_REGIONS[id];

/**
 * Get all regions for a specific state
 */
export const getRegionsByState = (stateAbbr) => {
  return Object.entries(MARYLAND_1862_REGIONS)
    .filter(([_, region]) => region.stateAbbr === stateAbbr)
    .map(([id, region]) => ({ id, ...region }));
};

/**
 * Get all unique states in the Maryland 1862 map
 */
export const getMaryland1862States = () => {
  const states = new Set();
  Object.values(MARYLAND_1862_REGIONS).forEach(region => {
    states.add(region.stateAbbr);
  });
  return Array.from(states).sort();
};

/**
 * Get maps available for a region
 */
export const getMapsForRegion = (regionId) => {
  const region = MARYLAND_1862_REGIONS[regionId];
  if (!region) return [];
  return region.maps || MARYLAND_1862_MAPS.drillCamp;
};

/**
 * Get a random map for a region
 */
export const getRandomMapForRegion = (regionId) => {
  const maps = getMapsForRegion(regionId);
  if (maps.length === 0) return null;
  return maps[Math.floor(Math.random() * maps.length)];
};

/**
 * Convert regions to territory format for campaign
 */
export const createMaryland1862Territories = () => {
  return Object.entries(MARYLAND_1862_REGIONS).map(([id, region]) => ({
    id,
    name: region.name,
    owner: region.owner,
    pointValue: region.pointValue,
    victoryPoints: region.pointValue,
    adjacentTerritories: region.adjacentTerritories,
    captureHistory: [],
    countyFips: region.countyFips,
    stateAbbr: region.stateAbbr,
    isUrban: region.isUrban || false,
    maps: region.maps,
  }));
};

/**
 * Calculate initial VP totals
 */
export const calculateInitialVP = () => {
  let usaVP = 0;
  let csaVP = 0;
  let neutralVP = 0;

  Object.values(MARYLAND_1862_REGIONS).forEach(region => {
    if (region.owner === 'USA') {
      usaVP += region.pointValue;
    } else if (region.owner === 'CSA') {
      csaVP += region.pointValue;
    } else {
      neutralVP += region.pointValue;
    }
  });

  return { usa: usaVP, csa: csaVP, neutral: neutralVP };
};

/**
 * Get key campaign territories (high strategic value)
 */
export const getKeyCampaignTerritories = () => {
  return Object.entries(MARYLAND_1862_REGIONS)
    .filter(([_, region]) => region.pointValue >= 3)
    .map(([id, region]) => ({ id, ...region }));
};

/**
 * Get territories by owner
 */
export const getTerritoriesByOwner = (owner) => {
  return Object.entries(MARYLAND_1862_REGIONS)
    .filter(([_, region]) => region.owner === owner)
    .map(([id, region]) => ({ id, ...region }));
};

/**
 * Get all urban territories
 */
export const getUrbanTerritories = () => {
  return Object.entries(MARYLAND_1862_REGIONS)
    .filter(([_, region]) => region.isUrban)
    .map(([id, region]) => ({ id, ...region }));
};
