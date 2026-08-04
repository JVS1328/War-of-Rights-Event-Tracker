import { describe, it, expect } from 'vitest';
import {
  nightType,
  leadsPerNight,
  hasPerRoundLeads,
  effectiveTeams,
  leadsFor,
  nightRounds,
  nightScore,
  nightRows,
  nightPoints,
  nightKeys,
  rollupNight,
  ticketsOf,
  type NightWeek,
  type PointSystem,
} from './nightMatchup';
import { parseScoreboard } from './parseScoreboard';
import { isTextRow } from '../components/ui/spineModel';

const week = (over: Partial<NightWeek> = {}): NightWeek => ({
  id: 1,
  name: 'Week 1',
  teamA: ['1st Texas', '24th Georgia'],
  teamB: ['69th New York', '20th Maine'],
  round1Winner: 'A',
  round2Winner: 'B',
  round1Map: 'Bloody Lane',
  round2Map: 'East Woods',
  leadA: '1st Texas',
  leadB: '69th New York',
  r1CasualtiesA: 40,
  r1CasualtiesB: 60,
  r2CasualtiesA: 55,
  r2CasualtiesB: 45,
  ...over,
});

const PS: PointSystem = {
  winLead: 4,
  winAssist: 2,
  lossLead: 0,
  lossAssist: 1,
  bonus2_0Lead: 2,
  bonus2_0Assist: 1,
};

const pointsFor = (w: NightWeek, ps: PointSystem = PS, tokens?: string[]) =>
  Object.fromEntries(nightPoints(w, ps, tokens).map((r) => [r.unit, r.points]));

describe('nightType', () => {
  it('reads a plain night as Regular', () => {
    expect(nightType(week())).toBe('Regular');
  });

  it('names the three special kinds', () => {
    expect(nightType(week({ isSingleRoundLeads: true }))).toBe('Single-round leads');
    expect(nightType(week({ isPlayoffs: true }))).toBe('Playoffs');
    expect(nightType(week({ isFunRound: true }))).toBe('Fun round');
  });

  it('settles a week carrying more than one flag, rather than reading whichever comes first', () => {
    // The tracker's checkboxes are exclusive, but an imported season need not be.
    expect(nightType(week({ isPlayoffs: true, isSingleRoundLeads: true, isFunRound: true }))).toBe('Playoffs');
    expect(nightType(week({ isSingleRoundLeads: true, isFunRound: true }))).toBe('Single-round leads');
  });

  it('counts lead slots per kind', () => {
    expect(leadsPerNight('Regular')).toBe(2);
    expect(leadsPerNight('Single-round leads')).toBe(4);
    expect(leadsPerNight('Playoffs')).toBe(4);
    expect(leadsPerNight('Fun round')).toBe(0);
  });

  it('gives playoffs per-round leads too, not just single-round-lead nights', () => {
    expect(hasPerRoundLeads('Playoffs')).toBe(true);
    expect(hasPerRoundLeads('Single-round leads')).toBe(true);
    expect(hasPerRoundLeads('Regular')).toBe(false);
  });
});

describe('leadsFor', () => {
  it('uses the night lead for both rounds of a regular night', () => {
    const w = week();
    expect(leadsFor(w, 1)).toEqual({ A: '1st Texas', B: '69th New York' });
    expect(leadsFor(w, 2)).toEqual({ A: '1st Texas', B: '69th New York' });
  });

  it('reads a different lead per round when the night has single-round leads', () => {
    const w = week({
      isSingleRoundLeads: true,
      leadA_r1: '1st Texas',
      leadB_r1: '69th New York',
      leadA_r2: '24th Georgia',
      leadB_r2: '20th Maine',
    });
    expect(leadsFor(w, 1)).toEqual({ A: '1st Texas', B: '69th New York' });
    expect(leadsFor(w, 2)).toEqual({ A: '24th Georgia', B: '20th Maine' });
  });

  it('ignores the night-level lead entirely on a per-round night', () => {
    // A week converted to single-round leads keeps its old leadA/leadB; reading
    // them would silently credit the wrong unit.
    const w = week({ isSingleRoundLeads: true, leadA: '1st Texas', leadA_r1: '24th Georgia' });
    expect(leadsFor(w, 1).A).toBe('24th Georgia');
    expect(leadsFor(w, 2).A).toBeNull();
  });
});

describe('effectiveTeams', () => {
  it('leaves the sides alone when nobody was swapped', () => {
    expect(effectiveTeams(week(), 1)).toEqual({
      A: ['1st Texas', '24th Georgia'],
      B: ['69th New York', '20th Maine'],
    });
  });

  it('moves a balanced unit across for that round only', () => {
    const w = week({ roundSwaps: { r1: [], r2: ['24th Georgia'] } });
    expect(effectiveTeams(w, 1).A).toContain('24th Georgia');
    expect(effectiveTeams(w, 2).A).not.toContain('24th Georgia');
    expect(effectiveTeams(w, 2).B).toContain('24th Georgia');
  });
});

describe('nightRounds', () => {
  it('reads each round off the week', () => {
    const rounds = nightRounds(week());
    expect(rounds).toHaveLength(2);
    expect(rounds[0]).toMatchObject({ round: 1, winner: 'A', map: 'Bloody Lane', casualtiesA: 40 });
    expect(rounds[1]).toMatchObject({ round: 2, winner: 'B', map: 'East Woods', casualtiesB: 45 });
  });

  it('resolves which faction each side played, so a flipped round can be read', () => {
    const r = nightRounds(week({ round2Flipped: true }));
    expect(r[0]).toMatchObject({ factionA: 'USA', factionB: 'CSA' });
    expect(r[1]).toMatchObject({ factionA: 'CSA', factionB: 'USA' });
  });

  it('counts a recorded draw as played', () => {
    const r = nightRounds(week({ round2Winner: null, round2Draw: true }));
    expect(r[1].played).toBe(true);
    expect(r[1].winner).toBeNull();
  });

  it('leaves an unplayed round with no casualty figures, rather than zeroes', () => {
    // New weeks are seeded with 0 casualties, so 0 on an unplayed round means
    // "not filled in" — showing it as 0 would read as a shutout.
    const r = nightRounds(week({ round2Winner: null, r2CasualtiesA: 0, r2CasualtiesB: 0 }));
    expect(r[1].played).toBe(false);
    expect(r[1].casualtiesA).toBeNull();
    expect(r[1].casualtiesB).toBeNull();
  });

  it('keeps a real 0 on a round that was played', () => {
    const r = nightRounds(week({ round2Winner: 'A', r2CasualtiesA: 0, r2CasualtiesB: 30 }));
    expect(r[1].casualtiesA).toBe(0);
  });
});

describe('nightScore', () => {
  it('counts rounds won and adds the casualties up', () => {
    expect(nightScore(week())).toMatchObject({
      roundsA: 1,
      roundsB: 1,
      played: 2,
      casualtiesA: 95,
      casualtiesB: 105,
      winner: null,
      sweep: null,
    });
  });

  it('marks a 2–0 as a sweep and names the winner', () => {
    expect(nightScore(week({ round2Winner: 'A' }))).toMatchObject({ roundsA: 2, winner: 'A', sweep: 'A' });
  });

  it('lets one round decide a half-played night', () => {
    expect(nightScore(week({ round2Winner: null }))).toMatchObject({ played: 1, winner: 'A', sweep: null });
  });

  it('has no winner before anything is played', () => {
    const s = nightScore(week({ round1Winner: null, round2Winner: null }));
    expect(s).toMatchObject({ played: 0, winner: null, roundsA: 0, roundsB: 0 });
  });
});

describe('nightRows', () => {
  const labels = (w: NightWeek) => nightRows(w).map((r) => r.label);

  it('always leads with rounds won', () => {
    expect(nightRows(week())[0]).toMatchObject({ label: 'Rounds won', a: 1, b: 1 });
  });

  it('scores casualties inflicted as the OTHER side’s losses', () => {
    const row = nightRows(week()).find((r) => r.label === 'Casualties inflicted');
    expect(row).toMatchObject({ a: 105, b: 95 });
  });

  it('leaves the casualty rows out when the night recorded none', () => {
    const l = labels(week({ r1CasualtiesA: 0, r1CasualtiesB: 0, r2CasualtiesA: 0, r2CasualtiesB: 0 }));
    expect(l).not.toContain('Casualties inflicted');
    expect(l).toContain('Rounds won');
  });

  it('adds the stance rows once a round records the split', () => {
    const w = week({
      r1CasualtiesFormA: { in_form: 30, skirm: 5, oob: 5 },
      r1CasualtiesFormB: { in_form: 20, skirm: 20, oob: 20 },
    });
    const l = labels(w);
    expect(l).toContain('Held the line');
    expect(l).toContain('Caught out of line');
    expect(l).toContain('Ticket damage dealt');
  });

  it('shows the night lead as text on a regular night and drops it on a per-round one', () => {
    const reg = nightRows(week()).filter(isTextRow).map((r) => r.label);
    expect(reg).toContain('Lead unit');
    const srl = nightRows(week({ isSingleRoundLeads: true })).map((r) => r.label);
    expect(srl).not.toContain('Lead unit');
  });

  it('has no lead row on a fun round, which has no leads at all', () => {
    expect(labels(week({ isFunRound: true }))).not.toContain('Lead unit');
  });
});

describe('nightPoints — regular night', () => {
  it('pays the lead and the assists on each round', () => {
    // R1 A wins: 1st Texas leads (4), 24th Georgia assists (2).
    // R1 B loses: 69th NY leads (0), 20th Maine assists (1).
    // R2 mirrors it the other way.
    expect(pointsFor(week())).toEqual({
      '1st Texas': 4 + 0,
      '24th Georgia': 2 + 1,
      '69th New York': 0 + 4,
      '20th Maine': 1 + 2,
    });
  });

  it('adds the sweep bonus on a 2–0', () => {
    const p = pointsFor(week({ round2Winner: 'A' }));
    expect(p['1st Texas']).toBe(4 + 4 + 2); // two lead wins + lead sweep bonus
    expect(p['24th Georgia']).toBe(2 + 2 + 1); // two assists + assist sweep bonus
    expect(p['69th New York']).toBe(0);
  });

  it('withholds the sweep bonus from a unit swapped across for one round', () => {
    const w = week({ round2Winner: 'A', roundSwaps: { r1: [], r2: ['24th Georgia'] } });
    const rows = nightPoints(w, PS);
    const geo = rows.find((r) => r.unit === '24th Georgia')!;
    // Won R1 with A, lost R2 having been swapped to B — not on the winning side
    // in both rounds, so no bonus.
    expect(geo.roundsWon).toBe(1);
    expect(geo.roundsLost).toBe(1);
    expect(geo.points).toBe(2 + 1);
  });

  it('counts a unit’s lead rounds and swaps', () => {
    const w = week({ roundSwaps: { r1: ['20th Maine'], r2: [] } });
    const rows = nightPoints(w, PS);
    expect(rows.find((r) => r.unit === '1st Texas')).toMatchObject({ ledRounds: 2, side: 'A' });
    expect(rows.find((r) => r.unit === '20th Maine')).toMatchObject({ swappedRounds: 1 });
  });
});

describe('nightPoints — the special kinds', () => {
  it('records a playoff night but pays nothing for it', () => {
    const w = week({
      isPlayoffs: true,
      round2Winner: 'A',
      leadA_r1: '1st Texas',
      leadB_r1: '69th New York',
      leadA_r2: '24th Georgia',
      leadB_r2: '20th Maine',
    });
    const rows = nightPoints(w, PS);
    expect(rows.every((r) => r.points === 0)).toBe(true);
    expect(rows.find((r) => r.unit === '1st Texas')).toMatchObject({ roundsWon: 2, ledRounds: 1 });
  });

  it('pays nothing and records nothing for a fun round', () => {
    const rows = nightPoints(week({ isFunRound: true }), PS);
    expect(rows.every((r) => r.points === 0 && r.roundsWon === 0 && r.roundsLost === 0)).toBe(true);
  });

  it('pays each round’s own lead on a single-round-lead night', () => {
    const w = week({
      isSingleRoundLeads: true,
      round2Winner: 'A',
      leadA_r1: '1st Texas',
      leadB_r1: '69th New York',
      leadA_r2: '24th Georgia',
      leadB_r2: '20th Maine',
    });
    const p = pointsFor(w, PS);
    // 1st Texas: leads R1 (win, 4), assists R2 (win, 2), sweep as a lead (2).
    expect(p['1st Texas']).toBe(4 + 2 + 2);
    // 24th Georgia: assists R1 (2), leads R2 (4), sweep as a lead (2).
    expect(p['24th Georgia']).toBe(2 + 4 + 2);
  });

  it('treats both single-round leads as sweep leads, not just the night lead', () => {
    // The tracker collects the two per-round leads into a set for the bonus, so
    // a unit that led either round gets the lead bonus.
    const w = week({
      isSingleRoundLeads: true,
      round2Winner: 'A',
      leadA_r1: '1st Texas',
      leadA_r2: '24th Georgia',
    });
    const rows = nightPoints(w, PS);
    expect(rows.find((r) => r.unit === '24th Georgia')!.points).toBe(2 + 4 + 2);
  });
});

describe('nightPoints — tokens and balance points', () => {
  it('pays nothing to a unit with no standings token', () => {
    const p = pointsFor(week(), PS, ['1st Texas', '69th New York']);
    expect(p['24th Georgia']).toBe(0);
    expect(p['1st Texas']).toBe(4);
  });

  it('still lists the untokened unit, marked, rather than dropping it', () => {
    const rows = nightPoints(week(), PS, ['1st Texas']);
    const geo = rows.find((r) => r.unit === '24th Georgia')!;
    expect(geo.token).toBe(false);
    expect(geo.roundsWon).toBe(1);
  });

  it('pays balance points once a night by default', () => {
    const ps = { ...PS, balancePoints: 1 };
    const w = week({ roundSwaps: { r1: ['20th Maine'], r2: ['20th Maine'] } });
    expect(pointsFor(w, ps)['20th Maine']).toBe(1 + 2 + 1);
  });

  it('pays them per round when the season says so', () => {
    const ps: PointSystem = { ...PS, balancePoints: 1, balancePointsStyle: 'perRound' };
    const w = week({ roundSwaps: { r1: ['20th Maine'], r2: ['20th Maine'] } });
    expect(pointsFor(w, ps)['20th Maine']).toBe(1 + 2 + 2);
  });

  it('pays perRoundLoss only for the rounds the balanced unit lost', () => {
    const ps: PointSystem = { ...PS, balancePoints: 1, balancePointsStyle: 'perRoundLoss' };
    // 20th Maine starts on B. Swapped in R1 → plays A, which wins R1 (assist
    // win, no balance point). Swapped in R2 → plays A, which loses R2 (assist
    // loss, plus the balance point for having balanced and lost).
    const w = week({ roundSwaps: { r1: ['20th Maine'], r2: ['20th Maine'] } });
    const rows = nightPoints(w, ps);
    const maine = rows.find((r) => r.unit === '20th Maine')!;
    expect(maine.roundsWon).toBe(1);
    expect(maine.roundsLost).toBe(1);
    expect(maine.points).toBe(2 + 1 + 1);
    // The same night with per-night balance points pays the balance point once
    // regardless of which round it fell in.
    expect(nightPoints(w, { ...PS, balancePoints: 1 }).find((r) => r.unit === '20th Maine')!.points).toBe(2 + 1 + 1);
  });

  it('pays no balance points on a playoff night', () => {
    const ps = { ...PS, balancePoints: 5 };
    const w = week({ isPlayoffs: true, roundSwaps: { r1: ['20th Maine'], r2: [] } });
    expect(pointsFor(w, ps)['20th Maine']).toBe(0);
  });
});

describe('nightKeys', () => {
  it('says nothing about a night that has not been played', () => {
    expect(nightKeys(week({ round1Winner: null, round2Winner: null }))).toEqual([]);
  });

  it('calls a sweep a sweep, and names the lead', () => {
    const k = nightKeys(week({ round2Winner: 'A' }));
    expect(k[0].title).toBe('2–0 sweep');
    expect(k[0].body).toContain('1st Texas');
    expect(k[0].side).toBe('A');
  });

  it('says a playoff sweep pays nothing', () => {
    const k = nightKeys(week({ isPlayoffs: true, round2Winner: 'A' }));
    expect(k[0].body).toContain('no points');
  });

  it('calls out a night won against the casualty count', () => {
    // A takes both rounds but gives up more men.
    const w = week({ round2Winner: 'A', r1CasualtiesA: 90, r1CasualtiesB: 10 });
    const note = nightKeys(w).find((x) => x.title === 'The casualty ledger')!;
    expect(note.body).toContain('Team A still took the night');
  });

  it('warns when exactly one round was flipped', () => {
    const k = nightKeys(week({ round2Flipped: true }));
    expect(k.some((x) => x.title === 'Sides flipped')).toBe(true);
  });

  it('does not warn when both rounds ran the same way round', () => {
    expect(nightKeys(week({ round1Flipped: true, round2Flipped: true })).some((x) => x.title === 'Sides flipped')).toBe(
      false,
    );
  });

  it('marks a fun round as exhibition', () => {
    expect(nightKeys(week({ isFunRound: true })).some((x) => x.title === 'Exhibition')).toBe(true);
  });
});

// ── Roll-up ────────────────────────────────────────────────────────────────

const SB = (opts: { file: string; winner: string; kills: [string, string][] }) => {
  const roster = [
    'USA,1st Texas,A Company,[1stTX]Foot,Rifleman,Pvt,76561198000000011',
    'USA,1st Texas,A Company,[1stTX]Hand,Rifleman,Pvt,76561198000000012',
    'CSA,69th New York,A Company,[69NY]Mick,Rifleman,Pvt,76561198000000021',
  ].join('\n');
  const csv = `round_start_time,19:00:00
round_end_time,19:30:00
map,Antietam
area,Bloody Lane
mode,Skirmish
winner,${opts.winner}
casualties_usa,3
casualties_usa_in_form,1
casualties_usa_skirm,1
casualties_usa_oob,1
casualties_csa,2
casualties_csa_in_form,2
casualties_csa_skirm,0
casualties_csa_oob,0

name,team,kills,deaths,kd,deaths_in_form,deaths_skirm,deaths_oob,steam_id
[1stTX]Foot,1,4,2,2.00,1,1,0,76561198000000011
[1stTX]Hand,1,1,1,1.00,0,0,1,76561198000000012
[69NY]Mick,2,3,2,1.50,2,0,0,76561198000000021

team,regiment,company,name,class,rank,steam_id
${roster}

time,killer,killer_team,victim,victim_team,victim_formation,cause
${opts.kills
  .map(([killer, form], i) => {
    const usa = killer.startsWith('[1stTX]');
    const victim = usa ? '[69NY]Mick' : '[1stTX]Foot';
    return `00:0${i}:00,${killer},${usa ? 1 : 2},${victim},${usa ? 2 : 1},${form},Minie`;
  })
  .join('\n')}
`;
  return parseScoreboard(csv, opts.file);
};

describe('rollupNight', () => {
  const r1 = SB({
    file: 'scoreboard_20260419_193000.csv',
    winner: 'USA',
    kills: [
      ['[1stTX]Foot', 'in_form'],
      ['[1stTX]Foot', 'oob'],
      ['[69NY]Mick', 'in_form'],
    ],
  });
  const r2 = SB({
    file: 'scoreboard_20260419_200000.csv',
    winner: 'CSA',
    kills: [['[1stTX]Foot', 'skirm']],
  });

  it('files each faction under the side that played it', () => {
    const roll = rollupNight([{ round: 1, sb: r1, factionA: 'USA' }]);
    expect(roll.A.factions).toEqual(['USA']);
    expect(roll.B.factions).toEqual(['CSA']);
    expect(roll.A.kills).toBe(5); // both Texans
    expect(roll.B.kills).toBe(3); // the New Yorker
  });

  it('follows a flipped round, rather than summing the factions straight', () => {
    // Team A plays USA in R1 and CSA in R2. Adding "USA" across both rounds
    // would give one side of the numbers to each team.
    const roll = rollupNight([
      { round: 1, sb: r1, factionA: 'USA' },
      { round: 2, sb: r2, factionA: 'CSA' },
    ]);
    expect(roll.A.factions).toEqual(['USA', 'CSA']);
    // A = USA in R1 (5 kills) + CSA in R2 (3 kills).
    expect(roll.A.kills).toBe(8);
    expect(roll.B.kills).toBe(8);
    expect(roll.roundsImported).toBe(2);
  });

  it('takes the casualty split from the meta block, per side', () => {
    const roll = rollupNight([{ round: 1, sb: r1, factionA: 'USA' }]);
    expect(roll.A.casualtiesByFormation).toEqual({ in_form: 1, skirm: 1, oob: 1 });
    expect(roll.B.casualtiesByFormation).toEqual({ in_form: 2, skirm: 0, oob: 0 });
    expect(roll.A.ticketsLost).toBe(1 + 3 + 5);
    expect(roll.B.ticketsLost).toBe(2);
  });

  it('reads kill stance off the killfeed, since the player table has no such column', () => {
    const roll = rollupNight([{ round: 1, sb: r1, factionA: 'USA' }]);
    expect(roll.A.killsByFormation).toEqual({ in_form: 1, skirm: 0, oob: 1 });
    expect(roll.B.killsByFormation).toEqual({ in_form: 1, skirm: 0, oob: 0 });
  });

  it('reads both cause tables off the killfeed, so they speak one vocabulary', () => {
    // The meta block calls it "Round" and the killfeed "Round Shot"; taking one
    // table from each would leave the night's kills and deaths incomparable.
    const roll = rollupNight([{ round: 1, sb: r1, factionA: 'USA' }]);
    expect(roll.A.killsByCause).toEqual({ Minie: 2 });
    expect(roll.B.casualtiesByCause).toEqual({ Minie: 2 });
    expect(roll.B.killsByCause).toEqual({ Minie: 1 });
    expect(roll.A.casualtiesByCause).toEqual({ Minie: 1 });
  });

  it('leaves no zero-count causes to pad the table out', () => {
    const roll = rollupNight([{ round: 1, sb: r1, factionA: 'USA' }]);
    for (const side of [roll.A, roll.B]) {
      expect(Object.values(side.killsByCause).every((n) => n > 0)).toBe(true);
      expect(Object.values(side.casualtiesByCause).every((n) => n > 0)).toBe(true);
    }
  });

  it('groups the players into units on the side they played for', () => {
    const roll = rollupNight([{ round: 1, sb: r1, factionA: 'USA' }]);
    expect(roll.A.units.map((u) => u.unit)).toEqual(['1STTX']);
    expect(roll.B.units.map((u) => u.unit)).toEqual(['69NY']);
    const tx = roll.A.units[0];
    expect(tx).toMatchObject({ fielded: 2, kills: 5, deaths: 3, rounds: 1 });
  });

  it('shares each unit’s ticket damage against its own side’s total', () => {
    const roll = rollupNight([{ round: 1, sb: r1, factionA: 'USA' }]);
    // Only one unit a side here, so each owns all of it.
    expect(roll.A.units[0].pctInflicted).toBe(100);
    expect(roll.B.units[0].pctReceived).toBe(100);
  });

  it('reads a unit’s ×Td off its own losses, not the side total', () => {
    const roll = rollupNight([{ round: 1, sb: r1, factionA: 'USA' }]);
    const tx = roll.A.units[0];
    // Foot: 1 in form + 1 skirm; Hand: 1 out of line → (1 + 3 + 5) / 3.
    expect(tx.avgTd).toBeCloseTo(3, 5);
  });

  it('builds a spine that scores ticket damage as the enemy’s loss', () => {
    const roll = rollupNight([{ round: 1, sb: r1, factionA: 'USA' }]);
    const row = roll.rows.find((x) => x.label === 'Ticket damage dealt');
    expect(row).toMatchObject({ a: roll.B.ticketsLost, b: roll.A.ticketsLost });
  });

  it('returns two empty sides for a night with nothing imported', () => {
    const roll = rollupNight([]);
    expect(roll.roundsImported).toBe(0);
    expect(roll.A.units).toEqual([]);
    expect(roll.rows.find((r) => r.label === 'Kills')).toMatchObject({ a: 0, b: 0 });
  });
});

describe('ticketsOf', () => {
  it('weights the three stances 1, 3 and 5', () => {
    expect(ticketsOf({ in_form: 2, skirm: 1, oob: 1 })).toBe(2 + 3 + 5);
  });
});
