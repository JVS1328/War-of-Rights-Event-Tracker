// Map calibration + coordinate transforms for the replay viewer.
//
// Replay CSV positions are in world meters (engine units). The map PNGs use
// a 1-pixel-per-yard image space. Calibration points are stored as yards
// (lifted verbatim from wor-rangefinder), so we convert meters → yards at
// the boundary, then apply a 3-point affine to land on map pixels.

export const YARDS_PER_METER = 1.0936;

// Map id used internally. Keys match the rangefinder slugs.
export const MAPS = {
  'antietam':       { name: 'Antietam',       file: 'antietam.png'        },
  'harpers-ferry':  { name: "Harper's Ferry", file: 'finishedferry.png'   },
  'south-mountain': { name: 'South Mountain', file: 'completemountain.png'},
  'drill-camp':     { name: 'Drill Camp',     file: 'drillcamp.png'       },
};

// Map names as written into the replay CSV header (taken from the engine's
// level name) → internal slug. Loose match, lowercased, alphanumeric only.
const NAME_TO_SLUG = [
  ['antietam',      'antietam'],
  ['harpersferry',  'harpers-ferry'],
  ['harper',        'harpers-ferry'],
  ['southmountain', 'south-mountain'],
  ['drillcamp',     'drill-camp'],
];

export function resolveMapSlug(name) {
  if (!name) return null;
  const norm = String(name).toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const [needle, slug] of NAME_TO_SLUG) {
    if (norm.includes(needle)) return slug;
  }
  return null;
}

// 3-point affine calibration. Game coords in yards → map pixels.
const CALIBRATION_POINTS = {
  'antietam': [
    { game: { x: 1778.18, y: 2888.22 }, map: { x: 1930, y: 2243 } },
    { game: { x: 1350.90, y:  728.11 }, map: { x: 3300, y: 3950 } },
    { game: { x:  873.73, y: 2566.63 }, map: { x: 1593, y: 3140 } },
  ],
  'harpers-ferry': [
    { game: { x:  566.70, y: 2224.61 }, map: { x:  865, y: 1989 } },
    { game: { x: 2840.36, y: 2048.26 }, map: { x: 3135, y: 2165 } },
    { game: { x: 2262.00, y: 2231.55 }, map: { x: 2557, y: 1982 } },
  ],
  'south-mountain': [
    { game: { x: 2250.41, y: 2554.42 }, map: { x: 1923, y: 3347 } },
    { game: { x: 3145.32, y: 3985.36 }, map: { x: 2811, y: 1920 } },
    { game: { x: 1717.66, y: 1313.35 }, map: { x: 1391, y: 4581 } },
  ],
  'drill-camp': [
    { game: { x: 1074.61,    y: 1378.89    }, map: { x: 1677, y: 4331 } },
    { game: { x: 1400.709225, y: 3651.483959 }, map: { x: 1996, y: 2075 } },
    { game: { x: 2129.11169, y: 1877.8883  }, map: { x: 2723, y: 3837 } },
  ],
};

// Precompute affine coefficients (a..f for X, d..f for Y) per map. Same
// math as gameToMapCoordinates in the rangefinder — kept inlined so we
// don't bring in a matrix lib for a 3-point solve.
const TRANSFORMS = {};
for (const [slug, pts] of Object.entries(CALIBRATION_POINTS)) {
  const [p0, p1, p2] = pts;
  const x0 = p0.game.x, y0 = p0.game.y, mx0 = p0.map.x, my0 = p0.map.y;
  const x1 = p1.game.x, y1 = p1.game.y, mx1 = p1.map.x, my1 = p1.map.y;
  const x2 = p2.game.x, y2 = p2.game.y, mx2 = p2.map.x, my2 = p2.map.y;
  const denom = x0 * (y1 - y2) + x1 * (y2 - y0) + x2 * (y0 - y1);
  TRANSFORMS[slug] = {
    a:  (mx0 * (y1 - y2) + mx1 * (y2 - y0) + mx2 * (y0 - y1)) / denom,
    b:  (x0 * (mx1 - mx2) + x1 * (mx2 - mx0) + x2 * (mx0 - mx1)) / denom,
    c:  (x0 * (y1 * mx2 - y2 * mx1) + x1 * (y2 * mx0 - y0 * mx2) + x2 * (y0 * mx1 - y1 * mx0)) / denom,
    d:  (my0 * (y1 - y2) + my1 * (y2 - y0) + my2 * (y0 - y1)) / denom,
    e:  (x0 * (my1 - my2) + x1 * (my2 - my0) + x2 * (my0 - my1)) / denom,
    f:  (x0 * (y1 * my2 - y2 * my1) + x1 * (y2 * my0 - y0 * my2) + x2 * (y0 * my1 - y1 * my0)) / denom,
  };
}

// World meters → map pixels. Returns null when the slug isn't recognized.
export function worldMetersToMapPx(slug, xMeters, yMeters) {
  const t = TRANSFORMS[slug];
  if (!t) return null;
  const x = xMeters * YARDS_PER_METER;
  const y = yMeters * YARDS_PER_METER;
  return { x: t.a * x + t.b * y + t.c, y: t.d * x + t.e * y + t.f };
}

// Approximate map-pixels per yard for a slug — the uniform scale of the affine
// linear part (sqrt of its determinant). Used to draw a proximity circle whose
// radius is expressed in yards. Returns null when the slug isn't recognized.
// (The affine can shear slightly, so a true yard-circle is an ellipse in map
// space; for the small radii used here this scalar is a fine approximation.)
export function mapPxPerYard(slug) {
  const t = TRANSFORMS[slug];
  if (!t) return null;
  const det = t.a * t.e - t.b * t.d;
  return Math.sqrt(Math.abs(det));
}

// Project a heading vector (meter-space unit vector) to map-pixel space.
// Affine preserves vectors with the translation cancelled out, so we just
// apply the linear part. Output is NOT renormalized — caller decides.
export function headingToMapDelta(slug, fwdX, fwdY) {
  const t = TRANSFORMS[slug];
  if (!t) return null;
  const x = fwdX * YARDS_PER_METER;
  const y = fwdY * YARDS_PER_METER;
  return { dx: t.a * x + t.b * y, dy: t.d * x + t.e * y };
}
