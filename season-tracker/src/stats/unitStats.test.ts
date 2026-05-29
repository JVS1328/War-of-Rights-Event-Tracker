import { describe, it, expect } from 'vitest';
import {
  emptyUnitSnap,
  addUnitSnap,
  deriveTokenSnaps,
  accumulateTokenSnaps,
  unitSnapAvgTd,
  unitSnapAvgTk,
  type RegimentLike,
} from './unitStats';

const reg = (regiment: string, kills: number, deaths: number, deathsForm: [number, number, number], killsForm: [number, number, number]): RegimentLike => ({
  regiment,
  kills,
  deaths,
  casualtiesByFormation: { in_form: deathsForm[0], skirm: deathsForm[1], oob: deathsForm[2] },
  killsByFormation: { in_form: killsForm[0], skirm: killsForm[1], oob: killsForm[2] },
});

const breakdown: RegimentLike[] = [
  reg('51STNY', 5, 2, [2, 0, 0], [3, 1, 1]),
  reg('USA1', 3, 4, [1, 2, 1], [1, 1, 1]),
  reg('20THGA', 7, 1, [1, 0, 0], [5, 1, 1]),
];

describe('deriveTokenSnaps', () => {
  it('sums each token\'s claimed regiments', () => {
    const snaps = deriveTokenSnaps(breakdown, { '1stUS': ['51STNY', 'USA1'], Rebels: ['20THGA'] });
    expect(snaps['1stUS']).toEqual({
      kills: 8, // 5 + 3
      deaths: 6, // 2 + 4
      deathsForm: { in_form: 3, skirm: 2, oob: 1 },
      killsForm: { in_form: 4, skirm: 2, oob: 2 },
    });
    expect(snaps.Rebels.kills).toBe(7);
    expect(snaps.Rebels.deaths).toBe(1);
  });

  it('ignores regiments not present in the breakdown', () => {
    const snaps = deriveTokenSnaps(breakdown, { Ghost: ['NOPE'] });
    expect(snaps.Ghost).toEqual(emptyUnitSnap());
  });

  it('does not double-count: a regiment claimed by one token is summed only there', () => {
    const snaps = deriveTokenSnaps(breakdown, { A: ['51STNY'], B: ['USA1'] });
    expect(snaps.A.kills).toBe(5);
    expect(snaps.B.kills).toBe(3);
  });
});

describe('addUnitSnap (cross-round/scope aggregation)', () => {
  it('adds two snapshots component-wise', () => {
    const a = { kills: 5, deaths: 2, deathsForm: { in_form: 2, skirm: 0, oob: 0 }, killsForm: { in_form: 3, skirm: 1, oob: 1 } };
    const b = { kills: 3, deaths: 4, deathsForm: { in_form: 1, skirm: 2, oob: 1 }, killsForm: { in_form: 1, skirm: 1, oob: 1 } };
    expect(addUnitSnap(a, b)).toEqual({
      kills: 8,
      deaths: 6,
      deathsForm: { in_form: 3, skirm: 2, oob: 1 },
      killsForm: { in_form: 4, skirm: 2, oob: 2 },
    });
  });
});

describe('accumulateTokenSnaps (across rounds/scoreboards)', () => {
  it('sums a token across multiple breakdowns', () => {
    const b1 = [reg('51STNY', 5, 2, [2, 0, 0], [3, 1, 1])];
    const b2 = [reg('51STNY', 4, 3, [1, 1, 1], [2, 1, 0])];
    const snaps = accumulateTokenSnaps([b1, b2], { '1stUS': ['51STNY'] });
    expect(snaps['1stUS'].kills).toBe(9);
    expect(snaps['1stUS'].deaths).toBe(5);
    expect(snaps['1stUS'].deathsForm).toEqual({ in_form: 3, skirm: 1, oob: 1 });
  });

  it('returns a zero snap for tokens with no matching data', () => {
    const snaps = accumulateTokenSnaps([], { Empty: ['X'] });
    expect(snaps.Empty).toEqual(emptyUnitSnap());
  });
});

describe('×Td / ×Tk from a snapshot', () => {
  it('computes avg ticket cost per death and value per kill', () => {
    // deathsForm 2/0/0 → (1·2)/2 = 1.0; killsForm 3/1/1 → (3·1 + 1·3 + 1·5)/5 = 11/5 = 2.2
    const snap = { kills: 5, deaths: 2, deathsForm: { in_form: 2, skirm: 0, oob: 0 }, killsForm: { in_form: 3, skirm: 1, oob: 1 } };
    expect(unitSnapAvgTd(snap)).toBeCloseTo(1.0);
    expect(unitSnapAvgTk(snap)).toBeCloseTo(2.2);
  });

  it('returns null when there are no deaths/kills', () => {
    expect(unitSnapAvgTd(emptyUnitSnap())).toBeNull();
    expect(unitSnapAvgTk(emptyUnitSnap())).toBeNull();
  });
});
