import { describe, it, expect } from 'vitest';
import type { ScoreboardPlayer, Kill } from '../../../stats/types';
import {
  buildKillStanceIndex,
  killStanceOf,
  groupByRegiment,
  sumKD,
  comparePlayers,
  playerKey,
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
