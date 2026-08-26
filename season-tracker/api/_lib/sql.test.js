import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getSql, setSql } from './sql.js';
import handler from './router.js';

// What happens with no database behind the site at all — which is what a fresh
// deployment looks like until someone sets the connection string.

const saved = {};

beforeEach(() => {
  for (const key of ['WOR_DATABASE_URL', 'DATABASE_URL', 'POSTGRES_URL']) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  setSql(undefined);
});

afterEach(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  setSql(undefined);
});

describe('with no database configured', () => {
  it('names the variable to set rather than failing vaguely', () => {
    expect(() => getSql()).toThrow(/WOR_DATABASE_URL/);
  });

  it('answers a read with 503, not a bare 500', async () => {
    const res = { statusCode: 200, body: undefined };
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (o) => { res.body = o; return res; };
    await handler({ method: 'GET', query: { path: ['events'] }, headers: {} }, res);
    expect(res.statusCode).toBe(503);
    expect(res.body.error).toMatch(/No database is configured/);
  });

  it('still answers the auth check, so signing in works while the database is down', async () => {
    process.env.ADMIN_PASS = 'admin-pass-long-enough';
    const res = { statusCode: 200, body: undefined };
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (o) => { res.body = o; return res; };
    await handler(
      { method: 'GET', query: { path: ['auth'] }, headers: { authorization: 'Bearer admin-pass-long-enough' } },
      res,
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ admin: true, configured: true });
  });
});
