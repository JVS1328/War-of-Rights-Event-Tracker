/**
 * Head-to-head comparison of two players or two units.
 *
 * The tracker can rank and it can merge, but it has never been able to put two
 * things side by side. These build the rows for the mirrored spine and read a
 * verdict off them.
 *
 * A row is only included when both sides have the figure. Ticket averages are
 * null until someone has actually died or killed, and a row comparing a number
 * against nothing is worse than no row.
 */
import type { PlayerStatRow, RegimentStatRow, FormationCounts } from './statsEngine';
import type { SpineRow } from '../components/ui/spineModel';
import { tally } from '../components/ui/spineModel';

const pct = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

/** Push a row only when both sides have a value. */
function pair(
  rows: SpineRow[],
  label: string,
  a: number | null,
  b: number | null,
  opts: { sub?: string; lower?: boolean; format?: (v: number) => string } = {},
): void {
  if (a == null || b == null) return;
  const f = opts.format;
  rows.push({
    label,
    sub: opts.sub,
    a,
    b,
    lower: opts.lower,
    ...(f ? { aText: f(a), bText: f(b) } : {}),
  });
}

const one = (v: number) => v.toFixed(1);
const two = (v: number) => v.toFixed(2);
const asPct = (v: number) => `${v}%`;

/** Per-round rate, or null when nothing was played. */
const perRound = (total: number, rounds: number) => (rounds > 0 ? total / rounds : null);

export function comparePlayers(a: PlayerStatRow, b: PlayerStatRow): SpineRow[] {
  const rows: SpineRow[] = [];
  pair(rows, 'Rounds', a.rounds, b.rounds);
  pair(rows, 'Kills', a.kills, b.kills);
  pair(rows, 'Kills per round', perRound(a.kills, a.rounds), perRound(b.kills, b.rounds), { format: one });
  pair(rows, 'Deaths', a.deaths, b.deaths, { lower: true });
  pair(rows, 'Deaths per round', perRound(a.deaths, a.rounds), perRound(b.deaths, b.rounds), {
    lower: true,
    format: one,
  });
  pair(rows, 'K/D', a.kd, b.kd, { format: two });
  pair(rows, 'Cost per death', a.avgTd, b.avgTd, { sub: 'tickets · lower better', lower: true, format: one });
  pair(rows, 'Value per kill', a.avgTk, b.avgTk, { sub: 'tickets · higher better', format: one });
  pair(rows, 'Died in formation', pct(a.deathsInForm, a.deaths), pct(b.deathsInForm, b.deaths), {
    sub: '% of own deaths',
    format: asPct,
  });
  pair(rows, 'Died out of line', pct(a.deathsOob, a.deaths), pct(b.deathsOob, b.deaths), {
    sub: '% · lower better',
    lower: true,
    format: asPct,
  });
  pair(rows, 'Kills out of line', pct(a.killsOob, a.kills), pct(b.killsOob, b.kills), {
    sub: '% — victims caught loose',
    format: asPct,
  });
  return rows;
}

const formTotal = (f: FormationCounts) => f.in_form + f.skirm + f.oob;

export function compareRegiments(a: RegimentStatRow, b: RegimentStatRow): SpineRow[] {
  const rows: SpineRow[] = [];
  pair(rows, 'Rounds', a.rounds, b.rounds);
  pair(rows, 'Men seen', a.players, b.players);
  pair(rows, 'Avg fielded', a.avgPlayers, b.avgPlayers, { sub: 'men a round', format: one });
  pair(rows, 'Kills', a.kills, b.kills);
  pair(rows, 'Losses', a.deaths, b.deaths, { lower: true });
  pair(rows, 'K/D', a.kd, b.kd, { format: two });
  pair(rows, 'Kills per man', a.killRate, b.killRate, { sub: 'size-normalised', format: two });
  pair(rows, 'Losses per man', a.lossRate, b.lossRate, { sub: 'lower is better', lower: true, format: two });
  pair(rows, 'Cost per death', a.avgTd, b.avgTd, { sub: 'tickets · lower better', lower: true, format: one });
  pair(rows, 'Value per kill', a.avgTk, b.avgTk, { sub: 'tickets · higher better', format: one });
  pair(
    rows,
    'Held the line',
    pct(a.casualtiesByFormation.in_form, formTotal(a.casualtiesByFormation)),
    pct(b.casualtiesByFormation.in_form, formTotal(b.casualtiesByFormation)),
    { sub: '% of losses, in formation', format: asPct },
  );
  pair(
    rows,
    'Caught out of line',
    pct(a.casualtiesByFormation.oob, formTotal(a.casualtiesByFormation)),
    pct(b.casualtiesByFormation.oob, formTotal(b.casualtiesByFormation)),
    { sub: '% · lower better', lower: true, format: asPct },
  );
  return rows;
}

export interface CompareVerdict {
  aWins: number;
  bWins: number;
  tied: number;
  /** Which side took more categories; null when they split evenly. */
  leader: 'a' | 'b' | null;
  /** One sentence naming the leader and the margin. */
  summary: string;
}

export function compareVerdict(rows: SpineRow[], aName: string, bName: string): CompareVerdict {
  const { a, b, tied } = tally(rows);
  const leader = a === b ? null : a > b ? 'a' : 'b';
  const total = rows.length;
  const summary =
    total === 0
      ? 'Not enough shared data to compare these two yet.'
      : leader === null
        ? `${aName} and ${bName} split it ${a}–${b}${tied ? ` with ${tied} tied` : ''}.`
        : `${leader === 'a' ? aName : bName} takes ${Math.max(a, b)} of ${total} categories.`;
  return { aWins: a, bWins: b, tied, leader, summary };
}
