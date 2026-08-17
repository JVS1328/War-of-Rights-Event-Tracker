/**
 * The round's ORDER OF BATTLE: Team → in-game regiment → company.
 *
 * This is a different question from the Players tab's "unit" grouping. That one
 * asks which competing regiment a player belongs to (season assignments, then
 * the name tag), and it deliberately ignores what the game put them in — a
 * unit's men are its men whichever company they filled that night.
 *
 * Here the grouping is what War of Rights itself recorded: the roster's
 * `regiment` and `company` columns, so "USA · 20th Maine · Co. B" is a node with
 * its own men and its own figures, regardless of which competing units those men
 * came from. Everything is summable (counts, not averages), so a company's
 * figures roll up into its regiment's and a regiment's into its team's.
 *
 * Membership is the roster's end-of-round state, the same source the Players tab
 * reads for a player's role line. A man who moved company mid-round appears once,
 * under the unit he finished in; `Scoreboard.service` has the full movement
 * history for anyone who needs it.
 */
import type { ScoreboardPlayer, RosterEntry, ScoreboardOfficer, Team, Branch } from '../../../stats/types';
import { branchOf } from '../../../stats/branch';
import { formatCompany, ticketDamage } from '../../../stats/labels';
import {
  buildRosterIndex,
  rosterLookup,
  sumKD,
  type KillStance,
  type UnitAgg,
} from './playersModel';

/** Shown for players the roster never placed in a unit. */
export const NO_UNIT_LABEL = 'No unit recorded';
/** Shown for a regiment's men who hold no company (the game's Unenlisted pool). */
export const NO_COMPANY_LABEL = 'No company';

/** An officer holding a company's slot this round, as the header shows them. */
export interface CompanyOfficer {
  name: string;
  rank: string | null;
}

export interface CompanyNode {
  /** Stable key, unique inside its regiment. */
  key: string;
  /** Raw roster label ("A Company"), or null when the men hold no company. */
  company: string | null;
  /** How the header reads it ("Co. A", "No company"). */
  label: string;
  /** Every man in the company — the figures are always the whole company's. */
  players: ScoreboardPlayer[];
  /** The men to list, narrowed by a search. Equals `players` unsearched. */
  visible: ScoreboardPlayer[];
  agg: UnitAgg;
  /** Whoever held the company's officer slot, in the order they took it. */
  officers: CompanyOfficer[];
}

export interface InGameRegimentNode {
  key: string;
  /** Roster regiment label, or null for men with no roster entry at all. */
  regiment: string | null;
  label: string;
  branch: Branch;
  companies: CompanyNode[];
  /**
   * True when the regiment has no company structure at all (one bucket, no
   * company recorded) — the Unenlisted pool and the unrostered. The view lists
   * its men directly rather than under an empty company row.
   */
  flat: boolean;
  players: ScoreboardPlayer[];
  visible: ScoreboardPlayer[];
  agg: UnitAgg;
}

export interface InGameTeamNode {
  team: Team;
  regiments: InGameRegimentNode[];
  players: ScoreboardPlayer[];
  visible: ScoreboardPlayer[];
  agg: UnitAgg;
  /** Team-wide ticket damage — the denominators for each unit's TDI / TDR share. */
  ticketInflicted: number;
  ticketReceived: number;
}

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

const isUnenlisted = (regiment: string | null) => norm(regiment) === 'unenlisted';

/** A bare company designation: "A", "3", "1st", "10th". */
const BARE_COMPANY = /^([a-z]|\d+(st|nd|rd|th)?)$/i;

/**
 * A company's display name. A bare designation reads as "Co. A" — the header
 * supplies the prefix — while a name that says more than that ("Color Guard")
 * is left to speak for itself.
 */
export function companyLabel(company: string | null): string {
  if (!company) return NO_COMPANY_LABEL;
  const short = formatCompany(company);
  return BARE_COMPANY.test(short) ? `Co. ${short}` : short;
}

/** team + regiment + company → the officers who held that slot this round. */
function buildCompanyOfficerIndex(
  officers: ScoreboardOfficer[],
  roster: RosterEntry[],
): Map<string, CompanyOfficer[]> {
  const out = new Map<string, CompanyOfficer[]>();
  // Officers carry no steam id in the command log, so a fallback lookup for the
  // pre-July-2026 scoreboards — whose rows name only the officer — matches the
  // roster by name within the round, as the officer leaderboard does.
  const rosterByName = new Map<string, RosterEntry>();
  for (const r of roster) rosterByName.set(`${r.team}::${norm(r.name)}`, r);

  for (const off of officers) {
    let regiment = off.regiment ?? null;
    let company = off.company ?? null;
    if (!regiment || !company) {
      const seat = rosterByName.get(`${off.team}::${norm(off.name)}`);
      regiment = regiment ?? seat?.regiment ?? null;
      company = company ?? seat?.company ?? null;
    }
    if (!regiment || !company) continue;
    const key = unitKey(off.team, regiment, company);
    const list = out.get(key) ?? [];
    // One row per stint: an officer who retook the slot is still one officer.
    if (!list.some((o) => norm(o.name) === norm(off.name))) {
      list.push({ name: off.name, rank: off.rank ?? null });
    }
    out.set(key, list);
  }
  return out;
}

const unitKey = (team: Team, regiment: string | null, company: string | null) =>
  `${team}::${norm(regiment)}::${norm(company)}`;

interface CompanyDraft {
  company: string | null;
  players: ScoreboardPlayer[];
}
interface RegimentDraft {
  regiment: string | null;
  companies: Map<string, CompanyDraft>;
}

/**
 * Build the round's order of battle.
 *
 * A player is placed by their roster entry; the roster's team wins over the
 * scoreboard row's, since a company belongs to the side it was raised on. Men
 * the roster never mentions fall into a `null` regiment on their scoreboard team.
 */
export function buildInGameUnits(
  players: ScoreboardPlayer[],
  roster: RosterEntry[],
  officers: ScoreboardOfficer[],
  killStance: (p: ScoreboardPlayer) => KillStance,
): InGameTeamNode[] {
  const rosterIndex = buildRosterIndex(roster);
  const officerIndex = buildCompanyOfficerIndex(officers, roster);

  const drafts = new Map<Team, Map<string, RegimentDraft>>();
  for (const p of players) {
    const seat = rosterLookup(rosterIndex, p);
    const team = seat?.team ?? p.team;
    const regiment = seat?.regiment ?? null;
    const company = seat?.company ?? null;

    let byRegiment = drafts.get(team);
    if (!byRegiment) {
      byRegiment = new Map();
      drafts.set(team, byRegiment);
    }
    const rKey = norm(regiment);
    let reg = byRegiment.get(rKey);
    if (!reg) {
      reg = { regiment, companies: new Map() };
      byRegiment.set(rKey, reg);
    }
    const cKey = norm(company);
    let co = reg.companies.get(cKey);
    if (!co) {
      co = { company, players: [] };
      reg.companies.set(cKey, co);
    }
    co.players.push(p);
  }

  const teams: InGameTeamNode[] = [];
  for (const team of ['USA', 'CSA'] as Team[]) {
    const byRegiment = drafts.get(team);
    if (!byRegiment || byRegiment.size === 0) continue;

    const regiments: InGameRegimentNode[] = [];
    for (const [rKey, draft] of byRegiment) {
      const companies: CompanyNode[] = [...draft.companies.values()]
        .map((c) => ({
          key: `${rKey}::${norm(c.company)}`,
          company: c.company,
          label: companyLabel(c.company),
          players: c.players,
          visible: c.players,
          agg: sumKD(c.players, killStance),
          officers: officerIndex.get(unitKey(team, draft.regiment, c.company)) ?? [],
        }))
        .sort(compareCompanies);
      const regPlayers = companies.flatMap((c) => c.players);
      regiments.push({
        key: rKey,
        regiment: draft.regiment,
        label: draft.regiment ?? NO_UNIT_LABEL,
        branch: branchOf(draft.regiment),
        companies,
        flat: companies.length === 1 && companies[0].company == null,
        players: regPlayers,
        visible: regPlayers,
        agg: sumKD(regPlayers, killStance),
      });
    }
    regiments.sort(compareRegiments);

    const teamPlayers = regiments.flatMap((r) => r.players);
    const agg = sumKD(teamPlayers, killStance);
    teams.push({
      team,
      regiments,
      players: teamPlayers,
      visible: teamPlayers,
      agg,
      ticketInflicted: ticketDamage(agg.killInForm, agg.killSkirm, agg.killOob),
      ticketReceived: ticketDamage(agg.inForm, agg.skirm, agg.oob),
    });
  }
  return teams;
}

/** Companies read in their game order — A, B, C, then 1st, 2nd — nulls last. */
function compareCompanies(a: CompanyNode, b: CompanyNode): number {
  if (a.company == null) return b.company == null ? 0 : 1;
  if (b.company == null) return -1;
  return a.label.localeCompare(b.label, undefined, { numeric: true });
}

/**
 * Biggest unit first, as the Players tab orders its groups, with the two
 * non-units — the Unenlisted pool and the unrostered — pinned to the end.
 */
function compareRegiments(a: InGameRegimentNode, b: InGameRegimentNode): number {
  const rank = (r: InGameRegimentNode) => (r.regiment == null ? 2 : isUnenlisted(r.regiment) ? 1 : 0);
  const ra = rank(a);
  const rb = rank(b);
  if (ra !== rb) return ra - rb;
  if (a.players.length !== b.players.length) return b.players.length - a.players.length;
  return a.label.localeCompare(b.label);
}

/**
 * Narrow the tree to a search. A query matches a man by name or steam id, or a
 * unit by its regiment or company name — in which case the whole unit shows, so
 * searching "20th Maine" reads that regiment's order of battle intact.
 *
 * Only `visible` changes: every node keeps the figures for its whole strength,
 * so a search never quietly restates a company's k/d as the two men it matched.
 */
export function filterInGameUnits(teams: InGameTeamNode[], query: string): InGameTeamNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return teams;
  const hitsPlayer = (p: ScoreboardPlayer) =>
    p.name.toLowerCase().includes(q) || (p.steamId?.toLowerCase().includes(q) ?? false);

  const out: InGameTeamNode[] = [];
  for (const team of teams) {
    const regiments: InGameRegimentNode[] = [];
    for (const reg of team.regiments) {
      const regHit = reg.label.toLowerCase().includes(q);
      const companies: CompanyNode[] = [];
      for (const co of reg.companies) {
        const unitHit = regHit || co.label.toLowerCase().includes(q)
          || (co.company?.toLowerCase().includes(q) ?? false);
        const visible = unitHit ? co.players : co.players.filter(hitsPlayer);
        if (visible.length) companies.push({ ...co, visible });
      }
      if (companies.length) {
        regiments.push({ ...reg, companies, visible: companies.flatMap((c) => c.visible) });
      }
    }
    if (regiments.length) {
      out.push({ ...team, regiments, visible: regiments.flatMap((r) => r.visible) });
    }
  }
  return out;
}

/**
 * Open-state keys for the view. Team-prefixed so the two sides never share an
 * open regiment, and built here so expand-all and the row toggles can never
 * disagree about how a node is named.
 */
export const regimentNodeKey = (team: Team, reg: InGameRegimentNode) => `${team}::${reg.key}`;
export const companyNodeKey = (team: Team, co: CompanyNode) => `${team}::${co.key}`;

/** Every node key in the tree, for expand-all. */
export function allUnitKeys(teams: InGameTeamNode[]): { regiments: string[]; companies: string[] } {
  const regiments: string[] = [];
  const companies: string[] = [];
  for (const team of teams) {
    for (const reg of team.regiments) {
      regiments.push(regimentNodeKey(team.team, reg));
      for (const co of reg.companies) companies.push(companyNodeKey(team.team, co));
    }
  }
  return { regiments, companies };
}
