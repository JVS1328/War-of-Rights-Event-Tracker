import { saveEvent, getTrackerState, putTrackerState } from './events';
import type { CloudEvent } from './events';
import { isStatsBundle } from '../stats/statsBundle';
import type { StatsBundle, StatsBundleSeason } from '../stats/statsBundle';
import { migrateLegacyFlatToV2 } from '../utils/eventStore';
import { cloudStatsRepo } from '../stats/repo';
import type { TrackerMapStats } from '../stats/statsEngine';

/**
 * Getting an event into the database, and back out again.
 *
 * Everything the suite has ever produced — a season the tracker is running
 * right now, an exported event file, an old flat-shape season JSON — comes
 * through here, is normalised to one event tree, and is written as three
 * things: the event's meta (the directory row), its tracker state (the season
 * itself), and its player stats (round by round).
 */

/** What the `tracker` resource holds: one tracker Event, versioned. */
export const TRACKER_STATE_VERSION = 1;

export interface TrackerStatePayload {
  v: number;
  event: TrackerEvent;
}

/**
 * The tracker's event tree. Typed loosely on purpose: it is defined by
 * utils/eventStore (plain JS) and this module only ever carries it around.
 */
export interface TrackerEvent {
  id: string;
  name: string;
  seasons: { id: string; name: string; weeks?: { id: string | number }[] }[];
  unitRegistry?: Record<string, { name: string }>;
  [key: string]: unknown;
}

export interface NormalizedExport {
  event: TrackerEvent;
  stats: StatsBundle | null;
}

/**
 * Read whatever the tracker's Export button produced. A multi-season export is
 * an event tree already; a single-season one is the old flat shape and gets
 * migrated the same way opening the file in the tracker would.
 */
export function eventFromExport(data: unknown): NormalizedExport {
  if (!data || typeof data !== 'object') throw new Error('That file is not a season or event export.');
  const raw = data as Record<string, unknown>;
  const stats = isStatsBundle(raw.stats) ? (raw.stats as StatsBundle) : null;

  if (raw.kind === 'event' && raw.event && typeof raw.event === 'object') {
    const event = raw.event as TrackerEvent;
    if (!Array.isArray(event.seasons)) throw new Error('That event file has no seasons in it.');
    return { event, stats };
  }

  if (Array.isArray(raw.events) && raw.events.length) {
    // A whole-app export: take the active event, or the first one.
    const events = raw.events as TrackerEvent[];
    const event = events.find((e) => e.id === raw.activeEventId) ?? events[0];
    return { event, stats };
  }

  if (Array.isArray(raw.weeks) || Array.isArray(raw.units) || Array.isArray(raw.season)) {
    const migrated = migrateLegacyFlatToV2(raw) as { events: TrackerEvent[] };
    return { event: migrated.events[0], stats };
  }

  throw new Error('That file is not a season or event export.');
}

/** The seasons an event has, in the shape the stats screens filter by. */
export const seasonRefsOf = (event: TrackerEvent): StatsBundleSeason[] =>
  (event.seasons ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    weekIds: (s.weeks ?? []).map((w) => String(w.id)),
  }));

/** The event's registry unit names, which the stats screens resolve against. */
export const registryUnitsOf = (event: TrackerEvent): string[] =>
  Object.values(event.unitRegistry ?? {})
    .map((u) => u?.name)
    .filter((n): n is string => !!n);

export interface PublishInput {
  slug: string;
  event: TrackerEvent;
  /** Player stats to upload. Omit to leave whatever is already stored alone. */
  stats?: StatsBundle | null;
  published?: boolean;
  /** Map win/loss tallies, which the tracker computes and the site displays. */
  mapStats?: { overall?: TrackerMapStats; bySeason?: Record<string, TrackerMapStats> } | null;
  /** Called after each round goes up, so the screen can show progress. */
  onProgress?: (done: number, total: number) => void;
}

export interface PublishResult {
  event: CloudEvent;
  scoreboards: number;
}

/**
 * Write an event to the database. Meta first so the event exists, then the
 * tracker state, then the rounds one at a time — a big season is a lot of
 * killfeed, and one request per round is what keeps each one inside the
 * platform's body limit.
 */
export async function publishEvent(input: PublishInput): Promise<PublishResult> {
  const { slug, event, stats, mapStats, onProgress } = input;

  const meta = await saveEvent({
    slug,
    name: event.name,
    published: input.published,
    seasons: seasonRefsOf(event),
    registryUnits: registryUnitsOf(event),
    mapStats: mapStats ?? null,
  });

  await putTrackerState(slug, { v: TRACKER_STATE_VERSION, event } satisfies TrackerStatePayload);

  let scoreboards = 0;
  if (stats?.scoreboards?.length || stats?.assignments || stats?.aliases) {
    const total = stats.scoreboards?.length ?? 0;
    onProgress?.(0, total);
    for (const [i, entry] of (stats.scoreboards ?? []).entries()) {
      await cloudStatsRepo.saveScoreboard(slug, entry.scoreboard, entry.binding);
      scoreboards += 1;
      onProgress?.(i + 1, total);
    }
    // Pins and renames go up as one document each, after the rounds they describe.
    await cloudStatsRepo.importEventStats(slug, { ...stats, scoreboards: [] });
  }

  return { event: meta, scoreboards };
}

/**
 * Read an event's tracker state back out. Returns null when the event has meta
 * but no season stored yet — a stats-only event, which the site still shows.
 */
export async function pullTrackerEvent(slug: string): Promise<TrackerEvent | null> {
  try {
    const payload = await getTrackerState<TrackerStatePayload>(slug);
    return payload?.event ?? null;
  } catch {
    return null;
  }
}

/**
 * The app-state shape the Elo engine and the season derivations expect, built
 * around a single event. The public site never holds an app state of its own,
 * so it synthesises one per event it draws.
 */
export const appStateForEvent = (event: TrackerEvent) => ({
  schemaVersion: 2,
  activeEventId: event.id,
  activeSeasonId: event.seasons?.[0]?.id ?? null,
  events: [event],
});
