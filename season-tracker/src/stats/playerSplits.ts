/**
 * A player's record, sliced by the context they played in.
 *
 * Units already get this from computeRegimentContextStats; players never did,
 * so a card could show a good K/D without saying it was earned defending on
 * the Confederate side every time. Same four slices, so the two read alike.
 *
 * Derived from the rounds already on PlayerDetail rather than by another pass
 * over the scoreboards — the per-round rows carry everything needed.
 */
import type { PlayerRoundRow, FormationCounts } from './statsEngine';
import { avgTicketCost } from './labels';
import { mapAttacker } from './mapCatalog';

export interface PlayerSlice {
  rounds: number;
  kills: number;
  deaths: number;
  kd: number;
  casualtiesByFormation: FormationCounts;
  killsByFormation: FormationCounts;
  /** Avg ticket cost per death; null until they have died. */
  avgTd: number | null;
  /** Avg ticket value per kill; null until they have killed. */
  avgTk: number | null;
  casualtiesByCause: Record<string, number>;
  killsByCause: Record<string, number>;
}

export interface PlayerSplits {
  asUSA: PlayerSlice;
  asCSA: PlayerSlice;
  /** Rounds their side was attacking. Maps with no attacker are in neither. */
  asAttacker: PlayerSlice;
  asDefender: PlayerSlice;
}

const emptyForm = (): FormationCounts => ({ in_form: 0, skirm: 0, oob: 0 });

const emptySlice = (): PlayerSlice => ({
  rounds: 0,
  kills: 0,
  deaths: 0,
  kd: 0,
  casualtiesByFormation: emptyForm(),
  killsByFormation: emptyForm(),
  avgTd: null,
  avgTk: null,
  casualtiesByCause: {},
  killsByCause: {},
});

function add(slice: PlayerSlice, r: PlayerRoundRow): void {
  slice.rounds += 1;
  slice.kills += r.kills;
  slice.deaths += r.deaths;
  slice.casualtiesByFormation.in_form += r.deathsInForm;
  slice.casualtiesByFormation.skirm += r.deathsSkirm;
  slice.casualtiesByFormation.oob += r.deathsOob;
  slice.killsByFormation.in_form += r.killsInForm;
  slice.killsByFormation.skirm += r.killsSkirm;
  slice.killsByFormation.oob += r.killsOob;
  for (const [cause, n] of Object.entries(r.deathsByCause)) {
    slice.casualtiesByCause[cause] = (slice.casualtiesByCause[cause] ?? 0) + n;
  }
  for (const [cause, n] of Object.entries(r.killsByCause)) {
    slice.killsByCause[cause] = (slice.killsByCause[cause] ?? 0) + n;
  }
}

function seal(slice: PlayerSlice): PlayerSlice {
  slice.kd = slice.deaths > 0 ? slice.kills / slice.deaths : slice.kills;
  const c = slice.casualtiesByFormation;
  const k = slice.killsByFormation;
  slice.avgTd = avgTicketCost(c.in_form, c.skirm, c.oob);
  slice.avgTk = avgTicketCost(k.in_form, k.skirm, k.oob);
  return slice;
}

/**
 * Attacker/defender is a property of the map, not the round, and Conquest and
 * Contention have neither — those rounds are counted in the faction slices but
 * in neither of the role slices, rather than being guessed at.
 */
export function splitPlayerRounds(rounds: PlayerRoundRow[]): PlayerSplits {
  const out: PlayerSplits = {
    asUSA: emptySlice(),
    asCSA: emptySlice(),
    asAttacker: emptySlice(),
    asDefender: emptySlice(),
  };
  for (const r of rounds) {
    add(r.team === 'USA' ? out.asUSA : out.asCSA, r);
    // The overlay puts the theatre in `map` and the playable area in `area`,
    // and the catalog is keyed on the area — so resolve area first, exactly as
    // the regiment context stats do. Reading `map` alone silently files every
    // round as having no attacker.
    const attacker = mapAttacker(r.area ?? r.map);
    if (attacker === null) continue;
    add(attacker === r.team ? out.asAttacker : out.asDefender, r);
  }
  return {
    asUSA: seal(out.asUSA),
    asCSA: seal(out.asCSA),
    asAttacker: seal(out.asAttacker),
    asDefender: seal(out.asDefender),
  };
}

/** The four slices in display order, with the labels the card shows. */
export const SPLIT_LABELS: { key: keyof PlayerSplits; label: string }[] = [
  { key: 'asUSA', label: 'As USA' },
  { key: 'asCSA', label: 'As CSA' },
  { key: 'asAttacker', label: 'Attacking' },
  { key: 'asDefender', label: 'Defending' },
];
