import { describe, it, expect } from 'vitest';
import { buildEloLadder, sparklinePoints, formatChange } from './eloLadder';

const UNITS = ['A', 'B', 'C'];

const ladder = (weekElo: Record<string, number>[], over = {}) =>
  buildEloLadder({ units: UNITS, initialElo: 1500, weekElo, ...over });

describe('buildEloLadder', () => {
  it('ranks by the last week’s rating', () => {
    const rows = ladder([{ A: 1450, B: 1600, C: 1520 }]);
    expect(rows.map((r) => r.unit)).toEqual(['B', 'C', 'A']);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it('breaks a tie on name, so the order does not wobble between renders', () => {
    const rows = ladder([{ A: 1500, B: 1500, C: 1500 }]);
    expect(rows.map((r) => r.unit)).toEqual(['A', 'B', 'C']);
  });

  it('leads the series with the starting rating', () => {
    const rows = ladder([{ A: 1520 }, { A: 1540 }]);
    const a = rows.find((r) => r.unit === 'A')!;
    expect(a.series).toEqual([1500, 1520, 1540]);
  });

  it('measures the change against the starting rating', () => {
    const a = ladder([{ A: 1540 }]).find((r) => r.unit === 'A')!;
    expect(a.start).toBe(1500);
    expect(a.change).toBe(40);
  });

  it('remembers the peak and trough, not just the ends', () => {
    // A spiked and gave it all back — the final number alone would hide that.
    const a = ladder([{ A: 1700 }, { A: 1500 }]).find((r) => r.unit === 'A')!;
    expect(a.elo).toBe(1500);
    expect(a.change).toBe(0);
    expect(a.peak).toBe(1700);
    expect(a.trough).toBe(1500);
  });

  it('sits a unit with no rating at the initial one rather than at zero', () => {
    const rows = ladder([{ A: 1600 }]);
    const b = rows.find((r) => r.unit === 'B')!;
    expect(b.elo).toBe(1500);
    expect(b.series).toEqual([1500, 1500]);
  });

  it('reports places gained since the week before', () => {
    // A ends first having been third.
    const rows = ladder([
      { A: 1400, B: 1600, C: 1500 },
      { A: 1700, B: 1600, C: 1500 },
    ]);
    expect(rows.find((r) => r.unit === 'A')!.rankChange).toBe(2);
    expect(rows.find((r) => r.unit === 'B')!.rankChange).toBe(-1);
    expect(rows.find((r) => r.unit === 'C')!.rankChange).toBe(-1);
  });

  it('has no rank change to report from a single week', () => {
    expect(ladder([{ A: 1600 }]).every((r) => r.rankChange === null)).toBe(true);
  });

  it('marks a rating as provisional until the rounds are in', () => {
    const rows = ladder([{ A: 1600 }], { roundsPlayed: { A: 4, B: 20 }, provisionalRounds: 10 });
    expect(rows.find((r) => r.unit === 'A')!.provisional).toBe(true);
    expect(rows.find((r) => r.unit === 'B')!.provisional).toBe(false);
  });

  it('leaves the marker off entirely when the season does not use one', () => {
    const rows = ladder([{ A: 1600 }], { roundsPlayed: { A: 0 }, provisionalRounds: 0 });
    expect(rows.every((r) => !r.provisional)).toBe(true);
  });

  it('handles a season with no weeks played yet', () => {
    const rows = ladder([]);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ elo: 1500, change: 0, series: [1500] });
  });
});

describe('sparklinePoints', () => {
  it('spans the full width, first point to last', () => {
    const pts = sparklinePoints([1, 2, 3], 90, 20).split(' ');
    expect(pts).toHaveLength(3);
    expect(Number(pts[0].split(',')[0])).toBe(0);
    expect(Number(pts[2].split(',')[0])).toBe(90);
  });

  it('puts the highest value near the top and the lowest near the bottom', () => {
    const [p0, , p2] = sparklinePoints([10, 20, 30], 90, 20).split(' ');
    const y0 = Number(p0.split(',')[1]);
    const y2 = Number(p2.split(',')[1]);
    expect(y2).toBeLessThan(y0);
  });

  it('draws a flat series down the middle, not along the floor', () => {
    // Zero movement is not "worst in the league", and a line on the axis reads
    // like it is.
    const pts = sparklinePoints([1500, 1500, 1500], 90, 20).split(' ');
    for (const p of pts) expect(Number(p.split(',')[1])).toBe(10);
  });

  it('centres a single point rather than pinning it to the left edge', () => {
    expect(sparklinePoints([1500], 90, 20)).toBe('45.0,10.0');
  });

  it('is empty for an empty series', () => {
    expect(sparklinePoints([], 90, 20)).toBe('');
  });

  it('keeps the line inside the box', () => {
    const pts = sparklinePoints([1400, 1600, 1500], 90, 20, 1);
    for (const p of pts.split(' ')) {
      const y = Number(p.split(',')[1]);
      expect(y).toBeGreaterThanOrEqual(1);
      expect(y).toBeLessThanOrEqual(19);
    }
  });
});

describe('formatChange', () => {
  it('signs a movement and rounds it', () => {
    expect(formatChange(12.4)).toBe('+12');
    expect(formatChange(-12.4)).toBe('−12');
  });

  it('says nothing happened rather than writing +0', () => {
    expect(formatChange(0)).toBe('–');
  });
});
