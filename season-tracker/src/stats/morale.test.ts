import { describe, it, expect } from 'vitest';
import { normalizeMorale, averageMorale, MORALE_STATES } from './morale';

describe('normalizeMorale', () => {
  it('maps CSV/free-form values to canonical states', () => {
    expect(normalizeMorale('FinalPush')).toBe('Final Push');
    expect(normalizeMorale('Breaking')).toBe('Breaking');
    expect(normalizeMorale('battle ready')).toBe('Battle Ready');
    expect(normalizeMorale('TakingLosses')).toBe('Taking Losses');
    expect(normalizeMorale('LAST_STAND')).toBe('Last Stand');
  });

  it('returns null for empty/unknown values', () => {
    expect(normalizeMorale('')).toBeNull();
    expect(normalizeMorale(null)).toBeNull();
    expect(normalizeMorale('whatever')).toBeNull();
  });

  it('exposes the six canonical states in severity order', () => {
    expect(MORALE_STATES).toEqual([
      'Battle Ready',
      'Engaged',
      'Taking Losses',
      'Breaking',
      'Final Push',
      'Last Stand',
    ]);
  });
});

describe('averageMorale', () => {
  it('averages by severity ordinal and maps to the nearest state', () => {
    expect(averageMorale(['Battle Ready', 'Taking Losses'])).toBe('Engaged'); // (0+2)/2 = 1
    expect(averageMorale(['Breaking', 'Breaking'])).toBe('Breaking');
    expect(averageMorale(['Battle Ready', 'Last Stand'])).toBe('Breaking'); // (0+5)/2 = 2.5 → 3
  });

  it('ignores unknown values and returns null when empty', () => {
    expect(averageMorale([])).toBeNull();
    expect(averageMorale(['nonsense'])).toBeNull();
  });
});
