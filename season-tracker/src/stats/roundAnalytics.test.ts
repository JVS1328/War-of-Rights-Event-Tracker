import { describe, it, expect } from 'vitest';
import {
  topLossRates,
  topKillRates,
  topIndividualKills,
  topIndividualDeaths,
  topTicketInflicted,
  topTicketReceived,
  firstAndLastDeath,
  computeNemeses,
} from './roundAnalytics';
import type { Scoreboard, ScoreboardPlayer, Kill, ScoreboardMeta, Team, Formation } from './types';

function mkPlayer(
  name: string,
  team: Team,
  kills: number,
  deaths: number,
  form: { inForm?: number; skirm?: number; oob?: number } = {},
): ScoreboardPlayer {
  return {
    name,
    team,
    kills,
    deaths,
    kd: deaths > 0 ? kills / deaths : kills,
    deathsInForm: form.inForm ?? 0,
    deathsSkirm: form.skirm ?? 0,
    deathsOob: form.oob ?? 0,
    steamId: name,
  };
}

function mkKill(
  killer: string | null,
  victim: string,
  ts: string,
  cause = 'minie',
  victimFormation: Formation | null = null,
): Kill {
  return {
    tsInRound: ts,
    killer,
    killerSteamId: killer,
    killerTeam: null,
    victim,
    victimSteamId: victim,
    victimTeam: null,
    victimFormation,
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

  it('ranks ticket damage inflicted by ×Tk weight of each victim formation', () => {
    // Alice: 1 IF (1) + 1 OoL (5) = 6; Bob: 2 Skirm (3+3) = 6 but fewer... make distinct.
    const roster = [
      mkPlayer('1stTX | Alice', 'USA', 2, 0),
      mkPlayer('1stTX | Bob', 'USA', 2, 0),
      mkPlayer('2ndVA | Carol', 'CSA', 0, 0),
    ];
    const kills = [
      mkKill('1stTX | Alice', '2ndVA | Carol', '00:01:00', 'minie', 'in_form'), // 1
      mkKill('1stTX | Alice', '2ndVA | Carol', '00:02:00', 'minie', 'oob'), // 5
      mkKill('1stTX | Bob', '2ndVA | Carol', '00:03:00', 'melee', 'skirm'), // 3
    ];
    const rows = topTicketInflicted(mkScoreboard(roster, kills));
    expect(rows.map((r) => r.name)).toEqual(['1stTX | Alice', '1stTX | Bob']);
    expect(rows[0]).toMatchObject({ value: 6, regiment: '1STTX', key: '1stTX | Alice' });
    expect(rows[1].value).toBe(3);
  });

  it('ranks ticket damage received by ×Td weight of each death stance', () => {
    const roster = [
      mkPlayer('A', 'USA', 0, 3, { inForm: 1, skirm: 1, oob: 1 }), // 1+3+5 = 9
      mkPlayer('B', 'USA', 0, 2, { inForm: 2, skirm: 0, oob: 0 }), // 2
      mkPlayer('C', 'CSA', 0, 0), // no deaths → excluded
    ];
    const rows = topTicketReceived(mkScoreboard(roster));
    expect(rows.map((r) => r.name)).toEqual(['A', 'B']);
    expect(rows[0].value).toBe(9);
    expect(rows[1].value).toBe(2);
    expect(rows.every((r) => r.value > 0)).toBe(true);
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
