import { describe, it, expect } from 'vitest';
import { parseScoreboard } from './parseScoreboard';
import { computePlayerLeaderboard, computeRegimentBreakdown } from './statsEngine';

// Round 1: 51stNY Joe (CSA) 3k/1d; 20thGA Han (USA) 1k/2d.
const R1 = `round_start_time,16:00:00
round_end_time,16:30:00
map,DrillCamp
mode,Skirmish
winner,CSA

name,team,kills,deaths,kd,deaths_in_form,deaths_skirm,deaths_oob,steam_id
[51stNY]Joe,2,3,1,3.00,1,0,0,76561198000000001
[20thGA]Han,1,1,2,0.50,1,1,0,76561198000000002

time,killer,killer_steam_id,killer_team,victim,victim_steam_id,victim_team,victim_formation,cause,cat,sub
16:10:00,[51stNY]Joe,76561198000000001,2,[20thGA]Han,76561198000000002,1,in_form,Minie,0,4
16:11:00,[51stNY]Joe,76561198000000001,2,[20thGA]Han,76561198000000002,1,skirm,Melee,0,2
`;

// Round 2: same Joe 2k/1d; new 51stNY player Bob 1k/0d.
const R2 = `round_start_time,17:00:00
round_end_time,17:30:00
map,Antietam
mode,Skirmish
winner,USA

name,team,kills,deaths,kd,deaths_in_form,deaths_skirm,deaths_oob,steam_id
[51stNY]Joe,2,2,1,2.00,1,0,0,76561198000000001
[51stNY]Bob,1,1,0,0.00,0,0,0,76561198000000003

time,killer,killer_steam_id,killer_team,victim,victim_steam_id,victim_team,victim_formation,cause,cat,sub
17:05:00,[20thGA]Han,76561198000000002,1,[51stNY]Bob,76561198000000003,2,oob,Canister,0,0
`;

const boards = [
  parseScoreboard(R1, 'scoreboard_20260101_163000.csv'),
  parseScoreboard(R2, 'scoreboard_20260101_173000.csv'),
];

describe('computePlayerLeaderboard', () => {
  it('aggregates kills/deaths across rounds, keyed by steam id', () => {
    const rows = computePlayerLeaderboard(boards, {});
    const joe = rows.find((r) => r.steamId === '76561198000000001');
    expect(joe).toBeDefined();
    expect(joe!.kills).toBe(5); // 3 + 2
    expect(joe!.deaths).toBe(2); // 1 + 1
    expect(joe!.rounds).toBe(2);
    expect(joe!.kd).toBe(2.5); // 5 / 2
  });

  it('resolves regiment from the name tag by default', () => {
    const rows = computePlayerLeaderboard(boards, {});
    const joe = rows.find((r) => r.steamId === '76561198000000001');
    expect(joe!.regiment).toBe('51STNY');
  });

  it('honors an explicit assignment override by steam id', () => {
    const rows = computePlayerLeaderboard(boards, { '76561198000000001': 'Custom Rgt' });
    const joe = rows.find((r) => r.steamId === '76561198000000001');
    expect(joe!.regiment).toBe('Custom Rgt');
  });

  it('sorts by kills descending by default', () => {
    const rows = computePlayerLeaderboard(boards, {});
    expect(rows[0].steamId).toBe('76561198000000001'); // Joe, 4 kills
  });
});

describe('computeRegimentBreakdown', () => {
  it('groups players into regiments and sums kills/deaths', () => {
    const regs = computeRegimentBreakdown(boards, {});
    const ny = regs.find((r) => r.regiment === '51STNY');
    expect(ny).toBeDefined();
    expect(ny!.players).toBe(2); // Joe + Bob
    expect(ny!.kills).toBe(6); // Joe 5 + Bob 1
    expect(ny!.deaths).toBe(2); // Joe 2 + Bob 0
  });

  it('counts casualties by cause from the killfeed (victim → regiment)', () => {
    const regs = computeRegimentBreakdown(boards, {});
    const ga = regs.find((r) => r.regiment === '20THGA');
    // Han (20thGA) died to Minie and Melee in R1.
    expect(ga!.casualtiesByCause).toMatchObject({ Minie: 1, Melee: 1 });
  });
});
