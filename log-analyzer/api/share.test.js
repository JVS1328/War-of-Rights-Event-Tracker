import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'node:crypto';
import handler, { pickEnv } from './share.js';

// Shared in-memory store backing the mocked Upstash client; `sets` and
// `expires` record every call so we can assert TTL + NX behavior.
const { kv, sets, expires } = vi.hoisted(() => ({ kv: new Map(), sets: [], expires: [] }));

vi.mock('@upstash/redis', () => ({
  Redis: class {
    // Mirrors real SET semantics: with `nx`, an existing key is left untouched
    // and null is returned; otherwise the write lands and "OK" comes back.
    async set(key, value, opts) {
      sets.push({ key, value, opts });
      if (opts?.nx && kv.has(key)) return null;
      kv.set(key, value);
      return 'OK';
    }
    async get(key) { return kv.has(key) ? kv.get(key) : null; }
    async expire(key, seconds) { expires.push({ key, seconds }); return kv.has(key) ? 1 : 0; }
  },
}));

// The exact var set a Vercel + Upstash integration creates.
const INTEGRATION = [
  'upstash_KV_REST_API_URL',
  'upstash_KV_REST_API_TOKEN',
  'upstash_KV_REST_API_READ_ONLY_TOKEN',
  'upstash_KV_URL',
  'upstash_REDIS_URL',
];
const CANONICAL = ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'REDIS_URL', 'KV_URL'];

describe('pickEnv — resolves Vercel storage-integration prefixes', () => {
  const saved = {};
  beforeEach(() => {
    for (const k of [...INTEGRATION, ...CANONICAL]) { saved[k] = process.env[k]; delete process.env[k]; }
  });
  afterEach(() => {
    for (const k of [...INTEGRATION, ...CANONICAL]) {
      if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
    }
  });

  it('selects the prefixed REST url + read-write token, not the read-only one', () => {
    process.env.upstash_KV_REST_API_URL = 'https://db.upstash.io';
    process.env.upstash_KV_REST_API_TOKEN = 'rw-token';
    process.env.upstash_KV_REST_API_READ_ONLY_TOKEN = 'ro-token';
    process.env.upstash_KV_URL = 'rediss://db';
    process.env.upstash_REDIS_URL = 'rediss://db';

    expect(pickEnv('UPSTASH_REDIS_REST_URL', 'KV_REST_API_URL')).toBe('https://db.upstash.io');
    const token = pickEnv('UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_TOKEN');
    expect(token).toBe('rw-token');
    expect(token).not.toBe('ro-token');
  });

  it('returns undefined when only the read-only token exists', () => {
    process.env.upstash_KV_REST_API_READ_ONLY_TOKEN = 'ro-token';
    expect(pickEnv('UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_TOKEN')).toBeUndefined();
  });

  it('prefers an exact (unprefixed) name over a suffix match', () => {
    process.env.KV_REST_API_URL = 'exact';
    process.env.upstash_KV_REST_API_URL = 'prefixed';
    expect(pickEnv('UPSTASH_REDIS_REST_URL', 'KV_REST_API_URL')).toBe('exact');
  });

  it('resolves a prefixed TCP url for the node-redis fallback', () => {
    process.env.upstash_REDIS_URL = 'rediss://db:6379';
    expect(pickEnv('REDIS_URL', 'KV_URL')).toBe('rediss://db:6379');
  });
});

describe('api/share handler', () => {
  const makeReq = (method, { body, query } = {}) => ({ method, body, query: query || {} });
  const makeRes = () => {
    const res = { statusCode: 200, body: undefined };
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (o) => { res.body = o; return res; };
    return res;
  };
  const call = (method, opts) => {
    const res = makeRes();
    return handler(makeReq(method, opts), res).then(() => res);
  };
  const idFor = (payload) => crypto.createHash('sha256').update(payload).digest('hex').slice(0, 8);

  beforeEach(() => {
    kv.clear();
    sets.length = 0;
    expires.length = 0;
    process.env.UPSTASH_REDIS_REST_URL = 'http://localhost';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
  });

  it('stores a payload under its hash id with NX + 1-year TTL, then serves it back', async () => {
    const id = idFor('somePayload');
    expect((await call('POST', { body: { payload: 'somePayload' } })).body).toEqual({ id });
    expect(sets).toHaveLength(1);
    expect(sets[0].opts).toEqual({ nx: true, ex: 31_536_000 });
    expect((await call('GET', { query: { id } })).body).toEqual({ payload: 'somePayload' });
  });

  it('never overwrites an existing key; a dedupe hit refreshes the TTL', async () => {
    // Seed the store as if different bytes already lived at this id (in prod
    // that takes a deliberate hash-prefix collision — the write must lose).
    const id = idFor('somePayload');
    kv.set(`analyzer-share:${id}`, 'ORIGINAL');

    expect((await call('POST', { body: { payload: 'somePayload' } })).statusCode).toBe(200);
    expect((await call('GET', { query: { id } })).body).toEqual({ payload: 'ORIGINAL' });
    expect(expires).toEqual([{ key: `analyzer-share:${id}`, seconds: 31_536_000 }]);
  });

  it('404s an unknown id and 400s a missing payload', async () => {
    expect((await call('GET', { query: { id: 'deadbeef' } })).statusCode).toBe(404);
    expect((await call('POST', { body: {} })).statusCode).toBe(400);
  });

  // --- chunked uploads (large events) ---------------------------------------

  const ID = 'abcd1234';

  it('stores chunks under per-index keys and a manifest, then serves them back', async () => {
    // Upload 3 chunks...
    for (let i = 0; i < 3; i++) {
      expect((await call('POST', { body: { id: ID, index: i, chunk: `part${i}` } })).body).toEqual({ ok: true });
    }
    // ...then the manifest.
    expect((await call('POST', { body: { id: ID, total: 3 } })).body).toEqual({ id: ID });
    expect(kv.get(`analyzer-share:${ID}`)).toBe(JSON.stringify({ n: 3 }));
    expect(kv.get(`analyzer-share:${ID}:1`)).toBe('part1');

    // GET the id → manifest (not a raw payload).
    expect((await call('GET', { query: { id: ID } })).body).toEqual({ chunked: true, total: 3 });
    // GET each chunk back.
    for (let i = 0; i < 3; i++) {
      expect((await call('GET', { query: { id: ID, chunk: String(i) } })).body).toEqual({ chunk: `part${i}` });
    }
  });

  it('reassembles a chunked payload byte-for-byte', async () => {
    const parts = ['AAAA', 'BBBB', 'CC'];
    for (let i = 0; i < parts.length; i++) await call('POST', { body: { id: ID, index: i, chunk: parts[i] } });
    await call('POST', { body: { id: ID, total: parts.length } });

    const manifest = (await call('GET', { query: { id: ID } })).body;
    let joined = '';
    for (let i = 0; i < manifest.total; i++) {
      joined += (await call('GET', { query: { id: ID, chunk: String(i) } })).body.chunk;
    }
    expect(joined).toBe('AAAABBBBCC');
  });

  it('rejects a bad id, an oversized chunk, and too many chunks', async () => {
    expect((await call('POST', { body: { id: 'NOPE', index: 0, chunk: 'x' } })).statusCode).toBe(400);
    const huge = 'x'.repeat(600_001);
    expect((await call('POST', { body: { id: ID, index: 0, chunk: huge } })).statusCode).toBe(413);
    expect((await call('POST', { body: { id: ID, total: 2000 } })).statusCode).toBe(413);
    expect((await call('POST', { body: { id: ID, total: 0 } })).statusCode).toBe(400);
  });

  it('404s a chunk GET for an unwritten index', async () => {
    expect((await call('GET', { query: { id: ID, chunk: '5' } })).statusCode).toBe(404);
  });

  it('does not overwrite an already-stored chunk (write-once), refreshes TTL', async () => {
    kv.set(`analyzer-share:${ID}:0`, 'ORIGINAL');
    expect((await call('POST', { body: { id: ID, index: 0, chunk: 'REPLACEMENT' } })).statusCode).toBe(200);
    expect(kv.get(`analyzer-share:${ID}:0`)).toBe('ORIGINAL');
    expect(expires).toContainEqual({ key: `analyzer-share:${ID}:0`, seconds: 31_536_000 });
  });
});
