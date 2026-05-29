import { describe, it, expect } from 'vitest';
import {
  topLossRates,
  topKillRates,
  topIndividualKills,
  topIndividualDeaths,
  firstAndLastDeath,
  computeNemeses,
} from './roundAnalytics';
import type { Scoreboard, ScoreboardPlayer, Kill, ScoreboardMeta, Team } from './types';

function mkPlayer(name: string, team: Team, kills: number, deaths: number): ScoreboardPlayer {
  return {
    name,
    team,
    kills,
    deaths,
    kd: deaths > 0 ? kills / deaths : kills,
    deathsInForm: 0,
    deathsSkirm: 0,
    deathsOob: 0,
    steamId: name,
  };
}

function mkKill(killer: string | null, victim: string, ts: string, cause = 'minie'): Kill {
  return {
    tsInRound: ts,
    killer,
    killerSteamId: killer,
    killerTeam: null,
    victim,
    victimSteamId: victim,
    victimTeam: null,
    victimFormation: null,
    cause,
    cat: 0,
    sub: 0,
  };
}

function emptyMeta(): ScoreboardMeta {
  const cas = { total: 0, inForm: 0, skirm: 0, oob: 0 };
  return {
    roundStartTime: null,
    roundEndTime: null,
    map: 'Antietam',
    mode: 'Skirmish',
    area: null,
    winner: null,
    popNow: null,
    popRoundStart: null,
    popRoundPeak: null,
    popRoundMax: null,
    popRoundEnd: null,
    moraleUsa: null,
    moraleCsa: null,
    casualties: { USA: { ...cas }, CSA: { ...cas } },
    deathsByWeapon: { USA: {}, CSA: {} },
  };
}

function mkScoreboard(players: ScoreboardPlayer[], kills: Kill[] = []): Scoreboard {
  return {
    sourceFilename: 'test.csv',
    recordedAt: null,
    meta: emptyMeta(),
    players,
    officers: [],
    roster: [],
    kills,
    joinLeaves: [],
  };
}

const players = [
  mkPlayer('1stTX | Alice', 'USA', 5, 2),
  mkPlayer('1stTX | Bob', 'USA', 3, 4),
  mkPlayer('2ndVA | Carol', 'CSA', 10, 1),
  mkPlayer('2ndVA | Dave', 'CSA', 0, 8),
  mkPlayer('Lone', 'USA', 1, 1), // single-player regiment -> excluded from unit rates
];

describe('roundAnalytics', () => {
  it('ranks unit loss rates, excluding sub-min-player units', () => {
    const rows = topLossRates(mkScoreboard(players), { minPlayers: 2 });
    expect(rows.map((r) => r.regiment)).toEqual(['2NDVA', '1STTX']);
    // 2ndVA: 9 deaths / 2 players = 4.5; 1stTX: 6 / 2 = 3
    expect(rows[0].lossRate).toBeCloseTo(4.5);
    expect(rows[1].lossRate).toBeCloseTo(3);
  });

  it('ranks unit kill rates', () => {
    const rows = topKillRates(mkScoreboard(players), { minPlayers: 2 });
    // 2ndVA: 10 kills / 2 = 5; 1stTX: 8 / 2 = 4
    expect(rows[0].regiment).toBe('2NDVA');
    expect(rows[0].killRate).toBeCloseTo(5);
    expect(rows[1].killRate).toBeCloseTo(4);
  });

  it('returns top individual kills with limit and zero-filtering', () => {
    const kills = topIndividualKills(mkScoreboard(players), 3);
    expect(kills.map((r) => r.name)).toEqual(['2ndVA | Carol', '1stTX | Alice', '1stTX | Bob']);
    expect(kills[0]).toMatchObject({ value: 10, regiment: '2NDVA', key: '2ndVA | Carol' });
  });

  it('returns top individual deaths, excluding zero-death players', () => {
    const deaths = topIndividualDeaths(mkScoreboard(players), 10);
    expect(deaths[0]).toMatchObject({ name: '2ndVA | Dave', value: 8 });
    expect(deaths.every((r) => r.value > 0)).toBe(true);
  });

  it('finds first and last death by timestamp', () => {
    const kills = [
      mkKill('A', 'B', '00:05:00'),
      mkKill('C', 'D', '00:01:00'),
      mkKill('E', 'F', '00:09:30'),
    ];
    const { first, last } = firstAndLastDeath(mkScoreboard([], kills));
    expect(first?.victim).toBe('D');
    expect(last?.victim).toBe('F');
  });

  it('returns nulls for first/last death when there is no killfeed', () => {
    const { first, last } = firstAndLastDeath(mkScoreboard(players, []));
    expect(first).toBeNull();
    expect(last).toBeNull();
  });

  it('computes nemesis pairings, excluding self/environment and below threshold', () => {
    const kills = [
      mkKill('Hunter', 'Prey', '00:01:00'),
      mkKill('Hunter', 'Prey', '00:02:00'),
      mkKill('Hunter', 'Prey', '00:03:00'),
      mkKill('Hunter', 'Other', '00:04:00'), // only 1 kill -> below threshold
      mkKill(null, 'Prey', '00:05:00'), // environment -> excluded
      mkKill('Self', 'Self', '00:06:00'), // self -> excluded
    ];
    const rows = computeNemeses(mkScoreboard([], kills), { minKills: 2 });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ killer: 'Hunter', victim: 'Prey', count: 3 });
  });
});
