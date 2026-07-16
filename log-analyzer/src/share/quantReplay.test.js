import { describe, it, expect } from 'vitest';
import { parseReplayCsv } from '../utils/replayParser';
import { REPLAY_CSV } from '../__fixtures__/synthetic';
import { encodeQuantReplay, decodeQuantReplay } from './quantReplay';

const replay = parseReplayCsv(REPLAY_CSV);

describe('quantized share replay', () => {
  it('round-trips positions within tolerance and preserves the sampled mask + leader kind', () => {
    const r = decodeQuantReplay(encodeQuantReplay(replay));
    expect(r.frameCount).toBe(replay.frameCount);
    expect(r.playerCount).toBe(replay.playerCount);
    expect(r.players).toEqual(replay.players);
    expect(r.meta.map).toBe(replay.meta.map);
    expect(Array.from(r.frameTimes)).toEqual(Array.from(replay.frameTimes));

    const N = replay.frameCount * replay.playerCount;
    for (let i = 0; i < N; i++) {
      if (Number.isNaN(replay.tracks.x[i])) {
        expect(Number.isNaN(r.tracks.x[i])).toBe(true); // unsampled preserved
      } else {
        expect(Math.abs(r.tracks.x[i] - replay.tracks.x[i])).toBeLessThan(0.5);
        expect(Math.abs(r.tracks.y[i] - replay.tracks.y[i])).toBeLessThan(0.5);
        expect(r.tracks.lk[i]).toBe(replay.tracks.lk[i]); // leader kind exact
      }
    }
  });

  it('preserves heading direction (magnitude is renormalized away)', () => {
    const r = decodeQuantReplay(encodeQuantReplay(replay));
    const P = replay.playerCount;
    const i = 0 * P + 2; // frame 0, Carol — faces -x (fwd_x -1)
    const oLen = Math.hypot(replay.tracks.fx[i], replay.tracks.fy[i]);
    const rLen = Math.hypot(r.tracks.fx[i], r.tracks.fy[i]);
    expect(oLen).toBeGreaterThan(1e-6);
    expect(rLen).toBeGreaterThan(1e-6);
    const dot = (replay.tracks.fx[i] * r.tracks.fx[i] + replay.tracks.fy[i] * r.tracks.fy[i]) / (oLen * rLen);
    expect(dot).toBeGreaterThan(0.99); // near-parallel
  });

  it('downsamples frames by a stride, keeping every stride-th frame', () => {
    const r = decodeQuantReplay(encodeQuantReplay(replay, 2));
    expect(r.frameCount).toBe(Math.ceil(replay.frameCount / 2)); // 6 → 3
    expect(r.playerCount).toBe(replay.playerCount);
    // frame times are frames 0, 2, 4 of the source
    expect(Array.from(r.frameTimes)).toEqual([0, 1, 2].map((j) => replay.frameTimes[j * 2]));
  });

  it('drops z (rebuilt as zeros)', () => {
    const r = decodeQuantReplay(encodeQuantReplay(replay));
    expect(r.tracks.z.length).toBe(replay.frameCount * replay.playerCount);
    expect(r.tracks.z.every((v) => v === 0)).toBe(true);
  });

  it('is much smaller than the full-fidelity codec', async () => {
    const { encodeReplay } = await import('../utils/replayCodec');
    const full = encodeReplay(replay).byteLength;
    const quant = encodeQuantReplay(replay).byteLength;
    expect(quant).toBeLessThan(full * 0.75);
  });
});
