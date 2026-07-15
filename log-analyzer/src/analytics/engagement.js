// Engagement / clash lines.
//
// From positions alone we can see WHERE and WHEN the two sides made contact:
// how many opposing players were within musket range each frame, and the
// closest approach between the lines. A rising contact count marks the clash;
// the minimum-distance trough marks the moment lines met.

// Per frame: number of opposing (USA,CSA) pairs within `thresholdM` meters, and
// the minimum inter-team distance. Returns { contacts, minDist } where contacts
// is number[] and minDist is (number|null)[].
export function engagementOverTime(replay, thresholdM = 30) {
  const { frameCount: F, playerCount: P } = replay;
  const { x, y } = replay.tracks;
  const usaIdx = [];
  const csaIdx = [];
  replay.players.forEach((p, i) => {
    if (p.team === 1) usaIdx.push(i);
    else if (p.team === 2) csaIdx.push(i);
  });
  const th2 = thresholdM * thresholdM;
  const contacts = new Array(F).fill(0);
  const minDist = new Array(F).fill(null);
  for (let f = 0; f < F; f++) {
    const base = f * P;
    let c = 0;
    let md = Infinity;
    for (const u of usaIdx) {
      const ux = x[base + u];
      if (Number.isNaN(ux)) continue;
      const uy = y[base + u];
      for (const cc of csaIdx) {
        const cx = x[base + cc];
        if (Number.isNaN(cx)) continue;
        const d2 = (ux - cx) * (ux - cx) + (uy - y[base + cc]) * (uy - y[base + cc]);
        if (d2 < md) md = d2;
        if (d2 <= th2) c++;
      }
    }
    contacts[f] = c;
    minDist[f] = md === Infinity ? null : Math.sqrt(md);
  }
  return { contacts, minDist };
}

// The frame of peak contact (most opposing pairs in range). Returns
// { frame, contacts } or null when there was no contact at all.
export function peakContactFrame(engagement) {
  let best = -1;
  let bestVal = 0;
  engagement.contacts.forEach((c, f) => {
    if (c > bestVal) { bestVal = c; best = f; }
  });
  return best < 0 ? null : { frame: best, contacts: bestVal };
}

// Midpoints (world meters) of close opposing pairs at a given frame — the
// clash points to plot on the map. Returns [{ x, y }].
export function contactPointsAt(replay, frame, thresholdM = 30) {
  const { playerCount: P } = replay;
  const { x, y } = replay.tracks;
  const base = frame * P;
  const usaIdx = [];
  const csaIdx = [];
  replay.players.forEach((p, i) => {
    if (p.team === 1) usaIdx.push(i);
    else if (p.team === 2) csaIdx.push(i);
  });
  const th2 = thresholdM * thresholdM;
  const pts = [];
  for (const u of usaIdx) {
    const ux = x[base + u];
    if (Number.isNaN(ux)) continue;
    const uy = y[base + u];
    for (const cc of csaIdx) {
      const cx = x[base + cc];
      if (Number.isNaN(cx)) continue;
      const cy = y[base + cc];
      const d2 = (ux - cx) * (ux - cx) + (uy - cy) * (uy - cy);
      if (d2 <= th2) pts.push({ x: (ux + cx) / 2, y: (uy + cy) / 2 });
    }
  }
  return pts;
}
