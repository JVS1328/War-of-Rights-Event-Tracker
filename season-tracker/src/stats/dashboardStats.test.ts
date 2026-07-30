import { describe, it, expect } from 'vitest';
import { parseScoreboard } from './parseScoreboard';
import {
  computePlayerLeaderboard,
  computeOfficerLeaderboard,
  computeRounds,
  computeOverview,
  computeMapBreakdown,
  computeScoreboardMapStats,
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

// Newer scoreboards emit the command log as one row per STINT, so a CO who was
// replaced and later retook the slot — or who commanded two companies — appears
// several times in a single round. The leaderboard still counts rounds, so those
// rows have to collapse.
const STINTS = `round_start_time,18:00:00
round_end_time,18:30:00
round_duration_s,1800
map,DrillCamp
mode,Skirmish
winner,CSA

name,team,kills,deaths,kd,deaths_in_form,deaths_skirm,deaths_oob,steam_id
Archer,2,4,1,4.00,1,0,0,76561198000000010
Grim,2,2,2,1.00,1,1,0,76561198000000011
Star,2,1,0,1.00,0,0,0,76561198000000012

officer,team,regiment,company,branch,rank,commanded,commanded_avg,start,end,duration_s,pct_round,steam_id
Archer,2,27th NC,A Company,Infantry,Lt. Colonel,47,43,18:00:00,18:11:00,660,37,76561198000000010
Archer,2,27th NC,A Company,Infantry,Lt. Colonel,29,25,18:20:00,18:30:00,600,33,76561198000000010
Archer,2,27th NC,B Company,Infantry,Lt. Colonel,18,15,18:11:00,18:20:00,540,30,76561198000000010

team,regiment,company,name,class,rank,duration_s,pct_round,steam_id
CSA,27th NC,A Company,Archer,Officer,Lt. Colonel,1800,100,76561198000000010
CSA,27th NC,A Company,Grim,Private,,1800,100,76561198000000011
CSA,27th NC,B Company,Star,Private,,1800,100,76561198000000012

time,killer,killer_steam_id,killer_team,victim,victim_steam_id,victim_team,victim_formation,cause,cat,sub
18:05:00,Archer,76561198000000010,2,xx,76561198000000099,1,in_form,Minie,0,4
`;

describe('officer leaderboard — per-stint command log', () => {
  const stintBoards = [parseScoreboard(STINTS, 'scoreboard_20260101_183000.csv')];

  it('counts one round when an officer held the slot across several stints', () => {
    const archer = computeOfficerLeaderboard(stintBoards, {}).find((o) => o.name === 'Archer')!;
    expect(archer.rounds).toBe(1);
  });

  it('reports the peak subordinates commanded, not the sum across stints', () => {
    const archer = computeOfficerLeaderboard(stintBoards, {}).find((o) => o.name === 'Archer')!;
    expect(archer.commanded).toBe(47);
  });

  it('counts the round once in the win/loss record', () => {
    const archer = computeOfficerLeaderboard(stintBoards, {}).find((o) => o.name === 'Archer')!;
    expect(archer.wins).toBe(1);
    expect(archer.losses).toBe(0);
  });

  it('counts each subordinate once across every company commanded', () => {
    const archer = computeOfficerLeaderboard(stintBoards, {}).find((o) => o.name === 'Archer')!;
    // A Co (Archer 4 + Grim 2) and B Co (Star 1) were both his — 7 kills, and
    // nobody double-counted despite A Company appearing in two stints.
    expect(archer.unitKills).toBe(7);
    expect(archer.unitDeaths).toBe(3);
  });
});

// Officers do swap sides mid-round: the command log records the stint under each
// team, so a posting's subordinates must be looked up on the team that posting
// was served for, not on whichever side the officer happened to start on.
const TEAM_SWAP = `round_start_time,19:00:00
round_end_time,19:30:00
map,DrillCamp
mode,Skirmish
winner,USA

name,team,kills,deaths,kd,deaths_in_form,deaths_skirm,deaths_oob,steam_id
Caldwell,1,3,1,3.00,1,0,0,76561198000000020
Blue,1,2,1,2.00,1,0,0,76561198000000021
Gray,2,5,2,2.50,2,0,0,76561198000000022

officer,team,regiment,company,branch,rank,commanded,commanded_avg,start,end,duration_s,pct_round,steam_id
Caldwell,1,14th Indiana,B Company,Infantry,Captain,20,18,19:00:00,19:15:00,900,50,76561198000000020
Caldwell,2,27th NC,B Company,Infantry,Captain,25,22,19:15:00,19:30:00,900,50,76561198000000020

team,regiment,company,name,class,rank,duration_s,pct_round,steam_id
USA,14th Indiana,B Company,Blue,Private,,1800,100,76561198000000021
USA,14th Indiana,B Company,Caldwell,Officer,Captain,900,50,76561198000000020
CSA,27th NC,B Company,Gray,Private,,1800,100,76561198000000022

time,killer,killer_steam_id,killer_team,victim,victim_steam_id,victim_team,victim_formation,cause,cat,sub
19:05:00,Caldwell,76561198000000020,1,xx,76561198000000099,2,in_form,Minie,0,4
`;

describe('officer leaderboard — officer who swapped teams mid-round', () => {
  it('resolves each posting on the team it was served for', () => {
    const boards2 = [parseScoreboard(TEAM_SWAP, 'scoreboard_20260101_193000.csv')];
    const cald = computeOfficerLeaderboard(boards2, {}).find((o) => o.name === 'Caldwell')!;
    expect(cald.rounds).toBe(1);
    expect(cald.commanded).toBe(25); // peak across both sides
    // USA 14th Indiana B (Caldwell 3 + Blue 2) plus CSA 27th NC B (Gray 5).
    expect(cald.unitKills).toBe(10);
    expect(cald.unitDeaths).toBe(4);
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

describe('scoreboard map stats (Maps tab source)', () => {
  it('aggregates wins & casualties per map into the tracker shape', () => {
    const { overall, byMap } = computeScoreboardMapStats(boards);
    expect(overall.totalRounds).toBe(2);
    expect(overall.usaWins).toBe(1);
    expect(overall.csaWins).toBe(1);
    // USA lost 2 (R1) + 1 (R2) = 3; CSA lost 1 + 1 = 2; total 5.
    expect(overall.usaCasualties).toBe(3);
    expect(overall.csaCasualties).toBe(2);
    expect(overall.totalCasualties).toBe(5);
    // Only R1 supplied a formation breakdown: USA IF1/Sk1 + CSA IF1 → IF2/Sk1/OoL0.
    expect(overall.formationTotal).toEqual({ in_form: 2, skirm: 1, oob: 0 });
    expect(overall.hasFormation).toBe(true);

    expect(Object.keys(byMap)).toHaveLength(2);
    const drill = Object.values(byMap).find((m) => m.csaWins === 1)!;
    expect(drill.plays).toBe(1);
    expect(drill.usaCasualties).toBe(2);
    expect(drill.avgFormationUsa).toEqual({ in_form: 1, skirm: 1, oob: 0 });
    expect(drill.hasFormation).toBe(true);
  });

  it('returns an empty projection when there are no scoreboards', () => {
    const { overall, byMap } = computeScoreboardMapStats([]);
    expect(overall.totalRounds).toBe(0);
    expect(overall.hasFormation).toBe(false);
    expect(Object.keys(byMap)).toHaveLength(0);
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
