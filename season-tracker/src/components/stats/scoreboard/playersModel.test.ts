import { describe, it, expect } from 'vitest';
import type { ScoreboardPlayer, Kill } from '../../../stats/types';
import {
  buildKillStanceIndex,
  killStanceOf,
  buildCauseIndex,
  killedWithOf,
  diedToOf,
  groupByRegiment,
  sumKD,
  comparePlayers,
  playerKey,
  playerMatches,
} from './playersModel';
import type { RegimentResolver } from './playersModel';

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

const alpha = player({ steamId: 's1', name: 'Alpha', kills: 3, deaths: 1, kd: 3, deathsInForm: 1 });
const bravo = player({ steamId: 's2', name: 'Bravo', kills: 1, deaths: 2, kd: 0.5, deathsSkirm: 2 });
const charlie = player({ steamId: null, name: 'Charlie', kills: 0, deaths: 1, kd: 0, deathsOob: 1 });

const kill = (over: Partial<Kill>): Kill => ({
  tsInRound: '00:00:00',
  killer: null,
  killerSteamId: null,
  killerTeam: null,
  victim: 'x',
  victimSteamId: null,
  victimTeam: null,
  victimFormation: null,
  cause: 'Minie',
  cat: 0,
  sub: 0,
  ...over,
});

const kills: Kill[] = [
  kill({ killer: 'Alpha', killerSteamId: 's1', victimFormation: 'in_form' }),
  kill({ killer: 'Alpha', killerSteamId: 's1', victimFormation: 'skirm' }),
  kill({ killer: 'Alpha', killerSteamId: 's1', victimFormation: 'skirm' }),
  kill({ killer: 'Charlie', killerSteamId: null, victimFormation: 'oob' }),
  kill({ killer: null, killerSteamId: null, victimFormation: 'oob' }), // environment — ignored
];

describe('playersModel — kill stance index', () => {
  it('buckets a steam-id killer by victim formation', () => {
    const idx = buildKillStanceIndex(kills);
    expect(killStanceOf(alpha, idx)).toEqual({ inForm: 1, skirm: 2, oob: 0 });
  });

  it('matches a steamless killer by name and ignores environment kills', () => {
    const idx = buildKillStanceIndex(kills);
    expect(killStanceOf(charlie, idx)).toEqual({ inForm: 0, skirm: 0, oob: 1 });
  });

  it('returns the empty stance for a player with no kills', () => {
    const idx = buildKillStanceIndex(kills);
    expect(killStanceOf(bravo, idx)).toEqual({ inForm: 0, skirm: 0, oob: 0 });
  });
});

describe('playersModel — cause index', () => {
  // Alpha (s1): kills Bravo/Zed with Minie, Charlie with Bayonet; dies to Bayonet.
  // Charlie (steamless): kills Alpha with Bayonet. Bravo (s2): kills Zed with an
  // empty cause (→ unknown) and dies to a killer-less environment "Fall damage".
  const causeKills: Kill[] = [
    kill({ killer: 'Alpha', killerSteamId: 's1', victim: 'Bravo', victimSteamId: 's2', cause: 'Minie' }),
    kill({ killer: 'Alpha', killerSteamId: 's1', victim: 'Zed', victimSteamId: 's9', cause: 'Minie' }),
    kill({ killer: 'Alpha', killerSteamId: 's1', victim: 'Charlie', victimSteamId: null, cause: 'Bayonet' }),
    kill({ killer: 'Charlie', killerSteamId: null, victim: 'Alpha', victimSteamId: 's1', cause: 'Bayonet' }),
    kill({ killer: null, killerSteamId: null, victim: 'Bravo', victimSteamId: 's2', cause: 'Fall damage' }),
    kill({ killer: 'Bravo', killerSteamId: 's2', victim: 'Zed', victimSteamId: 's9', cause: '' }),
  ];

  it('breaks down "killed with" per killer (steam id, then name)', () => {
    const idx = buildCauseIndex(causeKills);
    expect(killedWithOf(alpha, idx)).toEqual({ Minie: 2, Bayonet: 1 });
    expect(killedWithOf(charlie, idx)).toEqual({ Bayonet: 1 });
  });

  it('labels an empty cause as "unknown"', () => {
    const idx = buildCauseIndex(causeKills);
    expect(killedWithOf(bravo, idx)).toEqual({ unknown: 1 });
  });

  it('breaks down "died to", including killer-less environment deaths', () => {
    const idx = buildCauseIndex(causeKills);
    expect(diedToOf(alpha, idx)).toEqual({ Bayonet: 1 });
    expect(diedToOf(bravo, idx)).toEqual({ Minie: 1, 'Fall damage': 1 });
    expect(diedToOf(charlie, idx)).toEqual({ Bayonet: 1 });
  });

  it('returns an empty breakdown for a player who neither killed nor died', () => {
    const idx = buildCauseIndex(causeKills);
    const ghost = player({ steamId: 's404', name: 'Ghost' });
    expect(killedWithOf(ghost, idx)).toEqual({});
    expect(diedToOf(ghost, idx)).toEqual({});
  });
});

describe('playersModel — regiment grouping', () => {
  it('groups by resolved regiment with untagged pinned last', () => {
    const resolve: RegimentResolver = (_s, name) => (name === 'Charlie' ? null : 'R1');
    const groups = groupByRegiment([alpha, bravo, charlie], resolve);
    expect(groups.map((g) => g.regiment)).toEqual(['R1', null]);
    expect(groups[0].players.map((p) => p.name)).toEqual(['Alpha', 'Bravo']);
    expect(groups[1].players.map((p) => p.name)).toEqual(['Charlie']);
  });

  it('orders regiments by player count, descending', () => {
    const resolve: RegimentResolver = (_s, name) => (name === 'Alpha' ? 'Solo' : 'Pair');
    const groups = groupByRegiment([alpha, bravo, charlie], resolve);
    expect(groups.map((g) => g.regiment)).toEqual(['Pair', 'Solo']);
  });
});

describe('playersModel — aggregation & sorting', () => {
  it('sums kills/deaths and kill formations across a unit', () => {
    const idx = buildKillStanceIndex(kills);
    const agg = sumKD([alpha, bravo], (p) => killStanceOf(p, idx));
    expect(agg).toMatchObject({ kills: 4, deaths: 3, inForm: 1, skirm: 2, oob: 0, killInForm: 1, killSkirm: 2 });
  });

  it('sorts by the selected key', () => {
    const byKills = [bravo, alpha].sort((a, b) => comparePlayers(a, b, 'kills'));
    expect(byKills.map((p) => p.name)).toEqual(['Alpha', 'Bravo']);
    const byName = [bravo, alpha].sort((a, b) => comparePlayers(a, b, 'name'));
    expect(byName.map((p) => p.name)).toEqual(['Alpha', 'Bravo']);
  });

  it('keys a player by steam id, falling back to name', () => {
    expect(playerKey(alpha)).toBe('s1');
    expect(playerKey(charlie)).toBe('Charlie');
  });
});

describe('playersModel — search matching', () => {
  const resolve: RegimentResolver = (_s, name) => (name === 'Charlie' ? null : '71st NY');

  it('matches every player when the query is blank or whitespace', () => {
    expect(playerMatches(alpha, '', resolve)).toBe(true);
    expect(playerMatches(charlie, '   ', resolve)).toBe(true);
  });

  it('matches on player name, case-insensitively', () => {
    expect(playerMatches(alpha, 'alph', resolve)).toBe(true);
    expect(playerMatches(alpha, 'ALPHA', resolve)).toBe(true);
    expect(playerMatches(bravo, 'alph', resolve)).toBe(false);
  });

  it('matches on the resolved regiment name', () => {
    expect(playerMatches(alpha, '71st', resolve)).toBe(true);
    expect(playerMatches(bravo, 'ny', resolve)).toBe(true);
  });

  it('does not match untagged players on a regiment query', () => {
    expect(playerMatches(charlie, '71st', resolve)).toBe(false);
    expect(playerMatches(charlie, 'charlie', resolve)).toBe(true);
  });
});
