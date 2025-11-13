// County data parser for US counties SVG
// Parses the us_counties.svg file to extract county paths by state

// Cache for parsed SVG data
let svgCache = null;
let parseCache = null;

/**
 * Fetch and parse the SVG file
 * @returns {Promise<Document>} Parsed SVG document
 */
const fetchSVG = async () => {
  if (svgCache) return svgCache;

  const response = await fetch('/us_counties.svg');
  const svgText = await response.text();
  const parser = new DOMParser();
  svgCache = parser.parseFromString(svgText, 'image/svg+xml');
  return svgCache;
};

/**
 * Parse county data from the SVG file
 * @returns {Promise<Object>} Map of state abbreviations to their counties
 */
export const parseCountyData = async () => {
  if (parseCache) return parseCache;

  const svgDoc = await fetchSVG();

  const countyPaths = svgDoc.querySelectorAll('path.county');
  const stateBorders = svgDoc.querySelectorAll('path.state');

  const countiesByState = {};

  // Parse county paths
  countyPaths.forEach(path => {
    const id = path.getAttribute('id');
    const d = path.getAttribute('d');

    if (id && d) {
      // ID format: StateAbbr_County_Name (e.g., "CA_Los_Angeles")
      const parts = id.split('_');
      if (parts.length >= 2) {
        const stateAbbr = parts[0];
        const countyName = parts.slice(1).join(' ');

        if (!countiesByState[stateAbbr]) {
          countiesByState[stateAbbr] = {
            counties: [],
            stateBorder: null
          };
        }

        countiesByState[stateAbbr].counties.push({
          id,
          name: countyName,
          svgPath: d,
          stateAbbr
        });
      }
    }
  });

  // Parse state border paths
  stateBorders.forEach(path => {
    const id = path.getAttribute('id');
    const d = path.getAttribute('d');

    if (id && d) {
      // ID format might be just the state abbreviation or "state_XX"
      const stateAbbr = id.replace('state_', '').toUpperCase();

      if (countiesByState[stateAbbr]) {
        countiesByState[stateAbbr].stateBorder = d;
      }
    }
  });

  parseCache = countiesByState;
  return countiesByState;
};

/**
 * Get counties for specific states
 * @param {Array<string>} stateAbbrs - Array of state abbreviations (e.g., ['CA', 'NV'])
 * @returns {Promise<Object>} Combined county and border data for selected states
 */
export const getCountiesForStates = async (stateAbbrs) => {
  const allCountyData = await parseCountyData();
  const result = {
    counties: [],
    stateBorders: []
  };

  stateAbbrs.forEach(abbr => {
    const stateData = allCountyData[abbr.toUpperCase()];
    if (stateData) {
      result.counties.push(...stateData.counties);
      if (stateData.stateBorder) {
        result.stateBorders.push({
          stateAbbr: abbr,
          svgPath: stateData.stateBorder
        });
      }
    }
  });

  return result;
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
