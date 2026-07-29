import { describe, it, expect } from 'vitest';
import {
  conferenceOf,
  knockoutByes,
  knockoutOpeningMatchups,
  knockoutSeedOrder,
  nextPowerOfTwo,
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
  bracketStyle: 'conference',
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

/** Three groups of five — no two-conference split is possible. */
const THREE_GROUPS: LeagueShape = {
  unitCount: 15,
  divisions: [
    { name: 'Group A', unitCount: 5 },
    { name: 'Group B', unitCount: 5 },
    { name: 'Group C', unitCount: 5 },
  ],
  nightsAvailable: 10,
};

/** Five groups of three, the other awkward shape. */
const FIVE_GROUPS: LeagueShape = {
  unitCount: 15,
  divisions: [
    { name: 'Alpha', unitCount: 3 },
    { name: 'Bravo', unitCount: 3 },
    { name: 'Charlie', unitCount: 3 },
    { name: 'Delta', unitCount: 3 },
    { name: 'Echo', unitCount: 3 },
  ],
  nightsAvailable: 10,
};

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

describe('knockout seeding', () => {
  it('rounds a field up to the next power of two', () => {
    expect([4, 5, 6, 8, 9, 15, 16].map(nextPowerOfTwo)).toEqual([4, 8, 8, 8, 16, 16, 16]);
  });

  it('pairs an eight-slot bracket 1v8, 4v5, 2v7, 3v6', () => {
    expect(knockoutSeedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });

  it('keeps the top two seeds apart until the final', () => {
    // In a 16-slot draw, seeds 1 and 2 sit in opposite halves.
    const order = knockoutSeedOrder(16);
    expect(order.indexOf(1)).toBeLessThan(8);
    expect(order.indexOf(2)).toBeGreaterThanOrEqual(8);
  });

  it('hands byes to the top seeds when the field is short of a power of two', () => {
    expect(knockoutByes(8)).toBe(0);
    expect(knockoutByes(6)).toBe(2);
    expect(knockoutByes(5)).toBe(3);
  });

  it('only counts opening matchups with two real teams', () => {
    expect(knockoutOpeningMatchups(8)).toBe(4);
    expect(knockoutOpeningMatchups(6)).toBe(2); // seeds 1 and 2 idle
    expect(knockoutOpeningMatchups(5)).toBe(1);
  });
});

describe('evaluateFormat — seeded knockout', () => {
  // The format the league actually wants: 3 groups of 5, top 2 each plus two
  // wildcards, seeded 1-8 on points, best-of-3 the whole way.
  const OPTION_ONE = config({
    bracketStyle: 'knockout',
    useDivisions: true,
    teamsPerDivision: 2,
    wildcardTeams: 2,
    roundFormats: { wildcard: 1, divisional: 3, conference: 3, finals: 3 },
  });

  it('builds the 8-team bracket three groups of five ask for', () => {
    const plan = evaluateFormat(OPTION_ONE, THREE_GROUPS);
    expect(blockers(plan)).toHaveLength(0);
    expect(plan.field.size).toBe(8);
    expect(plan.field.groupSeats).toBe(6);
    expect(plan.field.wildcardSeats).toBe(2);
    expect(plan.stages.map(s => s.name)).toEqual(['Quarterfinals', 'Semifinals', 'Finals']);
    expect(stage(plan, 'Quarterfinals')?.matchups).toBe(4);
    expect(stage(plan, 'Semifinals')?.matchups).toBe(2);
    expect(stage(plan, 'Finals')?.matchups).toBe(1);
    // Everyone who qualifies plays, and 7 of 15 miss out.
    expect(plan.placed).toBe(8);
    expect(plan.unplaced).toBe(0);
    expect(plan.qualifyRate).toBeCloseTo(8 / 15);
  });

  it('prices best-of-3 all the way through', () => {
    const plan = evaluateFormat(OPTION_ONE, THREE_GROUPS);
    // 7 series, each 2 or 3 rounds: 14 to 21 rounds, two rounds a night.
    expect([plan.minRounds, plan.maxRounds]).toEqual([14, 21]);
    expect([plan.minNights, plan.maxNights]).toEqual([7, 11]);
  });

  it('takes wildcards from the whole league, not one group', () => {
    const field = projectField(
      config({ bracketStyle: 'knockout', useDivisions: true, teamsPerDivision: 2, wildcardTeams: 2 }),
      THREE_GROUPS,
    );
    // 3 groups × 2 = 6 seats, then 2 wildcards off the 9 units left over.
    expect(field).toMatchObject({ groupSeats: 6, wildcardSeats: 2, size: 8 });
    expect(field.conferences).toEqual([]);
  });

  it('handles five groups of three just as well', () => {
    const plan = evaluateFormat(
      config({
        bracketStyle: 'knockout',
        useDivisions: true,
        teamsPerDivision: 1,
        wildcardTeams: 3,
        roundFormats: { wildcard: 1, divisional: 1, conference: 3, finals: 3 },
      }),
      FIVE_GROUPS,
    );
    expect(blockers(plan)).toHaveLength(0);
    // One winner per group plus three wildcards.
    expect(plan.field).toMatchObject({ groupSeats: 5, wildcardSeats: 3, size: 8 });
    expect(plan.stages.map(s => s.name)).toEqual(['Quarterfinals', 'Semifinals', 'Finals']);
  });

  it('gives the top seeds a bye when the field is not a power of two', () => {
    const plan = evaluateFormat(
      config({ bracketStyle: 'knockout', useDivisions: true, teamsPerDivision: 2, wildcardTeams: 0 }),
      THREE_GROUPS,
    );
    expect(plan.field.size).toBe(6);
    expect(stage(plan, 'Quarterfinals')?.matchups).toBe(2); // seeds 1 and 2 idle
    expect(plan.placed).toBe(6);
    expect(plan.notes.join(' ')).toMatch(/seeds 1–2 sit out the opening round/);
  });

  it('works with no groups at all, straight off the standings', () => {
    const plan = evaluateFormat(
      config({ bracketStyle: 'knockout', wildcardTeams: 8 }),
      { unitCount: 15, divisions: [], nightsAvailable: 10 },
    );
    expect(blockers(plan)).toHaveLength(0);
    expect(plan.field.size).toBe(8);
    expect(plan.stages.map(s => s.name)).toEqual(['Quarterfinals', 'Semifinals', 'Finals']);
  });

  it('draws a 16-team bracket from the round of 16 down', () => {
    const plan = evaluateFormat(
      config({ bracketStyle: 'knockout', wildcardTeams: 16 }),
      { unitCount: 20, divisions: [], nightsAvailable: 20 },
    );
    expect(plan.stages.map(s => s.name)).toEqual(['Round of 16', 'Quarterfinals', 'Semifinals', 'Finals']);
    expect(stage(plan, 'Round of 16')?.matchups).toBe(8);
  });

  it('refuses a field bigger than the four stage settings cover', () => {
    const plan = evaluateFormat(
      config({ bracketStyle: 'knockout', useDivisions: true, teamsPerDivision: 4, wildcardTeams: 8 }),
      { unitCount: 40, divisions: [
        { name: 'Group A', unitCount: 10 },
        { name: 'Group B', unitCount: 10 },
        { name: 'Group C', unitCount: 10 },
        { name: 'Group D', unitCount: 10 },
      ], nightsAvailable: 30 },
    );
    expect(blockers(plan)[0].message).toMatch(/more than the 16-team bracket/);
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
    expect(plan.defects.map(d => d.message).join(' ')).toMatch(/sit in no group/);
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
    const shapes = plans.map(p => `${p.config.bracketStyle}:${p.config.useDivisions}:${p.field.size}`);
    expect(new Set(shapes).size).toBe(shapes.length);
  });

  it('leads with a full 8-team field when the calendar has room', () => {
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

  it('offers three groups of five a real bracket, not a 4-team consolation', () => {
    const [best] = suggestFormats(THREE_GROUPS);
    expect(best.config.bracketStyle).toBe('knockout');
    expect(best.field.size).toBeGreaterThanOrEqual(8);
    expect(best.config.useDivisions).toBe(true);
    expect(blockers(best)).toHaveLength(0);
  });

  it('offers five groups of three the same', () => {
    const [best] = suggestFormats(FIVE_GROUPS);
    expect(best.config.bracketStyle).toBe('knockout');
    expect(best.field.size).toBeGreaterThanOrEqual(8);
  });

  it('leads with a draw that fills every slot rather than one with byes', () => {
    // Shorter fields with byes may still be offered as alternatives, but a
    // free pass to the next round should never top the list.
    expect(knockoutByes(suggestFormats(THREE_GROUPS)[0].field.size)).toBe(0);
    expect(knockoutByes(suggestFormats(FIVE_GROUPS)[0].field.size)).toBe(0);
  });

  it('still knows the conference bracket when the groups suit it', () => {
    const styles = suggestFormats(TWO_CONFERENCES, { limit: 6 }).map(p => p.config.bracketStyle);
    expect(styles).toContain('conference');
    expect(styles).toContain('knockout');
  });

  it('honours the requested shortlist size', () => {
    expect(suggestFormats(TWO_CONFERENCES, { limit: 1 })).toHaveLength(1);
  });
});

describe('leagueAdvice', () => {
  it('says nothing to a league with no groups at all', () => {
    expect(leagueAdvice(FLAT_LEAGUE)).toEqual([]);
  });

  it('says nothing about conferences once there are two', () => {
    expect(leagueAdvice(TWO_CONFERENCES)).toEqual([]);
  });

  it('points a league whose groups do not split in two at the knockout', () => {
    expect(leagueAdvice(THREE_GROUPS).join(' ')).toMatch(/seeded knockout takes any number of groups/);
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
