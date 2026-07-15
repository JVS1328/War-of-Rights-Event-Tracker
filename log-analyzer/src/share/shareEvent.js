// Event-scoped share links.
//
// Serializes a whole event (light round metadata + attached scoreboards +
// inlined replay payloads) into a compressed payload, and stores it either
// behind a short id via /api/share (Redis) or inline in the URL fragment as a
// fallback.
//
// Transport format (v2): a single binary container
//
//   [u8 version=2][u32 headerLen LE][header JSON utf-8][replay0][replay1]…
//
// deflated ONCE (raw binary) and base64url'd ONCE. The old v1 format base64'd
// each replay blob, embedded those strings in JSON, then deflated + base64'd
// the whole thing again — double-encoding that inflated the payload ~35% and
// made deflate chew on already-base64'd bytes (which barely compress). Packing
// the raw replay bytes and compressing them directly is both markedly faster
// and small enough that events which used to overflow the short-link cap (and
// fall back to multi-MB inline URLs) now get a real short link. v1 links are
// still decoded for backward compatibility.

import pako from 'pako';
import { encodeReplay, decodeReplay, bufferToBase64Url, base64UrlToBuffer } from '../utils/replayCodec';

const VERSION = 2;
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

// --- encode: event + replays → base64url payload string ---

export function encodeEventShare(event, replays) {
  const order = [];
  const blobs = [];
  const seen = new Set();
  for (const round of event.rounds) {
    const rid = round.replayId;
    if (!rid || seen.has(rid)) continue;
    const replay = replays.get(rid);
    if (!replay) continue;
    seen.add(rid);
    const buf = new Uint8Array(encodeReplay(replay));
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

  // level 6: near the size of level 9 on float-heavy position data but much
  // faster, which is what keeps the (large) share build responsive.
  const deflated = pako.deflateRaw(container, { level: 6 });
  return bufferToBase64Url(deflated);
}

// --- decode: base64url payload string → { event, replays: Map } ---

export function decodeEventShare(encoded) {
  const bytes = new Uint8Array(base64UrlToBuffer(encoded));
  const inflated = pako.inflateRaw(bytes);
  if (inflated[0] === VERSION) return decodeV2(inflated);
  return decodeV1(inflated); // legacy links (whole buffer is JSON)
}

function decodeV2(inflated) {
  const dv = new DataView(inflated.buffer, inflated.byteOffset, inflated.byteLength);
  const headerLen = dv.getUint32(1, true);
  const header = JSON.parse(dec.decode(inflated.subarray(5, 5 + headerLen)));
  let off = 5 + headerLen;
  const replays = new Map();
  for (const { id, len } of header.rp || []) {
    // Copy each blob out to its own buffer so the Float32 views in
    // decodeReplay land on a fresh, 4-byte-aligned ArrayBuffer.
    const slice = inflated.slice(off, off + len);
    off += len;
    try { replays.set(id, decodeReplay(slice.buffer)); }
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
// (API down or payload over the server cap). Returns the shareable URL.
export async function createEventShareUrl(event, replays) {
  const encoded = encodeEventShare(event, replays);
  try {
    const res = await fetch('/api/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: encoded }),
    });
    if (res.ok) {
      const { id } = await res.json();
      return `${shareBase()}#s=${id}`;
    }
  } catch (err) {
    console.warn('Short share link failed, falling back to inline', err);
  }
  return `${shareBase()}#share=${encoded}`;
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
