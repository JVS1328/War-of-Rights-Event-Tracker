import { describe, it, expect } from 'vitest';
import { parseScoreboard } from './parseScoreboard';
import { computePlayerDetail } from './statsEngine';

const R1 = `map,DrillCamp
mode,Skirmish
winner,CSA

name,team,kills,deaths,kd,deaths_in_form,deaths_skirm,deaths_oob,steam_id
[51stNY]Joe,2,3,1,3.00,1,0,0,76561198000000001
[20thGA]Han,1,1,2,0.50,1,1,0,76561198000000002

time,killer,killer_steam_id,killer_team,victim,victim_steam_id,victim_team,victim_formation,cause,cat,sub
16:10:00,[51stNY]Joe,76561198000000001,2,[20thGA]Han,76561198000000002,1,in_form,Minie,0,4
16:11:00,[51stNY]Joe,76561198000000001,2,[20thGA]Han,76561198000000002,1,skirm,Melee,0,2
`;

const R2 = `map,Antietam
mode,Skirmish
winner,USA

name,team,kills,deaths,kd,deaths_in_form,deaths_skirm,deaths_oob,steam_id
[51stNY]Joe,2,2,1,2.00,1,0,0,76561198000000001

time,killer,killer_steam_id,killer_team,victim,victim_steam_id,victim_team,victim_formation,cause,cat,sub
17:05:00,[51stNY]Joe,76561198000000001,2,someone,76561198000000099,1,oob,Minie,0,4
`;

const boards = [
  parseScoreboard(R1, 'scoreboard_20260101_120000.csv'),
  parseScoreboard(R2, 'scoreboard_20260101_130000.csv'),
];

describe('computePlayerDetail', () => {
  it('aggregates totals and per-round rows for a player by steam id', () => {
    const d = computePlayerDetail(boards, '76561198000000001', {});
    expect(d).not.toBeNull();
    expect(d!.name).toBe('[51stNY]Joe');
    expect(d!.regiment).toBe('51STNY');
    expect(d!.kills).toBe(5);
    expect(d!.deaths).toBe(2);
    expect(d!.rounds).toBe(2);
    expect(d!.perRound).toHaveLength(2);
  });

  it('counts kills by cause from the killfeed', () => {
    const d = computePlayerDetail(boards, '76561198000000001', {});
    expect(d!.killsByCause).toEqual({ Minie: 2, Melee: 1 });
  });

  it('returns null for an unknown player', () => {
    expect(computePlayerDetail(boards, 'nobody', {})).toBeNull();
  });
});
