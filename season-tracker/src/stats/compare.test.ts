import { describe, it, expect } from 'vitest';
import { comparePlayers, compareRegiments, compareVerdict } from './compare';
import { spineRow } from '../components/ui/spineModel';
import type { PlayerStatRow, RegimentStatRow } from './statsEngine';

const player = (over: Partial<PlayerStatRow> = {}): PlayerStatRow => ({
  key: 'k',
  steamId: null,
  name: 'x',
  regiment: '1stTX',
  inGameRegiment: null,
  branch: 'Infantry',
  team: 'USA',
  rounds: 10,
  kills: 100,
  deaths: 50,
  kd: 2,
  deathsInForm: 30,
  deathsSkirm: 15,
  deathsOob: 5,
  killsInForm: 60,
  killsSkirm: 30,
  killsOob: 10,
  avgTd: 2.0,
  avgTk: 2.0,
  ...over,
});

const unit = (over: Partial<RegimentStatRow> = {}): RegimentStatRow => ({
  regiment: '1stTX',
  players: 12,
  avgPlayers: 4,
  rounds: 10,
  kills: 200,
  deaths: 100,
  kd: 2,
  casualtiesByFormation: { in_form: 60, skirm: 30, oob: 10 },
  killsByFormation: { in_form: 120, skirm: 60, oob: 20 },
  avgTd: 2.0,
  avgTk: 2.0,
  killRate: 5,
  lossRate: 2.5,
  casualtiesByCause: {},
  killsByCause: {},
  topPlayers: [],
  roundFilenames: [],
  perRound: [],
  ...over,
});

const row = (rows: ReturnType<typeof comparePlayers>, label: string) =>
  rows.find((r) => r.label === label);

describe('comparePlayers', () => {
  it('gives volume rows to the bigger number', () => {
    const rows = comparePlayers(player({ kills: 238 }), player({ kills: 209 }));
    expect(spineRow(row(rows, 'Kills')!).winner).toBe('a');
  });

  it('gives deaths to the side that died less', () => {
    const rows = comparePlayers(player({ deaths: 37 }), player({ deaths: 18 }));
    expect(spineRow(row(rows, 'Deaths')!).winner).toBe('b');
  });

  it('gives cost per death to the cheaper side', () => {
    const rows = comparePlayers(player({ avgTd: 2.6 }), player({ avgTd: 1.9 }));
    const r = row(rows, 'Cost per death')!;
    expect(spineRow(r).winner).toBe('b');
    expect(r.aText).toBe('2.6');
  });

  it('gives value per kill to the higher side', () => {
    const rows = comparePlayers(player({ avgTk: 2.3 }), player({ avgTk: 2.6 }));
    expect(spineRow(row(rows, 'Value per kill')!).winner).toBe('b');
  });

  it('omits a ticket row when either side has never recorded one', () => {
    const rows = comparePlayers(player({ avgTd: null }), player({ avgTd: 2.1 }));
    expect(row(rows, 'Cost per death')).toBeUndefined();
    // The other ticket metric still compares.
    expect(row(rows, 'Value per kill')).toBeDefined();
  });

  it('normalises volume by rounds played', () => {
    const rows = comparePlayers(
      player({ kills: 100, rounds: 10 }), // 10.0 a round
      player({ kills: 60, rounds: 4 }), // 15.0 a round
    );
    expect(spineRow(row(rows, 'Kills')!).winner).toBe('a');
    expect(spineRow(row(rows, 'Kills per round')!).winner).toBe('b');
  });

  it('omits per-round rows for someone with no rounds', () => {
    const rows = comparePlayers(player({ rounds: 0, kills: 0 }), player());
    expect(row(rows, 'Kills per round')).toBeUndefined();
  });

  it('reads stance shares off each side’s own total, not the other’s', () => {
    const rows = comparePlayers(
      player({ deaths: 10, deathsInForm: 8, deathsOob: 1 }),
      player({ deaths: 100, deathsInForm: 50, deathsOob: 40 }),
    );
    expect(row(rows, 'Died in formation')!.aText).toBe('80%');
    expect(row(rows, 'Died in formation')!.bText).toBe('50%');
    expect(spineRow(row(rows, 'Died out of line')!).winner).toBe('a'); // 10% vs 40%
  });

  it('does not divide by zero for a player who never died', () => {
    const rows = comparePlayers(player({ deaths: 0, deathsInForm: 0, deathsOob: 0 }), player());
    expect(row(rows, 'Died in formation')!.aText).toBe('0%');
  });
});

describe('compareRegiments', () => {
  it('separates raw volume from size-normalised rate', () => {
    const rows = compareRegiments(
      unit({ kills: 200, killRate: 4 }), // big unit, ordinary men
      unit({ kills: 120, killRate: 9 }), // small unit, good men
    );
    expect(spineRow(row(rows, 'Kills')!).winner).toBe('a');
    expect(spineRow(row(rows, 'Kills per man')!).winner).toBe('b');
  });

  it('gives losses per man to the side that bled less', () => {
    const rows = compareRegiments(unit({ lossRate: 4.9 }), unit({ lossRate: 2.4 }));
    expect(spineRow(row(rows, 'Losses per man')!).winner).toBe('b');
  });

  it('omits rate rows for a unit that never fielded anyone', () => {
    const rows = compareRegiments(unit({ killRate: null, lossRate: null }), unit());
    expect(row(rows, 'Kills per man')).toBeUndefined();
    expect(row(rows, 'Losses per man')).toBeUndefined();
  });

  it('computes discipline off the formation counts', () => {
    const rows = compareRegiments(
      unit({ casualtiesByFormation: { in_form: 50, skirm: 30, oob: 20 } }),
      unit({ casualtiesByFormation: { in_form: 70, skirm: 20, oob: 10 } }),
    );
    expect(row(rows, 'Held the line')!.aText).toBe('50%');
    expect(spineRow(row(rows, 'Held the line')!).winner).toBe('b');
    expect(spineRow(row(rows, 'Caught out of line')!).winner).toBe('b');
  });

  it('survives a unit with no recorded casualties', () => {
    const rows = compareRegiments(unit({ casualtiesByFormation: { in_form: 0, skirm: 0, oob: 0 } }), unit());
    expect(row(rows, 'Held the line')!.aText).toBe('0%');
  });
});

describe('compareVerdict', () => {
  it('names the leader and the margin', () => {
    const rows = comparePlayers(
      player({ kills: 300, deaths: 10, kd: 30, avgTd: 1.2, avgTk: 3 }),
      player({ kills: 50, deaths: 90, kd: 0.55, avgTd: 3.4, avgTk: 1.2 }),
    );
    const v = compareVerdict(rows, 'Sturgis', 'Barlow');
    expect(v.leader).toBe('a');
    expect(v.summary).toContain('Sturgis takes');
    expect(v.aWins + v.bWins + v.tied).toBe(rows.length);
  });

  it('calls an even split a split, naming both', () => {
    const v = compareVerdict(
      [
        { label: 'a', a: 2, b: 1 },
        { label: 'b', a: 1, b: 2 },
      ],
      'Ash',
      'Bex',
    );
    expect(v.leader).toBeNull();
    expect(v.summary).toContain('Ash and Bex split it 1–1');
  });

  it('mentions ties in a split', () => {
    const v = compareVerdict(
      [
        { label: 'a', a: 2, b: 1 },
        { label: 'b', a: 1, b: 2 },
        { label: 'c', a: 5, b: 5 },
      ],
      'Ash',
      'Bex',
    );
    expect(v.tied).toBe(1);
    expect(v.summary).toContain('with 1 tied');
  });

  it('says so when there is nothing to compare', () => {
    const v = compareVerdict([], 'Ash', 'Bex');
    expect(v.leader).toBeNull();
    expect(v.summary).toContain('Not enough shared data');
  });

  it('compares two identical players to an all-tie split', () => {
    const rows = comparePlayers(player(), player());
    const v = compareVerdict(rows, 'Ash', 'Bex');
    expect(v.aWins).toBe(0);
    expect(v.bWins).toBe(0);
    expect(v.tied).toBe(rows.length);
  });
});
