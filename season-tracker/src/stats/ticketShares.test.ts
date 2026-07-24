import { describe, it, expect } from 'vitest';
import { computeRegimentTicketShares, computeTokenTicketShares } from './statsEngine';
import type { Scoreboard, ScoreboardPlayer, Kill, ScoreboardMeta, Team, Formation } from './types';

function mkPlayer(
  name: string,
  team: Team,
  form: { inForm?: number; skirm?: number; oob?: number } = {},
): ScoreboardPlayer {
  const deaths = (form.inForm ?? 0) + (form.skirm ?? 0) + (form.oob ?? 0);
  return {
    name,
    team,
    kills: 0,
    deaths,
    kd: 0,
    deathsInForm: form.inForm ?? 0,
    deathsSkirm: form.skirm ?? 0,
    deathsOob: form.oob ?? 0,
    steamId: name,
  };
}

function mkKill(killer: string, victim: string, victimFormation: Formation): Kill {
  return {
    tsInRound: '00:01:00',
    killer,
    killerSteamId: killer,
    killerTeam: null,
    victim,
    victimSteamId: victim,
    victimTeam: null,
    victimFormation,
    cause: 'minie',
    cat: 0,
    sub: 0,
  };
}

function emptyMeta(): ScoreboardMeta {
  const cas = { total: 0, inForm: 0, skirm: 0, oob: 0 };
  return {
    roundStartTime: null,
    roundEndTime: null,
    map: 'Antietam',
    mode: 'Skirmish',
    area: null,
    winner: null,
    popNow: null,
    popRoundStart: null,
    popRoundPeak: null,
    popRoundMax: null,
    popRoundEnd: null,
    moraleUsa: null,
    moraleCsa: null,
    casualties: { USA: { ...cas }, CSA: { ...cas } },
    deathsByWeapon: { USA: {}, CSA: {} },
  };
}

function mkScoreboard(filename: string, players: ScoreboardPlayer[], kills: Kill[]): Scoreboard {
  return {
    sourceFilename: filename,
    recordedAt: null,
    meta: emptyMeta(),
    players,
    officers: [],
    roster: [],
    kills,
    joinLeaves: [],
  };
}

// Round 1 — USA received 9 (ALPHA 4, BETA 5), USA inflicted 1 (ALPHA); CSA GAMMA
// received 1, inflicted 9.
const R1 = mkScoreboard(
  'r1.csv',
  [
    mkPlayer('[ALPHA]A1', 'USA', { inForm: 1 }), // received 1
    mkPlayer('[ALPHA]A2', 'USA', { skirm: 1 }), // received 3
    mkPlayer('[BETA]B1', 'USA', { oob: 1 }), // received 5
    mkPlayer('[GAMMA]G2', 'CSA', { inForm: 1 }), // received 1
    mkPlayer('[GAMMA]G1', 'CSA'),
  ],
  [
    mkKill('[GAMMA]G1', '[ALPHA]A1', 'in_form'), // GAMMA inflicts 1
    mkKill('[GAMMA]G1', '[ALPHA]A2', 'skirm'), // GAMMA inflicts 3
    mkKill('[GAMMA]G1', '[BETA]B1', 'oob'), // GAMMA inflicts 5 → 9 total
    mkKill('[ALPHA]A1', '[GAMMA]G2', 'in_form'), // ALPHA inflicts 1
  ],
);

// Round 2 — USA received 6 (ALPHA 5, BETA 1), USA inflicted 3 (ALPHA); CSA GAMMA
// received 3, inflicted 5.
const R2 = mkScoreboard(
  'r2.csv',
  [
    mkPlayer('[ALPHA]A1', 'USA', { oob: 1 }), // received 5
    mkPlayer('[BETA]B1', 'USA', { inForm: 1 }), // received 1
    mkPlayer('[GAMMA]G1', 'CSA', { skirm: 1 }), // received 3
  ],
  [
    mkKill('[ALPHA]A1', '[GAMMA]G1', 'skirm'), // ALPHA inflicts 3
    mkKill('[GAMMA]G1', '[ALPHA]A1', 'oob'), // GAMMA inflicts 5
  ],
);

describe('computeRegimentTicketShares', () => {
  const shares = computeRegimentTicketShares([R1, R2], {});

  it('averages each regiment\'s per-round share of its team ticket damage received', () => {
    // ALPHA received: R1 4/9, R2 5/6 → mean ≈ 0.6389
    expect(shares.ALPHA.avgPctReceived).toBeCloseTo((4 / 9 + 5 / 6) / 2, 5);
    // BETA received: R1 5/9, R2 1/6 → mean ≈ 0.3611
    expect(shares.BETA.avgPctReceived).toBeCloseTo((5 / 9 + 1 / 6) / 2, 5);
    // GAMMA received both rounds is the whole CSA team → 1.0
    expect(shares.GAMMA.avgPctReceived).toBeCloseTo(1, 5);
  });

  it('averages each regiment\'s per-round share of its team ticket damage inflicted', () => {
    // ALPHA is USA's only inflicter both rounds → 1.0
    expect(shares.ALPHA.avgPctInflicted).toBeCloseTo(1, 5);
    // BETA never got a kill → 0% both rounds
    expect(shares.BETA.avgPctInflicted).toBeCloseTo(0, 5);
    // GAMMA is CSA's only inflicter → 1.0
    expect(shares.GAMMA.avgPctInflicted).toBeCloseTo(1, 5);
  });

  it('exposes per-round shares keyed by source filename', () => {
    expect(shares.ALPHA.perRound['r1.csv'].pctReceived).toBeCloseTo(4 / 9, 5);
    expect(shares.ALPHA.perRound['r2.csv'].pctReceived).toBeCloseTo(5 / 6, 5);
    expect(shares.BETA.perRound['r1.csv'].pctInflicted).toBeCloseTo(0, 5);
  });

  it('adds size-adjusted efficiency (share ÷ roster share) beside the shares', () => {
    // ALPHA inflicted: R1 100% share ÷ 2/3 roster = 1.5; R2 100% ÷ 1/2 = 2.0 → 1.75
    expect(shares.ALPHA.avgEffInflicted).toBeCloseTo(1.75, 5);
    // ALPHA received: R1 (4/9)÷(2/3)=2/3; R2 (5/6)÷(1/2)=5/3 → mean 7/6
    expect(shares.ALPHA.avgEffReceived).toBeCloseTo(7 / 6, 5);
    // BETA never scored → 0 inflicted efficiency; its received losses average to exactly its weight
    expect(shares.BETA.avgEffInflicted).toBeCloseTo(0, 5);
    expect(shares.BETA.avgEffReceived).toBeCloseTo(1, 5);
    // GAMMA is the whole CSA team → efficiency 1.0 both ways
    expect(shares.GAMMA.avgEffInflicted).toBeCloseTo(1, 5);
    expect(shares.GAMMA.avgEffReceived).toBeCloseTo(1, 5);
  });

  it('reports average roster head counts and per-round splits for the hover', () => {
    expect(shares.ALPHA.avgUnitPlayers).toBeCloseTo(1.5, 5); // (2 + 1) / 2
    expect(shares.ALPHA.avgTeamPlayers).toBeCloseTo(2.5, 5); // (3 + 2) / 2
    expect(shares.ALPHA.perRound['r1.csv'].effInflicted).toBeCloseTo(1.5, 5);
    expect(shares.ALPHA.perRound['r1.csv'].unitPlayers).toBe(2);
    expect(shares.ALPHA.perRound['r1.csv'].teamPlayers).toBe(3);
    expect(shares.ALPHA.perRound['r2.csv'].effInflicted).toBeCloseTo(2, 5);
  });

  it('splits shares by faction context (asUSA/asCSA)', () => {
    // ALPHA played USA both rounds → asUSA mirrors overall, asCSA is empty.
    expect(shares.ALPHA.asUSA.rounds).toBe(2);
    expect(shares.ALPHA.asCSA.rounds).toBe(0);
    expect(shares.ALPHA.asUSA.avgPctInflicted).toBeCloseTo(shares.ALPHA.avgPctInflicted ?? -1, 5);
    expect(shares.ALPHA.asUSA.avgEffReceived).toBeCloseTo(shares.ALPHA.avgEffReceived ?? -1, 5);
    // GAMMA played CSA both rounds → asCSA mirrors overall, asUSA is empty.
    expect(shares.GAMMA.asCSA.rounds).toBe(2);
    expect(shares.GAMMA.asUSA.rounds).toBe(0);
  });
});

describe('computeRegimentTicketShares — cross-team round (stray player)', () => {
  // SPLIT fields 2 players as USA and 1 stray as CSA in the same round. The stray
  // must not overwrite the round's perRound entry or double-count the average.
  const SPLIT = mkScoreboard(
    'split.csv',
    [
      mkPlayer('[SPLIT]A', 'USA', { inForm: 1 }), // received 1
      mkPlayer('[SPLIT]B', 'USA', { skirm: 1 }), // received 3
      mkPlayer('[SPLIT]C', 'CSA'), // stray — no kills, no deaths
      mkPlayer('[ENEMY]E', 'CSA', { inForm: 1 }), // received 1, killed by A
    ],
    [mkKill('[SPLIT]A', '[ENEMY]E', 'in_form')], // SPLIT (USA) inflicts 1
  );
  const shares = computeRegimentTicketShares([SPLIT], {});

  it('represents the unit by its dominant (USA) side, not the stray', () => {
    const pr = shares.SPLIT.perRound['split.csv'];
    expect(pr.unitPlayers).toBe(2); // the 2 USA players, not the 1 CSA stray
    expect(pr.teamPlayers).toBe(2); // USA head count
    expect(pr.pctReceived).toBeCloseTo(1, 5); // USA group's share, not the stray's 0
  });

  it('counts the round once (dominant group), not twice', () => {
    expect(shares.SPLIT.avgUnitPlayers).toBe(2); // (bug would average 2 and 1 → 1.5)
    expect(shares.SPLIT.asUSA.rounds).toBe(1);
    expect(shares.SPLIT.asCSA.rounds).toBe(0); // stray dropped, not bucketed as CSA
  });
});

describe('computeTokenTicketShares', () => {
  it('rolls regiments up under their token, summing per-team share', () => {
    // A token owning both USA regiments captures the whole USA team each round.
    const shares = computeTokenTicketShares([R1, R2], {}, { '1st Brigade': ['ALPHA', 'BETA'] });
    expect(shares['1st Brigade'].avgPctReceived).toBeCloseTo(1, 5);
    expect(shares['1st Brigade'].avgPctInflicted).toBeCloseTo(1, 5);
    // A token that IS the whole team contributes exactly its weight → efficiency 1.0.
    expect(shares['1st Brigade'].avgEffInflicted).toBeCloseTo(1, 5);
    expect(shares['1st Brigade'].avgEffReceived).toBeCloseTo(1, 5);
  });
});
