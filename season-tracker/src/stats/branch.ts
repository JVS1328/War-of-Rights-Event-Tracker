/**
 * Which arm of service a player was in, read off the in-game regiment the
 * roster records for that round.
 *
 * The tracker used to ask one question — "is this a battery?" — which made
 * every cavalry round count as infantry. War of Rights fields four mounted
 * regiments, so they get named here; everything else falls back to reading the
 * regiment name, then to infantry.
 */
import type { Branch } from './types';

/** The game's mounted regiments. Two are Union, two Confederate. */
export const CAVALRY_REGIMENTS = [
  '1st Virginia',
  '4th Pennsylvania',
  '6th Pennsylvania',
  'Jeff Davis Legion',
] as const;

const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

const CAVALRY_SET = new Set<string>(CAVALRY_REGIMENTS.map(normalize));

/**
 * An explicit arm in the name always wins, because a unit that says what it is
 * is more reliable than a lookup — "1st Virginia Infantry" is infantry even
 * though a mounted "1st Virginia" also exists.
 */
export function branchOf(regiment: string | null | undefined): Branch {
  if (!regiment) return 'Infantry';
  const n = normalize(regiment);

  if (/\binfantry\b/.test(n)) return 'Infantry';
  if (/\bcavalry\b|\bcav\b/.test(n)) return 'Cavalry';
  if (/batter|artiller|\barty\b/.test(n)) return 'Artillery';

  // No arm in the name: fall back to the mounted roster, allowing a trailing
  // "cavalry"/"cav" to have already been stripped by the checks above.
  if (CAVALRY_SET.has(n)) return 'Cavalry';

  return 'Infantry';
}

/** Kept for the places that only ever asked "was this a battery?". */
export const isArtilleryRegiment = (regiment: string | null | undefined): boolean =>
  branchOf(regiment) === 'Artillery';

/** Filter value used by the player leaderboard and the player card. */
export type BranchFilter = 'all' | 'Infantry' | 'Cavalry' | 'Artillery';

export const BRANCH_FILTERS: BranchFilter[] = ['all', 'Infantry', 'Cavalry', 'Artillery'];

/** True when a round played in `regiment` belongs under `filter`. */
export function matchesBranch(filter: BranchFilter, regiment: string | null | undefined): boolean {
  return filter === 'all' || branchOf(regiment) === filter;
}
