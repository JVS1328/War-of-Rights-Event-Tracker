/**
 * The season's Elo ladder: where every unit ended up, and how it got there.
 *
 * The standings already show a rating and this week's change. What they can't
 * show is the shape of a season — a unit that climbed steadily and one that
 * spiked in week 3 and gave it all back read identically at the final number.
 * So each row carries its whole series, and the ladder draws it.
 *
 * Pure. The caller replays the Elo engine once per week and hands the results
 * in; nothing here knows how a rating is computed.
 */

export interface EloLadderInput {
  /** Units to rank. A unit with no rating at any point sits at the initial one. */
  units: string[];
  initialElo: number;
  /** Ratings after each week, oldest first. */
  weekElo: Record<string, number>[];
  /** Rounds each unit has played, for the provisional marker. */
  roundsPlayed?: Record<string, number>;
  /** Rounds below which a rating is still provisional. 0 disables the marker. */
  provisionalRounds?: number;
}

export interface EloLadderRow {
  rank: number;
  unit: string;
  /** Rating after the last week. */
  elo: number;
  /** Rating before the first week — the initial rating for everyone. */
  start: number;
  change: number;
  peak: number;
  trough: number;
  rounds: number;
  /** True while the unit has played too few rounds for the rating to settle. */
  provisional: boolean;
  /** One point per week, plus the starting rating at the front. */
  series: number[];
  /** Places gained since the week before last. Null with fewer than two weeks. */
  rankChange: number | null;
}

const rankOf = (elo: Record<string, number>, units: string[], initial: number): Record<string, number> => {
  const order = [...units].sort(
    (a, b) => (elo[b] ?? initial) - (elo[a] ?? initial) || a.localeCompare(b),
  );
  const out: Record<string, number> = {};
  order.forEach((u, i) => {
    out[u] = i + 1;
  });
  return out;
};

export function buildEloLadder(input: EloLadderInput): EloLadderRow[] {
  const { units, initialElo, weekElo, roundsPlayed = {}, provisionalRounds = 0 } = input;
  const last = weekElo[weekElo.length - 1] ?? {};
  const prev = weekElo[weekElo.length - 2] ?? null;

  const nowRanks = rankOf(last, units, initialElo);
  const prevRanks = prev ? rankOf(prev, units, initialElo) : null;

  const rows: EloLadderRow[] = units.map((unit) => {
    // The starting rating leads the series so a unit's first week reads as a
    // change rather than as a flat line from nowhere.
    const series = [initialElo, ...weekElo.map((w) => w[unit] ?? initialElo)];
    const elo = series[series.length - 1];
    const rounds = roundsPlayed[unit] ?? 0;
    return {
      rank: nowRanks[unit] ?? units.length,
      unit,
      elo,
      start: initialElo,
      change: elo - initialElo,
      peak: Math.max(...series),
      trough: Math.min(...series),
      rounds,
      provisional: provisionalRounds > 0 && rounds < provisionalRounds,
      series,
      rankChange: prevRanks ? (prevRanks[unit] ?? 0) - (nowRanks[unit] ?? 0) : null,
    };
  });

  rows.sort((a, b) => a.rank - b.rank);
  return rows;
}

/**
 * An SVG polyline for a series, scaled to fill the box. A flat series draws
 * along the middle rather than at the bottom, since "no movement" is not "the
 * lowest rating in the league".
 */
export function sparklinePoints(series: number[], width: number, height: number, pad = 1): string {
  if (series.length === 0) return '';
  const lo = Math.min(...series);
  const hi = Math.max(...series);
  const span = hi - lo;
  const innerH = Math.max(0, height - pad * 2);
  const x = (i: number) =>
    series.length === 1 ? width / 2 : (i / (series.length - 1)) * width;
  const y = (v: number) => (span === 0 ? height / 2 : pad + innerH - ((v - lo) / span) * innerH);
  return series.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
}

/** Rating movement as a signed string, with an en dash for no change. */
export const formatChange = (n: number): string =>
  n === 0 ? '–' : `${n > 0 ? '+' : '−'}${Math.abs(Math.round(n))}`;
