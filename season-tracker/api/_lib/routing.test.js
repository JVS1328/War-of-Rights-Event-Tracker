import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { startTestDb, truncateAll } from './testDb.js';

/**
 * How a request reaches the handler.
 *
 * These exist because of a live failure that the rest of the suite could not
 * have caught: every test built `req.query.path` by hand, so all of them passed
 * while the deployment 404'd anything deeper than one segment. The platform was
 * matching `api/db/[...path].js` to a single segment only — /api/db/events ran,
 * /api/db/events/ssl/tracker never reached the function at all.
 *
 * Routing is declared in vercel.json now, and these feed the handler the shapes
 * a request can actually arrive in.
 */
const { default: handler } = await import('./router.js');

const PASS = 'admin-pass-long-enough';
let db;

const makeRes = () => {
  const res = { statusCode: 200, body: undefined };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (o) => { res.body = o; return res; };
  return res;
};

const send = async (req) => {
  const res = makeRes();
  await handler({ headers: { authorization: `Bearer ${PASS}` }, ...req }, res);
  return res;
};

/** What the vercel.json rewrite produces: the segments in `?path=a/b/c`. */
const viaRewrite = (method, path, extra = {}) => send({
  method,
  url: `/api/db?path=${encodeURIComponent(path)}`,
  query: { path, ...extra.query },
  body: extra.body,
});

/** What a filename catch-all produces: the parameter named for the brackets. */
const viaCatchAll = (method, path, extra = {}) => send({
  method,
  url: `/api/db/${path}?...path=${encodeURIComponent(path)}`,
  query: { '...path': path, ...extra.query },
  body: extra.body,
});

/** Segments as an array, which some routers pass instead of a joined string. */
const viaArray = (method, path, extra = {}) => send({
  method,
  url: `/api/db/${path}`,
  query: { path: path.split('/'), ...extra.query },
  body: extra.body,
});

/** No routing help at all — the raw URL is all there is to go on. */
const viaUrlOnly = (method, path, extra = {}) => send({
  method,
  url: `/api/db/${path}`,
  query: { ...extra.query },
  body: extra.body,
});

const SHAPES = { viaRewrite, viaCatchAll, viaArray, viaUrlOnly };

beforeAll(async () => { db = await startTestDb(); });
afterAll(async () => { await db?.close(); });

beforeEach(async () => {
  await truncateAll(db);
  process.env.ADMIN_PASS = PASS;
});

describe.each(Object.entries(SHAPES))('routing, %s', (_name, call) => {
  beforeEach(async () => {
    await call('POST', 'events', { body: { slug: 'ssl', name: 'SSL', published: true } });
  });

  it('reaches a one-segment route', async () => {
    const res = await call('GET', 'events');
    expect(res.statusCode).toBe(200);
    expect(res.body.events.map((e) => e.slug)).toEqual(['ssl']);
  });

  it('reaches a two-segment route — the one Delete uses', async () => {
    expect((await call('GET', 'events/ssl')).statusCode).toBe(200);
    expect((await call('DELETE', 'events/ssl')).body).toEqual({ deleted: true, scoreboards: 0 });
  });

  it('reaches a three-segment route — the one Publish died on', async () => {
    const put = await call('PUT', 'events/ssl/tracker', { body: { state: { weeks: [] } } });
    expect(put.statusCode).toBe(200);
    expect((await call('GET', 'events/ssl/tracker')).body.state).toEqual({ weeks: [] });
  });

  it('carries a query parameter of its own alongside the path', async () => {
    const id = 'ssl::round1.csv';
    const saved = await call('PUT', 'events/ssl/scoreboard', {
      query: { id },
      body: {
        record: { scoreboard: { sourceFilename: 'round1.csv' } },
        summary: { id, eventId: 'ssl', sourceFilename: 'round1.csv', recordedAt: null },
      },
    });
    expect(saved.body).toEqual({ id });
    expect((await call('GET', 'events/ssl/scoreboard', { query: { id } })).statusCode).toBe(200);
  });
});

describe('routing, oddities', () => {
  it('ignores an unexpanded route filename left in the path by a rewrite', async () => {
    const res = await send({ method: 'GET', url: '/api/db/[...path]?path=events', query: { path: 'events' } });
    expect(res.statusCode).toBe(200);
  });

  it('does not 500 on a malformed escape in a segment', async () => {
    const res = await send({ method: 'GET', url: '/api/db/events/%E0%A4%A' });
    expect([400, 404]).toContain(res.statusCode);
  });
});

describe('bulk reads, narrowed and cacheable', () => {
  const round = (n) => ({
    sourceFilename: `r${n}.csv`, recordedAt: `2026-01-0${n}T00:00:00Z`,
    meta: { map: 'Bloody Lane', mode: 'Skirmish', area: null, winner: 'USA' },
    players: [], kills: [], joinLeaves: [],
  });

  beforeEach(async () => {
    await send({ method: 'POST', url: '/api/db?path=events', query: { path: 'events' },
      body: { slug: 'ssl', name: 'SSL', published: true } });
    for (const [n, week] of [[1, 'w1'], [2, 'w1'], [3, 'w2']]) {
      const id = `ssl::r${n}.csv`;
      await send({
        method: 'PUT', url: `/api/db?path=events/ssl/scoreboard`,
        query: { path: 'events/ssl/scoreboard', id },
        body: {
          record: { scoreboard: round(n) },
          summary: { id, eventId: 'ssl', sourceFilename: `r${n}.csv`, recordedAt: `2026-01-0${n}T00:00:00Z`, binding: { weekId: week, round: 1 } },
        },
      });
    }
  });

  const read = (query) => send({ method: 'GET', url: '/api/db?path=events/ssl/scoreboards', query: { path: 'events/ssl/scoreboards', ...query } });

  it('reads every round when no season is named', async () => {
    const res = await read({ full: '1' });
    expect(res.body.items).toHaveLength(3);
  });

  it('reads only the rounds bound to the season on screen', async () => {
    const res = await read({ full: '1', weeks: 'w1' });
    expect(res.body.items.map((i) => i.id)).toEqual(['ssl::r1.csv', 'ssl::r2.csv']);
  });

  it('leaves a round bound to no night out of a season read', async () => {
    const id = 'ssl::loose.csv';
    await send({ method: 'PUT', url: '/api/db?path=events/ssl/scoreboard', query: { path: 'events/ssl/scoreboard', id },
      body: { record: { scoreboard: round(9) }, summary: { id, eventId: 'ssl', sourceFilename: 'loose.csv', recordedAt: null } } });

    expect((await read({ full: '1', weeks: 'w1,w2' })).body.items).toHaveLength(3);
    // Unbound rounds surface only under Overall, which is what a full read is.
    expect((await read({ full: '1' })).body.items).toHaveLength(4);
  });

  it('tags a read so an unchanged one costs nothing to re-fetch', async () => {
    const headers = {};
    const res = { statusCode: 200, body: undefined, setHeader: (k, v) => { headers[k.toLowerCase()] = v; }, end: () => res };
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (o) => { res.body = o; return res; };
    await handler({ method: 'GET', url: '/api/db?path=events/ssl/scoreboards', query: { path: 'events/ssl/scoreboards', full: '1' }, headers: {} }, res);
    expect(headers.etag).toBeTruthy();
    expect(headers['cache-control']).toMatch(/public/);

    // The same caller, holding that tag, is told nothing changed.
    const again = { statusCode: 200, body: undefined, setHeader: () => {}, end: () => again };
    again.status = (c) => { again.statusCode = c; return again; };
    again.json = (o) => { again.body = o; return again; };
    await handler({ method: 'GET', url: '/api/db?path=events/ssl/scoreboards', query: { path: 'events/ssl/scoreboards', full: '1' }, headers: { 'if-none-match': headers.etag } }, again);
    expect(again.statusCode).toBe(304);
  });

  it('changes the tag when a round is added, so a stale copy is not served', async () => {
    const tagOf = async () => {
      const headers = {};
      const res = { statusCode: 200, setHeader: (k, v) => { headers[k.toLowerCase()] = v; }, end: () => res };
      res.status = (c) => { res.statusCode = c; return res; };
      res.json = () => res;
      await handler({ method: 'GET', url: '/api/db?path=events/ssl/scoreboards', query: { path: 'events/ssl/scoreboards', full: '1' }, headers: {} }, res);
      return headers.etag;
    };
    const before = await tagOf();
    const id = 'ssl::r4.csv';
    await send({ method: 'PUT', url: '/api/db?path=events/ssl/scoreboard', query: { path: 'events/ssl/scoreboard', id },
      body: { record: { scoreboard: round(4) }, summary: { id, eventId: 'ssl', sourceFilename: 'r4.csv', recordedAt: null } } });
    expect(await tagOf()).not.toBe(before);
  });
});
