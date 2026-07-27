import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CAVALRY_CAP,
  SPECIAL_COMPANY_CAP,
  clampSideConfig,
  companiesToText,
  distributeCompanies,
  parseRosterPaste,
  rosterFromCounts,
} from './companySplit';

const roster = (...entries: Array<[string, number, number]>) =>
  entries.map(([unit, min, max]) => ({ rawName: unit, unit, min, max }));

describe('parseRosterPaste', () => {
  it('parses "name<tab>min<tab>max" rows', () => {
    const rows = parseRosterPaste('7th SC\t8\t11\n1stLAR\t7\t10\nSB Arty\t4\t5');
    expect(rows).toEqual([
      { rawName: '7th SC', unit: '7th SC', min: 8, max: 11 },
      { rawName: '1stLAR', unit: '1stLAR', min: 7, max: 10 },
      { rawName: 'SB Arty', unit: 'SB Arty', min: 4, max: 5 },
    ]);
  });

  it('skips blank lines and blank filler columns, and strips a (T)/(B) marker', () => {
    const rows = parseRosterPaste('12THVA (T)\t7\t\t12\t\n\t\t\n8thOH (T)\t20\t\t22\t');
    expect(rows).toEqual([
      { rawName: '12THVA (T)', unit: '12THVA', min: 7, max: 12 },
      { rawName: '8thOH (T)', unit: '8thOH', min: 20, max: 22 },
    ]);
  });

  it('falls back to space-separated columns when a line has no tabs', () => {
    expect(parseRosterPaste('SB Arty 4 5\nWB Cav 3')).toEqual([
      { rawName: 'SB Arty', unit: 'SB Arty', min: 4, max: 5 },
      { rawName: 'WB Cav', unit: 'WB Cav', min: 3, max: 3 },
    ]);
  });

  it('orders min/max regardless of column order, and zeroes a countless row', () => {
    expect(parseRosterPaste('PB\t26\t22\nZZ')).toEqual([
      { rawName: 'PB', unit: 'PB', min: 22, max: 26 },
      { rawName: 'ZZ', unit: 'ZZ', min: 0, max: 0 },
    ]);
  });
});

describe('clampSideConfig', () => {
  it('fills defaults, cavalry cap included', () => {
    expect(clampSideConfig({ count: 3 })).toEqual({
      count: 3, specialCount: 0, cavalryCount: 0, cavalryCap: DEFAULT_CAVALRY_CAP,
    });
  });

  it('keeps special + cavalry within the total company count', () => {
    expect(clampSideConfig({ count: 2, specialCount: 5, cavalryCount: 3, cavalryCap: 30 }))
      .toMatchObject({ count: 2, specialCount: 2, cavalryCount: 0 });
    expect(clampSideConfig({ count: 4, specialCount: 1, cavalryCount: 9, cavalryCap: 30 }))
      .toMatchObject({ specialCount: 1, cavalryCount: 3 });
  });

  it('floors negatives at zero', () => {
    expect(clampSideConfig({ count: -2, specialCount: -1, cavalryCount: -1, cavalryCap: -5 }))
      .toEqual({ count: 0, specialCount: 0, cavalryCount: 0, cavalryCap: 0 });
  });
});

describe('distributeCompanies', () => {
  it('returns nothing without companies or regiments', () => {
    expect(distributeCompanies(roster(['A', 10, 10]), { count: 0 })).toEqual([]);
    expect(distributeCompanies([], { count: 3 })).toEqual([]);
  });

  it('packs regiments largest-first into the emptiest company', () => {
    const cos = distributeCompanies(roster(['Big', 20, 20], ['Mid', 10, 10], ['Small', 4, 4]), { count: 2 });
    expect(cos.map(c => c.label)).toEqual(['Co 1', 'Co 2']);
    expect(cos[0]).toMatchObject({ regiments: ['Big'], totalAvg: 20 });
    expect(cos[1]).toMatchObject({ regiments: ['Mid', 'Small'], totalAvg: 14 });
  });

  it('labels special then cavalry off the top of the count, regulars after', () => {
    const cos = distributeCompanies(roster(['A', 5, 5]), { count: 4, specialCount: 1, cavalryCount: 2 });
    expect(cos.map(c => c.label)).toEqual(['Special Co 1', 'Cav Co 1', 'Cav Co 2', 'Co 1']);
    expect(cos.map(c => c.kind)).toEqual(['special', 'cavalry', 'cavalry', 'regular']);
  });

  it('caps special at 20 and cavalry at its configured cap, leaving regulars uncapped', () => {
    const cos = distributeCompanies(roster(['A', 5, 5]), { count: 3, specialCount: 1, cavalryCount: 1, cavalryCap: 12 });
    expect(cos.map(c => c.cap)).toEqual([SPECIAL_COMPANY_CAP, 12, Infinity]);
  });

  it('keeps a capped company under its cap, spilling the rest into regulars', () => {
    // Cav cap 12: the 20-player regiment cannot ride, the 8 and 4 can.
    const cos = distributeCompanies(
      roster(['Twenty', 20, 20], ['Eight', 8, 8], ['Four', 4, 4]),
      { count: 2, cavalryCount: 1, cavalryCap: 12 },
    );
    expect(cos[0]).toMatchObject({ kind: 'cavalry', regiments: ['Eight', 'Four'], totalAvg: 12 });
    expect(cos[1]).toMatchObject({ kind: 'regular', regiments: ['Twenty'], totalAvg: 20 });
  });

  it('falls back to the emptiest regular when a regiment fits nowhere', () => {
    const cos = distributeCompanies(roster(['Huge', 40, 40], ['Small', 2, 2]), {
      count: 2, cavalryCount: 1, cavalryCap: 5,
    });
    expect(cos[0]).toMatchObject({ kind: 'cavalry', regiments: ['Small'] });
    expect(cos[1]).toMatchObject({ kind: 'regular', regiments: ['Huge'] });
  });

  it('overfills a capped company only when there is no regular to spill into', () => {
    const cos = distributeCompanies(roster(['Huge', 40, 40]), { count: 1, cavalryCount: 1, cavalryCap: 5 });
    expect(cos[0]).toMatchObject({ kind: 'cavalry', regiments: ['Huge'], totalAvg: 40, cap: 5 });
  });

  it('packs by the midpoint of min/max', () => {
    const cos = distributeCompanies(roster(['A', 8, 12]), { count: 1 });
    expect(cos[0].totalAvg).toBe(10);
  });
});

describe('rosterFromCounts', () => {
  it('maps tracker unit counts onto roster entries, defaulting to zero', () => {
    expect(rosterFromCounts(['A', 'B'], { A: { min: 4, max: 6 } })).toEqual([
      { rawName: 'A', unit: 'A', min: 4, max: 6 },
      { rawName: 'B', unit: 'B', min: 0, max: 0 },
    ]);
  });
});

describe('companiesToText', () => {
  it('renders one line per company, empties included', () => {
    const cos = distributeCompanies(roster(['A', 10, 10]), { count: 2 });
    expect(companiesToText(cos)).toBe('Co 1 (10): A\nCo 2 (0): Empty');
  });
});
