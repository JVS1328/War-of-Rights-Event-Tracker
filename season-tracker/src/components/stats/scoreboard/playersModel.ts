// Pure grouping / kill-stance logic for the round drawer's Players tab.
//
// Ported from the PUBS dashboard scoreboard drawer and adapted to the
// season-tracker model: players carry no synthetic `id` (key = steamId ?? name),
// teams are 'USA'/'CSA' strings, and the killfeed uses `killer` (not
// `killerName`). All functions are pure so they can be unit-tested in isolation.
import type { ScoreboardPlayer, RosterEntry, Kill } from '../../../stats/types';

export type PlayerSort = 'unit' | 'name' | 'kills' | 'deaths' | 'kd';

export const playerKey = (p: { steamId: string | null; name: string }) => p.steamId ?? p.name;

export interface RosterIndex {
  bySteam: Map<string, RosterEntry>;
  byName: Map<string, RosterEntry>;
}

/** Match a player to their roster entry. Steam ID is authoritative; we fall
 *  back to name match only when steam_id is missing on the scoreboard row. */
export function buildRosterIndex(roster: RosterEntry[]): RosterIndex {
  const bySteam = new Map<string, RosterEntry>();
  const byName = new Map<string, RosterEntry>();
  for (const r of roster) {
    if (r.steamId) bySteam.set(r.steamId, r);
    byName.set(r.name.trim().toLowerCase(), r);
  }
  return { bySteam, byName };
}

export function rosterLookup(idx: RosterIndex, p: ScoreboardPlayer): RosterEntry | undefined {
  if (p.steamId && idx.bySteam.has(p.steamId)) return idx.bySteam.get(p.steamId);
  return idx.byName.get(p.name.trim().toLowerCase());
}

export interface KillStance {
  inForm: number;
  skirm: number;
  oob: number;
}
export const EMPTY_STANCE: KillStance = { inForm: 0, skirm: 0, oob: 0 };

export interface KillStanceIndex {
  bySteam: Map<string, KillStance>;
  byName: Map<string, KillStance>;
}

/** Tally the round's killfeed per killer, bucketed by the formation each victim
 *  died in. Keyed by killer steam_id (authoritative) with a name-only fallback
 *  for steamless killers. Feeds the offensive ×Tk metric. */
export function buildKillStanceIndex(kills: Kill[]): KillStanceIndex {
  const bySteam = new Map<string, KillStance>();
  const byName = new Map<string, KillStance>();
  const bump = (m: Map<string, KillStance>, key: string, formation: string | null) => {
    let s = m.get(key);
    if (!s) {
      s = { inForm: 0, skirm: 0, oob: 0 };
      m.set(key, s);
    }
    if (formation === 'in_form') s.inForm += 1;
    else if (formation === 'skirm') s.skirm += 1;
    else if (formation === 'oob') s.oob += 1;
  };
  for (const k of kills) {
    if (!k.killer) continue;
    if (k.killerSteamId) bump(bySteam, k.killerSteamId, k.victimFormation);
    else bump(byName, k.killer.trim().toLowerCase(), k.victimFormation);
  }
  return { bySteam, byName };
}

/** A player's kills bucketed by victim formation. Steam'd players match by
 *  steam only (no false name collisions); steamless players match by name. */
export function killStanceOf(p: ScoreboardPlayer, idx: KillStanceIndex): KillStance {
  if (p.steamId) return idx.bySteam.get(p.steamId) ?? EMPTY_STANCE;
  return idx.byName.get(p.name.trim().toLowerCase()) ?? EMPTY_STANCE;
}

/** cause → count for one player's round (killed-with weapons or died-to causes). */
export type CauseCounts = Record<string, number>;
const EMPTY_CAUSES: CauseCounts = {};

export interface CauseIndex {
  /** killer → weapons they got kills with, this round. */
  killedWithBySteam: Map<string, CauseCounts>;
  killedWithByName: Map<string, CauseCounts>;
  /** victim → causes they died to, this round (includes environment deaths). */
  diedToBySteam: Map<string, CauseCounts>;
  diedToByName: Map<string, CauseCounts>;
}

/** Tally the round's killfeed into per-player cause breakdowns: what each killer
 *  killed with, and what each victim died to. Steam id is authoritative with a
 *  name-only fallback for steamless players, mirroring the kill-stance index.
 *  "Died to" keeps killer-less environment deaths; "killed with" needs a killer. */
export function buildCauseIndex(kills: Kill[]): CauseIndex {
  const killedWithBySteam = new Map<string, CauseCounts>();
  const killedWithByName = new Map<string, CauseCounts>();
  const diedToBySteam = new Map<string, CauseCounts>();
  const diedToByName = new Map<string, CauseCounts>();
  const bump = (m: Map<string, CauseCounts>, key: string, cause: string) => {
    let c = m.get(key);
    if (!c) {
      c = {};
      m.set(key, c);
    }
    c[cause] = (c[cause] ?? 0) + 1;
  };
  for (const k of kills) {
    const cause = k.cause || 'unknown';
    if (k.killer) {
      if (k.killerSteamId) bump(killedWithBySteam, k.killerSteamId, cause);
      else bump(killedWithByName, k.killer.trim().toLowerCase(), cause);
    }
    if (k.victim) {
      if (k.victimSteamId) bump(diedToBySteam, k.victimSteamId, cause);
      else bump(diedToByName, k.victim.trim().toLowerCase(), cause);
    }
  }
  return { killedWithBySteam, killedWithByName, diedToBySteam, diedToByName };
}

/** A player's "killed with" weapon breakdown for the round (empty when none). */
export function killedWithOf(p: ScoreboardPlayer, idx: CauseIndex): CauseCounts {
  if (p.steamId) return idx.killedWithBySteam.get(p.steamId) ?? EMPTY_CAUSES;
  return idx.killedWithByName.get(p.name.trim().toLowerCase()) ?? EMPTY_CAUSES;
}

/** A player's "died to" cause breakdown for the round (empty when none). */
export function diedToOf(p: ScoreboardPlayer, idx: CauseIndex): CauseCounts {
  if (p.steamId) return idx.diedToBySteam.get(p.steamId) ?? EMPTY_CAUSES;
  return idx.diedToByName.get(p.name.trim().toLowerCase()) ?? EMPTY_CAUSES;
}

/** Sum several `cause → count` maps into one (unit-level killed-with / died-to). */
export function sumCauses(counts: CauseCounts[]): CauseCounts {
  const out: CauseCounts = {};
  for (const c of counts) for (const [cause, n] of Object.entries(c)) out[cause] = (out[cause] ?? 0) + n;
  return out;
}

export function comparePlayers(a: ScoreboardPlayer, b: ScoreboardPlayer, by: PlayerSort): number {
  if (by === 'unit' || by === 'name') return a.name.localeCompare(b.name);
  if (by === 'kills') return b.kills - a.kills;
  if (by === 'deaths') return b.deaths - a.deaths;
  return b.kd - a.kd;
}

const UNTAGGED_KEY = '__untagged__';

export interface RegimentGroupModel {
  /** Resolved regiment label, or null for untagged/unenlisted players. */
  regiment: string | null;
  players: ScoreboardPlayer[];
}

/** Resolve a player's season regiment, mapping the untagged sentinel to null. */
export type RegimentResolver = (steamId: string | null, name: string) => string | null;

/** Bucket players by their season-resolved regiment — the same label the
 *  Regiments tab shows, so the round drawer's "sort by unit" stays in sync with
 *  the regiment list. Groups are sorted by player count desc with untagged
 *  players pinned to the end. */
export function groupByRegiment(
  players: ScoreboardPlayer[],
  resolve: RegimentResolver,
): RegimentGroupModel[] {
  const byRegiment = new Map<string, ScoreboardPlayer[]>();
  const label = new Map<string, string | null>();
  for (const p of players) {
    const reg = resolve(p.steamId, p.name);
    const key = reg ?? UNTAGGED_KEY;
    label.set(key, reg);
    if (!byRegiment.has(key)) byRegiment.set(key, []);
    byRegiment.get(key)!.push(p);
  }
  return [...byRegiment.entries()]
    .sort(([a, ap], [b, bp]) => {
      if (a === UNTAGGED_KEY && b !== UNTAGGED_KEY) return 1;
      if (b === UNTAGGED_KEY && a !== UNTAGGED_KEY) return -1;
      if (bp.length !== ap.length) return bp.length - ap.length;
      return (label.get(a) ?? '').localeCompare(label.get(b) ?? '');
    })
    .map(([key, ps]) => ({ regiment: label.get(key) ?? null, players: ps }));
}

/** Does a player satisfy the drawer's search box? Matches on the player's name,
 *  their steam id, or their resolved regiment label, case-insensitively. A blank
 *  query matches everyone — so searching a regiment surfaces its whole group with
 *  stats, a name query narrows to that player, and a steam id finds one player
 *  even across name changes. */
export function playerMatches(
  p: ScoreboardPlayer,
  search: string,
  resolve: RegimentResolver,
): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  if (p.name.toLowerCase().includes(q)) return true;
  if (p.steamId && p.steamId.toLowerCase().includes(q)) return true;
  const reg = resolve(p.steamId, p.name);
  return reg != null && reg.toLowerCase().includes(q);
}

export interface UnitAgg {
  kills: number;
  deaths: number;
  inForm: number;
  skirm: number;
  oob: number;
  killInForm: number;
  killSkirm: number;
  killOob: number;
}

/** Roll a set of players up into one unit aggregate: kills/deaths, death
 *  formations, and kill formations (for the ×Td / ×Tk header metrics). */
export function sumKD(
  rows: ScoreboardPlayer[],
  killStance: (p: ScoreboardPlayer) => KillStance,
): UnitAgg {
  return rows.reduce<UnitAgg>(
    (acc, p) => {
      const ks = killStance(p);
      return {
        kills: acc.kills + p.kills,
        deaths: acc.deaths + p.deaths,
        inForm: acc.inForm + p.deathsInForm,
        skirm: acc.skirm + p.deathsSkirm,
        oob: acc.oob + p.deathsOob,
        killInForm: acc.killInForm + ks.inForm,
        killSkirm: acc.killSkirm + ks.skirm,
        killOob: acc.killOob + ks.oob,
      };
    },
    { kills: 0, deaths: 0, inForm: 0, skirm: 0, oob: 0, killInForm: 0, killSkirm: 0, killOob: 0 },
  );
}

export function fmtKd(kills: number, deaths: number): string {
  if (deaths === 0) return kills.toFixed(2);
  return (kills / deaths).toFixed(2);
}

/** Lower-cased officer-name set for ★ marking. Officers carry no steam_id in
 *  the CSV, so membership is matched by name within the same scoreboard. */
export function officerNameSet(officers: { name: string }[]): Set<string> {
  return new Set(officers.map((o) => o.name.trim().toLowerCase()));
}
