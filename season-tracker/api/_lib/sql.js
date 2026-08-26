import { neon } from '@neondatabase/serverless';
import { SCHEMA } from './schema.js';

/**
 * The connection to Neon.
 *
 * `neon()` speaks Postgres over HTTP, which is what makes it usable from a
 * serverless function: no connection pool to keep warm, no socket to lose
 * between invocations. Each call is one round trip.
 *
 * The schema is created on first use rather than by a migration step, so a
 * fresh database needs nothing but its URL.
 */

let client;
let schemaReady;

export function getSql() {
  if (!client) {
    const url = process.env.WOR_DATABASE_URL
      || process.env.DATABASE_URL
      || process.env.POSTGRES_URL;
    if (!url) {
      throw new Error('No database is configured (set WOR_DATABASE_URL to your Neon connection string)');
    }
    client = neon(url);
  }
  return client;
}

/** Create the tables if they are not there. Runs at most once per cold start. */
export function ensureSchema() {
  if (!schemaReady) {
    const sql = getSql();
    schemaReady = sql.query(SCHEMA).catch((err) => {
      // A failed migration must not be remembered as done, or every later
      // request in this instance would query tables that do not exist.
      schemaReady = undefined;
      throw err;
    });
  }
  return schemaReady;
}

/**
 * Run a parameterised query. Takes SQL with `$1`-style placeholders and an
 * array, rather than the driver's tagged-template form, because most of the
 * queries here are assembled (an id list, an upsert) and a template literal
 * would make that harder to read, not easier.
 */
export async function query(text, params = []) {
  await ensureSchema();
  const rows = await getSql().query(text, params);
  return rows;
}

/**
 * Test/dev seam: install a different client (PGlite, in practice), or drop the
 * memoized one. The schema is marked un-built either way, since a fresh
 * stand-in has no tables in it yet.
 */
export function setSql(custom) {
  client = custom;
  schemaReady = undefined;
}
