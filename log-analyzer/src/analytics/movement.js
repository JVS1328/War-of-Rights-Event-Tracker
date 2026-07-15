// Movement & frontline analytics — advance/retreat, distance, cohesion.
//
// All positions are in world meters (replay.tracks.x/y). NaN marks a player not
// sampled that frame and is skipped everywhere.

// Per-frame centroid { x, y } per team (null when a team has nobody sampled).
export function centroidsOverTime(replay) {
  const { frameCount: F, playerCount: P } = replay;
  const { x, y } = replay.tracks;
  const teams = replay.players.map((p) => p.team);
  const usa = new Array(F).fill(null);
  const csa = new Array(F).fill(null);
  for (let f = 0; f < F; f++) {
    const base = f * P;
    let ux = 0, uy = 0, un = 0, cx = 0, cy = 0, cn = 0;
    for (let p = 0; p < P; p++) {
      const px = x[base + p];
      if (Number.isNaN(px)) continue;
      const py = y[base + p];
      if (teams[p] === 1) { ux += px; uy += py; un++; }
      else if (teams[p] === 2) { cx += px; cy += py; cn++; }
    }
    if (un) usa[f] = { x: ux / un, y: uy / un };
    if (cn) csa[f] = { x: cx / cn, y: cy / cn };
  }
  return { usa, csa };
}

// Distance between the two team centroids per frame (meters); null when either
// side is empty. Falling = closing to contact, rising = disengaging.
export function centroidSeparation(replay, centroids) {
  const c = centroids || centroidsOverTime(replay);
  const F = replay.frameCount;
  const out = new Array(F).fill(null);
  for (let f = 0; f < F; f++) {
    const a = c.usa[f];
    const b = c.csa[f];
    if (a && b) out[f] = Math.hypot(a.x - b.x, a.y - b.y);
  }
  return out;
}

// Total ground covered per player (meters) — sum of frame-to-frame
// displacement across sampled frames. Returns Float64Array indexed by player.
export function distancePerPlayer(replay) {
  const { frameCount: F, playerCount: P } = replay;
  const { x, y } = replay.tracks;
  const dist = new Float64Array(P);
  for (let p = 0; p < P; p++) {
    let lastX = NaN, lastY = NaN;
    for (let f = 0; f < F; f++) {
      const px = x[f * P + p];
      if (Number.isNaN(px)) { lastX = NaN; continue; }
      const py = y[f * P + p];
      if (!Number.isNaN(lastX)) dist[p] += Math.hypot(px - lastX, py - lastY);
      lastX = px; lastY = py;
    }
  }
  return dist;
}

// Cohesion: per-frame mean distance of a team's sampled players from their
// team centroid (meters). Lower = tighter formation. { usa, csa } number[].
export function spreadOverTime(replay, centroids) {
  const c = centroids || centroidsOverTime(replay);
  const { frameCount: F, playerCount: P } = replay;
  const { x, y } = replay.tracks;
  const teams = replay.players.map((p) => p.team);
  const usa = new Array(F).fill(null);
  const csa = new Array(F).fill(null);
  for (let f = 0; f < F; f++) {
    const base = f * P;
    let us = 0, un = 0, cs = 0, cn = 0;
    for (let p = 0; p < P; p++) {
      const px = x[base + p];
      if (Number.isNaN(px)) continue;
      const py = y[base + p];
      if (teams[p] === 1 && c.usa[f]) { us += Math.hypot(px - c.usa[f].x, py - c.usa[f].y); un++; }
      else if (teams[p] === 2 && c.csa[f]) { cs += Math.hypot(px - c.csa[f].x, py - c.csa[f].y); cn++; }
    }
    if (un) usa[f] = us / un;
    if (cn) csa[f] = cs / cn;
  }
  return { usa, csa };
}

// Find the first frame where both teams have a centroid, to anchor the attack
// axis. Returns { usa, csa } centroids or null.
function initialCentroids(centroids) {
  for (let f = 0; f < centroids.usa.length; f++) {
    if (centroids.usa[f] && centroids.csa[f]) {
      return { usa: centroids.usa[f], csa: centroids.csa[f] };
    }
  }
  return null;
}

// Frontline / advance-retreat. Projects each team's sampled positions onto the
// attack axis (USA→CSA starting centroids) and takes a percentile per frame:
// USA uses its *leading* edge (toward CSA), CSA uses its leading edge (toward
// USA). Both series are in meters along the axis, with 0 at the USA start and
// `span` at the CSA start, so convergence of the two lines reads as the front
// collapsing toward contact.
//
// Returns { usa, csa, span, ok }. `ok` is false when the axis can't be anchored
// (a team never appears).
export function frontlineOverTime(replay, centroids, pct = 0.75) {
  const c = centroids || centroidsOverTime(replay);
  const init = initialCentroids(c);
  const F = replay.frameCount;
  const empty = { usa: new Array(F).fill(null), csa: new Array(F).fill(null), span: 0, ok: false };
  if (!init) return empty;
  const ax = init.csa.x - init.usa.x;
  const ay = init.csa.y - init.usa.y;
  const span = Math.hypot(ax, ay);
  if (span < 1e-3) return empty;
  const ux = ax / span;
  const uy = ay / span;
  const { playerCount: P } = replay;
  const { x, y } = replay.tracks;
  const teams = replay.players.map((p) => p.team);
  const usa = new Array(F).fill(null);
  const csa = new Array(F).fill(null);
  const project = (px, py) => (px - init.usa.x) * ux + (py - init.usa.y) * uy;
  for (let f = 0; f < F; f++) {
    const base = f * P;
    const uProj = [];
    const cProj = [];
    for (let p = 0; p < P; p++) {
      const px = x[base + p];
      if (Number.isNaN(px)) continue;
      const s = project(px, y[base + p]);
      if (teams[p] === 1) uProj.push(s);
      else if (teams[p] === 2) cProj.push(s);
    }
    // USA leading edge = high percentile (toward CSA); CSA leading edge = low
    // percentile (toward USA).
    if (uProj.length) usa[f] = percentile(uProj, pct);
    if (cProj.length) csa[f] = percentile(cProj, 1 - pct);
  }
  return { usa, csa, span, ok: true };
}

function percentile(arr, p) {
  const s = [...arr].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))));
  return s[idx];
}
