/**
 * Maryland Campaign 1862 County-Based Map
 *
 * Historical campaign: September 4-20, 1862
 * Lee's first invasion of the North, culminating in the Battle of Antietam.
 *
 * Geographic scope:
 * - Maryland (all counties - main theater)
 * - West Virginia (Eastern Panhandle - Harpers Ferry area)
 * - Virginia (Northern Virginia and Shenandoah - Lee's route)
 * - Pennsylvania (Southern border counties - threatened by invasion)
 *
 * ALL counties in scope are assigned to regions - none left out.
 * Ownership reflects September 1862 status.
 *
 * VP BALANCE NOTES:
 * - Total VP kept low (~50-80 per side) to balance with CP system
 * - CP generation (VP/turn) should be comparable to max CP loss per battle
 * - Max CP loss attacking 5 VP enemy = 75 CP, so VP totals ~50-80 creates tension
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
// VP Scale: 5=key objective, 3=important, 2=moderate, 1=peripheral
// ============================================================================
export const MARYLAND_1862_REGIONS = {
  // ==========================================================================
  // MARYLAND - Main Theater (All 24 counties)
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
    adjacentTerritories: ['md-frederick', 'md-allegany', 'wv-harpers-ferry', 'pa-south-border'],
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
    adjacentTerritories: ['md-antietam', 'md-carroll', 'md-howard', 'md-montgomery', 'wv-harpers-ferry', 'pa-south-border'],
  },

  // BALTIMORE REGION - Urban center
  'md-baltimore': {
    name: 'Baltimore',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 3, // Important - Major city, key Union stronghold
    isUrban: true,
    countyFips: ['24510', '24005'], // Baltimore City, Baltimore County
    maps: MARYLAND_1862_MAPS.urban,
    adjacentTerritories: ['md-harford', 'md-carroll', 'md-howard', 'md-anne-arundel'],
  },

  // WESTERN MARYLAND - Allegany & Garrett
  'md-allegany': {
    name: 'Western Maryland',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 1, // Peripheral
    isUrban: false,
    countyFips: ['24001', '24023'], // Allegany, Garrett
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['md-antietam', 'wv-interior', 'pa-west'],
  },

  // NORTHERN MARYLAND - Carroll County
  'md-carroll': {
    name: 'Carroll County',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 1, // Peripheral
    isUrban: false,
    countyFips: ['24013'], // Carroll
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['md-frederick', 'md-baltimore', 'md-howard', 'pa-south-border'],
  },

  // HARFORD & CECIL - Northeast MD
  'md-harford': {
    name: 'Harford & Cecil',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 1, // Peripheral
    isUrban: false,
    countyFips: ['24025', '24015'], // Harford, Cecil
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['md-baltimore', 'md-kent', 'pa-southeast'],
  },

  // HOWARD COUNTY - Central
  'md-howard': {
    name: 'Howard County',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 1, // Peripheral
    isUrban: false,
    countyFips: ['24027'], // Howard
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['md-frederick', 'md-baltimore', 'md-carroll', 'md-montgomery', 'md-anne-arundel', 'md-prince-georges'],
  },

  // MONTGOMERY & PRINCE GEORGE'S - Near DC
  'md-montgomery': {
    name: 'Montgomery & Prince George\'s',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 3, // Important - Near Washington DC
    isUrban: true,
    countyFips: ['24031', '24033'], // Montgomery, Prince George's
    maps: MARYLAND_1862_MAPS.urban,
    adjacentTerritories: ['md-frederick', 'md-howard', 'md-anne-arundel', 'md-southern', 'va-loudoun', 'va-fairfax'],
  },

  // ANNE ARUNDEL COUNTY - Annapolis
  'md-anne-arundel': {
    name: 'Anne Arundel (Annapolis)',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 2, // Moderate - State capital
    isUrban: true,
    countyFips: ['24003'], // Anne Arundel
    maps: MARYLAND_1862_MAPS.urban,
    adjacentTerritories: ['md-baltimore', 'md-howard', 'md-montgomery', 'md-eastern-shore'],
  },

  // SOUTHERN MARYLAND - Charles, Calvert, St. Mary's
  'md-southern': {
    name: 'Southern Maryland',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 1, // Peripheral
    isUrban: false,
    countyFips: ['24017', '24009', '24037'], // Charles, Calvert, St. Mary's
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['md-montgomery', 'md-anne-arundel', 'va-northern-neck'],
  },

  // EASTERN SHORE - All eastern shore counties consolidated
  'md-eastern-shore': {
    name: 'Eastern Shore',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 1, // Peripheral - far from fighting
    isUrban: false,
    countyFips: ['24029', '24035', '24041', '24011', '24019', '24045', '24039', '24047'], // Kent, Queen Anne's, Talbot, Caroline, Dorchester, Wicomico, Somerset, Worcester
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['md-harford', 'md-anne-arundel'],
  },

  // Keeping md-kent for adjacency with harford
  'md-kent': {
    name: 'Kent County',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['24029'],
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['md-harford', 'md-eastern-shore'],
  },

  // ==========================================================================
  // WEST VIRGINIA - Eastern Panhandle (Key strategic area)
  // Note: In 1862, this was still part of Virginia but Union-sympathizing
  // ==========================================================================

  // HARPERS FERRY - Jefferson County (Critical objective)
  'wv-harpers-ferry': {
    name: "Harper's Ferry",
    stateAbbr: 'WV',
    owner: 'NEUTRAL',
    pointValue: 5, // KEY OBJECTIVE - Critical strategic point, captured by Jackson
    isUrban: true,
    countyFips: ['54037'], // Jefferson County
    maps: MARYLAND_1862_MAPS.harpersFerry,
    adjacentTerritories: ['md-antietam', 'md-frederick', 'wv-berkeley', 'va-loudoun', 'va-clarke'],
  },

  // BERKELEY & MORGAN - Northern Panhandle
  'wv-berkeley': {
    name: 'Berkeley & Morgan',
    stateAbbr: 'WV',
    owner: 'NEUTRAL',
    pointValue: 2, // Moderate
    isUrban: false,
    countyFips: ['54003', '54065'], // Berkeley, Morgan
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['wv-harpers-ferry', 'wv-interior', 'va-shenandoah'],
  },

  // WV INTERIOR - All other WV counties consolidated
  'wv-interior': {
    name: 'West Virginia Interior',
    stateAbbr: 'WV',
    owner: 'USA', // Strong Union sympathies
    pointValue: 2, // Moderate - Wheeling (Unionist capital)
    isUrban: false,
    countyFips: [
      '54027', '54031', '54057', '54023', '54071', // Hampshire, Hardy, Mineral, Grant, Pendleton
      '54093', '54083', '54075', '54101', // Tucker, Randolph, Pocahontas, Webster
      '54025', '54067', '54007', '54015', '54019', // Greenbrier, Nicholas, Braxton, Clay, Fayette
      '54039', '54079', '54043', '54005', '54045', '54059', '54047', '54055', '54081', '54089', '54063', '54109', // Kanawha region
      '54029', '54009', '54051', '54069', '54095', '54103', '54073', '54107', '54105', '54035', '54053', '54011', '54099', '54087', '54013', '54021', '54017', '54033', '54041', '54049', '54061', '54091', '54077', '54097', '54001', '54085' // Wheeling region
    ],
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['md-allegany', 'wv-berkeley', 'va-shenandoah', 'va-southwest', 'pa-west'],
  },

  // ==========================================================================
  // VIRGINIA - Northern Region (Lee's staging area)
  // ==========================================================================

  // LOUDOUN COUNTY - Key crossing point
  'va-loudoun': {
    name: 'Loudoun County',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 2, // Moderate - Key Potomac crossing area
    isUrban: false,
    countyFips: ['51107'], // Loudoun
    maps: MARYLAND_1862_MAPS.drillCamp,
    adjacentTerritories: ['md-montgomery', 'wv-harpers-ferry', 'va-fairfax', 'va-clarke'],
  },

  // FAIRFAX/ARLINGTON - Near DC
  'va-fairfax': {
    name: 'Northern Virginia',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 3, // Important - Near Washington DC
    isUrban: true,
    countyFips: ['51059', '51013', '51510', '51600', '51610', '51683', '51685', '51153', '51061', '51047', '51179', '51177', '51630'], // Fairfax, Arlington, Alexandria, Fairfax City, Falls Church, Manassas, Manassas Park, Prince William, Fauquier, Culpeper, Stafford, Spotsylvania, Fredericksburg
    maps: MARYLAND_1862_MAPS.urban,
    adjacentTerritories: ['md-montgomery', 'va-loudoun', 'va-clarke', 'va-central', 'va-northern-neck'],
  },

  // CLARKE & FREDERICK VA - Shenandoah entrance
  'va-clarke': {
    name: 'Clarke & Frederick (Winchester)',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 3, // Important - Winchester, entrance to Shenandoah
    isUrban: true,
    countyFips: ['51043', '51069', '51840', '51187'], // Clarke, Frederick, Winchester, Warren
    maps: MARYLAND_1862_MAPS.urban,
    adjacentTerritories: ['wv-harpers-ferry', 'wv-berkeley', 'va-loudoun', 'va-fairfax', 'va-shenandoah'],
  },

  // SHENANDOAH VALLEY - Lee's supply route
  'va-shenandoah': {
    name: 'Shenandoah Valley',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 3, // Important - Strategic valley, supply route
    isUrban: false,
    countyFips: ['51171', '51139', '51157', '51113', '51165', '51660', '51079', '51137', '51015', '51790', '51820'], // Shenandoah, Page, Rappahannock, Madison, Rockingham, Harrisonburg, Greene, Orange, Augusta, Staunton, Waynesboro
    maps: MARYLAND_1862_MAPS.drillCamp,
    adjacentTerritories: ['wv-berkeley', 'wv-interior', 'va-clarke', 'va-central', 'va-southwest'],
  },

  // CENTRAL VIRGINIA - Richmond approaches
  'va-central': {
    name: 'Central Virginia',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 2, // Moderate
    isUrban: false,
    countyFips: ['51003', '51540', '51163', '51530', '51678', '51009', '51019', '51515', '51023', '51109', '51065', '51075', '51029', '51049', '51007', '51145', '51011', '51037', '51147', '51135', '51111', '51125'], // Albemarle, Charlottesville, Rockbridge, Buena Vista, Lexington, Amherst, Bedford, Bedford City, Botetourt, Louisa, Fluvanna, Goochland, Buckingham, Cumberland, Amelia, Powhatan, Appomattox, Charlotte, Prince Edward, Nottoway, Lunenburg, Nelson
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['va-fairfax', 'va-shenandoah', 'va-richmond', 'va-northern-neck', 'va-southwest'],
  },

  // NORTHERN NECK & TIDEWATER connections
  'va-northern-neck': {
    name: 'Northern Neck',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1, // Peripheral
    isUrban: false,
    countyFips: ['51099', '51193', '51133', '51103', '51159', '51057', '51119', '51097', '51101', '51033', '51085'], // King George, Westmoreland, Northumberland, Lancaster, Richmond County, Essex, Middlesex, King & Queen, King William, Caroline, Hanover
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['md-southern', 'va-fairfax', 'va-central', 'va-richmond'],
  },

  // RICHMOND - Confederate Capital
  'va-richmond': {
    name: 'Richmond',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 5, // KEY OBJECTIVE - Confederate Capital
    isUrban: true,
    countyFips: ['51760', '51087', '51041', '51127', '51036', '51730', '51053', '51149', '51570', '51670'], // Richmond City, Henrico, Chesterfield, New Kent, Charles City, Petersburg, Dinwiddie, Prince George, Colonial Heights, Hopewell
    maps: MARYLAND_1862_MAPS.urban,
    adjacentTerritories: ['va-central', 'va-northern-neck', 'va-tidewater', 'va-southside'],
  },

  // SOUTHWEST VIRGINIA - Peripheral
  'va-southwest': {
    name: 'Southwest Virginia',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1, // Peripheral
    isUrban: false,
    countyFips: ['51005', '51017', '51091', '51045', '51071', '51021', '51027', '51035', '51051', '51063', '51077', '51105', '51121', '51141', '51155', '51167', '51169', '51173', '51185', '51191', '51195', '51197', '51520', '51640', '51720', '51750', '51680', '51031', '51770', '51161', '51775', '51067'], // Alleghany, Bath, Highland, Craig, Giles, Bland, Buchanan, Carroll, Dickenson, Floyd, Grayson, Lee, Montgomery, Patrick, Pulaski, Russell, Scott, Smyth, Tazewell, Washington, Wise, Wythe, Bristol, Galax, Norton, Radford, Lynchburg, Campbell, Roanoke City, Roanoke County, Salem, Franklin
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['wv-interior', 'va-shenandoah', 'va-central', 'va-southside'],
  },

  // SOUTHSIDE VIRGINIA - Peripheral
  'va-southside': {
    name: 'Southside Virginia',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1, // Peripheral
    isUrban: false,
    countyFips: ['51025', '51081', '51175', '51183', '51083', '51089', '51117', '51143', '51590', '51690'], // Brunswick, Greensville, Southampton, Sussex, Halifax, Henry, Mecklenburg, Pittsylvania, Danville, Martinsville
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['va-richmond', 'va-southwest', 'va-tidewater'],
  },

  // TIDEWATER VIRGINIA - Norfolk area
  'va-tidewater': {
    name: 'Tidewater Virginia',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 2, // Moderate - Norfolk
    isUrban: true,
    countyFips: ['51073', '51093', '51095', '51115', '51199', '51650', '51700', '51710', '51735', '51740', '51800', '51810', '51830', '51001', '51131', '51550', '51595'], // Gloucester, Isle of Wight, James City, Mathews, York, Hampton, Newport News, Norfolk, Poquoson, Portsmouth, Suffolk, Virginia Beach, Williamsburg, Accomack, Northampton, Chesapeake, Emporia
    maps: MARYLAND_1862_MAPS.urban,
    adjacentTerritories: ['va-richmond', 'va-southside'],
  },

  // ==========================================================================
  // PENNSYLVANIA - Consolidated regions (threatened by invasion)
  // ==========================================================================

  // SOUTH BORDER - Adams, Franklin, York, Cumberland (main threat area)
  'pa-south-border': {
    name: 'Southern Pennsylvania',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 3, // Important - Directly threatened, Gettysburg area
    isUrban: false,
    countyFips: ['42001', '42055', '42057', '42133', '42041'], // Adams, Franklin, Fulton, York, Cumberland
    maps: MARYLAND_1862_MAPS.drillCamp,
    adjacentTerritories: ['md-antietam', 'md-frederick', 'md-carroll', 'pa-harrisburg', 'pa-west'],
  },

  // HARRISBURG REGION - State capital
  'pa-harrisburg': {
    name: 'Harrisburg Region',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 3, // Important - State capital
    isUrban: true,
    countyFips: ['42043', '42099', '42075', '42071', '42067', '42087'], // Dauphin, Perry, Lebanon, Lancaster, Juniata, Mifflin
    maps: MARYLAND_1862_MAPS.urban,
    adjacentTerritories: ['pa-south-border', 'pa-southeast', 'pa-central'],
  },

  // SOUTHEAST PA - Philadelphia region
  'pa-southeast': {
    name: 'Philadelphia Region',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 3, // Important - Major city
    isUrban: true,
    countyFips: ['42101', '42091', '42017', '42045', '42029', '42011', '42077', '42095'], // Philadelphia, Montgomery, Bucks, Delaware, Chester, Berks, Lehigh, Northampton
    maps: MARYLAND_1862_MAPS.urban,
    adjacentTerritories: ['md-harford', 'pa-harrisburg', 'pa-northeast'],
  },

  // CENTRAL PA - Interior counties
  'pa-central': {
    name: 'Central Pennsylvania',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 1, // Peripheral
    isUrban: false,
    countyFips: ['42027', '42061', '42013', '42021', '42009', '42111', '42063', '42065', '42005', '42033', '42047', '42023', '42053', '42035', '42081', '42113', '42037', '42079', '42131', '42109', '42097', '42093', '42119', '42107', '42025'], // Centre, Huntingdon, Blair, Cambria, Bedford, Somerset, Indiana, Jefferson, Armstrong, Clearfield, Elk, Cameron, Forest, Clinton, Lycoming, Sullivan, Columbia, Luzerne, Wyoming, Snyder, Northumberland, Montour, Union, Schuylkill, Carbon
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['pa-harrisburg', 'pa-west', 'pa-northeast'],
  },

  // WEST PA - Pittsburgh region
  'pa-west': {
    name: 'Western Pennsylvania',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 2, // Moderate - Pittsburgh
    isUrban: true,
    countyFips: ['42003', '42007', '42129', '42125', '42059', '42051', '42019', '42073', '42085', '42031', '42121', '42039', '42049', '42123', '42083', '42105', '42117', '42015', '42069'], // Allegheny, Beaver, Westmoreland, Washington, Greene, Fayette, Butler, Lawrence, Mercer, Clarion, Venango, Crawford, Erie, Warren, McKean, Potter, Tioga, Bradford, Lackawanna
    maps: MARYLAND_1862_MAPS.urban,
    adjacentTerritories: ['md-allegany', 'wv-interior', 'pa-south-border', 'pa-central', 'pa-northeast'],
  },

  // NORTHEAST PA - Peripheral
  'pa-northeast': {
    name: 'Northeast Pennsylvania',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 1, // Peripheral
    isUrban: false,
    countyFips: ['42089', '42103', '42115', '42127'], // Monroe, Pike, Susquehanna, Wayne
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['pa-southeast', 'pa-central', 'pa-west'],
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
