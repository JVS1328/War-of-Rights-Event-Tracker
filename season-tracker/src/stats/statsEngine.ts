import type { RosterEntry, Scoreboard, Team, TeamCasualties } from './types';
import type { RegimentAssignmentMap } from './StatsRepository';
import { extractRegimentTag, matchPlayerToRegimentList } from './regimentMatcher';
import type { RegimentListEntry } from './regimentMatcher';
import { avgTicketCost } from './labels';

export interface FormationCounts {
  in_form: number;
  skirm: number;
  oob: number;
}

export interface PlayerStatRow {
  /** Identity key: steamId when present, else the name. */
  key: string;
  steamId: string | null;
  name: string;
  regiment: string;
  team: Team;
  rounds: number;
  kills: number;
  deaths: number;
  kd: number;
  deathsInForm: number;
  deathsSkirm: number;
  deathsOob: number;
  killsInForm: number;
  killsSkirm: number;
  killsOob: number;
  /** Avg ticket cost per death (×Td); null when no stance deaths. */
  avgTd: number | null;
  /** Avg ticket value per kill (×Tk); null when no killfeed kills. */
  avgTk: number | null;
}

export type PlayerType = 'all' | 'inf' | 'arty';

export interface EngineOptions {
  regimentList?: RegimentListEntry[];
  /**
   * Restrict player-round aggregation by role: 'inf' counts only non-battery
   * rounds, 'arty' only battery rounds, 'all' (default) counts every round.
   * inf + arty reconcile to all.
   */
  type?: PlayerType;
  /**
   * Event-level regiment label remap (rename/merge). Applied as the final step
   * of regiment resolution: a resolved label is replaced by aliasMap[label],
   * followed transitively, so merged regiments roll into their target.
   */
  aliasMap?: Record<string, string>;
}

/**
 * Resolve a regiment label through the rename/merge alias map. Follows chains
 * (A→B→C) and stops deterministically on a cycle.
 */
export function applyAlias(label: string, aliasMap?: Record<string, string>): string {
  if (!aliasMap) return label;
  let cur = label;
  const seen = new Set<string>();
  while (aliasMap[cur] != null && !seen.has(cur)) {
    seen.add(cur);
    cur = aliasMap[cur];
  }
  return cur;
}

function kdOf(kills: number, deaths: number): number {
  return deaths > 0 ? kills / deaths : kills;
}

function emptyCasualties(): TeamCasualties {
  return { total: 0, inForm: 0, skirm: 0, oob: 0 };
}

/**
 * Resolve a regiment for one player: explicit assignment → list → name tag,
 * then through the rename/merge alias map.
 */
export function resolveFor(
  steamId: string | null,
  name: string,
  assignments: RegimentAssignmentMap,
  list?: RegimentListEntry[],
  aliasMap?: Record<string, string>,
): string {
  let base: string;
  if (steamId && assignments[steamId]) base = assignments[steamId];
  else {
    const m = list && list.length ? matchPlayerToRegimentList(name, list) : null;
    base = m ?? extractRegimentTag(name);
  }
  return applyAlias(base, aliasMap);
}

/** Find a player's roster entry within a scoreboard (steam id, else name+team). */
function findRoster(sb: Scoreboard, steamId: string | null, name: string, team: Team): RosterEntry | undefined {
  if (steamId) {
    const byId = sb.roster.find((r) => r.steamId === steamId);
    if (byId) return byId;
  }
  const lower = name.toLowerCase();
  return sb.roster.find((r) => r.team === team && r.name.toLowerCase() === lower);
}

function isBattery(entry: RosterEntry | undefined): boolean {
  return !!entry?.regiment && /batter/i.test(entry.regiment);
}

/** Parse "HH:MM:SS" → seconds since midnight, or null. */
function timeToSeconds(t: string | null): number | null {
  if (!t) return null;
  const m = t.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

export function roundDurationSeconds(sb: Scoreboard): number | null {
  const start = timeToSeconds(sb.meta.roundStartTime);
  const end = timeToSeconds(sb.meta.roundEndTime);
  if (start == null || end == null) return null;
  let d = end - start;
  if (d < 0) d += 86400; // crossed midnight
  return d;
}

/** killfeed kills bucketed by victim formation for one player in one scoreboard. */
function killFormInRound(sb: Scoreboard, key: string): FormationCounts {
  const f: FormationCounts = { in_form: 0, skirm: 0, oob: 0 };
  for (const k of sb.kills) {
    if ((k.killerSteamId ?? k.killer) === key && k.victimFormation) f[k.victimFormation] += 1;
  }
  return f;
}

/** Per-player aggregate across the supplied scoreboards. */
export function computePlayerLeaderboard(
  scoreboards: Scoreboard[],
  assignments: RegimentAssignmentMap,
  options: EngineOptions = {},
): PlayerStatRow[] {
  const type: PlayerType = options.type ?? 'all';
  const acc = new Map<string, PlayerStatRow>();

  for (const sb of scoreboards) {
    for (const p of sb.players) {
      // A player-round is artillery when their roster entry sits in a battery.
      const batteryRound = isBattery(findRoster(sb, p.steamId, p.name, p.team));
      if (type === 'inf' && batteryRound) continue;
      if (type === 'arty' && !batteryRound) continue;

      const key = p.steamId ?? p.name;
      let row = acc.get(key);
      if (!row) {
        row = {
          key,
          steamId: p.steamId,
          name: p.name,
          regiment: '',
          team: p.team,
          rounds: 0,
          kills: 0,
          deaths: 0,
          kd: 0,
          deathsInForm: 0,
          deathsSkirm: 0,
          deathsOob: 0,
          killsInForm: 0,
          killsSkirm: 0,
          killsOob: 0,
          avgTd: null,
          avgTk: null,
        };
        acc.set(key, row);
      }
      row.name = p.name;
      row.team = p.team;
      row.rounds += 1;
      row.kills += p.kills;
      row.deaths += p.deaths;
      row.deathsInForm += p.deathsInForm;
      row.deathsSkirm += p.deathsSkirm;
      row.deathsOob += p.deathsOob;
      // Kills-by-formation only from this (role-matching) round.
      const kf = killFormInRound(sb, key);
      row.killsInForm += kf.in_form;
      row.killsSkirm += kf.skirm;
      row.killsOob += kf.oob;
    }
  }

  const rows = [...acc.values()];
  for (const r of rows) {
    r.regiment = resolveFor(r.steamId, r.name, assignments, options.regimentList, options.aliasMap);
    r.kd = kdOf(r.kills, r.deaths);
    r.avgTd = avgTicketCost(r.deathsInForm, r.deathsSkirm, r.deathsOob);
    r.avgTk = avgTicketCost(r.killsInForm, r.killsSkirm, r.killsOob);
  }
  rows.sort((a, b) => b.kills - a.kills);
  return rows;
}

// ── Officers ──────────────────────────────────────────────────────────────

export interface OfficerStatRow {
  key: string;
  name: string;
  team: Team;
  battery: boolean;
  rounds: number;
  commanded: number;
  unitKills: number;
  unitDeaths: number;
  unitKd: number;
  wins: number;
  losses: number;
  draws: number;
  winrate: number;
}

export function computeOfficerLeaderboard(
  scoreboards: Scoreboard[],
  _assignments: RegimentAssignmentMap,
): OfficerStatRow[] {
  const acc = new Map<string, OfficerStatRow>();

  for (const sb of scoreboards) {
    const playerKD = (steamId: string | null, name: string, team: Team) => {
      const p = sb.players.find((x) =>
        steamId ? x.steamId === steamId : x.team === team && x.name.toLowerCase() === name.toLowerCase(),
      );
      return p ? { kills: p.kills, deaths: p.deaths } : { kills: 0, deaths: 0 };
    };

    for (const off of sb.officers) {
      const key = `${off.name}::${off.battery ? 1 : 0}`;
      let row = acc.get(key);
      if (!row) {
        row = {
          key,
          name: off.name,
          team: off.team,
          battery: off.battery,
          rounds: 0,
          commanded: 0,
          unitKills: 0,
          unitDeaths: 0,
          unitKd: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          winrate: 0,
        };
        acc.set(key, row);
      }
      row.rounds += 1;
      row.commanded += off.commanded;

      // Unit members from the roster (same team + regiment + company).
      const lead = findRoster(sb, null, off.name, off.team);
      let unitKills = 0;
      let unitDeaths = 0;
      if (lead?.regiment && lead.company) {
        const members = sb.roster.filter(
          (r) => r.team === off.team && r.regiment === lead.regiment && r.company === lead.company,
        );
        for (const m of members) {
          const kd = playerKD(m.steamId, m.name, m.team);
          unitKills += kd.kills;
          unitDeaths += kd.deaths;
        }
      } else {
        const kd = playerKD(null, off.name, off.team); // fallback: own row
        unitKills += kd.kills;
        unitDeaths += kd.deaths;
      }
      row.unitKills += unitKills;
      row.unitDeaths += unitDeaths;

      if (sb.meta.winner === off.team) row.wins += 1;
      else if (sb.meta.winner) row.losses += 1;
      else row.draws += 1;
    }
  }

  const rows = [...acc.values()];
  for (const r of rows) {
    r.unitKd = kdOf(r.unitKills, r.unitDeaths);
    const decided = r.wins + r.losses;
    r.winrate = decided > 0 ? r.wins / decided : 0;
  }
  rows.sort((a, b) => b.unitKills - a.unitKills);
  return rows;
}

// ── Rounds, overview, maps ──────────────────────────────────────────────────

export interface RoundSummary {
  sourceFilename: string;
  recordedAt: string | null;
  map: string;
  mode: string;
  area: string | null;
  winner: Team | null;
  durationSeconds: number | null;
  players: number;
  usaKills: number;
  csaKills: number;
  usaCasualties: number;
  csaCasualties: number;
  popPeak: number | null;
}

export function computeRounds(scoreboards: Scoreboard[]): RoundSummary[] {
  const rounds = scoreboards.map((sb): RoundSummary => {
    let usaKills = 0;
    let csaKills = 0;
    for (const p of sb.players) {
      if (p.team === 'USA') usaKills += p.kills;
      else csaKills += p.kills;
    }
    return {
      sourceFilename: sb.sourceFilename,
      recordedAt: sb.recordedAt,
      map: sb.meta.map,
      mode: sb.meta.mode,
      area: sb.meta.area,
      winner: sb.meta.winner,
      durationSeconds: roundDurationSeconds(sb),
      players: sb.players.length,
      usaKills,
      csaKills,
      usaCasualties: sb.meta.casualties.USA.total,
      csaCasualties: sb.meta.casualties.CSA.total,
      popPeak: sb.meta.popRoundPeak ?? sb.meta.popRoundMax,
    };
  });
  rounds.sort((a, b) => (b.recordedAt ?? '').localeCompare(a.recordedAt ?? ''));
  return rounds;
}

export interface Overview {
  totalRounds: number;
  usaWins: number;
  csaWins: number;
  draws: number;
  usaKills: number;
  csaKills: number;
  totalKills: number;
  usaCasualties: number;
  csaCasualties: number;
  distinctPlayers: number;
  distinctRegiments: number;
  /** Mean of per-round peak population across rounds that reported it. */
  avgPeakPop: number | null;
}

export function computeOverview(
  scoreboards: Scoreboard[],
  assignments: RegimentAssignmentMap = {},
  options: EngineOptions = {},
): Overview {
  let usaWins = 0;
  let csaWins = 0;
  let draws = 0;
  let usaKills = 0;
  let csaKills = 0;
  let usaCasualties = 0;
  let csaCasualties = 0;
  let peakPopTotal = 0;
  let peakPopCount = 0;
  const players = new Set<string>();

  for (const sb of scoreboards) {
    if (sb.meta.winner === 'USA') usaWins += 1;
    else if (sb.meta.winner === 'CSA') csaWins += 1;
    else draws += 1;
    for (const p of sb.players) {
      players.add(p.steamId ?? p.name);
      if (p.team === 'USA') usaKills += p.kills;
      else csaKills += p.kills;
    }
    usaCasualties += sb.meta.casualties.USA.total;
    csaCasualties += sb.meta.casualties.CSA.total;
    const pk = sb.meta.popRoundPeak ?? sb.meta.popRoundMax;
    if (pk != null) {
      peakPopTotal += pk;
      peakPopCount += 1;
    }
  }

  const regiments = new Set(
    computePlayerLeaderboard(scoreboards, assignments, options).map((p) => p.regiment),
  );

  return {
    totalRounds: scoreboards.length,
    usaWins,
    csaWins,
    draws,
    usaKills,
    csaKills,
    totalKills: usaKills + csaKills,
    usaCasualties,
    csaCasualties,
    distinctPlayers: players.size,
    distinctRegiments: regiments.size,
    avgPeakPop: peakPopCount > 0 ? Math.round(peakPopTotal / peakPopCount) : null,
  };
}

export interface TrackerMapEntry {
  plays: number;
  usaWins: number;
  csaWins: number;
  totalCasualties: number;
  usaCasualties: number;
  csaCasualties: number;
  avgLossesUsa: number;
  avgLossesCsa: number;
  avgFormationUsa: FormationCounts;
  avgFormationCsa: FormationCounts;
  hasFormation: boolean;
  avgMoraleUsa?: string | null;
  avgMoraleCsa?: string | null;
  hasMorale?: boolean;
}

export interface TrackerMapStats {
  overall: {
    totalRounds: number;
    usaWins: number;
    csaWins: number;
    attackerWins: number;
    defenderWins: number;
    usaCasualties: number;
    csaCasualties: number;
    totalCasualties: number;
    usaFormation: FormationCounts;
    csaFormation: FormationCounts;
    formationTotal: FormationCounts;
    hasFormation: boolean;
  };
  byMap: Record<string, TrackerMapEntry>;
}

export interface MapStatRow {
  map: string;
  rounds: number;
  usaWins: number;
  csaWins: number;
  draws: number;
  usaKills: number;
  csaKills: number;
  usaCasualties: number;
  csaCasualties: number;
  usaFormation: FormationCounts;
  csaFormation: FormationCounts;
  avgDurationSeconds: number | null;
  modes: { mode: string; area: string | null; rounds: number }[];
}

export function computeMapBreakdown(scoreboards: Scoreboard[]): MapStatRow[] {
  const byMap = new Map<string, MapStatRow & { _durTotal: number; _durCount: number; _modes: Map<string, number> }>();
  for (const sb of scoreboards) {
    const map = sb.meta.map || 'Unknown';
    let r = byMap.get(map);
    if (!r) {
      r = {
        map,
        rounds: 0,
        usaWins: 0,
        csaWins: 0,
        draws: 0,
        usaKills: 0,
        csaKills: 0,
        usaCasualties: 0,
        csaCasualties: 0,
        usaFormation: { in_form: 0, skirm: 0, oob: 0 },
        csaFormation: { in_form: 0, skirm: 0, oob: 0 },
        avgDurationSeconds: null,
        modes: [],
        _durTotal: 0,
        _durCount: 0,
        _modes: new Map(),
      };
      byMap.set(map, r);
    }
    r.rounds += 1;
    if (sb.meta.winner === 'USA') r.usaWins += 1;
    else if (sb.meta.winner === 'CSA') r.csaWins += 1;
    else r.draws += 1;
    for (const p of sb.players) {
      if (p.team === 'USA') r.usaKills += p.kills;
      else r.csaKills += p.kills;
    }
    const uc = sb.meta.casualties.USA;
    r.usaCasualties += uc.total;
    r.usaFormation.in_form += uc.inForm;
    r.usaFormation.skirm += uc.skirm;
    r.usaFormation.oob += uc.oob;
    const cc = sb.meta.casualties.CSA;
    r.csaCasualties += cc.total;
    r.csaFormation.in_form += cc.inForm;
    r.csaFormation.skirm += cc.skirm;
    r.csaFormation.oob += cc.oob;
    const dur = roundDurationSeconds(sb);
    if (dur != null) {
      r._durTotal += dur;
      r._durCount += 1;
    }
    const modeKey = `${sb.meta.mode}|${sb.meta.area ?? ''}`;
    r._modes.set(modeKey, (r._modes.get(modeKey) ?? 0) + 1);
  }

  const rows = [...byMap.values()].map((r) => {
    r.avgDurationSeconds = r._durCount > 0 ? Math.round(r._durTotal / r._durCount) : null;
    r.modes = [...r._modes.entries()].map(([k, rounds]) => {
      const [mode, area] = k.split('|');
      return { mode, area: area || null, rounds };
    });
    return r as MapStatRow;
  });
  rows.sort((a, b) => b.rounds - a.rounds);
  return rows;
}

// ── Player detail ────────────────────────────────────────────────────────────

export interface PlayerRoundRow {
  sourceFilename: string;
  recordedAt: string | null;
  map: string;
  area: string | null;
  team: Team;
  kills: number;
  deaths: number;
  deathsInForm: number;
  deathsSkirm: number;
  deathsOob: number;
  killsInForm: number;
  killsSkirm: number;
  killsOob: number;
  avgTd: number | null;
  avgTk: number | null;
}

export interface PlayerDetail {
  key: string;
  steamId: string | null;
  name: string;
  /** Other in-game names this player used across rounds, most-recent first. */
  aliases: string[];
  regiment: string;
  isArtillery: boolean;
  rounds: number;
  kills: number;
  deaths: number;
  kd: number;
  deathsInForm: number;
  deathsSkirm: number;
  deathsOob: number;
  killsInForm: number;
  killsSkirm: number;
  killsOob: number;
  avgTd: number | null;
  avgTk: number | null;
  killsByCause: Record<string, number>;
  deathsByCause: Record<string, number>;
  perRound: PlayerRoundRow[];
}

function isSamePlayer(targetKey: string, steamId: string | null, name: string | null): boolean {
  if (steamId && steamId === targetKey) return true;
  return !steamId && name === targetKey;
}

export function computePlayerDetail(
  scoreboards: Scoreboard[],
  key: string,
  assignments: RegimentAssignmentMap,
  options: EngineOptions = {},
): PlayerDetail | null {
  const detail: PlayerDetail = {
    key,
    steamId: null,
    name: '',
    aliases: [],
    regiment: '',
    isArtillery: false,
    rounds: 0,
    kills: 0,
    deaths: 0,
    kd: 0,
    deathsInForm: 0,
    deathsSkirm: 0,
    deathsOob: 0,
    killsInForm: 0,
    killsSkirm: 0,
    killsOob: 0,
    avgTd: null,
    avgTk: null,
    killsByCause: {},
    deathsByCause: {},
    perRound: [],
  };
  const type = options.type ?? 'all';
  let found = false;
  // Names used across rounds, in chronological (oldest→newest) order of appearance.
  const nameOrder: string[] = [];

  for (const sb of scoreboards) {
    const p = sb.players.find((x) => (x.steamId ?? x.name) === key);
    if (!p) continue;
    const batteryRound = isBattery(findRoster(sb, p.steamId, p.name, p.team));
    if (type === 'inf' && batteryRound) continue;
    if (type === 'arty' && !batteryRound) continue;

    found = true;
    detail.steamId = p.steamId;
    detail.name = p.name;
    nameOrder.push(p.name);
    if (batteryRound) detail.isArtillery = true;
    detail.rounds += 1;
    detail.kills += p.kills;
    detail.deaths += p.deaths;
    detail.deathsInForm += p.deathsInForm;
    detail.deathsSkirm += p.deathsSkirm;
    detail.deathsOob += p.deathsOob;

    // This round's killfeed for the player (causes + kill formations).
    let kIf = 0;
    let kSk = 0;
    let kOob = 0;
    for (const kill of sb.kills) {
      if (isSamePlayer(key, kill.killerSteamId, kill.killer)) {
        detail.killsByCause[kill.cause] = (detail.killsByCause[kill.cause] ?? 0) + 1;
        if (kill.victimFormation === 'in_form') kIf += 1;
        else if (kill.victimFormation === 'skirm') kSk += 1;
        else if (kill.victimFormation === 'oob') kOob += 1;
      }
      if (isSamePlayer(key, kill.victimSteamId, kill.victim)) {
        detail.deathsByCause[kill.cause] = (detail.deathsByCause[kill.cause] ?? 0) + 1;
      }
    }
    detail.killsInForm += kIf;
    detail.killsSkirm += kSk;
    detail.killsOob += kOob;

    detail.perRound.push({
      sourceFilename: sb.sourceFilename,
      recordedAt: sb.recordedAt,
      map: sb.meta.map,
      area: sb.meta.area,
      team: p.team,
      kills: p.kills,
      deaths: p.deaths,
      deathsInForm: p.deathsInForm,
      deathsSkirm: p.deathsSkirm,
      deathsOob: p.deathsOob,
      killsInForm: kIf,
      killsSkirm: kSk,
      killsOob: kOob,
      avgTd: avgTicketCost(p.deathsInForm, p.deathsSkirm, p.deathsOob),
      avgTk: avgTicketCost(kIf, kSk, kOob),
    });
  }

  if (!found) return null;
  // Aliases: distinct prior names (excluding the current/newest one), most-recent first.
  const seenNames = new Set<string>([detail.name]);
  for (let i = nameOrder.length - 1; i >= 0; i--) {
    const n = nameOrder[i];
    if (seenNames.has(n)) continue;
    seenNames.add(n);
    detail.aliases.push(n);
  }
  detail.kd = kdOf(detail.kills, detail.deaths);
  detail.regiment = resolveFor(detail.steamId, detail.name, assignments, options.regimentList, options.aliasMap);
  detail.avgTd = avgTicketCost(detail.deathsInForm, detail.deathsSkirm, detail.deathsOob);
  detail.avgTk = avgTicketCost(detail.killsInForm, detail.killsSkirm, detail.killsOob);
  return detail;
}

// ── Regiments ────────────────────────────────────────────────────────────────

export interface RegimentRoundRow {
  sourceFilename: string;
  recordedAt: string | null;
  map: string;
  area: string | null;
  players: number;
  kills: number;
  deaths: number;
  casualtiesByFormation: FormationCounts;
  avgTd: number | null;
  avgTk: number | null;
}

export interface RegimentStatRow {
  regiment: string;
  /** Distinct players seen across all rounds. */
  players: number;
  /** Average distinct players fielded per round (sum of per-round head counts ÷ rounds). */
  avgPlayers: number;
  rounds: number;
  kills: number;
  deaths: number;
  kd: number;
  casualtiesByFormation: FormationCounts;
  killsByFormation: FormationCounts;
  avgTd: number | null;
  avgTk: number | null;
  /** Deaths the regiment suffered, bucketed by weapon/cause (victim resolves here). */
  casualtiesByCause: Record<string, number>;
  /** Kills the regiment inflicted, bucketed by weapon/cause (killer resolves here). */
  killsByCause: Record<string, number>;
  topPlayers: PlayerStatRow[];
  roundFilenames: string[];
  perRound: RegimentRoundRow[];
}

export function computeRegimentBreakdown(
  scoreboards: Scoreboard[],
  assignments: RegimentAssignmentMap,
  options: EngineOptions = {},
): RegimentStatRow[] {
  const players = computePlayerLeaderboard(scoreboards, assignments, options);

  const byReg = new Map<
    string,
    RegimentStatRow & { _roundSet: Set<string>; _perRound: Map<string, RegimentRoundRow> }
  >();
  const ensure = (regiment: string) => {
    let r = byReg.get(regiment);
    if (!r) {
      r = {
        regiment,
        players: 0,
        avgPlayers: 0,
        rounds: 0,
        kills: 0,
        deaths: 0,
        kd: 0,
        casualtiesByFormation: { in_form: 0, skirm: 0, oob: 0 },
        killsByFormation: { in_form: 0, skirm: 0, oob: 0 },
        avgTd: null,
        avgTk: null,
        casualtiesByCause: {},
        killsByCause: {},
        topPlayers: [],
        roundFilenames: [],
        perRound: [],
        _roundSet: new Set<string>(),
        _perRound: new Map<string, RegimentRoundRow>(),
      };
      byReg.set(regiment, r);
    }
    return r;
  };

  for (const p of players) {
    const r = ensure(p.regiment);
    r.players += 1;
    r.kills += p.kills;
    r.deaths += p.deaths;
    r.casualtiesByFormation.in_form += p.deathsInForm;
    r.casualtiesByFormation.skirm += p.deathsSkirm;
    r.casualtiesByFormation.oob += p.deathsOob;
    r.killsByFormation.in_form += p.killsInForm;
    r.killsByFormation.skirm += p.killsSkirm;
    r.killsByFormation.oob += p.killsOob;
    r.topPlayers.push(p);
  }

  // Per-round, per-regiment rollup + rounds + casualties by cause (killfeed).
  for (const sb of scoreboards) {
    for (const p of sb.players) {
      const regiment = resolveFor(p.steamId, p.name, assignments, options.regimentList, options.aliasMap);
      const r = ensure(regiment);
      r._roundSet.add(sb.sourceFilename);
      let rr = r._perRound.get(sb.sourceFilename);
      if (!rr) {
        rr = {
          sourceFilename: sb.sourceFilename,
          recordedAt: sb.recordedAt,
          map: sb.meta.map,
          area: sb.meta.area,
          players: 0,
          kills: 0,
          deaths: 0,
          casualtiesByFormation: { in_form: 0, skirm: 0, oob: 0 },
          avgTd: null,
          avgTk: null,
        };
        r._perRound.set(sb.sourceFilename, rr);
      }
      rr.players += 1;
      rr.kills += p.kills;
      rr.deaths += p.deaths;
      rr.casualtiesByFormation.in_form += p.deathsInForm;
      rr.casualtiesByFormation.skirm += p.deathsSkirm;
      rr.casualtiesByFormation.oob += p.deathsOob;
      const kf = killFormInRound(sb, p.steamId ?? p.name);
      // Accumulate kill-formation into the round row via a transient tally.
      (rr as RegimentRoundRow & { _kf?: FormationCounts })._kf ??= { in_form: 0, skirm: 0, oob: 0 };
      const tally = (rr as RegimentRoundRow & { _kf: FormationCounts })._kf;
      tally.in_form += kf.in_form;
      tally.skirm += kf.skirm;
      tally.oob += kf.oob;
    }
    for (const kill of sb.kills) {
      const cause = kill.cause || 'Unknown';
      // Suffered: the victim's regiment took this casualty.
      const victimReg = resolveFor(kill.victimSteamId, kill.victim, assignments, options.regimentList, options.aliasMap);
      const vr = ensure(victimReg);
      vr.casualtiesByCause[cause] = (vr.casualtiesByCause[cause] ?? 0) + 1;
      // Inflicted: the killer's regiment dealt this kill (skip environment deaths).
      if (kill.killer) {
        const killerReg = resolveFor(kill.killerSteamId, kill.killer, assignments, options.regimentList, options.aliasMap);
        const kr = ensure(killerReg);
        kr.killsByCause[cause] = (kr.killsByCause[cause] ?? 0) + 1;
      }
    }
  }

  const rows = [...byReg.values()].map((r) => {
    r.kd = kdOf(r.kills, r.deaths);
    r.topPlayers.sort((a, b) => b.kills - a.kills);
    r.roundFilenames = [...r._roundSet];
    r.rounds = r._roundSet.size;
    // Average head count per round, weighted only over rounds the regiment fielded.
    const fielded = [...r._perRound.values()].reduce((n, rr) => n + rr.players, 0);
    r.avgPlayers = r.rounds > 0 ? fielded / r.rounds : 0;
    r.avgTd = avgTicketCost(
      r.casualtiesByFormation.in_form,
      r.casualtiesByFormation.skirm,
      r.casualtiesByFormation.oob,
    );
    r.avgTk = avgTicketCost(r.killsByFormation.in_form, r.killsByFormation.skirm, r.killsByFormation.oob);
    r.perRound = [...r._perRound.values()]
      .map((rr) => {
        const kf = (rr as RegimentRoundRow & { _kf?: FormationCounts })._kf ?? { in_form: 0, skirm: 0, oob: 0 };
        rr.avgTd = avgTicketCost(
          rr.casualtiesByFormation.in_form,
          rr.casualtiesByFormation.skirm,
          rr.casualtiesByFormation.oob,
        );
        rr.avgTk = avgTicketCost(kf.in_form, kf.skirm, kf.oob);
        return rr;
      })
      .sort((a, b) => (b.recordedAt ?? '').localeCompare(a.recordedAt ?? ''));
    return r as RegimentStatRow;
  });
  // Drop killfeed-only labels: a name seen only as a killer/victim (never on a
  // roster) produces a row with no players. There are no 0-player regiments.
  const fielded = rows.filter((r) => r.players > 0);
  fielded.sort((a, b) => b.kills - a.kills);
  return fielded;
}

// ── Combat totals (meta-level weapons & casualties) ─────────────────────────

export interface CombatTotals {
  casualties: Record<Team, TeamCasualties>;
  deathsByWeapon: Record<Team, Record<string, number>>;
}

export function computeCombatTotals(scoreboards: Scoreboard[]): CombatTotals {
  const casualties: Record<Team, TeamCasualties> = { USA: emptyCasualties(), CSA: emptyCasualties() };
  const deathsByWeapon: Record<Team, Record<string, number>> = { USA: {}, CSA: {} };

  for (const sb of scoreboards) {
    for (const team of ['USA', 'CSA'] as Team[]) {
      const c = sb.meta.casualties[team];
      casualties[team].total += c.total;
      casualties[team].inForm += c.inForm;
      casualties[team].skirm += c.skirm;
      casualties[team].oob += c.oob;
      for (const [weapon, count] of Object.entries(sb.meta.deathsByWeapon[team])) {
        deathsByWeapon[team][weapon] = (deathsByWeapon[team][weapon] ?? 0) + count;
      }
    }
  }
  return { casualties, deathsByWeapon };
}
