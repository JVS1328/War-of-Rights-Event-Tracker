import { describe, it, expect } from 'vitest';
import {
  LEADS_PER_NIGHT,
  buildLeadSchedule,
  plannedNightCount,
  scheduleExportRows,
  summarizeLeadSpacing,
  toCsv,
  toTsv,
  weekLeadRounds,
} from './leadSchedule';
import type { LeadMode, LeadNight, WeekLeads } from './leadSchedule';

const UNITS = ['1stTX', '2ndSC', '3rdUS', '4thVA', '5thNY', '6thWI', '7thPA', '8thOH'];

/** Deterministic stand-in for Math.random so a failing case is reproducible. */
const seeded = (seed: number) => () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};

const schedule = (units: string[], leadNightsPerUnit: number, mode: LeadMode, extra = {}) =>
  buildLeadSchedule({ units, leadNightsPerUnit, mode, random: seeded(7), ...extra });

/** The tracker week each night turns into, so spacing/export helpers can read it. */
const toWeeks = (nights: LeadNight[], mode: LeadMode): WeekLeads[] => nights.map((night, i) => (
  mode === 'rounds'
    ? {
        name: `Week ${i + 1}`,
        isSingleRoundLeads: true,
        leadA_r1: night.matchups[0].leadA,
        leadB_r1: night.matchups[0].leadB,
        leadA_r2: night.matchups[1].leadA,
        leadB_r2: night.matchups[1].leadB,
      }
    : { name: `Week ${i + 1}`, leadA: night.matchups[0].leadA, leadB: night.matchups[0].leadB }
));

const nightUnits = (night: LeadNight) => night.matchups.flatMap(m => [m.leadA, m.leadB]);

describe('plannedNightCount', () => {
  it('splits the lead slots by how many a night uses', () => {
    // 8 units × 2 lead nights = 16 lead slots.
    expect(plannedNightCount(8, 2, 'fullWeeks')).toBe(8); // 2 leads a night
    expect(plannedNightCount(8, 2, 'rounds')).toBe(4); // 4 leads a night
  });

  it('never promises a night it cannot fill', () => {
    expect(plannedNightCount(6, 1, 'rounds')).toBe(1); // 6 slots, 4 a night
    expect(plannedNightCount(3, 1, 'rounds')).toBe(0);
    expect(plannedNightCount(0, 4, 'fullWeeks')).toBe(0);
  });
});

describe('buildLeadSchedule', () => {
  it('gives every unit its lead nights', () => {
    const { nights, leadCounts } = schedule(UNITS, 2, 'fullWeeks');
    expect(nights).toHaveLength(plannedNightCount(UNITS.length, 2, 'fullWeeks'));
    UNITS.forEach(unit => expect(leadCounts[unit]).toBe(2));
  });

  it('puts four separate units on a lead-rounds night', () => {
    const { nights } = schedule(UNITS, 2, 'rounds');
    expect(nights.length).toBeGreaterThan(0);
    nights.forEach(night => {
      const leads = nightUnits(night);
      expect(leads).toHaveLength(LEADS_PER_NIGHT.rounds);
      expect(new Set(leads).size).toBe(LEADS_PER_NIGHT.rounds);
    });
  });

  it('spaces lead rounds evenly and never back to back', () => {
    const { nights } = schedule(UNITS, 2, 'rounds');
    const spacing = summarizeLeadSpacing(toWeeks(nights, 'rounds'), UNITS);
    // 8 units × 2 leads over 4 nights: everyone leads exactly 2 nights apart.
    expect(spacing.idealGap).toBe(2);
    expect(spacing.minGap).toBe(2);
    expect(spacing.maxGap).toBe(2);
    expect(spacing.backToBack).toBe(0);
    expect(spacing.doubleNights).toBe(0);
  });

  it('spaces full lead weeks evenly too', () => {
    const { nights } = schedule(UNITS, 3, 'fullWeeks');
    const spacing = summarizeLeadSpacing(toWeeks(nights, 'fullWeeks'), UNITS);
    // 12 nights, 3 leads each — an even spread is 4 nights apart.
    expect(spacing.idealGap).toBe(4);
    expect(spacing.minGap).toBeGreaterThanOrEqual(3);
    expect(spacing.maxGap).toBeLessThanOrEqual(5);
    expect(spacing.backToBack).toBe(0);
  });

  it('avoids repeat lead matchups while units are still spread out', () => {
    const { nights } = schedule(UNITS, 2, 'rounds');
    const matchups = nights.flatMap(night => night.matchups.map(m => [m.leadA, m.leadB].sort().join(' vs ')));
    expect(new Set(matchups).size).toBe(matchups.length);
  });

  it('meets a division quota before pairing across divisions', () => {
    const unitToDivision = Object.fromEntries(UNITS.map((unit, i) => [unit, i < 4 ? 'North' : 'South']));
    const { nights, divisionLeadCounts } = buildLeadSchedule({
      units: UNITS,
      leadNightsPerUnit: 2,
      mode: 'fullWeeks',
      divisionNights: 1,
      unitToDivision,
      random: seeded(3),
    });
    expect(nights).toHaveLength(8);
    UNITS.forEach(unit => expect(divisionLeadCounts[unit]).toBeGreaterThanOrEqual(1));
  });

  it('stops short rather than double-booking a night when units run out', () => {
    const { nights, leadCounts } = schedule(['A', 'B', 'C', 'D', 'E'], 1, 'rounds');
    expect(nights).toHaveLength(1); // 5 slots, 4 a night
    expect(Object.values(leadCounts).filter(count => count === 1)).toHaveLength(4);
  });

  it('returns nothing when there are too few units for one night', () => {
    expect(schedule(['A', 'B'], 1, 'rounds').nights).toHaveLength(0);
  });
});

describe('weekLeadRounds', () => {
  it('reads a full-lead week as the same unit both rounds', () => {
    expect(weekLeadRounds({ leadA: '1stTX', leadB: '2ndSC' })).toEqual([
      { leadA: '1stTX', leadB: '2ndSC' },
      { leadA: '1stTX', leadB: '2ndSC' },
    ]);
  });

  it('reads a split-lead week round by round', () => {
    expect(weekLeadRounds({
      isSingleRoundLeads: true,
      leadA_r1: '1stTX', leadB_r1: '2ndSC', leadA_r2: '3rdUS', leadB_r2: '4thVA',
    })).toEqual([
      { leadA: '1stTX', leadB: '2ndSC' },
      { leadA: '3rdUS', leadB: '4thVA' },
    ]);
  });

  it('reports missing leads as null', () => {
    expect(weekLeadRounds({ isSingleRoundLeads: true, leadA_r1: '1stTX' })).toEqual([
      { leadA: '1stTX', leadB: null },
      { leadA: null, leadB: null },
    ]);
  });
});

describe('summarizeLeadSpacing', () => {
  const weeks: WeekLeads[] = [
    { isSingleRoundLeads: true, leadA_r1: 'A', leadB_r1: 'B', leadA_r2: 'C', leadB_r2: 'D' },
    { isSingleRoundLeads: true, leadA_r1: 'A', leadB_r1: 'C', leadA_r2: 'B', leadB_r2: 'D' },
    { isSingleRoundLeads: true, leadA_r1: 'A', leadB_r1: 'A', leadA_r2: 'A', leadB_r2: 'D' },
  ];

  it('counts nights, rounds and per-unit gaps', () => {
    const spacing = summarizeLeadSpacing(weeks, ['A', 'B', 'C', 'D']);
    expect(spacing.nights).toBe(3);
    expect(spacing.rounds).toBe(6);
    expect(spacing.leadingUnits).toBe(4);
    const byUnit = Object.fromEntries(spacing.perUnit.map(entry => [entry.unit, entry]));
    expect(byUnit.A).toMatchObject({ leadNights: 3, gaps: [1, 1], avgGap: 1, minGap: 1, maxGap: 1 });
    expect(byUnit.B).toMatchObject({ leadNights: 2, gaps: [1] });
    expect(byUnit.D).toMatchObject({ leadNights: 3, leadRounds: 3 });
  });

  it('flags leads that repeat too soon', () => {
    const spacing = summarizeLeadSpacing(weeks, ['A', 'B', 'C', 'D']);
    expect(spacing.backToBack).toBe(6); // every gap here is one night
    expect(spacing.doubleNights).toBe(1); // A leads more than one round of week 3
  });

  it('ignores units that never lead', () => {
    const spacing = summarizeLeadSpacing(weeks, ['A', 'B', 'C', 'D', 'E']);
    expect(spacing.leadingUnits).toBe(4);
    expect(spacing.perUnit.find(entry => entry.unit === 'E')).toMatchObject({ leadNights: 0, avgGap: null });
  });

  it('handles an empty season', () => {
    expect(summarizeLeadSpacing([], ['A'])).toMatchObject({ nights: 0, avgGap: null, idealGap: null });
  });
});

describe('schedule export', () => {
  const weeks: WeekLeads[] = [
    { name: 'Week 1', isSingleRoundLeads: true, leadA_r1: 'A', leadB_r1: 'B', leadA_r2: 'C', leadB_r2: 'D' },
    { name: 'Week 2', leadA: 'A', leadB: 'C' },
  ];

  it('writes one row per round with the season team names', () => {
    expect(scheduleExportRows(weeks, { A: 'Union', B: 'Confederacy' })).toEqual([
      ['Week', 'Round', 'Union Lead', 'Confederacy Lead'],
      ['Week 1', 'R1', 'A', 'B'],
      ['Week 1', 'R2', 'C', 'D'],
      ['Week 2', 'R1', 'A', 'C'],
      ['Week 2', 'R2', 'A', 'C'],
    ]);
  });

  it('adds a map column only when maps were generated', () => {
    const rows = scheduleExportRows([{ name: 'Week 1', leadA: 'A', leadB: 'B', round1Map: 'Burnside Bridge' }]);
    expect(rows[0]).toEqual(['Week', 'Round', 'Team A Lead', 'Team B Lead', 'Map']);
    expect(rows[1]).toEqual(['Week 1', 'R1', 'A', 'B', 'Burnside Bridge']);
    expect(rows[2]).toEqual(['Week 1', 'R2', 'A', 'B', '']);
  });

  it('tabs for pasting, quotes for csv', () => {
    const rows = [['Week', 'Team A Lead'], ['Week 1', 'A, B "the unit"']];
    expect(toTsv(rows)).toBe('Week\tTeam A Lead\nWeek 1\tA, B "the unit"');
    expect(toCsv(rows)).toBe('Week,Team A Lead\nWeek 1,"A, B ""the unit"""');
  });
});
