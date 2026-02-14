/**
 * Eastern Theatre of the War - County-Based Campaign Map
 *
 * Campaign Timeline: April 1861 - December 1865
 * Turn Length: 2 months (6 turns per year)
 * Victory: December 1865 date OR either side reaches ≤0 CP/SP
 *
 * Geographic scope:
 * - Maryland (all counties)
 * - West Virginia (all counties)
 * - Virginia (all counties/independent cities)
 * - Pennsylvania (all counties)
 *
 * VP BALANCE:
 * - Each side has TWO capital regions worth 7 VP each
 * - USA Capitals: Washington DC Region, Philadelphia
 * - CSA Capitals: Richmond, Petersburg
 * - Normal regions: 1-5 VP
 * - Neutral buffer zone in contested areas
 *
 * Region Design: MAX 2-3 counties per region for strategic maneuverability
 */

// ============================================================================
// WAR OF RIGHTS MAP ASSIGNMENTS
// ============================================================================
export const MARYLAND_1862_MAPS = {
  antietam: [
    "East Woods Skirmish", "Hooker's Push", "Hagerstown Turnpike",
    "Miller's Cornfield", "East Woods", "Nicodemus Hill",
    "Bloody Lane", "Pry Ford", "Pry Grist Mill", "Pry House",
    "West Woods", "Dunker Church", "Burnside's Bridge",
    "Cooke's Countercharge", "Otto and Sherrick Farms",
    "Roulette Lane", "Piper Farm", "Hill's Counterattack"
  ],
  harpersFerry: [
    "Maryland Heights", "River Crossing", "Downtown",
    "School House Ridge", "Bolivar Heights Camp", "High Street",
    "Shenandoah Street", "Harpers Ferry Graveyard", "Washington Street",
    "Bolivar Heights Redoubt"
  ],
  southMountain: [
    "Garland's Stand", "Cox's Push", "Hatch's Attack",
    "Anderson's Counterattack", "Reno's Fall", "Colquitt's Defense"
  ],
};

// ============================================================================
// EASTERN THEATRE REGIONS
// VP Scale: 7=capital, 5=key objective, 4=major, 3=important, 2=moderate, 1=peripheral
// ============================================================================
export const MARYLAND_1862_REGIONS = {
  // ==========================================================================
  // MARYLAND - 24 Counties (12 regions)
  // ==========================================================================

  // USA CAPITAL - Washington DC Region (Montgomery + Prince George's)
  'md-washington-dc': {
    name: 'Washington DC Region',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 7, // USA CAPITAL
    isUrban: true,
    isCapital: true,
    countyFips: ['24031', '24033'], // Montgomery, Prince George's
    terrainWeights: { Urban: 4, Farmlands: 1, Wooded: 1 },
    adjacentTerritories: ['md-frederick', 'md-howard', 'md-anne-arundel', 'md-charles', 'va-loudoun', 'va-fairfax'],
  },

  // Western Maryland - Allegany + Garrett
  'md-western': {
    name: 'Western Maryland',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 2,
    isUrban: false,
    countyFips: ['24001', '24023'], // Allegany, Garrett
    terrainWeights: { Wooded: 4, Farmlands: 2, Urban: 0 },
    adjacentTerritories: ['md-washington-county', 'wv-mineral', 'pa-somerset-bedford'],
  },

  // Washington County (Antietam battlefield)
  'md-washington-county': {
    name: 'Washington County (Antietam)',
    stateAbbr: 'MD',
    owner: 'NEUTRAL',
    pointValue: 5, // KEY OBJECTIVE - Main battlefield
    isUrban: false,
    countyFips: ['24043'], // Washington County
    maps: MARYLAND_1862_MAPS.antietam,
    adjacentTerritories: ['md-western', 'md-frederick', 'wv-jefferson', 'pa-fulton-franklin'],
  },

  // Frederick County (South Mountain)
  'md-frederick': {
    name: 'Frederick County',
    stateAbbr: 'MD',
    owner: 'NEUTRAL',
    pointValue: 4, // MAJOR - South Mountain battles
    isUrban: false,
    countyFips: ['24021'], // Frederick County
    maps: MARYLAND_1862_MAPS.southMountain,
    adjacentTerritories: ['md-washington-county', 'md-carroll', 'md-howard', 'md-washington-dc', 'wv-jefferson', 'pa-cumberland-franklin'],
  },

  // Carroll County
  'md-carroll': {
    name: 'Carroll County',
    stateAbbr: 'MD',
    owner: 'NEUTRAL',
    pointValue: 2,
    isUrban: false,
    countyFips: ['24013'], // Carroll
    terrainWeights: { Farmlands: 4, Wooded: 2, Urban: 0 },
    adjacentTerritories: ['md-frederick', 'md-baltimore', 'md-howard', 'pa-cumberland-franklin'],
  },

  // Baltimore Region (City + County)
  'md-baltimore': {
    name: 'Baltimore',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 4, // MAJOR - Key port city
    isUrban: true,
    countyFips: ['24510', '24005'], // Baltimore City, Baltimore County
    terrainWeights: { Urban: 4, Farmlands: 1, Wooded: 1 },
    adjacentTerritories: ['md-carroll', 'md-harford-cecil', 'md-howard', 'md-anne-arundel'],
  },

  // Harford + Cecil (Northeast MD)
  'md-harford-cecil': {
    name: 'Harford & Cecil',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 2,
    isUrban: false,
    countyFips: ['24025', '24015'], // Harford, Cecil
    terrainWeights: { Farmlands: 4, Wooded: 2, Urban: 0 },
    adjacentTerritories: ['md-baltimore', 'md-kent', 'pa-chester-delaware'],
  },

  // Howard County
  'md-howard': {
    name: 'Howard County',
    stateAbbr: 'MD',
    owner: 'NEUTRAL',
    pointValue: 2,
    isUrban: false,
    countyFips: ['24027'], // Howard
    terrainWeights: { Farmlands: 4, Wooded: 2, Urban: 0 },
    adjacentTerritories: ['md-frederick', 'md-carroll', 'md-baltimore', 'md-anne-arundel', 'md-washington-dc'],
  },

  // Anne Arundel (Annapolis)
  'md-anne-arundel': {
    name: 'Anne Arundel (Annapolis)',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 3, // IMPORTANT - State capital
    isUrban: true,
    countyFips: ['24003'], // Anne Arundel
    terrainWeights: { Farmlands: 3, Wooded: 1, Urban: 2 },
    adjacentTerritories: ['md-baltimore', 'md-howard', 'md-washington-dc', 'md-calvert', 'md-queen-annes'],
  },

  // Charles County
  'md-charles': {
    name: 'Charles County',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 2,
    isUrban: false,
    countyFips: ['24017'], // Charles
    terrainWeights: { Farmlands: 5, Wooded: 1, Urban: 0 },
    adjacentTerritories: ['md-washington-dc', 'md-calvert', 'md-st-marys', 'va-king-george'],
  },

  // Calvert County
  'md-calvert': {
    name: 'Calvert County',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['24009'], // Calvert
    terrainWeights: { Farmlands: 5, Wooded: 1, Urban: 0 },
    adjacentTerritories: ['md-anne-arundel', 'md-charles', 'md-st-marys'],
  },

  // St. Mary's County
  'md-st-marys': {
    name: "St. Mary's County",
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['24037'], // St. Mary's
    terrainWeights: { Farmlands: 5, Wooded: 1, Urban: 0 },
    adjacentTerritories: ['md-charles', 'md-calvert', 'va-northumberland'],
  },

  // Kent County
  'md-kent': {
    name: 'Kent County',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['24029'], // Kent
    terrainWeights: { Farmlands: 5, Wooded: 1, Urban: 0 },
    adjacentTerritories: ['md-harford-cecil', 'md-queen-annes'],
  },

  // Queen Anne's + Caroline
  'md-queen-annes': {
    name: "Queen Anne's & Caroline",
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['24035', '24011'], // Queen Anne's, Caroline
    terrainWeights: { Farmlands: 5, Wooded: 1, Urban: 0 },
    adjacentTerritories: ['md-anne-arundel', 'md-kent', 'md-talbot'],
  },

  // Talbot + Dorchester
  'md-talbot': {
    name: 'Talbot & Dorchester',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['24041', '24019'], // Talbot, Dorchester
    terrainWeights: { Farmlands: 5, Wooded: 1, Urban: 0 },
    adjacentTerritories: ['md-queen-annes', 'md-wicomico'],
  },

  // Wicomico + Somerset + Worcester (Lower Eastern Shore)
  'md-wicomico': {
    name: 'Lower Eastern Shore',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['24045', '24039', '24047'], // Wicomico, Somerset, Worcester
    terrainWeights: { Farmlands: 5, Wooded: 1, Urban: 0 },
    adjacentTerritories: ['md-talbot', 'va-accomack'],
  },

  // ==========================================================================
  // WEST VIRGINIA - 55 Counties (19 regions)
  // ==========================================================================

  // Jefferson County (Harper's Ferry) - KEY OBJECTIVE
  'wv-jefferson': {
    name: "Harper's Ferry (Jefferson Co.)",
    stateAbbr: 'WV',
    owner: 'NEUTRAL',
    pointValue: 5, // KEY OBJECTIVE
    isUrban: true,
    countyFips: ['54037'], // Jefferson
    maps: MARYLAND_1862_MAPS.harpersFerry,
    adjacentTerritories: ['md-washington-county', 'md-frederick', 'wv-berkeley', 'va-loudoun', 'va-clarke'],
  },

  // Berkeley + Morgan
  'wv-berkeley': {
    name: 'Berkeley & Morgan',
    stateAbbr: 'WV',
    owner: 'NEUTRAL',
    pointValue: 3,
    isUrban: false,
    countyFips: ['54003', '54065'], // Berkeley, Morgan
    terrainWeights: { Farmlands: 3, Wooded: 3, Urban: 0 },
    adjacentTerritories: ['wv-jefferson', 'wv-hampshire', 'va-clarke', 'va-shenandoah-county'],
  },

  // Hampshire + Hardy
  'wv-hampshire': {
    name: 'Hampshire & Hardy',
    stateAbbr: 'WV',
    owner: 'NEUTRAL',
    pointValue: 2,
    isUrban: false,
    countyFips: ['54027', '54031'], // Hampshire, Hardy
    terrainWeights: { Farmlands: 3, Wooded: 3, Urban: 0 },
    adjacentTerritories: ['wv-berkeley', 'wv-mineral', 'wv-grant', 'wv-grant', 'va-shenandoah-county'],
  },

  // Mineral County
  'wv-mineral': {
    name: 'Mineral County',
    stateAbbr: 'WV',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['54057'], // Mineral
    terrainWeights: { Wooded: 4, Farmlands: 2, Urban: 0 },
    adjacentTerritories: ['md-western', 'wv-hampshire', 'wv-grant', 'wv-tucker'],
  },

  // Grant + Pendleton
  'wv-grant': {
    name: 'Grant & Pendleton',
    stateAbbr: 'WV',
    owner: 'NEUTRAL',
    pointValue: 2,
    isUrban: false,
    countyFips: ['54023', '54071'], // Grant, Pendleton
    terrainWeights: { Wooded: 4, Farmlands: 2, Urban: 0 },
    adjacentTerritories: ['wv-hampshire', 'wv-mineral', 'wv-tucker', 'wv-tucker', 'wv-pocahontas', 'va-highland'],
  },

  // Tucker + Randolph
  'wv-tucker': {
    name: 'Tucker & Randolph',
    stateAbbr: 'WV',
    owner: 'USA',
    pointValue: 2,
    isUrban: false,
    countyFips: ['54093', '54083'], // Tucker, Randolph
    terrainWeights: { Wooded: 5, Farmlands: 1, Urban: 0 },
    adjacentTerritories: ['wv-mineral', 'wv-grant', 'wv-upshur', 'wv-upshur', 'wv-pocahontas', 'wv-monongalia'],
  },

  // Pocahontas + Webster
  'wv-pocahontas': {
    name: 'Pocahontas & Webster',
    stateAbbr: 'WV',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['54075', '54101'], // Pocahontas, Webster
    terrainWeights: { Wooded: 5, Farmlands: 1, Urban: 0 },
    adjacentTerritories: ['wv-grant', 'wv-tucker', 'wv-upshur', 'wv-nicholas', 'wv-greenbrier', 'va-highland'],
  },

  // Greenbrier County
  'wv-greenbrier': {
    name: 'Greenbrier County',
    stateAbbr: 'WV',
    owner: 'USA',
    pointValue: 2,
    isUrban: false,
    countyFips: ['54025'], // Greenbrier
    terrainWeights: { Wooded: 4, Farmlands: 2, Urban: 0 },
    adjacentTerritories: ['wv-pocahontas', 'wv-nicholas', 'wv-kanawha', 'wv-summers', 'wv-summers', 'va-bath'],
  },

  // Nicholas + Clay
  'wv-nicholas': {
    name: 'Nicholas & Clay',
    stateAbbr: 'WV',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['54067', '54015'], // Nicholas, Clay
    terrainWeights: { Wooded: 5, Farmlands: 1, Urban: 0 },
    adjacentTerritories: ['wv-pocahontas', 'wv-upshur', 'wv-braxton', 'wv-kanawha', 'wv-kanawha', 'wv-greenbrier'],
  },

  // Braxton + Gilmer
  'wv-braxton': {
    name: 'Braxton & Gilmer',
    stateAbbr: 'WV',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['54007', '54021'], // Braxton, Gilmer
    terrainWeights: { Wooded: 5, Farmlands: 1, Urban: 0 },
    adjacentTerritories: ['wv-upshur', 'wv-nicholas', 'wv-kanawha', 'wv-doddridge', 'wv-lewis'],
  },

  // Upshur + Barbour
  'wv-upshur': {
    name: 'Upshur & Barbour',
    stateAbbr: 'WV',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['54097', '54001'], // Upshur, Barbour
    terrainWeights: { Wooded: 4, Farmlands: 2, Urban: 0 },
    adjacentTerritories: ['wv-tucker', 'wv-pocahontas', 'wv-nicholas', 'wv-braxton', 'wv-lewis', 'wv-taylor'],
  },

  // Lewis + Harrison
  'wv-lewis': {
    name: 'Lewis & Harrison',
    stateAbbr: 'WV',
    owner: 'USA',
    pointValue: 2,
    isUrban: false,
    countyFips: ['54041', '54033'], // Lewis, Harrison
    terrainWeights: { Farmlands: 3, Wooded: 3, Urban: 0 },
    adjacentTerritories: ['wv-upshur', 'wv-braxton', 'wv-doddridge', 'wv-doddridge', 'wv-taylor', 'wv-taylor'],
  },

  // Taylor + Marion
  'wv-taylor': {
    name: 'Taylor & Marion',
    stateAbbr: 'WV',
    owner: 'USA',
    pointValue: 2,
    isUrban: false,
    countyFips: ['54091', '54049'], // Taylor, Marion
    terrainWeights: { Farmlands: 3, Wooded: 3, Urban: 0 },
    adjacentTerritories: ['wv-upshur', 'wv-lewis', 'wv-monongalia', 'wv-monongalia'],
  },

  // Monongalia + Preston
  'wv-monongalia': {
    name: 'Monongalia & Preston',
    stateAbbr: 'WV',
    owner: 'USA',
    pointValue: 2,
    isUrban: false,
    countyFips: ['54061', '54077'], // Monongalia, Preston
    terrainWeights: { Wooded: 4, Farmlands: 2, Urban: 0 },
    adjacentTerritories: ['wv-taylor', 'pa-fayette-greene'],
  },

  // Doddridge + Ritchie + Calhoun
  'wv-doddridge': {
    name: 'Doddridge & Ritchie',
    stateAbbr: 'WV',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['54017', '54085', '54013'], // Doddridge, Ritchie, Calhoun
    terrainWeights: { Wooded: 5, Farmlands: 1, Urban: 0 },
    adjacentTerritories: ['wv-lewis', 'wv-braxton', 'wv-wood', 'wv-wood', 'wv-tyler'],
  },

  // Tyler + Pleasants + Wetzel
  'wv-tyler': {
    name: 'Tyler & Wetzel',
    stateAbbr: 'WV',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['54095', '54103', '54073'], // Tyler, Pleasants, Wetzel
    terrainWeights: { Wooded: 4, Farmlands: 2, Urban: 0 },
    adjacentTerritories: ['wv-doddridge', 'wv-wood', 'wv-wheeling', 'wv-taylor'],
  },

  // Marshall + Ohio + Brooke + Hancock (Northern Panhandle)
  'wv-wheeling': {
    name: 'Wheeling Region',
    stateAbbr: 'WV',
    owner: 'USA',
    pointValue: 2, // Unionist capital of WV
    isUrban: true,
    countyFips: ['54051', '54069', '54009', '54029'], // Marshall, Ohio, Brooke, Hancock
    terrainWeights: { Urban: 3, Farmlands: 1, Wooded: 2 },
    adjacentTerritories: ['wv-tyler', 'pa-washington'],
  },

  // Wood + Wirt + Jackson
  'wv-wood': {
    name: 'Wood & Jackson',
    stateAbbr: 'WV',
    owner: 'USA',
    pointValue: 2,
    isUrban: false,
    countyFips: ['54107', '54105', '54035'], // Wood, Wirt, Jackson
    terrainWeights: { Farmlands: 3, Wooded: 3, Urban: 0 },
    adjacentTerritories: ['wv-doddridge', 'wv-tyler', 'wv-kanawha', 'wv-mason', 'wv-roane'],
  },

  // Kanawha + Fayette
  'wv-kanawha': {
    name: 'Kanawha Valley',
    stateAbbr: 'WV',
    owner: 'USA',
    pointValue: 2, // Charleston area
    isUrban: true,
    countyFips: ['54039', '54019'], // Kanawha, Fayette
    terrainWeights: { Wooded: 3, Farmlands: 2, Urban: 1 },
    adjacentTerritories: ['wv-nicholas', 'wv-braxton', 'wv-wood', 'wv-roane', 'wv-boone', 'wv-greenbrier', 'wv-raleigh'],
  },

  // Roane + Putnam
  'wv-roane': {
    name: 'Roane & Putnam',
    stateAbbr: 'WV',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['54087', '54079'], // Roane, Putnam
    terrainWeights: { Wooded: 4, Farmlands: 2, Urban: 0 },
    adjacentTerritories: ['wv-wood', 'wv-kanawha', 'wv-mason', 'wv-mason'],
  },

  // Mason + Cabell
  'wv-mason': {
    name: 'Mason & Cabell',
    stateAbbr: 'WV',
    owner: 'USA',
    pointValue: 2,
    isUrban: false,
    countyFips: ['54053', '54011'], // Mason, Cabell
    terrainWeights: { Farmlands: 3, Wooded: 3, Urban: 0 },
    adjacentTerritories: ['wv-wood', 'wv-roane', 'wv-kanawha', 'wv-wayne', 'wv-boone'],
  },

  // Lincoln + Boone + Logan
  'wv-boone': {
    name: 'Boone & Logan',
    stateAbbr: 'WV',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['54005', '54043', '54045'], // Boone, Lincoln, Logan
    terrainWeights: { Wooded: 5, Farmlands: 1, Urban: 0 },
    adjacentTerritories: ['wv-kanawha', 'wv-mason', 'wv-wayne', 'wv-wayne', 'wv-raleigh'],
  },

  // Wayne + Mingo
  'wv-wayne': {
    name: 'Wayne & Mingo',
    stateAbbr: 'WV',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['54099', '54059'], // Wayne, Mingo
    terrainWeights: { Wooded: 5, Farmlands: 1, Urban: 0 },
    adjacentTerritories: ['wv-mason', 'wv-boone', 'wv-raleigh'],
  },

  // Raleigh + Wyoming + McDowell
  'wv-raleigh': {
    name: 'Raleigh & Wyoming',
    stateAbbr: 'WV',
    owner: 'USA',
    pointValue: 2,
    isUrban: false,
    countyFips: ['54081', '54109', '54047'], // Raleigh, Wyoming, McDowell
    terrainWeights: { Wooded: 5, Farmlands: 1, Urban: 0 },
    adjacentTerritories: ['wv-kanawha', 'wv-boone', 'wv-wayne', 'wv-summers', 'wv-mercer'],
  },

  // Summers + Monroe
  'wv-summers': {
    name: 'Summers & Monroe',
    stateAbbr: 'WV',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['54089', '54063'], // Summers, Monroe
    terrainWeights: { Wooded: 4, Farmlands: 2, Urban: 0 },
    adjacentTerritories: ['wv-greenbrier', 'wv-raleigh', 'wv-mercer', 'va-bath'],
  },

  // Mercer County
  'wv-mercer': {
    name: 'Mercer County',
    stateAbbr: 'WV',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['54055'], // Mercer
    terrainWeights: { Wooded: 4, Farmlands: 2, Urban: 0 },
    adjacentTerritories: ['wv-raleigh', 'wv-summers', 'va-tazewell', 'va-giles'],
  },

  // ==========================================================================
  // VIRGINIA - Counties/Independent Cities (44 regions)
  // ==========================================================================

  // Loudoun County - Key Potomac crossing
  'va-loudoun': {
    name: 'Loudoun County',
    stateAbbr: 'VA',
    owner: 'NEUTRAL',
    pointValue: 3, // IMPORTANT - Key crossing
    isUrban: false,
    countyFips: ['51107'], // Loudoun
    terrainWeights: { Farmlands: 4, Wooded: 2, Urban: 0 },
    adjacentTerritories: ['md-washington-dc', 'wv-jefferson', 'va-fairfax', 'va-clarke'],
  },

  // Fairfax + Arlington + Alexandria (Northern Virginia)
  'va-fairfax': {
    name: 'Northern Virginia',
    stateAbbr: 'VA',
    owner: 'NEUTRAL',
    pointValue: 4, // MAJOR - Near DC
    isUrban: true,
    countyFips: ['51059', '51013', '51510', '51600', '51610'], // Fairfax, Arlington, Alexandria City, Fairfax City, Falls Church
    terrainWeights: { Farmlands: 3, Wooded: 2, Urban: 1 },
    adjacentTerritories: ['md-washington-dc', 'va-loudoun', 'va-prince-william', 'va-clarke'],
  },

  // Prince William + Manassas
  'va-prince-william': {
    name: 'Prince William (Manassas)',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 5, // KEY OBJECTIVE - Bull Run battles
    isUrban: true,
    countyFips: ['51153', '51683', '51685'], // Prince William, Manassas, Manassas Park
    terrainWeights: { Farmlands: 3, Wooded: 3, Urban: 0 },
    adjacentTerritories: ['va-fairfax', 'va-fauquier', 'va-stafford'],
  },

  // Fauquier + Culpeper
  'va-fauquier': {
    name: 'Fauquier & Culpeper',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 3,
    isUrban: false,
    countyFips: ['51061', '51047'], // Fauquier, Culpeper
    terrainWeights: { Farmlands: 3, Wooded: 3, Urban: 0 },
    adjacentTerritories: ['va-prince-william', 'va-loudoun', 'va-page', 'va-stafford', 'va-orange'],
  },

  // Clarke + Frederick VA + Winchester
  'va-clarke': {
    name: 'Clarke & Frederick (Winchester)',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 4, // MAJOR - Winchester
    isUrban: true,
    countyFips: ['51043', '51069', '51840'], // Clarke, Frederick, Winchester
    terrainWeights: { Farmlands: 4, Wooded: 1, Urban: 1 },
    adjacentTerritories: ['wv-jefferson', 'wv-berkeley', 'va-loudoun', 'va-fairfax', 'va-warren', 'va-shenandoah-county'],
  },

  // Warren County
  'va-warren': {
    name: 'Warren County',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 2,
    isUrban: false,
    countyFips: ['51187'], // Warren
    terrainWeights: { Farmlands: 3, Wooded: 3, Urban: 0 },
    adjacentTerritories: ['va-clarke', 'va-shenandoah-county', 'va-page', 'va-page'],
  },

  // Shenandoah County
  'va-shenandoah-county': {
    name: 'Shenandoah County',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 3, // IMPORTANT - Valley
    isUrban: false,
    countyFips: ['51171'], // Shenandoah
    terrainWeights: { Farmlands: 5, Wooded: 1, Urban: 0 },
    adjacentTerritories: ['wv-berkeley', 'wv-hampshire', 'va-clarke', 'va-warren', 'va-page', 'va-rockingham'],
  },

  // Page + Rappahannock
  'va-page': {
    name: 'Page & Rappahannock',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 2,
    isUrban: false,
    countyFips: ['51139', '51157'], // Page, Rappahannock
    terrainWeights: { Farmlands: 3, Wooded: 3, Urban: 0 },
    adjacentTerritories: ['va-shenandoah-county', 'va-warren', 'va-rockingham', 'va-madison', 'va-fauquier'],
  },

  // Madison + Greene
  'va-madison': {
    name: 'Madison & Greene',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['51113', '51079'], // Madison, Greene
    terrainWeights: { Farmlands: 3, Wooded: 3, Urban: 0 },
    adjacentTerritories: ['va-page', 'va-orange', 'va-albemarle', 'va-rockingham'],
  },

  // Rockingham + Harrisonburg
  'va-rockingham': {
    name: 'Rockingham (Harrisonburg)',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 3, // IMPORTANT - Valley
    isUrban: true,
    countyFips: ['51165', '51660'], // Rockingham, Harrisonburg
    terrainWeights: { Farmlands: 5, Wooded: 1, Urban: 0 },
    adjacentTerritories: ['va-shenandoah-county', 'va-page', 'va-madison', 'va-augusta', 'va-highland'],
  },

  // Highland County
  'va-highland': {
    name: 'Highland County',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['51091'], // Highland County VA
    terrainWeights: { Wooded: 5, Farmlands: 1, Urban: 0 },
    adjacentTerritories: ['wv-grant', 'wv-pocahontas', 'va-rockingham', 'va-augusta', 'va-bath'],
  },

  // Augusta + Staunton + Waynesboro
  'va-augusta': {
    name: 'Augusta (Staunton)',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 3, // IMPORTANT - Valley hub
    isUrban: true,
    countyFips: ['51015', '51790', '51820'], // Augusta, Staunton, Waynesboro
    terrainWeights: { Farmlands: 4, Wooded: 1, Urban: 1 },
    adjacentTerritories: ['va-rockingham', 'va-highland', 'va-bath', 'va-rockbridge', 'va-albemarle', 'va-nelson'],
  },

  // Bath + Alleghany (VA)
  'va-bath': {
    name: 'Bath & Alleghany',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['51017', '51005'], // Bath, Alleghany
    terrainWeights: { Wooded: 5, Farmlands: 1, Urban: 0 },
    adjacentTerritories: ['va-highland', 'va-augusta', 'va-rockbridge', 'wv-greenbrier', 'wv-summers'],
  },

  // Orange + Louisa
  'va-orange': {
    name: 'Orange & Louisa',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 2,
    isUrban: false,
    countyFips: ['51137', '51109'], // Orange, Louisa
    terrainWeights: { Wooded: 5, Farmlands: 1, Urban: 0 },
    adjacentTerritories: ['va-fauquier', 'va-madison', 'va-albemarle', 'va-stafford', 'va-caroline'],
  },

  // Stafford + Spotsylvania + Fredericksburg
  'va-stafford': {
    name: 'Stafford & Spotsylvania (Fredericksburg)',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 5, // KEY OBJECTIVE - Fredericksburg battles
    isUrban: true,
    countyFips: ['51179', '51177', '51630'], // Stafford, Spotsylvania, Fredericksburg
    terrainWeights: { Farmlands: 2, Wooded: 3, Urban: 1 },
    adjacentTerritories: ['va-prince-william', 'va-fauquier', 'va-orange', 'va-caroline', 'va-king-george'],
  },

  // King George + Westmoreland
  'va-king-george': {
    name: 'King George & Westmoreland',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['51099', '51193'], // King George, Westmoreland
    terrainWeights: { Farmlands: 4, Wooded: 2, Urban: 0 },
    adjacentTerritories: ['md-charles', 'va-stafford', 'va-caroline', 'va-northumberland', 'va-richmond-county'],
  },

  // Northumberland + Lancaster
  'va-northumberland': {
    name: 'Northumberland & Lancaster',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['51133', '51103'], // Northumberland, Lancaster
    terrainWeights: { Farmlands: 5, Wooded: 1, Urban: 0 },
    adjacentTerritories: ['md-st-marys', 'va-king-george', 'va-richmond-county', 'va-middlesex'],
  },

  // Richmond County + Essex
  'va-richmond-county': {
    name: 'Richmond County & Essex',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['51159', '51057'], // Richmond County, Essex
    terrainWeights: { Farmlands: 4, Wooded: 2, Urban: 0 },
    adjacentTerritories: ['va-king-george', 'va-northumberland', 'va-caroline', 'va-king-queen'],
  },

  // Middlesex + Mathews
  'va-middlesex': {
    name: 'Middlesex & Mathews',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['51119', '51115'], // Middlesex, Mathews
    terrainWeights: { Farmlands: 4, Wooded: 2, Urban: 0 },
    adjacentTerritories: ['va-northumberland', 'va-king-queen', 'va-gloucester'],
  },

  // King & Queen + King William
  'va-king-queen': {
    name: 'King & Queen',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['51097', '51101'], // King & Queen, King William
    terrainWeights: { Farmlands: 3, Wooded: 3, Urban: 0 },
    adjacentTerritories: ['va-richmond-county', 'va-middlesex', 'va-caroline', 'va-caroline', 'va-new-kent'],
  },

  // Caroline + Hanover
  'va-caroline': {
    name: 'Caroline & Hanover',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 2,
    isUrban: false,
    countyFips: ['51033', '51085'], // Caroline, Hanover
    terrainWeights: { Farmlands: 3, Wooded: 3, Urban: 0 },
    adjacentTerritories: ['va-stafford', 'va-king-george', 'va-richmond-county', 'va-king-queen', 'va-orange', 'va-richmond'],
  },

  // Albemarle + Charlottesville
  'va-albemarle': {
    name: 'Albemarle (Charlottesville)',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 3,
    isUrban: true,
    countyFips: ['51003', '51540'], // Albemarle, Charlottesville
    terrainWeights: { Farmlands: 3, Wooded: 2, Urban: 1 },
    adjacentTerritories: ['va-madison', 'va-orange', 'va-augusta', 'va-nelson', 'va-fluvanna', 'va-buckingham'],
  },

  // Nelson + Amherst
  'va-nelson': {
    name: 'Nelson & Amherst',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 2,
    isUrban: false,
    countyFips: ['51125', '51009'], // Nelson, Amherst
    terrainWeights: { Farmlands: 3, Wooded: 3, Urban: 0 },
    adjacentTerritories: ['va-augusta', 'va-albemarle', 'va-rockbridge', 'va-bedford', 'va-buckingham', 'va-appomattox'],
  },

  // Rockbridge + Lexington + Buena Vista
  'va-rockbridge': {
    name: 'Rockbridge (Lexington)',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 2,
    isUrban: true,
    countyFips: ['51163', '51678', '51530'], // Rockbridge, Lexington, Buena Vista
    terrainWeights: { Farmlands: 3, Wooded: 3, Urban: 0 },
    adjacentTerritories: ['va-augusta', 'va-bath', 'va-nelson', 'va-botetourt', 'va-bedford'],
  },

  // Botetourt + Craig
  'va-botetourt': {
    name: 'Botetourt & Craig',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['51023', '51045'], // Botetourt, Craig
    terrainWeights: { Wooded: 4, Farmlands: 2, Urban: 0 },
    adjacentTerritories: ['va-rockbridge', 'va-bath', 'va-roanoke', 'va-giles'],
  },

  // Bedford + Bedford City
  'va-bedford': {
    name: 'Bedford County',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 2,
    isUrban: false,
    countyFips: ['51019', '51515'], // Bedford, Bedford City
    terrainWeights: { Farmlands: 3, Wooded: 3, Urban: 0 },
    adjacentTerritories: ['va-rockbridge', 'va-nelson', 'va-botetourt', 'va-roanoke', 'va-appomattox', 'va-campbell'],
  },

  // Fluvanna + Goochland
  'va-fluvanna': {
    name: 'Fluvanna & Goochland',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['51065', '51075'], // Fluvanna, Goochland
    terrainWeights: { Farmlands: 3, Wooded: 3, Urban: 0 },
    adjacentTerritories: ['va-albemarle', 'va-orange', 'va-buckingham', 'va-powhatan', 'va-richmond'],
  },

  // Buckingham + Cumberland
  'va-buckingham': {
    name: 'Buckingham & Cumberland',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['51029', '51049'], // Buckingham, Cumberland
    terrainWeights: { Farmlands: 3, Wooded: 3, Urban: 0 },
    adjacentTerritories: ['va-albemarle', 'va-nelson', 'va-fluvanna', 'va-appomattox', 'va-appomattox', 'va-powhatan'],
  },

  // Appomattox + Prince Edward
  'va-appomattox': {
    name: 'Appomattox & Prince Edward',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 3, // IMPORTANT - Surrender site
    isUrban: false,
    countyFips: ['51011', '51147'], // Appomattox, Prince Edward
    terrainWeights: { Farmlands: 3, Wooded: 3, Urban: 0 },
    adjacentTerritories: ['va-nelson', 'va-bedford', 'va-buckingham', 'va-campbell', 'va-charlotte', 'va-nottoway'],
  },

  // Powhatan + Amelia
  'va-powhatan': {
    name: 'Powhatan & Amelia',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['51145', '51007'], // Powhatan, Amelia
    terrainWeights: { Farmlands: 3, Wooded: 3, Urban: 0 },
    adjacentTerritories: ['va-fluvanna', 'va-buckingham', 'va-richmond', 'va-chesterfield', 'va-nottoway'],
  },

  // CSA CAPITAL - Richmond + Henrico
  'va-richmond': {
    name: 'Richmond',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 7, // CSA CAPITAL
    isUrban: true,
    isCapital: true,
    countyFips: ['51760', '51087'], // Richmond City, Henrico
    terrainWeights: { Urban: 4, Farmlands: 1, Wooded: 1 },
    adjacentTerritories: ['va-caroline', 'va-fluvanna', 'va-powhatan', 'va-chesterfield', 'va-new-kent', 'va-new-kent'],
  },

  // New Kent + Charles City
  'va-new-kent': {
    name: 'New Kent & Charles City',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 2,
    isUrban: false,
    countyFips: ['51127', '51036'], // New Kent, Charles City
    terrainWeights: { Wooded: 4, Farmlands: 2, Urban: 0 },
    adjacentTerritories: ['va-king-queen', 'va-richmond', 'va-james-city', 'va-gloucester'],
  },

  // Gloucester + York
  'va-gloucester': {
    name: 'Gloucester & York',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 2,
    isUrban: false,
    countyFips: ['51073', '51199'], // Gloucester, York
    terrainWeights: { Farmlands: 3, Wooded: 3, Urban: 0 },
    adjacentTerritories: ['va-middlesex', 'va-new-kent', 'va-james-city', 'va-hampton'],
  },

  // James City + Williamsburg
  'va-james-city': {
    name: 'James City (Williamsburg)',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 2,
    isUrban: true,
    countyFips: ['51095', '51830'], // James City, Williamsburg
    terrainWeights: { Wooded: 3, Farmlands: 2, Urban: 1 },
    adjacentTerritories: ['va-new-kent', 'va-gloucester', 'va-gloucester', 'va-hampton', 'va-isle-of-wight'],
  },

  // CSA CAPITAL - Petersburg Region
  'va-petersburg': {
    name: 'Petersburg',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 7, // CSA CAPITAL
    isUrban: true,
    isCapital: true,
    countyFips: ['51730', '51149', '51570', '51670'], // Petersburg, Prince George, Colonial Heights, Hopewell
    terrainWeights: { Urban: 4, Farmlands: 1, Wooded: 1 },
    adjacentTerritories: ['va-richmond', 'va-chesterfield', 'va-chesterfield', 'va-sussex', 'va-new-kent'],
  },

  // Chesterfield + Dinwiddie
  'va-chesterfield': {
    name: 'Chesterfield & Dinwiddie',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 2,
    isUrban: false,
    countyFips: ['51041', '51053'], // Chesterfield, Dinwiddie
    terrainWeights: { Farmlands: 3, Wooded: 3, Urban: 0 },
    adjacentTerritories: ['va-richmond', 'va-powhatan', 'va-petersburg', 'va-nottoway', 'va-brunswick'],
  },

  // Nottoway + Lunenburg
  'va-nottoway': {
    name: 'Nottoway & Lunenburg',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['51135', '51111'], // Nottoway, Lunenburg
    terrainWeights: { Farmlands: 3, Wooded: 3, Urban: 0 },
    adjacentTerritories: ['va-powhatan', 'va-appomattox', 'va-chesterfield', 'va-charlotte', 'va-brunswick', 'va-mecklenburg'],
  },

  // Charlotte + Halifax
  'va-charlotte': {
    name: 'Charlotte & Halifax',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 2,
    isUrban: false,
    countyFips: ['51037', '51083'], // Charlotte, Halifax
    terrainWeights: { Farmlands: 4, Wooded: 2, Urban: 0 },
    adjacentTerritories: ['va-appomattox', 'va-nottoway', 'va-campbell', 'va-pittsylvania', 'va-mecklenburg'],
  },

  // Campbell + Lynchburg
  'va-campbell': {
    name: 'Campbell (Lynchburg)',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 4, // Lynchburg - key supply hub
    isUrban: true,
    countyFips: ['51031', '51680'], // Campbell, Lynchburg
    terrainWeights: { Farmlands: 2, Wooded: 2, Urban: 2 },
    adjacentTerritories: ['va-bedford', 'va-appomattox', 'va-charlotte', 'va-pittsylvania', 'va-roanoke'],
  },

  // Roanoke + Salem + Roanoke City
  'va-roanoke': {
    name: 'Roanoke',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 3, // IMPORTANT
    isUrban: true,
    countyFips: ['51161', '51775', '51770'], // Roanoke County, Salem, Roanoke City
    terrainWeights: { Farmlands: 3, Wooded: 3, Urban: 0 },
    adjacentTerritories: ['va-botetourt', 'va-bedford', 'va-campbell', 'va-franklin', 'va-montgomery', 'va-franklin'],
  },

  // Franklin + Floyd
  'va-franklin': {
    name: 'Franklin & Floyd',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['51067', '51063'], // Franklin, Floyd
    terrainWeights: { Farmlands: 3, Wooded: 3, Urban: 0 },
    adjacentTerritories: ['va-roanoke', 'va-pittsylvania', 'va-henry', 'va-montgomery', 'va-carroll'],
  },

  // Pittsylvania + Danville
  'va-pittsylvania': {
    name: 'Pittsylvania (Danville)',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 2,
    isUrban: true,
    countyFips: ['51143', '51590'], // Pittsylvania, Danville
    terrainWeights: { Farmlands: 4, Wooded: 2, Urban: 0 },
    adjacentTerritories: ['va-campbell', 'va-charlotte', 'va-franklin', 'va-henry', 'va-charlotte'],
  },

  // Henry + Martinsville + Patrick
  'va-henry': {
    name: 'Henry & Patrick',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['51089', '51690', '51141'], // Henry, Martinsville, Patrick
    terrainWeights: { Farmlands: 3, Wooded: 3, Urban: 0 },
    adjacentTerritories: ['va-pittsylvania', 'va-franklin', 'va-carroll'],
  },

  // Carroll + Grayson + Galax
  'va-carroll': {
    name: 'Carroll & Grayson',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['51035', '51077', '51640'], // Carroll, Grayson, Galax
    terrainWeights: { Wooded: 4, Farmlands: 2, Urban: 0 },
    adjacentTerritories: ['va-franklin', 'va-franklin', 'va-henry', 'va-wythe', 'va-wythe'],
  },

  // Montgomery + Radford + Pulaski
  'va-montgomery': {
    name: 'Montgomery & Pulaski',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 2,
    isUrban: true,
    countyFips: ['51121', '51750', '51155'], // Montgomery, Radford, Pulaski
    terrainWeights: { Farmlands: 3, Wooded: 3, Urban: 0 },
    adjacentTerritories: ['va-roanoke', 'va-franklin', 'va-franklin', 'va-giles', 'va-wythe', 'va-giles'],
  },

  // Giles + Bland
  'va-giles': {
    name: 'Giles & Bland',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['51071', '51021'], // Giles, Bland
    terrainWeights: { Wooded: 5, Farmlands: 1, Urban: 0 },
    adjacentTerritories: ['va-botetourt', 'va-montgomery', 'wv-mercer', 'va-tazewell'],
  },

  // Wythe + Smyth
  'va-wythe': {
    name: 'Wythe & Smyth',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 2,
    isUrban: false,
    countyFips: ['51197', '51173'], // Wythe, Smyth
    terrainWeights: { Farmlands: 3, Wooded: 3, Urban: 0 },
    adjacentTerritories: ['va-montgomery', 'va-carroll', 'va-giles', 'va-tazewell', 'va-washington-va'],
  },

  // Tazewell + Russell
  'va-tazewell': {
    name: 'Tazewell & Russell',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['51185', '51167'], // Tazewell, Russell
    terrainWeights: { Wooded: 4, Farmlands: 2, Urban: 0 },
    adjacentTerritories: ['va-giles', 'va-wythe', 'wv-mercer', 'va-buchanan', 'va-washington-va'],
  },

  // Washington VA + Bristol
  'va-washington-va': {
    name: 'Washington (Bristol)',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 2,
    isUrban: true,
    countyFips: ['51191', '51520'], // Washington, Bristol
    terrainWeights: { Farmlands: 3, Wooded: 3, Urban: 0 },
    adjacentTerritories: ['va-wythe', 'va-wythe', 'va-tazewell', 'va-scott', 'va-scott'],
  },

  // Scott + Lee
  'va-scott': {
    name: 'Scott & Lee',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['51169', '51105'], // Scott, Lee
    terrainWeights: { Wooded: 5, Farmlands: 1, Urban: 0 },
    adjacentTerritories: ['va-washington-va', 'va-wise'],
  },

  // Wise + Dickenson + Norton
  'va-wise': {
    name: 'Wise & Dickenson',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['51195', '51051', '51720'], // Wise, Dickenson, Norton
    terrainWeights: { Wooded: 5, Farmlands: 1, Urban: 0 },
    adjacentTerritories: ['va-scott', 'va-buchanan', 'va-tazewell'],
  },

  // Buchanan County
  'va-buchanan': {
    name: 'Buchanan County',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['51027'], // Buchanan
    terrainWeights: { Wooded: 5, Farmlands: 1, Urban: 0 },
    adjacentTerritories: ['va-tazewell', 'va-wise', 'wv-raleigh'],
  },

  // Brunswick + Greensville
  'va-brunswick': {
    name: 'Brunswick & Greensville',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['51025', '51081'], // Brunswick, Greensville
    terrainWeights: { Farmlands: 3, Wooded: 3, Urban: 0 },
    adjacentTerritories: ['va-chesterfield', 'va-nottoway', 'va-mecklenburg', 'va-sussex', 'va-sussex'],
  },

  // Mecklenburg County
  'va-mecklenburg': {
    name: 'Mecklenburg County',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['51117'], // Mecklenburg
    terrainWeights: { Farmlands: 4, Wooded: 2, Urban: 0 },
    adjacentTerritories: ['va-nottoway', 'va-charlotte', 'va-brunswick', 'va-charlotte'],
  },

  // Sussex + Southampton
  'va-sussex': {
    name: 'Sussex & Southampton',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['51183', '51175'], // Sussex, Southampton
    terrainWeights: { Farmlands: 3, Wooded: 3, Urban: 0 },
    adjacentTerritories: ['va-petersburg', 'va-brunswick', 'va-isle-of-wight', 'va-suffolk'],
  },

  // Isle of Wight + Surry
  'va-isle-of-wight': {
    name: 'Isle of Wight & Surry',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['51093', '51181'], // Isle of Wight, Surry (Note: 51181 is Surry)
    terrainWeights: { Farmlands: 3, Wooded: 3, Urban: 0 },
    adjacentTerritories: ['va-james-city', 'va-sussex', 'va-suffolk', 'va-hampton'],
  },

  // Hampton + Poquoson + Newport News
  'va-hampton': {
    name: 'Hampton & Newport News',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 4, // Fort Monroe area
    isUrban: true,
    countyFips: ['51650', '51735', '51700'], // Hampton, Poquoson, Newport News
    terrainWeights: { Farmlands: 2, Wooded: 2, Urban: 2 },
    adjacentTerritories: ['va-gloucester', 'va-james-city', 'va-norfolk'],
  },

  // Norfolk + Portsmouth + Virginia Beach + Chesapeake
  'va-norfolk': {
    name: 'Norfolk Region',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 5, // KEY OBJECTIVE - Naval base
    isUrban: true,
    countyFips: ['51710', '51740', '51810', '51550'], // Norfolk, Portsmouth, Virginia Beach, Chesapeake
    terrainWeights: { Urban: 4, Farmlands: 1, Wooded: 1 },
    adjacentTerritories: ['va-hampton', 'va-isle-of-wight', 'va-suffolk'],
  },

  // Suffolk + Emporia
  'va-suffolk': {
    name: 'Suffolk',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 2,
    isUrban: true,
    countyFips: ['51800', '51595'], // Suffolk, Emporia
    terrainWeights: { Wooded: 4, Farmlands: 2, Urban: 0 },
    adjacentTerritories: ['va-sussex', 'va-isle-of-wight', 'va-norfolk'],
  },

  // Accomack + Northampton (Eastern Shore VA)
  'va-accomack': {
    name: 'Eastern Shore (VA)',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['51001', '51131'], // Accomack, Northampton
    terrainWeights: { Farmlands: 5, Wooded: 1, Urban: 0 },
    adjacentTerritories: ['md-wicomico', 'va-norfolk'],
  },

  // ==========================================================================
  // PENNSYLVANIA - 67 Counties (23 regions)
  // ==========================================================================

  // USA CAPITAL - Philadelphia Region
  'pa-philadelphia': {
    name: 'Philadelphia',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 7, // USA CAPITAL
    isUrban: true,
    isCapital: true,
    countyFips: ['42101', '42045'], // Philadelphia, Delaware
    terrainWeights: { Urban: 4, Farmlands: 1, Wooded: 1 },
    adjacentTerritories: ['pa-montgomery-bucks', 'pa-chester-delaware'],
  },

  // Montgomery + Bucks
  'pa-montgomery-bucks': {
    name: 'Montgomery & Bucks',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 2,
    isUrban: true,
    countyFips: ['42091', '42017'], // Montgomery, Bucks
    terrainWeights: { Farmlands: 4, Wooded: 2, Urban: 0 },
    adjacentTerritories: ['pa-philadelphia', 'pa-lehigh-northampton', 'pa-berks'],
  },

  // Chester + Lancaster
  'pa-chester-delaware': {
    name: 'Chester & Lancaster',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 2,
    isUrban: false,
    countyFips: ['42029', '42071'], // Chester, Lancaster
    terrainWeights: { Farmlands: 5, Wooded: 1, Urban: 0 },
    adjacentTerritories: ['pa-philadelphia', 'md-harford-cecil', 'pa-berks', 'pa-york'],
  },

  // Berks County
  'pa-berks': {
    name: 'Berks County',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 2,
    isUrban: false,
    countyFips: ['42011'], // Berks
    terrainWeights: { Farmlands: 4, Wooded: 2, Urban: 0 },
    adjacentTerritories: ['pa-montgomery-bucks', 'pa-chester-delaware', 'pa-lehigh-northampton', 'pa-schuylkill', 'pa-lebanon-dauphin'],
  },

  // Lehigh + Northampton
  'pa-lehigh-northampton': {
    name: 'Lehigh & Northampton',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 2,
    isUrban: true,
    countyFips: ['42077', '42095'], // Lehigh, Northampton
    terrainWeights: { Farmlands: 3, Wooded: 2, Urban: 1 },
    adjacentTerritories: ['pa-montgomery-bucks', 'pa-berks', 'pa-carbon-monroe', 'pa-schuylkill'],
  },

  // Carbon + Monroe
  'pa-carbon-monroe': {
    name: 'Carbon & Monroe',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['42025', '42089'], // Carbon, Monroe
    terrainWeights: { Wooded: 4, Farmlands: 2, Urban: 0 },
    adjacentTerritories: ['pa-lehigh-northampton', 'pa-schuylkill', 'pa-luzerne', 'pa-pike-wayne'],
  },

  // Pike + Wayne
  'pa-pike-wayne': {
    name: 'Pike & Wayne',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['42103', '42127'], // Pike, Wayne
    terrainWeights: { Wooded: 5, Farmlands: 1, Urban: 0 },
    adjacentTerritories: ['pa-carbon-monroe', 'pa-lackawanna-susquehanna'],
  },

  // Lackawanna + Susquehanna
  'pa-lackawanna-susquehanna': {
    name: 'Lackawanna & Susquehanna',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 2,
    isUrban: true,
    countyFips: ['42069', '42115'], // Lackawanna, Susquehanna
    terrainWeights: { Wooded: 3, Farmlands: 2, Urban: 1 },
    adjacentTerritories: ['pa-pike-wayne', 'pa-luzerne', 'pa-wyoming-bradford'],
  },

  // Luzerne + Wyoming
  'pa-luzerne': {
    name: 'Luzerne County',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 2,
    isUrban: true,
    countyFips: ['42079'], // Luzerne
    terrainWeights: { Wooded: 3, Farmlands: 2, Urban: 1 },
    adjacentTerritories: ['pa-carbon-monroe', 'pa-lackawanna-susquehanna', 'pa-schuylkill', 'pa-columbia-montour', 'pa-wyoming-bradford'],
  },

  // Wyoming + Bradford
  'pa-wyoming-bradford': {
    name: 'Wyoming & Bradford',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['42131', '42015'], // Wyoming, Bradford
    terrainWeights: { Farmlands: 3, Wooded: 3, Urban: 0 },
    adjacentTerritories: ['pa-lackawanna-susquehanna', 'pa-luzerne', 'pa-columbia-montour', 'pa-sullivan-lycoming', 'pa-tioga'],
  },

  // Schuylkill County
  'pa-schuylkill': {
    name: 'Schuylkill County',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 2,
    isUrban: false,
    countyFips: ['42107'], // Schuylkill
    terrainWeights: { Wooded: 3, Farmlands: 2, Urban: 1 },
    adjacentTerritories: ['pa-berks', 'pa-lehigh-northampton', 'pa-carbon-monroe', 'pa-luzerne', 'pa-columbia-montour', 'pa-lebanon-dauphin'],
  },

  // Columbia + Montour + Northumberland
  'pa-columbia-montour': {
    name: 'Columbia & Northumberland',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['42037', '42093', '42097'], // Columbia, Montour, Northumberland
    terrainWeights: { Farmlands: 3, Wooded: 3, Urban: 0 },
    adjacentTerritories: ['pa-schuylkill', 'pa-luzerne', 'pa-wyoming-bradford', 'pa-sullivan-lycoming', 'pa-snyder-union', 'pa-lebanon-dauphin'],
  },

  // Sullivan + Lycoming
  'pa-sullivan-lycoming': {
    name: 'Sullivan & Lycoming',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['42113', '42081'], // Sullivan, Lycoming
    terrainWeights: { Wooded: 4, Farmlands: 2, Urban: 0 },
    adjacentTerritories: ['pa-columbia-montour', 'pa-wyoming-bradford', 'pa-tioga', 'pa-clinton-centre', 'pa-snyder-union'],
  },

  // Tioga + Potter
  'pa-tioga': {
    name: 'Tioga & Potter',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['42117', '42105'], // Tioga, Potter
    terrainWeights: { Wooded: 5, Farmlands: 1, Urban: 0 },
    adjacentTerritories: ['pa-wyoming-bradford', 'pa-sullivan-lycoming', 'pa-clinton-centre', 'pa-mckean-cameron'],
  },

  // Lebanon + Dauphin (Harrisburg)
  'pa-lebanon-dauphin': {
    name: 'Dauphin (Harrisburg)',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 3, // State capital
    isUrban: true,
    countyFips: ['42075', '42043'], // Lebanon, Dauphin
    terrainWeights: { Farmlands: 3, Wooded: 1, Urban: 2 },
    adjacentTerritories: ['pa-berks', 'pa-schuylkill', 'pa-columbia-montour', 'pa-snyder-union', 'pa-perry-juniata', 'pa-york', 'pa-chester-delaware'],
  },

  // Snyder + Union + Mifflin
  'pa-snyder-union': {
    name: 'Snyder & Union',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['42109', '42119', '42087'], // Snyder, Union, Mifflin
    terrainWeights: { Farmlands: 3, Wooded: 3, Urban: 0 },
    adjacentTerritories: ['pa-columbia-montour', 'pa-sullivan-lycoming', 'pa-clinton-centre', 'pa-perry-juniata', 'pa-lebanon-dauphin'],
  },

  // Clinton + Centre
  'pa-clinton-centre': {
    name: 'Clinton & Centre',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 2,
    isUrban: false,
    countyFips: ['42035', '42027'], // Clinton, Centre
    terrainWeights: { Wooded: 4, Farmlands: 2, Urban: 0 },
    adjacentTerritories: ['pa-sullivan-lycoming', 'pa-tioga', 'pa-snyder-union', 'pa-huntingdon-blair', 'pa-clearfield-elk', 'pa-mckean-cameron'],
  },

  // McKean + Cameron + Elk
  'pa-mckean-cameron': {
    name: 'McKean & Cameron',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['42083', '42023', '42047'], // McKean, Cameron, Elk
    terrainWeights: { Wooded: 5, Farmlands: 1, Urban: 0 },
    adjacentTerritories: ['pa-tioga', 'pa-clinton-centre', 'pa-clearfield-elk', 'pa-warren-forest'],
  },

  // Perry + Juniata + Huntingdon
  'pa-perry-juniata': {
    name: 'Perry & Juniata',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['42099', '42067'], // Perry, Juniata
    terrainWeights: { Farmlands: 3, Wooded: 3, Urban: 0 },
    adjacentTerritories: ['pa-lebanon-dauphin', 'pa-snyder-union', 'pa-huntingdon-blair', 'pa-cumberland-franklin'],
  },

  // Huntingdon + Blair
  'pa-huntingdon-blair': {
    name: 'Huntingdon & Blair',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 2,
    isUrban: false,
    countyFips: ['42061', '42013'], // Huntingdon, Blair
    terrainWeights: { Farmlands: 3, Wooded: 3, Urban: 0 },
    adjacentTerritories: ['pa-snyder-union', 'pa-clinton-centre', 'pa-perry-juniata', 'pa-clearfield-elk', 'pa-cambria-indiana', 'pa-somerset-bedford'],
  },

  // Clearfield + Jefferson
  'pa-clearfield-elk': {
    name: 'Clearfield & Jefferson',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['42033', '42065'], // Clearfield, Jefferson
    terrainWeights: { Wooded: 5, Farmlands: 1, Urban: 0 },
    adjacentTerritories: ['pa-clinton-centre', 'pa-mckean-cameron', 'pa-huntingdon-blair', 'pa-cambria-indiana', 'pa-armstrong-clarion'],
  },

  // Warren + Forest + Venango
  'pa-warren-forest': {
    name: 'Warren & Forest',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['42123', '42053', '42121'], // Warren, Forest, Venango
    terrainWeights: { Wooded: 5, Farmlands: 1, Urban: 0 },
    adjacentTerritories: ['pa-mckean-cameron', 'pa-armstrong-clarion', 'pa-erie-crawford', 'pa-mercer'],
  },

  // Armstrong + Clarion
  'pa-armstrong-clarion': {
    name: 'Armstrong & Clarion',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['42005', '42031'], // Armstrong, Clarion
    terrainWeights: { Farmlands: 3, Wooded: 3, Urban: 0 },
    adjacentTerritories: ['pa-clearfield-elk', 'pa-warren-forest', 'pa-cambria-indiana', 'pa-butler', 'pa-allegheny'],
  },

  // Erie + Crawford
  'pa-erie-crawford': {
    name: 'Erie & Crawford',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 2,
    isUrban: true,
    countyFips: ['42049', '42039'], // Erie, Crawford
    terrainWeights: { Farmlands: 3, Wooded: 2, Urban: 1 },
    adjacentTerritories: ['pa-warren-forest', 'pa-mercer'],
  },

  // Mercer + Lawrence
  'pa-mercer': {
    name: 'Mercer & Lawrence',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 2,
    isUrban: false,
    countyFips: ['42085', '42073'], // Mercer, Lawrence
    terrainWeights: { Farmlands: 3, Wooded: 3, Urban: 0 },
    adjacentTerritories: ['pa-warren-forest', 'pa-erie-crawford', 'pa-butler', 'pa-beaver'],
  },

  // Butler County
  'pa-butler': {
    name: 'Butler County',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['42019'], // Butler
    terrainWeights: { Farmlands: 3, Wooded: 3, Urban: 0 },
    adjacentTerritories: ['pa-armstrong-clarion', 'pa-mercer', 'pa-allegheny', 'pa-beaver'],
  },

  // Beaver County
  'pa-beaver': {
    name: 'Beaver County',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 1,
    isUrban: false,
    countyFips: ['42007'], // Beaver
    terrainWeights: { Farmlands: 3, Wooded: 3, Urban: 0 },
    adjacentTerritories: ['pa-mercer', 'pa-butler', 'pa-allegheny', 'wv-wheeling'],
  },

  // Allegheny (Pittsburgh)
  'pa-allegheny': {
    name: 'Allegheny (Pittsburgh)',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 3, // Industrial center
    isUrban: true,
    countyFips: ['42003'], // Allegheny
    terrainWeights: { Urban: 4, Farmlands: 1, Wooded: 1 },
    adjacentTerritories: ['pa-armstrong-clarion', 'pa-butler', 'pa-beaver', 'pa-washington', 'pa-fayette-greene'],
  },

  // Washington + Greene
  'pa-washington': {
    name: 'Washington & Greene',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 2,
    isUrban: false,
    countyFips: ['42125', '42059'], // Washington, Greene
    terrainWeights: { Farmlands: 3, Wooded: 3, Urban: 0 },
    adjacentTerritories: ['pa-allegheny', 'pa-fayette-greene', 'wv-wheeling'],
  },

  // Fayette + Westmoreland
  'pa-fayette-greene': {
    name: 'Fayette & Westmoreland',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 2,
    isUrban: false,
    countyFips: ['42051', '42129'], // Fayette, Westmoreland
    terrainWeights: { Farmlands: 3, Wooded: 3, Urban: 0 },
    adjacentTerritories: ['pa-allegheny', 'pa-washington', 'pa-somerset-bedford', 'pa-cambria-indiana', 'wv-monongalia'],
  },

  // Cambria + Indiana
  'pa-cambria-indiana': {
    name: 'Cambria & Indiana',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 2,
    isUrban: false,
    countyFips: ['42021', '42063'], // Cambria, Indiana
    terrainWeights: { Farmlands: 3, Wooded: 3, Urban: 0 },
    adjacentTerritories: ['pa-huntingdon-blair', 'pa-clearfield-elk', 'pa-armstrong-clarion', 'pa-fayette-greene', 'pa-somerset-bedford'],
  },

  // Somerset + Bedford
  'pa-somerset-bedford': {
    name: 'Somerset & Bedford',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 2,
    isUrban: false,
    countyFips: ['42111', '42009'], // Somerset, Bedford
    terrainWeights: { Farmlands: 3, Wooded: 3, Urban: 0 },
    adjacentTerritories: ['pa-huntingdon-blair', 'pa-cambria-indiana', 'pa-fayette-greene', 'pa-fulton-franklin', 'md-western'],
  },

  // Fulton + Franklin
  'pa-fulton-franklin': {
    name: 'Fulton & Franklin',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 2,
    isUrban: false,
    countyFips: ['42057', '42055'], // Fulton, Franklin
    terrainWeights: { Farmlands: 3, Wooded: 3, Urban: 0 },
    adjacentTerritories: ['pa-somerset-bedford', 'pa-cumberland-franklin', 'md-washington-county'],
  },

  // Cumberland + Adams
  'pa-cumberland-franklin': {
    name: 'Cumberland & Adams',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 3, // IMPORTANT - Gettysburg area
    isUrban: false,
    countyFips: ['42041', '42001'], // Cumberland, Adams
    terrainWeights: { Farmlands: 4, Wooded: 2, Urban: 0 },
    adjacentTerritories: ['pa-perry-juniata', 'pa-fulton-franklin', 'pa-york', 'md-frederick', 'md-carroll'],
  },

  // York County
  'pa-york': {
    name: 'York County',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 2,
    isUrban: false,
    countyFips: ['42133'], // York
    terrainWeights: { Farmlands: 4, Wooded: 2, Urban: 0 },
    adjacentTerritories: ['pa-lebanon-dauphin', 'pa-cumberland-franklin', 'pa-chester-delaware', 'md-harford-cecil'],
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export const getAllRegionIds = () => Object.keys(MARYLAND_1862_REGIONS);

export const getRegionById = (id) => MARYLAND_1862_REGIONS[id];

export const getRegionsByState = (stateAbbr) => {
  return Object.entries(MARYLAND_1862_REGIONS)
    .filter(([_, region]) => region.stateAbbr === stateAbbr)
    .map(([id, region]) => ({ id, ...region }));
};

export const getMaryland1862States = () => {
  const states = new Set();
  Object.values(MARYLAND_1862_REGIONS).forEach(region => {
    states.add(region.stateAbbr);
  });
  return Array.from(states).sort();
};

export const getMapsForRegion = (regionId) => {
  const region = MARYLAND_1862_REGIONS[regionId];
  if (!region) return [];
  return region.maps || [];
};

export const getRandomMapForRegion = (regionId) => {
  const maps = getMapsForRegion(regionId);
  if (maps.length === 0) return null;
  return maps[Math.floor(Math.random() * maps.length)];
};

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
    isCapital: region.isCapital || false,
    maps: region.maps,
    terrainWeights: region.terrainWeights,
  }));
};

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

export const getKeyCampaignTerritories = () => {
  return Object.entries(MARYLAND_1862_REGIONS)
    .filter(([_, region]) => region.pointValue >= 3)
    .map(([id, region]) => ({ id, ...region }));
};

export const getTerritoriesByOwner = (owner) => {
  return Object.entries(MARYLAND_1862_REGIONS)
    .filter(([_, region]) => region.owner === owner)
    .map(([id, region]) => ({ id, ...region }));
};

export const getUrbanTerritories = () => {
  return Object.entries(MARYLAND_1862_REGIONS)
    .filter(([_, region]) => region.isUrban)
    .map(([id, region]) => ({ id, ...region }));
};

export const getCapitalTerritories = () => {
  return Object.entries(MARYLAND_1862_REGIONS)
    .filter(([_, region]) => region.isCapital)
    .map(([id, region]) => ({ id, ...region }));
};
