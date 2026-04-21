/**
 * Shared lat/lon → SVG projection for the county-based campaign maps.
 *
 * MapView and the Eastern Theatre preset loader both need:
 *   - the US counties GeoJSON (fetched once, cached module-level)
 *   - the lat/lon bounding box of whichever subset of counties the
 *     campaign renders (so the projection fills the viewBox properly)
 *   - a simple linear lon→x / lat→y transform from those bounds into the
 *     fixed 1000×589 viewBox with a 20 px padding.
 *
 * Keeping this here (instead of duplicating it in MapView) means preset
 * features drop onto the exact same coordinates as the rendered counties.
 */

const COUNTY_GEOJSON_URL =
  'https://raw.githubusercontent.com/plotly/datasets/master/geojson-counties-fips.json';

let _geoJsonCache = null;

/** Fetch + memo the US counties GeoJSON. Safe to call repeatedly. */
export const fetchCountyGeoJson = async () => {
  if (_geoJsonCache) return _geoJsonCache;
  const response = await fetch(COUNTY_GEOJSON_URL);
  _geoJsonCache = await response.json();
  return _geoJsonCache;
};

/**
 * Walk the GeoJSON features matching any of `allFips` and compute the
 * enclosing lat/lon bounding box. Used to derive the projection scale
 * for a particular subset of counties.
 */
export const calculateBoundsForFips = (geoJson, allFips) => {
  let minLon = Infinity, maxLon = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;
  const fipsSet = new Set(allFips);

  geoJson.features.forEach(feature => {
    const fips = feature.id || feature.properties?.GEOID;
    if (!fipsSet.has(fips)) return;
    const coords = feature.geometry?.coordinates;
    if (!coords) return;
    // GeoJSON polygons are [ring][point][x,y]; multipolygons add an outer
    // array. Detect by looking at the innermost type.
    const polygons = coords[0]?.[0]?.[0] instanceof Array ? coords : [coords];
    polygons.forEach(polygon => polygon.forEach(ring => ring.forEach(([lon, lat]) => {
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    })));
  });

  return { minLon, maxLon, minLat, maxLat };
};

/**
 * Project a single (lat, lon) into the 1000×589 SVG viewBox using the
 * linear transform MapView applies to county polygons. Must match
 * MapView's projection exactly or preset features drift.
 */
export const projectLatLonToSvg = (lat, lon, bounds, {
  width = 1000, height = 589, padding = 20,
} = {}) => {
  const { minLon, maxLon, minLat, maxLat } = bounds;
  const scaleX = (width - padding * 2) / (maxLon - minLon);
  const scaleY = (height - padding * 2) / (maxLat - minLat);
  const x = padding + (lon - minLon) * scaleX;
  const y = height - (padding + (lat - minLat) * scaleY);
  return { x, y };
};

/** Collect every countyFips string across a territories array. */
export const collectTerritoryFips = (territories) => {
  const out = [];
  for (const t of territories || []) {
    if (Array.isArray(t.countyFips)) out.push(...t.countyFips);
  }
  return out;
};
