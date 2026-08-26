import { createPglite } from './pgliteClient.js';
import { ensureSchema, setSql } from './sql.js';
import router from './router.js';

/**
 * A Vite dev-server plugin that mounts the database API, so `npm run dev`
 * serves the same routes the deployment does. Without it the public site has
 * nothing to read from locally and every page shows a network error.
 *
 * With a database URL in the environment it talks to that database; without one
 * it runs against PGlite — Postgres in WebAssembly — which lasts as long as the
 * dev server does and speaks the same SQL Neon does. Either way the handler is
 * the production one.
 */
export function devApi() {
  return {
    name: 'wor-dev-api',
    apply: 'serve',
    async configureServer(server) {
      const live = process.env.WOR_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL;
      if (!live) {
        const pglite = await createPglite();
        setSql(pglite);
        await ensureSchema();
        // Dev needs *a* password or every write 401s; it is printed so it can
        // be pasted into the admin screen, and it only exists on this machine.
        process.env.ADMIN_PASS ??= 'dev-admin-pass-not-a-secret';
        server.config.logger.info(
          `  ➜  database: PGlite, in memory · admin pass: ${process.env.ADMIN_PASS}`,
        );
      }

      server.middlewares.use('/api/db', async (req, res, next) => {
        if (!req.url) return next();
        const url = new URL(req.url, 'http://localhost');

        let body;
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          const chunks = [];
          for await (const chunk of req) chunks.push(chunk);
          const raw = Buffer.concat(chunks).toString('utf8');
          try {
            body = raw ? JSON.parse(raw) : undefined;
          } catch {
            body = undefined;
          }
        }

        // Adapt Node's req/res to the small shape the handler expects, which is
        // the one Vercel's Node runtime provides.
        const request = {
          method: req.method,
          url: req.url,
          headers: req.headers,
          body,
          query: {
            ...Object.fromEntries(url.searchParams),
            path: url.pathname.split('/').filter(Boolean).map(decodeURIComponent),
          },
        };
        const response = {
          status(code) { res.statusCode = code; return response; },
          json(payload) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(payload));
            return response;
          },
        };

        try {
          await router(request, response);
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(err) }));
        }
      });
    },
  };
}
