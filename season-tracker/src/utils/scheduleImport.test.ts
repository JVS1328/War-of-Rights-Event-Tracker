import { describe, it, expect } from 'vitest';
import {
  parseSchedulePaste,
  auditSchedule,
  scheduleWeeks,
  matchUnit,
  readNumber,
  describeProblem,
  type ScheduleConstraints,
} from './scheduleImport';

const REGISTRY = ['1st Texas', '24th Georgia', '69th New York', '20th Maine'];

const C = (over: Partial<ScheduleConstraints> = {}): ScheduleConstraints => ({
  mode: 'rounds',
  homePerUnit: 2,
  awayPerUnit: 2,
  splitAcrossRounds: true,
  ...over,
});

describe('matchUnit', () => {
  it('takes an exact name first', () => {
    expect(matchUnit('1st Texas', REGISTRY)).toBe('1st Texas');
  });

  it('forgives spacing, case and punctuation', () => {
    expect(matchUnit('1sttexas', REGISTRY)).toBe('1st Texas');
    expect(matchUnit('  24TH-GEORGIA ', REGISTRY)).toBe('24th Georgia');
  });

  it('matches on either name containing the other', () => {
    expect(matchUnit('69th New York Infantry', REGISTRY)).toBe('69th New York');
  });

  it('returns null rather than guessing at nothing', () => {
    expect(matchUnit('5th Vermont', REGISTRY)).toBeNull();
    expect(matchUnit('   ', REGISTRY)).toBeNull();
  });
});

describe('readNumber', () => {
  it('reads a week or round however it is written', () => {
    expect(readNumber('Week 12')).toBe(12);
    expect(readNumber('W3')).toBe(3);
    expect(readNumber('Round 2')).toBe(2);
    expect(readNumber('2')).toBe(2);
  });

  it('is null when there is no number', () => {
    expect(readNumber('')).toBeNull();
    expect(readNumber('TBD')).toBeNull();
  });
});

describe('parseSchedulePaste', () => {
  const PASTE = `Week\tRound\tHome\tAway\tDate
1\t1\t1st Texas\t69th New York\t8/5/2026
1\t2\t24th Georgia\t20th Maine\t8/5/2026
2\t1\t69th New York\t1st Texas\t8/12/2026
2\t2\t20th Maine\t24th Georgia\t8/12/2026`;

  it('reads a tab-separated paste with a header', () => {
    const p = parseSchedulePaste(PASTE, REGISTRY);
    expect(p.rows).toHaveLength(4);
    expect(p.problems).toEqual([]);
    expect(p.rows[0]).toMatchObject({ week: 1, round: 1, home: '1st Texas', away: '69th New York', date: '8/5/2026' });
  });

  it('reads the same paste with no header at all', () => {
    const p = parseSchedulePaste(PASTE.split('\n').slice(1).join('\n'), REGISTRY);
    expect(p.rows).toHaveLength(4);
  });

  it('follows the header when the columns are in another order', () => {
    const p = parseSchedulePaste(
      'Date\tAway\tHome\tRound\tWeek\n8/5/2026\t69th New York\t1st Texas\t1\t1',
      REGISTRY,
    );
    expect(p.rows[0]).toMatchObject({ week: 1, round: 1, home: '1st Texas', away: '69th New York' });
  });

  it('takes commas when there are no tabs', () => {
    const p = parseSchedulePaste('Week,Round,Home,Away,Date\n1,1,1st Texas,69th New York,8/5/2026', REGISTRY);
    expect(p.rows).toHaveLength(1);
  });

  it('skips blank lines without complaining about them', () => {
    const p = parseSchedulePaste(`${PASTE}\n\n\n`, REGISTRY);
    expect(p.rows).toHaveLength(4);
    expect(p.problems).toEqual([]);
  });

  it('collects the week numbers it saw', () => {
    expect(parseSchedulePaste(PASTE, REGISTRY).weeks).toEqual([1, 2]);
  });

  it('names a unit it could not match, rather than inventing one', () => {
    const p = parseSchedulePaste('1\t1\t1st Texas\t5th Vermont\t8/5/2026', REGISTRY);
    expect(p.rows).toHaveLength(0);
    expect(p.unmatched).toEqual(['5th Vermont']);
    expect(p.problems[0]).toMatchObject({ kind: 'unknown-unit', line: 1, name: '5th Vermont' });
  });

  it('reports a row it cannot read at all, with the line number', () => {
    const p = parseSchedulePaste('1\t1\t1st Texas\t69th New York\t8/5/2026\nnonsense', REGISTRY);
    expect(p.rows).toHaveLength(1);
    expect(p.problems[0]).toMatchObject({ kind: 'unparsable', line: 2 });
  });

  it('catches a unit down against itself', () => {
    const p = parseSchedulePaste('1\t1\t1st Texas\t1st texas\t8/5/2026', REGISTRY);
    expect(p.rows).toHaveLength(0);
    expect(p.problems[0]).toMatchObject({ kind: 'self-match', unit: '1st Texas' });
  });

  it('defaults a schedule with no round column to round 1', () => {
    // Per-night leads have nothing to put in a round column, so the paste is
    // Week / Home / Away — read as one fixture a night rather than refused.
    const p = parseSchedulePaste('Week\tHome\tAway\tDate\n1\t1st Texas\t69th New York\t8/5/2026', REGISTRY);
    expect(p.rows[0]).toMatchObject({ week: 1, round: 1, home: '1st Texas', away: '69th New York' });
  });

  it('does not mistake a data row for a header', () => {
    // One recognised word is not enough — a unit could be named "Home".
    const p = parseSchedulePaste('1\t1\t1st Texas\t69th New York\thome', REGISTRY);
    expect(p.rows).toHaveLength(1);
  });
});

describe('auditSchedule — counts', () => {
  // Four units, four weeks, rotated one place a week: everyone ends up with one
  // home lead and one away lead in each round — the plan a league would set.
  const EVEN = `1\t1\t1st Texas\t24th Georgia\t
1\t2\t69th New York\t20th Maine\t
2\t1\t24th Georgia\t69th New York\t
2\t2\t20th Maine\t1st Texas\t
3\t1\t69th New York\t20th Maine\t
3\t2\t1st Texas\t24th Georgia\t
4\t1\t20th Maine\t1st Texas\t
4\t2\t24th Georgia\t69th New York\t`;

  const audit = (text: string, over: Partial<ScheduleConstraints> = {}) =>
    auditSchedule(parseSchedulePaste(text, REGISTRY).rows, REGISTRY, C(over));

  it('passes a schedule that meets the plan', () => {
    const a = audit(EVEN);
    expect(a.problems).toEqual([]);
    expect(a.ok).toBe(true);
  });

  it('tallies home and away per unit', () => {
    const t = audit(EVEN).tallies.find((x) => x.unit === '1st Texas')!;
    expect(t).toMatchObject({ home: 2, away: 2, total: 4 });
  });

  it('splits the tallies by round as well as by side', () => {
    const t = audit(EVEN).tallies.find((x) => x.unit === '1st Texas')!;
    expect(t).toMatchObject({ homeR1: 1, homeR2: 1, awayR1: 1, awayR2: 1 });
  });

  it('names a unit short of its home leads', () => {
    const a = audit(EVEN, { homePerUnit: 3 });
    expect(a.problems.filter((p) => p.kind === 'home-count')).toHaveLength(4);
    expect(a.problems[0]).toMatchObject({ kind: 'home-count', got: 2, want: 3 });
  });

  it('gives a unit that appears nowhere a row, so its absence is visible', () => {
    const a = auditSchedule(
      parseSchedulePaste('1\t1\t1st Texas\t69th New York\t', REGISTRY).rows,
      REGISTRY,
      C({ homePerUnit: 1, awayPerUnit: 1, splitAcrossRounds: false }),
    );
    const maine = a.tallies.find((x) => x.unit === '20th Maine')!;
    expect(maine.total).toBe(0);
    expect(a.problems).toContainEqual({ kind: 'home-count', unit: '20th Maine', got: 0, want: 1 });
  });

  it('turns a count check off at zero', () => {
    const a = audit(EVEN, { homePerUnit: 0, awayPerUnit: 0 });
    expect(a.problems.filter((p) => p.kind === 'home-count' || p.kind === 'away-count')).toEqual([]);
  });
});

describe('auditSchedule — the round split', () => {
  // Both of 1st Texas's home leads fall in round 1.
  const LOPSIDED = `1\t1\t1st Texas\t69th New York\t
1\t2\t24th Georgia\t20th Maine\t
2\t1\t1st Texas\t20th Maine\t
2\t2\t69th New York\t24th Georgia\t`;

  it('flags a unit whose home leads all fall on the same round', () => {
    const a = auditSchedule(parseSchedulePaste(LOPSIDED, REGISTRY).rows, REGISTRY, C({ homePerUnit: 0, awayPerUnit: 0 }));
    expect(a.problems).toContainEqual({ kind: 'round-split', unit: '1st Texas', side: 'home', r1: 2, r2: 0 });
  });

  it('lets an odd count sit one apart, which is as split as it gets', () => {
    const a = auditSchedule(
      parseSchedulePaste('1\t1\t1st Texas\t69th New York\t', REGISTRY).rows,
      REGISTRY,
      C({ homePerUnit: 0, awayPerUnit: 0 }),
    );
    expect(a.problems.filter((p) => p.kind === 'round-split')).toEqual([]);
  });

  it('ignores the split entirely when the season sets leads per night', () => {
    // With one lead a night there is no second round to spread across.
    const a = auditSchedule(
      parseSchedulePaste(LOPSIDED, REGISTRY).rows,
      REGISTRY,
      C({ mode: 'fullWeeks', homePerUnit: 0, awayPerUnit: 0 }),
    );
    expect(a.problems.filter((p) => p.kind === 'round-split')).toEqual([]);
    expect(a.roundsPerNight).toBe(1);
  });

  it('can be turned off while the counts stay on', () => {
    const a = auditSchedule(
      parseSchedulePaste(LOPSIDED, REGISTRY).rows,
      REGISTRY,
      C({ homePerUnit: 0, awayPerUnit: 0, splitAcrossRounds: false }),
    );
    expect(a.problems).toEqual([]);
  });
});

describe('auditSchedule — structural problems', () => {
  it('catches a week missing one of its rounds', () => {
    const a = auditSchedule(
      parseSchedulePaste('1\t1\t1st Texas\t69th New York\t', REGISTRY).rows,
      REGISTRY,
      C({ homePerUnit: 0, awayPerUnit: 0, splitAcrossRounds: false }),
    );
    expect(a.problems).toContainEqual({ kind: 'missing-round', week: 1, round: 2 });
  });

  it('does not ask for a second round when leads are set per night', () => {
    const a = auditSchedule(
      parseSchedulePaste('1\t1\t1st Texas\t69th New York\t', REGISTRY).rows,
      REGISTRY,
      C({ mode: 'fullWeeks', homePerUnit: 0, awayPerUnit: 0 }),
    );
    expect(a.problems.filter((p) => p.kind === 'missing-round')).toEqual([]);
  });

  it('catches the same slot listed twice', () => {
    const text = `1\t1\t1st Texas\t69th New York\t
1\t1\t24th Georgia\t20th Maine\t
1\t2\t24th Georgia\t20th Maine\t`;
    const a = auditSchedule(parseSchedulePaste(text, REGISTRY).rows, REGISTRY, C({ homePerUnit: 0, awayPerUnit: 0, splitAcrossRounds: false }));
    expect(a.problems).toContainEqual({ kind: 'duplicate-round', week: 1, round: 1 });
  });

  it('catches a unit down twice in the same round', () => {
    const text = `1\t1\t1st Texas\t69th New York\t
1\t1\t1st Texas\t20th Maine\t
1\t2\t24th Georgia\t20th Maine\t`;
    const a = auditSchedule(parseSchedulePaste(text, REGISTRY).rows, REGISTRY, C({ homePerUnit: 0, awayPerUnit: 0, splitAcrossRounds: false }));
    expect(a.problems).toContainEqual({ kind: 'double-booked', week: 1, round: 1, unit: '1st Texas' });
  });

  it('folds both rounds of a night into one fixture when leads are per night', () => {
    // Two rows for week 1 are two separate fixtures under per-round leads, but
    // one night under per-night leads — so the second is a duplicate there.
    const text = `1\t1\t1st Texas\t69th New York\t
1\t2\t24th Georgia\t20th Maine\t`;
    const rows = parseSchedulePaste(text, REGISTRY).rows;
    expect(auditSchedule(rows, REGISTRY, C({ homePerUnit: 0, awayPerUnit: 0 })).problems).toEqual([]);
    const nightly = auditSchedule(rows, REGISTRY, C({ mode: 'fullWeeks', homePerUnit: 0, awayPerUnit: 0 }));
    expect(nightly.problems).toContainEqual({ kind: 'duplicate-round', week: 1, round: 1 });
  });
});

describe('scheduleWeeks', () => {
  const text = `1\t1\t1st Texas\t69th New York\t8/5/2026
1\t2\t24th Georgia\t20th Maine\t8/5/2026
2\t1\t69th New York\t1st Texas\t8/12/2026
2\t2\t20th Maine\t24th Georgia\t8/12/2026`;
  const rows = parseSchedulePaste(text, REGISTRY).rows;

  it('makes one week per week number, in order', () => {
    const weeks = scheduleWeeks(rows, 'rounds');
    expect(weeks.map((w) => w.week)).toEqual([1, 2]);
  });

  it('puts home on side A and away on side B', () => {
    // Home picks the map and away picks the side, so home is side A.
    const w = scheduleWeeks(rows, 'rounds')[0];
    expect(w.teamA).toEqual(['1st Texas', '24th Georgia']);
    expect(w.teamB).toEqual(['69th New York', '20th Maine']);
  });

  it('sets a lead per round under per-round leads', () => {
    const w = scheduleWeeks(rows, 'rounds')[0];
    expect(w).toMatchObject({
      isSingleRoundLeads: true,
      leadA_r1: '1st Texas',
      leadB_r1: '69th New York',
      leadA_r2: '24th Georgia',
      leadB_r2: '20th Maine',
      leadA: null,
      leadB: null,
    });
  });

  it('sets one lead for the night under per-night leads', () => {
    const w = scheduleWeeks(rows, 'fullWeeks')[0];
    expect(w).toMatchObject({
      isSingleRoundLeads: false,
      leadA: '1st Texas',
      leadB: '69th New York',
      leadA_r1: null,
      leadA_r2: null,
    });
  });

  it('names the week after its date when the paste carries one', () => {
    expect(scheduleWeeks(rows, 'rounds')[0].name).toBe('8/5/2026 - W1');
  });

  it('falls back to the week number when it does not', () => {
    const bare = parseSchedulePaste('7\t1\t1st Texas\t69th New York\t', REGISTRY).rows;
    expect(scheduleWeeks(bare, 'rounds')[0].name).toBe('Week 7');
  });
});

describe('describeProblem', () => {
  it('points at the line for a parse problem', () => {
    expect(describeProblem({ kind: 'unparsable', line: 4, text: 'junk' })).toContain('Line 4');
  });

  it('says what a count should have been', () => {
    const msg = describeProblem({ kind: 'home-count', unit: '1st Texas', got: 1, want: 2 });
    expect(msg).toContain('1st Texas');
    expect(msg).toContain('2');
  });

  it('reads the round split back as the two numbers', () => {
    const msg = describeProblem({ kind: 'round-split', unit: '1st Texas', side: 'away', r1: 2, r2: 0 });
    expect(msg).toContain('away');
    expect(msg).toContain('2 in round 1');
  });
});
