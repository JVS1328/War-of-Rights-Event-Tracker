import { createMemoryRedis } from './memoryRedis.js';
import { setRedis } from './store.js';
import router from './router.js';

/**
 * A Vite dev-server plugin that mounts the database API, so `npm run dev`
 * serves the same routes the deployment does. Without it the public site has
 * nothing to read from locally and every page shows a network error.
 *
 * With Upstash credentials in the environment it talks to the real database;
 * without them it runs against an in-memory store that lasts as long as the dev
 * server does. Either way the handler under test is the production one.
 */
export function devApi() {
  return {
    name: 'wor-dev-api',
    apply: 'serve',
    configureServer(server) {
      const live = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
      if (!live) {
        setRedis(createMemoryRedis());
        // Dev needs *a* token or every write 401s; it is printed so it can be
        // pasted into the admin screen, and it only exists on this machine.
        process.env.WOR_ADMIN_TOKEN ??= 'dev-owner-token-not-a-secret';
        server.config.logger.info(
          `  ➜  database: in-memory (dev) · owner token: ${process.env.WOR_ADMIN_TOKEN}`,
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
