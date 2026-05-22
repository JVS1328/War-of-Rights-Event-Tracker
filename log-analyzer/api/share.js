import { createClient } from 'redis';
import crypto from 'node:crypto';

// Raised from 512 KB to 5 MB to fit inline replay payloads (top-down
// player traces for the replay viewer). Replay-bearing shares are still
// pako-compressed on the client before being uploaded; this cap leaves
// comfortable headroom for a typical multi-round bundle.
const MAX_PAYLOAD = 5 * 1024 * 1024;

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
