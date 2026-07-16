import { describe, it, expect } from 'vitest';
import { parseReplayCsv } from '../utils/replayParser';
import { parseScoreboardCsv } from '../scoreboard/parseScoreboard';
import { REPLAY_CSV, SCOREBOARD_CSV } from '../__fixtures__/synthetic';
import { encodeEventShare, decodeEventShare } from './shareEvent';

const replay = parseReplayCsv(REPLAY_CSV);
const scoreboard = parseScoreboardCsv(SCOREBOARD_CSV);

const event = {
  id: 'e1',
  name: 'Friday Night',
  createdAt: 123,
  rounds: [{
    id: 'rp1', replayId: 'rp1', filename: 'replay.csv', ts: 1000,
    meta: { ...replay.meta, frameCount: replay.frameCount, playerCount: replay.playerCount },
    scoreboard, scoreboardFilename: 'scoreboard.csv',
  }],
};
const replays = new Map([['rp1', replay]]);

describe('event share serialization', () => {
  it('round-trips the event + inlined replay blob through the compressed payload', () => {
    const { payload: encoded, stride } = encodeEventShare(event, replays);
    expect(typeof encoded).toBe('string');
    expect(encoded.length).toBeGreaterThan(0);
    expect(stride).toBe(1); // tiny fixture — no downsampling needed
    // base64url — no +, /, or = padding.
    expect(encoded).not.toMatch(/[+/=]/);

    const restored = decodeEventShare(encoded);
    expect(restored.event.name).toBe('Friday Night');
    expect(restored.event.rounds).toHaveLength(1);
    expect(restored.event.rounds[0].scoreboard.kills).toHaveLength(2);

    const rr = restored.replays.get('rp1');
    expect(rr.frameCount).toBe(replay.frameCount);
    expect(rr.playerCount).toBe(replay.playerCount);
    expect(rr.meta.map).toBe('Antietam');
    // positions survive within quantization tolerance (well under a metre)
    for (let i = 0; i < 3; i++) {
      expect(Math.abs(rr.tracks.x[i] - replay.tracks.x[i])).toBeLessThan(1);
      expect(Math.abs(rr.tracks.y[i] - replay.tracks.y[i])).toBeLessThan(1);
    }
  });

  it('deduplicates a replay referenced by multiple rounds', () => {
    const twoRounds = {
      ...event,
      rounds: [
        event.rounds[0],
        { ...event.rounds[0], id: 'r2' }, // same replayId 'rp1'
      ],
    };
    const restored = decodeEventShare(encodeEventShare(twoRounds, replays).payload);
    expect(restored.event.rounds).toHaveLength(2);
    expect(restored.replays.size).toBe(1);
    expect(restored.replays.get('rp1').frameCount).toBe(replay.frameCount);
  });

  it('downsamples in time under a tight budget, and still round-trips', () => {
    // A tiny budget forces the stride search to kick in on the fixture.
    const tight = encodeEventShare(event, replays, { maxBytes: 50 });
    const loose = encodeEventShare(event, replays, { maxBytes: 850_000 });
    expect(tight.stride).toBeGreaterThan(1);
    expect(loose.stride).toBe(1);
    expect(tight.payload.length).toBeLessThan(loose.payload.length); // fewer frames → smaller

    const restored = decodeEventShare(tight.payload);
    const rr = restored.replays.get('rp1');
    // Fewer frames than the source, but a valid, playable replay.
    expect(rr.frameCount).toBe(Math.ceil(replay.frameCount / tight.stride));
    expect(rr.frameCount).toBeGreaterThan(0);
    expect(rr.frameTimes.length).toBe(rr.frameCount);
  });
});
