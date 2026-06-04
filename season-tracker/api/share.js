import { Redis } from '@upstash/redis';
import crypto from 'node:crypto';

// Upstash free tier caps a single value at ~1 MB. Compressed share payloads are
// well under this for seasons; large stats bundles (with killfeeds) are the only
// thing that can approach it — those get a clear 413 instead of a giant URL.
const MAX_PAYLOAD = 1_000_000; // 1 MB

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
    const { payload } = req.body;
    if (!payload || typeof payload !== 'string') {
      return res.status(400).json({ error: 'Missing payload' });
    }
    if (payload.length > MAX_PAYLOAD) {
      return res.status(413).json({ error: 'Payload too large' });
    }

    const id = crypto.createHash('sha256').update(payload).digest('hex').slice(0, 8);
    await client.set(`season-share:${id}`, payload);
    return res.status(200).json({ id });
  }

  if (req.method === 'GET') {
    const { id } = req.query;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Missing id' });
    }

    const payload = await client.get(`season-share:${id}`);
    if (payload == null) {
      return res.status(404).json({ error: 'Not found' });
    }
    return res.status(200).json({ payload });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
