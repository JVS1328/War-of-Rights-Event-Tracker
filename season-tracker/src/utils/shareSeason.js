import pako from 'pako';

// --- Defaults (must match SeasonTracker.jsx) ---

const DEFAULT_POINT_SYSTEM = {
  winLead: 4, winAssist: 2, lossLead: 0, lossAssist: 1,
  bonus2_0Lead: 0, bonus2_0Assist: 1,
  balancePoints: 0, balancePointsStyle: 'perNight',
};
const DEFAULT_ELO_SYSTEM = {
  initialElo: 1500, kFactorStandard: 96, kFactorProvisional: 128,
  provisionalRounds: 10, sweepBonusMultiplier: 1.25, leadMultiplier: 2.0,
  sizeInfluence: 1.0, playoffMultiplier: 1.25,
};
const DEFAULT_ELO_BIAS = {
  lightAttacker: 15, heavyAttacker: 30, lightDefender: 15, heavyDefender: 30,
};
const DEFAULT_BALANCER = {
  teammateWeight: 1.0, avgDiffWeight: 1.0, regimentCountWeight: 0.75,
  rangeSimilarityWeight: 0.50, divisionOppositionWeight: 0, balanceOptionCount: 3,
};
const DEFAULT_MAP_BIASES = {
  "East Woods Skirmish": 2, "Hooker's Push": 2.5, "Hagerstown Turnpike": 1,
  "Miller's Cornfield": 1.5, "East Woods": 2.5, "Nicodemus Hill": 2.5,
  "Bloody Lane": 1.5, "Pry Ford": 2, "Pry Grist Mill": 1, "Pry House": 1.5,
  "West Woods": 1.5, "Dunker Church": 1.5, "Burnside Bridge": 2.5,
  "Cooke's Countercharge": 1.5, "Otto & Sherrick Farm": 1,
  "Roulette Lane": 1.5, "Piper Farm": 2, "Hill's Counterattack": 1,
  // Antietam Conquest/Contention areas (shared names; treated identically).
  "Smokestacks": 1.5, "Forest Stream": 1.5, "Framing Fencelines": 1.5,
  "Farmland": 1.5, "Limestone Bridge": 1.5, "Waterways": 1.5,
  "Maryland Heights": 1.5, "River Crossing": 2.5, "Downtown": 1,
  "School House Ridge": 1, "Bolivar Heights Camp": 1.5, "High Street": 1,
  "Shenandoah Street": 1.5, "Harpers Graveyard": 1, "Washington Street": 1,
  "Bolivar Heights Redoubt": 2,
  // Harpers Ferry Conquest/Contention areas (shared names; treated identically).
  "River Town": 1.5, "Outskirts": 1.5, "Overlook": 1.5, "Valley": 1.5,
  "Garland's Stand": 2.5, "Cox's Push": 2.5, "Hatch's Attack": 2,
  "Anderson's Counterattack": 1, "Reno's Fall": 1.5, "Colquitt's Defence": 2,
  // South Mountain Conquest/Contention areas (shared names; treated identically).
  "Log Cabin": 1.5, "Wheat Fields": 1.5, "Rocky Slopes": 1.5, "Hilltop": 1.5,
  "Alexander Farm": 2, "Crossroads": 0, "Smith Field": 1,
  "Crecy's Cornfield": 1.5, "Crossley Creek": 1, "Larsen Homestead": 1.5,
  "South Woodlot": 1.5, "Flemming's Meadow": 2, "Wagon Road": 2,
  "Union Camp": 1.5, "Pat's Turnpike": 1.5, "Stefan's Lot": 1,
  "Confederate Encampment": 2,
  // Drill Camp Conquest/Contention areas (shared names; treated identically).
  "Corn Crib": 1.5, "Orchards": 1.5, "Railroad Cut": 1.5, "Towering Trunks": 1.5,
};
const DEFAULT_PLAYOFF_CONFIG = {
  enabled: false, useDivisions: false, teamsPerDivision: 2, wildcardTeams: 0,
  roundFormats: { wildcard: 1, divisional: 1, conference: 2, finals: 2 },
};

// --- Delta helpers: only store values that differ from defaults ---

const deltaEncode = (obj, defaults) => {
  if (!obj) return undefined;
  const d = {};
  for (const [k, v] of Object.entries(obj)) {
    if (JSON.stringify(v) !== JSON.stringify(defaults[k])) d[k] = v;
  }
  return Object.keys(d).length ? d : undefined;
};

const deltaDecode = (delta, defaults) => {
  if (!delta) return { ...defaults };
  return { ...defaults, ...delta };
};

// --- Unit-index helpers ---

const indexArr = (arr, units) => arr?.map(n => units.indexOf(n)) ?? [];
const expandArr = (arr, units) => arr?.map(i => units[i]) ?? [];

const indexObj = (obj, units) => {
  if (!obj) return undefined;
  const r = {};
  for (const [name, val] of Object.entries(obj)) {
    const i = units.indexOf(name);
    if (i >= 0) r[i] = val;
  }
  return Object.keys(r).length ? r : undefined;
};

const expandObj = (obj, units) => {
  if (!obj) return {};
  const r = {};
  for (const [i, val] of Object.entries(obj)) r[units[i]] = val;
  return r;
};

const compactCasualties = (wc, units) => {
  if (!wc) return undefined;
  const r = {};
  for (const [side, rounds] of Object.entries(wc)) {
    const sr = {};
    for (const [round, byUnit] of Object.entries(rounds)) {
      const rc = indexObj(byUnit, units);
      if (rc) sr[round] = rc;
    }
    if (Object.keys(sr).length) r[side] = sr;
  }
  return Object.keys(r).length ? r : undefined;
};

const expandCasualties = (wc, units) => {
  const base = { USA: { r1: {}, r2: {} }, CSA: { r1: {}, r2: {} } };
  if (!wc) return base;
  for (const [side, rounds] of Object.entries(wc)) {
    if (!base[side]) base[side] = {};
    for (const [round, byIdx] of Object.entries(rounds)) {
      base[side][round] = expandObj(byIdx, units);
    }
  }
  return base;
};

// --- Payload creation (compact) ---

/** Collect unique map names used across all weeks into an index array. */
const buildMapIndex = (weeks) => {
  const s = new Set();
  for (const wk of weeks) {
    if (wk.round1Map) s.add(wk.round1Map);
    if (wk.round2Map) s.add(wk.round2Map);
  }
  return [...s];
};

/**
 * Week tuple format (positional array — no keys):
 * [0] teamA (int[])     [1] teamB (int[])
 * [2] r1Winner (0/1/2)  [3] r2Winner (0/1/2)   — 0=null, 1="A", 2="B"
 * [4] r1Map (int/-1)    [5] r2Map (int/-1)      — index into map array
 * [6] flags (bitmask)   — bit0=r1f, bit1=r2f, bit2=playoffs, bit3=singleRoundLeads
 * [7] leads ([la,lb,la1,lb1,la2,lb2]) — -1 for null, 0 if all null
 * [8] casualties ([c1a,c1b,c2a,c2b]) — 0 if all zero
 * [9] name (string)     — 0 if default "Week N"
 * [10] pc (object)      — 0 if empty (indexed unitPlayerCounts)
 * [11] wc (object)      — 0 if empty (indexed weeklyCasualties)
 * [12] rs ([r1Swaps, r2Swaps]) — 0 if no swaps (indexed roundSwaps)
 * Trailing 0s are stripped.
 */
const W_MAP = { A: 1, B: 2 };
const W_UNMAP = { 1: 'A', 2: 'B' };

const encodeWeek = (wk, i, u, m) => {
  const flags = (wk.round1Flipped ? 1 : 0)
    | (wk.round2Flipped ? 2 : 0)
    | (wk.isPlayoffs ? 4 : 0)
    | (wk.isSingleRoundLeads ? 8 : 0)
    | (wk.round1Draw ? 16 : 0)
    | (wk.round2Draw ? 32 : 0);

  const leads = [
    wk.leadA != null ? u.indexOf(wk.leadA) : -1,
    wk.leadB != null ? u.indexOf(wk.leadB) : -1,
    wk.leadA_r1 != null ? u.indexOf(wk.leadA_r1) : -1,
    wk.leadB_r1 != null ? u.indexOf(wk.leadB_r1) : -1,
    wk.leadA_r2 != null ? u.indexOf(wk.leadA_r2) : -1,
    wk.leadB_r2 != null ? u.indexOf(wk.leadB_r2) : -1,
  ];
  const hasLeads = leads.some(l => l !== -1);

  const cas = [wk.r1CasualtiesA || 0, wk.r1CasualtiesB || 0,
               wk.r2CasualtiesA || 0, wk.r2CasualtiesB || 0];
  const hasCas = cas.some(c => c !== 0);

  const name = wk.name !== `Week ${i + 1}` ? wk.name : 0;
  const pc = indexObj(wk.unitPlayerCounts, u) || 0;
  const wc = compactCasualties(wk.weeklyCasualties, u) || 0;
  const r1s = indexArr(wk.roundSwaps?.r1, u);
  const r2s = indexArr(wk.roundSwaps?.r2, u);
  const rs = (r1s.length || r2s.length) ? [r1s, r2s] : 0;

  const tuple = [
    indexArr(wk.teamA, u),
    indexArr(wk.teamB, u),
    W_MAP[wk.round1Winner] || 0,
    W_MAP[wk.round2Winner] || 0,
    wk.round1Map ? m.indexOf(wk.round1Map) : -1,
    wk.round2Map ? m.indexOf(wk.round2Map) : -1,
    flags,
    hasLeads ? leads : 0,
    hasCas ? cas : 0,
    name,
    pc,
    wc,
    rs,
  ];

  // Strip trailing 0s
  while (tuple.length > 2 && tuple[tuple.length - 1] === 0) tuple.pop();
  return tuple;
};

export const createSharePayload = (state) => {
  const u = state.units;
  const m = buildMapIndex(state.weeks);

  const w = state.weeks.map((wk, i) => encodeWeek(wk, i, u, m));

  const p = { v: 1, u, w };
  if (m.length) p.m = m;
  // Omit default team names
  if (state.teamNames?.A !== 'USA' || state.teamNames?.B !== 'CSA') p.tn = state.teamNames;

  // Delta-encode all config objects — only non-default values included
  const nt = indexArr(state.nonTokenUnits, u);
  if (nt.length) p.nt = nt;
  const ps = deltaEncode(state.pointSystem, DEFAULT_POINT_SYSTEM);
  if (ps) p.ps = ps;
  const es = deltaEncode(state.eloSystem, DEFAULT_ELO_SYSTEM);
  if (es) p.es = es;
  const eb = deltaEncode(state.eloBiasPercentages, DEFAULT_ELO_BIAS);
  if (eb) p.eb = eb;
  const mb = deltaEncode(state.mapBiases, DEFAULT_MAP_BIASES);
  if (mb) p.mb = mb;
  const bs = deltaEncode(state.balancerSettings, DEFAULT_BALANCER);
  if (bs) p.bs = bs;
  const pf = deltaEncode(state.playoffConfig, DEFAULT_PLAYOFF_CONFIG);
  if (pf) p.pf = pf;
  if (state.mapCooldown) p.mc = state.mapCooldown;
  const ma = indexObj(state.manualAdjustments, u);
  if (ma) p.ma = ma;
  const pc = indexObj(state.unitPlayerCounts, u);
  if (pc) p.pc = pc;
  if (state.divisions?.length) {
    p.dv = state.divisions.map(d => ({ n: d.name, u: indexArr(d.units, u) }));
  }

  return p;
};

// --- Payload decoding (expand back to full state shape) ---

const decodeWeek = (t, i, u, m) => {
  const flags = t[6] || 0;
  const leads = t[7] || [-1, -1, -1, -1, -1, -1];
  const cas = t[8] || [0, 0, 0, 0];
  const L = (idx) => leads[idx] >= 0 ? u[leads[idx]] : null;
  const mapIdx = (v) => v >= 0 ? m[v] : null;

  return {
    id: Date.now() + i,
    name: t[9] || `Week ${i + 1}`,
    teamA: expandArr(t[0], u),
    teamB: expandArr(t[1], u),
    round1Winner: W_UNMAP[t[2]] || null,
    round2Winner: W_UNMAP[t[3]] || null,
    round1Map: mapIdx(t[4] ?? -1),
    round2Map: mapIdx(t[5] ?? -1),
    round1Flipped: !!(flags & 1),
    round2Flipped: !!(flags & 2),
    isPlayoffs: !!(flags & 4),
    isSingleRoundLeads: !!(flags & 8),
    round1Draw: !!(flags & 16),
    round2Draw: !!(flags & 32),
    leadA: L(0), leadB: L(1),
    leadA_r1: L(2), leadB_r1: L(3),
    leadA_r2: L(4), leadB_r2: L(5),
    r1CasualtiesA: cas[0], r1CasualtiesB: cas[1],
    r2CasualtiesA: cas[2], r2CasualtiesB: cas[3],
    unitPlayerCounts: expandObj(t[10], u),
    weeklyCasualties: expandCasualties(t[11], u),
    roundSwaps: t[12] ? { r1: expandArr(t[12][0], u), r2: expandArr(t[12][1], u) } : { r1: [], r2: [] },
  };
};

const expandPayload = (p) => {
  const u = p.u;
  const m = p.m || [];

  const weeks = p.w.map((t, i) => decodeWeek(t, i, u, m));

  return {
    units: u,
    nonTokenUnits: expandArr(p.nt, u),
    weeks,
    teamNames: p.tn || { A: 'USA', B: 'CSA' },
    pointSystem: deltaDecode(p.ps, DEFAULT_POINT_SYSTEM),
    manualAdjustments: expandObj(p.ma, u),
    eloSystem: deltaDecode(p.es, DEFAULT_ELO_SYSTEM),
    eloBiasPercentages: deltaDecode(p.eb, DEFAULT_ELO_BIAS),
    unitPlayerCounts: expandObj(p.pc, u),
    divisions: p.dv ? p.dv.map(d => ({ name: d.n, units: expandArr(d.u, u) })) : [],
    mapBiases: deltaDecode(p.mb, DEFAULT_MAP_BIASES),
    mapCooldown: p.mc || 0,
    playoffConfig: deltaDecode(p.pf, DEFAULT_PLAYOFF_CONFIG),
    balancerSettings: deltaDecode(p.bs, DEFAULT_BALANCER),
  };
};

// --- v2 payloads (plain JSON, discriminated by `t`) ------------------------
// v1 used a tuple-compacted season shape. v2 ships plain JSON for both seasons
// and full events; trades a little URL size for clarity and the ability to
// share an entire event tree (registry + every season). v1 decoding stays so
// old links still work.

export const createV2SeasonPayload = (flatLegacy) =>
  ({ v: 2, t: 'season', payload: flatLegacy });

export const createV2EventPayload = (event) =>
  ({ v: 2, t: 'event', event });

// Player-stats-only payload — a portable scoreboard/assignments bundle with no
// tracker/season data. Lets organizers share just the post-event player stats.
// `name` (the event name) is optional and only used to title the shared view.
export const createV2StatsPayload = (bundle, name) =>
  ({ v: 2, t: 'stats', bundle, ...(name ? { name } : {}) });

// Combined payload — the full event tree plus its player-stats bundle, so a
// single link carries everything (registry, all seasons, scoreboards, stats).
export const createV2FullPayload = (event, bundle) =>
  ({ v: 2, t: 'full', event, bundle });

// --- Encode / Decode (deflate + base64url) ---

export const encodeSharePayload = (payload) => {
  const json = JSON.stringify(payload);
  const compressed = pako.deflateRaw(json, { level: 9 });
  let binary = '';
  for (const byte of compressed) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

// Returns null on parse failure, or { kind: 'season', payload: <flat legacy> }
// for v1 / v2-season, or { kind: 'event', event: <Event> } for v2-event.
export const decodeSharePayload = (encoded) => {
  try {
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const json = pako.inflateRaw(bytes, { to: 'string' });
    const p = JSON.parse(json);
    if (!p?.v) return null;
    if (p.v === 1) return { kind: 'season', payload: expandPayload(p) };
    if (p.v === 2 && p.t === 'season') return { kind: 'season', payload: p.payload };
    if (p.v === 2 && p.t === 'event')  return { kind: 'event', event: p.event };
    if (p.v === 2 && p.t === 'stats')  return { kind: 'stats', bundle: p.bundle, name: p.name };
    if (p.v === 2 && p.t === 'full')   return { kind: 'full', event: p.event, bundle: p.bundle };
    return null;
  } catch {
    return null;
  }
};

// --- URL generation ---

export const generateShareUrl = (state) => {
  const encoded = encodeSharePayload(createV2SeasonPayload(state));
  return `${window.location.origin + window.location.pathname}#share=${encoded}`;
};

export const generateShortShareUrl = async (state) => {
  const payload = encodeSharePayload(createV2SeasonPayload(state));
  const res = await fetch('/api/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload }),
  });
  if (!res.ok) throw new Error('Share API unavailable');
  const { id } = await res.json();
  return `${window.location.origin + window.location.pathname}#s=${id}`;
};

export const generateEventShareUrl = (event) => {
  const encoded = encodeSharePayload(createV2EventPayload(event));
  return `${window.location.origin + window.location.pathname}#share=${encoded}`;
};

export const generateShortEventShareUrl = async (event) => {
  const payload = encodeSharePayload(createV2EventPayload(event));
  const res = await fetch('/api/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload }),
  });
  if (!res.ok) throw new Error('Share API unavailable');
  const { id } = await res.json();
  return `${window.location.origin + window.location.pathname}#s=${id}`;
};

export const generateStatsShareUrl = (bundle, name) => {
  const encoded = encodeSharePayload(createV2StatsPayload(bundle, name));
  return `${window.location.origin + window.location.pathname}#share=${encoded}`;
};

export const generateShortStatsShareUrl = async (bundle, name) => {
  const payload = encodeSharePayload(createV2StatsPayload(bundle, name));
  const res = await fetch('/api/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload }),
  });
  if (!res.ok) throw new Error('Share API unavailable');
  const { id } = await res.json();
  return `${window.location.origin + window.location.pathname}#s=${id}`;
};

export const generateFullShareUrl = (event, bundle) => {
  const encoded = encodeSharePayload(createV2FullPayload(event, bundle));
  return `${window.location.origin + window.location.pathname}#share=${encoded}`;
};

export const generateShortFullShareUrl = async (event, bundle) => {
  const payload = encodeSharePayload(createV2FullPayload(event, bundle));
  const res = await fetch('/api/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload }),
  });
  if (!res.ok) throw new Error('Share API unavailable');
  const { id } = await res.json();
  return `${window.location.origin + window.location.pathname}#s=${id}`;
};

export const fetchSharePayload = async (id) => {
  try {
    const res = await fetch(`/api/share?id=${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    const { payload } = await res.json();
    return decodeSharePayload(payload);
  } catch {
    return null;
  }
};

export const getShareFromUrl = () => {
  const hash = window.location.hash;
  if (hash.startsWith('#s=')) return { pending: true, id: hash.slice(3) };
  if (hash.startsWith('#share=')) return decodeSharePayload(hash.slice(7));
  return null;
};
