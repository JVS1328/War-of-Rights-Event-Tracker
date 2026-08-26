import { describe, it, expect } from 'vitest';
import { generatePlayoffBracket, bracketSlots } from './playoffBracket';
import { makeDefaultPlayoffConfig, DEFAULT_POINT_SYSTEM, DEFAULT_ELO_SYSTEM } from './eventStore';

// The seeding the standings project. Both the tracker and the public site draw
// from this, so what matters is that a given table produces a given field.

/** A season where each unit's points are decided by how many nights it led and won. */
const seasonWith = (units, weeks, playoffConfig = {}, extra = {}) => ({
  id: 'sea_1',
  name: 'Season 1',
  units,
  nonTokenUnits: [],
  weeks,
  divisions: [],
  manualAdjustments: {},
  unitPlayerCounts: {},
  pointSystem: { ...DEFAULT_POINT_SYSTEM },
  playoffConfig: { ...makeDefaultPlayoffConfig(), ...playoffConfig },
  ...extra,
});

const eventWith = (season) => ({
  id: 'evt_1',
  name: 'Test',
  eloSystem: { ...DEFAULT_ELO_SYSTEM },
  eloConfig: {},
  seasons: [season],
});

const appStateWith = (event) => ({
  schemaVersion: 2,
  activeEventId: event.id,
  activeSeasonId: event.seasons[0].id,
  events: [event],
});

const run = (season, opts = {}) => {
  const event = eventWith(season);
  return generatePlayoffBracket({ appState: appStateWith(event), event, season, ...opts });
};

const slots = (season, opts = {}) => {
  const event = eventWith(season);
  return bracketSlots({ appState: appStateWith(event), event, season, ...opts });
};

/** A night where `winner` leads side A and beats `loser` on both rounds. */
const win = (id, winner, loser, over = {}) => ({
  id,
  name: `Night ${id}`,
  teamA: [winner],
  teamB: [loser],
  leadA: winner,
  leadB: loser,
  round1Winner: 'A',
  round2Winner: 'A',
  ...over,
});

describe('generatePlayoffBracket', () => {
  it('draws nothing while playoffs are switched off', () => {
    expect(run(seasonWith(['A', 'B'], [], { enabled: false }))).toBeNull();
    expect(slots(seasonWith(['A', 'B'], [], { enabled: false }))).toEqual([]);
  });

  it('seeds a four-unit knockout 1-v-4 and 2-v-3', () => {
    const units = ['A', 'B', 'C', 'D'];
    // A beats D twice, B beats C twice, then A beats C — so A > B > C > D.
    const weeks = [win(1, 'A', 'D'), win(2, 'B', 'C'), win(3, 'A', 'C')];
    const bracket = run(seasonWith(units, weeks, {
      enabled: true, bracketStyle: 'knockout', useDivisions: false, wildcardTeams: 4,
    }));

    expect(bracket).not.toBeNull();
    const first = bracket.rounds[0];
    const pairs = first.matchups.map((m) => [m.team1?.unit, m.team2?.unit]);
    expect(pairs).toContainEqual(['A', 'D']);
    expect(pairs).toContainEqual(['B', 'C']);
  });

  it('gives the top seeds a bye when the field is not a power of two', () => {
    const units = ['A', 'B', 'C', 'D', 'E', 'F'];
    const weeks = [
      win(1, 'A', 'F'), win(2, 'A', 'E'), win(3, 'B', 'F'),
      win(4, 'B', 'E'), win(5, 'C', 'D'), win(6, 'C', 'E'),
    ];
    const bracket = run(seasonWith(units, weeks, {
      enabled: true, bracketStyle: 'knockout', useDivisions: false, wildcardTeams: 6,
    }));
    const byes = bracket.rounds.flatMap((r) => r.matchups).filter((m) => m.bye);
    expect(byes.length).toBeGreaterThan(0);
  });

  it('takes the top N from each division when qualifying through groups', () => {
    const units = ['A', 'B', 'C', 'D', 'E', 'F'];
    // Two nights per division decide the order inside it; C and F finish last.
    const weeks = [
      win(1, 'A', 'C'), win(2, 'B', 'C'), win(3, 'A', 'B'),
      win(4, 'D', 'F'), win(5, 'E', 'F'), win(6, 'D', 'E'),
    ];
    const season = seasonWith(units, weeks, {
      enabled: true, bracketStyle: 'knockout', useDivisions: true, teamsPerDivision: 2, wildcardTeams: 0,
    }, {
      divisions: [
        { name: 'North', units: ['A', 'B', 'C'] },
        { name: 'South', units: ['D', 'E', 'F'] },
      ],
    });
    const qualified = run(season).rounds.flatMap((r) => r.matchups)
      .flatMap((m) => [m.team1?.unit, m.team2?.unit])
      .filter(Boolean);
    // Two from each division — the top pair, not the unit each of them beat.
    expect(qualified).toEqual(expect.arrayContaining(['A', 'B', 'D', 'E']));
    expect(qualified).not.toContain('C');
    expect(qualified).not.toContain('F');
  });

  it('draws nothing for a field too small to bracket', () => {
    const season = seasonWith(['A', 'B'], [win(1, 'A', 'B')], {
      enabled: true, bracketStyle: 'knockout', useDivisions: false, wildcardTeams: 2,
    });
    expect(run(season).rounds).toEqual([]);
  });

  it('leaves a non-token unit out of the field however well it did', () => {
    const units = ['A', 'B', 'C', 'D', 'Guest'];
    const weeks = [win(1, 'Guest', 'A'), win(2, 'Guest', 'B'), win(3, 'C', 'D')];
    const season = seasonWith(units, weeks, {
      enabled: true, bracketStyle: 'knockout', useDivisions: false, wildcardTeams: 4,
    });
    season.nonTokenUnits = ['Guest'];
    const qualified = run(season).rounds.flatMap((r) => r.matchups)
      .flatMap((m) => [m.team1?.unit, m.team2?.unit]);
    expect(qualified).not.toContain('Guest');
  });

  it('seeds from the table as it stood at an earlier week', () => {
    const units = ['A', 'B', 'C', 'D'];
    // B leads early and A overtakes it at the end.
    const weeks = [win(1, 'B', 'C'), win(2, 'B', 'D'), win(3, 'A', 'C'), win(4, 'A', 'D'), win(5, 'A', 'B')];
    const config = { enabled: true, bracketStyle: 'knockout', useDivisions: false, wildcardTeams: 4 };
    const early = run(seasonWith(units, weeks, config), { weekIndex: 1 });
    const final = run(seasonWith(units, weeks, config));
    const topOf = (b) => b.rounds[0].matchups.find((m) => m.seed1 === 1)?.team1?.unit;
    expect(topOf(early)).toBe('B');
    expect(topOf(final)).toBe('A');
  });
});

describe('bracketSlots', () => {
  it('renders a matchup per row, with TBD where the seeding has not resolved', () => {
    const units = ['A', 'B', 'C', 'D'];
    const weeks = [win(1, 'A', 'D'), win(2, 'B', 'C'), win(3, 'A', 'C')];
    const rows = slots(seasonWith(units, weeks, {
      enabled: true, bracketStyle: 'knockout', useDivisions: false, wildcardTeams: 4,
    }));

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.a).toBeTruthy();
      expect(row.b).toBeTruthy();
      expect(typeof row.stage).toBe('string');
    }
    // The final has nobody in it until the semis are played.
    expect(rows.some((r) => r.a === 'TBD' || r.b === 'TBD' || r.night === 'unscheduled')).toBe(true);
  });

  it('reads the rounds off the playoff night a matchup lands on', () => {
    const units = ['A', 'B', 'C', 'D'];
    const weeks = [
      win(1, 'A', 'D'), win(2, 'B', 'C'), win(3, 'A', 'C'),
      { ...win(4, 'A', 'D'), isPlayoffs: true, name: 'Semis', round1Map: 'Bloody Lane' },
    ];
    const rows = slots(seasonWith(units, weeks, {
      enabled: true, bracketStyle: 'knockout', useDivisions: false, wildcardTeams: 4,
    }));
    const scheduled = rows.find((r) => r.night === 'Semis');
    expect(scheduled).toBeDefined();
    expect(scheduled.roundsA).toBe(2);
    expect(scheduled.map1).toBe('Bloody Lane');
  });
});
