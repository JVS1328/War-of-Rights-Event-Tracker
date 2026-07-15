import { describe, it, expect } from 'vitest';
import { parseReplayCsv } from '../utils/replayParser';
import { parseScoreboardCsv } from '../scoreboard/parseScoreboard';
import { REPLAY_CSV, SCOREBOARD_CSV } from '../__fixtures__/synthetic';
import { presenceOverTime, peakPresence, casualtiesOverTime, casualtiesByCause } from './presence';
import { centroidsOverTime, centroidSeparation, distancePerPlayer, frontlineOverTime } from './movement';
import { leadershipOverTime, leaderSpans } from './leadership';
import { engagementOverTime, peakContactFrame } from './engagement';
import { presencePoints, casualtyPoints } from './heatmap';
import { regimentLabel, groupPlayersByRegiment } from './regiments';

const replay = parseReplayCsv(REPLAY_CSV);
const scoreboard = parseScoreboardCsv(SCOREBOARD_CSV);

const near = (a, b, eps = 0.5) => Math.abs(a - b) <= eps;

describe('presence', () => {
  it('counts present players per team, seeing Carol drop at frame 3', () => {
    const p = presenceOverTime(replay);
    expect(p.usa).toEqual([2, 2, 2, 2, 2, 2]);
    expect(p.csa).toEqual([1, 1, 1, 0, 1, 1]);
    expect(p.total).toEqual([3, 3, 3, 2, 3, 3]);
    expect(peakPresence(p)).toEqual({ usa: 2, csa: 1 });
  });

  it('builds cumulative casualties from the scoreboard, aligned to t_s', () => {
    const c = casualtiesOverTime(replay, scoreboard.kills);
    expect(c.available).toBe(true);
    // Bob (USA) dies at t_s 1.0 (frame 2); Carol (CSA) at t_s 2.0 (frame 4).
    expect(c.usa).toEqual([0, 0, 1, 1, 1, 1]);
    expect(c.csa).toEqual([0, 0, 0, 0, 1, 1]);
  });

  it('is unavailable with no kills', () => {
    expect(casualtiesOverTime(replay, null).available).toBe(false);
  });

  it('buckets casualties by cause', () => {
    const rows = casualtiesByCause(scoreboard.kills);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.cause).sort()).toEqual(['Minie', 'Rifle']);
  });
});

describe('movement', () => {
  it('computes team centroids and separation', () => {
    const c = centroidsOverTime(replay);
    expect(c.usa[0]).toEqual({ x: 1615, y: 2580 });   // (1620+1610)/2, (2600+2560)/2
    expect(c.csa[0]).toEqual({ x: 1500, y: 2620 });
    const sep = centroidSeparation(replay, c);
    expect(near(sep[0], Math.hypot(115, -40))).toBe(true);
  });

  it('sums distance traveled per player (Alice moves steadily)', () => {
    const d = distancePerPlayer(replay);
    // Alice: 5 steps of ~6m each ≈ 30m
    expect(d[0]).toBeGreaterThan(24);
    expect(d[0]).toBeLessThan(32);
  });

  it('anchors a frontline axis when both teams appear', () => {
    const fl = frontlineOverTime(replay);
    expect(fl.ok).toBe(true);
    expect(near(fl.span, Math.hypot(115, -40), 1)).toBe(true);
    expect(fl.usa[0]).not.toBeNull();
    expect(fl.csa[0]).not.toBeNull();
  });
});

describe('leadership', () => {
  it('tracks officers/flags present per team', () => {
    const l = leadershipOverTime(replay);
    expect(l.usaOfficers).toEqual([1, 1, 1, 1, 1, 1]);   // Alice always present
    expect(l.csaFlags).toEqual([1, 1, 1, 0, 1, 1]);       // Carol, minus frame 3
    expect(l.csaOfficers).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('lists leader spans, longest first', () => {
    const spans = leaderSpans(replay);
    expect(spans[0]).toMatchObject({ name: '[1stTX]Colonel_Alice', kind: 'officer', frames: 6 });
    const carol = spans.find((s) => s.name === '[2ndMS]Carol');
    expect(carol).toMatchObject({ kind: 'flag', frames: 5 });
  });
});

describe('engagement', () => {
  it('counts close opposing pairs and min distance', () => {
    const e = engagementOverTime(replay, 200);        // wide threshold for the toy spacing
    expect(e.contacts[0]).toBe(2);                    // Carol within 200m of both USA
    expect(e.contacts[3]).toBe(0);                    // Carol absent
    expect(e.minDist[3]).toBeNull();
    expect(near(e.minDist[0], Math.hypot(120, -20), 1)).toBe(true);
    expect(peakContactFrame(e)).not.toBeNull();
  });
});

describe('heatmap', () => {
  it('projects sampled positions to map pixels', () => {
    const pts = presencePoints(replay, 'antietam');
    // 17 sampled positions × 2 coords
    expect(pts.length).toBe(34);
  });

  it('locates casualties at the victim frame', () => {
    const pts = casualtyPoints(replay, scoreboard.kills, 'antietam');
    expect(pts).toHaveLength(2);
    expect(pts[0]).toHaveProperty('victimTeam');
  });
});

describe('regiments', () => {
  it('resolves normalized labels and groups players', () => {
    expect(regimentLabel('[1stTX]Colonel_Alice')).toBe('1STTX');
    expect(regimentLabel('[2ndMS]Carol')).toBe('2NDMS');
    const groups = groupPlayersByRegiment(replay);
    expect(groups.get('1STTX')).toEqual([0, 1]);
    expect(groups.get('2NDMS')).toEqual([2]);
  });
});
