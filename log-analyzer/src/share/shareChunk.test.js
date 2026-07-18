import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { parseReplayCsv } from '../utils/replayParser';
import { parseScoreboardCsv } from '../scoreboard/parseScoreboard';
import { REPLAY_CSV, SCOREBOARD_CSV } from '../__fixtures__/synthetic';
import {
  encodeEventShare, putSharePayload, fetchSharePayload, splitIntoChunks,
} from './shareEvent';

// In-memory fake of /api/share implementing the chunked protocol, so we can
// drive the client's real upload/download code end-to-end.
function installFakeStore() {
  const kv = new Map();
  const stats = { posts: 0, chunkWrites: 0, manifests: 0 };
  globalThis.fetch = vi.fn(async (url, opts) => {
    const json = (obj, status = 200) => ({ ok: status < 400, status, json: async () => obj });
    if (opts?.method === 'POST') {
      stats.posts++;
      const { id, index, chunk, total } = JSON.parse(opts.body);
      if (total !== undefined) { kv.set(`m:${id}`, total); stats.manifests++; return json({ id }); }
      kv.set(`c:${id}:${index}`, chunk); stats.chunkWrites++; return json({ ok: true });
    }
    const u = new URL(url, 'http://x');
    const id = u.searchParams.get('id');
    const chunk = u.searchParams.get('chunk');
    if (chunk !== null) {
      const v = kv.get(`c:${id}:${chunk}`);
      return v === undefined ? json({ error: 'nf' }, 404) : json({ chunk: v });
    }
    const total = kv.get(`m:${id}`);
    if (total === undefined) return json({ error: 'nf' }, 404);
    return json({ chunked: true, total });
  });
  return { kv, stats };
}

const buildEvent = () => {
  const replay = parseReplayCsv(REPLAY_CSV);
  const scoreboard = parseScoreboardCsv(SCOREBOARD_CSV);
  const event = {
    id: 'e1', name: 'Chunked Night', createdAt: 1,
    rounds: [{
      id: 'rp1', replayId: 'rp1', filename: 'r.csv', ts: 1,
      meta: { ...replay.meta, frameCount: replay.frameCount, playerCount: replay.playerCount },
      scoreboard, scoreboardFilename: 's.csv',
    }],
  };
  return { event, replay, replays: new Map([['rp1', replay]]) };
};

describe('chunked share transport', () => {
  let saved;
  beforeEach(() => { saved = globalThis.fetch; });
  afterEach(() => { globalThis.fetch = saved; });

  it('splits a string into chunks of the given size', () => {
    expect(splitIntoChunks('abcdefg', 3)).toEqual(['abc', 'def', 'g']);
    expect(splitIntoChunks('', 3)).toEqual([]);
  });

  it('uploads as multiple chunks + one manifest, then reassembles and decodes', async () => {
    const { stats } = installFakeStore();
    const { event, replay } = buildEvent();
    const { payload } = encodeEventShare(event, replay ? new Map([['rp1', replay]]) : new Map());

    // Force many chunks with a tiny chunk size to exercise the multi-chunk path.
    const id = await putSharePayload(payload, 32);
    const expectedChunks = splitIntoChunks(payload, 32).length;
    expect(expectedChunks).toBeGreaterThan(1);
    expect(stats.chunkWrites).toBe(expectedChunks);
    expect(stats.manifests).toBe(1);
    expect(id).toMatch(/^[0-9a-f]{8}$/);

    const restored = await fetchSharePayload(id);
    expect(restored).not.toBeNull();
    expect(restored.event.name).toBe('Chunked Night');
    expect(restored.event.rounds[0].scoreboard.kills).toHaveLength(2);
    const rr = restored.replays.get('rp1');
    expect(rr.frameCount).toBe(replay.frameCount);
    expect(rr.playerCount).toBe(replay.playerCount);
    // frames survive the chunk round-trip within quantization tolerance
    for (let i = 0; i < replay.frameCount * replay.playerCount; i++) {
      if (Number.isNaN(replay.tracks.x[i])) continue;
      expect(Math.abs(rr.tracks.x[i] - replay.tracks.x[i])).toBeLessThan(1);
    }
  });

  it('handles a single-chunk payload (small event)', async () => {
    const { stats } = installFakeStore();
    const { event, replays, replay } = buildEvent();
    const { payload } = encodeEventShare(event, replays);
    const id = await putSharePayload(payload); // default 500k chunk → one chunk
    expect(stats.chunkWrites).toBe(1);
    expect(stats.manifests).toBe(1);
    const restored = await fetchSharePayload(id);
    expect(restored.replays.get('rp1').frameCount).toBe(replay.frameCount);
  });

  it('returns null when a manifest points at a missing chunk', async () => {
    const { kv } = installFakeStore();
    const { event, replays } = buildEvent();
    const { payload } = encodeEventShare(event, replays);
    const id = await putSharePayload(payload, 32);
    // Corrupt the store: drop one chunk but keep the manifest.
    kv.delete(`c:${id}:0`);
    expect(await fetchSharePayload(id)).toBeNull();
  });

  it('fetchSharePayload returns null on a 404 id', async () => {
    installFakeStore();
    expect(await fetchSharePayload('deadbeef')).toBeNull();
  });
});
