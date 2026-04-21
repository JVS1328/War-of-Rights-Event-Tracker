import { hexKey, neighborKeys } from '../utils/hexMath';

export const BOARD_WIDTH = 70;
export const BOARD_HEIGHT = 90;

export const TERRAIN = {
  FIELD: 'field',
  FOREST: 'forest',
  RIVER: 'river',
  WATER: 'water'
};

export const MARKER_KIND = {
  CITY: 'city',
  FORT: 'fort',
  STATION: 'station',
  CAPITAL: 'capital'
};

const CITIES = [
  // CSA capitals (2 VP each)
  { id: 'richmond',    name: 'Richmond',     kind: 'capital', owner: 'CSA', q: 48, r: 54 },
  { id: 'wilmington',  name: 'Wilmington',   kind: 'capital', owner: 'CSA', q: 54, r: 66 },
  { id: 'atlanta',     name: 'Atlanta',      kind: 'capital', owner: 'CSA', q: 30, r: 72 },

  // USA capitals
  { id: 'washington',  name: 'Washington',   kind: 'capital', owner: 'USA', q: 48, r: 44 },
  { id: 'new-york',    name: 'New York',     kind: 'capital', owner: 'USA', q: 58, r: 30 },
  { id: 'cleveland',   name: 'Cleveland',    kind: 'capital', owner: 'USA', q: 22, r: 28 },

  // USA cities
  { id: 'detroit',     name: 'Detroit',      kind: 'city',    owner: 'USA', q: 14, r: 20 },
  { id: 'buffalo',     name: 'Buffalo',      kind: 'city',    owner: 'USA', q: 42, r: 22 },
  { id: 'pittsburgh',  name: 'Pittsburgh',   kind: 'city',    owner: 'USA', q: 36, r: 34 },
  { id: 'philadelphia',name: 'Philadelphia', kind: 'city',    owner: 'USA', q: 54, r: 36 },
  { id: 'baltimore',   name: 'Baltimore',    kind: 'city',    owner: 'USA', q: 50, r: 40 },
  { id: 'harrisburg',  name: 'Harrisburg',   kind: 'city',    owner: 'USA', q: 46, r: 32 },
  { id: 'columbus',    name: 'Columbus',     kind: 'city',    owner: 'USA', q: 22, r: 36 },
  { id: 'cincinnati',  name: 'Cincinnati',   kind: 'city',    owner: 'USA', q: 18, r: 42 },
  { id: 'wheeling',    name: 'Wheeling',     kind: 'city',    owner: 'USA', q: 30, r: 36 },
  { id: 'lansing',     name: 'Lansing',      kind: 'city',    owner: 'USA', q: 10, r: 18 },
  { id: 'toledo',      name: 'Toledo',       kind: 'city',    owner: 'USA', q: 16, r: 24 },
  { id: 'albany',      name: 'Albany',       kind: 'city',    owner: 'USA', q: 60, r: 22 },
  { id: 'atlantic-city', name: 'Atlantic City', kind: 'city', owner: 'USA', q: 60, r: 38 },

  // CSA cities
  { id: 'charleston-wv', name: 'Charleston',  kind: 'city',    owner: 'CSA', q: 28, r: 44 },
  { id: 'lexington',   name: 'Lexington',     kind: 'city',    owner: 'CSA', q: 18, r: 52 },
  { id: 'fredericksburg', name: 'Fredericksburg', kind: 'city', owner: 'CSA', q: 50, r: 50 },
  { id: 'norfolk',     name: 'Norfolk',       kind: 'city',    owner: 'CSA', q: 54, r: 58 },
  { id: 'charleston-sc', name: 'Charleston',  kind: 'city',    owner: 'CSA', q: 44, r: 76 },
  { id: 'savannah',    name: 'Savannah',      kind: 'city',    owner: 'CSA', q: 40, r: 82 },
  { id: 'memphis',     name: 'Memphis',       kind: 'city',    owner: 'CSA', q: 8,  r: 62 },
  { id: 'nashville',   name: 'Nashville',     kind: 'city',    owner: 'CSA', q: 14, r: 58 },
  { id: 'chattanooga', name: 'Chattanooga',   kind: 'city',    owner: 'CSA', q: 22, r: 62 },
  { id: 'birmingham',  name: 'Birmingham',    kind: 'city',    owner: 'CSA', q: 22, r: 68 },
  { id: 'montgomery',  name: 'Montgomery',    kind: 'city',    owner: 'CSA', q: 26, r: 76 },

  // Forts
  { id: 'fort-mchenry',  name: 'Fort McHenry',    kind: 'fort', owner: 'USA', q: 52, r: 40 },
  { id: 'fort-monroe',   name: 'Fort Monroe',     kind: 'fort', owner: 'USA', q: 52, r: 56 },
  { id: 'harpers-ferry', name: "Harper's Ferry",  kind: 'fort', owner: 'CSA', q: 42, r: 46 },
  { id: 'fort-sumter',   name: 'Fort Sumter',     kind: 'fort', owner: 'CSA', q: 46, r: 78 },
  { id: 'antietam',      name: 'Antietam',        kind: 'fort', owner: 'USA', q: 44, r: 42 },
  { id: 'gettysburg',    name: 'Gettysburg',      kind: 'fort', owner: 'USA', q: 46, r: 36 },

  // Rail stations
  { id: 'st-waterloo',   name: 'Waterloo Station',    kind: 'station', owner: 'USA', q: 34, r: 28 },
  { id: 'st-alleghany',  name: 'Alleghany Station',   kind: 'station', owner: 'USA', q: 26, r: 34 },
  { id: 'st-johnstown',  name: 'Johnstown Station',   kind: 'station', owner: 'USA', q: 38, r: 30 },
  { id: 'st-reading',    name: 'Reading Station',     kind: 'station', owner: 'USA', q: 50, r: 34 },
  { id: 'st-newark',     name: 'Newark Station',      kind: 'station', owner: 'USA', q: 56, r: 32 },
  { id: 'st-manassas',   name: 'Manassas Station',    kind: 'station', owner: 'CSA', q: 46, r: 50 },
  { id: 'st-petersburg', name: 'Petersburg Station',  kind: 'station', owner: 'CSA', q: 46, r: 58 },
  { id: 'st-lynchburg',  name: 'Lynchburg Station',   kind: 'station', owner: 'CSA', q: 36, r: 56 },
  { id: 'st-raleigh',    name: 'Raleigh Station',     kind: 'station', owner: 'CSA', q: 44, r: 64 },
  { id: 'st-columbia',   name: 'Columbia Station',    kind: 'station', owner: 'CSA', q: 38, r: 72 },
  { id: 'st-knoxville',  name: 'Knoxville Station',   kind: 'station', owner: 'CSA', q: 20, r: 56 },
  { id: 'st-dalton',     name: 'Dalton Station',      kind: 'station', owner: 'CSA', q: 26, r: 66 },
  { id: 'st-macon',      name: 'Macon Station',       kind: 'station', owner: 'CSA', q: 34, r: 78 }
];

const RAIL_CHAIN = (ids) => {
  const pairs = [];
  for (let i = 0; i < ids.length - 1; i++) pairs.push([ids[i], ids[i + 1]]);
  return pairs;
};

const RAIL_LINES = [
  RAIL_CHAIN(['detroit', 'toledo', 'cleveland', 'buffalo', 'albany', 'new-york']),
  RAIL_CHAIN(['cleveland', 'pittsburgh', 'st-johnstown', 'harrisburg', 'st-reading', 'philadelphia']),
  RAIL_CHAIN(['philadelphia', 'st-newark', 'new-york']),
  RAIL_CHAIN(['harrisburg', 'baltimore', 'washington']),
  RAIL_CHAIN(['baltimore', 'atlantic-city']),
  RAIL_CHAIN(['cincinnati', 'columbus', 'wheeling', 'st-alleghany', 'pittsburgh']),
  RAIL_CHAIN(['washington', 'st-manassas', 'fredericksburg', 'richmond']),
  RAIL_CHAIN(['richmond', 'st-petersburg', 'norfolk']),
  RAIL_CHAIN(['st-petersburg', 'st-raleigh', 'wilmington']),
  RAIL_CHAIN(['st-raleigh', 'st-columbia', 'charleston-sc', 'savannah']),
  RAIL_CHAIN(['st-columbia', 'atlanta', 'st-macon', 'savannah']),
  RAIL_CHAIN(['atlanta', 'st-dalton', 'chattanooga', 'nashville']),
  RAIL_CHAIN(['nashville', 'st-knoxville', 'st-lynchburg', 'richmond']),
  RAIL_CHAIN(['nashville', 'memphis']),
  RAIL_CHAIN(['atlanta', 'birmingham', 'montgomery']),
  RAIL_CHAIN(['lexington', 'charleston-wv', 'st-alleghany']),
  RAIL_CHAIN(['lansing', 'detroit'])
].flat();

const FOREST_CENTERS = [
  { q: 8,  r: 30, radius: 3 }, { q: 28, r: 28, radius: 4 }, { q: 38, r: 24, radius: 3 },
  { q: 56, r: 20, radius: 3 }, { q: 52, r: 28, radius: 2 }, { q: 20, r: 44, radius: 3 },
  { q: 34, r: 42, radius: 3 }, { q: 42, r: 38, radius: 2 }, { q: 40, r: 52, radius: 4 },
  { q: 30, r: 58, radius: 5 }, { q: 16, r: 66, radius: 4 }, { q: 26, r: 70, radius: 3 },
  { q: 38, r: 66, radius: 3 }, { q: 46, r: 70, radius: 3 }, { q: 12, r: 50, radius: 3 },
  { q: 50, r: 22, radius: 2 }, { q: 24, r: 50, radius: 2 }, { q: 48, r: 60, radius: 2 }
];

const RIVER_PATHS = [
  [[30, 34], [28, 38], [26, 42], [24, 46], [22, 50], [20, 54], [18, 58], [16, 62], [14, 66], [12, 70]],
  [[42, 46], [44, 50], [46, 54], [48, 58], [50, 62]],
  [[50, 40], [52, 44], [54, 48], [56, 52]]
];

const WATER_EAST = [];
for (let r = 18; r < BOARD_HEIGHT; r++) {
  const coastQ = 58 + Math.floor((r - 18) / 8);
  for (let q = coastQ + 2; q < BOARD_WIDTH; q++) {
    if (q >= 0 && q < BOARD_WIDTH) WATER_EAST.push([q, r]);
  }
}

const distHex = (a, b) => {
  const as = -a[0] - a[1], bs = -b[0] - b[1];
  return (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(as - bs)) / 2;
};

const buildHexMap = () => {
  const hexes = {};
  for (let q = 0; q < BOARD_WIDTH; q++) {
    for (let r = 0; r < BOARD_HEIGHT; r++) {
      hexes[hexKey(q, r)] = { terrain: TERRAIN.FIELD };
    }
  }
  for (const [q, r] of WATER_EAST) {
    const k = hexKey(q, r);
    if (hexes[k]) hexes[k].terrain = TERRAIN.WATER;
  }
  for (const { q: cq, r: cr, radius } of FOREST_CENTERS) {
    for (let q = 0; q < BOARD_WIDTH; q++) {
      for (let r = 0; r < BOARD_HEIGHT; r++) {
        if (distHex([q, r], [cq, cr]) <= radius) {
          const k = hexKey(q, r);
          if (hexes[k] && hexes[k].terrain === TERRAIN.FIELD) {
            hexes[k].terrain = TERRAIN.FOREST;
          }
        }
      }
    }
  }
  for (const path of RIVER_PATHS) {
    for (const [q, r] of path) {
      const k = hexKey(q, r);
      if (hexes[k] && hexes[k].terrain !== TERRAIN.WATER) {
        hexes[k].terrain = TERRAIN.RIVER;
      }
    }
  }
  return hexes;
};

const buildRailSet = () => {
  const set = new Set();
  for (const [a, b] of RAIL_LINES) {
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    set.add(key);
  }
  return Array.from(set).map(k => {
    const [from, to] = k.split('|');
    return { from, to };
  });
};

export const createDefaultBoard = () => {
  return {
    width: BOARD_WIDTH,
    height: BOARD_HEIGHT,
    hexes: buildHexMap(),
    cities: CITIES.map(c => ({
      ...c,
      hexKey: hexKey(c.q, c.r),
      garrison: 0
    })),
    rails: buildRailSet(),
    capitals: {
      USA: ['washington', 'new-york', 'cleveland'],
      CSA: ['richmond', 'wilmington', 'atlanta']
    }
  };
};

export const getCityByHex = (board, hexK) =>
  board.cities.find(c => c.hexKey === hexK) || null;

export const getCityById = (board, id) =>
  board.cities.find(c => c.id === id) || null;

export const isRailConnected = (board, aHex, bHex) => {
  const aCity = getCityByHex(board, aHex);
  const bCity = getCityByHex(board, bHex);
  if (!aCity || !bCity) return false;
  return board.rails.some(
    r => (r.from === aCity.id && r.to === bCity.id) ||
         (r.from === bCity.id && r.to === aCity.id)
  );
};

export const hexHasEmbarkableMarker = (board, hexK) => {
  const city = getCityByHex(board, hexK);
  return !!city; // cities, forts, stations, capitals all work per rules
};

export const friendlyCityHexes = (board, side) =>
  board.cities.filter(c => c.owner === side).map(c => c.hexKey);

export const neighborsOnBoard = (board, q, r) => {
  return neighborKeys(q, r).filter(k => board.hexes[k]);
};
