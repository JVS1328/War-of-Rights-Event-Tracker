import { describe, it, expect, beforeEach, vi } from 'vitest';

// Shared in-memory store backing the mocked Upstash client; `sets` records every
// write (with its opts) so we can assert the TTL.
const { store, sets } = vi.hoisted(() => ({ store: new Map(), sets: [] }));

vi.mock('@upstash/redis', () => ({
  Redis: class {
    async set(key, value, opts) { sets.push({ key, value, opts }); store.set(key, value); }
    async get(key) { return store.has(key) ? store.get(key) : null; }
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

  it('sets a 1-year TTL on every write', async () => {
    await call('POST', { body: { id, index: 0, chunk: 'AAA' } });
    await call('POST', { body: { id, total: 1 } });
    expect(sets).toHaveLength(2);
    for (const s of sets) expect(s.opts).toEqual({ ex: 31_536_000 });
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
    expect((await call('POST', { body: { id, total: 99999 } })).statusCode).toBe(413);
  });

  it('rejects an invalid id with 400', async () => {
    expect((await call('POST', { body: { id: 'BAD', index: 0, chunk: 'AAA' } })).statusCode).toBe(400);
  });

  it('405s an unsupported method', async () => {
    expect((await call('DELETE', {})).statusCode).toBe(405);
  });
});
