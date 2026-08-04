import { describe, it, expect } from 'vitest';
import { spineRow, tally, isTextRow, type SpineRow } from './spineModel';

const row = (over: Partial<SpineRow>): SpineRow => ({ label: 'x', a: 0, b: 0, ...over });

describe('spineRow — bar geometry', () => {
  it('fills the larger side and scales the smaller against it', () => {
    const v = spineRow(row({ a: 128, b: 79 }));
    expect(v.aWidth).toBe(100);
    expect(v.bWidth).toBeCloseTo(61.7, 1);
  });

  it('draws nothing when both sides are zero', () => {
    const v = spineRow(row({ a: 0, b: 0 }));
    expect(v.aWidth).toBe(0);
    expect(v.bWidth).toBe(0);
  });

  it('uses magnitude, so a negative still draws', () => {
    const v = spineRow(row({ a: -12, b: 6 }));
    expect(v.aWidth).toBe(100);
    expect(v.bWidth).toBe(50);
  });

  it('falls back to the raw value when no display text is given', () => {
    expect(spineRow(row({ a: 2.5, b: 1 })).aText).toBe('2.5');
    expect(spineRow(row({ a: 2.5, b: 1, aText: '×2.5' })).aText).toBe('×2.5');
  });
});

describe('spineRow — who wins the row', () => {
  it('gives it to the bigger value by default', () => {
    expect(spineRow(row({ a: 128, b: 79 })).winner).toBe('a');
    expect(spineRow(row({ a: 79, b: 128 })).winner).toBe('b');
  });

  it('gives it to the smaller value when lower is better', () => {
    // Casualties taken: 79 lost beats 128 lost.
    expect(spineRow(row({ a: 128, b: 79, lower: true })).winner).toBe('b');
    expect(spineRow(row({ a: 79, b: 128, lower: true })).winner).toBe('a');
  });

  it('calls equal values a tie under either direction', () => {
    expect(spineRow(row({ a: 16, b: 16 })).winner).toBe('tie');
    expect(spineRow(row({ a: 16, b: 16, lower: true })).winner).toBe('tie');
  });

  it('treats zero as a real value, not as missing', () => {
    // Nobody caught out of line is a win, not a blank row.
    expect(spineRow(row({ a: 0, b: 5, lower: true })).winner).toBe('a');
    expect(spineRow(row({ a: 0, b: 5 })).winner).toBe('b');
  });
});

describe('tally', () => {
  it('counts rows per side and keeps ties out of both', () => {
    const rows: SpineRow[] = [
      row({ a: 5, b: 1 }),
      row({ a: 1, b: 5 }),
      row({ a: 5, b: 1, lower: true }),
      row({ a: 3, b: 3 }),
    ];
    expect(tally(rows)).toEqual({ a: 1, b: 2, tied: 1 });
  });

  it('is empty for no rows', () => {
    expect(tally([])).toEqual({ a: 0, b: 0, tied: 0 });
  });
});

describe('isTextRow', () => {
  it('separates text rows from measured ones', () => {
    expect(isTextRow({ label: 'Morale', aText: 'Steady', bText: 'Breaking', text: true })).toBe(true);
    expect(isTextRow(row({ a: 1, b: 2 }))).toBe(false);
  });
});
