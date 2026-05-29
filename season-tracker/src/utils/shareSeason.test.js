import { describe, it, expect } from 'vitest';
import {
  createV2StatsPayload,
  createV2FullPayload,
  encodeSharePayload,
  decodeSharePayload,
} from './shareSeason';

const bundle = {
  v: 1,
  scoreboards: [
    {
      sourceFilename: 'scoreboard_20260101_120000.csv',
      scoreboard: { sourceFilename: 'scoreboard_20260101_120000.csv', meta: { winner: 'CSA' }, players: [], kills: [] },
      binding: { weekId: 'w1', round: 2 },
    },
  ],
  assignments: { '76561198000000001': '51stNY' },
};

describe('stats share payload', () => {
  it('tags a stats payload with v2/t=stats', () => {
    const p = createV2StatsPayload(bundle);
    expect(p).toEqual({ v: 2, t: 'stats', bundle });
  });

  it('round-trips a stats bundle through encode → decode', () => {
    const encoded = encodeSharePayload(createV2StatsPayload(bundle));
    const decoded = decodeSharePayload(encoded);
    expect(decoded).toEqual({ kind: 'stats', bundle });
  });

  it('still decodes a v2 season payload as a season (no regression)', () => {
    const encoded = encodeSharePayload({ v: 2, t: 'season', payload: { units: ['A'], weeks: [] } });
    const decoded = decodeSharePayload(encoded);
    expect(decoded.kind).toBe('season');
    expect(decoded.payload.units).toEqual(['A']);
  });
});

describe('combined (full) share payload', () => {
  const event = { id: 'evt_1', name: 'Cup', unitRegistry: {}, seasons: [{ id: 's1', name: 'S1', weeks: [] }] };

  it('tags a full payload with v2/t=full carrying event + bundle', () => {
    const p = createV2FullPayload(event, bundle);
    expect(p).toEqual({ v: 2, t: 'full', event, bundle });
  });

  it('round-trips event + stats through encode → decode', () => {
    const encoded = encodeSharePayload(createV2FullPayload(event, bundle));
    const decoded = decodeSharePayload(encoded);
    expect(decoded).toEqual({ kind: 'full', event, bundle });
  });
});
