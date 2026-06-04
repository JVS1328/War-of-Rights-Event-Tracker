export const MAP_AREAS: Record<string, string[]> = {
  antietam: [
    "East Woods Skirmish", "Hooker's Push", "Hagerstown Turnpike",
    "Miller's Cornfield", "East Woods", "Nicodemus Hill",
    "Bloody Lane", "Pry Ford", "Pry Grist Mill", "Pry House",
    "West Woods", "Dunker Church", "Burnside's Bridge", "Burnside Bridge",
    "Cooke's Countercharge", "Otto and Sherrick Farms", "Otto & Sherrick Farm",
    "Roulette Lane", "Piper Farm", "Hill's Counterattack",
  ],
  harpers_ferry: [
    "Maryland Heights", "River Crossing", "Downtown",
    "School House Ridge", "Bolivar Heights Camp", "High Street",
    "Shenandoah Street", "Harpers Ferry Graveyard", "Harper's Graveyard",
    "Washington Street", "Bolivar Heights Redoubt",
  ],
  south_mountain: [
    "Garland's Stand", "Cox's Push", "Hatch's Attack",
    "Anderson's Counterattack", "Reno's Fall",
    "Colquitt's Defense", "Colquitt's Defence",
  ],
  drill_camp: [
    "Alexander Farm", "Crossroads", "Smith Field",
    "Crecy's Cornfield", "Crossley Creek", "Larsen Homestead",
    "South Woodlot", "Flemming's Meadow", "Wagon Road",
    "Union Camp", "Pat's Turnpike", "Stefan's Lot",
    "Confederate Encampment",
  ],
};

export const USA_ATTACK_MAPS = new Set([
  "East Woods Skirmish", "Nicodemus Hill", "Hooker's Push", "Bloody Lane",
  "Pry Ford", "Smith Field", "Alexander Farm", "Crossroads",
  "Wagon Road", "Hagertown Turnpike", "Pry Grist Mill", "Otto & Sherrick Farm",
  "Piper Farm", "West Woods", "Dunker Church", "Burnside Bridge",
  "Garland's Stand", "Cox's Push", "Hatch's Attack", "Colquitt's Defense",
  "Flemming's Meadow", "Crossley Creek", "Confederate Encampment",
]);

const reverse = new Map<string, string>();
for (const [area, maps] of Object.entries(MAP_AREAS)) {
  for (const m of maps) reverse.set(m, area);
}

export function areaOf(map: string): string | null {
  return reverse.get(map) ?? null;
}

export function prettyArea(key: string): string {
  return key.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
