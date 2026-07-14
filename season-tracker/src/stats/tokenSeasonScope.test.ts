import { describe, it, expect } from 'vitest';
import {
  normalizeScopedTokenRegiments,
  effectiveTokenRegiments,
  accumulateTokenSnapsScoped,
  type RegimentLike,
} from './unitStats';
import { OVERALL_SCOPE } from './statsBundle';

const reg = (regiment: string, kills: number, deaths: number): RegimentLike => ({
  regiment,
  kills,
  deaths,
  casualtiesByFormation: { in_form: deaths, skirm: 0, oob: 0 },
  killsByFormation: { in_form: kills, skirm: 0, oob: 0 },
});

describe('normalizeScopedTokenRegiments', () => {
  it('wraps a legacy flat map into the Overall scope', () => {
    expect(normalizeScopedTokenRegiments({ CB: ['AL', 'GA'] })).toEqual({
      [OVERALL_SCOPE]: { CB: ['AL', 'GA'] },
    });
  });

  it('passes a scoped map through, dropping empty tokens and scopes', () => {
    expect(
      normalizeScopedTokenRegiments({
        [OVERALL_SCOPE]: { CB: ['AL', 'GA'], Empty: [] },
        sea_5: {},
      }),
    ).toEqual({ [OVERALL_SCOPE]: { CB: ['AL', 'GA'] } });
  });

  it('treats empty / non-objects as empty', () => {
    expect(normalizeScopedTokenRegiments({})).toEqual({});
    expect(normalizeScopedTokenRegiments(undefined)).toEqual({});
  });
});

describe('effectiveTokenRegiments', () => {
  const scoped = {
    [OVERALL_SCOPE]: { CB: ['AL', 'GA'], Irish: ['69THNY'] },
    sea_5: { CB: ['AL', 'BX'] }, // CB's roster changed in Season 5
  };

  it('returns the Overall map for the Overall scope', () => {
    expect(effectiveTokenRegiments(scoped, OVERALL_SCOPE)).toEqual({
      CB: ['AL', 'GA'],
      Irish: ['69THNY'],
    });
  });

  it('replaces a token entirely in its season, inheriting untouched tokens', () => {
    expect(effectiveTokenRegiments(scoped, 'sea_5')).toEqual({
      CB: ['AL', 'BX'], // replaced (GA dropped, BX joined)
      Irish: ['69THNY'], // inherited from Overall
    });
  });

  it('inherits Overall wholesale for a season with no overrides', () => {
    expect(effectiveTokenRegiments(scoped, 'sea_1')).toEqual({
      CB: ['AL', 'GA'],
      Irish: ['69THNY'],
    });
  });
});

describe('accumulateTokenSnapsScoped', () => {
  it('rolls each breakdown up under its own season mapping', () => {
    // Season 1: CB = AL + GA. Season 5: CB = AL + BX (GA left, BX joined).
    const s1 = [reg('AL', 5, 1), reg('GA', 4, 2)];
    const s5 = [reg('AL', 3, 1), reg('BX', 2, 0), reg('GA', 9, 9)];
    const out = accumulateTokenSnapsScoped([
      { breakdown: s1, mapping: { CB: ['AL', 'GA'] } },
      { breakdown: s5, mapping: { CB: ['AL', 'BX'] } },
    ]);
    // CB kills = S1(AL5+GA4) + S5(AL3+BX2) = 14. GA's Season-5 9 kills are NOT
    // counted for CB (GA left CB in Season 5).
    expect(out.CB.kills).toBe(14);
    expect(out.CB.deaths).toBe(4); // 1 + 2 + 1 + 0
  });

  it('creates zero entries for tokens present in a mapping but absent from data', () => {
    const out = accumulateTokenSnapsScoped([
      { breakdown: [reg('AL', 5, 1)], mapping: { CB: ['AL'], Ghost: ['NOPE'] } },
    ]);
    expect(out.CB.kills).toBe(5);
    expect(out.Ghost.kills).toBe(0);
  });
});
