// Single source of truth for War of Rights map names, areas, game modes, and
// the in-game attacking side. Names here are the *canonical* spellings exactly
// as they appear on the in-game scoreboard (taken from the map mode JSON
// definitions). Everything else in season-tracker (dropdowns, area grouping,
// attacker/defender splits, map difficulty biases) derives from this file so
// the lists can never drift apart again.
//
// Older/saved data may carry legacy or misspelled names (e.g. "Burnside's
// Bridge", "Colquitt's Defense"). `canonicalMapName()` maps any such variant
// onto its canonical name so historical rounds bucket correctly.

export type MapMode = 'skirmish' | 'conquest' | 'contention';

// 'USA' / 'CSA' = that side is the in-game attacker. null = no attacker concept
// (Conquest/Contention both start at 100 tickets, neither side attacks).
export type Attacker = 'USA' | 'CSA' | null;

export interface MapDef {
  /** Canonical scoreboard name. */
  name: string;
  /** Area key, e.g. 'antietam'. */
  area: string;
  mode: MapMode;
  /** In-game attacking side, or null when the mode has no attacker. */
  attacker: Attacker;
}

// Antietam Skirmish maps. `attacker` derived from the DefendingTeam in
// Skirmish.json: a CSA-defended map means USA attacks, and vice-versa.
const ANTIETAM_SKIRMISH: Array<[string, Attacker]> = [
  ['East Woods Skirmish', 'USA'],
  ["Hooker's Push", 'USA'],
  ['Hagerstown Turnpike', 'USA'],
  ["Miller's Cornfield", 'CSA'],
  ['East Woods', 'CSA'],
  ['Nicodemus Hill', 'USA'],
  ['Bloody Lane', 'USA'],
  ['Pry Ford', 'USA'],
  ['Pry Grist Mill', 'USA'],
  ['Pry House', 'CSA'],
  ['West Woods', 'USA'],
  ['Dunker Church', 'USA'],
  ['Burnside Bridge', 'USA'],
  ["Cooke's Countercharge", 'CSA'],
  ['Otto & Sherrick Farm', 'USA'],
  ['Roulette Lane', 'CSA'],
  ['Piper Farm', 'USA'],
  ["Hill's Counterattack", 'CSA'],
];

// Conquest/Contention areas. Both modes share the same area names
// (Conquest.json / Contention.json) and we treat them identically, so each
// name appears once with no attacker.
const ANTIETAM_CONQUEST = [
  'Smokestacks', 'Forest Stream', 'Framing Fencelines',
  'Farmland', 'Limestone Bridge', 'Waterways',
];

const DRILL_CAMP_CONQUEST = [
  'Corn Crib', 'Orchards', 'Railroad Cut', 'Towering Trunks',
];

// Harpers Ferry Skirmish maps, confirmed from Skirmish.json (USA defends every
// map, so CSA is the attacker throughout).
const HARPERS_FERRY_SKIRMISH: Array<[string, Attacker]> = [
  ['Maryland Heights', 'CSA'],
  ['River Crossing', 'CSA'],
  ['Downtown', 'CSA'],
  ['School House Ridge', 'CSA'],
  ['High Street', 'CSA'],
  ['Bolivar Heights Camp', 'CSA'],
  ['Shenandoah Street', 'CSA'],
  ['Harpers Graveyard', 'CSA'],
  ['Bolivar Heights Redoubt', 'CSA'],
  ['Washington Street', 'CSA'],
];

const HARPERS_FERRY_CONQUEST = [
  'River Town', 'Outskirts', 'Overlook', 'Valley',
];

// South Mountain Skirmish maps, confirmed from Skirmish.json.
const SOUTH_MOUNTAIN_SKIRMISH: Array<[string, Attacker]> = [
  ["Garland's Stand", 'USA'],
  ["Cox's Push", 'USA'],
  ["Hatch's Attack", 'USA'],
  ["Anderson's Counterattack", 'CSA'],
  ["Reno's Fall", 'CSA'],
  ["Colquitt's Defence", 'USA'],
];

const SOUTH_MOUNTAIN_CONQUEST = [
  'Log Cabin', 'Wheat Fields', 'Rocky Slopes', 'Hilltop',
];

const DRILL_CAMP_SKIRMISH: Array<[string, Attacker]> = [
  ['Alexander Farm', 'USA'],
  ['Crossroads', 'USA'],
  ['Smith Field', 'USA'],
  ["Crecy's Cornfield", 'CSA'],
  ['Crossley Creek', 'USA'],
  ['Larsen Homestead', 'CSA'],
  ['South Woodlot', 'CSA'],
  ["Flemming's Meadow", 'USA'],
  ['Wagon Road', 'USA'],
  ['Union Camp', 'CSA'],
  ["Pat's Turnpike", 'CSA'],
  ["Stefan's Lot", 'CSA'],
  ['Confederate Encampment', 'USA'],
];

const skirmish = (area: string, list: Array<[string, Attacker]>): MapDef[] =>
  list.map(([name, attacker]) => ({ name, area, mode: 'skirmish' as const, attacker }));

const conquest = (area: string, names: string[]): MapDef[] =>
  names.map((name) => ({ name, area, mode: 'conquest' as const, attacker: null }));

export const MAP_CATALOG: MapDef[] = [
  ...skirmish('antietam', ANTIETAM_SKIRMISH),
  ...conquest('antietam', ANTIETAM_CONQUEST),
  ...skirmish('harpers_ferry', HARPERS_FERRY_SKIRMISH),
  ...conquest('harpers_ferry', HARPERS_FERRY_CONQUEST),
  ...skirmish('south_mountain', SOUTH_MOUNTAIN_SKIRMISH),
  ...conquest('south_mountain', SOUTH_MOUNTAIN_CONQUEST),
  ...skirmish('drill_camp', DRILL_CAMP_SKIRMISH),
  ...conquest('drill_camp', DRILL_CAMP_CONQUEST),
];

// Legacy / misspelled names → canonical. Normalized-key matching (below) also
// catches punctuation/case/"&"-vs-"and" variants automatically; this table is
// for differences a normalized key can't bridge (extra words, dropped/added
// letters, alternate spellings).
export const MAP_NAME_ALIASES: Record<string, string> = {
  "Burnside's Bridge": 'Burnside Bridge',
  'Otto and Sherrick Farms': 'Otto & Sherrick Farm',
  // "Harper's Graveyard" resolves on its own via the normalized key (apostrophe
  // dropped → "harpers graveyard"); only the "Ferry" variant needs aliasing.
  'Harpers Ferry Graveyard': 'Harpers Graveyard',
  "Colquitt's Defense": "Colquitt's Defence",
  'Hagertown Turnpike': 'Hagerstown Turnpike',
};

// ── Derived lookups ──────────────────────────────────────────────────────────

const DEF_BY_NAME = new Map<string, MapDef>(MAP_CATALOG.map((d) => [d.name, d]));

/** Case/punctuation-insensitive key: lowercased, apostrophes dropped (so
 *  "Colquitt's" → "colquitts"), "&"→"and", other punctuation → space. */
const normalizeKey = (s: string): string =>
  s
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

// normalized key → canonical name, covering both canonical names and aliases.
const NORM_INDEX = new Map<string, string>();
for (const d of MAP_CATALOG) NORM_INDEX.set(normalizeKey(d.name), d.name);
for (const [src, tgt] of Object.entries(MAP_NAME_ALIASES)) NORM_INDEX.set(normalizeKey(src), tgt);

/**
 * Map any raw map name onto its canonical scoreboard spelling. Resolution
 * order: exact canonical → explicit alias → normalized-key match → unchanged.
 * Unknown names are returned trimmed but otherwise as-is so nothing is lost.
 */
export function canonicalMapName(raw: string | null | undefined): string {
  if (raw == null) return '';
  const name = String(raw).trim();
  if (!name) return '';
  if (DEF_BY_NAME.has(name)) return name;
  if (MAP_NAME_ALIASES[name]) return MAP_NAME_ALIASES[name];
  const byKey = NORM_INDEX.get(normalizeKey(name));
  return byKey ?? name;
}

/** Area key for a map (canonicalizing first), or null if unknown. */
export function areaOf(map: string): string | null {
  return DEF_BY_NAME.get(canonicalMapName(map))?.area ?? null;
}

/** In-game attacking side for a map, or null (unknown map, or no-attacker mode). */
export function mapAttacker(map: string): Attacker {
  return DEF_BY_NAME.get(canonicalMapName(map))?.attacker ?? null;
}

/** Whether a map has an attacker/defender concept (false for Conquest/Contention). */
export function hasAttacker(map: string): boolean {
  return mapAttacker(map) !== null;
}

/** Game mode for a map (canonicalizing first), or null if unknown. */
export function mapMode(map: string): MapMode | null {
  return DEF_BY_NAME.get(canonicalMapName(map))?.mode ?? null;
}

export function prettyArea(key: string): string {
  return key.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// area key → canonical names, in catalog order.
export const MAP_AREAS: Record<string, string[]> = (() => {
  const out: Record<string, string[]> = {};
  for (const d of MAP_CATALOG) (out[d.area] ||= []).push(d.name);
  return out;
})();

// All canonical map names, sorted (for dropdowns / random pickers).
export const ALL_MAPS: string[] = MAP_CATALOG.map((d) => d.name).sort();

// Canonical names where USA is the in-game attacker.
export const USA_ATTACK_MAPS = new Set<string>(
  MAP_CATALOG.filter((d) => d.attacker === 'USA').map((d) => d.name),
);
