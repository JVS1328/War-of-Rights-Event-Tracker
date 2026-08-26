import type { Scoreboard } from './types';
import type { RegimentAssignmentMap, ScopedAssignments, ScoreboardBinding, StoredScoreboard } from './StatsRepository';
import type { TrackerMapStats } from './statsEngine';
import { byRecency } from '../utils/seasonOrder';

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

/**
 * Regiment rename/merge maps keyed by scope. A scope key is either
 * {@link OVERALL_SCOPE} (applies to every season) or a season id (applies only
 * when that season is resolved). Each value is a `sourceLabel → targetLabel`
 * map. The Overall view resolves each scoreboard under its own season's scope
 * (season entries layered over Overall), so a unit renamed/merged in one season
 * keeps its own identity in the others.
 */
export type ScopedAliases = Record<string, Record<string, string>>;

/**
 * Coerce a possibly-legacy alias value into the scoped shape. A flat
 * `Record<string, string>` (the pre-scoping format) becomes an Overall-only
 * scope; an already-scoped map is returned as-is. Detection: a scoped map's
 * values are objects, a flat map's values are strings.
 */
export function normalizeScopedAliases(
  x: ScopedAliases | Record<string, string> | undefined | null,
): ScopedAliases {
  if (!x || typeof x !== 'object') return {};
  const values = Object.values(x);
  const isFlat = values.some((v) => typeof v === 'string');
  if (isFlat) {
    const flat = x as Record<string, string>;
    return Object.keys(flat).length ? { [OVERALL_SCOPE]: { ...flat } } : {};
  }
  const out: ScopedAliases = {};
  for (const [scope, map] of Object.entries(x as ScopedAliases)) {
    if (map && typeof map === 'object' && Object.keys(map).length) out[scope] = { ...map };
  }
  return out;
}

/**
 * The flat rename/merge map to apply for a given scope: Overall entries with the
 * season's own entries layered on top (season wins). For {@link OVERALL_SCOPE}
 * this is just the Overall entries.
 */
export function effectiveAliasMap(scoped: ScopedAliases, scope: string): Record<string, string> {
  const overall = scoped[OVERALL_SCOPE] ?? {};
  if (scope === OVERALL_SCOPE) return { ...overall };
  return { ...overall, ...(scoped[scope] ?? {}) };
}

/**
 * For the Overall view (option B): map each scoreboard (by sourceFilename) to
 * the effective alias map for the season it belongs to. A scoreboard belongs to
 * a season when its `binding.weekId` is one of that season's `weekIds`; unbound
 * scoreboards (and any whose season has no entry) fall back to Overall.
 */
export function aliasMapBySource(
  stored: { scoreboard: { sourceFilename: string }; binding?: ScoreboardBinding }[],
  seasons: StatsBundleSeason[] | undefined,
  scoped: ScopedAliases,
): Map<string, Record<string, string>> {
  const weekToSeason = new Map<string, string>();
  for (const s of seasons ?? []) for (const w of s.weekIds) weekToSeason.set(w, s.id);
  // Cache one merged map per scope so boards in the same season share the object.
  const byScope = new Map<string, Record<string, string>>();
  const forScope = (scope: string) => {
    let m = byScope.get(scope);
    if (!m) {
      m = effectiveAliasMap(scoped, scope);
      byScope.set(scope, m);
    }
    return m;
  };
  const out = new Map<string, Record<string, string>>();
  for (const r of stored) {
    const seasonId = r.binding ? weekToSeason.get(r.binding.weekId) : undefined;
    out.set(r.scoreboard.sourceFilename, forScope(seasonId ?? OVERALL_SCOPE));
  }
  return out;
}

// Steam-id assignments (pins) share the exact scoped shape (scope → key → value)
// and layering rules as aliases, so these generic aliases document intent at the
// assignment call sites without a second copy of the logic.
export const normalizeScopedMap = normalizeScopedAliases;
export const effectiveScopedMap = effectiveAliasMap;
export const scopedMapBySource = aliasMapBySource;

export interface StatsBundle {
  v: number;
  scoreboards: StatsBundleEntry[];
  /**
   * Steam-id pins. Carries the Overall scope only (back-compat); newer viewers
   * prefer {@link StatsBundle.assignmentsScoped}.
   */
  assignments: RegimentAssignmentMap;
  /**
   * Season-scoped steam-id pins (scope → steamId → label). Present only when at
   * least one season-specific pin exists; otherwise omitted and viewers rely on
   * {@link StatsBundle.assignments}.
   */
  assignmentsScoped?: ScopedAssignments;
  /**
   * Regiment rename/merge map (sourceLabel → targetLabel). Carries the Overall
   * scope only, so viewers predating season-scoped aliases still apply the
   * event-wide renames. Newer viewers prefer {@link StatsBundle.aliasesScoped}.
   */
  aliases: Record<string, string>;
  /**
   * Season-scoped rename/merge maps (scope → sourceLabel → targetLabel). Present
   * only when at least one season-specific alias exists; Overall-only events omit
   * it and rely on {@link StatsBundle.aliases}. Bundles shared before this field
   * existed simply lack it and degrade to the Overall map.
   */
  aliasesScoped?: ScopedAliases;
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
  /**
   * Pre-computed map stats from the tracker's Elo engine, keyed by season id
   * plus an "overall" entry for event-wide stats. The shared view picks the
   * right slice based on the user's season filter.
   */
  mapStats?: {
    overall: TrackerMapStats;
    bySeason: Record<string, TrackerMapStats>;
  };
}

export interface BundleOptions {
  /**
   * Carry every field the parser produced, `joinLeaves` included.
   *
   * The default drops it, because a share link has to survive being pasted into
   * a chat window and nothing reads that log anyway. A database has no such
   * pressure and is meant to be the record, so the publish path asks for the
   * whole thing — what goes in is what came out of the scoreboard.
   */
  full?: boolean;
}

/**
 * Pack stored scoreboards + assignments + aliases into an event-agnostic bundle.
 * `aliases` is the flat Overall map (back-compat); pass `scopedAliases` to also
 * carry season-scoped renames/merges so a shared view reproduces per-season
 * resolution. When `scopedAliases` is given it supersedes `aliases` as the
 * source of the Overall map, so callers can pass the whole scoped structure and
 * leave `aliases` empty.
 */
export function buildStatsBundle(
  records: StoredScoreboard[],
  assignments: RegimentAssignmentMap,
  aliases: Record<string, string> = {},
  registryUnits: string[] = [],
  seasons: StatsBundleSeason[] = [],
  scopedAliases?: ScopedAliases,
  scopedAssignments?: ScopedAssignments,
  options: BundleOptions = {},
): StatsBundle {
  const scoped = scopedAliases
    ? normalizeScopedAliases(scopedAliases)
    : normalizeScopedAliases(aliases);
  const overall = scoped[OVERALL_SCOPE] ?? {};
  const scopedAsg = scopedAssignments
    ? normalizeScopedMap(scopedAssignments)
    : normalizeScopedMap(assignments);
  const overallAsg = scopedAsg[OVERALL_SCOPE] ?? {};
  // Only carry the scoped fields when a season-specific scope exists — Overall-only
  // events stay as lean as before this feature.
  const hasSeasonScope = Object.keys(scoped).some((s) => s !== OVERALL_SCOPE);
  const hasSeasonAsg = Object.keys(scopedAsg).some((s) => s !== OVERALL_SCOPE);
  return {
    v: STATS_BUNDLE_VERSION,
    scoreboards: records.map((r) => ({
      sourceFilename: r.scoreboard.sourceFilename,
      // joinLeaves is parsed but read by no stat or view, so it is dead weight
      // in a share link or an export file — see BundleOptions.full for when it
      // is kept.
      scoreboard: options.full ? r.scoreboard : { ...r.scoreboard, joinLeaves: [] },
      ...(r.binding ? { binding: r.binding } : {}),
    })),
    assignments: { ...overallAsg },
    ...(hasSeasonAsg ? { assignmentsScoped: scopedAsg } : {}),
    aliases: { ...overall },
    ...(hasSeasonScope ? { aliasesScoped: scoped } : {}),
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

/**
 * Which scope a stats view opens on: the most recent season holding any of
 * these scoreboards, else Overall. Newest-season-first is what people mean by
 * "the stats" — but a season nobody has bound a round to yet would open blank,
 * and unbound scoreboards only ever surface under Overall, so an event with
 * nothing bound still starts there.
 */
export function defaultSeasonScope(
  seasons: StatsBundleSeason[] | undefined,
  stored: { binding?: ScoreboardBinding }[],
): string {
  const bound = new Set(stored.map((r) => r.binding?.weekId).filter(Boolean) as string[]);
  const season = byRecency(seasons ?? []).find((s) => s.weekIds.some((w) => bound.has(String(w))));
  return season?.id ?? OVERALL_SCOPE;
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
