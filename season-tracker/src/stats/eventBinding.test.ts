import { describe, it, expect } from 'vitest';
import { parseScoreboard } from './parseScoreboard';
import { buildRoundAutofill, roundFieldUpdates } from './eventBinding';

const SB = `map,DrillCamp
mode,Skirmish
area,Flemming's Meadow
winner,CSA
morale_usa,FinalPush
morale_csa,Breaking
casualties_usa,179
casualties_usa_in_form,100
casualties_usa_skirm,50
casualties_usa_oob,29
casualties_csa,111
casualties_csa_in_form,60
casualties_csa_skirm,31
casualties_csa_oob,20
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

  it('produces per-side formation casualty breakdowns', () => {
    const af = buildRoundAutofill(sb, { A: 'USA', B: 'CSA' }, ["Flemming's Meadow"]);
    expect(af.casualtiesFormA).toEqual({ in_form: 100, skirm: 50, oob: 29 }); // USA
    expect(af.casualtiesFormB).toEqual({ in_form: 60, skirm: 31, oob: 20 }); // CSA
  });

  it('produces per-side morale, normalized and flip-aware', () => {
    const af = buildRoundAutofill(sb, { A: 'USA', B: 'CSA' }, []);
    expect(af.moraleA).toBe('Final Push'); // USA
    expect(af.moraleB).toBe('Breaking'); // CSA
    const flipped = buildRoundAutofill(sb, { A: 'USA', B: 'CSA' }, [], true);
    expect(flipped.moraleA).toBe('Breaking'); // side A played CSA
    expect(flipped.moraleB).toBe('Final Push');
  });

  it('roundFieldUpdates writes the optional formation fields for the round', () => {
    const af = buildRoundAutofill(sb, { A: 'USA', B: 'CSA' }, ["Flemming's Meadow"]);
    const u1 = roundFieldUpdates(1, af);
    expect(u1.r1CasualtiesA).toBe(179);
    expect(u1.r1CasualtiesFormA).toEqual({ in_form: 100, skirm: 50, oob: 29 });
    expect(u1.r1CasualtiesFormB).toEqual({ in_form: 60, skirm: 31, oob: 20 });
    expect(u1.r1MoraleA).toBe('Final Push');
    expect(u1.r1MoraleB).toBe('Breaking');
    const u2 = roundFieldUpdates(2, af);
    expect(u2.r2CasualtiesFormA).toEqual({ in_form: 100, skirm: 50, oob: 29 });
    expect(u2.r2MoraleA).toBe('Final Push');
  });

  it('flags an unknown area so the UI can prompt for manual selection', () => {
    const af = buildRoundAutofill(sb, { A: 'USA', B: 'CSA' }, ['Some Other Area']);
    expect(af.validMap).toBe(false);
    expect(af.area).toBeNull();
    expect(af.areaRaw).toBe("Flemming's Meadow");
  });
});
