import { describe, it, expect } from 'vitest';
import type {
  ScoreboardPlayer,
  RosterEntry,
  ServiceStint,
  ScoreboardOfficer,
} from '../../../stats/types';
import { EMPTY_STANCE, type KillStance } from './playersModel';
import {
  buildInGameUnits,
  filterInGameUnits,
  allUnitKeys,
  companyLabel,
  apportion,
  NO_UNIT_LABEL,
  NO_COMPANY_LABEL,
  type InGameTeamNode,
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

const stint = (over: Partial<ServiceStint> & { name: string }): ServiceStint => ({
  team: 'USA',
  regiment: null,
  company: null,
  className: null,
  rank: null,
  start: null,
  end: null,
  durationS: null,
  pctRound: null,
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
// Unenlisted man and one player neither section mentions.
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
// Everyone's postings match the roster, except that Ben spent three quarters of
// the round in Co. A and the last quarter in Co. B. The Unenlisted hold no
// posting, so the service log never mentions Eli.
const SERVICE: ServiceStint[] = [
  stint({ name: 'Abe', steamId: 's1', regiment: '20th Maine', company: 'A Company', durationS: 1000, pctRound: 100 }),
  stint({ name: 'Ben', steamId: 's2', regiment: '20th Maine', company: 'A Company', durationS: 750, pctRound: 75 }),
  stint({ name: 'Ben', steamId: 's2', regiment: '20th Maine', company: 'B Company', durationS: 250, pctRound: 25 }),
  stint({ name: 'Cal', steamId: 's3', regiment: '20th Maine', company: 'B Company', durationS: 1000, pctRound: 100 }),
  stint({ name: 'Dix', steamId: 's4', team: 'CSA', regiment: 'Battery A', company: 'A Company', durationS: 1000, pctRound: 100 }),
];
const PLAYERS = [abe, ben, cal, dix, eli, ghost];

const build = (
  players = PLAYERS,
  roster = ROSTER,
  service = SERVICE,
  officers: ScoreboardOfficer[] = [],
  stance = noStance,
  roundDurationS: number | null = 1000,
) => buildInGameUnits(players, roster, service, officers, stance, roundDurationS);

const teams = (...args: Parameters<typeof build>): InGameTeamNode[] => build(...args).teams;
const names = (ms: { player: ScoreboardPlayer }[]) => ms.map((m) => m.player.name);

describe('buildInGameUnits — the tree', () => {
  it('nests team → regiment → company off the service log', () => {
    const [usa, csa] = teams();
    expect(usa.team).toBe('USA');
    expect(usa.regiments.map((r) => r.label)).toEqual(['20th Maine', 'Unenlisted']);
    expect(usa.regiments[0].companies.map((c) => c.label)).toEqual(['Co. A', 'Co. B']);
    expect(csa.regiments.map((r) => r.label)).toEqual(['Battery A', NO_UNIT_LABEL]);
    expect(build().source).toBe('service');
  });

  it('reads a regiment as its arm of service', () => {
    const [usa, csa] = teams();
    expect(usa.regiments[0].branch).toBe('Infantry');
    expect(csa.regiments[0].branch).toBe('Artillery');
  });

  it('places a man neither section mentions under his scoreboard team', () => {
    const [, csa] = teams();
    const unknown = csa.regiments.find((r) => r.regiment == null)!;
    expect(names(unknown.members)).toEqual(['Ghost']);
    expect(unknown.flat).toBe(true);
  });

  it('falls back to the roster for a man with no postings, like the Unenlisted', () => {
    const [usa] = teams();
    const unenlisted = usa.regiments.find((r) => r.label === 'Unenlisted')!;
    expect(names(unenlisted.members)).toEqual(['Eli']);
    expect(unenlisted.flat).toBe(true);
    expect(unenlisted.companies[0].label).toBe(NO_COMPANY_LABEL);
  });

  it('follows the posting team, not the scoreboard row, when they disagree', () => {
    const turncoat = player({ name: 'Turncoat', steamId: 's9', team: 'USA' });
    const [csa] = teams([turncoat], [], [
      stint({ name: 'Turncoat', steamId: 's9', team: 'CSA', regiment: '1st Texas', company: 'A Company' }),
    ]);
    expect(csa.team).toBe('CSA');
    expect(csa.regiments[0].label).toBe('1st Texas');
  });
});

describe('buildInGameUnits — everyone who served', () => {
  it('lists a man under every company he served in, not just his last', () => {
    const [usa] = teams();
    const [coA, coB] = usa.regiments[0].companies;
    expect(names(coA.members)).toEqual(['Abe', 'Ben']);
    expect(names(coB.members).sort()).toEqual(['Ben', 'Cal']);
  });

  it('counts a company by who served, and remembers who was left at the end', () => {
    const [usa] = teams();
    const [coA, coB] = usa.regiments[0].companies;
    expect(coA.served).toBe(2);
    expect(coB.served).toBe(2);
    // Ben's roster row — where he ended — is Co. A, so Co. B keeps only Cal.
    expect(coA.atEnd).toBe(2);
    expect(coB.atEnd).toBe(1);
  });

  it('counts man-rounds, so a man who served a quarter of the round is a quarter', () => {
    const [usa] = teams();
    const [coA, coB] = usa.regiments[0].companies;
    expect(coA.strength).toBeCloseTo(1.75); // Abe 1.0 + Ben 0.75
    expect(coB.strength).toBeCloseTo(1.25); // Cal 1.0 + Ben 0.25
  });

  it('never counts a man twice in the rollups', () => {
    const [usa] = teams();
    const maine = usa.regiments[0];
    // Ben served both companies, so the regiment holds four postings but three
    // men — and its figures are the three men's, not four helpings of them.
    expect(maine.members).toHaveLength(4);
    expect(maine.served).toBe(3);
    expect(maine.strength).toBeCloseTo(3);
    expect(maine.agg.kills).toBe(abe.kills + ben.kills + cal.kills);
    expect(maine.agg.deaths).toBe(abe.deaths + ben.deaths + cal.deaths);
  });

  it('reports how many men were split across postings', () => {
    expect(build().splitMen).toBe(1);
    expect(build(PLAYERS, ROSTER, []).splitMen).toBe(0);
  });
});

describe('buildInGameUnits — dividing a mover\'s round', () => {
  it('gives a man who held one posting his whole round, untouched', () => {
    const [usa] = teams();
    const abeM = usa.regiments[0].companies[0].members.find((m) => m.player.name === 'Abe')!;
    expect(abeM.split).toBe(false);
    expect(abeM.agg).toMatchObject({ kills: 4, deaths: 1, inForm: 1 });
  });

  it('divides a mover\'s figures by the time he served in each', () => {
    const [usa] = teams();
    const [coA, coB] = usa.regiments[0].companies;
    const inA = coA.members.find((m) => m.player.name === 'Ben')!;
    const inB = coB.members.find((m) => m.player.name === 'Ben')!;
    expect(inA.split).toBe(true);
    // 2 kills over 750s/250s: one and a half each way, the odd one to the longer.
    expect(inA.agg.kills + inB.agg.kills).toBe(ben.kills);
    expect(inA.agg.kills).toBe(2);
    expect(inB.agg.kills).toBe(0);
    // 2 skirmish deaths split 75/25 gives the second to Co. A as well.
    expect(inA.agg.deaths + inB.agg.deaths).toBe(ben.deaths);
    expect(inA.agg.skirm + inB.agg.skirm).toBe(ben.deathsSkirm);
    expect(inA.roundKills).toBe(2);
  });

  it('divides the kill stances that drive ×Tk too', () => {
    const [usa] = teams(PLAYERS, ROSTER, SERVICE, [], stanceBy({
      Ben: { inForm: 4, skirm: 0, oob: 0 },
    }));
    const [coA, coB] = usa.regiments[0].companies;
    const inA = coA.members.find((m) => m.player.name === 'Ben')!;
    const inB = coB.members.find((m) => m.player.name === 'Ben')!;
    expect(inA.agg.killInForm).toBe(3);
    expect(inB.agg.killInForm).toBe(1);
  });

  it('keeps a mover with the posting he came by first when no times were recorded', () => {
    const drifter = player({ name: 'Drifter', steamId: 'd1', kills: 5, deaths: 2 });
    const [usa] = teams([drifter], [], [
      stint({ name: 'Drifter', steamId: 'd1', regiment: '1st', company: 'A Company' }),
      stint({ name: 'Drifter', steamId: 'd1', regiment: '1st', company: 'B Company' }),
    ], [], noStance, null);
    const [coA, coB] = usa.regiments[0].companies;
    expect(coA.agg.kills).toBe(5);
    expect(coB.agg.kills).toBe(0);
    // Both companies still know he was there.
    expect(coA.served).toBe(1);
    expect(coB.served).toBe(1);
  });

  it('merges repeat stints in one company into a single membership', () => {
    const back = player({ name: 'Back', steamId: 'b1', kills: 4 });
    const [usa] = teams([back], [], [
      stint({ name: 'Back', steamId: 'b1', regiment: '1st', company: 'A Company', durationS: 300, pctRound: 30 }),
      stint({ name: 'Back', steamId: 'b1', regiment: '1st', company: 'B Company', durationS: 400, pctRound: 40 }),
      stint({ name: 'Back', steamId: 'b1', regiment: '1st', company: 'A Company', durationS: 300, pctRound: 30 }),
    ]);
    const [coA, coB] = usa.regiments[0].companies;
    expect(coA.served).toBe(1);
    expect(coA.members[0].posting.stints).toBe(2);
    expect(coA.members[0].posting.durationS).toBe(600);
    expect(coA.strength).toBeCloseTo(0.6);
    expect(coA.agg.kills + coB.agg.kills).toBe(4);
    expect(coA.agg.kills).toBe(2); // 600s of 1000s served
  });
});

describe('buildInGameUnits — without a service log', () => {
  const noService = () => build(PLAYERS, ROSTER, []);

  it('falls back to the roster and says so', () => {
    expect(noService().source).toBe('roster');
    expect(build([ghost], [], []).source).toBe('none');
  });

  it('reads exactly as the roster snapshot did', () => {
    const [usa] = noService().teams;
    const [coA, coB] = usa.regiments[0].companies;
    expect(names(coA.members)).toEqual(['Abe', 'Ben']);
    expect(names(coB.members)).toEqual(['Cal']);
    expect(coA.agg.kills).toBe(6);
  });

  it('counts a man with no recorded time as a whole man', () => {
    const [usa] = noService().teams;
    expect(usa.regiments[0].companies[0].strength).toBe(2);
  });
});

describe('buildInGameUnits — figures', () => {
  it('rolls companies up into the regiment and the regiments into the side', () => {
    const [usa] = teams();
    const maine = usa.regiments[0];
    expect(maine.companies.reduce((s, c) => s + c.agg.kills, 0)).toBe(maine.agg.kills);
    expect(usa.agg.kills).toBe(7); // Eli scored nothing
    expect(usa.agg.deaths).toBe(5); // + Eli
  });

  it('carries the team ticket denominators for the TDI / TDR shares', () => {
    const [usa] = teams(PLAYERS, ROSTER, SERVICE, [], stanceBy({
      Abe: { inForm: 4, skirm: 0, oob: 0 },
      Ben: { inForm: 0, skirm: 2, oob: 0 },
      Cal: { inForm: 0, skirm: 0, oob: 1 },
    }));
    // Inflicted: 4·1 + 2·3 + 1·5 = 15. Received: Abe 1·1 + Ben 2·3 + Cal 1·5 + Eli 1·1 = 13.
    expect(usa.ticketInflicted).toBe(15);
    expect(usa.ticketReceived).toBe(13);
  });
});

describe('buildInGameUnits — order', () => {
  it('puts the biggest regiment first and pins the non-units to the end', () => {
    const [usa, csa] = teams();
    expect(usa.regiments.map((r) => r.label)).toEqual(['20th Maine', 'Unenlisted']);
    expect(csa.regiments.at(-1)!.label).toBe(NO_UNIT_LABEL);
  });

  it('orders companies naturally, with the company-less last', () => {
    const [usa] = teams(
      [player({ name: 'a' }), player({ name: 'b' }), player({ name: 'c' })],
      [seat({ name: 'c', regiment: '1st' })],
      [
        stint({ name: 'a', regiment: '1st', company: '10th Company' }),
        stint({ name: 'b', regiment: '1st', company: '2nd Company' }),
      ],
    );
    expect(usa.regiments[0].companies.map((c) => c.label)).toEqual(['Co. 2nd', 'Co. 10th', NO_COMPANY_LABEL]);
  });
});

describe('buildInGameUnits — officers', () => {
  it('attaches the officer who held a company slot', () => {
    const [usa] = teams(PLAYERS, ROSTER, SERVICE, [
      officer({ name: 'Abe', regiment: '20th Maine', company: 'A Company', rank: 'Captain' }),
    ]);
    expect(usa.regiments[0].companies[0].officers).toEqual([{ name: 'Abe', rank: 'Captain' }]);
    expect(usa.regiments[0].companies[1].officers).toEqual([]);
  });

  it('counts an officer once however many stints he served', () => {
    const held = { regiment: '20th Maine', company: 'A Company', rank: 'Captain' };
    const [usa] = teams(PLAYERS, ROSTER, SERVICE, [
      officer({ name: 'Abe', ...held }),
      officer({ name: 'Abe', ...held }),
      officer({ name: 'Ben', ...held, rank: null }),
    ]);
    expect(usa.regiments[0].companies[0].officers).toEqual([
      { name: 'Abe', rank: 'Captain' },
      { name: 'Ben', rank: null },
    ]);
  });

  it('falls back to the roster for command rows that name no unit', () => {
    const [usa] = teams(PLAYERS, ROSTER, SERVICE, [officer({ name: 'Cal' })]);
    expect(usa.regiments[0].companies[1].officers).toEqual([{ name: 'Cal', rank: null }]);
  });
});

describe('apportion', () => {
  it('divides a whole count by weight without inventing or losing any', () => {
    expect(apportion(10, [1, 1])).toEqual([5, 5]);
    expect(apportion(10, [3, 1])).toEqual([8, 2]); // 7.5 / 2.5, the odd one to the first
    expect(apportion(7, [1, 1, 1])).toEqual([3, 2, 2]);
    expect(apportion(1, [750, 250])).toEqual([1, 0]);
    expect(apportion(0, [1, 2])).toEqual([0, 0]);
  });

  it('leaves it all with the first posting when nothing can be weighed', () => {
    expect(apportion(5, [0, 0])).toEqual([5, 0]);
  });
});

describe('filterInGameUnits', () => {
  const tree = teams();

  it('returns the tree untouched for a blank query', () => {
    expect(filterInGameUnits(tree, '  ')).toBe(tree);
  });

  it('keeps a whole unit when the unit name matches', () => {
    const [usa] = filterInGameUnits(tree, '20th maine');
    expect(usa.regiments.map((r) => r.label)).toEqual(['20th Maine']);
    expect(names(usa.regiments[0].visible).sort()).toEqual(['Abe', 'Ben', 'Ben', 'Cal']);
  });

  it('keeps one company when the company name matches', () => {
    const [usa] = filterInGameUnits(tree, 'co. b');
    expect(usa.regiments[0].companies.map((c) => c.label)).toEqual(['Co. B']);
  });

  it('narrows to the man a name or steam id matches, in every unit he served', () => {
    const [usa] = filterInGameUnits(tree, 'ben');
    expect(usa.regiments[0].companies.map((c) => c.label)).toEqual(['Co. A', 'Co. B']);
    expect(names(usa.regiments[0].visible)).toEqual(['Ben', 'Ben']);
    expect(names(filterInGameUnits(tree, 's3')[0].regiments[0].visible)).toEqual(['Cal']);
  });

  it('leaves every unit its own full figures, not the search subset', () => {
    const [usa] = filterInGameUnits(tree, 'ben');
    expect(usa.regiments[0].agg.kills).toBe(7);
    expect(usa.regiments[0].served).toBe(3);
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
    const keys = allUnitKeys(teams());
    expect(keys.regiments).toHaveLength(4); // 20th Maine, Unenlisted, Battery A, unrostered
    // The flat regiments keep a company node of their own, so: Co. A, Co. B,
    // the Unenlisted bucket, the battery's Co. A, the unrostered bucket.
    expect(keys.companies).toHaveLength(5);
    expect(new Set(keys.regiments).size).toBe(keys.regiments.length);
    expect(keys.regiments.every((k) => k.startsWith('USA::') || k.startsWith('CSA::'))).toBe(true);
  });
});
