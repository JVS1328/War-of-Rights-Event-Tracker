import { defineHex, Grid, rectangle, Orientation } from 'honeycomb-grid';

export const HEX_SIZE = 28;

export const FlatHex = defineHex({
  orientation: Orientation.FLAT,
  dimensions: HEX_SIZE,
  origin: 'topLeft'
});

export const hexKey = (q, r) => `${q},${r}`;

export const parseKey = (key) => {
  const [q, r] = key.split(',').map(Number);
  return { q, r };
};

export const buildRectGrid = (width, height) => {
  return new Grid(FlatHex, rectangle({ width, height }));
};

export const hexToPixel = (q, r, size = HEX_SIZE) => {
  const x = size * (3 / 2) * q;
  const y = size * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r);
  return { x, y };
};

export const pixelToHex = (px, py, size = HEX_SIZE) => {
  const q = (2 / 3) * px / size;
  const r = (-1 / 3 * px + Math.sqrt(3) / 3 * py) / size;
  return cubeRound(q, r);
};

const cubeRound = (qf, rf) => {
  const sf = -qf - rf;
  let q = Math.round(qf);
  let r = Math.round(rf);
  let s = Math.round(sf);
  const qd = Math.abs(q - qf);
  const rd = Math.abs(r - rf);
  const sd = Math.abs(s - sf);
  if (qd > rd && qd > sd) q = -r - s;
  else if (rd > sd) r = -q - s;
  return { q, r };
};

export const FLAT_NEIGHBORS = [
  [+1,  0], [+1, -1], [0, -1],
  [-1,  0], [-1, +1], [0, +1]
];

export const neighbors = (q, r) =>
  FLAT_NEIGHBORS.map(([dq, dr]) => ({ q: q + dq, r: r + dr }));

export const neighborKeys = (q, r) =>
  neighbors(q, r).map(({ q, r }) => hexKey(q, r));

export const distance = (a, b) => {
  const aq = a.q, ar = a.r, as = -aq - ar;
  const bq = b.q, br = b.r, bs = -bq - br;
  return (Math.abs(aq - bq) + Math.abs(ar - br) + Math.abs(as - bs)) / 2;
};

export const hexCorners = (cx, cy, size = HEX_SIZE) => {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i);
    pts.push({ x: cx + size * Math.cos(angle), y: cy + size * Math.sin(angle) });
  }
  return pts;
};

export const hexPolygonPoints = (cx, cy, size = HEX_SIZE) =>
  hexCorners(cx, cy, size).map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');

export const bfs = (startKey, isPassable, maxDepth) => {
  const visited = new Map();
  visited.set(startKey, 0);
  const queue = [{ key: startKey, depth: 0 }];
  while (queue.length > 0) {
    const { key, depth } = queue.shift();
    if (depth >= maxDepth) continue;
    const { q, r } = parseKey(key);
    for (const { q: nq, r: nr } of neighbors(q, r)) {
      const nk = hexKey(nq, nr);
      if (visited.has(nk)) continue;
      if (!isPassable(nk, { q: nq, r: nr })) continue;
      visited.set(nk, depth + 1);
      queue.push({ key: nk, depth: depth + 1 });
    }
  }
  return visited;
};

export const gridBounds = (hexes) => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const h of hexes) {
    const { x, y } = hexToPixel(h.q, h.r);
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  const pad = HEX_SIZE * 2;
  return {
    minX: minX - pad, minY: minY - pad,
    width: (maxX - minX) + pad * 2,
    height: (maxY - minY) + pad * 2
  };
};
