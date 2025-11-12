// Territory definitions for War of Rights Campaign Tracker
// Simplified map of Civil War theater focusing on Maryland, Virginia, Pennsylvania, West Virginia

export const INITIAL_TERRITORIES = [
  {
    id: 'maryland-antietam',
    name: 'Antietam (MD)',
    mapName: 'Antietam',
    owner: 'NEUTRAL',
    victoryPoints: 15,
    isCapital: false,
    coordinates: {
      type: 'polygon',
      data: 'M 300,180 L 380,180 L 380,240 L 300,240 Z'
    },
    labelPosition: { x: 340, y: 210 },
    adjacentTerritories: ['harpers-ferry', 'south-mountain', 'virginia-north']
  },
  {
    id: 'harpers-ferry',
    name: "Harper's Ferry (WV)",
    mapName: 'Harpers Ferry',
    owner: 'NEUTRAL',
    victoryPoints: 20,
    isCapital: false,
    coordinates: {
      type: 'polygon',
      data: 'M 260,240 L 320,240 L 320,300 L 260,300 Z'
    },
    labelPosition: { x: 290, y: 270 },
    adjacentTerritories: ['maryland-antietam', 'virginia-north', 'virginia-shenandoah']
  },
  {
    id: 'south-mountain',
    name: 'South Mountain (MD)',
    mapName: 'South Mountain',
    owner: 'NEUTRAL',
    victoryPoints: 10,
    isCapital: false,
    coordinates: {
      type: 'polygon',
      data: 'M 380,140 L 450,140 L 450,200 L 380,200 Z'
    },
    labelPosition: { x: 415, y: 170 },
    adjacentTerritories: ['maryland-antietam', 'pennsylvania-gettysburg']
  },
  {
    id: 'pennsylvania-gettysburg',
    name: 'Gettysburg (PA)',
    mapName: 'Drill Camp',
    owner: 'USA',
    victoryPoints: 25,
    isCapital: false,
    coordinates: {
      type: 'polygon',
      data: 'M 380,80 L 480,80 L 480,160 L 380,160 Z'
    },
    labelPosition: { x: 430, y: 120 },
    adjacentTerritories: ['south-mountain']
  },
  {
    id: 'virginia-north',
    name: 'Northern Virginia',
    mapName: 'Drill Camp',
    owner: 'CSA',
    victoryPoints: 15,
    isCapital: false,
    coordinates: {
      type: 'polygon',
      data: 'M 260,300 L 380,300 L 380,380 L 260,380 Z'
    },
    labelPosition: { x: 320, y: 340 },
    adjacentTerritories: ['harpers-ferry', 'maryland-antietam', 'virginia-richmond', 'virginia-shenandoah']
  },
  {
    id: 'virginia-shenandoah',
    name: 'Shenandoah Valley (VA)',
    mapName: 'Drill Camp',
    owner: 'CSA',
    victoryPoints: 15,
    isCapital: false,
    coordinates: {
      type: 'polygon',
      data: 'M 200,280 L 280,280 L 280,360 L 200,360 Z'
    },
    labelPosition: { x: 240, y: 320 },
    adjacentTerritories: ['harpers-ferry', 'virginia-north', 'virginia-richmond']
  },
  {
    id: 'virginia-richmond',
    name: 'Richmond (VA)',
    mapName: 'Drill Camp',
    owner: 'CSA',
    victoryPoints: 30,
    coordinates: {
      type: 'polygon',
      data: 'M 280,360 L 400,360 L 400,440 L 280,440 Z'
    },
    labelPosition: { x: 340, y: 400 },
    adjacentTerritories: ['virginia-north', 'virginia-shenandoah']
  },
  {
    id: 'washington-dc',
    name: 'Washington D.C.',
    mapName: 'Drill Camp',
    owner: 'USA',
    victoryPoints: 30,
    coordinates: {
      type: 'polygon',
      data: 'M 340,240 L 400,240 L 400,280 L 340,280 Z'
    },
    labelPosition: { x: 370, y: 260 },
    adjacentTerritories: ['maryland-antietam', 'virginia-north']
  }
];

// Map-to-Territory mapping based on War of Rights maps
export const MAP_TERRITORY_MAPPING = {
  // Antietam maps -> Maryland
  "East Woods Skirmish": "maryland-antietam",
  "Hooker's Push": "maryland-antietam",
  "Hagerstown Turnpike": "maryland-antietam",
  "Miller's Cornfield": "maryland-antietam",
  "East Woods": "maryland-antietam",
  "Nicodemus Hill": "maryland-antietam",
  "Bloody Lane": "maryland-antietam",
  "Pry Ford": "maryland-antietam",
  "Pry Grist Mill": "maryland-antietam",
  "Pry House": "maryland-antietam",
  "West Woods": "maryland-antietam",
  "Dunker Church": "maryland-antietam",
  "Burnside's Bridge": "maryland-antietam",
  "Cooke's Countercharge": "maryland-antietam",
  "Otto and Sherrick Farms": "maryland-antietam",
  "Roulette Lane": "maryland-antietam",
  "Piper Farm": "maryland-antietam",
  "Hill's Counterattack": "maryland-antietam",
  
  // Harpers Ferry maps
  "Maryland Heights": "harpers-ferry",
  "River Crossing": "harpers-ferry",
  "Downtown": "harpers-ferry",
  "School House Ridge": "harpers-ferry",
  "Bolivar Heights Camp": "harpers-ferry",
  "High Street": "harpers-ferry",
  "Shenandoah Street": "harpers-ferry",
  "Harpers Ferry Graveyard": "harpers-ferry",
  "Washington Street": "harpers-ferry",
  "Bolivar Heights Redoubt": "harpers-ferry",
  
  // South Mountain maps
  "Garland's Stand": "south-mountain",
  "Cox's Push": "south-mountain",
  "Hatch's Attack": "south-mountain",
  "Anderson's Counterattack": "south-mountain",
  "Reno's Fall": "south-mountain",
  "Colquitt's Defense": "south-mountain",
  
  // Drill Camp maps (generic - can be used for any territory)
  "Alexander Farm": "virginia-north",
  "Crossroads": "virginia-north",
  "Smith Field": "virginia-north",
  "Crecy's Cornfield": "virginia-shenandoah",
  "Crossley Creek": "virginia-shenandoah",
  "Larsen Homestead": "virginia-richmond",
  "South Woodlot": "virginia-richmond",
  "Flemming's Meadow": "pennsylvania-gettysburg",
  "Wagon Road": "pennsylvania-gettysburg",
  "Union Camp": "washington-dc",
  "Pat's Turnpike": "virginia-north",
  "Stefan's Lot": "virginia-shenandoah",
  "Confederate Encampment": "virginia-richmond"
};

// Helper function to get territory ID from map name
export const getTerritoryForMap = (mapName) => {
  return MAP_TERRITORY_MAPPING[mapName] || null;
};

// All available War of Rights maps
export const ALL_MAPS = [
  // Antietam
  "East Woods Skirmish", "Hooker's Push", "Hagerstown Turnpike",
  "Miller's Cornfield", "East Woods", "Nicodemus Hill",
  "Bloody Lane", "Pry Ford", "Pry Grist Mill", "Pry House",
  "West Woods", "Dunker Church", "Burnside's Bridge",
  "Cooke's Countercharge", "Otto and Sherrick Farms",
  "Roulette Lane", "Piper Farm", "Hill's Counterattack",
  // Harpers Ferry
  "Maryland Heights", "River Crossing", "Downtown",
  "School House Ridge", "Bolivar Heights Camp", "High Street",
  "Shenandoah Street", "Harpers Ferry Graveyard", "Washington Street",
  "Bolivar Heights Redoubt",
  // South Mountain
  "Garland's Stand", "Cox's Push", "Hatch's Attack",
  "Anderson's Counterattack", "Reno's Fall", "Colquitt's Defense",
  // Drill Camp
  "Alexander Farm", "Crossroads", "Smith Field",
  "Crecy's Cornfield", "Crossley Creek", "Larsen Homestead",
  "South Woodlot", "Flemming's Meadow", "Wagon Road",
  "Union Camp", "Pat's Turnpike", "Stefan's Lot",
  "Confederate Encampment"
].sort();