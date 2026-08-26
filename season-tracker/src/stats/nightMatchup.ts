/**
 * A night read as a matchup.
 *
 * A night is two rounds between the same two sides, so it has a scoreline of
 * its own — rounds won, then everything the two rounds add up to. The tracker
 * already stores the result of each round on the week; this turns that into the
 * same shapes the round matchup uses (a scoreline, one line per metric), and,
 * when scoreboards have been bound to the night's rounds, rolls those up too.
 *
 * Sides here are the league's A/B, not USA/CSA. That distinction matters: a
 * round can be flipped, so Team A plays USA in one round and CSA in the other.
 * Summing "USA" across a flipped night would silently mix the two teams, so the
 * roll-up maps each round's factions onto sides first.
 *
 * Pure: takes a week and scoreboards, returns data. No React.
 */
import type { Scoreboard, Team } from './types';
import type { FormationCounts } from './statsEngine';
import { resolveFor } from './statsEngine';
import type { EngineOptions } from './statsEngine';
import type { RegimentAssignmentMap } from './StatsRepository';
import { TICKET_WEIGHT, avgTicketCost, perPlayerRate } from './labels';
import type { SpineRow, SpineTextRow } from '../components/ui/spineModel';

export type Side = 'A' | 'B';

export const otherSide = (s: Side): Side => (s === 'A' ? 'B' : 'A');

/**
 * Just the two sides and the balance swaps — everything {@link effectiveTeams}
 * needs. Split out so anything reading who was on which side (the heatmaps,
 * for one) goes through the same swap rule rather than reimplementing it.
 */
export interface TeamSides {
  teamA?: string[];
  teamB?: string[];
  roundSwaps?: { r1?: string[]; r2?: string[] };
}

/**
 * The subset of a tracker week this module reads. Kept structural so the live
 * tracker can hand its week straight in, and the tests can build a small one.
 */
export interface NightWeek extends TeamSides {
  id: string | number;
  name: string;
  round1Winner?: Side | null;
  round2Winner?: Side | null;
  round1Draw?: boolean;
  round2Draw?: boolean;
  round1Map?: string | null;
  round2Map?: string | null;
  round1Flipped?: boolean;
  round2Flipped?: boolean;
  leadA?: string | null;
  leadB?: string | null;
  leadA_r1?: string | null;
  leadB_r1?: string | null;
  leadA_r2?: string | null;
  leadB_r2?: string | null;
  isPlayoffs?: boolean;
  isSingleRoundLeads?: boolean;
  isFunRound?: boolean;
  r1CasualtiesA?: number | null;
  r1CasualtiesB?: number | null;
  r2CasualtiesA?: number | null;
  r2CasualtiesB?: number | null;
  r1CasualtiesFormA?: FormationCounts | null;
  r1CasualtiesFormB?: FormationCounts | null;
  r2CasualtiesFormA?: FormationCounts | null;
  r2CasualtiesFormB?: FormationCounts | null;
  r1MoraleA?: string | null;
  r1MoraleB?: string | null;
  r2MoraleA?: string | null;
  r2MoraleB?: string | null;
}

export type NightType = 'Regular' | 'Single-round leads' | 'Playoffs' | 'Fun round';

/**
 * Playoffs wins over single-round leads, which wins over fun — the tracker's
 * checkboxes are mutually exclusive, but an imported season can carry more than
 * one flag, so the order is fixed here rather than left to whichever is read
 * first.
 */
export function nightType(w: NightWeek): NightType {
  if (w.isPlayoffs) return 'Playoffs';
  if (w.isSingleRoundLeads) return 'Single-round leads';
  if (w.isFunRound) return 'Fun round';
  return 'Regular';
}

/** Playoffs and single-round-lead nights set a lead per round, not per night. */
export const hasPerRoundLeads = (t: NightType): boolean =>
  t === 'Playoffs' || t === 'Single-round leads';

/** How many lead slots the night has to fill: 2 per night, 4 per round, 0 for fun. */
export function leadsPerNight(t: NightType): 0 | 2 | 4 {
  if (t === 'Fun round') return 0;
  return hasPerRoundLeads(t) ? 4 : 2;
}

/** Fun rounds are exhibition — no points, no win/loss record. */
export const nightScores = (t: NightType): boolean => t !== 'Fun round';

/** Playoff nights record wins and losses but award no points. */
export const nightAwardsPoints = (t: NightType): boolean =>
  t !== 'Fun round' && t !== 'Playoffs';

/**
 * Who was on each side for a round, after balance swaps. Mirrors the tracker's
 * getEffectiveTeams: a swapped unit moves to the other side for that round
 * only.
 */
export function effectiveTeams(w: TeamSides, round: 1 | 2): { A: string[]; B: string[] } {
  const baseA = w.teamA ?? [];
  const baseB = w.teamB ?? [];
  const swaps = new Set(w.roundSwaps?.[round === 1 ? 'r1' : 'r2'] ?? []);
  if (swaps.size === 0) return { A: baseA, B: baseB };
  return {
    A: baseA.filter((u) => !swaps.has(u)).concat(baseB.filter((u) => swaps.has(u))),
    B: baseB.filter((u) => !swaps.has(u)).concat(baseA.filter((u) => swaps.has(u))),
  };
}

/** The lead unit each side put up for a round, per-round or per-night as the type dictates. */
export function leadsFor(w: NightWeek, round: 1 | 2): { A: string | null; B: string | null } {
  if (hasPerRoundLeads(nightType(w))) {
    return round === 1
      ? { A: w.leadA_r1 ?? null, B: w.leadB_r1 ?? null }
      : { A: w.leadA_r2 ?? null, B: w.leadB_r2 ?? null };
  }
  return { A: w.leadA ?? null, B: w.leadB ?? null };
}

export interface NightRoundResult {
  round: 1 | 2;
  winner: Side | null;
  draw: boolean;
  map: string | null;
  /** True when side A played CSA this round. */
  flipped: boolean;
  /** Which faction each side played, so scoreboards can be read onto sides. */
  factionA: Team;
  factionB: Team;
  casualtiesA: number | null;
  casualtiesB: number | null;
  formA: FormationCounts | null;
  formB: FormationCounts | null;
  moraleA: string | null;
  moraleB: string | null;
  leadA: string | null;
  leadB: string | null;
  /** True once the round has a result — a winner, or a recorded draw. */
  played: boolean;
}

/**
 * A recorded 0 is a real figure and a missing one is not, so a round that was
 * never filled in reads `null` rather than 0. The tracker seeds new weeks with
 * 0, so "both sides 0" on an unplayed round is treated as absent.
 */
const casOf = (n: number | null | undefined, played: boolean): number | null =>
  played ? n ?? 0 : n ? n : null;

export function nightRounds(w: NightWeek): NightRoundResult[] {
  return ([1, 2] as const).map((round) => {
    const r1 = round === 1;
    const winner = (r1 ? w.round1Winner : w.round2Winner) ?? null;
    const draw = !!(r1 ? w.round1Draw : w.round2Draw);
    const played = winner !== null || draw;
    const flipped = !!(r1 ? w.round1Flipped : w.round2Flipped);
    const leads = leadsFor(w, round);
    return {
      round,
      winner,
      draw,
      map: (r1 ? w.round1Map : w.round2Map) ?? null,
      flipped,
      factionA: flipped ? 'CSA' : 'USA',
      factionB: flipped ? 'USA' : 'CSA',
      casualtiesA: casOf(r1 ? w.r1CasualtiesA : w.r2CasualtiesA, played),
      casualtiesB: casOf(r1 ? w.r1CasualtiesB : w.r2CasualtiesB, played),
      formA: (r1 ? w.r1CasualtiesFormA : w.r2CasualtiesFormA) ?? null,
      formB: (r1 ? w.r1CasualtiesFormB : w.r2CasualtiesFormB) ?? null,
      moraleA: (r1 ? w.r1MoraleA : w.r2MoraleA) ?? null,
      moraleB: (r1 ? w.r1MoraleB : w.r2MoraleB) ?? null,
      leadA: leads.A,
      leadB: leads.B,
      played,
    };
  });
}

export interface NightScore {
  roundsA: number;
  roundsB: number;
  /** Rounds with a result — 0, 1 or 2. */
  played: number;
  casualtiesA: number;
  casualtiesB: number;
  /** The side that took the night, or null for a split (or nothing played). */
  winner: Side | null;
  /** Set when one side took both rounds — the sweep bonus applies. */
  sweep: Side | null;
}

export function nightScore(w: NightWeek): NightScore {
  const rounds = nightRounds(w);
  let roundsA = 0;
  let roundsB = 0;
  let played = 0;
  let casualtiesA = 0;
  let casualtiesB = 0;
  for (const r of rounds) {
    if (r.played) played += 1;
    if (r.winner === 'A') roundsA += 1;
    else if (r.winner === 'B') roundsB += 1;
    casualtiesA += r.casualtiesA ?? 0;
    casualtiesB += r.casualtiesB ?? 0;
  }
  const sweep = roundsA === 2 ? 'A' : roundsB === 2 ? 'B' : null;
  return {
    roundsA,
    roundsB,
    played,
    casualtiesA,
    casualtiesB,
    winner: roundsA > roundsB ? 'A' : roundsB > roundsA ? 'B' : null,
    sweep,
  };
}

/** True once either round of a night has a result recorded against it. */
export const nightPlayed = (w: NightWeek): boolean => nightScore(w).played > 0;

/**
 * The night a season should open on: the most recent one with a round entered.
 *
 * A season is built ahead of itself — the schedule runs to a final long before
 * it is played — so the last week on the list is usually empty, and opening on
 * it shows a matchup that has not happened. Falling back to the last week when
 * nothing has been played keeps a brand-new season on something rather than
 * nothing.
 */
export function latestPlayedWeek<T extends NightWeek>(weeks: T[]): T | null {
  for (let i = weeks.length - 1; i >= 0; i -= 1) {
    if (nightPlayed(weeks[i])) return weeks[i];
  }
  return weeks[weeks.length - 1] ?? null;
}

const addForm = (t: FormationCounts, f: FormationCounts | null | undefined) => {
  if (!f) return t;
  t.in_form += f.in_form;
  t.skirm += f.skirm;
  t.oob += f.oob;
  return t;
};

const emptyForm = (): FormationCounts => ({ in_form: 0, skirm: 0, oob: 0 });

/** Stance-weighted ticket cost of a casualty split (1 · 3 · 5). */
export const ticketsOf = (f: FormationCounts): number =>
  f.in_form * TICKET_WEIGHT.in_form + f.skirm * TICKET_WEIGHT.skirm + f.oob * TICKET_WEIGHT.oob;

const pct = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

/** Casualties by stance across the night, per side — null when no round recorded them. */
export function nightFormations(w: NightWeek): { A: FormationCounts | null; B: FormationCounts | null } {
  const rounds = nightRounds(w);
  const any = rounds.some((r) => r.formA || r.formB);
  if (!any) return { A: null, B: null };
  const A = emptyForm();
  const B = emptyForm();
  for (const r of rounds) {
    addForm(A, r.formA);
    addForm(B, r.formB);
  }
  return { A, B };
}

/**
 * The night in one line per metric, from the recorded results. Rows that need
 * data the week does not carry are left out rather than shown as zeroes.
 */
export function nightRows(w: NightWeek): (SpineRow | SpineTextRow)[] {
  const s = nightScore(w);
  const type = nightType(w);
  const rows: (SpineRow | SpineTextRow)[] = [{ label: 'Rounds won', a: s.roundsA, b: s.roundsB }];

  if (s.casualtiesA > 0 || s.casualtiesB > 0) {
    rows.push(
      { label: 'Casualties inflicted', sub: 'enemy men lost', a: s.casualtiesB, b: s.casualtiesA },
      { label: 'Casualties taken', sub: 'lower is better', a: s.casualtiesA, b: s.casualtiesB, lower: true },
    );
  }

  const form = nightFormations(w);
  if (form.A && form.B && (form.A.in_form + form.B.in_form > 0 || form.A.oob + form.B.oob > 0)) {
    const aT = ticketsOf(form.A);
    const bT = ticketsOf(form.B);
    const aN = s.casualtiesA || form.A.in_form + form.A.skirm + form.A.oob;
    const bN = s.casualtiesB || form.B.in_form + form.B.skirm + form.B.oob;
    rows.push(
      { label: 'Ticket damage dealt', sub: 'stance weighted', a: bT, b: aT },
      {
        label: 'Held the line',
        sub: '% of losses, in formation',
        a: pct(form.A.in_form, aN),
        b: pct(form.B.in_form, bN),
        aText: `${pct(form.A.in_form, aN)}%`,
        bText: `${pct(form.B.in_form, bN)}%`,
      },
      {
        label: 'Caught out of line',
        sub: '% of losses · lower better',
        a: pct(form.A.oob, aN),
        b: pct(form.B.oob, bN),
        aText: `${pct(form.A.oob, aN)}%`,
        bText: `${pct(form.B.oob, bN)}%`,
        lower: true,
      },
    );
    if (aN > 0 && bN > 0) {
      rows.push({
        label: 'Cost per death',
        sub: 'tickets · lower better',
        a: aT / aN,
        b: bT / bN,
        aText: (aT / aN).toFixed(1),
        bText: (bT / bN).toFixed(1),
        lower: true,
      });
    }
  }

  const teams = effectiveTeams(w, 1);
  rows.push({ label: 'Units fielded', a: teams.A.length, b: teams.B.length });

  if (!hasPerRoundLeads(type) && type !== 'Fun round') {
    rows.push({ label: 'Lead unit', aText: w.leadA ?? '—', bText: w.leadB ?? '—', text: true });
  }
  return rows;
}

// ── Points ─────────────────────────────────────────────────────────────────

export interface PointSystem {
  winLead: number;
  winAssist: number;
  lossLead: number;
  lossAssist: number;
  bonus2_0Lead: number;
  bonus2_0Assist: number;
  balancePoints?: number;
  balancePointsStyle?: 'perNight' | 'perRound' | 'perRoundLoss';
}

export interface NightUnitPoints {
  unit: string;
  side: Side;
  /** Rounds this unit led — 0, 1 or 2. */
  ledRounds: number;
  roundsWon: number;
  roundsLost: number;
  /** Rounds it was swapped to the other side to balance the night. */
  swappedRounds: number;
  points: number;
  /** False when the unit holds no standings token, so it scores nothing. */
  token: boolean;
}

/**
 * What each unit earned this night, by the same rules the standings use:
 * lead/assist per round, the 2–0 sweep bonus for units on the winning side in
 * both rounds, and balance points. Playoff nights record the record but award
 * no points; fun rounds are exhibition and award neither.
 *
 * `tokenUnits`, when given, is the set of units that hold a standings token —
 * anyone else is listed with `token: false` and zero points, matching the
 * tracker, which skips them outright.
 */
export function nightPoints(
  w: NightWeek,
  ps: PointSystem,
  tokenUnits?: Iterable<string>,
): NightUnitPoints[] {
  const tokens = tokenUnits ? new Set(tokenUnits) : null;
  const type = nightType(w);
  const base = effectiveTeams(w, 1);
  const out = new Map<string, NightUnitPoints>();
  const ensure = (unit: string, side: Side): NightUnitPoints => {
    let row = out.get(unit);
    if (!row) {
      row = {
        unit,
        side,
        ledRounds: 0,
        roundsWon: 0,
        roundsLost: 0,
        swappedRounds: 0,
        points: 0,
        token: tokens ? tokens.has(unit) : true,
      };
      out.set(unit, row);
    }
    return row;
  };
  for (const u of base.A) ensure(u, 'A');
  for (const u of base.B) ensure(u, 'B');

  const scores = nightScores(type);
  const awards = nightAwardsPoints(type);

  for (const r of nightRounds(w)) {
    const eff = effectiveTeams(w, r.round);
    const swaps = w.roundSwaps?.[r.round === 1 ? 'r1' : 'r2'] ?? [];
    for (const u of swaps) {
      const row = out.get(u);
      if (row) row.swappedRounds += 1;
    }
    for (const side of ['A', 'B'] as const) {
      const lead = side === 'A' ? r.leadA : r.leadB;
      for (const u of eff[side]) {
        const row = ensure(u, side);
        if (u === lead) row.ledRounds += 1;
      }
    }
    if (!r.winner || !scores) continue;
    const won = eff[r.winner];
    const lost = eff[otherSide(r.winner)];
    const leadWin = r.winner === 'A' ? r.leadA : r.leadB;
    const leadLose = r.winner === 'A' ? r.leadB : r.leadA;
    for (const u of won) {
      const row = ensure(u, r.winner);
      row.roundsWon += 1;
      if (!row.token || !awards) continue;
      row.points += u === leadWin ? ps.winLead : ps.winAssist;
    }
    for (const u of lost) {
      const row = ensure(u, otherSide(r.winner));
      row.roundsLost += 1;
      if (!row.token || !awards) continue;
      row.points += u === leadLose ? ps.lossLead : ps.lossAssist;
    }
  }

  // Sweep bonus: only units that were on the winning side in BOTH rounds, so a
  // unit swapped across for one of them does not collect it.
  const score = nightScore(w);
  if (awards && score.sweep) {
    const s = score.sweep;
    const r1 = new Set(effectiveTeams(w, 1)[s]);
    const r2 = new Set(effectiveTeams(w, 2)[s]);
    const leads = hasPerRoundLeads(type)
      ? new Set([leadsFor(w, 1)[s], leadsFor(w, 2)[s]].filter(Boolean) as string[])
      : new Set([s === 'A' ? w.leadA : w.leadB].filter(Boolean) as string[]);
    for (const u of r1) {
      if (!r2.has(u)) continue;
      const row = out.get(u);
      if (!row || !row.token) continue;
      row.points += leads.has(u) ? ps.bonus2_0Lead : ps.bonus2_0Assist;
    }
  }

  // Balance points, in whichever of the three styles the season uses.
  if (awards && ps.balancePoints) {
    const style = ps.balancePointsStyle ?? 'perNight';
    const r1 = w.roundSwaps?.r1 ?? [];
    const r2 = w.roundSwaps?.r2 ?? [];
    const give = (unit: string) => {
      const row = out.get(unit);
      if (row?.token) row.points += ps.balancePoints!;
    };
    if (style === 'perRound') {
      for (const u of r1) give(u);
      for (const u of r2) give(u);
    } else if (style === 'perRoundLoss') {
      for (const r of nightRounds(w)) {
        if (!r.winner) continue;
        const swaps = r.round === 1 ? r1 : r2;
        if (swaps.length === 0) continue;
        const losers = new Set(effectiveTeams(w, r.round)[otherSide(r.winner)]);
        for (const u of swaps) if (losers.has(u)) give(u);
      }
    } else {
      for (const u of new Set([...r1, ...r2])) give(u);
    }
  }

  return [...out.values()];
}

// ── Scoreboard roll-up ─────────────────────────────────────────────────────

/** One round of the night with the scoreboard imported for it. */
export interface NightRoundScoreboard {
  round: 1 | 2;
  sb: Scoreboard;
  /** Which faction side A played this round (from the round's flip flag). */
  factionA: Team;
}

export interface NightUnitRoll {
  unit: string;
  side: Side;
  rounds: number;
  /** Player-rounds fielded across the night. */
  fielded: number;
  kills: number;
  deaths: number;
  kd: number;
  casualtiesByFormation: FormationCounts;
  killsByFormation: FormationCounts;
  avgTd: number | null;
  avgTk: number | null;
  killRate: number | null;
  lossRate: number | null;
  ticketsInflicted: number;
  ticketsReceived: number;
  /** Share of its own side's night total, as a percentage. */
  pctInflicted: number;
  pctReceived: number;
}

export interface NightSideRoll {
  side: Side;
  /** The faction(s) this side played, in round order. */
  factions: Team[];
  kills: number;
  deaths: number;
  fielded: number;
  casualtiesByFormation: FormationCounts;
  killsByFormation: FormationCounts;
  ticketsLost: number;
  avgTd: number | null;
  avgTk: number | null;
  killsByCause: Record<string, number>;
  casualtiesByCause: Record<string, number>;
  units: NightUnitRoll[];
}

export interface NightRollup {
  roundsImported: number;
  A: NightSideRoll;
  B: NightSideRoll;
  rows: (SpineRow | SpineTextRow)[];
}

const emptySide = (side: Side): NightSideRoll => ({
  side,
  factions: [],
  kills: 0,
  deaths: 0,
  fielded: 0,
  casualtiesByFormation: emptyForm(),
  killsByFormation: emptyForm(),
  ticketsLost: 0,
  avgTd: null,
  avgTk: null,
  killsByCause: {},
  casualtiesByCause: {},
  units: [],
});

const bump = (m: Record<string, number>, key: string, n = 1) => {
  m[key] = (m[key] ?? 0) + n;
};

/**
 * Roll the night's imported scoreboards up onto the two sides.
 *
 * Every figure is read per faction from the scoreboard and then filed under the
 * side that played that faction *in that round*, so a flipped round lands on
 * the right team. Kills are counted from the killfeed rather than the player
 * table so a unit's kills and the causes behind them come from one source.
 */
export function rollupNight(
  rounds: NightRoundScoreboard[],
  assignments: RegimentAssignmentMap = {},
  options: EngineOptions = {},
): NightRollup {
  const A = emptySide('A');
  const B = emptySide('B');
  const units = new Map<string, NightUnitRoll & { _rounds: Set<string> }>();

  const unitRow = (unit: string, side: Side) => {
    const key = `${side}:${unit}`;
    let row = units.get(key);
    if (!row) {
      row = {
        unit,
        side,
        rounds: 0,
        fielded: 0,
        kills: 0,
        deaths: 0,
        kd: 0,
        casualtiesByFormation: emptyForm(),
        killsByFormation: emptyForm(),
        avgTd: null,
        avgTk: null,
        killRate: null,
        lossRate: null,
        ticketsInflicted: 0,
        ticketsReceived: 0,
        pctInflicted: 0,
        pctReceived: 0,
        _rounds: new Set<string>(),
      };
      units.set(key, row);
    }
    return row;
  };

  for (const { sb, factionA } of rounds) {
    const sideOf = (t: Team): Side => (t === factionA ? 'A' : 'B');
    A.factions.push(factionA);
    B.factions.push(factionA === 'USA' ? 'CSA' : 'USA');

    for (const team of ['USA', 'CSA'] as const) {
      const roll = sideOf(team) === 'A' ? A : B;
      const c = sb.meta.casualties[team];
      roll.casualtiesByFormation.in_form += c.inForm;
      roll.casualtiesByFormation.skirm += c.skirm;
      roll.casualtiesByFormation.oob += c.oob;
    }

    for (const p of sb.players) {
      const side = sideOf(p.team);
      const roll = side === 'A' ? A : B;
      roll.kills += p.kills;
      roll.deaths += p.deaths;
      roll.fielded += 1;
      const unit = resolveFor(p.steamId, p.name, assignments, options.regimentList, options.aliasMap);
      const row = unitRow(unit, side);
      row._rounds.add(sb.sourceFilename);
      row.fielded += 1;
      row.kills += p.kills;
      row.deaths += p.deaths;
      row.casualtiesByFormation.in_form += p.deathsInForm;
      row.casualtiesByFormation.skirm += p.deathsSkirm;
      row.casualtiesByFormation.oob += p.deathsOob;
    }

    // Both cause tables come off the killfeed rather than the meta block's
    // deaths-by-weapon: the two use different names for the same thing ("Round"
    // vs "Round Shot"), so reading one from each would put a night's kills and
    // deaths in vocabularies that don't line up. The killfeed also carries the
    // victim's stance, which is what a kill was worth in tickets, and the
    // environment deaths that have no killer.
    for (const k of sb.kills) {
      if (k.victimTeam) {
        const vRoll = sideOf(k.victimTeam) === 'A' ? A : B;
        bump(vRoll.casualtiesByCause, k.cause || 'Unknown');
      }
      if (!k.killer || !k.killerTeam) continue;
      const side = sideOf(k.killerTeam);
      const roll = side === 'A' ? A : B;
      bump(roll.killsByCause, k.cause || 'Unknown');
      if (k.victimFormation) roll.killsByFormation[k.victimFormation] += 1;
      const unit = resolveFor(k.killerSteamId, k.killer, assignments, options.regimentList, options.aliasMap);
      const row = units.get(`${side}:${unit}`);
      if (row && k.victimFormation) row.killsByFormation[k.victimFormation] += 1;
    }
  }

  for (const roll of [A, B]) {
    const c = roll.casualtiesByFormation;
    const k = roll.killsByFormation;
    roll.ticketsLost = ticketsOf(c);
    roll.avgTd = avgTicketCost(c.in_form, c.skirm, c.oob);
    roll.avgTk = avgTicketCost(k.in_form, k.skirm, k.oob);
  }

  for (const row of units.values()) {
    row.rounds = row._rounds.size;
    row.kd = row.deaths > 0 ? row.kills / row.deaths : row.kills;
    row.avgTd = avgTicketCost(
      row.casualtiesByFormation.in_form,
      row.casualtiesByFormation.skirm,
      row.casualtiesByFormation.oob,
    );
    row.avgTk = avgTicketCost(
      row.killsByFormation.in_form,
      row.killsByFormation.skirm,
      row.killsByFormation.oob,
    );
    row.killRate = perPlayerRate(row.kills, row.fielded);
    row.lossRate = perPlayerRate(row.deaths, row.fielded);
    row.ticketsInflicted = ticketsOf(row.killsByFormation);
    row.ticketsReceived = ticketsOf(row.casualtiesByFormation);
    const roll = row.side === 'A' ? A : B;
    roll.units.push(row);
  }

  for (const roll of [A, B]) {
    const inflicted = roll.units.reduce((n, u) => n + u.ticketsInflicted, 0);
    const received = roll.units.reduce((n, u) => n + u.ticketsReceived, 0);
    for (const u of roll.units) {
      u.pctInflicted = inflicted > 0 ? Math.round((u.ticketsInflicted / inflicted) * 100) : 0;
      u.pctReceived = received > 0 ? Math.round((u.ticketsReceived / received) * 100) : 0;
    }
    roll.units.sort((a, b) => b.ticketsInflicted - a.ticketsInflicted || b.kills - a.kills);
  }

  return { roundsImported: rounds.length, A, B, rows: rollupRows(A, B) };
}

/** The roll-up as one line per metric, in the same shape the round matchup uses. */
export function rollupRows(A: NightSideRoll, B: NightSideRoll): (SpineRow | SpineTextRow)[] {
  const rows: (SpineRow | SpineTextRow)[] = [
    { label: 'Kills', a: A.kills, b: B.kills },
    { label: 'Casualties', sub: 'lower is better', a: A.deaths, b: B.deaths, lower: true },
    { label: 'Ticket damage dealt', sub: 'stance weighted', a: B.ticketsLost, b: A.ticketsLost },
    {
      label: 'Held the line',
      sub: '% of losses, in formation',
      a: pct(A.casualtiesByFormation.in_form, A.deaths),
      b: pct(B.casualtiesByFormation.in_form, B.deaths),
      aText: `${pct(A.casualtiesByFormation.in_form, A.deaths)}%`,
      bText: `${pct(B.casualtiesByFormation.in_form, B.deaths)}%`,
    },
    {
      label: 'Caught out of line',
      sub: '% of losses · lower better',
      a: pct(A.casualtiesByFormation.oob, A.deaths),
      b: pct(B.casualtiesByFormation.oob, B.deaths),
      aText: `${pct(A.casualtiesByFormation.oob, A.deaths)}%`,
      bText: `${pct(B.casualtiesByFormation.oob, B.deaths)}%`,
      lower: true,
    },
  ];
  if (A.avgTd != null && B.avgTd != null) {
    rows.push({
      label: 'Cost per death',
      sub: 'tickets · lower better',
      a: A.avgTd,
      b: B.avgTd,
      aText: A.avgTd.toFixed(1),
      bText: B.avgTd.toFixed(1),
      lower: true,
    });
  }
  if (A.avgTk != null && B.avgTk != null) {
    rows.push({
      label: 'Value per kill',
      sub: 'tickets drained',
      a: A.avgTk,
      b: B.avgTk,
      aText: A.avgTk.toFixed(1),
      bText: B.avgTk.toFixed(1),
    });
  }
  rows.push({ label: 'Units fielded', a: A.units.length, b: B.units.length });
  return rows;
}

// ── Notes ──────────────────────────────────────────────────────────────────

export interface NightKey {
  side: Side | null;
  title: string;
  body: string;
}

/**
 * Plain-language notes about the night, from the recorded results. Empty until
 * a round has been played, because there is nothing to say yet.
 */
export function nightKeys(w: NightWeek): NightKey[] {
  const s = nightScore(w);
  if (s.played === 0) return [];
  const type = nightType(w);
  const keys: NightKey[] = [];
  const rounds = nightRounds(w);

  if (s.sweep) {
    const leads = hasPerRoundLeads(type)
      ? [leadsFor(w, 1)[s.sweep], leadsFor(w, 2)[s.sweep]].filter(Boolean)
      : [s.sweep === 'A' ? w.leadA : w.leadB].filter(Boolean);
    keys.push({
      side: s.sweep,
      title: '2–0 sweep',
      body:
        `Team ${s.sweep} took both rounds` +
        (leads.length ? ` under ${leads.join(' and ')}` : '') +
        (nightAwardsPoints(type)
          ? '. Every unit on the winning side in both rounds collects the sweep bonus.'
          : type === 'Playoffs'
            ? '. Playoff nights award no points — the sweep counts for the bracket, not the table.'
            : '.'),
    });
  } else if (s.played === 2) {
    keys.push({
      side: null,
      title: 'Split night',
      body: 'One round each. No sweep bonus, and the night is even on rounds won.',
    });
  }

  if (s.casualtiesA > 0 || s.casualtiesB > 0) {
    const gap = Math.abs(s.casualtiesA - s.casualtiesB);
    const heavier: Side = s.casualtiesA > s.casualtiesB ? 'A' : 'B';
    keys.push({
      side: gap === 0 ? null : otherSide(heavier),
      title: 'The casualty ledger',
      body:
        gap === 0
          ? `Both sides gave up ${s.casualtiesA} men across the night — dead even on bodies.`
          : `Team ${otherSide(heavier)} put down ${gap} more men across the night — ` +
            `${heavier === 'A' ? s.casualtiesA : s.casualtiesB} against ` +
            `${heavier === 'A' ? s.casualtiesB : s.casualtiesA}.` +
            (s.winner && s.winner !== otherSide(heavier)
              ? ` Team ${s.winner} still took the night, so the rounds went the other way from the bodies.`
              : ''),
    });
  }

  const flipped = rounds.filter((r) => r.played && r.flipped);
  if (flipped.length === 1) {
    keys.push({
      side: null,
      title: 'Sides flipped',
      body:
        `Round ${flipped[0].round} was played with the sides swapped — Team A took the field as ` +
        `${flipped[0].factionA}. Faction totals across the night are not one team's.`,
    });
  }

  if (type === 'Fun round') {
    keys.push({
      side: null,
      title: 'Exhibition',
      body: 'Fun rounds award no points and set no record. The map does not go on cooldown either.',
    });
  }
  return keys;
}
