// v2 schema for the season tracker: events contain seasons, with a unit
// registry at the event level. Single source of truth for defaults and
// migration from the legacy flat shape.

export const SCHEMA_VERSION = 2;

export const DEFAULT_TEAM_NAMES = { A: 'USA', B: 'CSA' };

export const DEFAULT_POINT_SYSTEM = {
  winLead: 4,
  winAssist: 2,
  lossLead: 0,
  lossAssist: 1,
  bonus2_0Lead: 0,
  bonus2_0Assist: 1,
  balancePoints: 0,
  balancePointsStyle: 'perNight',
};

export const DEFAULT_ELO_SYSTEM = {
  initialElo: 1500,
  kFactorStandard: 96,
  kFactorProvisional: 128,
  provisionalRounds: 10,
  sweepBonusMultiplier: 1.25,
  leadMultiplier: 2.0,
  sizeInfluence: 1.0,
  playoffMultiplier: 1.25,
};

export const DEFAULT_ELO_BIAS_PERCENTAGES = {
  lightAttacker: 15,
  heavyAttacker: 30,
  lightDefender: 15,
  heavyDefender: 30,
};

// New event-level Elo config introduced with v2. Defaults to zero map/unit
// weighting so freshly migrated data computes identical Elo to the legacy
// behavior until users opt in.
export const DEFAULT_ELO_CONFIG = {
  mapWeight: 0,
  unitWeight: 0,
  priorRounds: 10,
  carryAlpha: 0.5,
  mapStatsScope: 'event', // 'event' | 'global'
};

export const makeDefaultPlayoffConfig = () => ({
  enabled: false,
  useDivisions: false,
  teamsPerDivision: 2,
  wildcardTeams: 0,
  roundFormats: { wildcard: 1, divisional: 1, conference: 2, finals: 2 },
});

export const makeDefaultBalancerSettings = () => ({
  teammateWeight: 1.0,
  avgDiffWeight: 1.0,
  regimentCountWeight: 0.75,
  rangeSimilarityWeight: 0.50,
  divisionOppositionWeight: 0,
  balanceOptionCount: 3,
});

export const makeDefaultMapBiases = () => ({
  // ANTIETAM
  "East Woods Skirmish": 2, "Hooker's Push": 2.5, "Hagerstown Turnpike": 1,
  "Miller's Cornfield": 1.5, "East Woods": 2.5, "Nicodemus Hill": 2.5,
  "Bloody Lane": 1.5, "Pry Ford": 2, "Pry Grist Mill": 1, "Pry House": 1.5,
  "West Woods": 1.5, "Dunker Church": 1.5, "Burnside's Bridge": 2.5,
  "Cooke's Countercharge": 1.5, "Otto and Sherrick Farms": 1,
  "Roulette Lane": 1.5, "Piper Farm": 2, "Hill's Counterattack": 1,
  // HARPERS FERRY
  "Maryland Heights": 1.5, "River Crossing": 2.5, "Downtown": 1,
  "School House Ridge": 1, "Bolivar Heights Camp": 1.5, "High Street": 1,
  "Shenandoah Street": 1.5, "Harpers Ferry Graveyard": 1, "Washington Street": 1,
  "Bolivar Heights Redoubt": 2,
  // SOUTH MOUNTAIN
  "Garland's Stand": 2.5, "Cox's Push": 2.5, "Hatch's Attack": 2,
  "Anderson's Counterattack": 1, "Reno's Fall": 1.5, "Colquitt's Defense": 2,
  // DRILL CAMP
  "Alexander Farm": 2, "Crossroads": 0, "Smith Field": 1,
  "Crecy's Cornfield": 1.5, "Crossley Creek": 1, "Larsen Homestead": 1.5,
  "South Woodlot": 1.5, "Flemming's Meadow": 2, "Wagon Road": 2,
  "Union Camp": 1.5, "Pat's Turnpike": 1.5, "Stefan's Lot": 1,
  "Confederate Encampment": 2,
});

// --- ID + slug helpers -----------------------------------------------------

let _idCounter = 0;
const newId = (prefix) =>
  `${prefix}_${Date.now().toString(36)}_${(++_idCounter).toString(36)}`;

export const newEventId = () => newId('evt');
export const newSeasonId = () => newId('sea');

export const slugifyUnitName = (name) => {
  const base = String(name ?? '')
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'unit';
};

// Build a registry from a flat list of unit names. Collisions on slug get
// -2, -3 suffixes to keep ids unique within the event.
export const buildRegistryFromNames = (names, existing = {}) => {
  const registry = { ...existing };
  const existingByName = new Map();
  for (const [id, entry] of Object.entries(registry)) {
    if (entry?.name) existingByName.set(entry.name, id);
  }
  const usedIds = new Set(Object.keys(registry));

  for (const rawName of names) {
    const name = String(rawName ?? '').trim();
    if (!name) continue;
    if (existingByName.has(name)) continue;

    const base = slugifyUnitName(name);
    let id = base;
    let n = 2;
    while (usedIds.has(id)) {
      id = `${base}-${n++}`;
    }
    usedIds.add(id);
    existingByName.set(name, id);
    registry[id] = { name };
  }

  return registry;
};

export const findUnitIdByName = (registry, name) => {
  if (!registry || !name) return null;
  for (const [id, entry] of Object.entries(registry)) {
    if (entry?.name === name) return id;
  }
  return null;
};

// --- Default factories -----------------------------------------------------

export const makeDefaultSeason = (overrides = {}) => ({
  id: newSeasonId(),
  name: 'Season 1',
  units: [],
  nonTokenUnits: [],
  weeks: [],
  selectedWeek: null,
  teamNames: { ...DEFAULT_TEAM_NAMES },
  pointSystem: { ...DEFAULT_POINT_SYSTEM },
  manualAdjustments: {},
  unitPlayerCounts: {},
  divisions: [],
  mapCooldown: 0,
  playoffConfig: makeDefaultPlayoffConfig(),
  balancerSettings: makeDefaultBalancerSettings(),
  ...overrides,
});

export const makeDefaultEvent = (overrides = {}) => ({
  id: newEventId(),
  name: 'Default Event',
  unitRegistry: {},
  eloSystem: { ...DEFAULT_ELO_SYSTEM },
  eloConfig: { ...DEFAULT_ELO_CONFIG },
  // Phase 1 keeps these here unchanged; phase 2 removes them in favor of
  // the chronological replay engine.
  mapBiases: makeDefaultMapBiases(),
  eloBiasPercentages: { ...DEFAULT_ELO_BIAS_PERCENTAGES },
  seasons: [],
  ...overrides,
});

export const makeDefaultAppState = () => {
  const season = makeDefaultSeason();
  const event = makeDefaultEvent({ seasons: [season] });
  return {
    schemaVersion: SCHEMA_VERSION,
    activeEventId: event.id,
    activeSeasonId: season.id,
    events: [event],
  };
};

// --- Migration -------------------------------------------------------------

const migrateBalancerSettings = (saved) => {
  const defaults = makeDefaultBalancerSettings();
  if (!saved) return defaults;
  const merged = { ...defaults, ...saved };
  if (saved.gapWeight !== undefined && saved.regimentCountWeight === undefined) {
    merged.regimentCountWeight = saved.gapWeight;
  }
  if (saved.minDiffWeight !== undefined && saved.rangeSimilarityWeight === undefined) {
    merged.rangeSimilarityWeight = saved.minDiffWeight;
  }
  delete merged.gapWeight;
  delete merged.minDiffWeight;
  return merged;
};

// Stamp every week with a bias snapshot using the supplied fallbacks for any
// week missing them. Phase 2 removes the bias system entirely; for now this
// preserves the legacy "snapshot biases at week-record-time" behavior.
const stampWeeksWithBiases = (weeks, fallbackMapBiases, fallbackEloBiasPercentages) =>
  (weeks || []).map(week =>
    (week.mapBiases && week.eloBiasPercentages) ? week : {
      ...week,
      mapBiases: week.mapBiases || { ...fallbackMapBiases },
      eloBiasPercentages: week.eloBiasPercentages || { ...fallbackEloBiasPercentages },
    }
  );

// Wrap a legacy flat-shape state into a v2 app state with one event and one
// season. Used at load time, on file import, and on share import.
export const migrateLegacyFlatToV2 = (legacy, { eventName = 'Default Event', seasonName = 'Season 1' } = {}) => {
  const allNames = new Set();
  (legacy.units || []).forEach(n => n && allNames.add(n));
  (legacy.nonTokenUnits || []).forEach(n => n && allNames.add(n));
  (legacy.weeks || []).forEach(week => {
    (week.teamA || []).forEach(n => n && allNames.add(n));
    (week.teamB || []).forEach(n => n && allNames.add(n));
  });

  const unitRegistry = buildRegistryFromNames([...allNames]);

  const eventMapBiases = legacy.mapBiases
    ? { ...makeDefaultMapBiases(), ...legacy.mapBiases }
    : makeDefaultMapBiases();
  const eventEloBiasPercentages = { ...DEFAULT_ELO_BIAS_PERCENTAGES, ...(legacy.eloBiasPercentages || {}) };

  const season = makeDefaultSeason({
    name: seasonName,
    units: legacy.units || [],
    nonTokenUnits: legacy.nonTokenUnits || [],
    weeks: stampWeeksWithBiases(legacy.weeks || [], eventMapBiases, eventEloBiasPercentages),
    selectedWeek: legacy.selectedWeek ?? null,
    teamNames: legacy.teamNames || { ...DEFAULT_TEAM_NAMES },
    pointSystem: { ...DEFAULT_POINT_SYSTEM, ...(legacy.pointSystem || {}) },
    manualAdjustments: legacy.manualAdjustments || {},
    unitPlayerCounts: legacy.unitPlayerCounts || {},
    divisions: legacy.divisions || [],
    mapCooldown: legacy.mapCooldown || 0,
    playoffConfig: { ...makeDefaultPlayoffConfig(), ...(legacy.playoffConfig || {}) },
    balancerSettings: migrateBalancerSettings(legacy.balancerSettings),
  });

  const event = makeDefaultEvent({
    name: eventName,
    unitRegistry,
    eloSystem: { ...DEFAULT_ELO_SYSTEM, ...(legacy.eloSystem || {}) },
    mapBiases: eventMapBiases,
    eloBiasPercentages: eventEloBiasPercentages,
    seasons: [season],
  });

  return {
    schemaVersion: SCHEMA_VERSION,
    activeEventId: event.id,
    activeSeasonId: season.id,
    events: [event],
  };
};

// Entry point: detects v2 vs legacy and migrates as needed. `null` produces
// a fresh default app state.
export const migrateToV2 = (raw) => {
  if (!raw) return makeDefaultAppState();
  if (raw.schemaVersion === SCHEMA_VERSION && Array.isArray(raw.events)) return raw;
  return migrateLegacyFlatToV2(raw);
};

// --- Active accessors ------------------------------------------------------

export const getActiveEvent = (appState) =>
  appState?.events?.find(e => e.id === appState.activeEventId) ?? appState?.events?.[0] ?? null;

export const getActiveSeason = (appState) => {
  const event = getActiveEvent(appState);
  if (!event) return null;
  return event.seasons.find(s => s.id === appState.activeSeasonId) ?? event.seasons[0] ?? null;
};

export const updateActiveSeason = (appState, updater) => {
  const eventId = appState.activeEventId;
  const seasonId = appState.activeSeasonId;
  return {
    ...appState,
    events: appState.events.map(e =>
      e.id !== eventId ? e : {
        ...e,
        seasons: e.seasons.map(s => s.id !== seasonId ? s : updater(s)),
      }
    ),
  };
};

export const updateActiveEvent = (appState, updater) => {
  const eventId = appState.activeEventId;
  return {
    ...appState,
    events: appState.events.map(e => e.id !== eventId ? e : updater(e)),
  };
};

// Flatten the active event/season into the legacy shape. Used by code paths
// (share, export) that haven't been rewritten for v2 yet — phase 4.
export const flattenActiveToLegacy = (appState) => {
  const event = getActiveEvent(appState);
  const season = getActiveSeason(appState);
  if (!event || !season) return null;
  return {
    units: season.units,
    nonTokenUnits: season.nonTokenUnits,
    weeks: season.weeks,
    selectedWeek: season.selectedWeek,
    teamNames: season.teamNames,
    pointSystem: season.pointSystem,
    manualAdjustments: season.manualAdjustments,
    eloSystem: event.eloSystem,
    eloBiasPercentages: event.eloBiasPercentages,
    unitPlayerCounts: season.unitPlayerCounts,
    divisions: season.divisions,
    mapBiases: event.mapBiases,
    mapCooldown: season.mapCooldown,
    playoffConfig: season.playoffConfig,
    balancerSettings: season.balancerSettings,
  };
};
