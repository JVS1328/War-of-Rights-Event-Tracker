import { describe, it, expect } from 'vitest';
import { balanceTeams } from '../utils/balanceTeams';
import { parseRosterPaste } from '../utils/companySplit';

// The standalone balancer is the engine plus a paste box. What is worth pinning
// down is the wiring between them: a spreadsheet paste becomes counts, a pinned
// unit stays where it was put, and a unit fielding nobody is left out.

const WEIGHTS = {
  teammate: 0, avgDiff: 1, regimentCount: 0.75,
  rangeSimilarity: 0.5, divisionOpposition: 0, postSeasonSkill: 0,
};

/** Mirrors the component: parse, then sum any unit listed more than once. */
const countsFrom = (text: string) => {
  const out: Record<string, { min: number; max: number }> = {};
  for (const entry of parseRosterPaste(text)) {
    const current = out[entry.unit];
    out[entry.unit] = current
      ? { min: current.min + entry.min, max: current.max + entry.max }
      : { min: entry.min, max: entry.max };
  }
  return out;
};

const split = (text: string, pins: Record<string, 'A' | 'B'> = {}, maxPlayerDiff = 10) => {
  const counts = countsFrom(text);
  const units = Object.keys(counts).sort();
  return balanceTeams({
    available: units,
    lockedA: units.filter((u) => pins[u] === 'A'),
    lockedB: units.filter((u) => pins[u] === 'B'),
    counts,
    opposingPairs: [],
    maxPlayerDiff,
    teammateHistory: {},
    weights: WEIGHTS,
    optionCount: 3,
  });
};

const PASTE = '7th SC\t8\t11\n1stLAR\t7\t10\nSB Arty\t4\t5\nPB\t22\t26';

describe('side balancer', () => {
  it('splits a pasted sheet into two sides of roughly equal size', () => {
    const result = split(PASTE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [best] = result.options;
    expect(best.avgDiff).toBeLessThanOrEqual(10);
    expect([...best.teamA, ...best.teamB].sort()).toEqual(['1stLAR', '7th SC', 'PB', 'SB Arty']);
  });

  it('holds a pinned unit on the side it was promised', () => {
    const result = split(PASTE, { PB: 'A', '7th SC': 'B' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const option of result.options) {
      expect(option.teamA).toContain('PB');
      expect(option.teamB).toContain('7th SC');
    }
  });

  it('adds up a unit that the sheet lists twice', () => {
    expect(countsFrom('PB\t10\t12\nPB\t12\t14')).toEqual({ PB: { min: 22, max: 26 } });
  });

  it('leaves a unit fielding nobody out of the split entirely', () => {
    const result = split(`${PASTE}\nWB Cav\t0\t0`);
    expect(result.satOut).toEqual(['WB Cav']);
    if (!result.ok) return;
    expect([...result.options[0].teamA, ...result.options[0].teamB]).not.toContain('WB Cav');
  });

  it('reports the closest split when nothing fits the tolerance', () => {
    const result = split('Tiny\t1\t1\nHuge\t90\t90', {}, 2);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.kind).toBe('no-valid');
  });

  it('refuses a contradiction rather than quietly picking a side', () => {
    // Pinning every unit to one side leaves the other empty, which the engine
    // still reports as a tolerance failure rather than a crash.
    const result = split(PASTE, { PB: 'A', '7th SC': 'A', '1stLAR': 'A', 'SB Arty': 'A' }, 1);
    expect(result.ok).toBe(false);
  });
});
