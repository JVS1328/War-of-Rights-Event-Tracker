import { describe, it, expect } from 'vitest';
import { buildStatsBundle, isStatsBundle, STATS_BUNDLE_VERSION } from './statsBundle';
import { parseScoreboard } from './parseScoreboard';
import type { StoredScoreboard } from './StatsRepository';

const CSV = `map,DrillCamp
mode,Skirmish
area,Meadow
winner,CSA

name,team,kills,deaths,kd,deaths_in_form,deaths_skirm,deaths_oob,steam_id
[51stNY]Joe,1,3,1,3.00,1,0,0,76561198000000001
`;

const sb = parseScoreboard(CSV, 'scoreboard_20260101_120000.csv');

const record = (overrides: Partial<StoredScoreboard> = {}): StoredScoreboard => ({
  id: 'event-1::scoreboard_20260101_120000.csv',
  eventId: 'event-1',
  scoreboard: sb,
  ...overrides,
});

describe('buildStatsBundle', () => {
  it('packs scoreboards (without id/eventId), assignments, and aliases', () => {
    const bundle = buildStatsBundle([record()], { '76561198000000001': '51stNY' }, { '20THGA': '51STNY' });
    expect(bundle.v).toBe(STATS_BUNDLE_VERSION);
    expect(bundle.scoreboards).toHaveLength(1);
    const entry = bundle.scoreboards[0];
    expect(entry.sourceFilename).toBe('scoreboard_20260101_120000.csv');
    expect(entry.scoreboard.meta.winner).toBe('CSA');
    expect(entry).not.toHaveProperty('id');
    expect(entry).not.toHaveProperty('eventId');
    expect(bundle.assignments).toEqual({ '76561198000000001': '51stNY' });
    expect(bundle.aliases).toEqual({ '20THGA': '51STNY' });
  });

  it('defaults aliases to an empty object when omitted', () => {
    const bundle = buildStatsBundle([record()], {});
    expect(bundle.aliases).toEqual({});
  });

  it('carries a binding when present and omits it when absent', () => {
    const bound = buildStatsBundle([record({ binding: { weekId: 'w1', round: 2 } })], {});
    expect(bound.scoreboards[0].binding).toEqual({ weekId: 'w1', round: 2 });
    const unbound = buildStatsBundle([record()], {});
    expect(unbound.scoreboards[0]).not.toHaveProperty('binding');
  });

  it('copies assignments rather than aliasing the source object', () => {
    const src = { '1': 'A' };
    const bundle = buildStatsBundle([], src);
    src['1'] = 'B';
    expect(bundle.assignments['1']).toBe('A');
  });
});

describe('isStatsBundle', () => {
  it('accepts a well-formed bundle and rejects other shapes', () => {
    expect(isStatsBundle(buildStatsBundle([], {}))).toBe(true);
    expect(isStatsBundle(null)).toBe(false);
    expect(isStatsBundle({})).toBe(false);
    expect(isStatsBundle({ scoreboards: [], assignments: 'nope' })).toBe(false);
    expect(isStatsBundle({ scoreboards: 'no', assignments: {} })).toBe(false);
  });
});
