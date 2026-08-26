import { getShareChunk, putShareChunk } from './_lib/store.js';

// The client splits a large share payload into chunks and records how many in a
// manifest, so a short link works regardless of payload size. That was
// originally a way around a per-value ceiling in the store; it still holds
// because a single enormous row is a bad idea in any database.
const MAX_CHUNK = 600_000;       // per-chunk char limit
const MAX_CHUNKS = 1024;         // a backstop, so a runaway upload can't hammer the database

// The manifest lives at index -1, out of the way of the chunks it counts.
const MANIFEST_INDEX = -1;

const ID_RE = /^[0-9a-f]{8}$/;

export default async function handler(req, res) {
  try {
    return await route(req, res);
  } catch (err) {
    // A missing or unreachable database is the deployment's problem, not the
    // caller's — say so plainly rather than returning a bare 500.
    if (/No database is configured/.test(String(err?.message))) {
      return res.status(503).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Database request failed' });
  }
}

async function route(req, res) {
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
      await putShareChunk(id, MANIFEST_INDEX, JSON.stringify({ n: total }));
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
    await putShareChunk(id, index, chunk);
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
      const value = await getShareChunk(id, i);
      if (value == null) return res.status(404).json({ error: 'Not found' });
      return res.status(200).json({ chunk: value });
    }

    // Manifest (new links) vs. raw payload (legacy single-value links). A
    // manifest is JSON and starts with '{'; base64 payloads never do.
    const value = await getShareChunk(id, MANIFEST_INDEX);
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
