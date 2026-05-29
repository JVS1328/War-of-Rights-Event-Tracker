import type { Scoreboard } from './types';
import type { RegimentAssignmentMap, ScoreboardBinding, StoredScoreboard } from './StatsRepository';

/**
 * Portable player-stats payload: every scoreboard for an event plus its
 * regiment assignments, stripped of storage keys (id/eventId) so it can be
 * carried in an export file or a share link and restored under any event.
 */
export const STATS_BUNDLE_VERSION = 1;

export interface StatsBundleEntry {
  sourceFilename: string;
  scoreboard: Scoreboard;
  binding?: ScoreboardBinding;
}

export interface StatsBundle {
  v: number;
  scoreboards: StatsBundleEntry[];
  assignments: RegimentAssignmentMap;
}

/** Pack stored scoreboards + assignments into an event-agnostic bundle. */
export function buildStatsBundle(
  records: StoredScoreboard[],
  assignments: RegimentAssignmentMap,
): StatsBundle {
  return {
    v: STATS_BUNDLE_VERSION,
    scoreboards: records.map((r) => ({
      sourceFilename: r.scoreboard.sourceFilename,
      scoreboard: r.scoreboard,
      ...(r.binding ? { binding: r.binding } : {}),
    })),
    assignments: { ...assignments },
  };
}

/** Structural guard for untrusted payloads (imported files / share links). */
export function isStatsBundle(x: unknown): x is StatsBundle {
  if (!x || typeof x !== 'object') return false;
  const b = x as Record<string, unknown>;
  return Array.isArray(b.scoreboards) && typeof b.assignments === 'object' && b.assignments !== null;
}
