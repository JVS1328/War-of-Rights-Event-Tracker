import { describe, it, expect } from 'vitest';
import { parseScoreboard } from './parseScoreboard';
import { computePlayerDetail, computeRegimentBreakdown, computeOverview } from './statsEngine';

const R1 = `map,DrillCamp
mode,Skirmish
area,Meadow
winner,CSA

name,team,kills,deaths,kd,deaths_in_form,deaths_skirm,deaths_oob,steam_id
[51stNY]Joe,2,3,1,3.00,1,0,0,76561198000000001

time,killer,killer_steam_id,killer_team,victim,victim_steam_id,victim_team,victim_formation,cause,cat,sub
16:10:00,[51stNY]Joe,76561198000000001,2,a,76561198000000010,1,in_form,Minie,0,4
16:11:00,[51stNY]Joe,76561198000000001,2,b,76561198000000011,1,skirm,Melee,0,2
16:12:00,[51stNY]Joe,76561198000000001,2,c,76561198000000012,1,oob,Minie,0,4
`;

const R2 = `map,Antietam
mode,Skirmish
area,Cornfield
winner,USA

name,team,kills,deaths,kd,deaths_in_form,deaths_skirm,deaths_oob,steam_id
[51stNY]Joe,2,2,1,2.00,0,1,0,76561198000000001

time,killer,killer_steam_id,killer_team,victim,victim_steam_id,victim_team,victim_formation,cause,cat,sub
17:05:00,[51stNY]Joe,76561198000000001,2,d,76561198000000013,1,skirm,Minie,0,4
`;

const boards = [
  parseScoreboard(R1, 'scoreboard_20260101_163000.csv'),
  parseScoreboard(R2, 'scoreboard_20260101_172000.csv'),
];

describe('player detail — per-round stance, tickets, area', () => {
  it('includes per-round stance deaths, ×Td/×Tk and area/mapset', () => {
    const d = computePlayerDetail(boards, '76561198000000001', {})!;
    const r1 = d.perRound.find((r) => r.map === 'DrillCamp')!;
    expect(r1.area).toBe('Meadow');
    expect(r1.sourceFilename).toMatch(/^scoreboard_/);
    expect(r1.deathsInForm).toBe(1);
    expect(r1.killsInForm).toBe(1);
    expect(r1.killsSkirm).toBe(1);
    expect(r1.killsOob).toBe(1);
    expect(r1.avgTd).toBeCloseTo(1.0, 5); // (1*1)/1
    expect(r1.avgTk).toBeCloseTo(3.0, 5); // (1+3+5)/3
    const r2 = d.perRound.find((r) => r.map === 'Antietam')!;
    expect(r2.avgTd).toBeCloseTo(3.0, 5); // (3*1)/1
    expect(r2.area).toBe('Cornfield');
  });
});

describe('regiment — tickets, kill formations, round-by-round', () => {
  it('adds ×Td/×Tk and killsByFormation', () => {
    const ny = computeRegimentBreakdown(boards, {}).find((r) => r.regiment === '51STNY')!;
    expect(ny.killsByFormation).toMatchObject({ in_form: 1, skirm: 2, oob: 1 });
    expect(ny.avgTk).toBeCloseTo(3.0, 5); // (1+6+5)/4
    expect(ny.avgTd).toBeCloseTo(2.0, 5); // deaths IF1 Sk1 → (1+3)/2
  });

  it('provides a round-by-round breakdown', () => {
    const ny = computeRegimentBreakdown(boards, {}).find((r) => r.regiment === '51STNY')!;
    expect(ny.perRound).toHaveLength(2);
    const r1 = ny.perRound.find((r) => r.map === 'DrillCamp')!;
    expect(r1.kills).toBe(3);
    expect(r1.deaths).toBe(1);
    expect(r1.players).toBe(1);
    expect(r1.area).toBe('Meadow');
  });
});

describe('overview — casualties & avg peak pop', () => {
  const a = parseScoreboard(
    'map,X\nmode,Y\nwinner,USA\npop_round_peak,100\ncasualties_usa,10\ncasualties_csa,5\n',
    'scoreboard_20260101_120000.csv',
  );
  const b = parseScoreboard(
    'map,X\nmode,Y\nwinner,CSA\npop_round_peak,200\ncasualties_usa,20\ncasualties_csa,15\n',
    'scoreboard_20260101_130000.csv',
  );
  it('sums casualties per team and averages peak pop across rounds', () => {
    const o = computeOverview([a, b], {});
    expect(o.usaCasualties).toBe(30);
    expect(o.csaCasualties).toBe(20);
    expect(o.avgPeakPop).toBe(150);
  });
});
