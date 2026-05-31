import { describe, it, expect } from 'vitest';
import { parseScoreboard } from './parseScoreboard';
import {
  computePlayerLeaderboard,
  computeOfficerLeaderboard,
  computeRounds,
  computeOverview,
  computeMapBreakdown,
  computeRegimentBreakdown,
  computePlayerDetail,
} from './statsEngine';

const R1 = `round_start_time,16:00:00
round_end_time,16:30:00
map,DrillCamp
mode,Skirmish
area,Meadow
winner,CSA
casualties_usa,2
casualties_usa_in_form,1
casualties_usa_skirm,1
casualties_csa,1
casualties_csa_in_form,1

name,team,kills,deaths,kd,deaths_in_form,deaths_skirm,deaths_oob,steam_id
[51stNY]Joe,2,3,1,3.00,1,0,0,76561198000000001
[20thGA]Han,1,1,2,0.50,1,1,0,76561198000000002
ArtyGuy,2,2,0,2.00,0,0,0,76561198000000003

officer,team,commanded,battery
[51stNY]Joe,2,30,0
ArtyGuy,2,5,1

team,regiment,company,name,class,rank,steam_id
CSA,Regiment A,A Company,[51stNY]Joe,Officer,,76561198000000001
CSA,Regiment A,A Company,[51stNY]Pat,Private,,76561198000000004
CSA,Battery A,A Company,ArtyGuy,Officer,,76561198000000003
USA,Regiment B,A Company,[20thGA]Han,Private,,76561198000000002

time,killer,killer_steam_id,killer_team,victim,victim_steam_id,victim_team,victim_formation,cause,cat,sub
16:10:00,[51stNY]Joe,76561198000000001,2,[20thGA]Han,76561198000000002,1,in_form,Minie,0,4
16:11:00,[51stNY]Joe,76561198000000001,2,[20thGA]Han,76561198000000002,1,skirm,Melee,0,2
16:12:00,[51stNY]Joe,76561198000000001,2,xx,76561198000000099,1,oob,Minie,0,4
16:13:00,ArtyGuy,76561198000000003,2,yy,76561198000000098,1,oob,Canister,0,0
16:14:00,ArtyGuy,76561198000000003,2,zz,76561198000000097,1,oob,Canister,0,0
`;

const R2 = `round_start_time,17:00:00
round_end_time,17:20:00
map,Antietam
mode,Skirmish
area,Cornfield
winner,USA
casualties_usa,1
casualties_csa,1

name,team,kills,deaths,kd,deaths_in_form,deaths_skirm,deaths_oob,steam_id
[51stNY]Joe,2,2,1,2.00,0,1,0,76561198000000001
[20thGA]Han,1,0,1,0.00,0,0,1,76561198000000002

time,killer,killer_steam_id,killer_team,victim,victim_steam_id,victim_team,victim_formation,cause,cat,sub
17:05:00,[51stNY]Joe,76561198000000001,2,[20thGA]Han,76561198000000002,1,skirm,Minie,0,4
`;

const boards = [
  parseScoreboard(R1, 'scoreboard_20260101_163000.csv'),
  parseScoreboard(R2, 'scoreboard_20260101_172000.csv'),
];

describe('player leaderboard — ticket metrics & class', () => {
  it('computes ×Td from stance deaths', () => {
    const joe = computePlayerLeaderboard(boards, {}).find((p) => p.steamId === '76561198000000001')!;
    // deaths IF=1, Sk=1, OoL=0 → (1+3+0)/2 = 2.0
    expect(joe.avgTd).toBeCloseTo(2.0, 5);
  });

  it('computes ×Tk from killfeed kills bucketed by victim formation', () => {
    const joe = computePlayerLeaderboard(boards, {}).find((p) => p.steamId === '76561198000000001')!;
    // kills IF=1, Sk=2, OoL=1 → (1 + 6 + 5)/4 = 3.0
    expect(joe.killsInForm).toBe(1);
    expect(joe.killsSkirm).toBe(2);
    expect(joe.killsOob).toBe(1);
    expect(joe.avgTk).toBeCloseTo(3.0, 5);
  });

  it('partitions stats by role per round (inf/arty/all reconcile)', () => {
    // ArtyGuy played only a battery round; Joe only infantry rounds.
    const all = computePlayerLeaderboard(boards, {});
    const inf = computePlayerLeaderboard(boards, {}, { type: 'inf' });
    const arty = computePlayerLeaderboard(boards, {}, { type: 'arty' });

    expect(all.find((p) => p.steamId === '76561198000000003')).toBeDefined();
    expect(arty.find((p) => p.steamId === '76561198000000003')).toBeDefined(); // arty appears under arty
    expect(inf.find((p) => p.steamId === '76561198000000003')).toBeUndefined(); // not under inf
    expect(inf.find((p) => p.steamId === '76561198000000001')).toBeDefined(); // Joe under inf
    expect(arty.find((p) => p.steamId === '76561198000000001')).toBeUndefined(); // not under arty
  });
});

describe('player detail — role filter', () => {
  it('restricts a player card to inf or arty rounds', () => {
    const arty = computePlayerDetail(boards, '76561198000000003', {}, { type: 'arty' });
    expect(arty?.kills).toBe(2); // ArtyGuy's battery round
    expect(computePlayerDetail(boards, '76561198000000003', {}, { type: 'inf' })).toBeNull();
  });
});

describe('officer leaderboard', () => {
  it('aggregates unit K/D from roster members and flags battery', () => {
    const offs = computeOfficerLeaderboard(boards, {});
    const joe = offs.find((o) => o.name === '[51stNY]Joe')!;
    expect(joe.battery).toBe(false);
    expect(joe.commanded).toBe(30);
    expect(joe.unitKills).toBe(3); // Joe 3 + Pat 0
    expect(joe.unitDeaths).toBe(1);
    expect(joe.wins).toBe(1); // CSA won R1
    const arty = offs.find((o) => o.name === 'ArtyGuy')!;
    expect(arty.battery).toBe(true);
    expect(arty.unitKills).toBe(2);
  });
});

describe('rounds summary', () => {
  it('summarizes each round with duration and kill split', () => {
    const rounds = computeRounds(boards);
    const r1 = rounds.find((r) => r.map === 'DrillCamp')!;
    expect(r1.durationSeconds).toBe(1800);
    expect(r1.winner).toBe('CSA');
    expect(r1.csaKills).toBe(5); // Joe 3 + Arty 2
    expect(r1.usaKills).toBe(1); // Han 1
  });
});

describe('overview', () => {
  it('computes event-level totals', () => {
    const o = computeOverview(boards);
    expect(o.totalRounds).toBe(2);
    expect(o.usaWins).toBe(1);
    expect(o.csaWins).toBe(1);
    expect(o.distinctPlayers).toBe(3);
    expect(o.totalKills).toBe(8); // R1 5 + R2 3
  });
});

describe('map breakdown', () => {
  it('groups rounds by map with stats', () => {
    const maps = computeMapBreakdown(boards);
    expect(maps).toHaveLength(2);
    const dc = maps.find((m) => m.map === 'DrillCamp')!;
    expect(dc.rounds).toBe(1);
    expect(dc.csaWins).toBe(1);
  });
});

describe('regiment breakdown — formation casualties & rounds', () => {
  it('adds casualties by formation and round count', () => {
    const ny = computeRegimentBreakdown(boards, {}).find((r) => r.regiment === '51STNY')!;
    // Joe died IF=1 (R1) + Sk=1 (R2) → IF 1, Sk 1, OoL 0
    expect(ny.casualtiesByFormation).toMatchObject({ in_form: 1, skirm: 1, oob: 0 });
    expect(ny.rounds).toBe(2);
  });

  it('computes avg players per round alongside total unique players', () => {
    const ny = computeRegimentBreakdown(boards, {}).find((r) => r.regiment === '51STNY')!;
    // Only Joe carries the 51STNY tag; he fielded in both rounds → 1 unique, 1.0/rd avg.
    expect(ny.players).toBe(1);
    expect(ny.avgPlayers).toBeCloseTo(1.0, 5);
  });

  it('buckets casualties inflicted by cause (killer resolves to the regiment)', () => {
    const ny = computeRegimentBreakdown(boards, {}).find((r) => r.regiment === '51STNY')!;
    // Joe's kills: R1 Minie + Melee + Minie, R2 Minie → Minie 3, Melee 1.
    expect(ny.killsByCause).toEqual({ Minie: 3, Melee: 1 });
  });

  it('buckets casualties suffered by cause (victim resolves to the regiment)', () => {
    const ga = computeRegimentBreakdown(boards, {}).find((r) => r.regiment === '20THGA')!;
    // Han died: R1 Minie + Melee, R2 Minie → Minie 2, Melee 1. Han never inflicts a killfeed kill.
    expect(ga.casualtiesByCause).toEqual({ Minie: 2, Melee: 1 });
    expect(ga.killsByCause).toEqual({});
  });
});
