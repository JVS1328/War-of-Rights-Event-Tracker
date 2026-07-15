import { describe, it, expect } from 'vitest';
import { parseReplayCsv, looksLikeReplayCsv, timestampFromFilename } from './utils/replayParser';
import { parseScoreboardCsv, looksLikeScoreboardCsv } from './scoreboard/parseScoreboard';
import { makeRound, upsertRound, nearestRoundForTimestamp, newEvent } from './event/eventStore';

// A tiny synthetic replay: 3 players over 6 frames on Antietam. Carol (idx 2)
// is intentionally missing from frame index 3 (t_s 1.5) to exercise the
// not-sampled-this-frame (NaN) sentinel used by presence/attrition.
const REPLAY_CSV = `map,Antietam
mode,Skirmish
area,The Cornfield
winner,1
round_started_at,14:00:00
sample_rate_hz,2.0
samples,6

t_s,hms,name,team,x,y,z,fwd_x,fwd_y,branch,role_idx,leader_kind,regiment_crc,company
0.0,14:00:00,[1stTX]Colonel_Alice,1,1620,2600,10,1,0,inf,0,officer,tx01,0
0.0,14:00:00,[1stTX]Bob,1,1610,2560,10,1,0,inf,1,none,tx01,0
0.0,14:00:00,[2ndMS]Carol,2,1500,2620,10,-1,0,inf,0,flag,ms02,0
0.5,14:00:00,[1stTX]Colonel_Alice,1,1626,2601,10,1,0,inf,0,officer,tx01,0
0.5,14:00:00,[1stTX]Bob,1,1616,2561,10,1,0,inf,1,none,tx01,0
0.5,14:00:00,[2ndMS]Carol,2,1496,2618,10,-1,0,inf,0,flag,ms02,0
1.0,14:00:01,[1stTX]Colonel_Alice,1,1632,2603,10,1,0,inf,0,officer,tx01,0
1.0,14:00:01,[1stTX]Bob,1,1622,2563,10,1,0,inf,1,none,tx01,0
1.0,14:00:01,[2ndMS]Carol,2,1492,2616,10,-1,0,inf,0,flag,ms02,0
1.5,14:00:01,[1stTX]Colonel_Alice,1,1638,2604,10,1,0,inf,0,officer,tx01,0
1.5,14:00:01,[1stTX]Bob,1,1628,2565,10,1,0,inf,1,none,tx01,0
2.0,14:00:02,[1stTX]Colonel_Alice,1,1644,2606,10,1,0,inf,0,officer,tx01,0
2.0,14:00:02,[1stTX]Bob,1,1634,2567,10,1,0,inf,1,none,tx01,0
2.0,14:00:02,[2ndMS]Carol,2,1488,2614,10,-1,0,inf,0,flag,ms02,0
2.5,14:00:02,[1stTX]Colonel_Alice,1,1650,2608,10,1,0,inf,0,officer,tx01,0
2.5,14:00:02,[1stTX]Bob,1,1640,2569,10,1,0,inf,1,none,tx01,0
2.5,14:00:02,[2ndMS]Carol,2,1484,2612,10,-1,0,inf,0,flag,ms02,0
`;

const SCOREBOARD_CSV = `map,Antietam
mode,Skirmish
area,The Cornfield
winner,1
round_start_time,14:00:00
round_end_time,14:00:03
casualties_usa,1
casualties_csa,1

name,team,kills,deaths,deaths_in_form,deaths_skirm,deaths_oob
[1stTX]Colonel_Alice,1,1,0,0,0,0
[1stTX]Bob,1,0,1,1,0,0
[2ndMS]Carol,2,1,1,0,1,0

time,killer,killer_team,victim,victim_team,victim_formation,cause
14:00:01,[2ndMS]Carol,2,[1stTX]Bob,1,in_form,Minie
14:00:02,[1stTX]Colonel_Alice,1,[2ndMS]Carol,2,skirm,Rifle
`;

describe('replay parsing', () => {
  it('is recognized and parsed into a pose struct', () => {
    expect(looksLikeReplayCsv(REPLAY_CSV)).toBe(true);
    expect(looksLikeScoreboardCsv(REPLAY_CSV)).toBe(false);
    const r = parseReplayCsv(REPLAY_CSV);
    expect(r.frameCount).toBe(6);
    expect(r.playerCount).toBe(3);
    expect(r.meta.map).toBe('Antietam');
    expect(r.meta.mapSlug).toBe('antietam');
    expect(r.meta.area).toBe('The Cornfield');
    expect(r.meta.winner).toBe('1');
    expect(r.meta.sampleRateHz).toBe(2.0);
    // roundStartSec anchors kill-time alignment: 14:00:00 = 50400s.
    expect(r.meta.roundStartSec).toBe(50400);
    expect(r.players.map(p => p.name)).toEqual([
      '[1stTX]Colonel_Alice', '[1stTX]Bob', '[2ndMS]Carol',
    ]);
  });

  it('sentinels a not-sampled player as NaN (frame 3 has no Carol)', () => {
    const r = parseReplayCsv(REPLAY_CSV);
    const P = r.playerCount;         // 3
    const carol = 2;
    // frame index 3 == t_s 1.5, where Carol is absent
    expect(Number.isNaN(r.tracks.x[3 * P + carol])).toBe(true);
    // she is present at frame 4 (t_s 2.0)
    expect(Number.isNaN(r.tracks.x[4 * P + carol])).toBe(false);
  });
});

describe('scoreboard enrichment', () => {
  it('parses kill log + casualty metadata', () => {
    expect(looksLikeScoreboardCsv(SCOREBOARD_CSV)).toBe(true);
    const sb = parseScoreboardCsv(SCOREBOARD_CSV);
    expect(sb.kills).toHaveLength(2);
    expect(sb.kills[0]).toMatchObject({ victim: '[1stTX]Bob', killer: '[2ndMS]Carol', time: '14:00:01', cause: 'Minie', victimTeam: 1, killerTeam: 2 });
    expect(sb.metadata.casualties_usa).toBe('1');
    expect(sb.players).toHaveLength(3);
  });
});

describe('event model', () => {
  it('builds a round from a replay and orders by timestamp', () => {
    const r = parseReplayCsv(REPLAY_CSV);
    const round = makeRound('rid1', 'replay_20260715_140000.csv', r, timestampFromFilename);
    expect(round.meta.map).toBe('Antietam');
    expect(round.meta.frameCount).toBe(6);
    expect(round.ts).toBe(new Date(2026, 6, 15, 14, 0, 0).getTime());

    let evt = newEvent('Test Night');
    evt = upsertRound(evt, round);
    expect(evt.rounds).toHaveLength(1);

    // re-upserting the same id replaces rather than duplicates
    evt = upsertRound(evt, { ...round });
    expect(evt.rounds).toHaveLength(1);
  });

  it('matches a scoreboard to the nearest replay round by filename time', () => {
    const r = parseReplayCsv(REPLAY_CSV);
    const round = makeRound('rid1', 'replay_20260715_140000.csv', r, timestampFromFilename);
    let evt = upsertRound(newEvent(), round);
    const sbTs = timestampFromFilename('scoreboard_20260715_140030.csv').getTime();
    expect(nearestRoundForTimestamp(evt, sbTs)).toBe('rid1');
    // a scoreboard hours away doesn't match
    const farTs = timestampFromFilename('scoreboard_20260715_180000.csv').getTime();
    expect(nearestRoundForTimestamp(evt, farTs)).toBe(null);
  });
});
