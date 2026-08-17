import { describe, it, expect } from 'vitest';
import type { ScoreboardPlayer, RosterEntry, ScoreboardOfficer } from '../../../stats/types';
import { EMPTY_STANCE, type KillStance } from './playersModel';
import {
  buildInGameUnits,
  filterInGameUnits,
  allUnitKeys,
  companyLabel,
  NO_UNIT_LABEL,
  NO_COMPANY_LABEL,
} from './inGameUnitsModel';

const player = (over: Partial<ScoreboardPlayer> & { name: string }): ScoreboardPlayer => ({
  team: 'USA',
  kills: 0,
  deaths: 0,
  kd: 0,
  deathsInForm: 0,
  deathsSkirm: 0,
  deathsOob: 0,
  steamId: null,
  ...over,
});

const seat = (over: Partial<RosterEntry> & { name: string }): RosterEntry => ({
  team: 'USA',
  regiment: null,
  company: null,
  className: null,
  rank: null,
  steamId: null,
  ...over,
});

const officer = (over: Partial<ScoreboardOfficer> & { name: string }): ScoreboardOfficer => ({
  team: 'USA',
  commanded: 0,
  battery: false,
  ...over,
});

/** No killfeed by default; a few tests hand-feed stances per player. */
const noStance = (_p: ScoreboardPlayer): KillStance => EMPTY_STANCE;
const stanceBy = (m: Record<string, KillStance>) => (p: ScoreboardPlayer) => m[p.name] ?? EMPTY_STANCE;

// A round with two USA companies of the 20th Maine, a CSA battery, an
// Unenlisted man and one player the roster never mentions.
const abe = player({ name: 'Abe', steamId: 's1', kills: 4, deaths: 1, deathsInForm: 1 });
const ben = player({ name: 'Ben', steamId: 's2', kills: 2, deaths: 2, deathsSkirm: 2 });
const cal = player({ name: 'Cal', steamId: 's3', kills: 1, deaths: 1, deathsOob: 1 });
const dix = player({ name: 'Dix', steamId: 's4', team: 'CSA', kills: 3, deaths: 0 });
const eli = player({ name: 'Eli', steamId: 's5', kills: 0, deaths: 1, deathsInForm: 1 });
const ghost = player({ name: 'Ghost', steamId: 's6', team: 'CSA', kills: 1, deaths: 1 });

const ROSTER: RosterEntry[] = [
  seat({ name: 'Abe', steamId: 's1', regiment: '20th Maine', company: 'A Company' }),
  seat({ name: 'Ben', steamId: 's2', regiment: '20th Maine', company: 'A Company' }),
  seat({ name: 'Cal', steamId: 's3', regiment: '20th Maine', company: 'B Company' }),
  seat({ name: 'Dix', steamId: 's4', team: 'CSA', regiment: 'Battery A', company: 'A Company' }),
  seat({ name: 'Eli', steamId: 's5', regiment: 'Unenlisted' }),
];
const PLAYERS = [abe, ben, cal, dix, eli, ghost];

const build = (
  players = PLAYERS,
  roster = ROSTER,
  officers: ScoreboardOfficer[] = [],
  stance = noStance,
) => buildInGameUnits(players, roster, officers, stance);

describe('buildInGameUnits — the tree', () => {
  it('nests team → regiment → company off the roster', () => {
    const [usa, csa] = build();
    expect(usa.team).toBe('USA');
    expect(usa.regiments.map((r) => r.label)).toEqual(['20th Maine', 'Unenlisted']);
    expect(usa.regiments[0].companies.map((c) => c.label)).toEqual(['Co. A', 'Co. B']);
    expect(csa.regiments.map((r) => r.label)).toEqual(['Battery A', NO_UNIT_LABEL]);
  });

  it('reads a regiment as its arm of service', () => {
    const [usa, csa] = build();
    expect(usa.regiments[0].branch).toBe('Infantry');
    expect(csa.regiments[0].branch).toBe('Artillery');
  });

  it('places a man the roster never mentions under his scoreboard team', () => {
    const [, csa] = build();
    const unknown = csa.regiments.find((r) => r.regiment == null)!;
    expect(unknown.players.map((p) => p.name)).toEqual(['Ghost']);
    expect(unknown.flat).toBe(true);
  });

  it('follows the roster team, not the scoreboard row, when they disagree', () => {
    const turncoat = player({ name: 'Turncoat', steamId: 's9', team: 'USA' });
    const [csa] = build([turncoat], [
      seat({ name: 'Turncoat', steamId: 's9', team: 'CSA', regiment: '1st Texas', company: 'A Company' }),
    ]);
    expect(csa.team).toBe('CSA');
    expect(csa.regiments[0].label).toBe('1st Texas');
  });

  it('flattens a regiment with no company structure', () => {
    const [usa] = build();
    const unenlisted = usa.regiments.find((r) => r.label === 'Unenlisted')!;
    expect(unenlisted.flat).toBe(true);
    expect(unenlisted.companies[0].label).toBe(NO_COMPANY_LABEL);
  });
});

describe('buildInGameUnits — figures', () => {
  it('sums a company, and rolls companies up into the regiment and the team', () => {
    const [usa] = build();
    const maine = usa.regiments[0];
    const coA = maine.companies[0];
    expect(coA.agg.kills).toBe(6); // Abe 4 + Ben 2
    expect(coA.agg.deaths).toBe(3);
    expect(coA.agg.skirm).toBe(2);
    expect(maine.agg.kills).toBe(7); // + Cal
    expect(maine.agg.deaths).toBe(4);
    expect(usa.agg.kills).toBe(7); // Eli scored nothing
    expect(usa.agg.deaths).toBe(5); // + Eli
  });

  it('carries the team ticket denominators for the TDI / TDR shares', () => {
    const [usa] = build(PLAYERS, ROSTER, [], stanceBy({
      Abe: { inForm: 4, skirm: 0, oob: 0 },
      Ben: { inForm: 0, skirm: 2, oob: 0 },
      Cal: { inForm: 0, skirm: 0, oob: 1 },
    }));
    // Inflicted: 4·1 + 2·3 + 1·5 = 15. Received: Abe 1·1 + Ben 2·3 + Cal 1·5 + Eli 1·1 = 13.
    expect(usa.ticketInflicted).toBe(15);
    expect(usa.ticketReceived).toBe(13);
    expect(usa.regiments[0].companies[0].agg.killSkirm).toBe(2);
  });
});

describe('buildInGameUnits — order', () => {
  it('puts the biggest regiment first and pins the non-units to the end', () => {
    const [usa] = build();
    expect(usa.regiments.map((r) => r.label)).toEqual(['20th Maine', 'Unenlisted']);
    const [, csa] = build();
    expect(csa.regiments.at(-1)!.label).toBe(NO_UNIT_LABEL);
  });

  it('orders companies naturally, with the company-less last', () => {
    const roster = [
      seat({ name: 'a', regiment: '1st', company: '10th Company' }),
      seat({ name: 'b', regiment: '1st', company: '2nd Company' }),
      seat({ name: 'c', regiment: '1st' }),
    ];
    const [usa] = build([player({ name: 'a' }), player({ name: 'b' }), player({ name: 'c' })], roster);
    expect(usa.regiments[0].companies.map((c) => c.label)).toEqual(['Co. 2nd', 'Co. 10th', NO_COMPANY_LABEL]);
  });
});

describe('buildInGameUnits — officers', () => {
  it('attaches the officer who held a company slot', () => {
    const [usa] = build(PLAYERS, ROSTER, [
      officer({ name: 'Abe', regiment: '20th Maine', company: 'A Company', rank: 'Captain' }),
    ]);
    expect(usa.regiments[0].companies[0].officers).toEqual([{ name: 'Abe', rank: 'Captain' }]);
    expect(usa.regiments[0].companies[1].officers).toEqual([]);
  });

  it('counts an officer once however many stints he served', () => {
    const stint = { regiment: '20th Maine', company: 'A Company', rank: 'Captain' };
    const [usa] = build(PLAYERS, ROSTER, [
      officer({ name: 'Abe', ...stint }),
      officer({ name: 'Abe', ...stint }),
      officer({ name: 'Ben', ...stint, rank: null }),
    ]);
    expect(usa.regiments[0].companies[0].officers).toEqual([
      { name: 'Abe', rank: 'Captain' },
      { name: 'Ben', rank: null },
    ]);
  });

  it('falls back to the roster for command rows that name no unit', () => {
    // Pre-July-2026 scoreboards name only the officer.
    const [usa] = build(PLAYERS, ROSTER, [officer({ name: 'Cal' })]);
    expect(usa.regiments[0].companies[1].officers).toEqual([{ name: 'Cal', rank: null }]);
  });
});

describe('filterInGameUnits', () => {
  const tree = build();

  it('returns the tree untouched for a blank query', () => {
    expect(filterInGameUnits(tree, '  ')).toBe(tree);
  });

  it('keeps a whole unit when the unit name matches', () => {
    const [usa] = filterInGameUnits(tree, '20th maine');
    expect(usa.regiments.map((r) => r.label)).toEqual(['20th Maine']);
    expect(usa.regiments[0].visible.map((p) => p.name)).toEqual(['Abe', 'Ben', 'Cal']);
  });

  it('keeps one company when the company name matches', () => {
    const [usa] = filterInGameUnits(tree, 'co. b');
    expect(usa.regiments[0].companies.map((c) => c.label)).toEqual(['Co. B']);
  });

  it('narrows to the man a name or steam id matches', () => {
    const [usa] = filterInGameUnits(tree, 'ben');
    expect(usa.regiments[0].visible.map((p) => p.name)).toEqual(['Ben']);
    expect(filterInGameUnits(tree, 's3')[0].regiments[0].visible.map((p) => p.name)).toEqual(['Cal']);
  });

  it('leaves every unit its own full figures, not the search subset', () => {
    const [usa] = filterInGameUnits(tree, 'ben');
    expect(usa.regiments[0].agg.kills).toBe(7);
    expect(usa.regiments[0].players).toHaveLength(3);
  });

  it('drops the sides that match nothing', () => {
    expect(filterInGameUnits(tree, 'battery').map((t) => t.team)).toEqual(['CSA']);
    expect(filterInGameUnits(tree, 'nobody')).toEqual([]);
  });
});

describe('companyLabel', () => {
  it('reads a bare company as "Co. X" and leaves a named one alone', () => {
    expect(companyLabel('A Company')).toBe('Co. A');
    expect(companyLabel('1st')).toBe('Co. 1st');
    expect(companyLabel('Color Guard')).toBe('Color Guard');
    expect(companyLabel(null)).toBe(NO_COMPANY_LABEL);
  });
});

describe('allUnitKeys', () => {
  it('lists every regiment and company key, team-prefixed', () => {
    const keys = allUnitKeys(build());
    expect(keys.regiments).toHaveLength(4); // 20th Maine, Unenlisted, Battery A, unrostered
    // The flat regiments keep a company node of their own, so: Co. A, Co. B,
    // the Unenlisted bucket, the battery's Co. A, the unrostered bucket.
    expect(keys.companies).toHaveLength(5);
    expect(new Set(keys.regiments).size).toBe(keys.regiments.length);
    expect(keys.regiments.every((k) => k.startsWith('USA::') || k.startsWith('CSA::'))).toBe(true);
  });
});
