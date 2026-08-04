import { describe, it, expect } from 'vitest';
import { parseScoreboard } from './parseScoreboard';
import { computePlayerLeaderboard, computePlayerDetail } from './statsEngine';

/**
 * End-to-end cover for the arm-of-service filter: the branch has to survive the
 * trip from the scoreboard's roster section, through roster lookup, into the
 * leaderboard and the player card. Unit tests on branchOf can't catch a break
 * in that path.
 *
 * Three players, one per arm, all on the same round.
 */
const ROUND = `round_start_time,19:00:00
round_end_time,19:30:00
map,Antietam
mode,Skirmish
winner,USA

name,team,kills,deaths,kd,deaths_in_form,deaths_skirm,deaths_oob,steam_id
[1stTX]Foot,1,10,2,5.00,2,0,0,76561198000000011
[1stTX]Horse,1,6,1,6.00,1,0,0,76561198000000012
[1stTX]Gun,1,4,3,1.33,3,0,0,76561198000000013

team,regiment,company,name,class,rank,steam_id
USA,24th Georgia,A Company,[1stTX]Foot,Rifleman,Pvt,76561198000000011
USA,1st Virginia,A Company,[1stTX]Horse,Trooper,Cpl,76561198000000012
USA,Battery A,A Company,[1stTX]Gun,Gunner,Sgt,76561198000000013
`;

const sb = parseScoreboard(ROUND, 'scoreboard_20260419_193000.csv');
const names = (type: 'all' | 'inf' | 'cav' | 'arty') =>
  computePlayerLeaderboard([sb], {}, { type })
    .map((p) => p.name)
    .sort();

describe('arm filter, scoreboard to leaderboard', () => {
  it('keeps everyone on "all"', () => {
    expect(names('all')).toEqual(['[1stTX]Foot', '[1stTX]Gun', '[1stTX]Horse']);
  });

  it('separates the cavalryman from the infantryman', () => {
    // The old battery-only test put both of these under "inf".
    expect(names('inf')).toEqual(['[1stTX]Foot']);
    expect(names('cav')).toEqual(['[1stTX]Horse']);
  });

  it('keeps artillery to the battery', () => {
    expect(names('arty')).toEqual(['[1stTX]Gun']);
  });

  it('reconciles: the three arms partition the field', () => {
    const parts = [...names('inf'), ...names('cav'), ...names('arty')].sort();
    expect(parts).toEqual(names('all'));
  });

  it('carries the round’s arm onto the player card', () => {
    const detail = computePlayerDetail([sb], '76561198000000012', {}, { type: 'all' });
    expect(detail?.perRound[0].branch).toBe('Cavalry');
    expect(detail?.perRound[0].battery).toBe(false);
  });

  it('filters the player card by arm the same way the table does', () => {
    const horse = '76561198000000012';
    expect(computePlayerDetail([sb], horse, {}, { type: 'cav' })?.rounds).toBe(1);
    // Filtering a player out of every round leaves no card to show, rather than
    // an empty one — the drawer reads null as "nothing under this filter".
    expect(computePlayerDetail([sb], horse, {}, { type: 'inf' })).toBeNull();
    expect(computePlayerDetail([sb], horse, {}, { type: 'arty' })).toBeNull();
  });

  it('treats a player with no roster row as infantry rather than dropping them', () => {
    const noRoster = parseScoreboard(
      ROUND.slice(0, ROUND.indexOf('team,regiment,company')),
      'scoreboard_20260419_193000.csv',
    );
    expect(computePlayerLeaderboard([noRoster], {}, { type: 'inf' })).toHaveLength(3);
    expect(computePlayerLeaderboard([noRoster], {}, { type: 'cav' })).toHaveLength(0);
  });
});
