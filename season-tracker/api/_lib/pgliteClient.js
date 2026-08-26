/**
 * A real Postgres, in-process.
 *
 * PGlite is Postgres compiled to WebAssembly, so the dev server and the tests
 * run the same SQL the deployment does — a query that would fail against Neon
 * fails here first, which is the whole point of using it rather than a hand
 * written stand-in. It is a devDependency and is imported lazily, so it is
 * never part of a production build.
 */
export async function createPglite() {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
  // Neon's `sql.query(text, params)` resolves to the rows themselves; PGlite
  // wraps them in a result object. Match Neon, since that is what ships.
  return {
    async query(text, params = []) {
      const result = await db.query(text, params);
      return result.rows;
    },
    async close() {
      await db.close();
    },
  };
}
