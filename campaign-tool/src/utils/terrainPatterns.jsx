// ============================================================================
// TERRAIN VISUALIZATION — SVG pattern generation from config
// Each terrain group has a patternType, colors, and optional density scaling.
// Density-scaled terrains produce -dense and -sparse pattern variants;
// getTerrainOverlay picks the right one based on the territory's weight ratio.
// ============================================================================

/** Available pattern presets */
export const PATTERN_TYPES = {
  circles:    'Trees',
  rectangles: 'Buildings',
  lines:      'Crop Rows',
  dots:       'Dots',
};

/** Default visualization config for the three built-in terrain groups */
export const DEFAULT_TERRAIN_VIZ = {
  Woods:    { patternType: 'circles',    color: '#15803d', colorAlt: '#166534', densityScaling: true },
  Urban:    { patternType: 'rectangles', color: '#6b7280', colorAlt: '#4b5563', densityScaling: true },
  Farmland: { patternType: 'lines',      color: '#a16207', colorAlt: '#a16207', densityScaling: false },
};

/** Sensible default viz for newly-created custom terrain groups */
export const defaultVizEntry = () => ({
  patternType: 'dots', color: '#6b7280', colorAlt: '#4b5563', densityScaling: false,
});

// ---------------------------------------------------------------------------
// Pattern element factories — keyed by patternType, each with dense/sparse/single
// All accept (id, color, colorAlt) and return a JSX <pattern>.
// ---------------------------------------------------------------------------

const circlesDense = (id, c, cA) => (
  <pattern key={id} id={id} width="10" height="10" patternUnits="userSpaceOnUse">
    <circle cx="3" cy="3" r="2.5" fill={c} />
    <circle cx="8" cy="8" r="2" fill={cA} />
    <circle cx="7" cy="2" r="1.5" fill={c} />
    <circle cx="2" cy="7.5" r="1.8" fill={cA} />
  </pattern>
);
const circlesSparse = (id, c, cA) => (
  <pattern key={id} id={id} width="18" height="18" patternUnits="userSpaceOnUse">
    <circle cx="5" cy="5" r="2.5" fill={c} />
    <circle cx="14" cy="13" r="2" fill={cA} />
    <circle cx="12" cy="3" r="1.5" fill={c} />
  </pattern>
);
const circlesSingle = (id, c, cA) => (
  <pattern key={id} id={id} width="14" height="14" patternUnits="userSpaceOnUse">
    <circle cx="4" cy="4" r="2.5" fill={c} />
    <circle cx="11" cy="10" r="2" fill={cA} />
    <circle cx="8" cy="2" r="1.5" fill={c} />
  </pattern>
);

const rectsDense = (id, c, cA) => (
  <pattern key={id} id={id} width="16" height="16" patternUnits="userSpaceOnUse">
    <rect x="1" y="1" width="5" height="3.5" fill={c} rx="0.3" />
    <rect x="7.5" y="0.5" width="3.5" height="4" fill={cA} rx="0.3" />
    <rect x="12" y="1.5" width="3" height="2.5" fill={c} rx="0.3" />
    <rect x="0.5" y="6" width="4" height="3" fill={cA} rx="0.3" />
    <rect x="6" y="6.5" width="5.5" height="2.5" fill={c} rx="0.3" />
    <rect x="13" y="5.5" width="2.5" height="3.5" fill={cA} rx="0.3" />
    <rect x="1" y="10.5" width="3.5" height="4" fill={c} rx="0.3" />
    <rect x="5.5" y="11" width="4" height="3.5" fill={cA} rx="0.3" />
    <rect x="10.5" y="10" width="3" height="4.5" fill={c} rx="0.3" />
    <rect x="14" y="11" width="1.5" height="2" fill={cA} rx="0.2" />
  </pattern>
);
const rectsSparse = (id, c, cA) => (
  <pattern key={id} id={id} width="22" height="22" patternUnits="userSpaceOnUse">
    <rect x="2" y="2" width="4.5" height="3" fill={c} rx="0.3" />
    <rect x="13" y="3.5" width="3" height="2.5" fill={cA} rx="0.3" />
    <rect x="5" y="12" width="3.5" height="3" fill={c} rx="0.3" />
    <rect x="15" y="15" width="2.5" height="2" fill={cA} rx="0.3" />
  </pattern>
);
const rectsSingle = (id, c, cA) => (
  <pattern key={id} id={id} width="16" height="16" patternUnits="userSpaceOnUse">
    <rect x="1" y="1" width="5" height="3.5" fill={c} rx="0.3" />
    <rect x="7.5" y="0.5" width="3.5" height="4" fill={cA} rx="0.3" />
    <rect x="0.5" y="6" width="4" height="3" fill={cA} rx="0.3" />
    <rect x="6" y="6.5" width="5.5" height="2.5" fill={c} rx="0.3" />
    <rect x="13" y="5.5" width="2.5" height="3.5" fill={cA} rx="0.3" />
  </pattern>
);

const linesDense = (id, c) => (
  <pattern key={id} id={id} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
    <line x1="0" y1="0" x2="0" y2="5" stroke={c} strokeWidth="1.5" />
  </pattern>
);
const linesSparse = (id, c) => (
  <pattern key={id} id={id} width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
    <line x1="0" y1="0" x2="0" y2="12" stroke={c} strokeWidth="1" />
  </pattern>
);
const linesSingle = (id, c) => (
  <pattern key={id} id={id} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
    <line x1="0" y1="0" x2="0" y2="8" stroke={c} strokeWidth="1.5" />
  </pattern>
);

const dotsDense = (id, c) => (
  <pattern key={id} id={id} width="7" height="7" patternUnits="userSpaceOnUse">
    <circle cx="3.5" cy="3.5" r="1.5" fill={c} />
  </pattern>
);
const dotsSparse = (id, c) => (
  <pattern key={id} id={id} width="14" height="14" patternUnits="userSpaceOnUse">
    <circle cx="7" cy="7" r="1.5" fill={c} />
  </pattern>
);
const dotsSingle = (id, c) => (
  <pattern key={id} id={id} width="10" height="10" patternUnits="userSpaceOnUse">
    <circle cx="5" cy="5" r="1.5" fill={c} />
  </pattern>
);

const GENERATORS = {
  circles:    { dense: circlesDense,  sparse: circlesSparse,  single: circlesSingle },
  rectangles: { dense: rectsDense,    sparse: rectsSparse,    single: rectsSingle },
  lines:      { dense: linesDense,    sparse: linesSparse,    single: linesSingle },
  dots:       { dense: dotsDense,     sparse: dotsSparse,     single: dotsSingle },
};

/**
 * Generate all SVG <pattern> elements for one terrain group.
 * Returns an array of JSX elements to place inside <defs>.
 */
export const generateTerrainPatterns = (name, config) => {
  const { patternType, color, colorAlt, densityScaling } = config;
  const gen = GENERATORS[patternType] || GENERATORS.dots;

  if (densityScaling) {
    return [
      gen.dense(`terrain-${name}-dense`, color, colorAlt),
      gen.sparse(`terrain-${name}-sparse`, color, colorAlt),
    ];
  }
  return [gen.single(`terrain-${name}`, color, colorAlt)];
};

/**
 * Resolve the correct pattern ID for a dominant terrain type.
 * Density-scaled terrains pick dense (>=50%) vs sparse (<50%).
 */
export const resolvePatternId = (dominant, dominance, terrainViz) => {
  const viz = terrainViz?.[dominant];
  if (viz?.densityScaling) {
    return dominance >= 0.5 ? `terrain-${dominant}-dense` : `terrain-${dominant}-sparse`;
  }
  return `terrain-${dominant}`;
};
