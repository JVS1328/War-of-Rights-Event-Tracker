// Event-scoped share links.
//
// Serializes a whole event (light round metadata + attached scoreboards +
// inlined replay payloads) into a compressed payload, and stores it either
// behind a short id via /api/share (Redis) or inline in the URL fragment as a
// fallback. Mirrors the original analyzer share transport (same pako deflateRaw
// + base64url + `analyzer-share:` Redis namespace) but for the event model.

import pako from 'pako';
import { encodeReplay, decodeReplay, bufferToBase64Url, base64UrlToBuffer } from '../utils/replayCodec';

const VERSION = 1;

// --- payload codec (JSON → deflateRaw → base64url) ---

function encodePayload(payload) {
  const json = JSON.stringify(payload);
  const deflated = pako.deflateRaw(json, { level: 9 });
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < deflated.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, deflated.subarray(i, i + CHUNK));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodePayload(encoded) {
  const pad = (4 - (encoded.length % 4)) % 4;
  const b64 = (encoded + '='.repeat(pad)).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const json = pako.inflateRaw(bytes, { to: 'string' });
  const obj = JSON.parse(json);
  if (obj.v !== VERSION) throw new Error('Unsupported share version');
  return obj;
}

// --- event <-> payload ---

// Build the shareable payload. Rounds carry their light meta + inline
// scoreboard; each referenced replay is encoded to a base64url blob under `rp`.
export function buildEventShare(event, replays) {
  const rp = {};
  for (const round of event.rounds) {
    const replay = replays.get(round.replayId);
    if (replay && !rp[round.replayId]) {
      rp[round.replayId] = bufferToBase64Url(encodeReplay(replay));
    }
  }
  return {
    v: VERSION,
    event: {
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
    },
    rp,
  };
}

// Rebuild { event, replays: Map } from a decoded payload.
export function restoreEventShare(payload) {
  const replays = new Map();
  const rp = payload.rp || {};
  for (const [id, b64] of Object.entries(rp)) {
    try { replays.set(id, decodeReplay(base64UrlToBuffer(b64))); }
    catch (err) { console.warn('Failed to decode shared replay', id, err); }
  }
  return { event: payload.event, replays };
}

// --- transport ---

// Try the short link (Redis) first; fall back to an inline fragment on failure
// (API down or payload over the server cap). Returns the shareable URL.
export async function createEventShareUrl(event, replays) {
  const payload = buildEventShare(event, replays);
  const encoded = encodePayload(payload);
  try {
    const res = await fetch('/api/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: encoded }),
    });
    if (res.ok) {
      const { id } = await res.json();
      return `${window.location.origin}${window.location.pathname}#s=${id}`;
    }
  } catch (err) {
    console.warn('Short share link failed, falling back to inline', err);
  }
  return `${window.location.origin}${window.location.pathname}#share=${encoded}`;
}

// Inspect the URL hash for a share. Returns { pending, id } for a short link,
// a decoded payload for an inline link, or null.
export function getShareFromUrl() {
  const hash = window.location.hash;
  if (hash.startsWith('#s=')) return { pending: true, id: hash.slice(3) };
  if (hash.startsWith('#share=')) {
    try { return decodePayload(hash.slice(7)); }
    catch { return null; }
  }
  return null;
}

// Fetch + decode a short-link payload by id.
export async function fetchSharePayload(id) {
  try {
    const res = await fetch(`/api/share?id=${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    const { payload } = await res.json();
    return decodePayload(payload);
  } catch {
    return null;
  }
}
