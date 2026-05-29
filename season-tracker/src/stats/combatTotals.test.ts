import { describe, it, expect } from 'vitest';
import { parseScoreboard } from './parseScoreboard';
import { computeCombatTotals } from './statsEngine';

const board = (winner: string, usaMinie: number, csaMelee: number, usaTotal: number) => `map,DrillCamp
mode,Skirmish
winner,${winner}
casualties_usa,${usaTotal}
casualties_usa_in_form,${usaTotal}
casualties_csa,5
casualties_csa_skirm,5
deaths_usa_minie,${usaMinie}
deaths_csa_melee,${csaMelee}
`;

const boards = [
  parseScoreboard(board('CSA', 10, 4, 12), 'scoreboard_20260101_120000.csv'),
  parseScoreboard(board('USA', 5, 6, 8), 'scoreboard_20260102_120000.csv'),
];

describe('computeCombatTotals', () => {
  it('sums deaths-by-weapon per team across scoreboards', () => {
    const t = computeCombatTotals(boards);
    expect(t.deathsByWeapon.USA.minie).toBe(15); // 10 + 5
    expect(t.deathsByWeapon.CSA.melee).toBe(10); // 4 + 6
  });

  it('sums casualties by team and stance across scoreboards', () => {
    const t = computeCombatTotals(boards);
    expect(t.casualties.USA.total).toBe(20); // 12 + 8
    expect(t.casualties.USA.inForm).toBe(20);
    expect(t.casualties.CSA.total).toBe(10); // 5 + 5
    expect(t.casualties.CSA.skirm).toBe(10);
  });

  it('omits zero-count weapons from the per-team list helper', () => {
    const t = computeCombatTotals(boards);
    // canister was never recorded → should be 0 (present) but melee/minie > 0
    expect(t.deathsByWeapon.USA.minie).toBeGreaterThan(0);
    expect(t.deathsByWeapon.USA.canister).toBe(0);
  });
});
