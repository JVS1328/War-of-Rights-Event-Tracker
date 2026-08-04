import { describe, it, expect } from 'vitest';
import { buildPairHeatmap, findPair, pairPct, heatColor, heatInk } from './pairHeatmap';
import type { TeamSides } from '../stats/nightMatchup';

const week = (A: string[], B: string[], swaps?: { r1?: string[]; r2?: string[] }): TeamSides => ({
  teamA: A,
  teamB: B,
  roundSwaps: swaps,
});

const pct = (weeks: TeamSides[], a: string, b: string, mode: 'together' | 'against') =>
  pairPct(findPair(buildPairHeatmap(weeks), a, b), mode);

describe('buildPairHeatmap', () => {
  it('counts both rounds of every night', () => {
    const m = buildPairHeatmap([week(['A', 'B'], ['C'])]);
    expect(m.rounds).toBe(2);
    expect(m.roundsPlayed).toEqual({ A: 2, B: 2, C: 2 });
  });

  it('counts a same-side pair as together, both rounds', () => {
    const c = findPair(buildPairHeatmap([week(['A', 'B'], ['C'])]), 'A', 'B')!;
    expect(c).toMatchObject({ together: 2, against: 0, bothActive: 2 });
  });

  it('counts an opposite-side pair as against', () => {
    const c = findPair(buildPairHeatmap([week(['A'], ['C'])]), 'A', 'C')!;
    expect(c).toMatchObject({ together: 0, against: 2, bothActive: 2 });
  });

  it('finds a pair given in either order', () => {
    const m = buildPairHeatmap([week(['A'], ['C'])]);
    expect(findPair(m, 'C', 'A')).toEqual(findPair(m, 'A', 'C'));
  });

  it('has nothing to say about a unit paired with itself', () => {
    expect(findPair(buildPairHeatmap([week(['A'], ['C'])]), 'A', 'A')).toBeNull();
  });

  it('follows a balance swap for the round it applied to', () => {
    // B starts on side A, swapped across for round 2 only: one round together
    // with A, one against.
    const c = findPair(buildPairHeatmap([week(['A', 'B'], ['C'], { r2: ['B'] })]), 'A', 'B')!;
    expect(c).toMatchObject({ together: 1, against: 1, bothActive: 2 });
  });

  it('lists the units it saw, sorted, and nobody else', () => {
    const m = buildPairHeatmap([week(['B'], ['A']), week(['A'], ['C'])]);
    expect(m.units).toEqual(['A', 'B', 'C']);
  });

  it('skips a week with nobody on either side', () => {
    const m = buildPairHeatmap([week([], []), week(['A'], ['B'])]);
    expect(m.rounds).toBe(2);
  });

  it('adds up across weeks', () => {
    const m = buildPairHeatmap([week(['A', 'B'], ['C']), week(['A'], ['B', 'C'])]);
    const ab = findPair(m, 'A', 'B')!;
    expect(ab).toMatchObject({ together: 2, against: 2, bothActive: 4 });
  });
});

describe('the denominator', () => {
  it('counts only rounds both units were actually on the field', () => {
    // A plays weeks 1–2, C plays weeks 3–4. They never met.
    const weeks = [week(['A'], ['B']), week(['A'], ['B']), week(['C'], ['B']), week(['C'], ['B'])];
    const ac = findPair(buildPairHeatmap(weeks), 'A', 'C');
    expect(ac).toBeNull();
  });

  it('has no percentage for a pair that never overlapped', () => {
    const weeks = [week(['A'], ['B']), week(['C'], ['D'])];
    expect(pct(weeks, 'A', 'C', 'together')).toBeNull();
  });

  it('does not read a non-overlap as 0% of the shorter career', () => {
    // The old grid took min(roundsPlayed) as the denominator, which turned
    // "never shared a round" into "shared four and were never teammates".
    const weeks = [week(['A'], ['B']), week(['A'], ['B']), week(['C'], ['D']), week(['C'], ['D'])];
    const m = buildPairHeatmap(weeks);
    expect(m.roundsPlayed.A).toBe(4);
    expect(m.roundsPlayed.C).toBe(4);
    expect(findPair(m, 'A', 'C')).toBeNull();
  });

  it('counts partial overlap as the rounds that overlapped', () => {
    const weeks = [week(['A'], ['B']), week(['A', 'C'], ['B'])];
    const ac = findPair(buildPairHeatmap(weeks), 'A', 'C')!;
    expect(ac.bothActive).toBe(2);
    expect(ac.together).toBe(2);
  });
});

describe('pairPct', () => {
  it('reads always-together as 100%', () => {
    expect(pct([week(['A', 'B'], ['C'])], 'A', 'B', 'together')).toBe(100);
  });

  it('reads always-against as 100% the other way', () => {
    expect(pct([week(['A'], ['B'])], 'A', 'B', 'against')).toBe(100);
    expect(pct([week(['A'], ['B'])], 'A', 'B', 'together')).toBe(0);
  });

  it('has the two modes add up to 100', () => {
    const weeks = [week(['A', 'B'], ['C']), week(['A'], ['B', 'C'])];
    const together = pct(weeks, 'A', 'B', 'together')!;
    const against = pct(weeks, 'A', 'B', 'against')!;
    expect(together + against).toBe(100);
    expect(together).toBe(50);
  });

  it('is null rather than zero for a missing pair', () => {
    expect(pairPct(null, 'together')).toBeNull();
  });
});

describe('heatColor', () => {
  it('starts at the tracker’s sky blue and ends at its red', () => {
    expect(heatColor(0)).toBe('rgb(135, 206, 235)');
    expect(heatColor(100)).toBe('rgb(220, 38, 38)');
  });

  it('passes through purple at the midpoint', () => {
    expect(heatColor(50)).toBe('rgb(147, 51, 235)');
  });

  it('clamps rather than extrapolating past the ends', () => {
    expect(heatColor(-20)).toBe(heatColor(0));
    expect(heatColor(140)).toBe(heatColor(100));
  });

  it('moves monotonically off blue as the share climbs', () => {
    const green = (p: number) => Number(heatColor(p).match(/,\s*(\d+),/)![1]);
    expect(green(0)).toBeGreaterThan(green(25));
    expect(green(25)).toBeGreaterThan(green(50));
  });

  it('switches the ink once the cell is dark enough to need it', () => {
    expect(heatInk(10)).not.toBe(heatInk(80));
  });
});
