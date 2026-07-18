import crypto from 'node:crypto';

// Allow the request body up to 10 MB. Without this a Next-style API route's
// default body parser caps at ~1 MB and rejects large event payloads with a
// 413 *before* our own check runs, forcing the client to fall back to stuffing
// the whole blob into the URL fragment (the multi-MB inline links). Note: some
// serverless platforms (e.g. Vercel functions) also enforce their own hard
// request-body cap (~4.5 MB) that this can't lift — which is why the client
// now quantizes replay payloads to stay well under it.
export const config = {
  api: {
    bodyParser: { sizeLimit: '10mb' },
  },
};

// Server-side cap on the stored payload. Payloads are pako-compressed on the
// client; the cap protects the store from runaways.
const MAX_PAYLOAD = 10 * 1024 * 1024;
const PREFIX = 'analyzer-share:';
const SHARE_TTL = 31_536_000; // 1 year, in seconds — abandoned shares self-clean

// Storage backend. Prefer Upstash's HTTP/REST client — it's stateless per
// request, so it works cleanly on serverless where a long-lived node-redis TCP
// socket does not (cold starts, dropped connections, and unreachable hosts are
// the usual reason POSTs fail and links fall back to inline). Falls back to a
// classic node-redis TCP client when only a redis:// URL is configured.
//
// Vercel's storage integrations PREFIX every var with the store name, e.g.
// `upstash_KV_REST_API_URL` / `upstash_KV_REST_API_TOKEN`, so we resolve by
// suffix rather than exact name — any prefix is accepted:
//
//   REST (preferred):  *KV_REST_API_URL   + *KV_REST_API_TOKEN
//                      (or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN)
//   TCP  (fallback):   *REDIS_URL  or  *KV_URL   (rediss:// is fine)
//
// The suffix match deliberately targets *_KV_REST_API_TOKEN, which does NOT
// match *_KV_REST_API_READ_ONLY_TOKEN — we need write access to store links.

// Resolve an env var by exact name first, then by `_<name>` suffix so an
// integration prefix (upstash_, storage_, …) is picked up without renaming.
export function pickEnv(...names) {
  for (const name of names) {
    if (process.env[name]) return process.env[name];
    const hit = Object.entries(process.env).find(([k, v]) => v && k.endsWith(`_${name}`));
    if (hit) return hit[1];
  }
  return undefined;
}

let store;
async function getStore() {
  if (store) return store;

  const restUrl = pickEnv('UPSTASH_REDIS_REST_URL', 'KV_REST_API_URL');
  const restToken = pickEnv('UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_TOKEN');
  if (restUrl && restToken) {
    const { Redis } = await import('@upstash/redis');
    // Store/return raw strings — our payload is base64url, not JSON, so leave
    // Upstash's automatic (de)serialization off to avoid surprises.
    const redis = new Redis({ url: restUrl, token: restToken, automaticDeserialization: false });
    store = {
      get: (k) => redis.get(k),
      // Resolves truthy when the key was created, null when it already existed.
      setOnce: (k, v) => redis.set(k, v, { nx: true, ex: SHARE_TTL }),
      expire: (k) => redis.expire(k, SHARE_TTL),
    };
    return store;
  }

  const redisUrl = pickEnv('REDIS_URL', 'KV_URL');
  if (redisUrl) {
    const { createClient } = await import('redis');
    const client = await createClient({ url: redisUrl }).connect();
    store = {
      get: (k) => client.get(k),
      setOnce: (k, v) => client.set(k, v, { NX: true, EX: SHARE_TTL }),
      expire: (k) => client.expire(k, SHARE_TTL),
    };
    return store;
  }

  throw new Error('No share store configured (set *KV_REST_API_URL + *KV_REST_API_TOKEN, or a *REDIS_URL)');
}

export default async function handler(req, res) {
  let client;
  try {
    client = await getStore();
  } catch (err) {
    console.error('Share store unavailable', err);
    return res.status(503).json({ error: 'Share storage not configured' });
  }

  if (req.method === 'POST') {
    const { payload } = req.body || {};
    if (!payload || typeof payload !== 'string') {
      return res.status(400).json({ error: 'Missing payload' });
    }
    if (payload.length > MAX_PAYLOAD) {
      return res.status(413).json({ error: 'Payload too large' });
    }

    // Write-once: the id is a hash of the payload, so an existing key already
    // holds these exact bytes — or is a deliberate hash-prefix collision trying
    // to replace someone's shared link. Either way, never overwrite; a dedupe
    // hit just refreshes the TTL so re-shared links stay live.
    const id = crypto.createHash('sha256').update(payload).digest('hex').slice(0, 8);
    const key = `${PREFIX}${id}`;
    const created = await client.setOnce(key, payload);
    if (!created) await client.expire(key);
    return res.status(200).json({ id });
  }

  if (req.method === 'GET') {
    const { id } = req.query;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Missing id' });
    }

    const payload = await client.get(`${PREFIX}${id}`);
    if (payload == null) {
      return res.status(404).json({ error: 'Not found' });
    }
    return res.status(200).json({ payload: String(payload) });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
