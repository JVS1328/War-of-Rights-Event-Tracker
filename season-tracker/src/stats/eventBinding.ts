import type { Scoreboard, Team } from './types';
import type { FormationCounts } from './statsEngine';
import { normalizeMorale } from './morale';
import type { Morale } from './morale';
import { mapMode } from './mapCatalog';

/** A→B side names for a season (e.g. { A: 'USA', B: 'CSA' }). */
export interface TeamNames {
  A: string;
  B: string;
}

export interface RoundAutofill {
  /** CSV mapset (e.g. "DrillCamp"). */
  mapset: string;
  /** Raw CSV area (e.g. "Flemming's Meadow"). */
  areaRaw: string | null;
  /** Area to write into the round, only if it matches a known map area. */
  area: string | null;
  validMap: boolean;
  winner: Team | null;
  /** Winner mapped to the round's A/B side, or null. */
  winnerSide: 'A' | 'B' | null;
  /**
   * True when the round is a draw: a Conquest/Contention map with no winner on
   * the scoreboard. (Skirmish maps always have a winner, so they never draw.)
   */
  isDraw: boolean;
  /** Whether this round's faction↔side mapping was flipped. */
  flipped: boolean;
  /** Which faction side A / side B played this round (after flip). */
  sideAFaction: Team;
  sideBFaction: Team;
  /** Total casualties for side A / side B (after the flip mapping). */
  casualtiesA: number;
  casualtiesB: number;
  /** Casualties by formation (in_form/skirm/oob) for side A / side B. */
  casualtiesFormA: FormationCounts;
  casualtiesFormB: FormationCounts;
  /** End-of-round morale state for side A / side B (canonical), or null. */
  moraleA: Morale | null;
  moraleB: Morale | null;
}

const other = (s: 'A' | 'B'): 'A' | 'B' => (s === 'A' ? 'B' : 'A');

/**
 * Translate a scoreboard into the fields a Week/Round expects: map area,
 * winner side, and per-side casualty totals.
 *
 * The tracker's convention is "side A = USA, side B = CSA" by default, modified
 * per round by the `flipped` flag (flipped → side A played CSA). The season's
 * teamNames provide the base USA side (in case the season labels are swapped);
 * `flipped` then inverts it for that round. Map validity is checked against the
 * app's known area list so the UI can prompt for manual selection otherwise.
 */
export function buildRoundAutofill(
  sb: Scoreboard,
  teamNames: TeamNames,
  validMaps: string[],
  flipped = false,
): RoundAutofill {
  const areaRaw = sb.meta.area;
  const validMap = areaRaw != null && validMaps.includes(areaRaw);
  const winner = sb.meta.winner;

  // Base side that plays USA when not flipped (defaults to A).
  const baseUsaSide: 'A' | 'B' = teamNames.B === 'USA' && teamNames.A !== 'USA' ? 'B' : 'A';
  const usaSide: 'A' | 'B' = flipped ? other(baseUsaSide) : baseUsaSide;
  const csaSide = other(usaSide);

  const sideAFaction: Team = usaSide === 'A' ? 'USA' : 'CSA';
  const sideBFaction: Team = sideAFaction === 'USA' ? 'CSA' : 'USA';

  const winnerSide = winner === 'USA' ? usaSide : winner === 'CSA' ? csaSide : null;
  // A Conquest/Contention round with no winner is a draw (both sides held).
  const isDraw = winner == null && mapMode(areaRaw ?? '') === 'conquest';
  const formOf = (faction: Team): FormationCounts => {
    const c = sb.meta.casualties[faction];
    return { in_form: c.inForm, skirm: c.skirm, oob: c.oob };
  };
  const moraleOf = (faction: Team): Morale | null =>
    normalizeMorale(faction === 'USA' ? sb.meta.moraleUsa : sb.meta.moraleCsa);

  return {
    mapset: sb.meta.map,
    areaRaw,
    area: validMap ? areaRaw : null,
    validMap,
    winner,
    winnerSide,
    isDraw,
    flipped,
    sideAFaction,
    sideBFaction,
    casualtiesA: sb.meta.casualties[sideAFaction].total,
    casualtiesB: sb.meta.casualties[sideBFaction].total,
    casualtiesFormA: formOf(sideAFaction),
    casualtiesFormB: formOf(sideBFaction),
    moraleA: moraleOf(sideAFaction),
    moraleB: moraleOf(sideBFaction),
  };
}

/** The Week field updates implied by an autofill, for a given round (1|2). */
export function roundFieldUpdates(round: 1 | 2, af: RoundAutofill): Record<string, unknown> {
  if (round === 1) {
    return {
      round1Map: af.area,
      round1Winner: af.winnerSide,
      round1Draw: af.isDraw,
      r1CasualtiesA: af.casualtiesA,
      r1CasualtiesB: af.casualtiesB,
      r1CasualtiesFormA: af.casualtiesFormA,
      r1CasualtiesFormB: af.casualtiesFormB,
      r1MoraleA: af.moraleA,
      r1MoraleB: af.moraleB,
    };
  }
  return {
    round2Map: af.area,
    round2Winner: af.winnerSide,
    round2Draw: af.isDraw,
    r2CasualtiesA: af.casualtiesA,
    r2CasualtiesB: af.casualtiesB,
    r2CasualtiesFormA: af.casualtiesFormA,
    r2CasualtiesFormB: af.casualtiesFormB,
    r2MoraleA: af.moraleA,
    r2MoraleB: af.moraleB,
  };
}
