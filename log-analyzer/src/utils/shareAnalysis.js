import pako from 'pako';
import { encodeReplay, decodeReplay, bufferToBase64Url, base64UrlToBuffer } from './replayCodec.js';

// --- Encode / Decode (deflate + base64url) ---

const encodePayload = (payload) => {
  const json = JSON.stringify(payload);
  const compressed = pako.deflateRaw(json, { level: 9 });
  // Stream the binary string in chunks so large payloads don't blow the
  // call stack via String.fromCharCode.apply(null, hugeArray).
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < compressed.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, compressed.subarray(i, i + CHUNK));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const decodePayload = (encoded) => {
  try {
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const json = pako.inflateRaw(bytes, { to: 'string' });
    const p = JSON.parse(json);
    if (p?.v !== 1) return null;
    return p;
  } catch {
    return null;
  }
};

// --- Build share state from current app state ---
//
// `replaysById` is an optional Map<replayId, parsedReplay> — when present we
// inline-encode each attached replay so the share recipient sees the viewer
// without having to re-upload the CSV. Replays are encoded into a compact
// binary blob and base64url-stuffed into the JSON payload; pako handles the
// rest of the compression on the way out.

export const buildShareState = ({
  rounds,
  playerAssignments,
  selectedRoundId,
  disabledDeathTypes,
  replaysById,
}) => {
  const cleanRounds = rounds.map(r => {
    const base = {
      id: r.id,
      startTime: r.startTime,
      endTime: r.endTime,
      duration: r.duration,
      kills: r.kills,
      teamkills: r.teamkills || [],
      playerSessions: r.playerSessions,
      adjustedCasualties: r.adjustedCasualties,
      isScoreboard: r.isScoreboard,
      playerKills: r.playerKills,
    };
    if (r.playerFormations) base.playerFormations = r.playerFormations;
    if (r.metadata) base.metadata = r.metadata;
    if (r.players) base.players = r.players;
    if (r.replayId) base.replayId = r.replayId;
    return base;
  });

  const payload = { v: 1, rounds: cleanRounds };

  if (Object.keys(playerAssignments || {}).length > 0) {
    payload.pa = playerAssignments;
  }
  if (selectedRoundId != null) {
    payload.sr = selectedRoundId;
  }
  if (disabledDeathTypes && disabledDeathTypes.size > 0) {
    payload.ddt = [...disabledDeathTypes];
  }

  // Inline encode any replays referenced by the rounds. Skip ones that
  // aren't in the map (e.g. round has a stale replayId pointing at a
  // replay the user already deleted).
  if (replaysById && replaysById.size > 0) {
    const referenced = new Set(cleanRounds.map(r => r.replayId).filter(Boolean));
    const out = {};
    for (const id of referenced) {
      const replay = replaysById.get(id);
      if (!replay) continue;
      out[id] = bufferToBase64Url(encodeReplay(replay));
    }
    if (Object.keys(out).length > 0) payload.rp = out;
  }

  return payload;
};

// --- Restore share state ---

export const restoreShareState = (data) => {
  if (!data || data.v !== 1 || !data.rounds) return null;
  const replays = new Map();
  if (data.rp && typeof data.rp === 'object') {
    for (const [id, b64] of Object.entries(data.rp)) {
      try {
        replays.set(id, decodeReplay(base64UrlToBuffer(b64)));
      } catch (e) {
        console.warn('Failed to decode shared replay', id, e);
      }
    }
  }
  return {
    rounds: data.rounds,
    playerAssignments: data.pa || {},
    selectedRoundId: data.sr ?? null,
    disabledDeathTypes: new Set(data.ddt || []),
    replays,
  };
};

// --- URL generation ---

export const generateShareUrl = (state) => {
  const encoded = encodePayload(buildShareState(state));
  return `${window.location.origin + window.location.pathname}#share=${encoded}`;
};

export const generateShortShareUrl = async (state) => {
  const payload = encodePayload(buildShareState(state));
  const res = await fetch('/api/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload }),
  });
  if (!res.ok) throw new Error('Share API unavailable');
  const { id } = await res.json();
  return `${window.location.origin + window.location.pathname}#s=${id}`;
};

// --- URL parsing ---

export const getShareFromUrl = () => {
  const hash = window.location.hash;
  if (hash.startsWith('#s=')) return { pending: true, id: hash.slice(3) };
  if (hash.startsWith('#share=')) return decodePayload(hash.slice(7));
  return null;
};

export const fetchSharePayload = async (id) => {
  try {
    const res = await fetch(`/api/share?id=${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    const { payload } = await res.json();
    return decodePayload(payload);
  } catch {
    return null;
  }
};
