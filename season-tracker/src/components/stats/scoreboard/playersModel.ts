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

/** Does a player satisfy the drawer's search box? Matches on the player's name
 *  or their resolved regiment label, case-insensitively. A blank query matches
 *  everyone — so searching a regiment surfaces its whole group with stats, while
 *  a name query narrows to that player. */
export function playerMatches(
  p: ScoreboardPlayer,
  search: string,
  resolve: RegimentResolver,
): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  if (p.name.toLowerCase().includes(q)) return true;
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
