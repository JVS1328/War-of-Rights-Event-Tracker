/**
 * Eastern Civil War Regional Campaign Map
 *
 * A strategic campaign spanning Virginia, Maryland, West Virginia, and Pennsylvania.
 * Designed for maneuver warfare with many small regions (1-3 counties each).
 *
 * Campaign period: April 1861 - December 1865
 * Turn length: 2 months (6 turns per year)
 *
 * Victory conditions:
 * - Control opponent's capital regions
 * - Opponent runs out of controlled territory/VP
 * - Opponent runs out of combat power
 * - At December 1865, side with most VP wins
 *
 * VP Scale: 1-5 for regions, 6-7 for capitals
 * BOTH SIDES START WITH EQUAL VP
 */

import { MARYLAND_1862_MAPS } from './marylandCampaign1862';

// ============================================================================
// TERRAIN-BASED MAP ASSIGNMENTS
// ============================================================================
export const EASTERN_WAR_MAPS = {
  // Use existing map pools
  battlefield: MARYLAND_1862_MAPS.antietam,
  mountain: MARYLAND_1862_MAPS.southMountain,
  fortress: MARYLAND_1862_MAPS.harpersFerry,
  rural: MARYLAND_1862_MAPS.rural,
  urban: MARYLAND_1862_MAPS.urban,
  camp: MARYLAND_1862_MAPS.drillCamp,
};

// ============================================================================
// EASTERN CIVIL WAR REGIONS
// VP Scale: 1=peripheral, 2=minor, 3=moderate, 4=important, 5=strategic, 6-7=capital
//
// BALANCE: USA 56 VP, CSA 56 VP, Neutral 25 VP (Total: 137 VP)
// ============================================================================
export const EASTERN_CIVIL_WAR_REGIONS = {
  // ==========================================================================
  // PENNSYLVANIA - Union Territory (Starting: ~25 VP)
  // ==========================================================================

  // PHILADELPHIA - Major Union City (Capital-tier)
  'pa-philadelphia': {
    name: 'Philadelphia',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 5, // UNION CAPITAL - Major industrial/population center
    terrain: 'urban',
    isUrban: true,
    countyFips: ['42101', '42045'], // Philadelphia, Delaware County
    maps: EASTERN_WAR_MAPS.urban,
    adjacentTerritories: ['pa-chester', 'pa-montgomery', 'pa-bucks'],
  },

  'pa-bucks': {
    name: 'Bucks County',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 1,
    terrain: 'rural',
    isUrban: false,
    countyFips: ['42017'],
    maps: EASTERN_WAR_MAPS.rural,
    adjacentTerritories: ['pa-philadelphia', 'pa-montgomery', 'pa-lehigh'],
  },

  'pa-montgomery': {
    name: 'Montgomery County',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 2,
    terrain: 'rural',
    isUrban: false,
    countyFips: ['42091'],
    maps: EASTERN_WAR_MAPS.rural,
    adjacentTerritories: ['pa-philadelphia', 'pa-bucks', 'pa-chester', 'pa-berks', 'pa-lehigh'],
  },

  'pa-chester': {
    name: 'Chester County',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 1,
    terrain: 'rural',
    isUrban: false,
    countyFips: ['42029'],
    maps: EASTERN_WAR_MAPS.rural,
    adjacentTerritories: ['pa-philadelphia', 'pa-montgomery', 'pa-lancaster', 'md-cecil'],
  },

  'pa-lehigh': {
    name: 'Lehigh Valley',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 2,
    terrain: 'rural',
    isUrban: false,
    countyFips: ['42077', '42095'], // Lehigh, Northampton
    maps: EASTERN_WAR_MAPS.rural,
    adjacentTerritories: ['pa-bucks', 'pa-montgomery', 'pa-berks', 'pa-carbon', 'pa-schuylkill'],
  },

  'pa-berks': {
    name: 'Berks County',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 2,
    terrain: 'rural',
    isUrban: false,
    countyFips: ['42011'],
    maps: EASTERN_WAR_MAPS.rural,
    adjacentTerritories: ['pa-montgomery', 'pa-lehigh', 'pa-lancaster', 'pa-schuylkill', 'pa-dauphin'],
  },

  'pa-lancaster': {
    name: 'Lancaster County',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 2, // Important agricultural center
    terrain: 'rural',
    isUrban: false,
    countyFips: ['42071'],
    maps: EASTERN_WAR_MAPS.rural,
    adjacentTerritories: ['pa-chester', 'pa-berks', 'pa-york', 'pa-dauphin', 'pa-harrisburg'],
  },

  // HARRISBURG - State Capital
  'pa-harrisburg': {
    name: 'Harrisburg',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 3, // State capital
    terrain: 'urban',
    isUrban: true,
    countyFips: ['42043'], // Dauphin County
    maps: EASTERN_WAR_MAPS.urban,
    adjacentTerritories: ['pa-lancaster', 'pa-york', 'pa-cumberland', 'pa-perry', 'pa-schuylkill', 'pa-dauphin'],
  },

  'pa-dauphin': {
    name: 'Lebanon & Dauphin',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 1,
    terrain: 'rural',
    isUrban: false,
    countyFips: ['42075'], // Lebanon
    maps: EASTERN_WAR_MAPS.rural,
    adjacentTerritories: ['pa-lancaster', 'pa-harrisburg', 'pa-schuylkill', 'pa-berks'],
  },

  'pa-york': {
    name: 'York County',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 1,
    terrain: 'rural',
    isUrban: false,
    countyFips: ['42133'],
    maps: EASTERN_WAR_MAPS.rural,
    adjacentTerritories: ['pa-lancaster', 'pa-harrisburg', 'pa-adams', 'pa-cumberland', 'md-carroll'],
  },

  // GETTYSBURG AREA - Key strategic ground
  'pa-adams': {
    name: 'Adams County (Gettysburg)',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 2, // Historic significance, strategic crossroads
    terrain: 'battlefield',
    isUrban: false,
    countyFips: ['42001'],
    maps: EASTERN_WAR_MAPS.battlefield,
    adjacentTerritories: ['pa-york', 'pa-cumberland', 'pa-franklin', 'md-frederick', 'md-carroll'],
  },

  'pa-cumberland': {
    name: 'Cumberland County',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 1,
    terrain: 'rural',
    isUrban: false,
    countyFips: ['42041'],
    maps: EASTERN_WAR_MAPS.rural,
    adjacentTerritories: ['pa-harrisburg', 'pa-york', 'pa-adams', 'pa-franklin', 'pa-perry'],
  },

  'pa-franklin': {
    name: 'Franklin County',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 1,
    terrain: 'rural',
    isUrban: false,
    countyFips: ['42055'],
    maps: EASTERN_WAR_MAPS.rural,
    adjacentTerritories: ['pa-adams', 'pa-cumberland', 'pa-fulton', 'md-washington'],
  },

  'pa-fulton': {
    name: 'Fulton & Bedford',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 1,
    terrain: 'mountain',
    isUrban: false,
    countyFips: ['42057', '42009'], // Fulton, Bedford
    maps: EASTERN_WAR_MAPS.mountain,
    adjacentTerritories: ['pa-franklin', 'pa-somerset', 'md-allegany'],
  },

  'pa-perry': {
    name: 'Perry & Juniata',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 1,
    terrain: 'mountain',
    isUrban: false,
    countyFips: ['42099', '42067'], // Perry, Juniata
    maps: EASTERN_WAR_MAPS.mountain,
    adjacentTerritories: ['pa-harrisburg', 'pa-cumberland', 'pa-centre'],
  },

  'pa-schuylkill': {
    name: 'Schuylkill County',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 1, // Coal mining
    terrain: 'mountain',
    isUrban: false,
    countyFips: ['42107'],
    maps: EASTERN_WAR_MAPS.mountain,
    adjacentTerritories: ['pa-lehigh', 'pa-berks', 'pa-harrisburg', 'pa-dauphin', 'pa-carbon'],
  },

  'pa-carbon': {
    name: 'Carbon & Monroe',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 1,
    terrain: 'mountain',
    isUrban: false,
    countyFips: ['42025', '42089'], // Carbon, Monroe
    maps: EASTERN_WAR_MAPS.mountain,
    adjacentTerritories: ['pa-lehigh', 'pa-schuylkill', 'pa-luzerne'],
  },

  'pa-luzerne': {
    name: 'Luzerne & Lackawanna',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 1, // Coal mining region
    terrain: 'mountain',
    isUrban: false,
    countyFips: ['42079', '42069'],
    maps: EASTERN_WAR_MAPS.mountain,
    adjacentTerritories: ['pa-carbon', 'pa-centre'],
  },

  'pa-centre': {
    name: 'Central Pennsylvania',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 1,
    terrain: 'mountain',
    isUrban: false,
    countyFips: ['42027', '42061', '42087'], // Centre, Huntingdon, Mifflin
    maps: EASTERN_WAR_MAPS.mountain,
    adjacentTerritories: ['pa-perry', 'pa-luzerne', 'pa-somerset', 'pa-allegheny'],
  },

  'pa-somerset': {
    name: 'Somerset & Cambria',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 1,
    terrain: 'mountain',
    isUrban: false,
    countyFips: ['42111', '42021'], // Somerset, Cambria
    maps: EASTERN_WAR_MAPS.mountain,
    adjacentTerritories: ['pa-fulton', 'pa-centre', 'pa-allegheny', 'wv-interior'],
  },

  // PITTSBURGH - Industrial center
  'pa-allegheny': {
    name: 'Pittsburgh',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 3, // Major industrial center
    terrain: 'urban',
    isUrban: true,
    countyFips: ['42003', '42129'], // Allegheny, Westmoreland
    maps: EASTERN_WAR_MAPS.urban,
    adjacentTerritories: ['pa-centre', 'pa-somerset', 'wv-interior'],
  },

  // ==========================================================================
  // MARYLAND - Mixed/Contested (Starting USA: ~12 VP)
  // ==========================================================================

  // BALTIMORE - Major Union city
  'md-baltimore': {
    name: 'Baltimore',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 5, // Major port and industrial city
    terrain: 'urban',
    isUrban: true,
    countyFips: ['24510', '24005'], // Baltimore City, Baltimore County
    maps: EASTERN_WAR_MAPS.urban,
    adjacentTerritories: ['md-harford', 'md-carroll', 'md-howard', 'md-anne-arundel'],
  },

  'md-harford': {
    name: 'Harford County',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 1,
    terrain: 'rural',
    isUrban: false,
    countyFips: ['24025'],
    maps: EASTERN_WAR_MAPS.rural,
    adjacentTerritories: ['md-baltimore', 'md-cecil', 'md-kent'],
  },

  'md-cecil': {
    name: 'Cecil County',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 1,
    terrain: 'rural',
    isUrban: false,
    countyFips: ['24015'],
    maps: EASTERN_WAR_MAPS.rural,
    adjacentTerritories: ['md-harford', 'pa-chester'],
  },

  'md-kent': {
    name: 'Kent & Queen Anne',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 1,
    terrain: 'rural',
    isUrban: false,
    countyFips: ['24029', '24035'], // Kent, Queen Anne's
    maps: EASTERN_WAR_MAPS.rural,
    adjacentTerritories: ['md-harford', 'md-eastern-shore'],
  },

  'md-eastern-shore': {
    name: 'Eastern Shore',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 1,
    terrain: 'rural',
    isUrban: false,
    countyFips: ['24041', '24011', '24019', '24045', '24039', '24047'], // Talbot, Caroline, Dorchester, Wicomico, Somerset, Worcester
    maps: EASTERN_WAR_MAPS.rural,
    adjacentTerritories: ['md-kent', 'md-anne-arundel'],
  },

  'md-carroll': {
    name: 'Carroll County',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 1,
    terrain: 'rural',
    isUrban: false,
    countyFips: ['24013'],
    maps: EASTERN_WAR_MAPS.rural,
    adjacentTerritories: ['md-baltimore', 'md-howard', 'md-frederick', 'pa-york', 'pa-adams'],
  },

  'md-howard': {
    name: 'Howard County',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 1,
    terrain: 'rural',
    isUrban: false,
    countyFips: ['24027'],
    maps: EASTERN_WAR_MAPS.rural,
    adjacentTerritories: ['md-baltimore', 'md-carroll', 'md-montgomery', 'md-anne-arundel'],
  },

  // ANNAPOLIS - State Capital
  'md-anne-arundel': {
    name: 'Annapolis',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 3, // State capital, Naval Academy
    terrain: 'urban',
    isUrban: true,
    countyFips: ['24003'],
    maps: EASTERN_WAR_MAPS.urban,
    adjacentTerritories: ['md-baltimore', 'md-howard', 'md-montgomery', 'md-prince-georges', 'md-eastern-shore', 'md-calvert'],
  },

  // DC AREA - Critical Union region
  'md-montgomery': {
    name: 'Montgomery County',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 4, // Near Washington DC
    terrain: 'urban',
    isUrban: true,
    countyFips: ['24031'],
    maps: EASTERN_WAR_MAPS.urban,
    adjacentTerritories: ['md-howard', 'md-anne-arundel', 'md-prince-georges', 'md-frederick', 'va-loudoun', 'va-fairfax'],
  },

  'md-prince-georges': {
    name: "Prince George's County",
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 2,
    terrain: 'rural',
    isUrban: false,
    countyFips: ['24033'],
    maps: EASTERN_WAR_MAPS.rural,
    adjacentTerritories: ['md-anne-arundel', 'md-montgomery', 'md-charles', 'va-fairfax'],
  },

  'md-charles': {
    name: 'Charles County',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 1,
    terrain: 'rural',
    isUrban: false,
    countyFips: ['24017'],
    maps: EASTERN_WAR_MAPS.rural,
    adjacentTerritories: ['md-prince-georges', 'md-calvert', 'va-northern-neck'],
  },

  'md-calvert': {
    name: 'Calvert & St. Mary\'s',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 1,
    terrain: 'rural',
    isUrban: false,
    countyFips: ['24009', '24037'], // Calvert, St. Mary's
    maps: EASTERN_WAR_MAPS.rural,
    adjacentTerritories: ['md-charles', 'md-anne-arundel'],
  },

  // CONTESTED MARYLAND - Neutral starting regions
  'md-frederick': {
    name: 'Frederick County',
    stateAbbr: 'MD',
    owner: 'NEUTRAL',
    pointValue: 3, // South Mountain, strategic crossroads
    terrain: 'mountain',
    isUrban: false,
    countyFips: ['24021'],
    maps: EASTERN_WAR_MAPS.mountain,
    adjacentTerritories: ['md-carroll', 'md-montgomery', 'md-washington', 'wv-harpers-ferry', 'pa-adams'],
  },

  // ANTIETAM BATTLEFIELD
  'md-washington': {
    name: 'Washington County (Antietam)',
    stateAbbr: 'MD',
    owner: 'NEUTRAL',
    pointValue: 4, // Key battlefield, strategic
    terrain: 'battlefield',
    isUrban: false,
    countyFips: ['24043'],
    maps: EASTERN_WAR_MAPS.battlefield,
    adjacentTerritories: ['md-frederick', 'md-allegany', 'wv-harpers-ferry', 'pa-franklin'],
  },

  'md-allegany': {
    name: 'Allegany & Garrett',
    stateAbbr: 'MD',
    owner: 'NEUTRAL',
    pointValue: 1,
    terrain: 'mountain',
    isUrban: false,
    countyFips: ['24001', '24023'], // Allegany, Garrett
    maps: EASTERN_WAR_MAPS.mountain,
    adjacentTerritories: ['md-washington', 'wv-interior', 'pa-fulton'],
  },

  // ==========================================================================
  // WEST VIRGINIA - Contested/Union-leaning (Starting: Neutral ~8 VP)
  // ==========================================================================

  // HARPERS FERRY - Critical fortress
  'wv-harpers-ferry': {
    name: "Harper's Ferry",
    stateAbbr: 'WV',
    owner: 'NEUTRAL',
    pointValue: 5, // Critical strategic point
    terrain: 'fortress',
    isUrban: true,
    countyFips: ['54037'], // Jefferson County
    maps: EASTERN_WAR_MAPS.fortress,
    adjacentTerritories: ['md-frederick', 'md-washington', 'wv-berkeley', 'va-loudoun', 'va-clarke'],
  },

  'wv-berkeley': {
    name: 'Berkeley & Morgan',
    stateAbbr: 'WV',
    owner: 'NEUTRAL',
    pointValue: 2,
    terrain: 'rural',
    isUrban: false,
    countyFips: ['54003', '54065'], // Berkeley, Morgan
    maps: EASTERN_WAR_MAPS.rural,
    adjacentTerritories: ['wv-harpers-ferry', 'wv-hampshire', 'va-shenandoah-upper', 'va-clarke'],
  },

  'wv-hampshire': {
    name: 'Hampshire & Hardy',
    stateAbbr: 'WV',
    owner: 'NEUTRAL',
    pointValue: 1,
    terrain: 'mountain',
    isUrban: false,
    countyFips: ['54027', '54031'], // Hampshire, Hardy
    maps: EASTERN_WAR_MAPS.mountain,
    adjacentTerritories: ['wv-berkeley', 'wv-interior', 'va-shenandoah-upper'],
  },

  'wv-interior': {
    name: 'West Virginia Interior',
    stateAbbr: 'WV',
    owner: 'NEUTRAL',
    pointValue: 2, // Wheeling area, Unionist
    terrain: 'mountain',
    isUrban: false,
    countyFips: ['54057', '54023', '54071', '54093', '54083', '54075'], // Mineral, Grant, Pendleton, Tucker, Randolph, Pocahontas
    maps: EASTERN_WAR_MAPS.mountain,
    adjacentTerritories: ['wv-hampshire', 'wv-kanawha', 'md-allegany', 'pa-somerset', 'pa-allegheny', 'va-shenandoah-lower'],
  },

  'wv-kanawha': {
    name: 'Kanawha Valley',
    stateAbbr: 'WV',
    owner: 'NEUTRAL',
    pointValue: 2,
    terrain: 'mountain',
    isUrban: false,
    countyFips: ['54039', '54015', '54019', '54025'], // Kanawha, Clay, Fayette, Greenbrier
    maps: EASTERN_WAR_MAPS.mountain,
    adjacentTerritories: ['wv-interior', 'va-southwest'],
  },

  // ==========================================================================
  // VIRGINIA - Confederate Territory (Starting: ~55 VP)
  // ==========================================================================

  // NORTHERN VIRGINIA - Contested border region
  'va-loudoun': {
    name: 'Loudoun County',
    stateAbbr: 'VA',
    owner: 'NEUTRAL',
    pointValue: 2,
    terrain: 'rural',
    isUrban: false,
    countyFips: ['51107'],
    maps: EASTERN_WAR_MAPS.rural,
    adjacentTerritories: ['md-montgomery', 'wv-harpers-ferry', 'va-fairfax', 'va-clarke'],
  },

  'va-fairfax': {
    name: 'Fairfax & Arlington',
    stateAbbr: 'VA',
    owner: 'NEUTRAL',
    pointValue: 3, // Near Washington DC - Contested
    terrain: 'urban',
    isUrban: true,
    countyFips: ['51059', '51013', '51510'], // Fairfax, Arlington, Alexandria
    maps: EASTERN_WAR_MAPS.urban,
    adjacentTerritories: ['md-montgomery', 'md-prince-georges', 'va-loudoun', 'va-prince-william'],
  },

  'va-prince-william': {
    name: 'Prince William (Manassas)',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 3, // Bull Run battlefield
    terrain: 'battlefield',
    isUrban: false,
    countyFips: ['51153', '51683', '51685'], // Prince William, Manassas, Manassas Park
    maps: EASTERN_WAR_MAPS.battlefield,
    adjacentTerritories: ['va-fairfax', 'va-fauquier', 'va-stafford'],
  },

  'va-fauquier': {
    name: 'Fauquier County',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1,
    terrain: 'rural',
    isUrban: false,
    countyFips: ['51061'],
    maps: EASTERN_WAR_MAPS.rural,
    adjacentTerritories: ['va-prince-william', 'va-clarke', 'va-rappahannock', 'va-culpeper'],
  },

  // SHENANDOAH VALLEY - Critical supply route
  'va-clarke': {
    name: 'Clarke & Frederick (Winchester)',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 3, // Winchester, key valley city
    terrain: 'urban',
    isUrban: true,
    countyFips: ['51043', '51069', '51840'], // Clarke, Frederick, Winchester
    maps: EASTERN_WAR_MAPS.urban,
    adjacentTerritories: ['wv-harpers-ferry', 'va-loudoun', 'va-fauquier', 'wv-berkeley', 'va-shenandoah-upper'],
  },

  'va-shenandoah-upper': {
    name: 'Upper Shenandoah Valley',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 2,
    terrain: 'rural',
    isUrban: false,
    countyFips: ['51171', '51187'], // Shenandoah, Warren
    maps: EASTERN_WAR_MAPS.rural,
    adjacentTerritories: ['va-clarke', 'wv-berkeley', 'wv-hampshire', 'va-shenandoah-lower', 'va-rappahannock'],
  },

  'va-shenandoah-lower': {
    name: 'Lower Shenandoah Valley',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 2, // Harrisonburg, Staunton
    terrain: 'rural',
    isUrban: false,
    countyFips: ['51165', '51660', '51015', '51790', '51820'], // Rockingham, Harrisonburg, Augusta, Staunton, Waynesboro
    maps: EASTERN_WAR_MAPS.rural,
    adjacentTerritories: ['va-shenandoah-upper', 'wv-interior', 'va-rockbridge', 'va-albemarle'],
  },

  'va-rappahannock': {
    name: 'Rappahannock & Page',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1,
    terrain: 'mountain',
    isUrban: false,
    countyFips: ['51157', '51139'], // Rappahannock, Page
    maps: EASTERN_WAR_MAPS.mountain,
    adjacentTerritories: ['va-fauquier', 'va-shenandoah-upper', 'va-madison', 'va-culpeper'],
  },

  'va-culpeper': {
    name: 'Culpeper County',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1, // Brandy Station, cavalry battles
    terrain: 'rural',
    isUrban: false,
    countyFips: ['51047'],
    maps: EASTERN_WAR_MAPS.rural,
    adjacentTerritories: ['va-fauquier', 'va-rappahannock', 'va-madison', 'va-stafford', 'va-orange'],
  },

  'va-madison': {
    name: 'Madison & Greene',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1,
    terrain: 'mountain',
    isUrban: false,
    countyFips: ['51113', '51079'], // Madison, Greene
    maps: EASTERN_WAR_MAPS.mountain,
    adjacentTerritories: ['va-rappahannock', 'va-culpeper', 'va-orange', 'va-albemarle'],
  },

  // CENTRAL VIRGINIA - Fredericksburg corridor
  'va-stafford': {
    name: 'Stafford County',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1,
    terrain: 'rural',
    isUrban: false,
    countyFips: ['51179'],
    maps: EASTERN_WAR_MAPS.rural,
    adjacentTerritories: ['va-prince-william', 'va-culpeper', 'va-fredericksburg', 'va-northern-neck'],
  },

  'va-fredericksburg': {
    name: 'Fredericksburg',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 3, // Major battle site, strategic crossroads
    terrain: 'battlefield',
    isUrban: true,
    countyFips: ['51630', '51177'], // Fredericksburg, Spotsylvania
    maps: EASTERN_WAR_MAPS.battlefield,
    adjacentTerritories: ['va-stafford', 'va-orange', 'va-caroline', 'va-northern-neck'],
  },

  'va-orange': {
    name: 'Orange County',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1, // Wilderness, Chancellorsville nearby
    terrain: 'rural',
    isUrban: false,
    countyFips: ['51137'],
    maps: EASTERN_WAR_MAPS.rural,
    adjacentTerritories: ['va-culpeper', 'va-madison', 'va-fredericksburg', 'va-albemarle', 'va-louisa'],
  },

  'va-albemarle': {
    name: 'Albemarle (Charlottesville)',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 2, // University town, supply depot
    terrain: 'urban',
    isUrban: true,
    countyFips: ['51003', '51540'], // Albemarle, Charlottesville
    maps: EASTERN_WAR_MAPS.urban,
    adjacentTerritories: ['va-shenandoah-lower', 'va-madison', 'va-orange', 'va-louisa', 'va-fluvanna', 'va-rockbridge'],
  },

  'va-rockbridge': {
    name: 'Rockbridge County (Lexington)',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1, // VMI, Washington College
    terrain: 'mountain',
    isUrban: false,
    countyFips: ['51163', '51530', '51678'], // Rockbridge, Buena Vista, Lexington
    maps: EASTERN_WAR_MAPS.mountain,
    adjacentTerritories: ['va-shenandoah-lower', 'va-albemarle', 'va-amherst', 'va-southwest'],
  },

  'va-louisa': {
    name: 'Louisa County',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1,
    terrain: 'rural',
    isUrban: false,
    countyFips: ['51109'],
    maps: EASTERN_WAR_MAPS.rural,
    adjacentTerritories: ['va-orange', 'va-albemarle', 'va-fluvanna', 'va-goochland', 'va-caroline'],
  },

  'va-fluvanna': {
    name: 'Fluvanna & Buckingham',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1,
    terrain: 'rural',
    isUrban: false,
    countyFips: ['51065', '51029'], // Fluvanna, Buckingham
    maps: EASTERN_WAR_MAPS.rural,
    adjacentTerritories: ['va-albemarle', 'va-louisa', 'va-goochland', 'va-amherst', 'va-appomattox'],
  },

  'va-amherst': {
    name: 'Amherst & Bedford',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1,
    terrain: 'mountain',
    isUrban: false,
    countyFips: ['51009', '51019', '51515'], // Amherst, Bedford, Bedford City
    maps: EASTERN_WAR_MAPS.mountain,
    adjacentTerritories: ['va-rockbridge', 'va-fluvanna', 'va-appomattox', 'va-lynchburg', 'va-southwest'],
  },

  'va-lynchburg': {
    name: 'Lynchburg',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 2, // Major rail hub, supply center
    terrain: 'urban',
    isUrban: true,
    countyFips: ['51680', '51031'], // Lynchburg, Campbell
    maps: EASTERN_WAR_MAPS.urban,
    adjacentTerritories: ['va-amherst', 'va-appomattox', 'va-southside'],
  },

  'va-appomattox': {
    name: 'Appomattox County',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1, // Historic surrender site
    terrain: 'rural',
    isUrban: false,
    countyFips: ['51011'],
    maps: EASTERN_WAR_MAPS.rural,
    adjacentTerritories: ['va-fluvanna', 'va-amherst', 'va-lynchburg', 'va-prince-edward'],
  },

  // TIDEWATER & NORTHERN NECK
  'va-northern-neck': {
    name: 'Northern Neck',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1,
    terrain: 'rural',
    isUrban: false,
    countyFips: ['51099', '51193', '51133', '51103', '51159'], // King George, Westmoreland, Northumberland, Lancaster, Richmond County
    maps: EASTERN_WAR_MAPS.rural,
    adjacentTerritories: ['md-charles', 'va-stafford', 'va-fredericksburg', 'va-caroline', 'va-middle-peninsula'],
  },

  'va-caroline': {
    name: 'Caroline & Hanover',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1,
    terrain: 'rural',
    isUrban: false,
    countyFips: ['51033', '51085'], // Caroline, Hanover
    maps: EASTERN_WAR_MAPS.rural,
    adjacentTerritories: ['va-fredericksburg', 'va-louisa', 'va-northern-neck', 'va-richmond', 'va-middle-peninsula'],
  },

  'va-goochland': {
    name: 'Goochland & Powhatan',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1,
    terrain: 'rural',
    isUrban: false,
    countyFips: ['51075', '51145'], // Goochland, Powhatan
    maps: EASTERN_WAR_MAPS.rural,
    adjacentTerritories: ['va-louisa', 'va-fluvanna', 'va-richmond', 'va-chesterfield'],
  },

  // RICHMOND - Confederate Capital
  'va-richmond': {
    name: 'Richmond',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 6, // CONFEDERATE CAPITAL
    terrain: 'urban',
    isUrban: true,
    countyFips: ['51760', '51087'], // Richmond City, Henrico
    maps: EASTERN_WAR_MAPS.urban,
    adjacentTerritories: ['va-caroline', 'va-goochland', 'va-chesterfield', 'va-new-kent'],
  },

  'va-new-kent': {
    name: 'New Kent & Charles City',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1,
    terrain: 'rural',
    isUrban: false,
    countyFips: ['51127', '51036'], // New Kent, Charles City
    maps: EASTERN_WAR_MAPS.rural,
    adjacentTerritories: ['va-richmond', 'va-middle-peninsula', 'va-williamsburg'],
  },

  'va-middle-peninsula': {
    name: 'Middle Peninsula',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1,
    terrain: 'rural',
    isUrban: false,
    countyFips: ['51057', '51119', '51097', '51101', '51073', '51115'], // Essex, Middlesex, King & Queen, King William, Gloucester, Mathews
    maps: EASTERN_WAR_MAPS.rural,
    adjacentTerritories: ['va-northern-neck', 'va-caroline', 'va-new-kent', 'va-williamsburg'],
  },

  // PENINSULA - Historic campaign area
  'va-williamsburg': {
    name: 'Williamsburg & York',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1, // Colonial capital
    terrain: 'urban',
    isUrban: true,
    countyFips: ['51830', '51199'], // Williamsburg, York
    maps: EASTERN_WAR_MAPS.urban,
    adjacentTerritories: ['va-new-kent', 'va-middle-peninsula', 'va-hampton'],
  },

  'va-hampton': {
    name: 'Hampton & Newport News',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 2, // Fort Monroe area, shipyards
    terrain: 'urban',
    isUrban: true,
    countyFips: ['51650', '51700', '51735'], // Hampton, Newport News, Poquoson
    maps: EASTERN_WAR_MAPS.urban,
    adjacentTerritories: ['va-williamsburg', 'va-norfolk'],
  },

  // NORFOLK - Major port
  'va-norfolk': {
    name: 'Norfolk & Portsmouth',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 3, // Major naval base, Gosport Navy Yard
    terrain: 'urban',
    isUrban: true,
    countyFips: ['51710', '51740', '51810', '51550'], // Norfolk, Portsmouth, Virginia Beach, Chesapeake
    maps: EASTERN_WAR_MAPS.urban,
    adjacentTerritories: ['va-hampton', 'va-isle-of-wight', 'va-eastern-shore', 'va-suffolk'],
  },

  'va-eastern-shore': {
    name: 'Virginia Eastern Shore',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1,
    terrain: 'rural',
    isUrban: false,
    countyFips: ['51001', '51131'], // Accomack, Northampton
    maps: EASTERN_WAR_MAPS.rural,
    adjacentTerritories: ['va-norfolk'],
  },

  'va-isle-of-wight': {
    name: 'Isle of Wight & Surry',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1,
    terrain: 'rural',
    isUrban: false,
    countyFips: ['51093', '51181'], // Isle of Wight, Surry
    maps: EASTERN_WAR_MAPS.rural,
    adjacentTerritories: ['va-norfolk', 'va-chesterfield', 'va-suffolk'],
  },

  // PETERSBURG AREA
  'va-chesterfield': {
    name: 'Chesterfield County',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1,
    terrain: 'rural',
    isUrban: false,
    countyFips: ['51041'],
    maps: EASTERN_WAR_MAPS.rural,
    adjacentTerritories: ['va-richmond', 'va-goochland', 'va-isle-of-wight', 'va-petersburg', 'va-prince-edward'],
  },

  'va-petersburg': {
    name: 'Petersburg',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 4, // Critical rail junction, supply hub
    terrain: 'urban',
    isUrban: true,
    countyFips: ['51730', '51053', '51149', '51570', '51670'], // Petersburg, Dinwiddie, Prince George, Colonial Heights, Hopewell
    maps: EASTERN_WAR_MAPS.urban,
    adjacentTerritories: ['va-chesterfield', 'va-suffolk', 'va-southside'],
  },

  'va-suffolk': {
    name: 'Suffolk',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1,
    terrain: 'rural',
    isUrban: false,
    countyFips: ['51800', '51595'], // Suffolk, Emporia
    maps: EASTERN_WAR_MAPS.rural,
    adjacentTerritories: ['va-norfolk', 'va-isle-of-wight', 'va-petersburg', 'va-southside'],
  },

  'va-prince-edward': {
    name: 'Prince Edward & Cumberland',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1,
    terrain: 'rural',
    isUrban: false,
    countyFips: ['51147', '51049'], // Prince Edward, Cumberland
    maps: EASTERN_WAR_MAPS.rural,
    adjacentTerritories: ['va-appomattox', 'va-chesterfield', 'va-southside'],
  },

  'va-southside': {
    name: 'Southside Virginia',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1,
    terrain: 'rural',
    isUrban: false,
    countyFips: ['51025', '51083', '51117', '51143', '51175', '51183', '51081', '51089'], // Brunswick, Halifax, Mecklenburg, Pittsylvania, Southampton, Sussex, Greensville, Henry
    maps: EASTERN_WAR_MAPS.rural,
    adjacentTerritories: ['va-lynchburg', 'va-prince-edward', 'va-petersburg', 'va-suffolk', 'va-southwest'],
  },

  // SOUTHWEST VIRGINIA
  'va-southwest': {
    name: 'Southwest Virginia',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 1, // Salt works, railroads
    terrain: 'mountain',
    isUrban: false,
    countyFips: ['51005', '51017', '51021', '51027', '51035', '51045', '51051', '51063', '51071', '51077', '51091', '51105', '51121', '51141', '51155', '51167', '51169', '51173', '51185', '51191', '51195', '51197'], // Multiple SW VA counties
    maps: EASTERN_WAR_MAPS.mountain,
    adjacentTerritories: ['va-rockbridge', 'va-amherst', 'va-southside', 'wv-kanawha'],
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get all region IDs
 */
export const getAllRegionIds = () => Object.keys(EASTERN_CIVIL_WAR_REGIONS);

/**
 * Get region data by ID
 */
export const getRegionById = (id) => EASTERN_CIVIL_WAR_REGIONS[id];

/**
 * Get all regions for a specific state
 */
export const getRegionsByState = (stateAbbr) => {
  return Object.entries(EASTERN_CIVIL_WAR_REGIONS)
    .filter(([_, region]) => region.stateAbbr === stateAbbr)
    .map(([id, region]) => ({ id, ...region }));
};

/**
 * Get maps available for a region
 */
export const getMapsForRegion = (regionId) => {
  const region = EASTERN_CIVIL_WAR_REGIONS[regionId];
  if (!region) return [];
  return region.maps || EASTERN_WAR_MAPS.camp;
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
export const createEasternCivilWarTerritories = () => {
  return Object.entries(EASTERN_CIVIL_WAR_REGIONS).map(([id, region]) => ({
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
    terrain: region.terrain,
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

  Object.values(EASTERN_CIVIL_WAR_REGIONS).forEach(region => {
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
 * Get key strategic territories (high VP value)
 */
export const getKeyTerritories = () => {
  return Object.entries(EASTERN_CIVIL_WAR_REGIONS)
    .filter(([_, region]) => region.pointValue >= 4)
    .map(([id, region]) => ({ id, ...region }));
};

/**
 * Get capital territories (6-7 VP)
 */
export const getCapitalTerritories = () => {
  return Object.entries(EASTERN_CIVIL_WAR_REGIONS)
    .filter(([_, region]) => region.pointValue >= 6)
    .map(([id, region]) => ({ id, ...region }));
};

/**
 * Get territories by owner
 */
export const getTerritoriesByOwner = (owner) => {
  return Object.entries(EASTERN_CIVIL_WAR_REGIONS)
    .filter(([_, region]) => region.owner === owner)
    .map(([id, region]) => ({ id, ...region }));
};

/**
 * Get territories by terrain type
 */
export const getTerritoriesByTerrain = (terrain) => {
  return Object.entries(EASTERN_CIVIL_WAR_REGIONS)
    .filter(([_, region]) => region.terrain === terrain)
    .map(([id, region]) => ({ id, ...region }));
};

/**
 * Validate adjacency graph (all adjacencies are bidirectional)
 */
export const validateAdjacencies = () => {
  const errors = [];

  Object.entries(EASTERN_CIVIL_WAR_REGIONS).forEach(([id, region]) => {
    region.adjacentTerritories.forEach(adjId => {
      const adjRegion = EASTERN_CIVIL_WAR_REGIONS[adjId];
      if (!adjRegion) {
        errors.push(`${id}: adjacent territory '${adjId}' does not exist`);
      } else if (!adjRegion.adjacentTerritories.includes(id)) {
        errors.push(`${id} -> ${adjId}: adjacency not bidirectional`);
      }
    });
  });

  return errors;
};
