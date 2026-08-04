import { describe, it, expect } from 'vitest';
import { splitPlayerRounds } from './playerSplits';
import { mapAttacker } from './mapCatalog';
import type { PlayerRoundRow } from './statsEngine';

const round = (over: Partial<PlayerRoundRow> = {}): PlayerRoundRow => ({
  sourceFilename: 'x.csv',
  recordedAt: null,
  map: 'Bloody Lane',
  area: null,
  team: 'USA',
  regiment: '24th Georgia',
  company: 'A Company',
  className: 'Rifleman',
  rank: 'Pvt',
  battery: false,
  branch: 'Infantry',
  kills: 4,
  deaths: 2,
  deathsInForm: 2,
  deathsSkirm: 0,
  deathsOob: 0,
  killsInForm: 4,
  killsSkirm: 0,
  killsOob: 0,
  avgTd: 1,
  avgTk: 1,
  killsByCause: { Minie: 4 },
  deathsByCause: { Minie: 2 },
  ...over,
});

// Two maps with opposite attackers, so a player can be on both sides of the role.
const USA_ATTACKS = 'Bloody Lane';
const CSA_ATTACKS = (() => {
  for (const m of ['Hagerstown Turnpike', "Miller's Cornfield", 'East Woods', 'Dunker Church', 'West Woods']) {
    if (mapAttacker(m) === 'CSA') return m;
  }
  throw new Error('no CSA-attacking map in the catalog');
})();

describe('splitPlayerRounds — faction slices', () => {
  it('files each round under the side it was played on', () => {
    const s = splitPlayerRounds([
      round({ team: 'USA', kills: 10 }),
      round({ team: 'CSA', kills: 4 }),
      round({ team: 'CSA', kills: 6 }),
    ]);
    expect(s.asUSA.rounds).toBe(1);
    expect(s.asUSA.kills).toBe(10);
    expect(s.asCSA.rounds).toBe(2);
    expect(s.asCSA.kills).toBe(10);
  });

  it('adds up the stance counts per slice', () => {
    const s = splitPlayerRounds([
      round({ team: 'USA', deathsInForm: 3, deathsSkirm: 1, deathsOob: 2, deaths: 6 }),
      round({ team: 'USA', deathsInForm: 1, deathsSkirm: 0, deathsOob: 0, deaths: 1 }),
    ]);
    expect(s.asUSA.casualtiesByFormation).toEqual({ in_form: 4, skirm: 1, oob: 2 });
  });

  it('merges cause maps rather than replacing them', () => {
    const s = splitPlayerRounds([
      round({ team: 'USA', killsByCause: { Minie: 3, Melee: 1 } }),
      round({ team: 'USA', killsByCause: { Minie: 2, Canister: 5 } }),
    ]);
    expect(s.asUSA.killsByCause).toEqual({ Minie: 5, Melee: 1, Canister: 5 });
  });
});

describe('splitPlayerRounds — attacker and defender', () => {
  it('reads the role off the map, not the round', () => {
    expect(mapAttacker(USA_ATTACKS)).toBe('USA');
    const s = splitPlayerRounds([
      round({ map: USA_ATTACKS, team: 'USA' }), // attacking
      round({ map: USA_ATTACKS, team: 'CSA' }), // defending
    ]);
    expect(s.asAttacker.rounds).toBe(1);
    expect(s.asDefender.rounds).toBe(1);
  });

  it('resolves the area before the map, since the catalog is keyed on areas', () => {
    // Real scoreboards carry the theatre in `map` ("Antietam") and the playable
    // area in `area` ("Bloody Lane"). Reading `map` alone finds no attacker.
    const s = splitPlayerRounds([
      round({ map: 'Antietam', area: USA_ATTACKS, team: 'USA' }),
      round({ map: 'Antietam', area: USA_ATTACKS, team: 'CSA' }),
    ]);
    expect(s.asAttacker.rounds).toBe(1);
    expect(s.asDefender.rounds).toBe(1);
  });

  it('flips the role when the attacking side flips', () => {
    const s = splitPlayerRounds([
      round({ map: USA_ATTACKS, team: 'USA' }),
      round({ map: CSA_ATTACKS, team: 'USA' }),
    ]);
    // Same team both rounds, opposite roles.
    expect(s.asUSA.rounds).toBe(2);
    expect(s.asAttacker.rounds).toBe(1);
    expect(s.asDefender.rounds).toBe(1);
  });

  it('leaves a map with no attacker out of both role slices, but keeps it in the faction one', () => {
    const s = splitPlayerRounds([
      round({ map: 'Antietam', area: 'Some Conquest Area That Does Not Exist', team: 'USA' }),
    ]);
    expect(s.asUSA.rounds).toBe(1);
    expect(s.asAttacker.rounds).toBe(0);
    expect(s.asDefender.rounds).toBe(0);
  });
});

describe('splitPlayerRounds — derived figures', () => {
  it('computes K/D per slice, not off the whole record', () => {
    const s = splitPlayerRounds([
      round({ team: 'USA', kills: 10, deaths: 2 }),
      round({ team: 'CSA', kills: 2, deaths: 8 }),
    ]);
    expect(s.asUSA.kd).toBe(5);
    expect(s.asCSA.kd).toBe(0.25);
  });

  it('treats kills with no deaths as the kill count, not infinity', () => {
    const s = splitPlayerRounds([round({ team: 'USA', kills: 7, deaths: 0, deathsInForm: 0 })]);
    expect(s.asUSA.kd).toBe(7);
    expect(Number.isFinite(s.asUSA.kd)).toBe(true);
  });

  it('weights the ticket averages 1, 3 and 5', () => {
    const s = splitPlayerRounds([
      round({ team: 'USA', deaths: 4, deathsInForm: 2, deathsSkirm: 1, deathsOob: 1 }),
    ]);
    // (2*1 + 1*3 + 1*5) / 4
    expect(s.asUSA.avgTd).toBeCloseTo(2.5, 5);
  });

  it('leaves the ticket averages null until there is something to average', () => {
    const s = splitPlayerRounds([
      round({ team: 'USA', kills: 0, deaths: 0, deathsInForm: 0, killsInForm: 0 }),
    ]);
    expect(s.asUSA.avgTd).toBeNull();
    expect(s.asUSA.avgTk).toBeNull();
  });

  it('returns four empty slices for a player with no rounds', () => {
    const s = splitPlayerRounds([]);
    for (const slice of [s.asUSA, s.asCSA, s.asAttacker, s.asDefender]) {
      expect(slice.rounds).toBe(0);
      expect(slice.kd).toBe(0);
      expect(slice.avgTd).toBeNull();
    }
  });

  it('keeps the faction slices reconciling to the whole record', () => {
    const rounds = [
      round({ team: 'USA', kills: 5, deaths: 1 }),
      round({ team: 'CSA', kills: 3, deaths: 4 }),
      round({ team: 'CSA', kills: 9, deaths: 2 }),
    ];
    const s = splitPlayerRounds(rounds);
    expect(s.asUSA.kills + s.asCSA.kills).toBe(17);
    expect(s.asUSA.deaths + s.asCSA.deaths).toBe(7);
    expect(s.asUSA.rounds + s.asCSA.rounds).toBe(rounds.length);
  });
});
