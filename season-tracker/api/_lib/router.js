import { isAdmin, adminConfigured } from './auth.js';
import { isSlug, isScoreboardId } from './slug.js';
import * as store from './store.js';

/**
 * The whole database API, served from one serverless function at /api/db/*.
 *
 * Reads are public — that is the point of the thing: anyone can open the site,
 * find the event they play in and read its season and its player stats without
 * being handed a link. Every write needs the admin pass as a bearer credential
 * (see _lib/auth.js), because there is exactly one person who runs the league.
 * One function rather than a dozen files keeps the deployment inside Vercel's
 * per-project function budget.
 *
 *   GET    /api/db/auth                              is my admin pass good?
 *   GET    /api/db/events                            published events
 *   POST   /api/db/events                       (w)  create/update an event
 *   GET    /api/db/events/:slug                      one event's meta
 *   DELETE /api/db/events/:slug                 (w)  drop an event and its data
 *   GET    /api/db/events/:slug/scoreboards          summary rows
 *   GET    /api/db/events/:slug/scoreboards?full=1   full records, paged
 *   GET    /api/db/events/:slug/scoreboard?id=       one full record
 *   PUT    /api/db/events/:slug/scoreboard?id=  (w)  save one record
 *   DELETE /api/db/events/:slug/scoreboard?id=  (w)  delete one record
 *   GET    /api/db/events/:slug/assignments          steam-id pins
 *   PUT    /api/db/events/:slug/assignments     (w)
 *   GET    /api/db/events/:slug/aliases              regiment renames/merges
 *   PUT    /api/db/events/:slug/aliases         (w)
 *   GET    /api/db/events/:slug/tracker              tracker state (season, weeks)
 *   PUT    /api/db/events/:slug/tracker         (w)
 */

/** A full-scoreboard page stops here, well inside Vercel's 4.5 MB response cap. */
const PAGE_BYTES = 3_000_000;
const PAGE_LIMIT = 200;

const json = (res, code, body) => res.status(code).json(body);
const notFound = (res) => json(res, 404, { error: 'Not found' });
const denied = (res) => json(res, 401, {
  error: adminConfigured()
    ? 'This action needs the admin pass'
    : 'No admin pass is configured on this deployment, so writes are refused',
});

/** Path segments after /api/db, from the platform's catch-all or the raw URL. */
function segmentsOf(req) {
  const fromQuery = req?.query?.path;
  if (Array.isArray(fromQuery)) return fromQuery.filter(Boolean);
  if (typeof fromQuery === 'string' && fromQuery) return fromQuery.split('/').filter(Boolean);
  const pathname = String(req?.url ?? '').split('?')[0];
  return pathname.replace(/^.*\/api\/db\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
}

/** Vercel parses JSON bodies for us, but a raw string body is still possible. */
function bodyOf(req) {
  const raw = req?.body;
  if (raw == null) return null;
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * Event meta as the client may set it. Anything not listed here (slug,
 * timestamps, scoreboard count) is the server's to decide, so a caller can't
 * backdate an event or fake how much data it holds.
 */
function sanitizeMeta(input, existing, slug) {
  const name = String(input.name ?? existing?.name ?? slug).trim().slice(0, 120) || slug;
  const seasons = Array.isArray(input.seasons)
    ? input.seasons.slice(0, 200).map((s) => ({
        id: String(s?.id ?? ''),
        name: String(s?.name ?? '').slice(0, 120),
        weekIds: Array.isArray(s?.weekIds) ? s.weekIds.map(String).slice(0, 2000) : [],
      })).filter((s) => s.id)
    : existing?.seasons ?? [];
  const registryUnits = Array.isArray(input.registryUnits)
    ? input.registryUnits.map((u) => String(u).slice(0, 120)).slice(0, 2000)
    : existing?.registryUnits ?? [];
  return {
    slug,
    name,
    // Unpublished is the safe default: a brand-new event stays out of the
    // public directory until its owner says otherwise.
    published: input.published === undefined ? !!existing?.published : !!input.published,
    seasons,
    registryUnits,
    // Map win/loss tallies computed by the tracker; carried verbatim so the
    // public Maps tab reads the same as the owner's.
    mapStats: isPlainObject(input.mapStats) ? input.mapStats : existing?.mapStats ?? null,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    scoreboardCount: existing?.scoreboardCount ?? 0,
  };
}

/** Public callers only ever see a published event. */
function visible(meta, admin) {
  return meta && (admin || meta.published);
}

/** Keep the directory's scoreboard count honest after a scoreboard write. */
async function refreshCount(slug) {
  const meta = await store.getEvent(slug);
  if (!meta) return;
  const scoreboardCount = await store.countScoreboards(slug);
  await store.putEvent(slug, { ...meta, scoreboardCount, updatedAt: new Date().toISOString() });
}

/** Full scoreboards in id order, cut off at a byte budget with a resume cursor. */
async function fullPage(slug, after) {
  const ids = (await store.listSummaries(slug)).map((s) => s.id).filter(Boolean).sort();
  const start = after ? ids.findIndex((id) => id > after) : 0;
  if (start < 0) return { items: [], next: null };
  const window = ids.slice(start, start + PAGE_LIMIT);
  const records = await store.getScoreboards(slug, window);
  const items = [];
  let bytes = 0;
  for (const record of records) {
    const size = JSON.stringify(record).length;
    // Always take the first record even if it is oversized on its own, so a
    // single fat round can never wedge the pager into an infinite loop.
    if (items.length && bytes + size > PAGE_BYTES) break;
    items.push(record);
    bytes += size;
  }
  const lastTaken = items.length ? items[items.length - 1].id : window[window.length - 1];
  const more = start + items.length < ids.length;
  return { items, next: more ? lastTaken : null };
}

export default async function handler(req, res) {
  const segments = segmentsOf(req);
  const method = String(req.method ?? 'GET').toUpperCase();
  const admin = isAdmin(req);
  const query = req.query ?? {};

  // Does the pass in my browser still work? Answered without touching the
  // database, so signing in works even while the database is down.
  if (segments[0] === 'auth') {
    if (method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
    return json(res, admin ? 200 : 401, { admin, configured: adminConfigured() });
  }

  if (segments[0] !== 'events') return notFound(res);

  try {
    // /api/db/events
    if (segments.length === 1) {
      if (method === 'GET') {
        const events = await store.listPublishedEvents();
        return json(res, 200, { events });
      }
      if (method === 'POST') {
        if (!admin) return denied(res);
        const body = bodyOf(req);
        if (!isPlainObject(body)) return json(res, 400, { error: 'Expected a JSON object' });
        const slug = String(body.slug ?? '').trim().toLowerCase();
        if (!isSlug(slug)) {
          return json(res, 400, { error: 'Slug must be 2-48 characters of a-z, 0-9 and dashes' });
        }
        const existing = await store.getEvent(slug);
        const meta = sanitizeMeta(body, existing, slug);
        meta.scoreboardCount = await store.countScoreboards(slug);
        await store.putEvent(slug, meta);
        return json(res, existing ? 200 : 201, { event: meta });
      }
      return json(res, 405, { error: 'Method not allowed' });
    }

    const slug = String(segments[1] ?? '').toLowerCase();
    if (!isSlug(slug)) return notFound(res);
    const resource = segments[2];

    // /api/db/events/:slug
    if (!resource) {
      if (method === 'GET') {
        const meta = await store.getEvent(slug);
        if (!visible(meta, admin)) return notFound(res);
        return json(res, 200, { event: meta });
      }
      if (method === 'DELETE') {
        if (!admin) return denied(res);
        const removed = await store.deleteEvent(slug);
        return json(res, 200, { deleted: true, scoreboards: removed });
      }
      return json(res, 405, { error: 'Method not allowed' });
    }

    // Everything below is public to read, owner-only to write, and only for an
    // event the caller is allowed to see at all.
    const meta = await store.getEvent(slug);
    if (!visible(meta, admin)) return notFound(res);

    // The tracker's own state — weeks, rosters, standings, brackets. Readable
    // by anyone once the event is published, since the public site shows the
    // season as well as the player stats; writable only by the owner.
    if (resource === 'tracker') {
      if (method === 'GET') {
        const state = await store.getTracker(slug);
        return state ? json(res, 200, { state }) : notFound(res);
      }
      if (method === 'PUT') {
        if (!admin) return denied(res);
        const body = bodyOf(req);
        if (!isPlainObject(body) || !isPlainObject(body.state)) {
          return json(res, 400, { error: 'Expected { state: {...} }' });
        }
        await store.putTracker(slug, body.state);
        return json(res, 200, { ok: true });
      }
      return json(res, 405, { error: 'Method not allowed' });
    }

    if (resource === 'scoreboards') {
      if (method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
      if (query.full === '1' || query.full === 'true') {
        const after = typeof query.after === 'string' ? query.after : '';
        return json(res, 200, await fullPage(slug, after));
      }
      return json(res, 200, { scoreboards: await store.listSummaries(slug) });
    }

    if (resource === 'scoreboard') {
      const id = typeof query.id === 'string' ? query.id : '';
      if (!isScoreboardId(id, slug)) return json(res, 400, { error: 'Missing or invalid id' });
      if (method === 'GET') {
        const record = await store.getScoreboard(slug, id);
        return record ? json(res, 200, { scoreboard: record }) : notFound(res);
      }
      if (!admin) return denied(res);
      if (method === 'PUT') {
        const body = bodyOf(req);
        if (!isPlainObject(body) || !isPlainObject(body.record) || !isPlainObject(body.summary)) {
          return json(res, 400, { error: 'Expected { record, summary }' });
        }
        await store.putScoreboard(slug, id, { ...body.record, id, eventId: slug }, { ...body.summary, id, eventId: slug });
        await refreshCount(slug);
        return json(res, 200, { id });
      }
      if (method === 'DELETE') {
        await store.deleteScoreboard(slug, id);
        await refreshCount(slug);
        return json(res, 200, { deleted: true });
      }
      return json(res, 405, { error: 'Method not allowed' });
    }

    if (resource === 'assignments' || resource === 'aliases') {
      const read = resource === 'assignments' ? store.getAssignments : store.getAliases;
      const write = resource === 'assignments' ? store.putAssignments : store.putAliases;
      if (method === 'GET') return json(res, 200, { [resource]: await read(slug) });
      if (method === 'PUT') {
        if (!admin) return denied(res);
        const body = bodyOf(req);
        if (!isPlainObject(body) || !isPlainObject(body[resource])) {
          return json(res, 400, { error: `Expected { ${resource}: {...} }` });
        }
        await write(slug, body[resource]);
        return json(res, 200, { ok: true });
      }
      return json(res, 405, { error: 'Method not allowed' });
    }

    return notFound(res);
  } catch (err) {
    if (err?.name === 'ValueTooLargeError') {
      return json(res, 413, { error: err.message });
    }
    // A missing/misconfigured database is the deployment's problem, not the
    // caller's — say so plainly instead of a bare 500.
    if (/No database is configured/.test(String(err?.message))) {
      return json(res, 503, { error: err.message });
    }
    return json(res, 500, { error: 'Database request failed' });
  }
}
