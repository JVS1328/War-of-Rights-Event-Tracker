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

/**
 * Minimal season descriptor carried in a bundle so a read-only shared view can
 * draw the same per-season filter the live tracker has. A scoreboard belongs to
 * a season when its `binding.weekId` is one of that season's `weekIds`.
 */
export interface StatsBundleSeason {
  id: string;
  name: string;
  weekIds: string[];
}

/** Filter scope meaning "every season combined" (no season restriction). */
export const OVERALL_SCOPE = 'overall';

export interface StatsBundle {
  v: number;
  scoreboards: StatsBundleEntry[];
  assignments: RegimentAssignmentMap;
  /** Regiment rename/merge map (sourceLabel → targetLabel). */
  aliases: Record<string, string>;
  /**
   * The event's registry unit names, so a read-only shared view resolves (and
   * merges) regiments identically to the live editor. Without this, registry-
   * matched players fall back to the raw name tag and alias merges miss.
   * Optional: bundles shared before this field existed simply lack it.
   */
  registryUnits?: string[];
  /**
   * The event's seasons (id, name, and the week ids each owns) so the shared
   * view can offer per-season + Overall filtering. Optional: links shared
   * before this field existed simply lack it, and the view degrades to Overall.
   */
  seasons?: StatsBundleSeason[];
}

/** Pack stored scoreboards + assignments + aliases into an event-agnostic bundle. */
export function buildStatsBundle(
  records: StoredScoreboard[],
  assignments: RegimentAssignmentMap,
  aliases: Record<string, string> = {},
  registryUnits: string[] = [],
  seasons: StatsBundleSeason[] = [],
): StatsBundle {
  return {
    v: STATS_BUNDLE_VERSION,
    scoreboards: records.map((r) => ({
      sourceFilename: r.scoreboard.sourceFilename,
      // Drop joinLeaves — it's parsed but never read by any stat or view, and is
      // dead weight that bloats share links / export files.
      scoreboard: { ...r.scoreboard, joinLeaves: [] },
      ...(r.binding ? { binding: r.binding } : {}),
    })),
    assignments: { ...assignments },
    aliases: { ...aliases },
    registryUnits: [...registryUnits],
    // Omitted when empty so older/seasonless payloads stay lean.
    ...(seasons.length
      ? { seasons: seasons.map((s) => ({ id: s.id, name: s.name, weekIds: [...s.weekIds] })) }
      : {}),
  };
}

/**
 * Week ids in scope for a season filter, or `null` when the scope is "overall"
 * (or the season is unknown / there are no seasons) — `null` means "no
 * restriction, include every scoreboard". Callers keep only scoreboards whose
 * `binding.weekId` is in the returned set; unbound scoreboards therefore appear
 * only under Overall.
 */
export function weekIdsForScope(
  seasons: StatsBundleSeason[] | undefined,
  scope: string,
): Set<string> | null {
  if (!seasons || scope === OVERALL_SCOPE) return null;
  const season = seasons.find((s) => s.id === scope);
  return season ? new Set(season.weekIds) : null;
}

/** Structural guard for untrusted payloads (imported files / share links). */
export function isStatsBundle(x: unknown): x is StatsBundle {
  if (!x || typeof x !== 'object') return false;
  const b = x as Record<string, unknown>;
  return Array.isArray(b.scoreboards) && typeof b.assignments === 'object' && b.assignments !== null;
}

/** Synthetic event id for read-only, in-memory bundles (shared links). */
export const SHARED_EVENT_ID = 'shared';

/**
 * Inverse of {@link buildStatsBundle}: rebuild StoredScoreboard records from a
 * bundle for read-only viewing, without touching the repository. Ids mirror the
 * repo's `${eventId}::${sourceFilename}` scheme so list keys stay stable.
 */
export function storedFromBundle(bundle: StatsBundle, eventId: string = SHARED_EVENT_ID): StoredScoreboard[] {
  return (bundle.scoreboards ?? []).map((e) => ({
    id: `${eventId}::${e.sourceFilename}`,
    eventId,
    scoreboard: e.scoreboard,
    ...(e.binding ? { binding: e.binding } : {}),
  }));
}
