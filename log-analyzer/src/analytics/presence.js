// Attrition / presence over time — the "shape of the fight."
//
// Replay-derived PRESENCE: how many players are sampled (on the field) each
// frame, split by team. Because WoR players respawn, presence is a "who's
// deployed right now" signal, not a death count — hence the neutral "present"
// framing in the UI.
//
// Scoreboard-derived CASUALTIES: when a scoreboard is attached, its kill log
// gives true cumulative casualties over the round, aligned to replay t_s. This
// is the authoritative attrition curve.

import { roundStartSec, killToReplayTs } from '../utils/killAlign';

// Normalized round times (seconds from the first sampled frame) for the x-axis.
export function roundTimes(replay) {
  const t0 = replay.frameTimes[0] || 0;
  const out = new Array(replay.frameCount);
  for (let f = 0; f < replay.frameCount; f++) out[f] = (replay.frameTimes[f] || 0) - t0;
  return out;
}

// Players present per frame, split by team. Returns { usa, csa, total } as
// number[] indexed by frame.
export function presenceOverTime(replay) {
  const { frameCount: F, playerCount: P } = replay;
  const xs = replay.tracks.x;
  const teams = replay.players.map((p) => p.team);
  const usa = new Array(F).fill(0);
  const csa = new Array(F).fill(0);
  const total = new Array(F).fill(0);
  for (let f = 0; f < F; f++) {
    const base = f * P;
    for (let p = 0; p < P; p++) {
      if (Number.isNaN(xs[base + p])) continue;
      total[f]++;
      if (teams[p] === 1) usa[f]++;
      else if (teams[p] === 2) csa[f]++;
    }
  }
  return { usa, csa, total };
}

// Peak presence per team over the round (used to render an attrition ratio /
// "how much of the force is still deployed").
export function peakPresence(presence) {
  return {
    usa: presence.usa.reduce((m, v) => Math.max(m, v), 0),
    csa: presence.csa.reduce((m, v) => Math.max(m, v), 0),
  };
}

// Cumulative scoreboard casualties per team, sampled at each replay frame.
// Returns { usa, csa, available } where available is false when there's no
// usable kill timing (no scoreboard, or no round-start anchor).
export function casualtiesOverTime(replay, kills) {
  const F = replay.frameCount;
  const usa = new Array(F).fill(0);
  const csa = new Array(F).fill(0);
  const startSec = roundStartSec(replay.meta);
  if (startSec == null || !kills || kills.length === 0) {
    return { usa, csa, available: false };
  }
  const events = [];
  for (const k of kills) {
    if (!k.time) continue;
    const ts = killToReplayTs(k.time, startSec);
    if (ts == null) continue;
    events.push({ ts, team: k.victimTeam });
  }
  if (events.length === 0) return { usa, csa, available: false };
  events.sort((a, b) => a.ts - b.ts);
  let ui = 0;
  let ci = 0;
  let ei = 0;
  for (let f = 0; f < F; f++) {
    const t = replay.frameTimes[f];
    while (ei < events.length && events[ei].ts <= t) {
      if (events[ei].team === 1) ui++;
      else if (events[ei].team === 2) ci++;
      ei++;
    }
    usa[f] = ui;
    csa[f] = ci;
  }
  return { usa, csa, available: true };
}

// Final casualties bucketed by cause, per team, from a scoreboard kill log.
// Returns [{ cause, usa, csa, total }] sorted by total desc.
export function casualtiesByCause(kills) {
  if (!kills || kills.length === 0) return [];
  const byCause = new Map();
  for (const k of kills) {
    const cause = k.cause || 'Unknown';
    if (!byCause.has(cause)) byCause.set(cause, { cause, usa: 0, csa: 0, total: 0 });
    const row = byCause.get(cause);
    if (k.victimTeam === 1) row.usa++;
    else if (k.victimTeam === 2) row.csa++;
    row.total++;
  }
  return [...byCause.values()].sort((a, b) => b.total - a.total);
}
