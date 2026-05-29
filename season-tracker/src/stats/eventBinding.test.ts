import { describe, it, expect } from 'vitest';
import { parseScoreboard } from './parseScoreboard';
import { buildRoundAutofill } from './eventBinding';

const SB = `map,DrillCamp
mode,Skirmish
area,Flemming's Meadow
winner,CSA
casualties_usa,179
casualties_csa,111
`;
const sb = parseScoreboard(SB, 'scoreboard_20260101_120000.csv');

describe('buildRoundAutofill', () => {
  it('maps winner→side and casualties→side totals (USA=A, CSA=B)', () => {
    const af = buildRoundAutofill(sb, { A: 'USA', B: 'CSA' }, ["Flemming's Meadow"]);
    expect(af.winner).toBe('CSA');
    expect(af.winnerSide).toBe('B');
    expect(af.casualtiesA).toBe(179); // USA
    expect(af.casualtiesB).toBe(111); // CSA
    expect(af.area).toBe("Flemming's Meadow");
    expect(af.validMap).toBe(true);
  });

  it('respects swapped team-name mapping (CSA=A, USA=B)', () => {
    const af = buildRoundAutofill(sb, { A: 'CSA', B: 'USA' }, []);
    expect(af.winnerSide).toBe('A'); // CSA is side A
    expect(af.casualtiesA).toBe(111); // CSA
    expect(af.casualtiesB).toBe(179); // USA
  });

  it('swaps faction↔side when the round is flipped', () => {
    // Default A=USA/B=CSA, but flipped → side A played CSA this round.
    const af = buildRoundAutofill(sb, { A: 'USA', B: 'CSA' }, ["Flemming's Meadow"], true);
    expect(af.flipped).toBe(true);
    expect(af.sideAFaction).toBe('CSA');
    expect(af.sideBFaction).toBe('USA');
    expect(af.winnerSide).toBe('A'); // CSA won, and CSA is side A when flipped
    expect(af.casualtiesA).toBe(111); // CSA casualties → side A
    expect(af.casualtiesB).toBe(179); // USA casualties → side B
  });

  it('flags an unknown area so the UI can prompt for manual selection', () => {
    const af = buildRoundAutofill(sb, { A: 'USA', B: 'CSA' }, ['Some Other Area']);
    expect(af.validMap).toBe(false);
    expect(af.area).toBeNull();
    expect(af.areaRaw).toBe("Flemming's Meadow");
  });
});
