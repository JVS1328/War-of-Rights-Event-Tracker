import { query } from './sql.js';
import { DOC_KINDS } from './schema.js';

/**
 * The database behind the public stats site.
 *
 * Storage is Postgres on Neon, reached over HTTP by the serverless driver.
 * Everything the API touches goes through this module, which is the only file
 * that knows a table layout exists — the router above it asks for events and
 * rounds and never writes a query.
 *
 * See schema.js for the tables. The shape follows how the site reads: a
 * scoreboard's summary columns sit beside its payload so a list view never
 * loads a killfeed, and an event's pins, renames and tracker state are single
 * JSON documents because that is exactly how the screens hold them.
 */

/**
 * Neon's HTTP endpoint will take a much larger row than this, but a scoreboard
 * past a megabyte is a sign something has gone wrong upstream rather than a
 * round anyone recorded — and refusing it with a clear message beats a timeout.
 */
export const MAX_VALUE_BYTES = 4_000_000;

/** Share links live a year, which is long enough that nobody notices. */
const SHARE_TTL_SECONDS = 31_536_000;

/** Thrown when a single value is too large to store. */
export class ValueTooLargeError extends Error {
  constructor(bytes) {
    super(`Value is ${bytes} bytes, over the ${MAX_VALUE_BYTES}-byte limit`);
    this.name = 'ValueTooLargeError';
    this.bytes = bytes;
  }
}

function sized(value) {
  const json = JSON.stringify(value ?? null);
  const bytes = Buffer.byteLength(json, 'utf8');
  if (bytes > MAX_VALUE_BYTES) throw new ValueTooLargeError(bytes);
  return json;
}

/** A row's JSONB column, whether the driver handed it back parsed or as text. */
function asJson(value, fallback = null) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

// --- Events ---------------------------------------------------------------

/** An event row as the API talks about it. */
function toEvent(row) {
  if (!row) return null;
  return {
    slug: row.slug,
    name: row.name,
    published: !!row.published,
    seasons: asJson(row.seasons, []),
    registryUnits: asJson(row.registry_units, []),
    mapStats: asJson(row.map_stats, null),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    scoreboardCount: Number(row.scoreboard_count ?? 0),
  };
}

// The directory and the event page both want the round count, and counting in
// the same statement beats keeping a denormalised tally honest.
const EVENT_COLUMNS = `
  e.slug, e.name, e.published, e.seasons, e.registry_units, e.map_stats,
  e.created_at, e.updated_at,
  (SELECT count(*) FROM wor_scoreboards s WHERE s.event_slug = e.slug) AS scoreboard_count
`;

/** Every published event, most recently updated first. */
export async function listPublishedEvents() {
  const rows = await query(
    `SELECT ${EVENT_COLUMNS} FROM wor_events e WHERE e.published ORDER BY e.updated_at DESC`,
  );
  return rows.map(toEvent);
}

export async function getEvent(slug) {
  const rows = await query(`SELECT ${EVENT_COLUMNS} FROM wor_events e WHERE e.slug = $1`, [slug]);
  return toEvent(rows[0]);
}

/**
 * Create or update an event. `createdAt` is left alone on an update — it is the
 * one field about an event that is not the caller's to revise.
 */
export async function putEvent(slug, meta) {
  const rows = await query(
    `INSERT INTO wor_events (slug, name, published, seasons, registry_units, map_stats, updated_at)
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, now())
     ON CONFLICT (slug) DO UPDATE SET
       name = EXCLUDED.name,
       published = EXCLUDED.published,
       seasons = EXCLUDED.seasons,
       registry_units = EXCLUDED.registry_units,
       map_stats = EXCLUDED.map_stats,
       updated_at = now()
     RETURNING slug, name, published, seasons, registry_units, map_stats, created_at, updated_at`,
    [
      slug,
      meta.name,
      !!meta.published,
      sized(meta.seasons ?? []),
      sized(meta.registryUnits ?? []),
      meta.mapStats == null ? null : sized(meta.mapStats),
    ],
  );
  return toEvent({ ...rows[0], scoreboard_count: meta.scoreboardCount ?? 0 });
}

/** Remove an event. Its rounds and documents go with it, by foreign key. */
export async function deleteEvent(slug) {
  const rows = await query(
    `WITH gone AS (DELETE FROM wor_scoreboards WHERE event_slug = $1 RETURNING 1)
     SELECT count(*)::int AS n FROM gone`,
    [slug],
  );
  await query('DELETE FROM wor_events WHERE slug = $1', [slug]);
  return Number(rows[0]?.n ?? 0);
}

// --- Scoreboards ----------------------------------------------------------

function toSummary(row) {
  return {
    id: row.id,
    eventId: row.event_slug,
    ...(row.week_id ? { binding: { weekId: row.week_id, round: Number(row.round) } } : {}),
    sourceFilename: row.source_filename,
    recordedAt: row.recorded_at,
    map: row.map,
    mode: row.mode,
    area: row.area,
    winner: row.winner,
  };
}

/** Summary rows for every round in an event — the list view's whole payload. */
export async function listSummaries(slug) {
  const rows = await query(
    `SELECT id, event_slug, source_filename, recorded_at, map, mode, area, winner, week_id, round
       FROM wor_scoreboards WHERE event_slug = $1 ORDER BY recorded_at DESC NULLS LAST, id`,
    [slug],
  );
  return rows.map(toSummary);
}

export async function getScoreboard(slug, id) {
  const rows = await query(
    'SELECT payload FROM wor_scoreboards WHERE event_slug = $1 AND id = $2',
    [slug, id],
  );
  return rows.length ? asJson(rows[0].payload) : null;
}

/** Several rounds at once, in the order asked for. */
export async function getScoreboards(slug, ids) {
  if (!ids.length) return [];
  const rows = await query(
    'SELECT id, payload FROM wor_scoreboards WHERE event_slug = $1 AND id = ANY($2)',
    [slug, ids],
  );
  const byId = new Map(rows.map((r) => [r.id, asJson(r.payload)]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

/** Upsert one round: its payload, and the columns a list view reads. */
export async function putScoreboard(slug, id, record, summary) {
  await query(
    `INSERT INTO wor_scoreboards
       (event_slug, id, source_filename, recorded_at, map, mode, area, winner, week_id, round, payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
     ON CONFLICT (event_slug, id) DO UPDATE SET
       source_filename = EXCLUDED.source_filename,
       recorded_at = EXCLUDED.recorded_at,
       map = EXCLUDED.map,
       mode = EXCLUDED.mode,
       area = EXCLUDED.area,
       winner = EXCLUDED.winner,
       week_id = EXCLUDED.week_id,
       round = EXCLUDED.round,
       payload = EXCLUDED.payload`,
    [
      slug,
      id,
      String(summary.sourceFilename ?? ''),
      summary.recordedAt ?? null,
      summary.map ?? null,
      summary.mode ?? null,
      summary.area ?? null,
      summary.winner ?? null,
      summary.binding?.weekId != null ? String(summary.binding.weekId) : null,
      summary.binding?.round ?? null,
      sized(record),
    ],
  );
}

export async function deleteScoreboard(slug, id) {
  await query('DELETE FROM wor_scoreboards WHERE event_slug = $1 AND id = $2', [slug, id]);
}

/** How many rounds an event holds, without reading any of them. */
export async function countScoreboards(slug) {
  const rows = await query(
    'SELECT count(*)::int AS n FROM wor_scoreboards WHERE event_slug = $1',
    [slug],
  );
  return Number(rows[0]?.n ?? 0);
}

// --- Per-event documents --------------------------------------------------

async function getDoc(slug, kind, fallback) {
  const rows = await query(
    'SELECT doc FROM wor_event_docs WHERE event_slug = $1 AND kind = $2',
    [slug, kind],
  );
  return rows.length ? asJson(rows[0].doc, fallback) : fallback;
}

async function putDoc(slug, kind, doc) {
  await query(
    `INSERT INTO wor_event_docs (event_slug, kind, doc, updated_at)
     VALUES ($1, $2, $3::jsonb, now())
     ON CONFLICT (event_slug, kind) DO UPDATE SET doc = EXCLUDED.doc, updated_at = now()`,
    [slug, kind, sized(doc)],
  );
}

export const getAssignments = (slug) => getDoc(slug, DOC_KINDS.assignments, {});
export const putAssignments = (slug, scoped) => putDoc(slug, DOC_KINDS.assignments, scoped);

export const getAliases = (slug) => getDoc(slug, DOC_KINDS.aliases, {});
export const putAliases = (slug, scoped) => putDoc(slug, DOC_KINDS.aliases, scoped);

/**
 * The tracker's own state — weeks, rosters, settings, brackets. Public to read
 * once the event is published, since the site shows the season as well as the
 * player stats; owner-only to write.
 */
export const getTracker = (slug) => getDoc(slug, DOC_KINDS.tracker, null);
export const putTracker = (slug, state) => putDoc(slug, DOC_KINDS.tracker, state);

// --- Share links ----------------------------------------------------------

/**
 * Share chunks are content-addressed and written once: the id is a hash of the
 * payload, so a row that exists already holds these exact bytes. Insert-or-
 * ignore means a re-share is a no-op and — the part that matters — nobody can
 * rewrite what sits behind a link somebody else already has. A repeat share
 * pushes the expiry out instead, so it does not lapse a year after the first.
 */
export async function putShareChunk(id, idx, chunk) {
  await query(
    `INSERT INTO wor_shares (id, idx, chunk, expires_at)
     VALUES ($1, $2, $3, now() + ($4 || ' seconds')::interval)
     ON CONFLICT (id, idx) DO UPDATE SET expires_at = EXCLUDED.expires_at`,
    [id, idx, chunk, String(SHARE_TTL_SECONDS)],
  );
}

export async function getShareChunk(id, idx) {
  const rows = await query(
    'SELECT chunk FROM wor_shares WHERE id = $1 AND idx = $2 AND expires_at > now()',
    [id, idx],
  );
  return rows.length ? rows[0].chunk : null;
}
