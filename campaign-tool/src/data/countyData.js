// County data parser using GeoJSON
// Fetches US county boundaries from a GeoJSON source and converts to SVG paths

// Cache for parsed data
let geoJsonCache = null;
let parseCache = null;

// State FIPS code to abbreviation mapping
const stateFipsToAbbr = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO', '09': 'CT',
  '10': 'DE', '11': 'DC', '12': 'FL', '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL',
  '18': 'IN', '19': 'IA', '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME', '24': 'MD',
  '25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS', '29': 'MO', '30': 'MT', '31': 'NE',
  '32': 'NV', '33': 'NH', '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND',
  '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI', '45': 'SC', '46': 'SD',
  '47': 'TN', '48': 'TX', '49': 'UT', '50': 'VT', '51': 'VA', '53': 'WA', '54': 'WV',
  '55': 'WI', '56': 'WY'
};

/**
 * Fetch GeoJSON data for US counties
 * Using a public CDN source for county boundaries
 * @returns {Promise<Object>} GeoJSON FeatureCollection
 */
const fetchGeoJSON = async () => {
  if (geoJsonCache) return geoJsonCache;

  try {
    // Using Plotly's GeoJSON counties dataset (direct GeoJSON, no conversion needed)
    console.log('Fetching county GeoJSON data...');
    const response = await fetch('https://raw.githubusercontent.com/plotly/datasets/master/geojson-counties-fips.json');
    const geoJson = await response.json();

    console.log('GeoJSON fetched, features count:', geoJson.features?.length || 0);

    geoJsonCache = geoJson;
    return geoJson;
  } catch (error) {
    console.error('Error fetching county GeoJSON:', error);
    throw error;
  }
};

/**
 * Convert GeoJSON coordinates to SVG path string
 * Uses a simple Mercator-like projection scaled to fit viewBox
 * @param {Array} coordinates - GeoJSON coordinates array
 * @param {Object} bounds - Bounding box {minLon, maxLon, minLat, maxLat}
 * @param {number} width - SVG viewBox width
 * @param {number} height - SVG viewBox height
 * @returns {string} SVG path string
 */
const coordinatesToPath = (coordinates, bounds, width = 1000, height = 600) => {
  const { minLon, maxLon, minLat, maxLat } = bounds;

  // Project lon/lat to x/y with padding
  const padding = 20;
  const scaleX = (width - padding * 2) / (maxLon - minLon);
  const scaleY = (height - padding * 2) / (maxLat - minLat);

  const project = ([lon, lat]) => {
    const x = padding + (lon - minLon) * scaleX;
    // Invert Y because SVG coordinates start from top
    const y = height - (padding + (lat - minLat) * scaleY);
    return [x, y];
  };

  const pathParts = [];

  // Handle MultiPolygon or Polygon
  const polygons = coordinates[0][0] instanceof Array && coordinates[0][0][0] instanceof Array
    ? coordinates  // MultiPolygon
    : [coordinates];  // Polygon

  polygons.forEach(polygon => {
    polygon.forEach((ring, ringIndex) => {
      ring.forEach((coord, i) => {
        const [x, y] = project(coord);
        if (i === 0) {
          pathParts.push(`M ${x.toFixed(2)} ${y.toFixed(2)}`);
        } else {
          pathParts.push(`L ${x.toFixed(2)} ${y.toFixed(2)}`);
        }
      });
      pathParts.push('Z');
    });
  });

  return pathParts.join(' ');
};

/**
 * Calculate bounding box for an array of coordinates
 * @param {Array} allCoordinates - Array of all county coordinates
 * @returns {Object} Bounding box {minLon, maxLon, minLat, maxLat}
 */
const calculateBounds = (allCoordinates) => {
  let minLon = Infinity, maxLon = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;

  allCoordinates.forEach(coords => {
    const polygons = coords[0][0] instanceof Array && coords[0][0][0] instanceof Array
      ? coords  // MultiPolygon
      : [coords];  // Polygon

    polygons.forEach(polygon => {
      polygon.forEach(ring => {
        ring.forEach(([lon, lat]) => {
          minLon = Math.min(minLon, lon);
          maxLon = Math.max(maxLon, lon);
          minLat = Math.min(minLat, lat);
          maxLat = Math.max(maxLat, lat);
        });
      });
    });
  });

  return { minLon, maxLon, minLat, maxLat };
};

/**
 * Parse county data from GeoJSON
 * @returns {Promise<Object>} Map of state abbreviations to their counties
 */
export const parseCountyData = async () => {
  if (parseCache) return parseCache;

  const geoJson = await fetchGeoJSON();
  const countiesByState = {};

  console.log('Parsing GeoJSON county data...');

  // Handle both plain GeoJSON and TopoJSON formats
  const features = geoJson.features || [];

  features.forEach(feature => {
    const props = feature.properties || {};

    // Try to extract state and county info from various property formats
    let stateFips = props.STATE || props.STATEFP || props.state;
    const countyName = props.NAME || props.name || props.NAMELSAD || 'Unknown County';
    const countyFips = props.id || props.GEOID || props.fips;

    // Convert FIPS to state abbreviation
    if (stateFips && stateFips.length === 2) {
      stateFips = stateFips.padStart(2, '0');
    } else if (countyFips && countyFips.length === 5) {
      stateFips = countyFips.substring(0, 2);
    }

    const stateAbbr = stateFipsToAbbr[stateFips];

    if (stateAbbr && feature.geometry) {
      if (!countiesByState[stateAbbr]) {
        countiesByState[stateAbbr] = {
          counties: [],
          coordinates: []
        };
      }

      countiesByState[stateAbbr].counties.push({
        id: `${stateAbbr}_${countyName.replace(/\s+/g, '_')}`,
        name: countyName,
        stateAbbr,
        fips: countyFips,
        coordinates: feature.geometry.coordinates
      });

      countiesByState[stateAbbr].coordinates.push(feature.geometry.coordinates);
    }
  });

  console.log('Parsed counties for states:', Object.keys(countiesByState).length);

  parseCache = countiesByState;
  return countiesByState;
};

/**
 * Get counties for specific states and convert to SVG paths
 * @param {Array<string>} stateAbbrs - Array of state abbreviations (e.g., ['CA', 'NV'])
 * @returns {Promise<Object>} Combined county data with SVG paths
 */
export const getCountiesForStates = async (stateAbbrs) => {
  const allCountyData = await parseCountyData();
  const selectedCounties = [];
  const allCoordinates = [];

  // Collect all counties and coordinates from selected states
  stateAbbrs.forEach(abbr => {
    const stateData = allCountyData[abbr.toUpperCase()];
    if (stateData) {
      selectedCounties.push(...stateData.counties);
      allCoordinates.push(...stateData.coordinates);
    }
  });

  if (selectedCounties.length === 0) {
    console.warn('No counties found for states:', stateAbbrs);
    return {
      counties: [],
      viewBox: '0 0 1000 600',
      bounds: null
    };
  }

  // Calculate bounding box for all selected counties
  const bounds = calculateBounds(allCoordinates);

  console.log('Converting', selectedCounties.length, 'counties to SVG paths');
  console.log('Bounds:', bounds);

  // Convert each county's coordinates to SVG path
  const countiesWithPaths = selectedCounties.map(county => ({
    ...county,
    svgPath: coordinatesToPath(county.coordinates, bounds, 1000, 600)
  }));

  return {
    counties: countiesWithPaths,
    viewBox: '0 0 1000 600',
    bounds
  };
};

/**
 * Calculate the center point of a group of counties
 * @param {Array<Object>} counties - Array of county objects with svgPath
 * @returns {Object} Center coordinates {x, y}
 */
export const calculateCountyGroupCenter = (counties) => {
  // Simple approximation: average of all path coordinates
  let totalX = 0;
  let totalY = 0;
  let pointCount = 0;

  counties.forEach(county => {
    const path = county.svgPath;
    // Extract numbers from the path string
    const numbers = path.match(/[\d.]+/g);

    if (numbers) {
      for (let i = 0; i < numbers.length - 1; i += 2) {
        totalX += parseFloat(numbers[i]);
        totalY += parseFloat(numbers[i + 1]);
        pointCount++;
      }
    }
  });

  if (pointCount === 0) return { x: 0, y: 0 };

  return {
    x: Math.round(totalX / pointCount),
    y: Math.round(totalY / pointCount)
  };
};

/**
 * Combine county paths into a single path string
 * @param {Array<Object>} counties - Array of county objects with svgPath
 * @returns {string} Combined SVG path
 */
export const combineCountyPaths = (counties) => {
  return counties.map(c => c.svgPath).join(' ');
};

/**
 * Get all available states that have county data
 * @returns {Promise<Array<string>>} Array of state abbreviations
 */
export const getAvailableStates = async () => {
  const countyData = await parseCountyData();
  return Object.keys(countyData).sort();
};

/**
 * Get county count for a state
 * @param {string} stateAbbr - State abbreviation
 * @returns {Promise<number>} Number of counties
 */
export const getCountyCount = async (stateAbbr) => {
  const countyData = await parseCountyData();
  const stateData = countyData[stateAbbr.toUpperCase()];
  return stateData ? stateData.counties.length : 0;
};
