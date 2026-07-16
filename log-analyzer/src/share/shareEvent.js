// Event-scoped share links.
//
// Serializes a whole event (light round metadata + attached scoreboards +
// inlined replay payloads) into a compressed payload, and stores it either
// behind a short id via /api/share (Redis) or inline in the URL fragment as a
// fallback.
//
// Transport format (v3): a single binary container
//
//   [u8 version=3][u32 headerLen LE][header JSON utf-8][replay0][replay1]…
//
// deflated ONCE (raw binary) and base64url'd ONCE. Two size wins stack here:
//   1. No double-encoding. The old v1 format base64'd each replay, embedded
//      those strings in JSON, then deflated + base64'd the whole thing again —
//      inflating the payload and making deflate chew on already-base64'd bytes.
//   2. Quantized replay blobs (see ./quantReplay): int16 positions, int8
//      headings, dropped z — ~1/3 the bytes of the full-fidelity codec, which
//      is what actually brings large multi-round events under the short-link
//      cap instead of falling back to multi-MB inline URLs.
// v2 (full-fidelity blobs) and v1 (legacy JSON) links are still decoded.

import pako from 'pako';
import { decodeReplay, bufferToBase64Url, base64UrlToBuffer } from '../utils/replayCodec';
import { encodeQuantReplay, decodeQuantReplay } from './quantReplay';

const VERSION = 3;
const enc = new TextEncoder();
const dec = new TextDecoder('utf-8');

// Light, JSON-safe view of the event (rounds keep their meta + inline
// scoreboard; replay bytes travel separately in the binary container).
function serializeEvent(event) {
  return {
    id: event.id,
    name: event.name,
    createdAt: event.createdAt,
    rounds: event.rounds.map((r) => ({
      id: r.id,
      replayId: r.replayId,
      filename: r.filename,
      ts: r.ts,
      meta: r.meta,
      scoreboard: r.scoreboard || null,
      scoreboardFilename: r.scoreboardFilename || null,
    })),
  };
}

// --- encode: event + replays → { payload: base64url string, stride } ---

// Keep the stored payload under this many base64 chars so it fits the share
// store's per-request limit (Upstash's free tier caps a request at ~1 MB) and
// the serverless body cap. Events too large for that are downsampled in time
// (see stride, below) until they fit.
const SHARE_BUDGET = 850_000;

function buildAtStride(event, replays, stride) {
  const order = [];
  const blobs = [];
  const seen = new Set();
  for (const round of event.rounds) {
    const rid = round.replayId;
    if (!rid || seen.has(rid)) continue;
    const replay = replays.get(rid);
    if (!replay) continue;
    seen.add(rid);
    const buf = new Uint8Array(encodeQuantReplay(replay, stride));
    order.push({ id: rid, len: buf.byteLength });
    blobs.push(buf);
  }

  const header = enc.encode(JSON.stringify({ v: VERSION, event: serializeEvent(event), rp: order }));
  let total = 1 + 4 + header.byteLength;
  for (const b of blobs) total += b.byteLength;

  const container = new Uint8Array(total);
  const dv = new DataView(container.buffer);
  container[0] = VERSION;
  dv.setUint32(1, header.byteLength, true);
  container.set(header, 5);
  let off = 5 + header.byteLength;
  for (const b of blobs) { container.set(b, off); off += b.byteLength; }

  // level 6: near level 9's size on position data but much faster.
  return bufferToBase64Url(pako.deflateRaw(container, { level: 6 }));
}

export function encodeEventShare(event, replays, { maxBytes = SHARE_BUDGET } = {}) {
  // Estimate a starting stride from the total player-frames so a huge event
  // usually fits on the first pass without an expensive full-resolution build.
  // ~5.5 base64 bytes per quantized player-frame is a safe over-estimate.
  let totalPF = 0;
  const seen = new Set();
  for (const round of event.rounds) {
    const rid = round.replayId;
    if (!rid || seen.has(rid)) continue;
    seen.add(rid);
    const rp = replays.get(rid);
    if (rp) totalPF += rp.frameCount * rp.playerCount;
  }
  let stride = maxBytes > 0 ? Math.max(1, Math.ceil((totalPF * 5.5) / maxBytes)) : 1;
  let payload = buildAtStride(event, replays, stride);

  // Correct the estimate against the real compressed size (increase only).
  for (let i = 0; i < 5 && maxBytes > 0 && payload.length > maxBytes && stride < 4096; i++) {
    stride = Math.max(stride + 1, Math.ceil(stride * (payload.length / maxBytes) * 1.05));
    payload = buildAtStride(event, replays, stride);
  }
  return { payload, stride };
}

// --- decode: base64url payload string → { event, replays: Map } ---

export function decodeEventShare(encoded) {
  const bytes = new Uint8Array(base64UrlToBuffer(encoded));
  const inflated = pako.inflateRaw(bytes);
  const v = inflated[0];
  if (v === 3) return decodeContainer(inflated, decodeQuantReplay); // quantized blobs
  if (v === 2) return decodeContainer(inflated, decodeReplay);      // full-fidelity blobs
  return decodeV1(inflated);                                        // legacy JSON
}

// Shared decode for the binary container formats (v2/v3); `decodeBlob` turns a
// replay blob's ArrayBuffer back into a replay.
function decodeContainer(inflated, decodeBlob) {
  const dv = new DataView(inflated.buffer, inflated.byteOffset, inflated.byteLength);
  const headerLen = dv.getUint32(1, true);
  const header = JSON.parse(dec.decode(inflated.subarray(5, 5 + headerLen)));
  let off = 5 + headerLen;
  const replays = new Map();
  for (const { id, len } of header.rp || []) {
    // Copy each blob out to its own buffer so the typed-array views inside the
    // decoder land on a fresh, aligned ArrayBuffer.
    const slice = inflated.slice(off, off + len);
    off += len;
    try { replays.set(id, decodeBlob(slice.buffer)); }
    catch (err) { console.warn('Failed to decode shared replay', id, err); }
  }
  return { event: header.event, replays };
}

// Legacy v1: the whole inflated buffer is JSON { v:1, event, rp: {id:b64url} }.
function decodeV1(inflated) {
  const obj = JSON.parse(dec.decode(inflated));
  if (obj.v !== 1) throw new Error('Unsupported share version');
  const replays = new Map();
  for (const [id, b64] of Object.entries(obj.rp || {})) {
    try { replays.set(id, decodeReplay(base64UrlToBuffer(b64))); }
    catch (err) { console.warn('Failed to decode shared replay', id, err); }
  }
  return { event: obj.event, replays };
}

// --- transport ---

function shareBase() {
  return `${window.location.origin}${window.location.pathname}`;
}

// Try the short link (Redis) first; fall back to an inline fragment on failure
// (API down or payload over the server cap). Returns { url, stride }, where
// stride > 1 means the shared copy was downsampled in time to fit.
export async function createEventShareUrl(event, replays) {
  const { payload: encoded, stride } = encodeEventShare(event, replays);
  try {
    const res = await fetch('/api/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: encoded }),
    });
    if (res.ok) {
      const { id } = await res.json();
      return { url: `${shareBase()}#s=${id}`, stride };
    }
  } catch (err) {
    console.warn('Short share link failed, falling back to inline', err);
  }
  return { url: `${shareBase()}#share=${encoded}`, stride };
}

// Inspect the URL hash for a share. Returns { pending, id } for a short link,
// a decoded { event, replays } for an inline link, or null.
export function getShareFromUrl() {
  const hash = window.location.hash;
  if (hash.startsWith('#s=')) return { pending: true, id: hash.slice(3) };
  if (hash.startsWith('#share=')) {
    try { return decodeEventShare(hash.slice(7)); }
    catch { return null; }
  }
  return null;
}

// Fetch + decode a short-link payload by id → { event, replays } or null.
export async function fetchSharePayload(id) {
  try {
    const res = await fetch(`/api/share?id=${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    const { payload } = await res.json();
    return decodeEventShare(payload);
  } catch {
    return null;
  }
}
