import { describe, it, expect } from 'vitest';
import {
  computeRegimentBreakdown,
  computePlayerLeaderboard,
  computeOverview,
} from './statsEngine';
import { parseScoreboard } from './parseScoreboard';
import {
  normalizeScopedAliases,
  effectiveAliasMap,
  aliasMapBySource,
  buildStatsBundle,
  OVERALL_SCOPE,
} from './statsBundle';
import type { StoredScoreboard } from './StatsRepository';

// Two seasons. In Season 1 the sub-regiments AL and GA fought under one banner,
// "CB" — modeled as Season-1-scoped merge aliases AL→CB, GA→CB. In Season 2 they
// unmerged (no aliases), so each stands on its own.
const S1 = `map,DrillCamp
mode,Skirmish
area,Meadow
winner,CSA

name,team,kills,deaths,kd,deaths_in_form,deaths_skirm,deaths_oob,steam_id
[AL]Joe,2,5,2,2.50,2,0,0,76561198000000001
[GA]Bob,2,4,1,4.00,1,0,0,76561198000000002
`;
const S2 = `map,Antietam
mode,Skirmish
area,Cornfield
winner,USA

name,team,kills,deaths,kd,deaths_in_form,deaths_skirm,deaths_oob,steam_id
[AL]Joe,2,3,1,3.00,1,0,0,76561198000000001
[GA]Bob,2,2,2,1.00,2,0,0,76561198000000002
`;

const sbS1 = parseScoreboard(S1, 'scoreboard_20260101_120000.csv'); // Season 1
const sbS2 = parseScoreboard(S2, 'scoreboard_20260201_120000.csv'); // Season 2 (later)
const boards = [sbS1, sbS2];

// Season-1 boards get the merge; Season-2 boards get nothing.
const S1_ALIASES = { AL: 'CB', GA: 'CB' };
const aliasMapFor = (sb: { sourceFilename: string }) =>
  sb.sourceFilename === sbS1.sourceFilename ? S1_ALIASES : {};

describe('season-scoped Overall regiment resolution (option B)', () => {
  it('aggregates the merged unit across the season(s) it existed, and splits the rest', () => {
    const regs = computeRegimentBreakdown(boards, {}, { aliasMapFor });
    const by = Object.fromEntries(regs.map((r) => [r.regiment, r]));

    // CB exists only in Season 1: both players, their Season-1 kills only.
    expect(by.CB).toBeDefined();
    expect(by.CB.players).toBe(2);
    expect(by.CB.kills).toBe(9); // Joe 5 + Bob 4 (Season 1)

    // The unmerged regiments appear on their own with their Season-2 numbers.
    expect(by.AL.players).toBe(1);
    expect(by.AL.kills).toBe(3); // Joe (Season 2)
    expect(by.GA.players).toBe(1);
    expect(by.GA.kills).toBe(2); // Bob (Season 2)

    // No leakage: the Season-1 merge did not rewrite Season 2.
    expect(regs.map((r) => r.regiment).sort()).toEqual(['AL', 'CB', 'GA']);
  });

  it('splits a single player across the labels they held each season', () => {
    const regs = computeRegimentBreakdown(boards, {}, { aliasMapFor });
    const cb = regs.find((r) => r.regiment === 'CB')!;
    const al = regs.find((r) => r.regiment === 'AL')!;
    // Joe shows up under CB (Season 1) and under AL (Season 2), with the right
    // per-season kills in each.
    expect(cb.topPlayers.find((p) => p.steamId === '76561198000000001')!.kills).toBe(5);
    expect(al.topPlayers.find((p) => p.steamId === '76561198000000001')!.kills).toBe(3);
  });

  it('counts every distinct regiment that existed in any season', () => {
    const overview = computeOverview(boards, {}, { aliasMapFor });
    expect(overview.distinctRegiments).toBe(3); // CB, AL, GA
  });

  it('resolves a player leaderboard row under the latest season the player played', () => {
    const rows = computePlayerLeaderboard(boards, {}, { aliasMapFor });
    const joe = rows.find((p) => p.steamId === '76561198000000001')!;
    // Joe's most recent round is Season 2, where AL is unmerged.
    expect(joe.regiment).toBe('AL');
    // Career totals still span both seasons.
    expect(joe.kills).toBe(8); // 5 + 3
  });
});

describe('season-scoped steam-id pins (assignmentsFor)', () => {
  it('pins one player to different regiments in different seasons', () => {
    const assignmentsFor = (sb: { sourceFilename: string }) =>
      sb.sourceFilename === sbS1.sourceFilename
        ? { '76561198000000001': 'A' } // Joe → A in Season 1
        : { '76561198000000001': 'B' }; // Joe → B in Season 2
    const regs = computeRegimentBreakdown(boards, {}, { assignmentsFor });
    const by = Object.fromEntries(regs.map((r) => [r.regiment, r]));
    expect(by.A.players).toBe(1);
    expect(by.A.kills).toBe(5); // Joe (Season 1)
    expect(by.B.players).toBe(1);
    expect(by.B.kills).toBe(3); // Joe (Season 2)
    // Bob is unpinned, so his name tag [GA] resolves the same across seasons.
    expect(by.GA.players).toBe(1);
    expect(by.GA.kills).toBe(6); // Bob 4 + 2
  });

  it('falls back to the flat assignments when assignmentsFor yields nothing', () => {
    const regs = computeRegimentBreakdown([sbS1], { '76561198000000002': 'PINNED' }, {});
    const by = Object.fromEntries(regs.map((r) => [r.regiment, r]));
    expect(by.PINNED?.players).toBe(1); // Bob pinned via the flat map
  });
});

describe('single-season view applies the season alias only', () => {
  it('merges within Season 1', () => {
    const regs = computeRegimentBreakdown([sbS1], {}, { aliasMap: effectiveAliasMap({ sea_1: S1_ALIASES }, 'sea_1') });
    expect(regs.map((r) => r.regiment)).toEqual(['CB']);
    expect(regs[0].players).toBe(2);
  });
  it('leaves Season 2 unmerged', () => {
    const regs = computeRegimentBreakdown([sbS2], {}, { aliasMap: effectiveAliasMap({ sea_1: S1_ALIASES }, 'sea_2') });
    expect(regs.map((r) => r.regiment).sort()).toEqual(['AL', 'GA']);
  });
});

describe('scoped alias helpers', () => {
  it('normalizes a legacy flat map into the Overall scope', () => {
    expect(normalizeScopedAliases({ A: 'B' })).toEqual({ [OVERALL_SCOPE]: { A: 'B' } });
    expect(normalizeScopedAliases({})).toEqual({});
    expect(normalizeScopedAliases(undefined)).toEqual({});
  });

  it('passes an already-scoped map through, dropping empty scopes', () => {
    expect(normalizeScopedAliases({ [OVERALL_SCOPE]: { A: 'B' }, sea_1: {} })).toEqual({
      [OVERALL_SCOPE]: { A: 'B' },
    });
  });

  it('layers a season scope over Overall (season wins)', () => {
    const scoped = { [OVERALL_SCOPE]: { A: 'X', B: 'Y' }, sea_1: { A: 'Z' } };
    expect(effectiveAliasMap(scoped, OVERALL_SCOPE)).toEqual({ A: 'X', B: 'Y' });
    expect(effectiveAliasMap(scoped, 'sea_1')).toEqual({ A: 'Z', B: 'Y' });
  });

  it('maps each scoreboard to the alias map of the season it belongs to', () => {
    const stored: StoredScoreboard[] = [
      { id: '1', eventId: 'e', scoreboard: sbS1, binding: { weekId: 'w1', round: 1 } },
      { id: '2', eventId: 'e', scoreboard: sbS2, binding: { weekId: 'w9', round: 1 } },
    ];
    const seasons = [
      { id: 'sea_1', name: 'Season 1', weekIds: ['w1'] },
      { id: 'sea_2', name: 'Season 2', weekIds: ['w9'] },
    ];
    const bySource = aliasMapBySource(stored, seasons, { sea_1: S1_ALIASES });
    expect(bySource.get(sbS1.sourceFilename)).toEqual(S1_ALIASES); // Season 1 → merged
    expect(bySource.get(sbS2.sourceFilename)).toEqual({}); // Season 2 → nothing
  });

  it('falls back to Overall for unbound scoreboards', () => {
    const stored: StoredScoreboard[] = [{ id: '1', eventId: 'e', scoreboard: sbS1 }];
    const bySource = aliasMapBySource(stored, [], { [OVERALL_SCOPE]: { A: 'B' } });
    expect(bySource.get(sbS1.sourceFilename)).toEqual({ A: 'B' });
  });
});

// Mirrors StatsArea's Overall wiring exactly: derive the per-scoreboard alias
// map from stored bindings + seasons + scoped aliases, then feed it to the
// engine as aliasMapFor. Guards the glue between the storage shape and the engine.
describe('StatsArea Overall wiring (aliasMapBySource → computeRegimentBreakdown)', () => {
  it('reproduces option B end-to-end from scoped aliases and season bindings', () => {
    const stored: StoredScoreboard[] = [
      { id: '1', eventId: 'e', scoreboard: sbS1, binding: { weekId: 'w1', round: 1 } },
      { id: '2', eventId: 'e', scoreboard: sbS2, binding: { weekId: 'w9', round: 1 } },
    ];
    const seasons = [
      { id: 'sea_1', name: 'Season 1', weekIds: ['w1'] },
      { id: 'sea_2', name: 'Season 2', weekIds: ['w9'] },
    ];
    // The user renamed/merged AL & GA into CB while viewing Season 1 only.
    const scoped = { sea_1: { AL: 'CB', GA: 'CB' } };

    const bySource = aliasMapBySource(stored, seasons, scoped);
    const overall = effectiveAliasMap(scoped, OVERALL_SCOPE);
    const regs = computeRegimentBreakdown(boards, {}, {
      aliasMapFor: (sb) => bySource.get(sb.sourceFilename) ?? overall,
    });
    const by = Object.fromEntries(regs.map((r) => [r.regiment, r.players]));
    expect(by).toEqual({ CB: 2, AL: 1, GA: 1 });
  });
});

describe('buildStatsBundle carries season-scoped aliases', () => {
  const rec = (sb = sbS1): StoredScoreboard => ({ id: `e::${sb.sourceFilename}`, eventId: 'e', scoreboard: sb });

  it('omits aliasesScoped for an Overall-only event but keeps the flat map', () => {
    const bundle = buildStatsBundle([rec()], {}, {}, [], [], { [OVERALL_SCOPE]: { A: 'B' } });
    expect(bundle.aliases).toEqual({ A: 'B' });
    expect(bundle).not.toHaveProperty('aliasesScoped');
  });

  it('carries aliasesScoped when a season-specific scope exists', () => {
    const scoped = { [OVERALL_SCOPE]: { A: 'B' }, sea_1: S1_ALIASES };
    const bundle = buildStatsBundle([rec()], {}, {}, [], [], scoped);
    expect(bundle.aliases).toEqual({ A: 'B' }); // Overall carried flat for old viewers
    expect(bundle.aliasesScoped).toEqual(scoped); // full structure for new viewers
  });

  it('carries assignmentsScoped when a season-specific pin exists', () => {
    const scopedAsg = { [OVERALL_SCOPE]: { '1': 'A' }, sea_1: { '2': 'B' } };
    const bundle = buildStatsBundle([rec()], {}, {}, [], [], undefined, scopedAsg);
    expect(bundle.assignments).toEqual({ '1': 'A' }); // Overall pins flat for old viewers
    expect(bundle.assignmentsScoped).toEqual(scopedAsg);
  });

  it('omits assignmentsScoped for an Overall-only event', () => {
    const bundle = buildStatsBundle([rec()], { '1': 'A' });
    expect(bundle.assignments).toEqual({ '1': 'A' });
    expect(bundle).not.toHaveProperty('assignmentsScoped');
  });
});
