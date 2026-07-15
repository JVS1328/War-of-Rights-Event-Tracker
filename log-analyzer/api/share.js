import { createClient } from 'redis';
import crypto from 'node:crypto';

// Allow the request body up to 10 MB. Without this an API route's default
// body parser caps at ~1 MB and rejects large event payloads with a 413
// *before* our own check runs — the client then falls back to stuffing the
// whole blob into the URL fragment (the multi-MB inline share links we saw
// in the wild). Keep this in step with MAX_PAYLOAD below.
export const config = {
  api: {
    bodyParser: { sizeLimit: '10mb' },
  },
};

// Server-side cap on the stored payload. Payloads are pako-compressed on the
// client; the cap protects Redis from runaways while still leaving room for
// multi-round events with inlined replay traces.
const MAX_PAYLOAD = 10 * 1024 * 1024;

let redis;
async function getRedis() {
  if (!redis) {
    redis = await createClient({ url: process.env.REDIS_URL }).connect();
  }
  return redis;
}

export default async function handler(req, res) {
  const client = await getRedis();

  if (req.method === 'POST') {
    const { payload } = req.body;
    if (!payload || typeof payload !== 'string') {
      return res.status(400).json({ error: 'Missing payload' });
    }
    if (payload.length > MAX_PAYLOAD) {
      return res.status(413).json({ error: 'Payload too large' });
    }

    const id = crypto.createHash('sha256').update(payload).digest('hex').slice(0, 8);
    await client.set(`analyzer-share:${id}`, payload);
    return res.status(200).json({ id });
  }

  if (req.method === 'GET') {
    const { id } = req.query;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Missing id' });
    }

    const payload = await client.get(`analyzer-share:${id}`);
    if (payload == null) {
      return res.status(404).json({ error: 'Not found' });
    }
    return res.status(200).json({ payload });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
