/**
 * Reading a season schedule someone else already made.
 *
 * Leagues plan their fixtures in a spreadsheet long before the tracker sees
 * them, so the schedule maker takes a paste rather than insisting the schedule
 * be built here. Columns are Week, Round, Home, Away, Date, in any order, with
 * or without a header row, tab- or comma-separated — or, when a paste has lost
 * its tabs on the way through a chat window or a rich-text field, separated by
 * nothing but spaces. That last case is ambiguous and is recovered separately;
 * see {@link parseLooseRow}.
 *
 * Home picks the map and away picks the side, so home is side A and away is
 * side B — which makes the paste a lead assignment, not just a fixture list.
 *
 * The audit is the other half: a league usually wants each unit to lead the
 * same number of times home and away, and — when leads are set per round —
 * to have those split across round 1 and round 2 rather than always leading
 * the same one. That is checked here and reported as data.
 */
import type { LeadMode } from './leadSchedule';

export interface ScheduleRow {
  /** 1-based line number in the pasted text, for pointing at a bad row. */
  line: number;
  week: number;
  /** Which round of the night. Always 1 when leads are set per night. */
  round: 1 | 2;
  home: string;
  away: string;
  /** Whatever the sheet had, kept verbatim — leagues use every date format. */
  date: string;
}

export type ScheduleProblem =
  | { kind: 'unparsable'; line: number; text: string }
  | { kind: 'unknown-unit'; line: number; name: string }
  | { kind: 'self-match'; line: number; unit: string }
  | { kind: 'duplicate-round'; week: number; round: 1 | 2 }
  | { kind: 'double-booked'; week: number; round: 1 | 2; unit: string }
  | { kind: 'missing-round'; week: number; round: 1 | 2 }
  | { kind: 'home-count'; unit: string; got: number; want: number }
  | { kind: 'away-count'; unit: string; got: number; want: number }
  | { kind: 'round-split'; unit: string; side: 'home' | 'away'; r1: number; r2: number };

export interface UnitTally {
  unit: string;
  home: number;
  away: number;
  homeR1: number;
  homeR2: number;
  awayR1: number;
  awayR2: number;
  /** Lead rounds in total — home + away. */
  total: number;
}

export interface ParsedSchedule {
  rows: ScheduleRow[];
  problems: ScheduleProblem[];
  /** Units seen in the paste that matched nothing in the registry. */
  unmatched: string[];
  weeks: number[];
}

const HEADER_WORDS = ['week', 'round', 'home', 'away', 'date'] as const;
type Column = (typeof HEADER_WORDS)[number];

/** Split on tabs first; fall back to commas so a CSV paste works too. */
const splitCells = (line: string): string[] => {
  const cells = line.includes('\t') ? line.split('\t') : line.split(',');
  return cells.map((c) => c.trim());
};

const normalize = (s: string) =>
  s.toLowerCase().replace(/[\s\-()._]/g, '');

/**
 * Match a pasted name against the registry: exact, then ignoring spacing and
 * punctuation, then either containing the other. The same ladder the coord
 * sheet importer uses, so a name that works in one works in the other.
 */
export function matchUnit(name: string, registry: string[]): string | null {
  return matchUnitScored(name, registry).unit;
}

/**
 * The same match, with how sure it is: 3 exact, 2 equal once spacing and
 * punctuation are ignored, 1 one contains the other, 0 no match.
 *
 * The confidence is what makes a whitespace paste recoverable. "8th" alone
 * substring-matches "8th OH", so a first-match-wins split of "8th OH II Corps"
 * would happily read it as "8th" versus "OH II Corps". Scoring the candidate
 * splits and taking the most confident one gets the right answer instead.
 */
export function matchUnitScored(
  name: string,
  registry: string[],
): { unit: string | null; score: number } {
  const raw = name.trim();
  if (!raw) return { unit: null, score: 0 };
  const exact = registry.find((u) => u === raw);
  if (exact) return { unit: exact, score: 3 };
  const n = normalize(raw);
  const norm = registry.find((u) => normalize(u) === n);
  if (norm) return { unit: norm, score: 2 };
  const sub = registry.find((u) => normalize(u).includes(n) || n.includes(normalize(u)));
  return sub ? { unit: sub, score: 1 } : { unit: null, score: 0 };
}

/** "Week 12", "W12", "12" → 12. Null when there is no number in it. */
export function readNumber(cell: string): number | null {
  const m = cell.match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

/** Header row → column order, or null when the first row is data. */
function readHeader(cells: string[]): Column[] | null {
  const cols = cells.map((c) => normalize(c));
  const hit = cols.filter((c) => (HEADER_WORDS as readonly string[]).includes(c));
  // Two recognised words is enough to call it a header; one could be a unit
  // named "Home" or a week called "Round 1".
  if (hit.length < 2) return null;
  return cols.map((c) => ((HEADER_WORDS as readonly string[]).includes(c) ? (c as Column) : 'date'));
}

const DEFAULT_ORDER: Column[] = ['week', 'round', 'home', 'away', 'date'];

/** 8/5/2026, 2026-08-05, 5.8.26 — enough to tell a date from a unit name. */
const DATE_LIKE = /^\d{1,4}[/.-]\d{1,2}([/.-]\d{2,4})?$/;
/** R1, R2, 1, 2, Rd1 — a round label, as distinct from part of a unit name. */
const ROUND_LIKE = /^(r|rd|round)?[.\s]*[12]$/i;

/**
 * Recover a row from a paste that arrived with its tabs flattened to spaces —
 * which is what happens whenever a spreadsheet is copied through a chat window,
 * an issue tracker, or anything else that treats a tab as whitespace.
 *
 * Whitespace alone cannot be split on, because unit names contain spaces:
 * "1 R1 8th OH II Corps 8/5/2026" has four tokens in the middle and two units
 * in it, and nothing about the text says where one ends. So the row is read
 * from its ends inward — the week leads, a round label may follow it, a
 * date-shaped token may trail — and the registry decides where what is left
 * divides. Every split is tried and the most confident one wins.
 *
 * Returns null when the middle cannot be divided into two known units, so the
 * caller can report the row rather than invent a fixture from it.
 */
function parseLooseRow(
  raw: string,
  registry: string[],
  hasRound: boolean,
): { week: number; round: 1 | 2; home: string; away: string; date: string; middle: string } | null {
  const tok = raw.trim().split(/\s+/).filter(Boolean);
  if (tok.length < 3) return null;

  let i = 0;
  const week = readNumber(tok[i] ?? '');
  if (week == null) return null;
  i += 1;

  // A round label only counts when there is still enough left for two names.
  let round: 1 | 2 = 1;
  if ((hasRound || ROUND_LIKE.test(tok[i] ?? '')) && ROUND_LIKE.test(tok[i] ?? '') && tok.length - i > 2) {
    round = readNumber(tok[i]) === 2 ? 2 : 1;
    i += 1;
  }

  let end = tok.length;
  let date = '';
  if (DATE_LIKE.test(tok[end - 1] ?? '') && end - i > 1) {
    date = tok[end - 1];
    end -= 1;
  }

  const middle = tok.slice(i, end);
  if (middle.length < 2) return null;

  // Every place the two names could divide, scored by how sure both halves are.
  let best: { home: string; away: string; score: number } | null = null;
  for (let cut = 1; cut < middle.length; cut += 1) {
    const h = matchUnitScored(middle.slice(0, cut).join(' '), registry);
    const a = matchUnitScored(middle.slice(cut).join(' '), registry);
    if (!h.unit || !a.unit) continue;
    const score = h.score + a.score;
    if (!best || score > best.score) best = { home: h.unit, away: a.unit, score };
  }
  if (!best) return null;
  return { week, round, home: best.home, away: best.away, date, middle: middle.join(' ') };
}

/**
 * Parse a pasted schedule. Rows that cannot be read are reported rather than
 * dropped silently, and unit names are matched against the registry so a
 * misspelling surfaces here instead of creating a phantom unit later.
 */
export function parseSchedulePaste(text: string, registry: string[]): ParsedSchedule {
  const lines = text.split(/\r?\n/);
  const rows: ScheduleRow[] = [];
  const problems: ScheduleProblem[] = [];
  const unmatched = new Set<string>();
  let order: Column[] | null = null;
  // Whether a header told us there is a round column. Only consulted on the
  // whitespace path, where the columns cannot be counted.
  let headerHasRound = true;

  lines.forEach((raw, i) => {
    const line = i + 1;
    if (!raw.trim()) return;
    const cells = splitCells(raw);
    if (!order) {
      // A header may have lost its tabs along with the rows, so try the strict
      // split first and fall back to whitespace before giving up on it.
      const header = readHeader(cells) ?? readHeader(raw.trim().split(/\s+/));
      if (header) {
        order = header;
        headerHasRound = header.includes('round');
        return;
      }
      order = DEFAULT_ORDER;
    }

    // Fewer than three cells means the separators are gone; recover from the
    // ends inward instead of reporting a row that is perfectly readable by eye.
    if (cells.length < 3) {
      const loose = parseLooseRow(raw, registry, headerHasRound);
      if (!loose) {
        problems.push({ kind: 'unparsable', line, text: raw.trim() });
        return;
      }
      if (loose.home === loose.away) {
        problems.push({ kind: 'self-match', line, unit: loose.home });
        return;
      }
      rows.push({ line, week: loose.week, round: loose.round, home: loose.home, away: loose.away, date: loose.date });
      return;
    }

    const at = (col: Column) => {
      const idx = order!.indexOf(col);
      return idx >= 0 ? cells[idx] ?? '' : '';
    };

    const week = readNumber(at('week'));
    const homeRaw = at('home');
    const awayRaw = at('away');
    if (week == null || !homeRaw || !awayRaw) {
      problems.push({ kind: 'unparsable', line, text: raw.trim() });
      return;
    }
    // A schedule with leads set per night has no round column; default to 1 so
    // those rows still land, and the audit treats the night as one assignment.
    const round = readNumber(at('round')) === 2 ? 2 : 1;

    const home = matchUnit(homeRaw, registry);
    const away = matchUnit(awayRaw, registry);
    for (const [nameRaw, matched] of [
      [homeRaw, home],
      [awayRaw, away],
    ] as const) {
      if (!matched) {
        problems.push({ kind: 'unknown-unit', line, name: nameRaw });
        unmatched.add(nameRaw);
      }
    }
    if (!home || !away) return;
    if (home === away) {
      problems.push({ kind: 'self-match', line, unit: home });
      return;
    }
    rows.push({ line, week, round, home, away, date: at('date') });
  });

  const weeks = [...new Set(rows.map((r) => r.week))].sort((a, b) => a - b);
  return { rows, problems, unmatched: [...unmatched], weeks };
}

export interface ScheduleConstraints {
  /** 'rounds' gives four lead slots a night; 'fullWeeks' gives two. */
  mode: LeadMode;
  /** Lead rounds each unit should have at home. 0 turns the check off. */
  homePerUnit: number;
  awayPerUnit: number;
  /**
   * With per-round leads, require each unit's home leads to be spread across
   * round 1 and round 2 rather than always falling on the same one — and the
   * same for its away leads. Meaningless when leads are set per night, so the
   * audit ignores it in that mode.
   */
  splitAcrossRounds: boolean;
}

export interface ScheduleAudit {
  tallies: UnitTally[];
  problems: ScheduleProblem[];
  /** True when nothing was found to complain about. */
  ok: boolean;
  /** Rounds each night is expected to have: 2 per-round, 1 per-night. */
  roundsPerNight: 1 | 2;
}

const emptyTally = (unit: string): UnitTally => ({
  unit,
  home: 0,
  away: 0,
  homeR1: 0,
  homeR2: 0,
  awayR1: 0,
  awayR2: 0,
  total: 0,
});

/**
 * Check a parsed schedule against the league's home/away plan.
 *
 * Every unit in `registry` gets a row even if the paste never mentions it —
 * a unit with no fixtures is exactly what the count check exists to catch.
 */
export function auditSchedule(
  rows: ScheduleRow[],
  registry: string[],
  c: ScheduleConstraints,
): ScheduleAudit {
  const perRound = c.mode === 'rounds';
  const roundsPerNight: 1 | 2 = perRound ? 2 : 1;
  const problems: ScheduleProblem[] = [];
  const tallies = new Map<string, UnitTally>();
  const ensure = (u: string) => {
    let t = tallies.get(u);
    if (!t) {
      t = emptyTally(u);
      tallies.set(u, t);
    }
    return t;
  };
  for (const u of registry) ensure(u);

  // Per-night leads mean the round column carries no information, so every row
  // is filed as round 1 and a night is one fixture rather than two.
  const roundOf = (r: ScheduleRow): 1 | 2 => (perRound ? r.round : 1);

  const seenSlot = new Set<string>();
  const inSlot = new Map<string, Set<string>>();
  for (const r of rows) {
    const round = roundOf(r);
    const slot = `${r.week}:${round}`;
    if (seenSlot.has(slot)) problems.push({ kind: 'duplicate-round', week: r.week, round });
    seenSlot.add(slot);

    let occupants = inSlot.get(slot);
    if (!occupants) {
      occupants = new Set();
      inSlot.set(slot, occupants);
    }
    for (const u of [r.home, r.away]) {
      if (occupants.has(u)) problems.push({ kind: 'double-booked', week: r.week, round, unit: u });
      occupants.add(u);
    }

    const h = ensure(r.home);
    h.home += 1;
    h.total += 1;
    if (round === 1) h.homeR1 += 1;
    else h.homeR2 += 1;

    const a = ensure(r.away);
    a.away += 1;
    a.total += 1;
    if (round === 1) a.awayR1 += 1;
    else a.awayR2 += 1;
  }

  // Every week the paste mentions should have both of its rounds.
  if (perRound) {
    for (const week of [...new Set(rows.map((r) => r.week))].sort((x, y) => x - y)) {
      for (const round of [1, 2] as const) {
        if (!seenSlot.has(`${week}:${round}`)) problems.push({ kind: 'missing-round', week, round });
      }
    }
  }

  const list = [...tallies.values()].sort((a, b) => a.unit.localeCompare(b.unit));
  for (const t of list) {
    if (c.homePerUnit > 0 && t.home !== c.homePerUnit) {
      problems.push({ kind: 'home-count', unit: t.unit, got: t.home, want: c.homePerUnit });
    }
    if (c.awayPerUnit > 0 && t.away !== c.awayPerUnit) {
      problems.push({ kind: 'away-count', unit: t.unit, got: t.away, want: c.awayPerUnit });
    }
    if (perRound && c.splitAcrossRounds) {
      // An even number of leads should fall evenly across the two rounds; an
      // odd number can only ever be one apart, which is as split as it gets.
      const check = (side: 'home' | 'away', r1: number, r2: number) => {
        if (r1 + r2 === 0) return;
        if (Math.abs(r1 - r2) > (r1 + r2) % 2) {
          problems.push({ kind: 'round-split', unit: t.unit, side, r1, r2 });
        }
      };
      check('home', t.homeR1, t.homeR2);
      check('away', t.awayR1, t.awayR2);
    }
  }

  return { tallies: list, problems, ok: problems.length === 0, roundsPerNight };
}

/** One line per problem, for the audit list. */
export function describeProblem(p: ScheduleProblem): string {
  switch (p.kind) {
    case 'unparsable':
      return `Line ${p.line}: could not read "${p.text}" — expected week, round, home, away, date.`;
    case 'unknown-unit':
      return `Line ${p.line}: "${p.name}" matches no registered unit.`;
    case 'self-match':
      return `Line ${p.line}: ${p.unit} is down against itself.`;
    case 'duplicate-round':
      return `Week ${p.week} round ${p.round} appears more than once.`;
    case 'double-booked':
      return `${p.unit} leads twice in week ${p.week} round ${p.round}.`;
    case 'missing-round':
      return `Week ${p.week} has no round ${p.round}.`;
    case 'home-count':
      return `${p.unit} leads ${p.got} at home, not ${p.want}.`;
    case 'away-count':
      return `${p.unit} leads ${p.got} away, not ${p.want}.`;
    case 'round-split':
      return `${p.unit}'s ${p.side} leads are ${p.r1} in round 1 and ${p.r2} in round 2 — they should be split.`;
  }
}

/**
 * The tracker weeks a parsed schedule implies: one per week number, home on
 * side A and away on side B, with leads set per round or per night to match
 * the season's lead style.
 */
export interface ScheduleWeekDraft {
  week: number;
  name: string;
  date: string;
  teamA: string[];
  teamB: string[];
  leadA: string | null;
  leadB: string | null;
  leadA_r1: string | null;
  leadB_r1: string | null;
  leadA_r2: string | null;
  leadB_r2: string | null;
  isSingleRoundLeads: boolean;
}

export function scheduleWeeks(rows: ScheduleRow[], mode: LeadMode): ScheduleWeekDraft[] {
  const perRound = mode === 'rounds';
  const byWeek = new Map<number, ScheduleRow[]>();
  for (const r of rows) {
    const list = byWeek.get(r.week);
    if (list) list.push(r);
    else byWeek.set(r.week, [r]);
  }
  return [...byWeek.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([week, list]) => {
      const sorted = [...list].sort((a, b) => a.round - b.round);
      const r1 = sorted.find((r) => r.round === 1) ?? sorted[0];
      const r2 = perRound ? sorted.find((r) => r.round === 2) ?? null : null;
      const date = sorted.find((r) => r.date)?.date ?? '';
      // Side A is home throughout, so a unit that leads round 2 at home is on
      // side A for the night — the same side its round-1 counterpart holds.
      const teamA = [...new Set(sorted.map((r) => r.home))];
      const teamB = [...new Set(sorted.map((r) => r.away))];
      return {
        week,
        name: date ? `${date} - W${week}` : `Week ${week}`,
        date,
        teamA,
        teamB,
        leadA: perRound ? null : r1?.home ?? null,
        leadB: perRound ? null : r1?.away ?? null,
        leadA_r1: perRound ? r1?.home ?? null : null,
        leadB_r1: perRound ? r1?.away ?? null : null,
        leadA_r2: perRound ? r2?.home ?? null : null,
        leadB_r2: perRound ? r2?.away ?? null : null,
        isSingleRoundLeads: perRound,
      };
    });
}
