/**
 * The round's ORDER OF BATTLE: Team → in-game regiment → company.
 *
 * This is a different question from the Players tab's "unit" grouping. That one
 * asks which competing regiment a player belongs to (season assignments, then
 * the name tag), and it deliberately ignores what the game put them in — a
 * unit's men are its men whichever company they filled that night.
 *
 * Here the grouping is what War of Rights itself recorded, and it is built from
 * the SERVICE LOG — one row per posting a man held — not from the roster's
 * end-of-round snapshot. A company is everyone who served in it at any point in
 * the round, so a company that cycled thirty-five men through reports
 * thirty-five, and a man who moved from Co. A to Co. B appears under both.
 *
 * A man who moved has his round figures divided between his postings in
 * proportion to the time he spent in each: the scoreboard records his kills and
 * deaths for the round as a whole and never says which company he was in when he
 * took them, so the split is an apportionment, not a record. It is exact for the
 * men who held one posting all round, which is nearly all of them, and it keeps
 * every level summable — companies add up to their regiment, regiments to their
 * side, with no man counted twice.
 *
 * Scoreboards from before the July 2026 overlay carry no service log. There the
 * tree falls back to the roster's end-of-round unit, and `source` says so.
 */
import type {
  ScoreboardPlayer,
  RosterEntry,
  ServiceStint,
  ScoreboardOfficer,
  Team,
  Branch,
} from '../../../stats/types';
import { branchOf } from '../../../stats/branch';
import { formatCompany, ticketDamage } from '../../../stats/labels';
import {
  buildRosterIndex,
  rosterLookup,
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

/**
 * One posting: a man's whole time in one (team, regiment, company). Repeat
 * stints in the same unit are merged, so a man who left Co. A and came back is
 * one member of Co. A with both stretches summed.
 */
export interface Posting {
  team: Team;
  regiment: string | null;
  company: string | null;
  /** His state when the posting ended — the role line's rank and class. */
  className: string | null;
  rank: string | null;
  /** Seconds served here, null when the overlay didn't record it. */
  durationS: number | null;
  /** Share of the round spent here, 0–1, or null when unknown. */
  roundShare: number | null;
  /** How many separate stretches he served here. */
  stints: number;
}

/** A man as one unit knew him: his posting there and his share of the round. */
export interface UnitMember {
  player: ScoreboardPlayer;
  posting: Posting;
  /**
   * His figures FOR THIS POSTING: the whole round's when he held only one,
   * and his round apportioned by time served when he moved.
   */
  agg: UnitAgg;
  /** True when the round is spread across more than one posting. */
  split: boolean;
  /** His round totals, so a split card can say "2 of his 5 kills". */
  roundKills: number;
  roundDeaths: number;
  /** The unit's man-round contribution: his share of the round served here. */
  strength: number;
  /** True when he was in this unit when the round ended. */
  atEnd: boolean;
}

export interface CompanyNode {
  /** Stable key, unique inside its regiment. */
  key: string;
  /** Raw roster label ("A Company"), or null when the men hold no company. */
  company: string | null;
  /** How the header reads it ("Co. A", "No company"). */
  label: string;
  /** Everyone who served here — the figures are always the whole company's. */
  members: UnitMember[];
  /** The men to list, narrowed by a search. Equals `members` unsearched. */
  visible: UnitMember[];
  agg: UnitAgg;
  /** Men who served here at any point. */
  served: number;
  /** Men still here when the round ended. */
  atEnd: number;
  /** Man-rounds fielded (Σ each man's share of the round) — the rate denominator. */
  strength: number;
  /** Whoever held the company's officer slot, in the order they took it. */
  officers: CompanyOfficer[];
}

export interface InGameRegimentNode {
  key: string;
  /** Roster regiment label, or null for men with no posting and no roster entry. */
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
  members: UnitMember[];
  visible: UnitMember[];
  agg: UnitAgg;
  served: number;
  atEnd: number;
  strength: number;
}

export interface InGameTeamNode {
  team: Team;
  regiments: InGameRegimentNode[];
  members: UnitMember[];
  visible: UnitMember[];
  agg: UnitAgg;
  served: number;
  atEnd: number;
  strength: number;
  /** Team-wide ticket damage — the denominators for each unit's TDI / TDR share. */
  ticketInflicted: number;
  ticketReceived: number;
}

export interface OrderOfBattle {
  teams: InGameTeamNode[];
  /**
   * `service` — postings, every unit a man served in. `roster` — the
   * end-of-round snapshot, for scoreboards imported before the service log
   * existed. `none` — neither, so there is nothing to group by.
   */
  source: 'service' | 'roster' | 'none';
  /** Men whose round is divided between two or more postings. */
  splitMen: number;
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

const unitKey = (team: Team, regiment: string | null, company: string | null) =>
  `${team}::${norm(regiment)}::${norm(company)}`;

/** A player's identity across the scoreboard's sections. */
const idOf = (p: { steamId: string | null; name: string }) => p.steamId ?? `name:${norm(p.name)}`;

const EMPTY_AGG: UnitAgg = {
  kills: 0, deaths: 0, inForm: 0, skirm: 0, oob: 0, killInForm: 0, killSkirm: 0, killOob: 0,
};

const addAgg = (a: UnitAgg, b: UnitAgg): UnitAgg => ({
  kills: a.kills + b.kills,
  deaths: a.deaths + b.deaths,
  inForm: a.inForm + b.inForm,
  skirm: a.skirm + b.skirm,
  oob: a.oob + b.oob,
  killInForm: a.killInForm + b.killInForm,
  killSkirm: a.killSkirm + b.killSkirm,
  killOob: a.killOob + b.killOob,
});

const sumAggs = (xs: { agg: UnitAgg }[]): UnitAgg => xs.reduce((acc, x) => addAgg(acc, x.agg), EMPTY_AGG);

/**
 * Divide a whole count between postings by weight, keeping it whole: each gets
 * its floor, then the remainders go to the largest fractions first. The parts
 * always add back up to the total, so no kill is invented or lost in the split.
 */
export function apportion(total: number, weights: number[]): number[] {
  const out = weights.map(() => 0);
  if (total <= 0 || weights.length === 0) return out;
  const sum = weights.reduce((a, w) => a + Math.max(0, w), 0);
  // Nothing to weigh by (the overlay recorded no times): the man's figures stay
  // with his first posting rather than being spread on a guess.
  if (sum <= 0) {
    out[0] = total;
    return out;
  }
  const exact = weights.map((w) => (total * Math.max(0, w)) / sum);
  exact.forEach((e, i) => { out[i] = Math.floor(e); });
  let left = total - out.reduce((a, n) => a + n, 0);
  const order = exact
    .map((e, i) => ({ i, frac: e - Math.floor(e) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; left > 0; k++, left--) out[order[k % order.length].i] += 1;
  return out;
}

/** Split one man's round figures across his postings, in proportion to `weights`. */
function splitAgg(whole: UnitAgg, weights: number[]): UnitAgg[] {
  const parts = (Object.keys(EMPTY_AGG) as (keyof UnitAgg)[]).map(
    (field) => [field, apportion(whole[field], weights)] as const,
  );
  return weights.map((_, i) => {
    const agg = { ...EMPTY_AGG };
    for (const [field, split] of parts) agg[field] = split[i];
    return agg;
  });
}

/** team + regiment + company → the officers who held that slot this round. */
function buildCompanyOfficerIndex(
  officers: ScoreboardOfficer[],
  roster: RosterEntry[],
): Map<string, CompanyOfficer[]> {
  const out = new Map<string, CompanyOfficer[]>();
  // Officers carry no steam id in the older command logs, so a fallback lookup
  // for scoreboards whose rows name only the officer matches the roster by name
  // within the round, as the officer leaderboard does.
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

/**
 * Fold a man's service rows into one posting per unit, summing the time of
 * repeat stints and keeping the rank and class he held when he last left it.
 * Postings are returned in the order he first took them.
 */
function mergePostings(stints: ServiceStint[], roundDurationS: number | null): Posting[] {
  const byUnit = new Map<string, Posting>();
  for (const s of stints) {
    const key = unitKey(s.team, s.regiment, s.company);
    const prev = byUnit.get(key);
    const share = stintRoundShare(s, roundDurationS);
    if (!prev) {
      byUnit.set(key, {
        team: s.team,
        regiment: s.regiment,
        company: s.company,
        className: s.className,
        rank: s.rank,
        durationS: s.durationS,
        roundShare: share,
        stints: 1,
      });
      continue;
    }
    prev.stints += 1;
    prev.className = s.className ?? prev.className;
    prev.rank = s.rank ?? prev.rank;
    if (s.durationS != null) prev.durationS = (prev.durationS ?? 0) + s.durationS;
    if (share != null) prev.roundShare = (prev.roundShare ?? 0) + share;
  }
  return [...byUnit.values()];
}

/** What fraction of the round a stint covers, preferring the overlay's own figure. */
function stintRoundShare(s: ServiceStint, roundDurationS: number | null): number | null {
  if (s.pctRound != null) return Math.min(1, Math.max(0, s.pctRound / 100));
  if (s.durationS != null && roundDurationS && roundDurationS > 0) {
    return Math.min(1, s.durationS / roundDurationS);
  }
  return null;
}

/** The posting a roster row stands for, when a man has no service rows at all. */
function postingFromRoster(r: RosterEntry, roundDurationS: number | null): Posting {
  const share = r.pctRound != null
    ? Math.min(1, Math.max(0, r.pctRound / 100))
    : r.durationS != null && roundDurationS && roundDurationS > 0
      ? Math.min(1, r.durationS / roundDurationS)
      : null;
  return {
    team: r.team,
    regiment: r.regiment,
    company: r.company,
    className: r.className,
    rank: r.rank,
    durationS: r.durationS ?? null,
    roundShare: share,
    stints: 1,
  };
}

interface CompanyDraft {
  company: string | null;
  members: UnitMember[];
}
interface RegimentDraft {
  regiment: string | null;
  companies: Map<string, CompanyDraft>;
}

/**
 * Build the round's order of battle.
 *
 * Every man on the scoreboard is placed in each unit he served in. Where the
 * service log is silent about him — the Unenlisted, and every man on a
 * scoreboard imported before the log existed — his roster row stands in as a
 * single full-round posting, and men neither section mentions fall into a `null`
 * regiment on their scoreboard team.
 */
export function buildInGameUnits(
  players: ScoreboardPlayer[],
  roster: RosterEntry[],
  service: ServiceStint[],
  officers: ScoreboardOfficer[],
  killStance: (p: ScoreboardPlayer) => KillStance,
  roundDurationS: number | null = null,
): OrderOfBattle {
  const rosterIndex = buildRosterIndex(roster);
  const officerIndex = buildCompanyOfficerIndex(officers, roster);

  // Service rows keyed the way players are, steam id first, name as a fallback.
  const stintsById = new Map<string, ServiceStint[]>();
  for (const s of service) {
    const key = idOf(s);
    const list = stintsById.get(key);
    if (list) list.push(s);
    else stintsById.set(key, [s]);
  }
  const stintsOf = (p: ScoreboardPlayer): ServiceStint[] =>
    stintsById.get(idOf(p)) ?? (p.steamId ? stintsById.get(`name:${norm(p.name)}`) ?? [] : []);

  const drafts = new Map<Team, Map<string, RegimentDraft>>();
  let splitMen = 0;
  let usedService = false;

  for (const p of players) {
    const seat = rosterLookup(rosterIndex, p);
    const stints = stintsOf(p);
    let postings = mergePostings(stints, roundDurationS);
    if (postings.length > 0) usedService = true;
    else {
      // No service rows: the roster's unit, or none at all.
      postings = [seat
        ? postingFromRoster(seat, roundDurationS)
        : {
          team: p.team,
          regiment: null,
          company: null,
          className: null,
          rank: null,
          durationS: null,
          roundShare: null,
          stints: 1,
        }];
    }

    const ks = killStance(p);
    const whole: UnitAgg = {
      kills: p.kills,
      deaths: p.deaths,
      inForm: p.deathsInForm,
      skirm: p.deathsSkirm,
      oob: p.deathsOob,
      killInForm: ks.inForm,
      killSkirm: ks.skirm,
      killOob: ks.oob,
    };
    const split = postings.length > 1;
    if (split) splitMen += 1;
    // A man's figures follow the time he spent in each posting. With no times
    // recorded there is nothing to weigh by, so they stay with his first.
    const weights = postings.map((x) => x.durationS ?? x.roundShare ?? 0);
    const aggs = split ? splitAgg(whole, weights) : [whole];

    postings.forEach((posting, i) => {
      const member: UnitMember = {
        player: p,
        posting,
        agg: aggs[i],
        split,
        roundKills: p.kills,
        roundDeaths: p.deaths,
        // A man whose time went unrecorded still fielded a man: count him whole
        // rather than let an old scoreboard report a side of no strength.
        strength: posting.roundShare ?? (split ? 1 / postings.length : 1),
        atEnd: seat != null
          && seat.team === posting.team
          && norm(seat.regiment) === norm(posting.regiment)
          && norm(seat.company) === norm(posting.company),
      };
      const byRegiment = drafts.get(posting.team) ?? new Map<string, RegimentDraft>();
      drafts.set(posting.team, byRegiment);
      const rKey = norm(posting.regiment);
      const reg = byRegiment.get(rKey) ?? { regiment: posting.regiment, companies: new Map() };
      byRegiment.set(rKey, reg);
      const cKey = norm(posting.company);
      const co = reg.companies.get(cKey) ?? { company: posting.company, members: [] };
      reg.companies.set(cKey, co);
      co.members.push(member);
    });
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
          members: c.members,
          visible: c.members,
          agg: sumAggs(c.members),
          ...tally(c.members),
          officers: officerIndex.get(unitKey(team, draft.regiment, c.company)) ?? [],
        }))
        .sort(compareCompanies);
      const members = companies.flatMap((c) => c.members);
      regiments.push({
        key: rKey,
        regiment: draft.regiment,
        label: draft.regiment ?? NO_UNIT_LABEL,
        branch: branchOf(draft.regiment),
        companies,
        flat: companies.length === 1 && companies[0].company == null,
        members,
        visible: members,
        agg: sumAggs(members),
        ...tally(members),
      });
    }
    regiments.sort(compareRegiments);

    const members = regiments.flatMap((r) => r.members);
    const agg = sumAggs(members);
    teams.push({
      team,
      regiments,
      members,
      visible: members,
      agg,
      ...tally(members),
      ticketInflicted: ticketDamage(agg.killInForm, agg.killSkirm, agg.killOob),
      ticketReceived: ticketDamage(agg.inForm, agg.skirm, agg.oob),
    });
  }

  return {
    teams,
    source: usedService ? 'service' : roster.length > 0 ? 'roster' : 'none',
    splitMen,
  };
}

/**
 * Men, not postings. A man who moved between two companies of one regiment is
 * two members of that regiment but one man in it, so every count above company
 * level goes by identity. Man-rounds need no such care — his two part-shares add
 * back up to the one round he played.
 */
export function distinctMen(members: UnitMember[]): number {
  return new Set(members.map((m) => idOf(m.player))).size;
}

/** Head counts and man-rounds for a set of members. */
function tally(members: UnitMember[]): { served: number; atEnd: number; strength: number } {
  return {
    served: distinctMen(members),
    atEnd: distinctMen(members.filter((m) => m.atEnd)),
    strength: members.reduce((s, m) => s + m.strength, 0),
  };
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
  if (a.served !== b.served) return b.served - a.served;
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
  const hitsPlayer = (m: UnitMember) =>
    m.player.name.toLowerCase().includes(q) || (m.player.steamId?.toLowerCase().includes(q) ?? false);

  const out: InGameTeamNode[] = [];
  for (const team of teams) {
    const regiments: InGameRegimentNode[] = [];
    for (const reg of team.regiments) {
      const regHit = reg.label.toLowerCase().includes(q);
      const companies: CompanyNode[] = [];
      for (const co of reg.companies) {
        const unitHit = regHit || co.label.toLowerCase().includes(q)
          || (co.company?.toLowerCase().includes(q) ?? false);
        const visible = unitHit ? co.members : co.members.filter(hitsPlayer);
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
