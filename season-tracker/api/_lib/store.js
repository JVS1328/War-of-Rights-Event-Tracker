import { Redis } from '@upstash/redis';

/**
 * The database behind the public stats site.
 *
 * Storage is Upstash Redis over its HTTP API — the same instance the share
 * links already use, so the deployment gains a database without gaining any
 * infrastructure. Everything the API touches goes through this module, which is
 * the only file that knows a key layout exists; moving to Postgres later is a
 * rewrite of this file and nothing else.
 *
 * Key layout
 *   wor:events              SET   published event slugs (the public directory)
 *   wor:e:<slug>            JSON  event meta (name, seasons, registry, mapStats)
 *   wor:e:<slug>:sum        HASH  scoreboard id -> summary row (for list views)
 *   wor:e:<slug>:sb:<id>    JSON  one full scoreboard record
 *   wor:e:<slug>:asg        JSON  season-scoped steam-id pins
 *   wor:e:<slug>:alias      JSON  season-scoped regiment renames/merges
 *   wor:e:<slug>:tracker    JSON  the event's tracker state (never public)
 *
 * Summaries live in a hash rather than one JSON blob so two imports landing at
 * once each update their own field instead of overwriting each other's.
 */

/** Upstash caps a single request near 1 MB; refuse anything close to it. */
export const MAX_VALUE_BYTES = 900_000;

const EVENTS_SET = 'wor:events';
const eventKey = (slug) => `wor:e:${slug}`;
const sumKey = (slug) => `wor:e:${slug}:sum`;
const sbKey = (slug, id) => `wor:e:${slug}:sb:${id}`;
const asgKey = (slug) => `wor:e:${slug}:asg`;
const aliasKey = (slug) => `wor:e:${slug}:alias`;
const trackerKey = (slug) => `wor:e:${slug}:tracker`;

// The Upstash Vercel integration injects REST URL/token under either the
// Upstash names or Vercel's KV-prefixed names depending on how it was added;
// accept both (matching api/share.js).
let client;
export function getRedis() {
  if (!client) {
    const url = process.env.UPSTASH_REDIS_REST_URL
      || process.env.KV_REST_API_URL
      || process.env.upstash_KV_REST_API_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN
      || process.env.KV_REST_API_TOKEN
      || process.env.upstash_KV_REST_API_TOKEN;
    if (!url || !token) {
      throw new Error('Upstash Redis is not configured (missing REST URL/token)');
    }
    // Values are JSON strings this module encodes and decodes itself, so the
    // SDK's own (de)serialization would double-encode them.
    client = new Redis({ url, token, automaticDeserialization: false });
  }
  return client;
}

/** Test seam: drop the memoized client so a fresh env is picked up. */
export function resetRedis() {
  client = undefined;
}

/** Thrown when a single value would exceed what Upstash accepts. */
export class ValueTooLargeError extends Error {
  constructor(bytes) {
    super(`Value is ${bytes} bytes, over the ${MAX_VALUE_BYTES}-byte limit`);
    this.name = 'ValueTooLargeError';
    this.bytes = bytes;
  }
}

function encode(value) {
  const json = JSON.stringify(value);
  const bytes = Buffer.byteLength(json, 'utf8');
  if (bytes > MAX_VALUE_BYTES) throw new ValueTooLargeError(bytes);
  return json;
}

function decode(raw) {
  if (raw == null) return null;
  if (typeof raw === 'object') return raw; // an SDK that deserialized for us
  try {
    return JSON.parse(raw);
  } catch {
    return null; // corrupt value reads as absent rather than crashing a page
  }
}

// --- Events ---------------------------------------------------------------

/** Every published event's meta, newest update first. */
export async function listPublishedEvents() {
  const redis = getRedis();
  const slugs = (await redis.smembers(EVENTS_SET)) ?? [];
  if (!slugs.length) return [];
  const raw = await redis.mget(...slugs.map(eventKey));
  return slugs
    .map((slug, i) => decode(raw?.[i]))
    .filter((meta) => meta && meta.published)
    .sort((a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')));
}

export async function getEvent(slug) {
  return decode(await getRedis().get(eventKey(slug)));
}

/**
 * Write an event's meta and keep the public directory in step: publishing adds
 * the slug to the set, unpublishing takes it out, so an unpublished event stops
 * being discoverable the moment the flag flips.
 */
export async function putEvent(slug, meta) {
  const redis = getRedis();
  await redis.set(eventKey(slug), encode(meta));
  if (meta.published) await redis.sadd(EVENTS_SET, slug);
  else await redis.srem(EVENTS_SET, slug);
  return meta;
}

/** Remove an event and everything filed under it. */
export async function deleteEvent(slug) {
  const redis = getRedis();
  const ids = Object.keys((await redis.hgetall(sumKey(slug))) ?? {});
  const keys = [
    eventKey(slug), sumKey(slug), asgKey(slug), aliasKey(slug), trackerKey(slug),
    ...ids.map((id) => sbKey(slug, id)),
  ];
  // Chunked so a long-running event's scoreboards don't build one huge command.
  for (let i = 0; i < keys.length; i += 128) await redis.del(...keys.slice(i, i + 128));
  await redis.srem(EVENTS_SET, slug);
  return ids.length;
}

// --- Scoreboards ----------------------------------------------------------

/** Summary rows for every scoreboard in an event (the list view's payload). */
export async function listSummaries(slug) {
  const raw = (await getRedis().hgetall(sumKey(slug))) ?? {};
  return Object.values(raw).map(decode).filter(Boolean);
}

export async function getScoreboard(slug, id) {
  return decode(await getRedis().get(sbKey(slug, id)));
}

/** Fetch several scoreboards at once — the read path behind a whole event. */
export async function getScoreboards(slug, ids) {
  if (!ids.length) return [];
  const raw = await getRedis().mget(...ids.map((id) => sbKey(slug, id)));
  return ids.map((_, i) => decode(raw?.[i])).filter(Boolean);
}

/** Upsert one scoreboard plus its summary row. */
export async function putScoreboard(slug, id, record, summary) {
  const redis = getRedis();
  await redis.set(sbKey(slug, id), encode(record));
  await redis.hset(sumKey(slug), { [id]: encode(summary) });
}

export async function deleteScoreboard(slug, id) {
  const redis = getRedis();
  await redis.del(sbKey(slug, id));
  await redis.hdel(sumKey(slug), id);
}

// --- Assignments / aliases / tracker state --------------------------------

export async function getAssignments(slug) {
  return decode(await getRedis().get(asgKey(slug))) ?? {};
}

export async function putAssignments(slug, scoped) {
  await getRedis().set(asgKey(slug), encode(scoped));
}

export async function getAliases(slug) {
  return decode(await getRedis().get(aliasKey(slug))) ?? {};
}

export async function putAliases(slug, scoped) {
  await getRedis().set(aliasKey(slug), encode(scoped));
}

/**
 * The tracker's own state (weeks, rosters, standings settings). Stored beside
 * the stats but never served publicly — the public site is player stats only.
 */
export async function getTracker(slug) {
  return decode(await getRedis().get(trackerKey(slug)));
}

export async function putTracker(slug, state) {
  await getRedis().set(trackerKey(slug), encode(state));
}

/** How many scoreboards an event holds, without reading any of them. */
export async function countScoreboards(slug) {
  return (await getRedis().hlen(sumKey(slug))) ?? 0;
}
