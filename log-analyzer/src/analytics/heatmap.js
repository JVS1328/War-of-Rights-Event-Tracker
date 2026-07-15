// Heatmap point collection — where players were, and where they fell.
//
// We project sampled world-meter positions to map-pixel space (the same affine
// the viewer uses) and hand back flat point arrays; the Heatmap component bins
// them into a density grid sized to the map image and colorizes. Kept as point
// collectors (not a pre-binned grid) so the component can choose grid
// resolution against the loaded image without re-reading tracks.

import { worldMetersToMapPx } from '../utils/mapCalibration';
import { roundStartSec, killToReplayTs } from '../utils/killAlign';
import { frameIndexForTime } from './timeIndex';

// Collect every sampled position (optionally filtered by a predicate on the
// player meta) as map-pixel points. Returns Float32Array [x0,y0,x1,y1,…].
export function presencePoints(replay, slug, filter) {
  const { frameCount: F, playerCount: P } = replay;
  const { x, y } = replay.tracks;
  const keep = new Uint8Array(P);
  for (let p = 0; p < P; p++) keep[p] = filter ? (filter(replay.players[p], p) ? 1 : 0) : 1;
  const out = [];
  for (let f = 0; f < F; f++) {
    const base = f * P;
    for (let p = 0; p < P; p++) {
      if (!keep[p]) continue;
      const wx = x[base + p];
      if (Number.isNaN(wx)) continue;
      const mp = worldMetersToMapPx(slug, wx, y[base + p]);
      if (!mp) continue;
      out.push(mp.x, mp.y);
    }
  }
  return Float32Array.from(out);
}

// Project scoreboard kill locations: each timed kill → the victim's position at
// that kill's frame, in map pixels. Returns [{ x, y, victimTeam }].
export function casualtyPoints(replay, kills, slug) {
  const startSec = roundStartSec(replay.meta);
  if (startSec == null || !kills) return [];
  const nameToIdx = new Map();
  replay.players.forEach((p, i) => nameToIdx.set(p.name, i));
  const { playerCount: P } = replay;
  const { x, y } = replay.tracks;
  const out = [];
  for (const k of kills) {
    if (!k.time) continue;
    const ts = killToReplayTs(k.time, startSec);
    if (ts == null) continue;
    const victim = k.victim || k.player;
    const pi = nameToIdx.get(victim);
    if (pi === undefined) continue;
    const f = frameIndexForTime(replay.frameTimes, ts);
    let wx = x[f * P + pi];
    let wy = y[f * P + pi];
    // Victim may already be unsampled at the exact kill frame; walk back a few
    // frames to their last known position.
    let back = f;
    while (Number.isNaN(wx) && back > 0) {
      back--;
      wx = x[back * P + pi];
      wy = y[back * P + pi];
    }
    if (Number.isNaN(wx)) continue;
    const mp = worldMetersToMapPx(slug, wx, wy);
    if (!mp) continue;
    out.push({ x: mp.x, y: mp.y, victimTeam: k.victimTeam });
  }
  return out;
}
