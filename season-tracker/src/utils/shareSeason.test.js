import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  createV2StatsPayload,
  createV2FullPayload,
  createV2SeasonPayload,
  encodeSharePayload,
  decodeSharePayload,
  splitIntoChunks,
  putSharePayload,
  fetchSharePayload,
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

  it('carries an optional event name through encode → decode', () => {
    const p = createV2StatsPayload(bundle, 'Summer Cup');
    expect(p).toEqual({ v: 2, t: 'stats', bundle, name: 'Summer Cup' });
    const decoded = decodeSharePayload(encodeSharePayload(p));
    expect(decoded).toEqual({ kind: 'stats', bundle, name: 'Summer Cup' });
  });

  it('omits the name when none is given (back-compat with older links)', () => {
    const p = createV2StatsPayload(bundle);
    expect(p).not.toHaveProperty('name');
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

describe('splitIntoChunks', () => {
  it('splits a string into ordered chunks that rejoin to the original', () => {
    const chunks = splitIntoChunks('abcdefg', 3);
    expect(chunks).toEqual(['abc', 'def', 'g']);
    expect(chunks.join('')).toBe('abcdefg');
  });

  it('returns a single chunk when the string fits', () => {
    expect(splitIntoChunks('abc', 10)).toEqual(['abc']);
  });

  it('returns no chunks for an empty string', () => {
    expect(splitIntoChunks('', 10)).toEqual([]);
  });
});

// An in-memory stand-in for the /api/share server that mirrors its wire
// contract: chunk/finalize POSTs and manifest/chunk/legacy GETs.
const makeFakeShareApi = () => {
  const store = new Map();
  const json = (body, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
  const fetchImpl = async (url, opts) => {
    const u = new URL(url, 'http://localhost');
    if (opts?.method === 'POST') {
      const body = JSON.parse(opts.body);
      if (body.total !== undefined) {
        store.set(`season-share:${body.id}`, JSON.stringify({ n: body.total }));
        return json({ id: body.id });
      }
      store.set(`season-share:${body.id}:${body.index}`, body.chunk);
      return json({ ok: true });
    }
    const id = u.searchParams.get('id');
    const chunk = u.searchParams.get('chunk');
    if (chunk !== null) {
      const v = store.get(`season-share:${id}:${chunk}`);
      return v == null ? json({ error: 'nf' }, 404) : json({ chunk: v });
    }
    const v = store.get(`season-share:${id}`);
    if (v == null) return json({ error: 'nf' }, 404);
    if (v.startsWith('{')) return json({ chunked: true, total: JSON.parse(v).n });
    return json({ payload: v });
  };
  return { fetchImpl, store };
};

describe('chunked short-link upload/download', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('round-trips a multi-chunk payload through put → fetch', async () => {
    const { fetchImpl, store } = makeFakeShareApi();
    vi.stubGlobal('fetch', fetchImpl);

    const state = { units: ['A', 'B'], weeks: [] };
    const encoded = encodeSharePayload(createV2SeasonPayload(state));

    // Tiny chunk size forces several chunks from a small payload.
    const id = await putSharePayload(encoded, 8);

    // Manifest + more than one chunk were actually stored.
    const manifest = JSON.parse(store.get(`season-share:${id}`));
    expect(manifest.n).toBeGreaterThan(1);
    expect(store.get(`season-share:${id}:0`)).toBeDefined();

    const decoded = await fetchSharePayload(id);
    expect(decoded.kind).toBe('season');
    expect(decoded.payload.units).toEqual(['A', 'B']);
  });

  it('decodes a legacy single-value link (back-compat)', async () => {
    const { fetchImpl, store } = makeFakeShareApi();
    vi.stubGlobal('fetch', fetchImpl);

    // Pre-seed a legacy entry: raw payload stored directly under the id key.
    const encoded = encodeSharePayload(createV2StatsPayload(bundle));
    store.set('season-share:deadbeef', encoded);

    const decoded = await fetchSharePayload('deadbeef');
    expect(decoded).toEqual({ kind: 'stats', bundle });
  });

  it('returns null when a chunk is missing', async () => {
    const { fetchImpl, store } = makeFakeShareApi();
    vi.stubGlobal('fetch', fetchImpl);
    // Manifest claims 2 chunks but none were stored.
    store.set('season-share:cafebabe', JSON.stringify({ n: 2 }));
    expect(await fetchSharePayload('cafebabe')).toBeNull();
  });

  it('surfaces an upload failure by throwing', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: false, status: 413, json: async () => ({}) }));
    await expect(putSharePayload('abcdef', 2)).rejects.toThrow();
  });
});
