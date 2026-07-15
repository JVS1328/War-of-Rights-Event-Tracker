import { describe, it, expect } from 'vitest';
import { parseReplayCsv } from '../utils/replayParser';
import { parseScoreboardCsv } from '../scoreboard/parseScoreboard';
import { REPLAY_CSV, SCOREBOARD_CSV } from '../__fixtures__/synthetic';
import { buildEventShare, restoreEventShare } from './shareEvent';

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
  it('round-trips the event + inlined replay blob', () => {
    const payload = buildEventShare(event, replays);
    expect(payload.v).toBe(1);
    expect(payload.rp.rp1).toBeTruthy();          // replay inlined as base64url

    const restored = restoreEventShare(payload);
    expect(restored.event.name).toBe('Friday Night');
    expect(restored.event.rounds).toHaveLength(1);
    expect(restored.event.rounds[0].scoreboard.kills).toHaveLength(2);

    const rr = restored.replays.get('rp1');
    expect(rr.frameCount).toBe(replay.frameCount);
    expect(rr.playerCount).toBe(replay.playerCount);
    expect(rr.meta.map).toBe('Antietam');
    // tracks survive bit-for-bit
    expect(Array.from(rr.tracks.x.slice(0, 3))).toEqual(Array.from(replay.tracks.x.slice(0, 3)));
  });
});
