import { describe, it, expect } from 'vitest';
import { replayEvent, accumulateMapHistoryFromSeasons } from './eloEngine';

// A Fun Round is exhibition: it must leave no competitive footprint — no Elo
// movement and no contribution to map history (which also feeds Elo).

const baseWeek = (overrides) => ({
  teamA: ['A1'],
  teamB: ['B1'],
  round1Winner: 'A',
  round1Map: "Flemming's Meadow",
  leadA: 'A1',
  leadB: 'B1',
  ...overrides,
});

const eventWith = (week) => ({
  eloSystem: {},
  eloConfig: {},
  seasons: [{ units: ['A1', 'B1'], weeks: [week] }],
});

describe('fun rounds — full exhibition', () => {
  it('a normal round moves Elo (control)', () => {
    const { unitElo, roundsPlayed } = replayEvent(eventWith(baseWeek({})));
    expect(unitElo.A1).toBeGreaterThan(1500); // winner gains
    expect(unitElo.B1).toBeLessThan(1500);    // loser loses
    expect(roundsPlayed.A1).toBe(1);
  });

  it('a fun round does not move Elo and is not counted as a round played', () => {
    const { unitElo, roundsPlayed } = replayEvent(eventWith(baseWeek({ isFunRound: true })));
    // Units are still seeded at the initial rating, but unchanged.
    expect(unitElo.A1).toBe(1500);
    expect(unitElo.B1).toBe(1500);
    expect(roundsPlayed.A1).toBe(0);
    expect(roundsPlayed.B1).toBe(0);
  });

  it('a fun round does not contribute to map history', () => {
    const hist = accumulateMapHistoryFromSeasons([
      { weeks: [baseWeek({ isFunRound: true, r1CasualtiesA: 100, r1CasualtiesB: 80 })] },
    ]);
    expect(hist["Flemming's Meadow"]).toBeUndefined();
  });

  it('a normal round still contributes to map history (control)', () => {
    const hist = accumulateMapHistoryFromSeasons([
      { weeks: [baseWeek({ r1CasualtiesA: 100, r1CasualtiesB: 80 })] },
    ]);
    expect(hist["Flemming's Meadow"].plays).toBe(1);
  });
});
