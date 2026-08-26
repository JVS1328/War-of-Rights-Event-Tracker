import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { startTestDb, truncateAll } from './_lib/testDb.js';

// Share links run against a real Postgres (PGlite), so the write-once and
// expiry behaviour is the database's own rather than a fake's idea of it.
const { default: handler } = await import('./share.js');

let db;

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

beforeAll(async () => { db = await startTestDb(); });
afterAll(async () => { await db?.close(); });
beforeEach(async () => { await truncateAll(db); });

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

  it('sets an expiry a year out on every write', async () => {
    await call('POST', { body: { id, index: 0, chunk: 'AAA' } });
    const rows = await db.query('SELECT expires_at FROM wor_shares WHERE id = $1', [id]);
    const days = (new Date(rows[0].expires_at) - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(360);
    expect(days).toBeLessThan(370);
  });

  it('pushes the expiry out on a re-share rather than letting it lapse', async () => {
    await call('POST', { body: { id, index: 0, chunk: 'AAA' } });
    await db.query("UPDATE wor_shares SET expires_at = now() + interval '1 day' WHERE id = $1", [id]);

    await call('POST', { body: { id, index: 0, chunk: 'AAA' } });
    const rows = await db.query('SELECT expires_at FROM wor_shares WHERE id = $1', [id]);
    const days = (new Date(rows[0].expires_at) - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(360);
  });

  it('never changes the content behind an id somebody already has', async () => {
    await call('POST', { body: { id, index: 0, chunk: 'AAA' } });
    await call('POST', { body: { id, total: 1 } });

    // A second writer targeting the same id succeeds at the HTTP level (dedupe
    // is normal for identical payloads) but must not change stored content.
    expect((await call('POST', { body: { id, index: 0, chunk: 'EVIL' } })).statusCode).toBe(200);
    expect((await call('POST', { body: { id, total: 64 } })).statusCode).toBe(200);

    expect((await call('GET', { query: { id, chunk: '0' } })).body).toEqual({ chunk: 'AAA' });
    expect((await call('GET', { query: { id } })).body).toEqual({ chunked: true, total: 1 });
  });

  it('treats an expired chunk as gone', async () => {
    await call('POST', { body: { id, index: 0, chunk: 'AAA' } });
    await db.query("UPDATE wor_shares SET expires_at = now() - interval '1 day' WHERE id = $1", [id]);
    expect((await call('GET', { query: { id, chunk: '0' } })).statusCode).toBe(404);
  });

  it('returns a legacy single-value payload as { payload }', async () => {
    // Links made before chunking put the payload where the manifest now lives.
    await db.query(
      "INSERT INTO wor_shares (id, idx, chunk, expires_at) VALUES ($1, -1, $2, now() + interval '1 year')",
      ['deadbeef', 'rawBase64Payload'],
    );
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
