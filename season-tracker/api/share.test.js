import { describe, it, expect, beforeEach, vi } from 'vitest';

// Shared in-memory store backing the mocked Upstash client; `sets` and
// `expires` record every call (with opts) so we can assert TTL + NX behavior.
const { store, sets, expires } = vi.hoisted(() => ({ store: new Map(), sets: [], expires: [] }));

vi.mock('@upstash/redis', () => ({
  Redis: class {
    // Mirrors real SET semantics: with `nx`, an existing key is left untouched
    // and null is returned; otherwise the write lands and "OK" comes back.
    async set(key, value, opts) {
      sets.push({ key, value, opts });
      if (opts?.nx && store.has(key)) return null;
      store.set(key, value);
      return 'OK';
    }
    async get(key) { return store.has(key) ? store.get(key) : null; }
    async expire(key, seconds) { expires.push({ key, seconds }); return store.has(key) ? 1 : 0; }
  },
}));

const { default: handler } = await import('./share.js');

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

beforeEach(() => {
  store.clear();
  sets.length = 0;
  expires.length = 0;
  process.env.UPSTASH_REDIS_REST_URL = 'http://localhost';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
});

describe('api/share handler', () => {
  const id = 'abcd1234';

  it('stores chunks + manifest, then serves them back via GET', async () => {
    expect((await call('POST', { body: { id, index: 0, chunk: 'AAA' } })).body).toEqual({ ok: true });
    await call('POST', { body: { id, index: 1, chunk: 'BBB' } });
    expect((await call('POST', { body: { id, total: 2 } })).body).toEqual({ id });

    expect((await call('GET', { query: { id } })).body).toEqual({ chunked: true, total: 2 });
    expect((await call('GET', { query: { id, chunk: '0' } })).body).toEqual({ chunk: 'AAA' });
    expect((await call('GET', { query: { id, chunk: '1' } })).body).toEqual({ chunk: 'BBB' });
  });

  it('sets a 1-year TTL and NX on every write', async () => {
    await call('POST', { body: { id, index: 0, chunk: 'AAA' } });
    await call('POST', { body: { id, total: 1 } });
    expect(sets).toHaveLength(2);
    for (const s of sets) expect(s.opts).toEqual({ nx: true, ex: 31_536_000 });
  });

  it('never overwrites an existing chunk or manifest (write-once ids)', async () => {
    await call('POST', { body: { id, index: 0, chunk: 'AAA' } });
    await call('POST', { body: { id, total: 1 } });

    // A second writer targeting the same id succeeds at the HTTP level (dedupe
    // is normal for identical payloads) but must not change stored content.
    expect((await call('POST', { body: { id, index: 0, chunk: 'EVIL' } })).statusCode).toBe(200);
    expect((await call('POST', { body: { id, total: 64 } })).statusCode).toBe(200);

    expect((await call('GET', { query: { id, chunk: '0' } })).body).toEqual({ chunk: 'AAA' });
    expect((await call('GET', { query: { id } })).body).toEqual({ chunked: true, total: 1 });
  });

  it('refreshes the TTL on a dedupe hit instead of rewriting', async () => {
    await call('POST', { body: { id, index: 0, chunk: 'AAA' } });
    expect(expires).toHaveLength(0);

    await call('POST', { body: { id, index: 0, chunk: 'AAA' } });
    expect(expires).toEqual([{ key: `season-share:${id}:0`, seconds: 31_536_000 }]);
  });

  it('returns a legacy single-value payload as { payload }', async () => {
    store.set('season-share:deadbeef', 'rawBase64Payload');
    expect((await call('GET', { query: { id: 'deadbeef' } })).body).toEqual({ payload: 'rawBase64Payload' });
  });

  it('404s an unknown id', async () => {
    expect((await call('GET', { query: { id: '00000000' } })).statusCode).toBe(404);
  });

  it('rejects an oversized chunk with 413', async () => {
    const big = 'x'.repeat(600_001);
    expect((await call('POST', { body: { id, index: 0, chunk: big } })).statusCode).toBe(413);
  });

  it('rejects too many chunks with 413', async () => {
    expect((await call('POST', { body: { id, total: 1025 } })).statusCode).toBe(413);
    expect((await call('POST', { body: { id, index: 1024, chunk: 'AAA' } })).statusCode).toBe(400);
  });

  it('rejects an invalid id with 400', async () => {
    expect((await call('POST', { body: { id: 'BAD', index: 0, chunk: 'AAA' } })).statusCode).toBe(400);
  });

  it('405s an unsupported method', async () => {
    expect((await call('DELETE', {})).statusCode).toBe(405);
  });
});
