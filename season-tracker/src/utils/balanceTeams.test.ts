import { describe, it, expect } from 'vitest';
import {
  balanceTeams,
  sitOuts,
  averageTeammateCount,
  describeFailure,
  MAX_FREE_UNITS,
  type BalanceInput,
  type BalanceWeights,
} from './balanceTeams';

const W = (over: Partial<BalanceWeights> = {}): BalanceWeights => ({
  teammate: 1,
  avgDiff: 1,
  regimentCount: 0.75,
  rangeSimilarity: 0.5,
  divisionOpposition: 0,
  postSeasonSkill: 0,
  ...over,
});

/** Four units of 10 men each: any 2–2 split is dead even. */
const evenFour = (over: Partial<BalanceInput> = {}): BalanceInput => ({
  available: ['A', 'B', 'C', 'D'],
  counts: {
    A: { min: 10, max: 10 },
    B: { min: 10, max: 10 },
    C: { min: 10, max: 10 },
    D: { min: 10, max: 10 },
  },
  opposingPairs: [],
  maxPlayerDiff: 1,
  teammateHistory: {},
  weights: W(),
  optionCount: 3,
  ...over,
});

const run = (over: Partial<BalanceInput> = {}) => balanceTeams(evenFour(over));
const ok = (over: Partial<BalanceInput> = {}) => {
  const r = run(over);
  if (!r.ok) throw new Error(`expected a balance, got ${r.failure.kind}`);
  return r;
};

describe('sitOuts', () => {
  it('sits out a unit fielding nobody', () => {
    expect(sitOuts(['A', 'B'], { A: { min: 0, max: 0 }, B: { min: 4, max: 9 } })).toEqual(['A']);
  });

  it('sits out a unit with no count recorded at all', () => {
    // Neither can put men on the field, so neither belongs in a partition.
    expect(sitOuts(['A', 'B'], { B: { min: 4, max: 9 } })).toEqual(['A']);
  });

  it('keeps a unit that might field somebody', () => {
    expect(sitOuts(['A'], { A: { min: 0, max: 3 } })).toEqual([]);
  });
});

describe('averageTeammateCount', () => {
  it('counts each pair once, not once per direction', () => {
    const h = { A: { B: 4 }, B: { A: 4 } };
    expect(averageTeammateCount(h)).toBe(4);
  });

  it('is zero with no history', () => {
    expect(averageTeammateCount({})).toBe(0);
  });
});

describe('balanceTeams — the basics', () => {
  it('splits four even units two and two', () => {
    const r = ok();
    const top = r.options[0];
    expect(top.teamA).toHaveLength(2);
    expect(top.teamB).toHaveLength(2);
    expect(top.avgDiff).toBe(0);
  });

  it('places every unit exactly once', () => {
    const top = ok().options[0];
    expect([...top.teamA, ...top.teamB].sort()).toEqual(['A', 'B', 'C', 'D']);
  });

  it('returns as many options as asked for, best first', () => {
    const r = ok({ optionCount: 4 });
    expect(r.options).toHaveLength(4);
    const scores = r.options.map((o) => o.compositeScore);
    expect([...scores].sort((a, b) => a - b)).toEqual(scores);
  });

  it('adds the head counts up per side', () => {
    const r = ok({
      counts: { A: { min: 5, max: 9 }, B: { min: 5, max: 9 }, C: { min: 5, max: 9 }, D: { min: 5, max: 9 } },
    });
    const top = r.options[0];
    expect(top.minA).toBe(10);
    expect(top.maxA).toBe(18);
    expect(top.avgA).toBe(14);
  });
});

describe('balanceTeams — units that field nobody', () => {
  it('leaves them out of the split and names them', () => {
    const r = ok({
      available: ['A', 'B', 'C', 'D', 'Ghost'],
      counts: {
        A: { min: 10, max: 10 },
        B: { min: 10, max: 10 },
        C: { min: 10, max: 10 },
        D: { min: 10, max: 10 },
        Ghost: { min: 0, max: 0 },
      },
    });
    expect(r.satOut).toEqual(['Ghost']);
    expect([...r.options[0].teamA, ...r.options[0].teamB]).not.toContain('Ghost');
  });

  it('drops a forced pairing that involves one, rather than placing it anyway', () => {
    const r = ok({
      available: ['A', 'B', 'C', 'D', 'Ghost'],
      counts: {
        A: { min: 10, max: 10 },
        B: { min: 10, max: 10 },
        C: { min: 10, max: 10 },
        D: { min: 10, max: 10 },
        Ghost: { min: 0, max: 0 },
      },
      opposingPairs: [['Ghost', 'A']],
    });
    const top = r.options[0];
    expect([...top.teamA, ...top.teamB]).not.toContain('Ghost');
    expect(top.teamB).toContain('A');
  });

  it('refuses a night where nobody is fielding anyone', () => {
    const r = run({ counts: { A: { min: 0, max: 0 }, B: { min: 0, max: 0 }, C: { min: 0, max: 0 }, D: { min: 0, max: 0 } } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failure.kind).toBe('nothing-to-balance');
    expect(r.satOut).toEqual(['A', 'B', 'C', 'D']);
  });
});

describe('balanceTeams — units already on a side', () => {
  it('leaves a locked unit where it stands instead of re-drawing it', () => {
    // Every 2–2 split is dead even here, so nothing but the lock decides A.
    const top = ok({ lockedA: ['A'], lockedB: ['B'] }).options[0];
    expect(top.teamA).toContain('A');
    expect(top.teamB).toContain('B');
  });

  it('takes locked units on trust rather than needing them in the pool too', () => {
    const r = ok({ available: ['C', 'D'], lockedA: ['A'], lockedB: ['B'] });
    expect([...r.options[0].teamA, ...r.options[0].teamB].sort()).toEqual(['A', 'B', 'C', 'D']);
  });

  it('counts a locked unit toward its side, so the pool packs around it', () => {
    // A is stuck on side A with thirty men, and the three tens have to go
    // opposite it to make an even night — the lock decides the whole split.
    const r = ok({
      available: ['B', 'C', 'D'],
      lockedA: ['A'],
      counts: {
        A: { min: 30, max: 30 },
        B: { min: 10, max: 10 },
        C: { min: 10, max: 10 },
        D: { min: 10, max: 10 },
      },
    });
    const top = r.options[0];
    expect(top.teamA).toEqual(['A']);
    expect(top.teamB).toEqual(['B', 'C', 'D']);
    expect(top.minA).toBe(30);
    expect(top.minB).toBe(30);
  });

  it('sits out a locked unit fielding nobody rather than holding its side', () => {
    const r = ok({
      available: ['A', 'B', 'C', 'D'],
      lockedA: ['Ghost'],
      counts: {
        A: { min: 10, max: 10 },
        B: { min: 10, max: 10 },
        C: { min: 10, max: 10 },
        D: { min: 10, max: 10 },
        Ghost: { min: 0, max: 0 },
      },
    });
    expect(r.satOut).toEqual(['Ghost']);
    expect([...r.options[0].teamA, ...r.options[0].teamB]).not.toContain('Ghost');
  });

  it('refuses a forced pair that contradicts the side a unit already holds', () => {
    const r = run({ lockedA: ['A'], opposingPairs: [['B', 'A']] });
    expect(r.ok).toBe(false);
    if (!r.ok && r.failure.kind === 'conflict') expect(r.failure.units).toEqual(['A']);
    else throw new Error('expected a conflict');
  });

  it('does not count locked units against the enumeration ceiling', () => {
    // Placing units on a side is the way out of "too many units", so a lock
    // has to buy the same relief a forced pair does.
    const many = Array.from({ length: 8 }, (_, i) => `U${i}`);
    const r = balanceTeams({
      ...evenFour(),
      available: many,
      counts: Object.fromEntries(many.map((u) => [u, { min: 5, max: 5 }])),
      maxPlayerDiff: 10,
      maxFreeUnits: 6,
      lockedA: ['U0'],
      lockedB: ['U1'],
    });
    expect(r.ok).toBe(true);
  });

  it('reports the night as it stands when every unit is locked', () => {
    const r = ok({ available: [], lockedA: ['A', 'B'], lockedB: ['C', 'D'] });
    expect(r.options).toHaveLength(1);
    expect(r.options[0].teamA).toEqual(['A', 'B']);
    expect(r.options[0].teamB).toEqual(['C', 'D']);
  });

  it('says by how much a locked night misses when it cannot be fixed', () => {
    const r = run({
      available: [],
      lockedA: ['A', 'B'],
      lockedB: ['C', 'D'],
      counts: { A: { min: 40, max: 40 }, B: { min: 40, max: 40 }, C: { min: 1, max: 1 }, D: { min: 1, max: 1 } },
      maxPlayerDiff: 2,
    });
    expect(r.ok).toBe(false);
    if (!r.ok && r.failure.kind === 'no-valid') expect(r.failure.gap).toBe(78);
    else throw new Error('expected no-valid');
  });
});

describe('balanceTeams — forced opposing pairs', () => {
  it('puts the pair on opposite sides', () => {
    const top = ok({ opposingPairs: [['A', 'B']] }).options[0];
    expect(top.teamA).toContain('A');
    expect(top.teamB).toContain('B');
  });

  it('honours several pairs at once', () => {
    const top = ok({
      opposingPairs: [
        ['A', 'B'],
        ['C', 'D'],
      ],
    }).options[0];
    expect(top.teamA.sort()).toEqual(['A', 'C']);
    expect(top.teamB.sort()).toEqual(['B', 'D']);
  });

  it('refuses a unit forced onto both sides, naming it', () => {
    const r = run({
      opposingPairs: [
        ['A', 'B'],
        ['C', 'A'],
      ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok && r.failure.kind === 'conflict') expect(r.failure.units).toEqual(['A']);
    else throw new Error('expected a conflict');
  });
});

describe('balanceTeams — the hard constraint', () => {
  it('refuses a split that cannot stay within the max difference', () => {
    const r = run({
      counts: { A: { min: 40, max: 40 }, B: { min: 1, max: 1 }, C: { min: 1, max: 1 }, D: { min: 1, max: 1 } },
      maxPlayerDiff: 2,
    });
    expect(r.ok).toBe(false);
    if (!r.ok && r.failure.kind === 'no-valid') {
      // The closest split still comes back, so the UI can say by how much.
      expect(r.failure.best.teamA.length + r.failure.best.teamB.length).toBe(4);
      expect(r.failure.best.avgDiff).toBeGreaterThan(2);
    } else throw new Error('expected no-valid');
  });

  it('accepts it once the tolerance is wide enough', () => {
    const r = run({
      counts: { A: { min: 40, max: 40 }, B: { min: 1, max: 1 }, C: { min: 1, max: 1 }, D: { min: 1, max: 1 } },
      maxPlayerDiff: 40,
    });
    expect(r.ok).toBe(true);
  });

  it('judges the gap on overlap, not on the raw min/max difference', () => {
    // A|B can field 1–40 and C|D 1–40: wildly different possible totals, but
    // the ranges overlap, so there is no gap to close on the night.
    const r = run({
      counts: { A: { min: 1, max: 40 }, B: { min: 1, max: 40 }, C: { min: 1, max: 40 }, D: { min: 1, max: 40 } },
      maxPlayerDiff: 1,
    });
    expect(r.ok).toBe(true);
  });

  // The ceiling is injectable so this doesn't have to enumerate a million
  // partitions to prove it exists.
  const wide = (n: number, over: Partial<BalanceInput> = {}) => {
    const many = Array.from({ length: n }, (_, i) => `U${i}`);
    return balanceTeams({
      ...evenFour(),
      available: many,
      counts: Object.fromEntries(many.map((u) => [u, { min: 5, max: 5 }])),
      maxPlayerDiff: 10,
      maxFreeUnits: 6,
      ...over,
    });
  };

  it('refuses more units than it can enumerate, rather than hanging', () => {
    const r = wide(7);
    expect(r.ok).toBe(false);
    if (!r.ok && r.failure.kind === 'too-many-units') {
      expect(r.failure.count).toBe(7);
      expect(r.failure.limit).toBe(6);
    } else throw new Error('expected too-many-units');
  });

  it('counts only the free units against that limit', () => {
    // Forced units are placed, not enumerated, so they don't double the work.
    expect(wide(8, { opposingPairs: [['U0', 'U1']] }).ok).toBe(true);
  });

  it('defaults the ceiling to the module’s own limit', () => {
    expect(MAX_FREE_UNITS).toBe(20);
    const many = Array.from({ length: MAX_FREE_UNITS + 1 }, (_, i) => `U${i}`);
    const r = balanceTeams({
      ...evenFour(),
      available: many,
      counts: Object.fromEntries(many.map((u) => [u, { min: 5, max: 5 }])),
    });
    expect(r.ok).toBe(false);
    if (!r.ok && r.failure.kind === 'too-many-units') expect(r.failure.limit).toBe(MAX_FREE_UNITS);
    else throw new Error('expected too-many-units');
  });
});

describe('balanceTeams — teammate history', () => {
  it('keeps units that keep ending up together apart', () => {
    const r = ok({
      teammateHistory: { A: { B: 20 }, B: { A: 20 } },
      weights: W({ teammate: 10, avgDiff: 0, regimentCount: 0, rangeSimilarity: 0 }),
    });
    const top = r.options[0];
    const together = top.teamA.includes('A') === top.teamA.includes('B');
    expect(together).toBe(false);
  });

  it('reports the shared-side score so options can be compared on it', () => {
    const r = ok({ teammateHistory: { A: { B: 3 }, B: { A: 3 } }, weights: W({ teammate: 0 }) });
    const together = r.options.find((o) => o.teamA.includes('A') === o.teamA.includes('B'))!;
    expect(together.teammateScore).toBe(3);
  });
});

describe('balanceTeams — divisions', () => {
  const divisions = [{ name: 'North', units: ['A', 'B'] }];

  it('faces division rivals off when the weight is on', () => {
    const r = ok({
      divisions,
      weights: W({ divisionOpposition: 10, avgDiff: 0, regimentCount: 0, rangeSimilarity: 0 }),
    });
    const top = r.options[0];
    expect(top.teamA.includes('A')).not.toBe(top.teamA.includes('B'));
    expect(top.divisionMatchups).toEqual([expect.objectContaining({ division: 'North' })]);
  });

  it('ignores divisions entirely at weight zero', () => {
    const r = ok({ divisions, weights: W({ divisionOpposition: 0 }) });
    expect(r.options[0].divisionMatchups).toEqual([]);
  });
});

describe('balanceTeams — post-season skill', () => {
  it('splits the playoff-pedigree units evenly', () => {
    const r = ok({
      postSeasonSkillUnits: new Set(['A', 'B']),
      weights: W({ postSeasonSkill: 10, avgDiff: 0, regimentCount: 0, rangeSimilarity: 0, teammate: 0 }),
    });
    const top = r.options[0];
    expect(top.teamA.includes('A')).not.toBe(top.teamA.includes('B'));
  });

  it('leaves them alone when no such set is given', () => {
    const r = ok({ postSeasonSkillUnits: null, weights: W({ postSeasonSkill: 10 }) });
    expect(r.ok).toBe(true);
  });
});

describe('balanceTeams — Elo', () => {
  it('averages each side’s rating when ratings are supplied', () => {
    const r = ok({
      elo: { A: 1600, B: 1400, C: 1500, D: 1500 },
      opposingPairs: [['A', 'B']],
    });
    const top = r.options[0];
    expect(top.avgEloA).not.toBeNull();
    expect(top.avgEloB).not.toBeNull();
    expect((top.avgEloA! + top.avgEloB!) / 2).toBeCloseTo(1500, 5);
  });

  it('leaves it null when no ratings are supplied, rather than reporting 0', () => {
    const top = ok().options[0];
    expect(top.avgEloA).toBeNull();
    expect(top.avgEloB).toBeNull();
  });

  it('ignores a unit with no rating instead of counting it as zero', () => {
    const top = ok({ elo: { A: 1600, B: 1600, C: 1600, D: 1600 }, opposingPairs: [['A', 'B']] }).options[0];
    expect(top.avgEloA).toBe(1600);
    const partial = ok({ elo: { A: 1600 }, opposingPairs: [['A', 'B']] }).options[0];
    expect(partial.avgEloA).toBe(1600);
    expect(partial.avgEloB).toBeNull();
  });
});

describe('balanceTeams — normalisation', () => {
  it('does not let a wide-ranging metric swamp a narrow one', () => {
    // Teammate history runs 0–200 here and the count difference 0–2. Weighted
    // equally, the split should still even the unit counts rather than chase
    // the bigger raw number.
    const r = balanceTeams({
      available: ['A', 'B', 'C', 'D'],
      counts: {
        A: { min: 10, max: 10 },
        B: { min: 10, max: 10 },
        C: { min: 10, max: 10 },
        D: { min: 10, max: 10 },
      },
      opposingPairs: [],
      maxPlayerDiff: 40,
      teammateHistory: { A: { B: 200 }, B: { A: 200 } },
      weights: W({ teammate: 1, avgDiff: 0, regimentCount: 1, rangeSimilarity: 0 }),
      optionCount: 1,
    });
    if (!r.ok) throw new Error('expected a balance');
    const top = r.options[0];
    expect(Math.abs(top.teamA.length - top.teamB.length)).toBeLessThanOrEqual(0);
    expect(top.teamA.includes('A')).not.toBe(top.teamA.includes('B'));
  });
});

describe('describeFailure', () => {
  it('names the units forced onto both sides', () => {
    expect(describeFailure({ kind: 'conflict', units: ['A'] }, 1)).toContain('A');
  });

  it('explains the enumeration limit rather than blaming the user', () => {
    const msg = describeFailure({ kind: 'too-many-units', count: 25, limit: 22 }, 1);
    expect(msg).toContain('25');
    expect(msg).toContain('22');
  });

  it('counts one player as a player, not "1 players"', () => {
    const r = run({
      counts: { A: { min: 40, max: 40 }, B: { min: 1, max: 1 }, C: { min: 1, max: 1 }, D: { min: 1, max: 1 } },
      maxPlayerDiff: 1,
    });
    if (r.ok) throw new Error('expected failure');
    expect(describeFailure(r.failure, 1)).toContain('within 1 player.');
  });

  it('says by how much the closest split missed', () => {
    const r = run({
      counts: { A: { min: 40, max: 40 }, B: { min: 1, max: 1 }, C: { min: 1, max: 1 }, D: { min: 1, max: 1 } },
      maxPlayerDiff: 2,
    });
    if (r.ok) throw new Error('expected failure');
    expect(describeFailure(r.failure, 2)).toMatch(/gap|average difference/);
  });
});
