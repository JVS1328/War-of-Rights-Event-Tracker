import { describe, it, expect } from 'vitest';
import { parseReplayCsv, looksLikeReplayCsv, timestampFromFilename } from './utils/replayParser';
import { parseScoreboardCsv, looksLikeScoreboardCsv } from './scoreboard/parseScoreboard';
import {
  makeRound, upsertRound, nearestRoundForTimestamp, newEvent,
  matchScoreboardsToRounds, scoreboardStartSec,
} from './event/eventStore';

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

// End-to-end of the ReplaySuite ingest path: two real replays + two real
// scoreboards, uploaded together. Replay filenames are stamped at round END and
// scoreboard filenames at round START, the offset that used to pile both
// scoreboards onto the first round. The batch matcher must keep them 1:1.
describe('two-round ingest (regression: scoreboards must not merge)', () => {
  // Round 1 — round starts 20:00:00 (hms), replay saved (filename) at 20:12.
  const REPLAY_1 = `map,Antietam
mode,Skirmish
area,The Cornfield
winner,1
sample_rate_hz,2.0
samples,2

t_s,hms,name,team,x,y,z,fwd_x,fwd_y,branch,role_idx,leader_kind,regiment_crc,company
0.0,20:00:00,[1stTX]Alice,1,1620,2600,10,1,0,inf,0,officer,tx01,0
0.0,20:00:00,[2ndMS]Bob,2,1500,2620,10,-1,0,inf,0,none,ms02,0
0.5,20:00:00,[1stTX]Alice,1,1626,2601,10,1,0,inf,0,officer,tx01,0
0.5,20:00:00,[2ndMS]Bob,2,1496,2618,10,-1,0,inf,0,none,ms02,0
`;
  // Round 2 — round starts 20:13:00 (hms), replay saved (filename) at 20:27.
  const REPLAY_2 = `map,Antietam
mode,Skirmish
area,The Sunken Road
winner,2
sample_rate_hz,2.0
samples,2

t_s,hms,name,team,x,y,z,fwd_x,fwd_y,branch,role_idx,leader_kind,regiment_crc,company
0.0,20:13:00,[1stTX]Alice,1,1720,2700,10,1,0,inf,0,officer,tx01,0
0.0,20:13:00,[9thNY]Cara,1,1700,2680,10,1,0,inf,0,none,ny09,0
0.5,20:13:00,[1stTX]Alice,1,1726,2701,10,1,0,inf,0,officer,tx01,0
0.5,20:13:00,[9thNY]Cara,1,1696,2698,10,1,0,inf,0,none,ny09,0
`;
  const SCOREBOARD_1 = `map,Antietam
area,The Cornfield
winner,1
round_start_time,20:00:00
round_end_time,20:12:00
casualties_usa,0
casualties_csa,1

name,team,kills,deaths
[1stTX]Alice,1,1,0
[2ndMS]Bob,2,0,1

time,killer,killer_team,victim,victim_team,victim_formation,cause
20:05:00,[1stTX]Alice,1,[2ndMS]Bob,2,skirm,Rifle
`;
  const SCOREBOARD_2 = `map,Antietam
area,The Sunken Road
winner,2
round_start_time,20:13:00
round_end_time,20:27:00
casualties_usa,1
casualties_csa,0

name,team,kills,deaths
[1stTX]Alice,1,0,1
[9thNY]Cara,1,0,0

time,killer,killer_team,victim,victim_team,victim_formation,cause
20:20:00,[3rdAR]Dan,2,[1stTX]Alice,1,in_form,Minie
`;

  // Mirror of the (module-private) updateRound helper in ReplaySuite.
  const updateRound = (event, roundId, patch) => ({
    ...event,
    rounds: event.rounds.map(r => (r.id === roundId ? { ...r, ...patch } : r)),
  });

  it('attaches each scoreboard to its own round despite the filename offset', () => {
    // --- build rounds from the two replays (as ingestFiles does) ---
    let evt = newEvent();
    const p1 = parseReplayCsv(REPLAY_1);
    const p2 = parseReplayCsv(REPLAY_2);
    evt = upsertRound(evt, makeRound('r1', 'replay_20260718_201200.csv', p1, timestampFromFilename));
    evt = upsertRound(evt, makeRound('r2', 'replay_20260718_202700.csv', p2, timestampFromFilename));

    // sanity: the replays expose their real round-start seconds
    const roundStartSec = (h, m) => h * 3600 + m * 60;
    expect(evt.rounds.find(r => r.id === 'r1').meta.roundStartSec).toBe(roundStartSec(20, 0));
    expect(evt.rounds.find(r => r.id === 'r2').meta.roundStartSec).toBe(roundStartSec(20, 13));

    // --- the batch scoreboard match (as ingestFiles does) ---
    const files = [
      { name: 'scoreboard_20260718_200000.csv', text: SCOREBOARD_1 }, // round 1 (start-stamped)
      { name: 'scoreboard_20260718_201300.csv', text: SCOREBOARD_2 }, // round 2 (start-stamped)
    ];
    const parsedScoreboards = files.map(f => {
      const sb = parseScoreboardCsv(f.text);
      const d = timestampFromFilename(f.name);
      return { name: f.name, sb, ts: d ? d.getTime() : null, startSec: scoreboardStartSec(sb) };
    });
    const roundInfos = evt.rounds.map(r => ({
      id: r.id, ts: r.ts, startSec: r.meta?.roundStartSec ?? null, hasScoreboard: !!r.scoreboard,
    }));
    const { assignments, unmatched } = matchScoreboardsToRounds(roundInfos, parsedScoreboards);
    parsedScoreboards.forEach((ps, idx) => {
      if (assignments[idx]) evt = updateRound(evt, assignments[idx], { scoreboard: ps.sb, scoreboardFilename: ps.name });
    });

    // --- assert: no merge. Each round keeps its own scoreboard. ---
    expect(unmatched).toEqual([]);
    const r1 = evt.rounds.find(r => r.id === 'r1');
    const r2 = evt.rounds.find(r => r.id === 'r2');
    expect(r1.scoreboardFilename).toBe('scoreboard_20260718_200000.csv');
    expect(r2.scoreboardFilename).toBe('scoreboard_20260718_201300.csv');
    expect(r1.scoreboard.metadata.area).toBe('The Cornfield');
    expect(r2.scoreboard.metadata.area).toBe('The Sunken Road');
    // the two rounds hold distinct scoreboards — the reported bug is gone
    expect(r1.scoreboard).not.toBe(r2.scoreboard);
    expect(r1.scoreboard.metadata.round_start_time).toBe('20:00:00');
    expect(r2.scoreboard.metadata.round_start_time).toBe('20:13:00');
  });

  it('the old per-file nearest match would have collapsed them (documents the bug)', () => {
    let evt = newEvent();
    evt = upsertRound(evt, makeRound('r1', 'replay_20260718_201200.csv', parseReplayCsv(REPLAY_1), timestampFromFilename));
    evt = upsertRound(evt, makeRound('r2', 'replay_20260718_202700.csv', parseReplayCsv(REPLAY_2), timestampFromFilename));
    const sb1Ts = timestampFromFilename('scoreboard_20260718_200000.csv').getTime();
    const sb2Ts = timestampFromFilename('scoreboard_20260718_201300.csv').getTime();
    // Both nearest-match to the same round — the behaviour we replaced.
    expect(nearestRoundForTimestamp(evt, sb1Ts)).toBe('r1');
    expect(nearestRoundForTimestamp(evt, sb2Ts)).toBe('r1');
  });
});
