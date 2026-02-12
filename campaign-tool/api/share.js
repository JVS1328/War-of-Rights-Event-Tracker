import { kv } from '@vercel/kv';
import crypto from 'node:crypto';

const MAX_PAYLOAD = 512_000; // 500 KB

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { payload } = req.body;
    if (!payload || typeof payload !== 'string') {
      return res.status(400).json({ error: 'Missing payload' });
    }
    if (payload.length > MAX_PAYLOAD) {
      return res.status(413).json({ error: 'Payload too large' });
    }

    const id = crypto.createHash('sha256').update(payload).digest('hex').slice(0, 8);
    await kv.set(`share:${id}`, payload);
    return res.status(200).json({ id });
  }

  if (req.method === 'GET') {
    const { id } = req.query;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Missing id' });
    }

    const payload = await kv.get(`share:${id}`);
    if (payload == null) {
      return res.status(404).json({ error: 'Not found' });
    }
    return res.status(200).json({ payload });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
