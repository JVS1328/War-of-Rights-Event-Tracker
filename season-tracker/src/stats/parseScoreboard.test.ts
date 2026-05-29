import { describe, it, expect } from 'vitest';
import { parseScoreboard } from './parseScoreboard';

const META_AND_PLAYERS = `round_start_time,16:59:43
round_end_time,17:39:19
map,DrillCamp
mode,Skirmish
area,Flemming's Meadow
winner,CSA
pop_now,166
pop_round_start,161
pop_round_peak,166
pop_round_max,187
pop_round_end,166
morale_usa,FinalPush
morale_csa,Breaking
casualties_usa,179
casualties_csa,111
casualties_usa_in_form,70
casualties_usa_skirm,57
casualties_usa_oob,52
casualties_csa_in_form,60
casualties_csa_skirm,32
casualties_csa_oob,19
deaths_usa_minie,54
deaths_usa_melee,57
deaths_csa_minie,19
deaths_csa_melee,45

name,team,kills,deaths,kd,deaths_in_form,deaths_skirm,deaths_oob,steam_id
pashaBiceps,2,3,0,3.00,0,0,0,76561198955655763
BASEDWOR,1,0,0,0.00,0,0,0,76561198430474911
`;

describe('parseScoreboard — meta', () => {
  it('parses round identity fields from the meta section', () => {
    const sb = parseScoreboard(META_AND_PLAYERS, 'scoreboard_20260527_173919.csv');
    expect(sb.meta.map).toBe('DrillCamp');
    expect(sb.meta.mode).toBe('Skirmish');
    expect(sb.meta.area).toBe("Flemming's Meadow");
    expect(sb.meta.winner).toBe('CSA');
    expect(sb.meta.roundStartTime).toBe('16:59:43');
    expect(sb.meta.roundEndTime).toBe('17:39:19');
  });

  it('parses population and morale', () => {
    const sb = parseScoreboard(META_AND_PLAYERS, 'x.csv');
    expect(sb.meta.popRoundStart).toBe(161);
    expect(sb.meta.popRoundPeak).toBe(166);
    expect(sb.meta.popRoundEnd).toBe(166);
    expect(sb.meta.moraleUsa).toBe('FinalPush');
    expect(sb.meta.moraleCsa).toBe('Breaking');
  });

  it('parses casualties by team and stance', () => {
    const sb = parseScoreboard(META_AND_PLAYERS, 'x.csv');
    expect(sb.meta.casualties.USA).toEqual({ total: 179, inForm: 70, skirm: 57, oob: 52 });
    expect(sb.meta.casualties.CSA).toEqual({ total: 111, inForm: 60, skirm: 32, oob: 19 });
  });

  it('parses deaths-by-weapon per team', () => {
    const sb = parseScoreboard(META_AND_PLAYERS, 'x.csv');
    expect(sb.meta.deathsByWeapon.USA.minie).toBe(54);
    expect(sb.meta.deathsByWeapon.USA.melee).toBe(57);
    expect(sb.meta.deathsByWeapon.CSA.minie).toBe(19);
  });
});

const FULL = `round_start_time,16:59:43
round_end_time,17:39:19
map,DrillCamp
mode,Skirmish
area,Flemming's Meadow
winner,CSA

name,team,kills,deaths,kd,deaths_in_form,deaths_skirm,deaths_oob,steam_id
pashaBiceps,2,3,1,3.00,1,0,0,76561198955655763
"Smith, John",1,5,2,2.50,2,0,0,76561198430474911

officer,team,commanded,battery
[20thGA]Pvt. Han,1,31,0
{PBR}Kernel Jewish Banker,2,9,1

team,regiment,company,name,class,rank,steam_id
USA,Battery A,A Company,[TTT] obamasus32,Officer,Colonel,76561199633316620
CSA,Unenlisted,,DDRMAN,,,76561199340766227

time,killer,killer_steam_id,killer_team,victim,victim_steam_id,victim_team,victim_formation,cause,cat,sub
17:29:11,Mr Fister,76561199368740246,2,SB-[51stNY]Vol.vanreiswick,76561198416690509,1,oob,Melee,0,2

time,player,steam_id,event
17:29:13,Godchilla,76561197978895735,joined
17:29:15,SB-[51stNY]Vol.vanreiswick,76561198416690509,left
`;

describe('parseScoreboard — players', () => {
  it('parses player rows with team normalization and string steam IDs', () => {
    const sb = parseScoreboard(FULL, 'x.csv');
    expect(sb.players).toHaveLength(2);
    const p = sb.players[0];
    expect(p).toEqual({
      name: 'pashaBiceps',
      team: 'CSA',
      kills: 3,
      deaths: 1,
      kd: 3,
      deathsInForm: 1,
      deathsSkirm: 0,
      deathsOob: 0,
      steamId: '76561198955655763',
    });
  });

  it('keeps steam IDs as exact strings (no float corruption)', () => {
    const sb = parseScoreboard(FULL, 'x.csv');
    expect(sb.players[0].steamId).toBe('76561198955655763');
    expect(typeof sb.players[0].steamId).toBe('string');
  });

  it('handles quoted names containing commas', () => {
    const sb = parseScoreboard(FULL, 'x.csv');
    expect(sb.players[1].name).toBe('Smith, John');
    expect(sb.players[1].team).toBe('USA');
  });
});

describe('parseScoreboard — officers', () => {
  it('parses officers with battery flag as boolean', () => {
    const sb = parseScoreboard(FULL, 'x.csv');
    expect(sb.officers).toHaveLength(2);
    expect(sb.officers[0]).toEqual({
      name: '[20thGA]Pvt. Han',
      team: 'USA',
      commanded: 31,
      battery: false,
    });
    expect(sb.officers[1].battery).toBe(true);
    expect(sb.officers[1].team).toBe('CSA');
  });
});

describe('parseScoreboard — roster', () => {
  it('parses roster entries with text teams and nullable fields', () => {
    const sb = parseScoreboard(FULL, 'x.csv');
    expect(sb.roster).toHaveLength(2);
    expect(sb.roster[0]).toEqual({
      team: 'USA',
      regiment: 'Battery A',
      company: 'A Company',
      name: '[TTT] obamasus32',
      className: 'Officer',
      rank: 'Colonel',
      steamId: '76561199633316620',
    });
    expect(sb.roster[1].company).toBeNull();
    expect(sb.roster[1].rank).toBeNull();
  });
});

describe('parseScoreboard — killfeed', () => {
  it('parses kills with team normalization and formation', () => {
    const sb = parseScoreboard(FULL, 'x.csv');
    expect(sb.kills).toHaveLength(1);
    expect(sb.kills[0]).toEqual({
      tsInRound: '17:29:11',
      killer: 'Mr Fister',
      killerSteamId: '76561199368740246',
      killerTeam: 'CSA',
      victim: 'SB-[51stNY]Vol.vanreiswick',
      victimSteamId: '76561198416690509',
      victimTeam: 'USA',
      victimFormation: 'oob',
      cause: 'Melee',
      cat: 0,
      sub: 2,
    });
  });
});

describe('parseScoreboard — join/leave', () => {
  it('parses join and leave events', () => {
    const sb = parseScoreboard(FULL, 'x.csv');
    expect(sb.joinLeaves).toHaveLength(2);
    expect(sb.joinLeaves[0]).toEqual({
      tsInRound: '17:29:13',
      name: 'Godchilla',
      steamId: '76561197978895735',
      action: 'joined',
    });
    expect(sb.joinLeaves[1].action).toBe('left');
  });
});

describe('parseScoreboard — recordedAt', () => {
  it('derives an ISO timestamp from the filename', () => {
    const sb = parseScoreboard(FULL, 'scoreboard_20260527_173919.csv');
    // 2026-05-27 17:39:19 local — assert the date/time components are present.
    expect(sb.recordedAt).toMatch(/^2026-05-27T17:39:19/);
  });

  it('returns null recordedAt for an unrecognized filename', () => {
    const sb = parseScoreboard(FULL, 'not-a-scoreboard.csv');
    expect(sb.recordedAt).toBeNull();
  });
});
