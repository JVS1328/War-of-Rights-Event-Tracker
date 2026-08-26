import { describe, it, expect, beforeEach, vi } from 'vitest';

// In-memory stand-in for Upstash. Only the commands store.js actually issues
// are implemented, with the same return shapes the SDK gives.
const { strings, sets, hashes } = vi.hoisted(() => ({
  strings: new Map(),
  sets: new Map(),
  hashes: new Map(),
}));

vi.mock('@upstash/redis', () => ({
  Redis: class {
    async set(key, value) { strings.set(key, value); return 'OK'; }
    async get(key) { return strings.has(key) ? strings.get(key) : null; }
    async mget(...keys) { return keys.map((k) => (strings.has(k) ? strings.get(k) : null)); }
    async del(...keys) {
      let n = 0;
      for (const k of keys) {
        if (strings.delete(k)) n += 1;
        if (hashes.delete(k)) n += 1;
      }
      return n;
    }
    async sadd(key, ...members) {
      const set = sets.get(key) ?? new Set();
      members.forEach((m) => set.add(m));
      sets.set(key, set);
      return members.length;
    }
    async srem(key, ...members) {
      const set = sets.get(key) ?? new Set();
      members.forEach((m) => set.delete(m));
      sets.set(key, set);
      return members.length;
    }
    async smembers(key) { return [...(sets.get(key) ?? [])]; }
    async hset(key, obj) {
      const hash = hashes.get(key) ?? new Map();
      for (const [f, v] of Object.entries(obj)) hash.set(f, v);
      hashes.set(key, hash);
      return Object.keys(obj).length;
    }
    async hgetall(key) {
      const hash = hashes.get(key);
      return hash ? Object.fromEntries(hash) : null;
    }
    async hdel(key, ...fields) {
      const hash = hashes.get(key) ?? new Map();
      fields.forEach((f) => hash.delete(f));
      return fields.length;
    }
    async hlen(key) { return hashes.get(key)?.size ?? 0; }
  },
}));

const { default: handler } = await import('./router.js');
const { resetRedis } = await import('./store.js');

const TOKEN = 'owner-token-that-is-long-enough';

const makeRes = () => {
  const res = { statusCode: 200, body: undefined };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (o) => { res.body = o; return res; };
  return res;
};

/** Issue a request. `auth: true` presents the owner token. */
const call = async (method, path, { body, query = {}, auth = false } = {}) => {
  const res = makeRes();
  const req = {
    method,
    body,
    query: { path: path.split('/').filter(Boolean), ...query },
    headers: auth ? { authorization: `Bearer ${TOKEN}` } : {},
  };
  await handler(req, res);
  return res;
};

const scoreboardOf = (name) => ({
  sourceFilename: name,
  recordedAt: '2026-01-01T00:00:00Z',
  players: [{ name: 'Pvt. Smith', steamId: '76561198000000001', kills: 3, deaths: 1 }],
  meta: { map: 'Bloody Lane', mode: 'Skirmish', area: null, winner: 'USA' },
});
const summaryOf = (id, name) => ({
  id, eventId: 'ssl', sourceFilename: name, recordedAt: '2026-01-01T00:00:00Z',
  map: 'Bloody Lane', mode: 'Skirmish', area: null, winner: 'USA',
});

beforeEach(() => {
  strings.clear();
  sets.clear();
  hashes.clear();
  resetRedis();
  process.env.UPSTASH_REDIS_REST_URL = 'http://localhost';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
  process.env.WOR_ADMIN_TOKEN = TOKEN;
});

describe('auth', () => {
  it('accepts the owner token and rejects everything else', async () => {
    expect((await call('GET', 'auth', { auth: true })).body).toEqual({ admin: true, configured: true });
    expect((await call('GET', 'auth')).statusCode).toBe(401);
  });

  it('refuses every write when no token is configured at all', async () => {
    delete process.env.WOR_ADMIN_TOKEN;
    const res = await call('POST', 'events', { body: { slug: 'ssl' }, auth: true });
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toMatch(/No owner token is configured/);
  });
});

describe('events', () => {
  it('creates an event, and only the owner may', async () => {
    expect((await call('POST', 'events', { body: { slug: 'ssl', name: 'SSL' } })).statusCode).toBe(401);

    const created = await call('POST', 'events', {
      body: { slug: 'ssl', name: 'SSL', published: true, seasons: [{ id: 's1', name: 'Season 1', weekIds: ['w1'] }] },
      auth: true,
    });
    expect(created.statusCode).toBe(201);
    expect(created.body.event).toMatchObject({ slug: 'ssl', name: 'SSL', published: true, scoreboardCount: 0 });
    expect(created.body.event.seasons).toEqual([{ id: 's1', name: 'Season 1', weekIds: ['w1'] }]);
  });

  it('rejects a slug that would not survive a URL', async () => {
    const res = await call('POST', 'events', { body: { slug: 'Not A Slug!' }, auth: true });
    expect(res.statusCode).toBe(400);
  });

  it('lists only published events, and hides an unpublished one from the public', async () => {
    await call('POST', 'events', { body: { slug: 'ssl', name: 'SSL', published: true }, auth: true });
    await call('POST', 'events', { body: { slug: 'snf', name: 'SNF', published: false }, auth: true });

    const list = await call('GET', 'events');
    expect(list.body.events.map((e) => e.slug)).toEqual(['ssl']);

    expect((await call('GET', 'events/snf')).statusCode).toBe(404);
    expect((await call('GET', 'events/snf', { auth: true })).body.event.name).toBe('SNF');
  });

  it('drops an event out of the directory when it is unpublished again', async () => {
    await call('POST', 'events', { body: { slug: 'ssl', published: true }, auth: true });
    await call('POST', 'events', { body: { slug: 'ssl', published: false }, auth: true });
    expect((await call('GET', 'events')).body.events).toEqual([]);
  });

  it('ignores server-owned fields a caller tries to set', async () => {
    const res = await call('POST', 'events', {
      body: { slug: 'ssl', createdAt: '1999-01-01T00:00:00Z', scoreboardCount: 9999 },
      auth: true,
    });
    expect(res.body.event.createdAt).not.toBe('1999-01-01T00:00:00Z');
    expect(res.body.event.scoreboardCount).toBe(0);
  });
});

describe('scoreboards', () => {
  const seed = async () => {
    await call('POST', 'events', { body: { slug: 'ssl', name: 'SSL', published: true }, auth: true });
    await call('PUT', 'events/ssl/scoreboard', {
      query: { id: 'ssl::round1.csv' },
      body: { record: { scoreboard: scoreboardOf('round1.csv') }, summary: summaryOf('ssl::round1.csv', 'round1.csv') },
      auth: true,
    });
  };

  it('saves a round and serves it back to anyone', async () => {
    await seed();
    const list = await call('GET', 'events/ssl/scoreboards');
    expect(list.body.scoreboards).toHaveLength(1);
    expect(list.body.scoreboards[0].map).toBe('Bloody Lane');

    const one = await call('GET', 'events/ssl/scoreboard', { query: { id: 'ssl::round1.csv' } });
    expect(one.body.scoreboard.scoreboard.sourceFilename).toBe('round1.csv');
  });

  it('keeps the event’s scoreboard count in step', async () => {
    await seed();
    expect((await call('GET', 'events/ssl')).body.event.scoreboardCount).toBe(1);
    await call('DELETE', 'events/ssl/scoreboard', { query: { id: 'ssl::round1.csv' }, auth: true });
    expect((await call('GET', 'events/ssl')).body.event.scoreboardCount).toBe(0);
  });

  it('refuses writes from a visitor', async () => {
    await seed();
    const res = await call('PUT', 'events/ssl/scoreboard', {
      query: { id: 'ssl::round2.csv' },
      body: { record: { scoreboard: scoreboardOf('round2.csv') }, summary: summaryOf('ssl::round2.csv', 'round2.csv') },
    });
    expect(res.statusCode).toBe(401);
    expect((await call('GET', 'events/ssl/scoreboards')).body.scoreboards).toHaveLength(1);
  });

  it('refuses an id that does not belong to the event', async () => {
    await seed();
    const res = await call('GET', 'events/ssl/scoreboard', { query: { id: 'other::round1.csv' } });
    expect(res.statusCode).toBe(400);
  });

  it('pages full records and reports when there are no more', async () => {
    await call('POST', 'events', { body: { slug: 'ssl', published: true }, auth: true });
    for (const n of ['a', 'b', 'c']) {
      await call('PUT', 'events/ssl/scoreboard', {
        query: { id: `ssl::${n}.csv` },
        body: { record: { scoreboard: scoreboardOf(`${n}.csv`) }, summary: summaryOf(`ssl::${n}.csv`, `${n}.csv`) },
        auth: true,
      });
    }
    const page = await call('GET', 'events/ssl/scoreboards', { query: { full: '1' } });
    expect(page.body.items).toHaveLength(3);
    expect(page.body.next).toBeNull();

    const after = await call('GET', 'events/ssl/scoreboards', { query: { full: '1', after: 'ssl::a.csv' } });
    expect(after.body.items.map((i) => i.id)).toEqual(['ssl::b.csv', 'ssl::c.csv']);
  });
});

describe('assignments and aliases', () => {
  beforeEach(async () => {
    await call('POST', 'events', { body: { slug: 'ssl', published: true }, auth: true });
  });

  it('round-trips season-scoped pins, readable by anyone', async () => {
    await call('PUT', 'events/ssl/assignments', {
      body: { assignments: { overall: { '765611980000': '1stTX' }, s2: { '765611980000': '2ndSC' } } },
      auth: true,
    });
    const res = await call('GET', 'events/ssl/assignments');
    expect(res.body.assignments.s2['765611980000']).toBe('2ndSC');
  });

  it('round-trips aliases and refuses an unauthenticated write', async () => {
    expect((await call('PUT', 'events/ssl/aliases', { body: { aliases: { overall: { a: 'b' } } } })).statusCode).toBe(401);
    await call('PUT', 'events/ssl/aliases', { body: { aliases: { overall: { a: 'b' } } }, auth: true });
    expect((await call('GET', 'events/ssl/aliases')).body.aliases).toEqual({ overall: { a: 'b' } });
  });
});

describe('tracker state', () => {
  beforeEach(async () => {
    await call('POST', 'events', { body: { slug: 'ssl', published: true }, auth: true });
  });

  it('is readable by anyone once the event is published, writable only by the owner', async () => {
    expect((await call('PUT', 'events/ssl/tracker', { body: { state: { weeks: [] } } })).statusCode).toBe(401);

    await call('PUT', 'events/ssl/tracker', { body: { state: { weeks: [] } }, auth: true });
    expect((await call('GET', 'events/ssl/tracker')).body.state).toEqual({ weeks: [] });
  });

  it('stays hidden while the event is unpublished', async () => {
    await call('PUT', 'events/ssl/tracker', { body: { state: { weeks: [] } }, auth: true });
    await call('POST', 'events', { body: { slug: 'ssl', published: false }, auth: true });

    expect((await call('GET', 'events/ssl/tracker')).statusCode).toBe(404);
    expect((await call('GET', 'events/ssl/tracker', { auth: true })).body.state).toEqual({ weeks: [] });
  });
});

describe('deleting an event', () => {
  it('takes its scoreboards and side tables with it', async () => {
    await call('POST', 'events', { body: { slug: 'ssl', published: true }, auth: true });
    await call('PUT', 'events/ssl/scoreboard', {
      query: { id: 'ssl::a.csv' },
      body: { record: { scoreboard: scoreboardOf('a.csv') }, summary: summaryOf('ssl::a.csv', 'a.csv') },
      auth: true,
    });
    await call('PUT', 'events/ssl/aliases', { body: { aliases: { overall: { a: 'b' } } }, auth: true });

    expect((await call('DELETE', 'events/ssl', { auth: true })).body).toEqual({ deleted: true, scoreboards: 1 });
    expect((await call('GET', 'events/ssl')).statusCode).toBe(404);
    expect((await call('GET', 'events')).body.events).toEqual([]);
    expect(strings.size).toBe(0);
  });
});

describe('failure modes', () => {
  it('says so plainly when the database is not configured', async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.KV_REST_API_URL;
    delete process.env.upstash_KV_REST_API_URL;
    resetRedis();
    const res = await call('GET', 'events');
    expect(res.statusCode).toBe(503);
    expect(res.body.error).toMatch(/not configured/);
  });

  it('405s an unsupported method and 404s an unknown resource', async () => {
    expect((await call('PATCH', 'events')).statusCode).toBe(405);
    expect((await call('GET', 'nonsense')).statusCode).toBe(404);
  });
});
