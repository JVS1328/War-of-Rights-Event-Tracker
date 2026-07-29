import { describe, it, expect } from 'vitest';
import {
  conferenceOf,
  evaluateFormat,
  formatNights,
  leagueAdvice,
  projectField,
  suggestFormats,
  winsNeeded,
} from './playoffPlanner';
import type { LeagueShape, PlayoffConfig } from './playoffPlanner';

const config = (overrides: Partial<PlayoffConfig> = {}): PlayoffConfig => ({
  enabled: true,
  useDivisions: false,
  teamsPerDivision: 2,
  wildcardTeams: 0,
  roundFormats: { wildcard: 1, divisional: 1, conference: 2, finals: 2 },
  ...overrides,
});

/** Four four-unit divisions that group into a North and a South conference. */
const TWO_CONFERENCES: LeagueShape = {
  unitCount: 16,
  divisions: [
    { name: 'North Valley', unitCount: 4 },
    { name: 'North Ridge', unitCount: 4 },
    { name: 'South Valley', unitCount: 4 },
    { name: 'South Ridge', unitCount: 4 },
  ],
  nightsAvailable: 8,
};

const FLAT_LEAGUE: LeagueShape = { unitCount: 12, divisions: [], nightsAvailable: 6 };

const stage = (plan: ReturnType<typeof evaluateFormat>, name: string) =>
  plan.stages.find(s => s.name === name);

const blockers = (plan: ReturnType<typeof evaluateFormat>) =>
  plan.defects.filter(d => d.severity === 'blocker');

describe('conferenceOf', () => {
  it('splits on the first word, the way the bracket does', () => {
    expect(conferenceOf('North Valley')).toBe('North');
    expect(conferenceOf('South Ridge')).toBe('South');
  });

  it('treats a one-word division as its own conference', () => {
    expect(conferenceOf('Antietam')).toBe('Antietam');
    expect(conferenceOf('  Padded  Name ')).toBe('Padded');
  });
});

describe('winsNeeded', () => {
  it('reads roundsPerMatch as first-to-N, so 2 and 3 are the same series', () => {
    expect(winsNeeded(1)).toBe(1);
    expect(winsNeeded(2)).toBe(2);
    expect(winsNeeded(3)).toBe(2);
  });
});

describe('projectField', () => {
  it('takes the top N in the standings when divisions are off', () => {
    expect(projectField(config({ wildcardTeams: 6 }), FLAT_LEAGUE).size).toBe(6);
  });

  it('falls back to a 4-team field when no size is set', () => {
    expect(projectField(config({ wildcardTeams: 0 }), FLAT_LEAGUE).size).toBe(4);
  });

  it('never seats more units than the league has', () => {
    const tiny: LeagueShape = { unitCount: 5, divisions: [], nightsAvailable: 4 };
    expect(projectField(config({ wildcardTeams: 8 }), tiny).size).toBe(5);
  });

  it('gives every division its seats and splits wildcards per conference', () => {
    const field = projectField(
      config({ useDivisions: true, teamsPerDivision: 2, wildcardTeams: 1 }),
      TWO_CONFERENCES,
    );
    expect(field.conferences.map(c => c.name)).toEqual(['North', 'South']);
    // Two divisions of four: 2 + 2 seats, one wildcard from the four left over.
    expect(field.conferences[0]).toMatchObject({ divisionSeats: 4, wildcardSeats: 1, size: 5 });
    expect(field.size).toBe(10);
  });

  it('caps wildcards at the units a conference has left', () => {
    const field = projectField(
      config({ useDivisions: true, teamsPerDivision: 4, wildcardTeams: 3 }),
      TWO_CONFERENCES,
    );
    // Top 4 of a 4-unit division takes everyone, so no wildcards remain.
    expect(field.conferences[0]).toMatchObject({ divisionSeats: 8, wildcardSeats: 0, size: 8 });
  });

  it('counts units that division play shuts out entirely', () => {
    const withStragglers: LeagueShape = { ...TWO_CONFERENCES, unitCount: 19 };
    const field = projectField(config({ useDivisions: true, teamsPerDivision: 2 }), withStragglers);
    expect(field.lockedOut).toBe(3);
  });
});

describe('evaluateFormat — the shapes the bracket draws whole', () => {
  it('plans a 4-team knockout as two semis and a final', () => {
    const plan = evaluateFormat(
      config({ wildcardTeams: 4, roundFormats: { wildcard: 1, divisional: 1, conference: 1, finals: 3 } }),
      FLAT_LEAGUE,
    );
    expect(blockers(plan)).toHaveLength(0);
    expect(plan.stages.map(s => s.name)).toEqual(['Semifinals', 'Finals']);
    expect(stage(plan, 'Semifinals')).toMatchObject({ matchups: 2, minRounds: 2, maxRounds: 2 });
    // A first-to-2 final runs two rounds if it is swept, three if it is not.
    expect(stage(plan, 'Finals')).toMatchObject({ matchups: 1, minRounds: 2, maxRounds: 3 });
    expect(plan.placed).toBe(4);
    expect(plan.unplaced).toBe(0);
  });

  it('turns rounds into nights at two rounds a night', () => {
    const plan = evaluateFormat(
      config({ wildcardTeams: 4, roundFormats: { wildcard: 1, divisional: 1, conference: 1, finals: 3 } }),
      FLAT_LEAGUE,
    );
    expect([plan.minRounds, plan.maxRounds]).toEqual([4, 5]);
    expect([plan.minNights, plan.maxNights]).toEqual([2, 3]);
    expect(plan.fitsCalendar).toBe(true);
  });

  it('draws an 8-team conference bracket with no wildcard round', () => {
    const plan = evaluateFormat(
      config({ useDivisions: true, teamsPerDivision: 2, wildcardTeams: 0 }),
      TWO_CONFERENCES,
    );
    expect(blockers(plan)).toHaveLength(0);
    expect(plan.field.size).toBe(8);
    expect(plan.stages.map(s => s.name)).toEqual(['Divisional', 'Conference Finals', 'Championship']);
    expect(stage(plan, 'Divisional')?.matchups).toBe(4); // two per conference
    expect(stage(plan, 'Conference Finals')?.matchups).toBe(2);
    expect(plan.placed).toBe(8);
    expect(plan.unplaced).toBe(0);
  });

  it('draws a 12-team conference bracket with a wildcard round', () => {
    const plan = evaluateFormat(
      config({ useDivisions: true, teamsPerDivision: 3, wildcardTeams: 0 }),
      TWO_CONFERENCES,
    );
    expect(blockers(plan)).toHaveLength(0);
    expect(plan.field.size).toBe(12);
    expect(stage(plan, 'Wildcard')?.matchups).toBe(4);
    expect(stage(plan, 'Divisional')?.matchups).toBe(4);
    expect(plan.placed).toBe(12);
  });
});

describe('evaluateFormat — the shapes that break', () => {
  it('flags a field the bracket is too small to draw', () => {
    const plan = evaluateFormat(config({ wildcardTeams: 4 }), {
      unitCount: 3,
      divisions: [],
      nightsAvailable: 4,
    });
    expect(plan.stages).toHaveLength(0);
    expect(blockers(plan)[0].message).toMatch(/needs 4/);
    expect(plan.score).toBe(0);
  });

  it('flags the phantom championship in an 8-team open bracket', () => {
    const plan = evaluateFormat(config({ wildcardTeams: 8 }), {
      unitCount: 16,
      divisions: [],
      nightsAvailable: 10,
    });
    expect(blockers(plan)[0].message).toMatch(/only ever receives one team/);
    expect(plan.score).toBe(0);
  });

  it('flags a 5-team conference, whose divisional slot never fills', () => {
    const plan = evaluateFormat(
      config({ useDivisions: true, teamsPerDivision: 2, wildcardTeams: 1 }),
      TWO_CONFERENCES,
    );
    expect(plan.field.size).toBe(10);
    expect(blockers(plan).map(d => d.message).join(' ')).toMatch(/5 qualifiers/);
  });

  it('flags conference winners with nowhere to play', () => {
    const threeConferences: LeagueShape = {
      unitCount: 18,
      divisions: [
        { name: 'North Valley', unitCount: 6 },
        { name: 'South Valley', unitCount: 6 },
        { name: 'West Valley', unitCount: 6 },
      ],
      nightsAvailable: 10,
    };
    const plan = evaluateFormat(
      config({ useDivisions: true, teamsPerDivision: 4, wildcardTeams: 0 }),
      threeConferences,
    );
    expect(blockers(plan).map(d => d.message).join(' ')).toMatch(/only pairs the first two conferences/);
  });

  it('warns about qualifiers that get a seed but never a matchup', () => {
    const plan = evaluateFormat(
      config({ useDivisions: true, teamsPerDivision: 4, wildcardTeams: 0 }),
      TWO_CONFERENCES,
    );
    // Eight per conference, but the draw only reaches seed six.
    expect(plan.field.size).toBe(16);
    expect(plan.placed).toBe(12);
    expect(plan.defects.map(d => d.message).join(' ')).toMatch(/never drawn into a matchup/);
  });

  it('warns when units sit outside every division', () => {
    const plan = evaluateFormat(config({ useDivisions: true, teamsPerDivision: 2 }), {
      ...TWO_CONFERENCES,
      unitCount: 20,
    });
    expect(plan.defects.map(d => d.message).join(' ')).toMatch(/sit in no division/);
  });

  it('warns when the format outruns the nights set aside', () => {
    const plan = evaluateFormat(
      config({ useDivisions: true, teamsPerDivision: 3, wildcardTeams: 0 }),
      { ...TWO_CONFERENCES, nightsAvailable: 2 },
    );
    expect(plan.fitsCalendar).toBe(false);
    expect(plan.defects.map(d => d.message).join(' ')).toMatch(/only 2 nights are set aside/);
  });

  it('notes that an even series length can run a round longer than its label', () => {
    const plan = evaluateFormat(
      config({ wildcardTeams: 4, roundFormats: { wildcard: 1, divisional: 1, conference: 2, finals: 2 } }),
      FLAT_LEAGUE,
    );
    expect(plan.notes.join(' ')).toMatch(/first-to-2/);
  });
});

describe('suggestFormats', () => {
  it('never recommends a bracket the tracker cannot draw', () => {
    const plans = suggestFormats(TWO_CONFERENCES);
    expect(plans.length).toBeGreaterThan(0);
    plans.forEach(plan => expect(blockers(plan)).toHaveLength(0));
  });

  it('offers genuinely different formats rather than one bracket restated', () => {
    const plans = suggestFormats(TWO_CONFERENCES);
    const shapes = plans.map(p => `${p.config.useDivisions}:${p.field.size}`);
    expect(new Set(shapes).size).toBe(shapes.length);
  });

  it('leads with the conference bracket when the calendar has room', () => {
    const [best] = suggestFormats(TWO_CONFERENCES);
    expect(best.field.size).toBe(8);
    expect(best.config.useDivisions).toBe(true);
    expect(best.fitsCalendar).toBe(true);
  });

  it('falls back to a short bracket when the calendar is tight', () => {
    const plans = suggestFormats({ ...TWO_CONFERENCES, nightsAvailable: 3 });
    expect(plans.length).toBeGreaterThan(0);
    // Three nights cannot hold the 8-team conference bracket, so only the
    // 4-team knockout survives — and the pick of them is guaranteed to fit.
    plans.forEach(plan => {
      expect(plan.field.size).toBe(4);
      expect(plan.minNights).toBeLessThanOrEqual(3);
    });
    expect(plans[0].fitsCalendar).toBe(true);
  });

  it('shows the shortest bracket possible when nothing fits the calendar', () => {
    const plans = suggestFormats({ ...TWO_CONFERENCES, nightsAvailable: 1 });
    expect(plans.length).toBeGreaterThan(0);
    expect(plans[0].minNights).toBe(2);
    expect(plans[0].fitsCalendar).toBe(false);
    expect(plans[0].defects.map(d => d.message).join(' ')).toMatch(/only 1 night is set aside/);
  });

  it('prefers series that get longer, not shorter, as the bracket narrows', () => {
    const [best] = suggestFormats(TWO_CONFERENCES);
    for (let i = 1; i < best.stages.length; i++) {
      expect(winsNeeded(best.stages[i].roundsPerMatch))
        .toBeGreaterThanOrEqual(winsNeeded(best.stages[i - 1].roundsPerMatch));
    }
  });

  it('uses divisions when they exist and are a clean route in', () => {
    const [best] = suggestFormats(TWO_CONFERENCES);
    expect(best.config.useDivisions).toBe(true);
  });

  it('still finds a format for a league with no divisions', () => {
    const plans = suggestFormats(FLAT_LEAGUE);
    expect(plans.length).toBeGreaterThan(0);
    expect(plans[0].field.size).toBe(4);
    expect(plans[0].config.useDivisions).toBe(false);
  });

  it('returns nothing when the league is too small to bracket', () => {
    expect(suggestFormats({ unitCount: 3, divisions: [], nightsAvailable: 4 })).toEqual([]);
  });

  it('honours the requested shortlist size', () => {
    expect(suggestFormats(TWO_CONFERENCES, { limit: 1 })).toHaveLength(1);
  });
});

describe('leagueAdvice', () => {
  it('points a division-less league at conferences', () => {
    expect(leagueAdvice(FLAT_LEAGUE).join(' ')).toMatch(/Two conferences/);
  });

  it('says nothing about conferences once there are two', () => {
    expect(leagueAdvice(TWO_CONFERENCES)).toEqual([]);
  });

  it('calls out divisions that all fall into one conference', () => {
    const advice = leagueAdvice({
      unitCount: 12,
      divisions: [
        { name: 'North Valley', unitCount: 6 },
        { name: 'North Ridge', unitCount: 6 },
      ],
      nightsAvailable: 6,
    });
    expect(advice.join(' ')).toMatch(/no championship round/);
  });

  it('calls out a third conference the championship cannot seat', () => {
    const advice = leagueAdvice({
      unitCount: 18,
      divisions: [
        { name: 'North Valley', unitCount: 6 },
        { name: 'South Valley', unitCount: 6 },
        { name: 'West Valley', unitCount: 6 },
      ],
      nightsAvailable: 8,
    });
    expect(advice.join(' ')).toMatch(/only pairs the first two/);
  });

  it('calls out a league too small for a bracket', () => {
    expect(leagueAdvice({ unitCount: 3, divisions: [], nightsAvailable: 4 }).join(' '))
      .toMatch(/at least 4/);
  });
});

describe('formatNights', () => {
  it('collapses a fixed length to a single number', () => {
    expect(formatNights(3, 3)).toBe('3 nights');
    expect(formatNights(1, 1)).toBe('1 night');
  });

  it('shows a range when deciders could add a night', () => {
    expect(formatNights(3, 5)).toBe('3–5 nights');
  });
});
