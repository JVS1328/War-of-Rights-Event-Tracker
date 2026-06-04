import { describe, it, expect } from 'vitest';
import { parseScoreboard } from './parseScoreboard';
import { computePlayerLeaderboard, computeRegimentBreakdown, computeRegimentContextStats } from './statsEngine';

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

  it('drops killfeed-only labels that would otherwise be 0-player regiments', () => {
    // [99thPA]Ghost appears only as a killer in the feed — never on a roster.
    const ghostKill = `map,DrillCamp
mode,Skirmish
winner,CSA

name,team,kills,deaths,kd,deaths_in_form,deaths_skirm,deaths_oob,steam_id
[51stNY]Joe,2,1,1,1.00,1,0,0,76561198000000001

time,killer,killer_steam_id,killer_team,victim,victim_steam_id,victim_team,victim_formation,cause,cat,sub
16:10:00,[99thPA]Ghost,76561198000000777,1,[51stNY]Joe,76561198000000001,2,in_form,Minie,0,4
`;
    const regs = computeRegimentBreakdown([parseScoreboard(ghostKill, 'scoreboard_20260101_120000.csv')], {});
    expect(regs.find((r) => r.regiment === '99THPA')).toBeUndefined();
    expect(regs.every((r) => r.players > 0)).toBe(true);
  });
});

describe('computeRegimentContextStats', () => {
  const USA_ATTACKS = `map,DrillCamp
mode,Skirmish
area,Alexander Farm
winner,USA

name,team,kills,deaths,kd,deaths_in_form,deaths_skirm,deaths_oob,steam_id
[51stNY]Joe,1,3,1,3.00,1,0,0,76561198000000001
[20thGA]Han,2,1,2,0.50,1,1,0,76561198000000002

time,killer,killer_steam_id,killer_team,victim,victim_steam_id,victim_team,victim_formation,cause,cat,sub
16:10:00,[51stNY]Joe,76561198000000001,1,[20thGA]Han,76561198000000002,2,in_form,Minie,0,4
`;

  const CSA_ATTACKS = `map,DrillCamp
mode,Skirmish
area,Crecy's Cornfield
winner,CSA

name,team,kills,deaths,kd,deaths_in_form,deaths_skirm,deaths_oob,steam_id
[51stNY]Joe,1,0,2,0.00,1,1,0,76561198000000001
[20thGA]Han,2,2,0,0.00,0,0,0,76561198000000002

time,killer,killer_steam_id,killer_team,victim,victim_steam_id,victim_team,victim_formation,cause,cat,sub
16:10:00,[20thGA]Han,76561198000000002,2,[51stNY]Joe,76561198000000001,1,skirm,Minie,0,4
`;

  it('splits stats by faction and attacker/defender role using the area field', () => {
    const sbs = [
      parseScoreboard(USA_ATTACKS, 'scoreboard_20260201_120000.csv'),
      parseScoreboard(CSA_ATTACKS, 'scoreboard_20260201_130000.csv'),
    ];
    const ctx = computeRegimentContextStats(sbs, {});
    const ny = ctx['51STNY'];
    expect(ny).toBeDefined();

    expect(ny.asUSA.kills).toBe(3);
    expect(ny.asUSA.rounds).toBe(2);
    expect(ny.asCSA.kills).toBe(0);

    // Alexander Farm: USA attacks → 51stNY (USA) is attacker
    // Crecy's Cornfield: CSA attacks → 51stNY (USA) is defender
    expect(ny.asAttacker.kills).toBe(3);
    expect(ny.asAttacker.rounds).toBe(1);
    expect(ny.asDefender.kills).toBe(0);
    expect(ny.asDefender.deaths).toBe(2);
    expect(ny.asDefender.rounds).toBe(1);

    const ga = ctx['20THGA'];
    expect(ga.asCSA.kills).toBe(3);
    expect(ga.asDefender.kills).toBe(1);
    expect(ga.asDefender.rounds).toBe(1);
    expect(ga.asAttacker.kills).toBe(2);
    expect(ga.asAttacker.rounds).toBe(1);
  });

  it('skips attacker/defender for conquest maps (no area or unknown area)', () => {
    const conquest = `map,Antietam
mode,Conquest
area,Smokestacks
winner,

name,team,kills,deaths,kd,deaths_in_form,deaths_skirm,deaths_oob,steam_id
[51stNY]Joe,1,1,1,1.00,1,0,0,76561198000000001
`;
    const sbs = [parseScoreboard(conquest, 'scoreboard_20260201_140000.csv')];
    const ctx = computeRegimentContextStats(sbs, {});
    const ny = ctx['51STNY'];
    expect(ny.asUSA.kills).toBe(1);
    expect(ny.asAttacker.rounds).toBe(0);
    expect(ny.asDefender.rounds).toBe(0);
  });
});
