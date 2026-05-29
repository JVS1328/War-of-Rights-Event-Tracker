import { describe, it, expect } from 'vitest';
import { applyAlias, computeRegimentBreakdown, computePlayerLeaderboard } from './statsEngine';
import { parseScoreboard } from './parseScoreboard';

const CSV = `map,DrillCamp
mode,Skirmish
area,Meadow
winner,CSA

name,team,kills,deaths,kd,deaths_in_form,deaths_skirm,deaths_oob,steam_id
[51stNY]Joe,1,5,2,2.50,2,0,0,76561198000000001
[20thGA]Bob,2,3,4,0.75,4,0,0,76561198000000002
`;
const sb = parseScoreboard(CSV, 'scoreboard_20260101_120000.csv');

describe('applyAlias', () => {
  it('returns the label unchanged with no map', () => {
    expect(applyAlias('51STNY', undefined)).toBe('51STNY');
    expect(applyAlias('51STNY', {})).toBe('51STNY');
  });

  it('follows a single hop and a transitive chain', () => {
    expect(applyAlias('A', { A: 'B' })).toBe('B');
    expect(applyAlias('A', { A: 'B', B: 'C' })).toBe('C');
  });

  it('stops deterministically on a cycle', () => {
    expect(applyAlias('A', { A: 'B', B: 'A' })).toBe('A');
  });
});

describe('computeRegimentBreakdown with aliasMap', () => {
  it('merges a source regiment into the target (players + stats roll up)', () => {
    const regs = computeRegimentBreakdown([sb], {}, { aliasMap: { '20THGA': '51STNY' } });
    expect(regs).toHaveLength(1);
    const r = regs[0];
    expect(r.regiment).toBe('51STNY');
    expect(r.players).toBe(2);
    expect(r.kills).toBe(8); // 5 + 3
    expect(r.deaths).toBe(6); // 2 + 4
  });

  it('renames a regiment by aliasing it to a fresh label', () => {
    const regs = computeRegimentBreakdown([sb], {}, { aliasMap: { '51STNY': '51st NY' } });
    const labels = regs.map((r) => r.regiment).sort();
    expect(labels).toEqual(['20THGA', '51st NY']);
    const renamed = regs.find((r) => r.regiment === '51st NY')!;
    expect(renamed.kills).toBe(5);
  });

  it('leaves regiments untouched when no alias applies', () => {
    const regs = computeRegimentBreakdown([sb], {}, {});
    expect(regs.map((r) => r.regiment).sort()).toEqual(['20THGA', '51STNY']);
  });
});

describe('computePlayerLeaderboard with aliasMap', () => {
  it('reports each player under the aliased (canonical) regiment', () => {
    const rows = computePlayerLeaderboard([sb], {}, { aliasMap: { '20THGA': '51STNY' } });
    expect(rows.every((p) => p.regiment === '51STNY')).toBe(true);
  });
});
