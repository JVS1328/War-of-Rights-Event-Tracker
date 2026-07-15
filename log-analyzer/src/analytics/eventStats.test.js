import { describe, it, expect } from 'vitest';
import { parseReplayCsv } from '../utils/replayParser';
import { parseScoreboardCsv } from '../scoreboard/parseScoreboard';
import { REPLAY_CSV, SCOREBOARD_CSV } from '../__fixtures__/synthetic';
import { computeEventStats } from './eventStats';

const replay = parseReplayCsv(REPLAY_CSV);
const scoreboard = parseScoreboardCsv(SCOREBOARD_CSV);

const rounds = [{ id: 'r1', replayId: 'rp1', scoreboard }];
const replays = new Map([['rp1', replay]]);

describe('computeEventStats', () => {
  const stats = computeEventStats(rounds, replays);
  const byName = Object.fromEntries(stats.players.map((p) => [p.name, p]));

  it('aggregates per-player combat + roster', () => {
    expect(stats.players).toHaveLength(3);
    const alice = byName['[1stTX]Colonel_Alice'];
    expect(alice).toMatchObject({ kills: 1, deaths: 0, regiment: '1STTX', rounds: 1 });
    expect(alice.avgTk).toBe(3);         // killed Carol (skirmish) → 3 tickets
    expect(alice.distanceYd).toBeGreaterThan(0);

    const bob = byName['[1stTX]Bob'];
    expect(bob).toMatchObject({ kills: 0, deaths: 1 });
    expect(bob.avgTd).toBe(1);           // died in formation → 1 ticket

    const carol = byName['[2ndMS]Carol'];
    expect(carol).toMatchObject({ kills: 1, deaths: 1, regiment: '2NDMS' });
    expect(carol.avgTk).toBe(1);         // killed Bob (in formation)
    expect(carol.avgTd).toBe(3);         // died skirmishing
  });

  it('rolls up units with the ticket model and cause breakdown', () => {
    const byUnit = Object.fromEntries(stats.units.map((u) => [u.regiment, u]));
    expect(byUnit['1STTX']).toMatchObject({ players: 2, kills: 1, deaths: 1 });
    expect(byUnit['2NDMS']).toMatchObject({ players: 1, kills: 1, deaths: 1 });
    // 1STTX suffered Bob's death by Minie
    expect(byUnit['1STTX'].casualtiesByCause).toEqual([{ cause: 'Minie', count: 1 }]);
    expect(byUnit['2NDMS'].casualtiesByCause).toEqual([{ cause: 'Rifle', count: 1 }]);
  });

  it('summarizes the event', () => {
    expect(stats.overview).toMatchObject({
      rounds: 1, scoreboardRounds: 1, players: 3, units: 2, kills: 2, casualties: 2,
    });
  });

  it('counts replay-only rounds for participation + distance, zero combat', () => {
    const s = computeEventStats([{ id: 'r1', replayId: 'rp1' }], replays);
    expect(s.overview.scoreboardRounds).toBe(0);
    expect(s.overview.kills).toBe(0);
    expect(s.players).toHaveLength(3);
    expect(s.players.every((p) => p.rounds === 1)).toBe(true);
    expect(s.players.find((p) => p.name === '[1stTX]Colonel_Alice').distanceYd).toBeGreaterThan(0);
  });
});
