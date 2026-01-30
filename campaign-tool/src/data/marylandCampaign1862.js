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
    pointValue: 20, // Main battle site - highest value
    isUrban: false,
    countyFips: ['24043'], // Washington County
    maps: MARYLAND_1862_MAPS.antietam,
    adjacentTerritories: ['md-frederick', 'md-allegany', 'wv-harpers-ferry', 'pa-franklin'],
  },

  // SOUTH MOUNTAIN - Frederick County
  'md-frederick': {
    name: 'Frederick County',
    stateAbbr: 'MD',
    owner: 'NEUTRAL',
    pointValue: 15, // South Mountain battles, strategic crossroads
    isUrban: false,
    countyFips: ['24021'], // Frederick County
    maps: MARYLAND_1862_MAPS.southMountain,
    adjacentTerritories: ['md-antietam', 'md-carroll', 'md-howard', 'md-montgomery', 'wv-harpers-ferry', 'pa-adams'],
  },

  // BALTIMORE REGION - Urban center
  'md-baltimore': {
    name: 'Baltimore',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 15, // Major city, key Union stronghold
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
    pointValue: 5,
    isUrban: false,
    countyFips: ['24001', '24023'], // Allegany, Garrett
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['md-antietam', 'wv-mineral', 'pa-somerset'],
  },

  // NORTHERN MARYLAND - Carroll County
  'md-carroll': {
    name: 'Carroll County',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['24013'], // Carroll
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['md-frederick', 'md-baltimore', 'md-howard', 'pa-adams', 'pa-york'],
  },

  // HARFORD COUNTY
  'md-harford': {
    name: 'Harford County',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['24025'], // Harford
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['md-baltimore', 'md-cecil', 'pa-york'],
  },

  // CECIL COUNTY - Northeast corner
  'md-cecil': {
    name: 'Cecil County',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 5,
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
    pointValue: 5,
    isUrban: false,
    countyFips: ['24027'], // Howard
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['md-frederick', 'md-baltimore', 'md-carroll', 'md-montgomery', 'md-anne-arundel', 'md-prince-georges'],
  },

  // MONTGOMERY COUNTY - Near DC
  'md-montgomery': {
    name: 'Montgomery County',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 10, // Near Washington DC
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
    pointValue: 10, // Near Washington DC
    isUrban: true,
    countyFips: ['24033'], // Prince George's
    maps: MARYLAND_1862_MAPS.urban,
    adjacentTerritories: ['md-howard', 'md-montgomery', 'md-anne-arundel', 'md-charles', 'md-calvert', 'va-fairfax'],
  },

  // ANNE ARUNDEL COUNTY - Annapolis
  'md-anne-arundel': {
    name: 'Anne Arundel County',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 10, // State capital Annapolis
    isUrban: true,
    countyFips: ['24003'], // Anne Arundel
    maps: MARYLAND_1862_MAPS.urban,
    adjacentTerritories: ['md-baltimore', 'md-howard', 'md-prince-georges', 'md-calvert', 'md-queen-annes'],
  },

  // SOUTHERN MARYLAND
  'md-charles': {
    name: 'Charles County',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['24017'], // Charles
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['md-prince-georges', 'md-calvert', 'md-st-marys', 'va-king-george'],
  },

  'md-calvert': {
    name: 'Calvert County',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['24009'], // Calvert
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['md-anne-arundel', 'md-prince-georges', 'md-charles', 'md-st-marys'],
  },

  'md-st-marys': {
    name: "St. Mary's County",
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['24037'], // St. Mary's
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['md-charles', 'md-calvert'],
  },

  // EASTERN SHORE - Upper
  'md-kent': {
    name: 'Kent County',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['24029'], // Kent
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['md-cecil', 'md-queen-annes'],
  },

  'md-queen-annes': {
    name: "Queen Anne's County",
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['24035'], // Queen Anne's
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['md-anne-arundel', 'md-kent', 'md-talbot', 'md-caroline'],
  },

  // EASTERN SHORE - Central
  'md-talbot': {
    name: 'Talbot County',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['24041'], // Talbot
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['md-queen-annes', 'md-caroline', 'md-dorchester'],
  },

  'md-caroline': {
    name: 'Caroline County',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['24011'], // Caroline
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['md-queen-annes', 'md-talbot', 'md-dorchester'],
  },

  // EASTERN SHORE - Lower
  'md-dorchester': {
    name: 'Dorchester County',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['24019'], // Dorchester
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['md-talbot', 'md-caroline', 'md-wicomico'],
  },

  'md-wicomico': {
    name: 'Wicomico County',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['24045'], // Wicomico
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['md-dorchester', 'md-somerset', 'md-worcester'],
  },

  'md-somerset': {
    name: 'Somerset County',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['24039'], // Somerset
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['md-wicomico', 'md-worcester'],
  },

  'md-worcester': {
    name: 'Worcester County',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['24047'], // Worcester
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['md-wicomico', 'md-somerset'],
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
    pointValue: 20, // Critical strategic point, captured by Jackson
    isUrban: true,
    countyFips: ['54037'], // Jefferson County
    maps: MARYLAND_1862_MAPS.harpersFerry,
    adjacentTerritories: ['md-antietam', 'md-frederick', 'wv-berkeley', 'va-loudoun', 'va-clarke'],
  },

  // BERKELEY & MORGAN - Northern Panhandle
  'wv-berkeley': {
    name: 'Berkeley County',
    stateAbbr: 'WV',
    owner: 'NEUTRAL',
    pointValue: 10,
    isUrban: false,
    countyFips: ['54003', '54065'], // Berkeley, Morgan
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['wv-harpers-ferry', 'wv-hampshire', 'va-frederick'],
  },

  // HAMPSHIRE & HARDY - Western Panhandle
  'wv-hampshire': {
    name: 'Hampshire Region',
    stateAbbr: 'WV',
    owner: 'NEUTRAL',
    pointValue: 5,
    isUrban: false,
    countyFips: ['54027', '54031'], // Hampshire, Hardy
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['wv-berkeley', 'wv-mineral', 'wv-grant', 'va-shenandoah-upper'],
  },

  // MINERAL & GRANT - Near Allegany MD
  'wv-mineral': {
    name: 'Mineral County',
    stateAbbr: 'WV',
    owner: 'NEUTRAL',
    pointValue: 5,
    isUrban: false,
    countyFips: ['54057', '54023'], // Mineral, Grant
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['md-allegany', 'wv-hampshire', 'wv-tucker'],
  },

  // PENDLETON & HIGHLAND (VA) area
  'wv-grant': {
    name: 'Grant & Pendleton',
    stateAbbr: 'WV',
    owner: 'NEUTRAL',
    pointValue: 5,
    isUrban: false,
    countyFips: ['54071'], // Pendleton
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['wv-hampshire', 'wv-randolph', 'va-shenandoah-upper'],
  },

  // WESTERN WV - Union sympathizing interior
  'wv-tucker': {
    name: 'Tucker & Randolph',
    stateAbbr: 'WV',
    owner: 'USA', // Strong Union sympathies
    pointValue: 5,
    isUrban: false,
    countyFips: ['54093', '54083', '54075', '54101'], // Tucker, Randolph, Pocahontas, Webster
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['wv-mineral', 'wv-randolph'],
  },

  'wv-randolph': {
    name: 'Central Highlands',
    stateAbbr: 'WV',
    owner: 'USA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['54025', '54067', '54007', '54015', '54019'], // Greenbrier, Nicholas, Braxton, Clay, Fayette
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['wv-grant', 'wv-tucker', 'wv-kanawha', 'va-alleghany'],
  },

  // KANAWHA VALLEY - Union controlled
  'wv-kanawha': {
    name: 'Kanawha Valley',
    stateAbbr: 'WV',
    owner: 'USA',
    pointValue: 10, // Important for salt works
    isUrban: true,
    countyFips: ['54039', '54079', '54043', '54005', '54045', '54059', '54047', '54055', '54081', '54089', '54063', '54109'], // Kanawha, Putnam, Lincoln, Boone, Logan, Mingo, McDowell, Mercer, Raleigh, Summers, Monroe, Wyoming
    maps: MARYLAND_1862_MAPS.urban,
    adjacentTerritories: ['wv-randolph', 'wv-wheeling-region', 'va-alleghany'],
  },

  // NORTHERN WV - Wheeling area (Union capital of WV)
  'wv-wheeling-region': {
    name: 'Wheeling Region',
    stateAbbr: 'WV',
    owner: 'USA',
    pointValue: 10, // WV Unionist capital
    isUrban: true,
    countyFips: ['54029', '54009', '54051', '54069', '54095', '54103', '54073', '54107', '54105', '54035', '54053', '54011', '54099', '54087', '54013', '54021', '54017', '54033', '54041', '54049', '54061', '54091', '54077', '54097', '54001', '54085'], // Hancock, Brooke, Marshall, Ohio, Tyler, Wetzel, Pleasants, Wood, Wirt, Jackson, Mason, Cabell, Wayne, Roane, Calhoun, Gilmer, Doddridge, Harrison, Lewis, Marion, Monongalia, Taylor, Preston, Upshur, Barbour, Ritchie
    maps: MARYLAND_1862_MAPS.urban,
    adjacentTerritories: ['wv-kanawha', 'pa-greene'],
  },

  // ==========================================================================
  // VIRGINIA - Northern Region (Lee's staging area)
  // ==========================================================================

  // LOUDOUN COUNTY - Key crossing point
  'va-loudoun': {
    name: 'Loudoun County',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 10, // Key Potomac crossing area
    isUrban: false,
    countyFips: ['51107'], // Loudoun
    maps: MARYLAND_1862_MAPS.drillCamp,
    adjacentTerritories: ['md-montgomery', 'wv-harpers-ferry', 'va-fairfax', 'va-fauquier', 'va-clarke'],
  },

  // FAIRFAX/ARLINGTON - Near DC
  'va-fairfax': {
    name: 'Fairfax & Arlington',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 15, // Near Washington DC
    isUrban: true,
    countyFips: ['51059', '51013', '51510', '51600', '51610', '51683', '51685', '51153'], // Fairfax, Arlington, Alexandria, Fairfax City, Falls Church, Manassas, Manassas Park, Prince William
    maps: MARYLAND_1862_MAPS.urban,
    adjacentTerritories: ['md-montgomery', 'md-prince-georges', 'va-loudoun', 'va-fauquier', 'va-stafford'],
  },

  // FAUQUIER COUNTY
  'va-fauquier': {
    name: 'Fauquier County',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['51061'], // Fauquier
    maps: MARYLAND_1862_MAPS.drillCamp,
    adjacentTerritories: ['va-loudoun', 'va-fairfax', 'va-clarke', 'va-rappahannock', 'va-culpeper', 'va-stafford'],
  },

  // CLARKE COUNTY - Shenandoah entrance
  'va-clarke': {
    name: 'Clarke County',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 10, // Entrance to Shenandoah
    isUrban: false,
    countyFips: ['51043'], // Clarke
    maps: MARYLAND_1862_MAPS.drillCamp,
    adjacentTerritories: ['wv-harpers-ferry', 'wv-berkeley', 'va-loudoun', 'va-fauquier', 'va-frederick', 'va-warren'],
  },

  // FREDERICK COUNTY VA - Winchester
  'va-frederick': {
    name: 'Frederick County (Winchester)',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 10, // Winchester - key Shenandoah city
    isUrban: true,
    countyFips: ['51069', '51840'], // Frederick, Winchester
    maps: MARYLAND_1862_MAPS.urban,
    adjacentTerritories: ['wv-berkeley', 'va-clarke', 'va-warren', 'va-shenandoah-upper'],
  },

  // WARREN COUNTY
  'va-warren': {
    name: 'Warren County',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['51187'], // Warren
    maps: MARYLAND_1862_MAPS.drillCamp,
    adjacentTerritories: ['va-clarke', 'va-frederick', 'va-rappahannock', 'va-shenandoah-upper', 'va-page'],
  },

  // UPPER SHENANDOAH
  'va-shenandoah-upper': {
    name: 'Upper Shenandoah',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 10, // Strategic valley
    isUrban: false,
    countyFips: ['51171', '54031'], // Shenandoah, Hardy (WV - historically VA)
    maps: MARYLAND_1862_MAPS.drillCamp,
    adjacentTerritories: ['wv-hampshire', 'wv-grant', 'va-frederick', 'va-warren', 'va-page', 'va-rockingham'],
  },

  // PAGE COUNTY
  'va-page': {
    name: 'Page County',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['51139'], // Page
    maps: MARYLAND_1862_MAPS.drillCamp,
    adjacentTerritories: ['va-warren', 'va-shenandoah-upper', 'va-rappahannock', 'va-madison', 'va-rockingham'],
  },

  // RAPPAHANNOCK & CULPEPER
  'va-rappahannock': {
    name: 'Rappahannock County',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['51157'], // Rappahannock
    maps: MARYLAND_1862_MAPS.drillCamp,
    adjacentTerritories: ['va-fauquier', 'va-warren', 'va-page', 'va-culpeper', 'va-madison'],
  },

  'va-culpeper': {
    name: 'Culpeper County',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['51047'], // Culpeper
    maps: MARYLAND_1862_MAPS.drillCamp,
    adjacentTerritories: ['va-fauquier', 'va-rappahannock', 'va-madison', 'va-stafford', 'va-orange'],
  },

  // MADISON COUNTY
  'va-madison': {
    name: 'Madison County',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['51113'], // Madison
    maps: MARYLAND_1862_MAPS.drillCamp,
    adjacentTerritories: ['va-page', 'va-rappahannock', 'va-culpeper', 'va-rockingham', 'va-greene', 'va-orange'],
  },

  // ROCKINGHAM COUNTY - Harrisonburg
  'va-rockingham': {
    name: 'Rockingham County',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 10,
    isUrban: true,
    countyFips: ['51165', '51660'], // Rockingham, Harrisonburg
    maps: MARYLAND_1862_MAPS.urban,
    adjacentTerritories: ['va-shenandoah-upper', 'va-page', 'va-madison', 'va-greene', 'va-augusta'],
  },

  // STAFFORD & SPOTSYLVANIA - Fredericksburg area
  'va-stafford': {
    name: 'Stafford & Spotsylvania',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 10, // Fredericksburg
    isUrban: true,
    countyFips: ['51179', '51177', '51630'], // Stafford, Spotsylvania, Fredericksburg
    maps: MARYLAND_1862_MAPS.urban,
    adjacentTerritories: ['va-fairfax', 'va-fauquier', 'va-culpeper', 'va-orange', 'va-king-george', 'va-caroline'],
  },

  // KING GEORGE COUNTY
  'va-king-george': {
    name: 'King George County',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['51099'], // King George
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['md-charles', 'va-stafford', 'va-westmoreland'],
  },

  // VIRGINIA - Central (Supporting regions)
  'va-greene': {
    name: 'Greene County',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['51079'], // Greene
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['va-madison', 'va-rockingham', 'va-albemarle', 'va-orange'],
  },

  'va-orange': {
    name: 'Orange County',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['51137'], // Orange
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['va-culpeper', 'va-madison', 'va-greene', 'va-stafford', 'va-albemarle', 'va-louisa'],
  },

  'va-augusta': {
    name: 'Augusta County',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 10, // Staunton
    isUrban: true,
    countyFips: ['51015', '51790', '51820'], // Augusta, Staunton, Waynesboro
    maps: MARYLAND_1862_MAPS.urban,
    adjacentTerritories: ['va-rockingham', 'va-alleghany', 'va-albemarle', 'va-rockbridge'],
  },

  'va-alleghany': {
    name: 'Alleghany & Highland',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['51005', '51017', '51091'], // Alleghany, Bath, Highland
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['wv-randolph', 'wv-kanawha', 'va-augusta', 'va-rockbridge'],
  },

  // Additional VA counties for completeness
  'va-albemarle': {
    name: 'Albemarle County',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 10, // Charlottesville
    isUrban: true,
    countyFips: ['51003', '51540'], // Albemarle, Charlottesville
    maps: MARYLAND_1862_MAPS.urban,
    adjacentTerritories: ['va-greene', 'va-orange', 'va-augusta', 'va-rockbridge', 'va-nelson', 'va-louisa', 'va-fluvanna'],
  },

  'va-rockbridge': {
    name: 'Rockbridge County',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['51163', '51530', '51678'], // Rockbridge, Buena Vista, Lexington
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['va-augusta', 'va-alleghany', 'va-albemarle', 'va-bedford', 'va-botetourt', 'va-amherst'],
  },

  // Tidewater Virginia connections
  'va-westmoreland': {
    name: 'Northern Neck',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['51193', '51133', '51103', '51159'], // Westmoreland, Northumberland, Lancaster, Richmond County
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['va-king-george', 'va-essex'],
  },

  'va-caroline': {
    name: 'Caroline County',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['51033'], // Caroline
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['va-stafford', 'va-essex', 'va-louisa', 'va-hanover'],
  },

  'va-louisa': {
    name: 'Louisa County',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['51109'], // Louisa
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['va-orange', 'va-albemarle', 'va-caroline', 'va-fluvanna', 'va-goochland', 'va-hanover'],
  },

  'va-fluvanna': {
    name: 'Fluvanna County',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['51065'], // Fluvanna
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['va-albemarle', 'va-louisa', 'va-goochland', 'va-buckingham'],
  },

  // Additional regions to connect the map
  'va-essex': {
    name: 'Essex & Middlesex',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['51057', '51119', '51097', '51101'], // Essex, Middlesex, King & Queen, King William
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['va-westmoreland', 'va-caroline', 'va-hanover', 'va-richmond-region'],
  },

  'va-hanover': {
    name: 'Hanover County',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['51085'], // Hanover
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['va-caroline', 'va-louisa', 'va-goochland', 'va-essex', 'va-richmond-region'],
  },

  'va-goochland': {
    name: 'Goochland County',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['51075'], // Goochland
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['va-louisa', 'va-fluvanna', 'va-hanover', 'va-richmond-region', 'va-cumberland'],
  },

  // Richmond area
  'va-richmond-region': {
    name: 'Richmond',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 25, // Confederate Capital
    isUrban: true,
    countyFips: ['51760', '51087', '51041', '51127', '51036'], // Richmond City, Henrico, Chesterfield, New Kent, Charles City
    maps: MARYLAND_1862_MAPS.urban,
    adjacentTerritories: ['va-essex', 'va-hanover', 'va-goochland', 'va-powhatan', 'va-petersburg'],
  },

  // Supporting VA regions
  'va-nelson': {
    name: 'Nelson County',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['51125'], // Nelson
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['va-albemarle', 'va-amherst', 'va-buckingham'],
  },

  'va-amherst': {
    name: 'Amherst County',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['51009'], // Amherst
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['va-rockbridge', 'va-nelson', 'va-bedford', 'va-lynchburg'],
  },

  'va-bedford': {
    name: 'Bedford County',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['51019', '51515'], // Bedford, Bedford City
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['va-rockbridge', 'va-amherst', 'va-botetourt', 'va-lynchburg', 'va-roanoke'],
  },

  'va-botetourt': {
    name: 'Botetourt County',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['51023'], // Botetourt
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['va-rockbridge', 'va-alleghany', 'va-bedford', 'va-roanoke', 'va-craig'],
  },

  'va-lynchburg': {
    name: 'Lynchburg',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 10,
    isUrban: true,
    countyFips: ['51680', '51031'], // Lynchburg, Campbell
    maps: MARYLAND_1862_MAPS.urban,
    adjacentTerritories: ['va-amherst', 'va-bedford', 'va-appomattox'],
  },

  'va-roanoke': {
    name: 'Roanoke',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 10,
    isUrban: true,
    countyFips: ['51770', '51161', '51045', '51775', '51067'], // Roanoke City, Roanoke County, Craig, Salem, Franklin
    maps: MARYLAND_1862_MAPS.urban,
    adjacentTerritories: ['va-bedford', 'va-botetourt', 'va-southwest'],
  },

  // Southern Virginia
  'va-buckingham': {
    name: 'Buckingham County',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['51029', '51049', '51007'], // Buckingham, Cumberland, Amelia
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['va-fluvanna', 'va-nelson', 'va-appomattox', 'va-cumberland', 'va-powhatan'],
  },

  'va-cumberland': {
    name: 'Cumberland County',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['51049'], // Cumberland
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['va-goochland', 'va-buckingham', 'va-powhatan', 'va-prince-edward'],
  },

  'va-powhatan': {
    name: 'Powhatan County',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['51145'], // Powhatan
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['va-goochland', 'va-buckingham', 'va-cumberland', 'va-richmond-region', 'va-chesterfield'],
  },

  'va-appomattox': {
    name: 'Appomattox County',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['51011', '51037'], // Appomattox, Charlotte
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['va-lynchburg', 'va-buckingham', 'va-prince-edward'],
  },

  'va-prince-edward': {
    name: 'Prince Edward County',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['51147', '51135', '51111'], // Prince Edward, Nottoway, Lunenburg
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['va-cumberland', 'va-appomattox', 'va-chesterfield', 'va-petersburg'],
  },

  'va-chesterfield': {
    name: 'Chesterfield Area',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['51041'], // Chesterfield (partially in Richmond)
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['va-richmond-region', 'va-powhatan', 'va-prince-edward', 'va-petersburg'],
  },

  'va-petersburg': {
    name: 'Petersburg',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 10,
    isUrban: true,
    countyFips: ['51730', '51053', '51149', '51570', '51670', '51025', '51081', '51175', '51183'], // Petersburg, Dinwiddie, Prince George, Colonial Heights, Hopewell, Brunswick, Greensville, Southampton, Sussex
    maps: MARYLAND_1862_MAPS.urban,
    adjacentTerritories: ['va-richmond-region', 'va-prince-edward', 'va-chesterfield', 'va-southside'],
  },

  // Southwest Virginia - not directly involved but completes the map
  'va-southwest': {
    name: 'Southwest Virginia',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 10,
    isUrban: false,
    countyFips: ['51021', '51027', '51035', '51051', '51063', '51071', '51077', '51105', '51121', '51141', '51155', '51167', '51169', '51173', '51185', '51191', '51195', '51197', '51520', '51640', '51720', '51750'], // Bland, Buchanan, Carroll, Dickenson, Floyd, Giles, Grayson, Lee, Montgomery, Patrick, Pulaski, Russell, Scott, Smyth, Tazewell, Washington, Wise, Wythe, Bristol, Galax, Norton, Radford
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['va-roanoke', 'va-alleghany'],
  },

  // Southside Virginia
  'va-southside': {
    name: 'Southside Virginia',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['51083', '51089', '51117', '51143', '51590', '51690'], // Halifax, Henry, Mecklenburg, Pittsylvania, Danville, Martinsville
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['va-petersburg', 'va-lynchburg'],
  },

  // Tidewater Virginia (for completeness)
  'va-tidewater': {
    name: 'Tidewater Virginia',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 15, // Norfolk
    isUrban: true,
    countyFips: ['51073', '51093', '51095', '51115', '51199', '51650', '51700', '51710', '51735', '51740', '51800', '51810', '51830', '51001', '51131', '51550', '51595'], // Gloucester, Isle of Wight, James City, Mathews, York, Hampton, Newport News, Norfolk, Poquoson, Portsmouth, Suffolk, Virginia Beach, Williamsburg, Accomack, Northampton, Chesapeake, Emporia
    maps: MARYLAND_1862_MAPS.urban,
    adjacentTerritories: ['va-richmond-region', 'va-petersburg'],
  },

  // ==========================================================================
  // PENNSYLVANIA - Southern Border (Threatened by invasion)
  // ==========================================================================

  // ADAMS COUNTY - Gettysburg
  'pa-adams': {
    name: 'Adams County (Gettysburg)',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 10, // Future Gettysburg battlefield
    isUrban: false,
    countyFips: ['42001'], // Adams
    maps: MARYLAND_1862_MAPS.drillCamp,
    adjacentTerritories: ['md-frederick', 'md-carroll', 'pa-franklin', 'pa-york', 'pa-cumberland'],
  },

  // FRANKLIN COUNTY
  'pa-franklin': {
    name: 'Franklin County',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['42055', '42057'], // Franklin, Fulton
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['md-antietam', 'pa-adams', 'pa-cumberland', 'pa-bedford'],
  },

  // YORK COUNTY
  'pa-york': {
    name: 'York County',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['42133'], // York
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['md-carroll', 'md-harford', 'pa-adams', 'pa-cumberland', 'pa-dauphin', 'pa-lancaster'],
  },

  // CUMBERLAND COUNTY
  'pa-cumberland': {
    name: 'Cumberland County',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['42041'], // Cumberland
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['pa-adams', 'pa-franklin', 'pa-york', 'pa-dauphin', 'pa-perry'],
  },

  // DAUPHIN COUNTY - Harrisburg (State Capital)
  'pa-dauphin': {
    name: 'Harrisburg',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 15, // State capital
    isUrban: true,
    countyFips: ['42043'], // Dauphin
    maps: MARYLAND_1862_MAPS.urban,
    adjacentTerritories: ['pa-york', 'pa-cumberland', 'pa-perry', 'pa-lebanon', 'pa-lancaster'],
  },

  // LANCASTER COUNTY
  'pa-lancaster': {
    name: 'Lancaster County',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 10, // Large, populous county
    isUrban: true,
    countyFips: ['42071'], // Lancaster
    maps: MARYLAND_1862_MAPS.urban,
    adjacentTerritories: ['pa-york', 'pa-dauphin', 'pa-lebanon', 'pa-chester', 'pa-berks'],
  },

  // CHESTER COUNTY
  'pa-chester': {
    name: 'Chester County',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['42029'], // Chester
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['md-cecil', 'pa-lancaster', 'pa-delaware', 'pa-berks', 'pa-montgomery'],
  },

  // Additional PA counties for map completeness
  'pa-perry': {
    name: 'Perry County',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['42099'], // Perry
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['pa-cumberland', 'pa-dauphin', 'pa-juniata'],
  },

  'pa-lebanon': {
    name: 'Lebanon County',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['42075'], // Lebanon
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['pa-dauphin', 'pa-lancaster', 'pa-berks', 'pa-schuylkill'],
  },

  'pa-berks': {
    name: 'Berks County',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['42011'], // Berks
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['pa-lancaster', 'pa-lebanon', 'pa-chester', 'pa-montgomery', 'pa-schuylkill', 'pa-lehigh'],
  },

  'pa-bedford': {
    name: 'Bedford County',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['42009'], // Bedford
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['pa-franklin', 'pa-somerset', 'pa-huntingdon', 'pa-blair'],
  },

  'pa-somerset': {
    name: 'Somerset County',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['42111'], // Somerset
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['md-allegany', 'pa-bedford', 'pa-fayette', 'pa-cambria'],
  },

  // Southwestern PA border with WV
  'pa-greene': {
    name: 'Greene & Fayette',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['42059', '42051'], // Greene, Fayette
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['wv-wheeling-region', 'pa-somerset', 'pa-washington'],
  },

  // Additional counties to connect map
  'pa-washington': {
    name: 'Washington County',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['42125'], // Washington
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['pa-greene', 'pa-allegheny'],
  },

  'pa-allegheny': {
    name: 'Pittsburgh',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 15, // Major industrial city
    isUrban: true,
    countyFips: ['42003', '42007', '42129'], // Allegheny, Beaver, Westmoreland
    maps: MARYLAND_1862_MAPS.urban,
    adjacentTerritories: ['pa-washington', 'pa-cambria', 'pa-butler', 'pa-armstrong'],
  },

  // More PA counties to complete the state
  'pa-juniata': {
    name: 'Juniata & Mifflin',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['42067', '42087'], // Juniata, Mifflin
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['pa-perry', 'pa-huntingdon', 'pa-snyder', 'pa-centre'],
  },

  'pa-huntingdon': {
    name: 'Huntingdon County',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['42061'], // Huntingdon
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['pa-bedford', 'pa-juniata', 'pa-blair', 'pa-centre'],
  },

  'pa-blair': {
    name: 'Blair County',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['42013'], // Blair
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['pa-bedford', 'pa-huntingdon', 'pa-cambria', 'pa-centre'],
  },

  'pa-cambria': {
    name: 'Cambria County',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['42021'], // Cambria
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['pa-somerset', 'pa-blair', 'pa-allegheny', 'pa-indiana'],
  },

  'pa-centre': {
    name: 'Centre County',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['42027'], // Centre
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['pa-juniata', 'pa-huntingdon', 'pa-blair', 'pa-snyder', 'pa-clearfield', 'pa-clinton'],
  },

  'pa-snyder': {
    name: 'Snyder & Northumberland',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['42109', '42097', '42093'], // Snyder, Northumberland, Montour
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['pa-juniata', 'pa-centre', 'pa-schuylkill', 'pa-columbia'],
  },

  'pa-schuylkill': {
    name: 'Schuylkill County',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['42107', '42025'], // Schuylkill, Carbon
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['pa-lebanon', 'pa-berks', 'pa-snyder', 'pa-lehigh', 'pa-luzerne'],
  },

  'pa-lehigh': {
    name: 'Lehigh Valley',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 10,
    isUrban: true,
    countyFips: ['42077', '42095'], // Lehigh, Northampton
    maps: MARYLAND_1862_MAPS.urban,
    adjacentTerritories: ['pa-berks', 'pa-schuylkill', 'pa-monroe', 'pa-bucks'],
  },

  'pa-montgomery': {
    name: 'Montgomery County',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 10,
    isUrban: true,
    countyFips: ['42091'], // Montgomery
    maps: MARYLAND_1862_MAPS.urban,
    adjacentTerritories: ['pa-chester', 'pa-berks', 'pa-bucks', 'pa-delaware', 'pa-philadelphia'],
  },

  'pa-bucks': {
    name: 'Bucks County',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['42017'], // Bucks
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['pa-lehigh', 'pa-montgomery', 'pa-philadelphia'],
  },

  'pa-delaware': {
    name: 'Delaware County',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['42045'], // Delaware
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['pa-chester', 'pa-montgomery', 'pa-philadelphia'],
  },

  'pa-philadelphia': {
    name: 'Philadelphia',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 20, // Major city, second largest in US
    isUrban: true,
    countyFips: ['42101'], // Philadelphia
    maps: MARYLAND_1862_MAPS.urban,
    adjacentTerritories: ['pa-montgomery', 'pa-bucks', 'pa-delaware'],
  },

  // Northern PA counties (periphery)
  'pa-columbia': {
    name: 'Columbia & Luzerne',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['42037', '42079', '42131'], // Columbia, Luzerne, Wyoming
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['pa-snyder', 'pa-schuylkill', 'pa-monroe', 'pa-susquehanna', 'pa-lycoming'],
  },

  'pa-monroe': {
    name: 'Monroe & Pike',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['42089', '42103'], // Monroe, Pike
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['pa-lehigh', 'pa-schuylkill', 'pa-columbia', 'pa-wayne'],
  },

  'pa-susquehanna': {
    name: 'Susquehanna & Wayne',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['42115', '42127', '42069'], // Susquehanna, Wayne, Lackawanna
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['pa-columbia', 'pa-monroe', 'pa-bradford'],
  },

  'pa-wayne': {
    name: 'Wayne County',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['42127'], // Wayne
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['pa-monroe', 'pa-susquehanna'],
  },

  'pa-lycoming': {
    name: 'Lycoming & Clinton',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['42081', '42035', '42113'], // Lycoming, Clinton, Sullivan
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['pa-centre', 'pa-columbia', 'pa-tioga'],
  },

  'pa-clinton': {
    name: 'Clinton County',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['42035'], // Clinton
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['pa-centre', 'pa-lycoming', 'pa-clearfield', 'pa-potter'],
  },

  'pa-clearfield': {
    name: 'Clearfield & Elk',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['42033', '42047', '42023', '42053'], // Clearfield, Elk, Cameron, Forest
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['pa-centre', 'pa-clinton', 'pa-indiana', 'pa-jefferson', 'pa-mckean'],
  },

  'pa-indiana': {
    name: 'Indiana & Jefferson',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['42063', '42065', '42005'], // Indiana, Jefferson, Armstrong
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['pa-cambria', 'pa-clearfield', 'pa-allegheny', 'pa-butler', 'pa-clarion'],
  },

  'pa-butler': {
    name: 'Butler & Lawrence',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['42019', '42073', '42085'], // Butler, Lawrence, Mercer
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['pa-allegheny', 'pa-indiana', 'pa-clarion', 'pa-venango', 'pa-crawford'],
  },

  'pa-armstrong': {
    name: 'Armstrong County',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['42005'], // Armstrong
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['pa-allegheny', 'pa-indiana', 'pa-butler', 'pa-clarion'],
  },

  'pa-clarion': {
    name: 'Clarion & Venango',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['42031', '42121'], // Clarion, Venango
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['pa-indiana', 'pa-butler', 'pa-clearfield', 'pa-crawford', 'pa-warren'],
  },

  'pa-crawford': {
    name: 'Crawford & Erie',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 10, // Erie port
    isUrban: true,
    countyFips: ['42039', '42049'], // Crawford, Erie
    maps: MARYLAND_1862_MAPS.urban,
    adjacentTerritories: ['pa-butler', 'pa-clarion', 'pa-warren'],
  },

  'pa-warren': {
    name: 'Warren & McKean',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['42123', '42083'], // Warren, McKean
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['pa-clarion', 'pa-crawford', 'pa-clearfield', 'pa-potter'],
  },

  'pa-jefferson': {
    name: 'Jefferson County',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['42065'], // Jefferson
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['pa-clearfield', 'pa-indiana', 'pa-clarion'],
  },

  'pa-mckean': {
    name: 'McKean County',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['42083'], // McKean
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['pa-clearfield', 'pa-warren', 'pa-potter'],
  },

  'pa-potter': {
    name: 'Potter & Tioga',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['42105', '42117', '42015'], // Potter, Tioga, Bradford
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['pa-clinton', 'pa-clearfield', 'pa-warren', 'pa-lycoming'],
  },

  'pa-tioga': {
    name: 'Tioga County',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['42117'], // Tioga
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['pa-lycoming', 'pa-potter', 'pa-bradford'],
  },

  'pa-bradford': {
    name: 'Bradford County',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['42015'], // Bradford
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['pa-tioga', 'pa-susquehanna', 'pa-lycoming'],
  },

  'pa-venango': {
    name: 'Venango County',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['42121'], // Venango
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['pa-butler', 'pa-clarion', 'pa-crawford'],
  },

  'pa-fayette': {
    name: 'Fayette County',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['42051'], // Fayette
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['pa-somerset', 'pa-greene', 'pa-allegheny'],
  },

  'pa-union': {
    name: 'Union County',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 5,
    isUrban: false,
    countyFips: ['42119'], // Union
    maps: MARYLAND_1862_MAPS.rural,
    adjacentTerritories: ['pa-snyder', 'pa-centre', 'pa-lycoming'],
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
    .filter(([_, region]) => region.pointValue >= 15)
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
