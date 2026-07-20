import { describe, it, expect } from 'vitest';
import { formatCompany } from './labels';

describe('formatCompany', () => {
  it('strips a trailing "Company" word so the label reads next to a "Co." prefix', () => {
    expect(formatCompany('A Company')).toBe('A');
    expect(formatCompany('B Company')).toBe('B');
    expect(formatCompany('1st Company')).toBe('1st');
  });

  it('is case-insensitive on the "Company" suffix', () => {
    expect(formatCompany('A company')).toBe('A');
    expect(formatCompany('C COMPANY')).toBe('C');
  });

  it('leaves bare company labels untouched', () => {
    expect(formatCompany('A')).toBe('A');
    expect(formatCompany('1st')).toBe('1st');
  });

  it('falls back to the original when the value is only "Company"', () => {
    expect(formatCompany('Company')).toBe('Company');
  });
});
