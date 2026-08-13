import { describe, it, expect } from 'vitest';
import { seasonNumber, byRecency, latestSeason, nextSeasonName } from './seasonOrder';

const seasons = (...names: string[]) => names.map((name, i) => ({ id: `s${i}`, name }));

describe('seasonNumber', () => {
  it('reads the first number in the name', () => {
    expect(seasonNumber('Season 5')).toBe(5);
    expect(seasonNumber('Season 3 — Casualty Save')).toBe(3);
    expect(seasonNumber('2024 Fall Season')).toBe(2024);
  });

  it('is null when the name carries no number', () => {
    expect(seasonNumber('Preseason')).toBeNull();
    expect(seasonNumber('')).toBeNull();
    expect(seasonNumber(undefined)).toBeNull();
  });
});

describe('latestSeason', () => {
  it('picks the highest-numbered season, not the last one added', () => {
    // Season 4 imported after Season 5 — array order says 4, the names say 5.
    const list = seasons('Season 2', 'Season 3', 'Season 5', 'Season 4');
    expect(latestSeason(list)?.name).toBe('Season 5');
  });

  it('falls back to array order when no name carries a number', () => {
    const list = seasons('Preseason', 'Grand Melee');
    expect(latestSeason(list)?.name).toBe('Grand Melee');
  });

  it('prefers a numbered season over an unnumbered one', () => {
    expect(latestSeason(seasons('Season 1', 'Exhibition'))?.name).toBe('Season 1');
  });

  it('breaks ties on duplicate numbers with the later entry', () => {
    const list = seasons('Season 4', 'Season 4');
    expect(latestSeason(list)?.id).toBe('s1');
  });

  it('is null for an event with no seasons', () => {
    expect(latestSeason([])).toBeNull();
  });
});

describe('byRecency', () => {
  it('orders newest first without mutating the input', () => {
    const list = seasons('Season 2', 'Season 5', 'Season 3');
    expect(byRecency(list).map((s) => s.name)).toEqual(['Season 5', 'Season 3', 'Season 2']);
    expect(list.map((s) => s.name)).toEqual(['Season 2', 'Season 5', 'Season 3']);
  });
});

describe('nextSeasonName', () => {
  it('continues the numbering rather than counting the seasons', () => {
    // Three seasons, but they start at 2 — the next one is 5, not 4.
    expect(nextSeasonName(seasons('Season 2', 'Season 3', 'Season 4'))).toBe('Season 5');
    expect(nextSeasonName(seasons('Season 2', 'Season 3', 'Season 4', 'Season 5'))).toBe('Season 6');
  });

  it('counts as a floor so unnumbered seasons still advance it', () => {
    expect(nextSeasonName(seasons('Preseason', 'Grand Melee'))).toBe('Season 3');
  });

  it('starts at 1 for a fresh event', () => {
    expect(nextSeasonName([])).toBe('Season 1');
  });
});
