import { describe, it, expect } from 'vitest';
import { accumulateMapHistoryFromSeasons } from './eloEngine';

const week = (overrides) => ({
  teamA: ['A1'],
  teamB: ['B1'],
  round1Winner: 'A',
  round1Map: "Flemming's Meadow",
  round1Flipped: false,
  r1CasualtiesA: 179,
  r1CasualtiesB: 111,
  ...overrides,
});

describe('map history — optional formation losses', () => {
  it('folds per-side formation casualties when present (not flipped → A=USA)', () => {
    const season = {
      weeks: [
        week({
          r1CasualtiesFormA: { in_form: 100, skirm: 50, oob: 29 },
          r1CasualtiesFormB: { in_form: 60, skirm: 31, oob: 20 },
        }),
      ],
    };
    const hist = accumulateMapHistoryFromSeasons([season]);
    const entry = hist["Flemming's Meadow"];
    expect(entry.USA.casualtiesForm).toEqual({ in_form: 100, skirm: 50, oob: 29 });
    expect(entry.CSA.casualtiesForm).toEqual({ in_form: 60, skirm: 31, oob: 20 });
  });

  it('swaps formation losses onto the right side when the round is flipped', () => {
    const season = {
      weeks: [
        week({
          round1Flipped: true, // side A played CSA this round
          r1CasualtiesFormA: { in_form: 100, skirm: 50, oob: 29 },
          r1CasualtiesFormB: { in_form: 60, skirm: 31, oob: 20 },
        }),
      ],
    };
    const entry = accumulateMapHistoryFromSeasons([season])["Flemming's Meadow"];
    // Flipped: side A = CSA, so side A's formation losses land on CSA.
    expect(entry.CSA.casualtiesForm).toEqual({ in_form: 100, skirm: 50, oob: 29 });
    expect(entry.USA.casualtiesForm).toEqual({ in_form: 60, skirm: 31, oob: 20 });
  });

  it('legacy rounds without formation data contribute zeros', () => {
    const entry = accumulateMapHistoryFromSeasons([{ weeks: [week({})] }])["Flemming's Meadow"];
    expect(entry.USA.casualtiesForm).toEqual({ in_form: 0, skirm: 0, oob: 0 });
    expect(entry.USA.casualtiesTaken).toBe(179);
  });

  it('collects per-side morale states (flip-aware)', () => {
    const normal = accumulateMapHistoryFromSeasons([
      { weeks: [week({ r1MoraleA: 'Battle Ready', r1MoraleB: 'Breaking' })] },
    ])["Flemming's Meadow"];
    expect(normal.USA.moraleStates).toEqual(['Battle Ready']); // A=USA
    expect(normal.CSA.moraleStates).toEqual(['Breaking']);

    const flipped = accumulateMapHistoryFromSeasons([
      { weeks: [week({ round1Flipped: true, r1MoraleA: 'Battle Ready', r1MoraleB: 'Breaking' })] },
    ])["Flemming's Meadow"];
    expect(flipped.CSA.moraleStates).toEqual(['Battle Ready']); // A=CSA when flipped
    expect(flipped.USA.moraleStates).toEqual(['Breaking']);
  });
});
