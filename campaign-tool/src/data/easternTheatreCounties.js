/**
 * Eastern Theatre County-Based Campaign Map
 *
 * This defines county groupings for the Eastern Theatre of the American Civil War.
 * Counties are grouped into regions within each state for manageable gameplay.
 * Ownership is set to historical status as of April 1861.
 *
 * States included: PA, NY, OH, IN, MD, DE, VA, NC, SC, GA, TN, AL, KY, WV (as part of VA), MO
 */

// County FIPS codes for each region
// Format: State FIPS (2 digits) + County FIPS (3 digits)

export const EASTERN_THEATRE_REGIONS = {
  // ============================================================================
  // UNION STATES (April 1861)
  // ============================================================================

  // PENNSYLVANIA - Grouped into 4 regions
  'pa-southeast': {
    name: 'Southeast Pennsylvania',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 15, // Philadelphia area - major population/industry
    counties: [
      '42017', // Bucks
      '42029', // Chester
      '42045', // Delaware
      '42091', // Montgomery
      '42101', // Philadelphia
    ],
    adjacentTerritories: ['pa-south-central', 'md-western', 'de-delaware'],
  },
  'pa-south-central': {
    name: 'South Central Pennsylvania',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 10, // Gettysburg area
    counties: [
      '42001', // Adams
      '42041', // Cumberland
      '42043', // Dauphin
      '42055', // Franklin
      '42071', // Lancaster
      '42075', // Lebanon
      '42133', // York
    ],
    adjacentTerritories: ['pa-southeast', 'pa-central', 'md-western', 'wv-eastern-panhandle'],
  },
  'pa-central': {
    name: 'Central Pennsylvania',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 5,
    counties: [
      '42013', // Blair
      '42015', // Bradford
      '42027', // Centre
      '42033', // Clearfield
      '42035', // Clinton
      '42037', // Columbia
      '42057', // Fulton
      '42061', // Huntingdon
      '42067', // Juniata
      '42077', // Lehigh
      '42079', // Luzerne
      '42081', // Lycoming
      '42087', // Mifflin
      '42093', // Montour
      '42097', // Northampton
      '42099', // Northumberland
      '42105', // Perry
      '42109', // Snyder
      '42117', // Tioga
      '42119', // Union
    ],
    adjacentTerritories: ['pa-southeast', 'pa-south-central', 'pa-western', 'ny-southern-tier'],
  },
  'pa-western': {
    name: 'Western Pennsylvania',
    stateAbbr: 'PA',
    owner: 'USA',
    pointValue: 10, // Pittsburgh - industrial
    counties: [
      '42003', // Allegheny (Pittsburgh)
      '42005', // Armstrong
      '42007', // Beaver
      '42009', // Bedford
      '42011', // Berks
      '42019', // Butler
      '42021', // Cambria
      '42023', // Cameron
      '42031', // Clarion
      '42039', // Crawford
      '42047', // Elk
      '42049', // Erie
      '42051', // Fayette
      '42053', // Forest
      '42059', // Greene
      '42063', // Indiana
      '42065', // Jefferson
      '42073', // Lawrence
      '42083', // McKean
      '42085', // Mercer
      '42107', // Potter
      '42111', // Somerset
      '42121', // Venango
      '42123', // Warren
      '42125', // Washington
      '42129', // Westmoreland
    ],
    adjacentTerritories: ['pa-central', 'oh-northeast', 'wv-northern'],
  },

  // MARYLAND - Grouped into 2 regions
  'md-western': {
    name: 'Western Maryland',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 15, // Baltimore, Annapolis - capitals
    counties: [
      '24001', // Allegany
      '24003', // Anne Arundel
      '24005', // Baltimore County
      '24510', // Baltimore City
      '24009', // Calvert
      '24013', // Carroll
      '24017', // Charles
      '24021', // Frederick
      '24023', // Garrett
      '24025', // Harford
      '24027', // Howard
      '24031', // Montgomery
      '24033', // Prince George's
      '24043', // Washington
    ],
    adjacentTerritories: ['pa-southeast', 'pa-south-central', 'de-delaware', 'va-northern-piedmont', 'wv-eastern-panhandle', 'md-eastern-shore'],
  },
  'md-eastern-shore': {
    name: 'Eastern Shore Maryland',
    stateAbbr: 'MD',
    owner: 'USA',
    pointValue: 5,
    counties: [
      '24011', // Caroline
      '24015', // Cecil
      '24019', // Dorchester
      '24029', // Kent
      '24035', // Queen Anne\'s
      '24037', // St. Mary\'s
      '24039', // Somerset
      '24041', // Talbot
      '24045', // Wicomico
      '24047', // Worcester
    ],
    adjacentTerritories: ['md-western', 'de-delaware', 'va-eastern-shore'],
  },

  // DELAWARE - Single region (small state)
  'de-delaware': {
    name: 'Delaware',
    stateAbbr: 'DE',
    owner: 'USA',
    pointValue: 5,
    counties: [
      '10001', // Kent
      '10003', // New Castle
      '10005', // Sussex
    ],
    adjacentTerritories: ['pa-southeast', 'md-western', 'md-eastern-shore'],
  },

  // OHIO - Grouped into 3 regions
  'oh-northeast': {
    name: 'Northeast Ohio',
    stateAbbr: 'OH',
    owner: 'USA',
    pointValue: 10, // Cleveland, industrial
    counties: [
      '39003', // Allen
      '39007', // Ashtabula
      '39029', // Columbiana
      '39035', // Cuyahoga (Cleveland)
      '39043', // Erie
      '39055', // Geauga
      '39077', // Huron
      '39085', // Lake
      '39093', // Lorain
      '39099', // Mahoning
      '39103', // Medina
      '39133', // Portage
      '39151', // Stark
      '39153', // Summit
      '39155', // Trumbull
      '39169', // Wayne
    ],
    adjacentTerritories: ['pa-western', 'oh-central', 'oh-southern'],
  },
  'oh-central': {
    name: 'Central Ohio',
    stateAbbr: 'OH',
    owner: 'USA',
    pointValue: 10, // Columbus - state capital
    counties: [
      '39041', // Delaware
      '39045', // Fairfield
      '39049', // Franklin (Columbus)
      '39073', // Hocking
      '39089', // Licking
      '39097', // Madison
      '39101', // Marion
      '39117', // Morrow
      '39127', // Perry
      '39129', // Pickaway
      '39159', // Union
    ],
    adjacentTerritories: ['oh-northeast', 'oh-southern', 'in-eastern'],
  },
  'oh-southern': {
    name: 'Southern Ohio',
    stateAbbr: 'OH',
    owner: 'USA',
    pointValue: 10, // Cincinnati
    counties: [
      '39001', // Adams
      '39015', // Brown
      '39017', // Butler
      '39025', // Clermont
      '39027', // Clinton
      '39047', // Fayette
      '39057', // Greene
      '39061', // Hamilton (Cincinnati)
      '39071', // Highland
      '39113', // Montgomery
      '39135', // Preble
      '39137', // Putnam
      '39141', // Ross
      '39145', // Scioto
      '39165', // Warren
    ],
    adjacentTerritories: ['oh-central', 'oh-northeast', 'in-eastern', 'ky-northern'],
  },

  // INDIANA - Grouped into 2 regions
  'in-northern': {
    name: 'Northern Indiana',
    stateAbbr: 'IN',
    owner: 'USA',
    pointValue: 5,
    counties: [
      '18001', // Adams
      '18003', // Allen (Fort Wayne)
      '18009', // Blackford
      '18017', // Cass
      '18033', // DeKalb
      '18035', // Delaware
      '18039', // Elkhart
      '18049', // Fulton
      '18053', // Grant
      '18057', // Hamilton
      '18067', // Howard
      '18069', // Huntington
      '18075', // Jay
      '18085', // Kosciusko
      '18087', // LaGrange
      '18089', // Lake
      '18091', // LaPorte
      '18097', // Marion (Indianapolis)
      '18099', // Marshall
      '18103', // Miami
      '18113', // Noble
      '18127', // Porter
      '18141', // St. Joseph
      '18149', // Steuben
      '18151', // Tippecanoe
      '18169', // Wabash
      '18179', // Wells
      '18181', // White
      '18183', // Whitley
    ],
    adjacentTerritories: ['in-southern', 'oh-central', 'oh-southern'],
  },
  'in-southern': {
    name: 'Southern Indiana',
    stateAbbr: 'IN',
    owner: 'USA',
    pointValue: 5,
    counties: [
      '18005', // Bartholomew
      '18013', // Brown
      '18019', // Clark
      '18021', // Clay
      '18025', // Crawford
      '18027', // Daviess
      '18029', // Dearborn
      '18031', // Decatur
      '18037', // Dubois
      '18043', // Floyd
      '18047', // Franklin
      '18055', // Gibson
      '18061', // Harrison
      '18065', // Henry
      '18071', // Jackson
      '18077', // Jefferson
      '18079', // Jennings
      '18081', // Johnson
      '18083', // Knox
      '18093', // Lawrence
      '18101', // Martin
      '18105', // Monroe
      '18109', // Morgan
      '18115', // Ohio
      '18117', // Orange
      '18119', // Owen
      '18123', // Perry
      '18125', // Pike
      '18129', // Posey
      '18133', // Putnam
      '18137', // Ripley
      '18139', // Rush
      '18143', // Scott
      '18145', // Shelby
      '18147', // Spencer
      '18153', // Sullivan
      '18155', // Switzerland
      '18163', // Vanderburgh (Evansville)
      '18167', // Vigo
      '18173', // Warrick
      '18175', // Washington
    ],
    adjacentTerritories: ['in-northern', 'oh-southern', 'ky-northern', 'ky-western'],
  },

  // ============================================================================
  // CONFEDERATE STATES (April 1861)
  // ============================================================================

  // VIRGINIA - Grouped into 4 regions
  'va-tidewater': {
    name: 'Tidewater Virginia',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 10, // Norfolk, naval importance
    counties: [
      '51001', // Accomack
      '51073', // Gloucester
      '51093', // Isle of Wight
      '51095', // James City
      '51115', // Mathews
      '51131', // Northampton
      '51133', // Northumberland
      '51650', // Hampton
      '51700', // Newport News
      '51710', // Norfolk
      '51735', // Poquoson
      '51740', // Portsmouth
      '51800', // Suffolk
      '51810', // Virginia Beach
      '51830', // Williamsburg
      '51199', // York
    ],
    adjacentTerritories: ['va-eastern-shore', 'va-central-piedmont', 'nc-coastal'],
  },
  'va-eastern-shore': {
    name: 'Eastern Shore Virginia',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 5,
    counties: [
      '51001', // Accomack
      '51131', // Northampton
    ],
    adjacentTerritories: ['va-tidewater', 'md-eastern-shore'],
  },
  'va-northern-piedmont': {
    name: 'Northern Virginia',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 15, // Richmond (capital), strategic importance
    counties: [
      '51003', // Albemarle
      '51013', // Arlington
      '51043', // Clarke
      '51047', // Culpeper
      '51059', // Fairfax
      '51061', // Fauquier
      '51065', // Fluvanna
      '51069', // Frederick
      '51079', // Greene
      '51107', // Loudoun
      '51113', // Madison
      '51137', // Orange
      '51139', // Page
      '51157', // Rappahannock
      '51760', // Richmond City
      '51087', // Henrico
      '51041', // Chesterfield
      '51570', // Colonial Heights
      '51670', // Hopewell
      '51730', // Petersburg
      '51149', // Prince George
      '51085', // Hanover
      '51097', // King and Queen
      '51099', // King George
      '51101', // King William
      '51103', // Lancaster
      '51119', // Middlesex
      '51127', // New Kent
      '51159', // Richmond County
      '51179', // Stafford
      '51193', // Westmoreland
      '51510', // Alexandria
      '51600', // Fairfax City
      '51610', // Falls Church
      '51683', // Manassas
      '51685', // Manassas Park
      '51153', // Prince William
      '51171', // Shenandoah
      '51187', // Warren
    ],
    adjacentTerritories: ['md-western', 'wv-eastern-panhandle', 'va-shenandoah', 'va-central-piedmont', 'va-tidewater'],
  },
  'va-central-piedmont': {
    name: 'Central Virginia Piedmont',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 10,
    counties: [
      '51007', // Amelia
      '51009', // Amherst
      '51011', // Appomattox
      '51015', // Augusta
      '51019', // Bedford
      '51023', // Botetourt
      '51025', // Brunswick
      '51029', // Buckingham
      '51031', // Campbell
      '51033', // Caroline
      '51036', // Charles City
      '51037', // Charlotte
      '51049', // Cumberland
      '51053', // Dinwiddie
      '51067', // Franklin
      '51075', // Goochland
      '51081', // Greensville
      '51083', // Halifax
      '51089', // Henry
      '51109', // Louisa
      '51111', // Lunenburg
      '51117', // Mecklenburg
      '51125', // Nelson
      '51135', // Nottoway
      '51143', // Pittsylvania
      '51145', // Powhatan
      '51147', // Prince Edward
      '51163', // Rockbridge
      '51540', // Charlottesville
      '51515', // Bedford City
      '51530', // Buena Vista
      '51580', // Covington
      '51590', // Danville
      '51678', // Lexington
      '51680', // Lynchburg
      '51690', // Martinsville
      '51750', // Radford
      '51770', // Roanoke City
      '51161', // Roanoke County
      '51775', // Salem
      '51790', // Staunton
      '51820', // Waynesboro
    ],
    adjacentTerritories: ['va-northern-piedmont', 'va-tidewater', 'va-shenandoah', 'va-southwest', 'nc-piedmont'],
  },
  'va-shenandoah': {
    name: 'Shenandoah Valley',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 10, // Strategic valley
    counties: [
      '51015', // Augusta
      '51017', // Bath
      '51071', // Giles
      '51091', // Highland
      '51163', // Rockbridge
      '51165', // Rockingham
      '51660', // Harrisonburg
      '51790', // Staunton
      '51820', // Waynesboro
    ],
    adjacentTerritories: ['va-northern-piedmont', 'va-central-piedmont', 'va-southwest', 'wv-eastern-panhandle', 'wv-southern'],
  },
  'va-southwest': {
    name: 'Southwest Virginia',
    stateAbbr: 'VA',
    owner: 'CSA',
    pointValue: 5,
    counties: [
      '51021', // Bland
      '51027', // Buchanan
      '51035', // Carroll
      '51045', // Craig
      '51051', // Dickenson
      '51063', // Floyd
      '51071', // Giles
      '51077', // Grayson
      '51105', // Lee
      '51121', // Montgomery
      '51141', // Patrick
      '51155', // Pulaski
      '51167', // Russell
      '51169', // Scott
      '51173', // Smyth
      '51185', // Tazewell
      '51191', // Washington
      '51195', // Wise
      '51197', // Wythe
      '51520', // Bristol
      '51640', // Galax
      '51720', // Norton
      '51750', // Radford
    ],
    adjacentTerritories: ['va-shenandoah', 'va-central-piedmont', 'wv-southern', 'ky-eastern', 'tn-east', 'nc-mountains'],
  },

  // NORTH CAROLINA - Grouped into 3 regions
  'nc-coastal': {
    name: 'Coastal North Carolina',
    stateAbbr: 'NC',
    owner: 'CSA',
    pointValue: 10, // Wilmington port
    counties: [
      '37013', // Beaufort
      '37015', // Bertie
      '37017', // Bladen
      '37019', // Brunswick
      '37029', // Camden
      '37031', // Carteret
      '37041', // Chowan
      '37043', // Clay
      '37047', // Columbus
      '37049', // Craven
      '37053', // Currituck
      '37055', // Dare
      '37061', // Duplin
      '37065', // Edgecombe
      '37073', // Gates
      '37083', // Halifax
      '37091', // Hertford
      '37095', // Hyde
      '37103', // Jones
      '37107', // Lenoir
      '37117', // Martin
      '37129', // New Hanover
      '37131', // Northampton
      '37133', // Onslow
      '37137', // Pamlico
      '37139', // Pasquotank
      '37143', // Perquimans
      '37147', // Pitt
      '37177', // Tyrrell
      '37187', // Washington
      '37191', // Wayne
    ],
    adjacentTerritories: ['va-tidewater', 'nc-piedmont', 'sc-lowcountry'],
  },
  'nc-piedmont': {
    name: 'Piedmont North Carolina',
    stateAbbr: 'NC',
    owner: 'CSA',
    pointValue: 10, // Raleigh - state capital
    counties: [
      '37001', // Alamance
      '37003', // Alexander
      '37005', // Alleghany
      '37007', // Anson
      '37009', // Ashe
      '37033', // Caswell
      '37035', // Catawba
      '37037', // Chatham
      '37057', // Davidson
      '37059', // Davie
      '37063', // Durham
      '37067', // Forsyth
      '37069', // Franklin
      '37077', // Granville
      '37079', // Greene
      '37081', // Guilford
      '37085', // Harnett
      '37097', // Iredell
      '37101', // Johnston
      '37105', // Lee
      '37109', // Lincoln
      '37119', // Mecklenburg (Charlotte)
      '37125', // Moore
      '37127', // Nash
      '37135', // Orange
      '37141', // Pender
      '37145', // Person
      '37151', // Randolph
      '37153', // Richmond
      '37155', // Robeson
      '37157', // Rockingham
      '37159', // Rowan
      '37163', // Sampson
      '37167', // Stanly
      '37169', // Stokes
      '37171', // Surry
      '37179', // Union
      '37181', // Vance
      '37183', // Wake (Raleigh)
      '37185', // Warren
      '37189', // Watauga
      '37193', // Wilkes
      '37195', // Wilson
      '37197', // Yadkin
    ],
    adjacentTerritories: ['nc-coastal', 'nc-mountains', 'va-central-piedmont', 'sc-upstate'],
  },
  'nc-mountains': {
    name: 'Mountain North Carolina',
    stateAbbr: 'NC',
    owner: 'CSA',
    pointValue: 5,
    counties: [
      '37011', // Avery
      '37021', // Buncombe (Asheville)
      '37023', // Burke
      '37025', // Cabarrus
      '37027', // Caldwell
      '37039', // Cherokee
      '37045', // Cleveland
      '37071', // Gaston
      '37075', // Graham
      '37087', // Haywood
      '37089', // Henderson
      '37099', // Jackson
      '37111', // McDowell
      '37113', // Macon
      '37115', // Madison
      '37121', // Mitchell
      '37149', // Polk
      '37161', // Rutherford
      '37173', // Swain
      '37175', // Transylvania
      '37199', // Yancey
    ],
    adjacentTerritories: ['nc-piedmont', 'va-southwest', 'tn-east', 'sc-upstate', 'ga-north'],
  },

  // SOUTH CAROLINA - Grouped into 2 regions
  'sc-lowcountry': {
    name: 'Lowcountry South Carolina',
    stateAbbr: 'SC',
    owner: 'CSA',
    pointValue: 10, // Charleston - major port
    counties: [
      '45013', // Beaufort
      '45015', // Berkeley
      '45019', // Charleston
      '45025', // Chesterfield
      '45027', // Clarendon
      '45029', // Colleton
      '45031', // Darlington
      '45033', // Dillon
      '45035', // Dorchester
      '45041', // Florence
      '45043', // Georgetown
      '45049', // Hampton
      '45051', // Horry
      '45053', // Jasper
      '45055', // Kershaw
      '45061', // Lee
      '45067', // Marion
      '45069', // Marlboro
      '45075', // Orangeburg
      '45085', // Sumter
      '45089', // Williamsburg
    ],
    adjacentTerritories: ['nc-coastal', 'sc-upstate', 'ga-coastal'],
  },
  'sc-upstate': {
    name: 'Upstate South Carolina',
    stateAbbr: 'SC',
    owner: 'CSA',
    pointValue: 5,
    counties: [
      '45001', // Abbeville
      '45003', // Aiken
      '45005', // Allendale
      '45007', // Anderson
      '45009', // Bamberg
      '45011', // Barnwell
      '45017', // Calhoun
      '45021', // Cherokee
      '45023', // Chester
      '45037', // Edgefield
      '45039', // Fairfield
      '45045', // Greenville
      '45047', // Greenwood
      '45057', // Lancaster
      '45059', // Laurens
      '45063', // Lexington
      '45065', // McCormick
      '45071', // Newberry
      '45073', // Oconee
      '45077', // Pickens
      '45079', // Richland (Columbia)
      '45081', // Saluda
      '45083', // Spartanburg
      '45087', // Union
      '45091', // York
    ],
    adjacentTerritories: ['sc-lowcountry', 'nc-piedmont', 'nc-mountains', 'ga-north', 'ga-central'],
  },

  // GEORGIA - Grouped into 3 regions
  'ga-coastal': {
    name: 'Coastal Georgia',
    stateAbbr: 'GA',
    owner: 'CSA',
    pointValue: 10, // Savannah - major port
    counties: [
      '13001', // Appling
      '13005', // Bacon
      '13019', // Berrien
      '13025', // Brantley
      '13029', // Bryan
      '13031', // Bulloch
      '13039', // Camden
      '13043', // Candler
      '13049', // Charlton
      '13051', // Chatham (Savannah)
      '13065', // Clinch
      '13069', // Coffee
      '13103', // Effingham
      '13107', // Emanuel
      '13109', // Evans
      '13127', // Glynn
      '13161', // Jeff Davis
      '13165', // Jenkins
      '13179', // Liberty
      '13183', // Long
      '13191', // McIntosh
      '13229', // Pierce
      '13251', // Screven
      '13267', // Tattnall
      '13271', // Telfair
      '13275', // Thomas
      '13277', // Tift
      '13279', // Toombs
      '13283', // Treutlen
      '13287', // Turner
      '13305', // Wayne
      '13309', // Wheeler
    ],
    adjacentTerritories: ['sc-lowcountry', 'ga-central'],
  },
  'ga-central': {
    name: 'Central Georgia',
    stateAbbr: 'GA',
    owner: 'CSA',
    pointValue: 10, // Macon, Atlanta area
    counties: [
      '13007', // Baker
      '13009', // Baldwin
      '13011', // Banks
      '13013', // Barrow
      '13015', // Bartow
      '13017', // Ben Hill
      '13021', // Bibb (Macon)
      '13023', // Bleckley
      '13027', // Brooks
      '13033', // Burke
      '13035', // Butts
      '13037', // Calhoun
      '13045', // Carroll
      '13053', // Chattahoochee
      '13057', // Cherokee
      '13059', // Clarke
      '13061', // Clay
      '13063', // Clayton
      '13067', // Cobb
      '13071', // Colquitt
      '13073', // Columbia
      '13075', // Cook
      '13077', // Coweta
      '13079', // Crawford
      '13081', // Crisp
      '13089', // DeKalb
      '13091', // Dodge
      '13093', // Dooly
      '13095', // Dougherty (Albany)
      '13097', // Douglas
      '13099', // Early
      '13101', // Echols
      '13105', // Elbert
      '13111', // Fannin
      '13113', // Fayette
      '13115', // Floyd
      '13117', // Forsyth
      '13119', // Franklin
      '13121', // Fulton (Atlanta)
      '13125', // Glascock
      '13129', // Gordon
      '13131', // Grady
      '13133', // Greene
      '13135', // Gwinnett
      '13137', // Habersham
      '13139', // Hall
      '13141', // Hancock
      '13143', // Haralson
      '13145', // Harris
      '13147', // Hart
      '13149', // Heard
      '13151', // Henry
      '13153', // Houston
      '13155', // Irwin
      '13157', // Jackson
      '13159', // Jasper
      '13163', // Jefferson
      '13167', // Johnson
      '13169', // Jones
      '13171', // Lamar
      '13173', // Lanier
      '13175', // Laurens
      '13177', // Lee
      '13181', // Lincoln
      '13185', // Lowndes
      '13187', // Lumpkin
      '13189', // McDuffie
      '13193', // Macon
      '13195', // Madison
      '13197', // Marion
      '13199', // Meriwether
      '13201', // Miller
      '13205', // Mitchell
      '13207', // Monroe
      '13209', // Montgomery
      '13211', // Morgan
      '13213', // Murray
      '13215', // Muscogee (Columbus)
      '13217', // Newton
      '13219', // Oconee
      '13221', // Oglethorpe
      '13223', // Paulding
      '13225', // Peach
      '13227', // Pickens
      '13231', // Pike
      '13233', // Polk
      '13235', // Pulaski
      '13237', // Putnam
      '13239', // Quitman
      '13241', // Rabun
      '13243', // Randolph
      '13245', // Richmond (Augusta)
      '13247', // Rockdale
      '13249', // Schley
      '13253', // Seminole
      '13255', // Spalding
      '13257', // Stephens
      '13259', // Stewart
      '13261', // Sumter
      '13263', // Talbot
      '13265', // Taliaferro
      '13269', // Taylor
      '13273', // Terrell
      '13281', // Towns
      '13285', // Troup
      '13289', // Twiggs
      '13291', // Union
      '13293', // Upson
      '13295', // Walker
      '13297', // Walton
      '13299', // Ware
      '13301', // Warren
      '13303', // Washington
      '13307', // Webster
      '13311', // White
      '13313', // Whitfield
      '13315', // Wilcox
      '13317', // Wilkes
      '13319', // Wilkinson
      '13321', // Worth
    ],
    adjacentTerritories: ['ga-coastal', 'ga-north', 'sc-upstate', 'al-north', 'tn-middle'],
  },
  'ga-north': {
    name: 'North Georgia',
    stateAbbr: 'GA',
    owner: 'CSA',
    pointValue: 5,
    counties: [
      '13047', // Catoosa
      '13055', // Chattooga
      '13083', // Dade
      '13085', // Dawson
      '13111', // Fannin
      '13123', // Gilmer
      '13137', // Habersham
      '13139', // Hall
      '13187', // Lumpkin
      '13213', // Murray
      '13227', // Pickens
      '13241', // Rabun
      '13257', // Stephens
      '13281', // Towns
      '13291', // Union
      '13295', // Walker
      '13311', // White
      '13313', // Whitfield
    ],
    adjacentTerritories: ['ga-central', 'nc-mountains', 'tn-east', 'al-north'],
  },

  // TENNESSEE - Grouped into 3 regions
  'tn-east': {
    name: 'East Tennessee',
    stateAbbr: 'TN',
    owner: 'CSA',
    pointValue: 10, // Knoxville, Chattanooga
    counties: [
      '47001', // Anderson
      '47009', // Blount
      '47011', // Bradley
      '47013', // Campbell
      '47019', // Carter
      '47025', // Claiborne
      '47029', // Cocke
      '47057', // Grainger
      '47059', // Greene
      '47063', // Hamblen
      '47065', // Hamilton (Chattanooga)
      '47067', // Hancock
      '47073', // Hawkins
      '47089', // Jefferson
      '47093', // Knox (Knoxville)
      '47105', // Loudon
      '47107', // McMinn
      '47115', // Marion
      '47121', // Meigs
      '47123', // Monroe
      '47129', // Morgan
      '47139', // Polk
      '47143', // Rhea
      '47145', // Roane
      '47151', // Scott
      '47155', // Sevier
      '47163', // Sullivan
      '47171', // Unicoi
      '47173', // Union
      '47179', // Washington
    ],
    adjacentTerritories: ['tn-middle', 'va-southwest', 'nc-mountains', 'ga-north', 'ky-eastern'],
  },
  'tn-middle': {
    name: 'Middle Tennessee',
    stateAbbr: 'TN',
    owner: 'CSA',
    pointValue: 15, // Nashville - state capital
    counties: [
      '47003', // Bedford
      '47005', // Benton
      '47007', // Bledsoe
      '47015', // Cannon
      '47021', // Cheatham
      '47027', // Clay
      '47031', // Coffee
      '47035', // Cumberland
      '47037', // Davidson (Nashville)
      '47041', // DeKalb
      '47043', // Dickson
      '47049', // Fentress
      '47051', // Franklin
      '47055', // Giles
      '47061', // Grundy
      '47075', // Hickman
      '47081', // Houston
      '47083', // Humphreys
      '47085', // Jackson
      '47087', // Jackson
      '47099', // Lawrence
      '47101', // Lewis
      '47103', // Lincoln
      '47111', // Macon
      '47117', // Marshall
      '47119', // Maury
      '47127', // Moore
      '47131', // Obion
      '47133', // Overton
      '47135', // Perry
      '47137', // Pickett
      '47141', // Putnam
      '47147', // Robertson
      '47149', // Rutherford
      '47159', // Smith
      '47161', // Stewart
      '47165', // Sumner
      '47169', // Trousdale
      '47175', // Van Buren
      '47177', // Warren
      '47181', // Wayne
      '47185', // White
      '47187', // Williamson
      '47189', // Wilson
    ],
    adjacentTerritories: ['tn-east', 'tn-west', 'ky-western', 'al-north', 'ga-central'],
  },
  'tn-west': {
    name: 'West Tennessee',
    stateAbbr: 'TN',
    owner: 'CSA',
    pointValue: 10, // Memphis
    counties: [
      '47017', // Carroll
      '47023', // Chester
      '47033', // Crockett
      '47039', // Decatur
      '47045', // Dyer
      '47047', // Fayette
      '47053', // Gibson
      '47069', // Hardeman
      '47071', // Hardin
      '47077', // Henderson
      '47079', // Henry
      '47091', // Lake
      '47095', // Lauderdale
      '47109', // McNairy
      '47113', // Madison
      '47131', // Obion
      '47157', // Shelby (Memphis)
      '47167', // Tipton
      '47183', // Weakley
    ],
    adjacentTerritories: ['tn-middle', 'ky-western', 'mo-southeast', 'al-north', 'ms-north'],
  },

  // ALABAMA - Grouped into 2 regions
  'al-north': {
    name: 'North Alabama',
    stateAbbr: 'AL',
    owner: 'CSA',
    pointValue: 5,
    counties: [
      '01009', // Blount
      '01015', // Calhoun
      '01017', // Chambers
      '01019', // Cherokee
      '01027', // Clay
      '01029', // Cleburne
      '01033', // Colbert
      '01043', // Cullman
      '01049', // DeKalb
      '01055', // Etowah
      '01057', // Fayette
      '01059', // Franklin
      '01071', // Jackson
      '01073', // Jefferson (Birmingham)
      '01077', // Lauderdale
      '01079', // Lawrence
      '01083', // Limestone
      '01089', // Madison (Huntsville)
      '01093', // Marion
      '01095', // Marshall
      '01103', // Morgan
      '01107', // Pickens
      '01115', // St. Clair
      '01117', // Shelby
      '01121', // Talladega
      '01127', // Walker
      '01133', // Winston
    ],
    adjacentTerritories: ['al-south', 'tn-middle', 'tn-west', 'ga-central', 'ms-north'],
  },
  'al-south': {
    name: 'South Alabama',
    stateAbbr: 'AL',
    owner: 'CSA',
    pointValue: 10, // Montgomery - state capital, Mobile port
    counties: [
      '01001', // Autauga
      '01003', // Baldwin
      '01005', // Barbour
      '01007', // Bibb
      '01011', // Bullock
      '01013', // Butler
      '01021', // Chilton
      '01023', // Choctaw
      '01025', // Clarke
      '01031', // Coffee
      '01035', // Conecuh
      '01037', // Coosa
      '01039', // Covington
      '01041', // Crenshaw
      '01045', // Dale
      '01047', // Dallas
      '01051', // Elmore
      '01053', // Escambia
      '01061', // Geneva
      '01063', // Greene
      '01065', // Hale
      '01067', // Henry
      '01069', // Houston
      '01081', // Lee
      '01085', // Lowndes
      '01087', // Macon
      '01091', // Marengo
      '01097', // Mobile (Mobile)
      '01099', // Monroe
      '01101', // Montgomery (Montgomery)
      '01105', // Perry
      '01109', // Pike
      '01111', // Randolph
      '01113', // Russell
      '01119', // Sumter
      '01123', // Tallapoosa
      '01125', // Tuscaloosa
      '01129', // Washington
      '01131', // Wilcox
    ],
    adjacentTerritories: ['al-north', 'ga-central', 'ms-south'],
  },

  // ============================================================================
  // BORDER / NEUTRAL STATES (April 1861)
  // ============================================================================

  // KENTUCKY - Grouped into 3 regions (Neutral at war's start)
  'ky-eastern': {
    name: 'Eastern Kentucky',
    stateAbbr: 'KY',
    owner: 'NEUTRAL',
    pointValue: 5,
    counties: [
      '21013', // Bell
      '21019', // Boyd
      '21025', // Breathitt
      '21043', // Carter
      '21051', // Clay
      '21053', // Clinton
      '21063', // Elliott
      '21065', // Estill
      '21071', // Floyd
      '21089', // Greenup
      '21095', // Harlan
      '21109', // Jackson
      '21115', // Johnson
      '21119', // Knott
      '21121', // Knox
      '21125', // Laurel
      '21127', // Lawrence
      '21129', // Lee
      '21131', // Leslie
      '21133', // Letcher
      '21135', // Lewis
      '21147', // McCreary
      '21153', // Magoffin
      '21159', // Martin
      '21165', // Menifee
      '21175', // Morgan
      '21189', // Owsley
      '21193', // Perry
      '21195', // Pike
      '21197', // Powell
      '21203', // Rockcastle
      '21205', // Rowan
      '21235', // Whitley
      '21237', // Wolfe
    ],
    adjacentTerritories: ['ky-central', 'va-southwest', 'tn-east', 'wv-southern'],
  },
  'ky-central': {
    name: 'Central Kentucky',
    stateAbbr: 'KY',
    owner: 'NEUTRAL',
    pointValue: 10, // Lexington, Frankfort (capital)
    counties: [
      '21003', // Allen
      '21005', // Anderson
      '21011', // Bath
      '21015', // Boone
      '21017', // Bourbon
      '21021', // Boyle
      '21023', // Bracken
      '21029', // Bullitt
      '21037', // Campbell
      '21041', // Carroll
      '21049', // Clark
      '21057', // Cumberland
      '21067', // Fayette (Lexington)
      '21069', // Fleming
      '21073', // Franklin (Frankfort)
      '21077', // Gallatin
      '21079', // Garrard
      '21081', // Grant
      '21085', // Grayson
      '21087', // Green
      '21093', // Hardin
      '21097', // Harrison
      '21103', // Henry
      '21111', // Jefferson (Louisville)
      '21113', // Jessamine
      '21117', // Kenton
      '21137', // Lincoln
      '21141', // Logan
      '21151', // Madison
      '21161', // Marion
      '21163', // Meade
      '21167', // Mercer
      '21169', // Metcalfe
      '21173', // Montgomery
      '21177', // Muhlenberg
      '21179', // Nelson
      '21181', // Nicholas
      '21185', // Oldham
      '21187', // Owen
      '21191', // Pendleton
      '21199', // Pulaski
      '21201', // Robertson
      '21207', // Russell
      '21209', // Scott
      '21211', // Shelby
      '21215', // Spencer
      '21217', // Taylor
      '21219', // Todd
      '21223', // Trimble
      '21229', // Washington
      '21231', // Wayne
      '21233', // Webster
      '21239', // Woodford
    ],
    adjacentTerritories: ['ky-eastern', 'ky-western', 'oh-southern', 'in-southern', 'tn-middle', 'wv-southern'],
  },
  'ky-western': {
    name: 'Western Kentucky',
    stateAbbr: 'KY',
    owner: 'NEUTRAL',
    pointValue: 5,
    counties: [
      '21001', // Adair
      '21007', // Ballard
      '21009', // Barren
      '21027', // Breckinridge
      '21031', // Butler
      '21033', // Caldwell
      '21035', // Calloway
      '21039', // Carlisle
      '21045', // Casey
      '21047', // Christian
      '21055', // Crittenden
      '21059', // Daviess
      '21061', // Edmonson
      '21075', // Fulton
      '21083', // Graves
      '21091', // Hancock
      '21099', // Hart
      '21101', // Henderson
      '21105', // Hickman
      '21107', // Hopkins
      '21139', // Livingston
      '21143', // Lyon
      '21145', // McCracken (Paducah)
      '21149', // McLean
      '21155', // Marshall
      '21171', // Monroe
      '21183', // Ohio
      '21213', // Simpson
      '21221', // Trigg
      '21225', // Union
      '21227', // Warren
    ],
    adjacentTerritories: ['ky-central', 'in-southern', 'tn-middle', 'tn-west', 'mo-southeast'],
  },

  // WEST VIRGINIA (Part of Virginia in 1861, but with Union sympathies)
  'wv-northern': {
    name: 'Northern West Virginia',
    stateAbbr: 'WV',
    owner: 'NEUTRAL',
    pointValue: 5,
    counties: [
      '54001', // Barbour
      '54003', // Berkeley
      '54007', // Braxton
      '54009', // Brooke
      '54013', // Calhoun
      '54017', // Doddridge
      '54021', // Gilmer
      '54023', // Grant
      '54027', // Hampshire
      '54029', // Hancock
      '54031', // Hardy
      '54033', // Harrison
      '54037', // Jefferson
      '54041', // Lewis
      '54049', // Marion
      '54051', // Marshall
      '54053', // Mason
      '54057', // Mineral
      '54061', // Monongalia
      '54065', // Morgan
      '54069', // Ohio
      '54071', // Pendleton
      '54073', // Pleasants
      '54077', // Preston
      '54083', // Randolph
      '54085', // Ritchie
      '54091', // Taylor
      '54093', // Tucker
      '54095', // Tyler
      '54097', // Upshur
      '54099', // Wayne
      '54103', // Wetzel
      '54107', // Wood
    ],
    adjacentTerritories: ['pa-western', 'oh-northeast', 'wv-southern', 'wv-eastern-panhandle', 'va-shenandoah'],
  },
  'wv-eastern-panhandle': {
    name: 'Eastern Panhandle',
    stateAbbr: 'WV',
    owner: 'NEUTRAL',
    pointValue: 5, // Harpers Ferry strategic location
    counties: [
      '54003', // Berkeley
      '54037', // Jefferson (Harpers Ferry)
      '54065', // Morgan
    ],
    adjacentTerritories: ['md-western', 'pa-south-central', 'va-northern-piedmont', 'va-shenandoah', 'wv-northern'],
  },
  'wv-southern': {
    name: 'Southern West Virginia',
    stateAbbr: 'WV',
    owner: 'NEUTRAL',
    pointValue: 5,
    counties: [
      '54005', // Boone
      '54011', // Cabell
      '54015', // Clay
      '54019', // Fayette
      '54025', // Greenbrier
      '54035', // Jackson
      '54039', // Kanawha (Charleston)
      '54043', // Lincoln
      '54045', // Logan
      '54047', // McDowell
      '54055', // Mercer
      '54059', // Mingo
      '54063', // Monroe
      '54067', // Nicholas
      '54075', // Pocahontas
      '54079', // Putnam
      '54081', // Raleigh
      '54087', // Roane
      '54089', // Summers
      '54101', // Webster
      '54105', // Wirt
      '54109', // Wyoming
    ],
    adjacentTerritories: ['wv-northern', 'va-shenandoah', 'va-southwest', 'ky-eastern', 'ky-central', 'oh-southern'],
  },

  // MISSOURI - Grouped into 3 regions (contested/neutral)
  'mo-eastern': {
    name: 'Eastern Missouri',
    stateAbbr: 'MO',
    owner: 'NEUTRAL',
    pointValue: 10, // St. Louis
    counties: [
      '29007', // Audrain
      '29019', // Boone
      '29027', // Callaway
      '29051', // Cole (Jefferson City - capital)
      '29071', // Franklin
      '29089', // Howard
      '29099', // Jefferson
      '29113', // Lincoln
      '29137', // Monroe
      '29139', // Montgomery
      '29151', // Osage
      '29157', // Perry
      '29161', // Phelps
      '29163', // Pike
      '29173', // Ralls
      '29183', // St. Charles
      '29189', // St. Louis County
      '29510', // St. Louis City
      '29219', // Warren
    ],
    adjacentTerritories: ['mo-central', 'mo-southeast', 'ky-western'],
  },
  'mo-central': {
    name: 'Central Missouri',
    stateAbbr: 'MO',
    owner: 'NEUTRAL',
    pointValue: 5,
    counties: [
      '29001', // Adair
      '29015', // Benton
      '29029', // Camden
      '29041', // Chariton
      '29053', // Cooper
      '29061', // Daviess
      '29073', // Gasconade
      '29081', // Harrison
      '29085', // Hickory
      '29095', // Jackson (Kansas City area)
      '29101', // Johnson
      '29105', // Laclede
      '29107', // Lafayette
      '29115', // Linn
      '29117', // Livingston
      '29121', // Macon
      '29127', // Marion
      '29129', // Mercer
      '29131', // Miller
      '29135', // Moniteau
      '29141', // Morgan
      '29159', // Pettis
      '29165', // Platte
      '29171', // Putnam
      '29175', // Randolph
      '29177', // Ray
      '29181', // St. Clair
      '29185', // St. Francois
      '29195', // Saline
      '29197', // Schuyler
      '29199', // Scotland
      '29205', // Shelby
      '29211', // Sullivan
    ],
    adjacentTerritories: ['mo-eastern', 'mo-southeast'],
  },
  'mo-southeast': {
    name: 'Southeast Missouri',
    stateAbbr: 'MO',
    owner: 'NEUTRAL',
    pointValue: 5,
    counties: [
      '29017', // Bollinger
      '29023', // Butler
      '29031', // Cape Girardeau
      '29035', // Carter
      '29055', // Crawford
      '29057', // Dade
      '29065', // Dent
      '29067', // Douglas
      '29069', // Dunklin
      '29077', // Greene (Springfield)
      '29091', // Howell
      '29093', // Iron
      '29109', // Lawrence
      '29119', // Madison
      '29123', // Madison
      '29133', // Mississippi
      '29143', // New Madrid
      '29145', // Newton
      '29149', // Oregon
      '29153', // Ozark
      '29155', // Pemiscot
      '29179', // Reynolds
      '29181', // Ripley
      '29186', // St. Genevieve
      '29187', // St. Louis
      '29201', // Scott
      '29203', // Shannon
      '29207', // Stoddard
      '29213', // Taney
      '29215', // Texas
      '29221', // Washington
      '29223', // Wayne
      '29229', // Wright
    ],
    adjacentTerritories: ['mo-eastern', 'mo-central', 'ky-western', 'tn-west'],
  },

  // MISSISSIPPI - North only (for Eastern Theatre connection)
  'ms-north': {
    name: 'North Mississippi',
    stateAbbr: 'MS',
    owner: 'CSA',
    pointValue: 5,
    counties: [
      '28003', // Alcorn
      '28009', // Benton
      '28013', // Calhoun
      '28017', // Chickasaw
      '28025', // Clay
      '28033', // DeSoto
      '28057', // Itawamba
      '28071', // Lafayette
      '28081', // Lee
      '28093', // Marshall
      '28095', // Monroe
      '28107', // Panola
      '28115', // Pontotoc
      '28117', // Prentiss
      '28139', // Tate
      '28137', // Tippah
      '28141', // Tishomingo
      '28143', // Tunica
      '28145', // Union
      '28161', // Yalobusha
    ],
    adjacentTerritories: ['tn-west', 'al-north', 'ms-south'],
  },
  'ms-south': {
    name: 'Central/South Mississippi',
    stateAbbr: 'MS',
    owner: 'CSA',
    pointValue: 10, // Vicksburg, Jackson
    counties: [
      '28001', // Adams
      '28005', // Amite
      '28007', // Attala
      '28011', // Bolivar
      '28015', // Carroll
      '28019', // Choctaw
      '28021', // Claiborne
      '28023', // Clarke
      '28027', // Coahoma
      '28029', // Copiah
      '28031', // Covington
      '28035', // Forrest
      '28037', // Franklin
      '28039', // George
      '28041', // Greene
      '28043', // Grenada
      '28045', // Hancock
      '28047', // Harrison
      '28049', // Hinds (Jackson)
      '28051', // Holmes
      '28053', // Humphreys
      '28055', // Issaquena
      '28059', // Jackson
      '28061', // Jasper
      '28063', // Jefferson
      '28065', // Jefferson Davis
      '28067', // Jones
      '28069', // Kemper
      '28073', // Lamar
      '28075', // Lauderdale
      '28077', // Lawrence
      '28079', // Leake
      '28083', // Leflore
      '28085', // Lincoln
      '28087', // Lowndes
      '28089', // Madison
      '28091', // Marion
      '28097', // Montgomery
      '28099', // Neshoba
      '28101', // Newton
      '28103', // Noxubee
      '28105', // Oktibbeha
      '28109', // Pearl River
      '28111', // Perry
      '28113', // Pike
      '28119', // Quitman
      '28121', // Rankin
      '28123', // Scott
      '28125', // Sharkey
      '28127', // Simpson
      '28129', // Smith
      '28131', // Stone
      '28133', // Sunflower
      '28135', // Tallahatchie
      '28147', // Walthall
      '28149', // Warren (Vicksburg)
      '28151', // Washington
      '28153', // Wayne
      '28155', // Webster
      '28157', // Wilkinson
      '28159', // Winston
      '28163', // Yazoo
    ],
    adjacentTerritories: ['ms-north', 'al-south'],
  },
};

/**
 * Get all region IDs
 */
export const getAllRegionIds = () => Object.keys(EASTERN_THEATRE_REGIONS);

/**
 * Get region data by ID
 */
export const getRegionById = (id) => EASTERN_THEATRE_REGIONS[id];

/**
 * Get all regions for a specific state
 */
export const getRegionsByState = (stateAbbr) => {
  return Object.entries(EASTERN_THEATRE_REGIONS)
    .filter(([_, region]) => region.stateAbbr === stateAbbr)
    .map(([id, region]) => ({ id, ...region }));
};

/**
 * Get all unique states in the Eastern Theatre map
 */
export const getEasternTheatreStates = () => {
  const states = new Set();
  Object.values(EASTERN_THEATRE_REGIONS).forEach(region => {
    states.add(region.stateAbbr);
  });
  return Array.from(states).sort();
};

/**
 * Convert regions to territory format for campaign
 */
export const createEasternTheatreTerritories = () => {
  return Object.entries(EASTERN_THEATRE_REGIONS).map(([id, region]) => ({
    id,
    name: region.name,
    owner: region.owner,
    pointValue: region.pointValue,
    victoryPoints: region.pointValue,
    adjacentTerritories: region.adjacentTerritories,
    captureHistory: [],
    // County-specific data for rendering
    countyFips: region.counties,
    stateAbbr: region.stateAbbr,
  }));
};

/**
 * Calculate initial VP totals
 */
export const calculateInitialVP = () => {
  let usaVP = 0;
  let csaVP = 0;
  let neutralVP = 0;

  Object.values(EASTERN_THEATRE_REGIONS).forEach(region => {
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
