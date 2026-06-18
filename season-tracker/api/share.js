import { Redis } from '@upstash/redis';

// A single Upstash REST value/request is capped near 1 MB, so the client splits
// large share payloads into sub-1MB string chunks stored under separate keys,
// with a manifest (`{"n":<count>}`) recording how many. This removes the old
// single-value size ceiling — short links now work regardless of payload size.
const MAX_CHUNK = 600_000;       // per-chunk char limit — keeps each request < ~1MB
const MAX_CHUNKS = 1024;         // ~512MB backstop so a runaway upload can't hammer Redis
const SHARE_TTL = 31_536_000;    // 1 year, in seconds — abandoned/orphan chunks self-clean

const ID_RE = /^[0-9a-f]{8}$/;

// The Upstash Vercel integration injects REST URL/token under either the Upstash
// names or Vercel's KV-prefixed names depending on how it was added; accept both.
let redis;
function getRedis() {
  if (!redis) {
    const url = process.env.UPSTASH_REDIS_REST_URL
      || process.env.KV_REST_API_URL
      || process.env.upstash_KV_REST_API_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN
      || process.env.KV_REST_API_TOKEN
      || process.env.upstash_KV_REST_API_TOKEN;
    if (!url || !token) {
      throw new Error('Upstash Redis is not configured (missing REST URL/token)');
    }
    // Payloads are opaque base64 strings — disable JSON (de)serialization so they
    // round-trip byte-for-byte.
    redis = new Redis({ url, token, automaticDeserialization: false });
  }
  return redis;
}

export default async function handler(req, res) {
  let client;
  try {
    client = getRedis();
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }

  if (req.method === 'POST') {
    const { id, index, chunk, total } = req.body || {};
    if (typeof id !== 'string' || !ID_RE.test(id)) {
      return res.status(400).json({ error: 'Missing or invalid id' });
    }

    // Finalize: write the manifest. The client sends this only after every chunk
    // is stored, so a reader never sees a manifest pointing at missing chunks.
    if (total !== undefined) {
      if (!Number.isInteger(total) || total < 1) {
        return res.status(400).json({ error: 'Invalid total' });
      }
      if (total > MAX_CHUNKS) {
        return res.status(413).json({ error: 'Too many chunks' });
      }
      await client.set(`season-share:${id}`, JSON.stringify({ n: total }), { ex: SHARE_TTL });
      return res.status(200).json({ id });
    }

    // Chunk write.
    if (!Number.isInteger(index) || index < 0 || index >= MAX_CHUNKS) {
      return res.status(400).json({ error: 'Invalid index' });
    }
    if (typeof chunk !== 'string' || chunk.length === 0) {
      return res.status(400).json({ error: 'Invalid chunk' });
    }
    if (chunk.length > MAX_CHUNK) {
      return res.status(413).json({ error: 'Chunk too large' });
    }
    await client.set(`season-share:${id}:${index}`, chunk, { ex: SHARE_TTL });
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'GET') {
    const { id, chunk } = req.query;
    if (typeof id !== 'string' || !ID_RE.test(id)) {
      return res.status(400).json({ error: 'Missing or invalid id' });
    }

    // Fetch a single chunk by index.
    if (chunk !== undefined) {
      const i = Number(chunk);
      if (!Number.isInteger(i) || i < 0) {
        return res.status(400).json({ error: 'Invalid chunk index' });
      }
      const value = await client.get(`season-share:${id}:${i}`);
      if (value == null) return res.status(404).json({ error: 'Not found' });
      return res.status(200).json({ chunk: value });
    }

    // Manifest (new links) vs. raw payload (legacy single-value links). A
    // manifest is JSON and starts with '{'; base64 payloads never do.
    const value = await client.get(`season-share:${id}`);
    if (value == null) return res.status(404).json({ error: 'Not found' });
    if (typeof value === 'string' && value.startsWith('{')) {
      try {
        const { n } = JSON.parse(value);
        if (Number.isInteger(n) && n > 0) {
          return res.status(200).json({ chunked: true, total: n });
        }
      } catch {
        // Corrupt manifest — treat as not found.
      }
      return res.status(404).json({ error: 'Not found' });
    }
    return res.status(200).json({ payload: value });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
