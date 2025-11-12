// Script to extract state paths from us.svg
// Run this with: node extractStatePaths.js

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read the SVG file
const svgContent = readFileSync(join(__dirname, 'us.svg'), 'utf-8');

// Extract all path elements with state data
const pathRegex = /<path[^>]*id="([A-Z]{2})"[^>]*d="([^"]+)"[^>]*\/>/g;
const states = [];
let match;

while ((match = pathRegex.exec(svgContent)) !== null) {
  const id = match[1];
  const pathData = match[2];
  
  // Skip non-state paths (AK, HI, DC)
  if (id === 'AK' || id === 'HI' || id === 'DC') continue;
  
  // Calculate approximate center from path data
  // This is a simple approximation - you may want to refine these manually
  const coords = pathData.match(/[\d.]+/g).map(Number);
  const xCoords = coords.filter((_, i) => i % 2 === 0);
  const yCoords = coords.filter((_, i) => i % 2 === 1);
  
  const centerX = Math.round((Math.min(...xCoords) + Math.max(...xCoords)) / 2);
  const centerY = Math.round((Math.min(...yCoords) + Math.max(...yCoords)) / 2);
  
  states.push({
    id,
    pathData,
    center: { x: centerX, y: centerY }
  });
}

// State names mapping
const stateNames = {
  'AL': 'Alabama', 'AR': 'Arkansas', 'AZ': 'Arizona', 'CA': 'California',
  'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida',
  'GA': 'Georgia', 'IA': 'Iowa', 'ID': 'Idaho', 'IL': 'Illinois',
  'IN': 'Indiana', 'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana',
  'MA': 'Massachusetts', 'MD': 'Maryland', 'ME': 'Maine', 'MI': 'Michigan',
  'MN': 'Minnesota', 'MO': 'Missouri', 'MS': 'Mississippi', 'MT': 'Montana',
  'NC': 'North Carolina', 'ND': 'North Dakota', 'NE': 'Nebraska', 'NH': 'New Hampshire',
  'NJ': 'New Jersey', 'NM': 'New Mexico', 'NV': 'Nevada', 'NY': 'New York',
  'OH': 'Ohio', 'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania',
  'RI': 'Rhode Island', 'SC': 'South Carolina', 'SD': 'South Dakota', 'TN': 'Tennessee',
  'TX': 'Texas', 'UT': 'Utah', 'VA': 'Virginia', 'VT': 'Vermont',
  'WA': 'Washington', 'WI': 'Wisconsin', 'WV': 'West Virginia', 'WY': 'Wyoming'
};

// Generate the JavaScript file content
let output = `// Accurate SVG path data for US states (excluding Alaska and Hawaii)
// Extracted from us.svg - viewBox="0 0 1000 589"
// These are the actual state boundaries as of the Civil War era

export const usaStates = [\n`;

states.sort((a, b) => a.id.localeCompare(b.id)).forEach(state => {
  output += `  {\n`;
  output += `    id: '${state.id}',\n`;
  output += `    name: '${stateNames[state.id]}',\n`;
  output += `    abbreviation: '${state.id}',\n`;
  output += `    center: { x: ${state.center.x}, y: ${state.center.y} },\n`;
  output += `    svgPath: '${state.pathData}'\n`;
  output += `  },\n`;
});

output += `];\n\n`;

// Add helper functions
output += `// Helper function to get state by abbreviation
export const getStateByAbbr = (abbr) => {
  return usaStates.find(state => state.abbreviation === abbr);
};

// Helper function to get multiple states
export const getStatesByAbbrs = (abbrs) => {
  return abbrs.map(abbr => getStateByAbbr(abbr)).filter(Boolean);
};

// Helper function to combine SVG paths for grouped states
export const combineStatePaths = (stateAbbrs) => {
  const states = getStatesByAbbrs(stateAbbrs);
  return states.map(state => state.svgPath).join(' ');
};

// Helper function to calculate center point for grouped states
export const calculateGroupCenter = (stateAbbrs) => {
  const states = getStatesByAbbrs(stateAbbrs);
  if (states.length === 0) return { x: 0, y: 0 };
  
  const sumX = states.reduce((sum, state) => sum + state.center.x, 0);
  const sumY = states.reduce((sum, state) => sum + state.center.y, 0);
  
  return {
    x: Math.round(sumX / states.length),
    y: Math.round(sumY / states.length)
  };
};

// Predefined state groups for common Civil War regions
export const stateGroups = {
  'Border States': ['MD', 'DE', 'KY', 'MO', 'WV'],
  'Deep South': ['SC', 'GA', 'FL', 'AL', 'MS', 'LA'],
  'Upper South': ['VA', 'NC', 'TN', 'AR'],
  'Union Core': ['PA', 'OH', 'IN', 'IL', 'NY', 'NJ', 'MA', 'CT', 'RI', 'VT', 'NH', 'ME'],
  'Western Territories': ['CA', 'OR', 'NV', 'CO', 'NM', 'UT', 'WA', 'ID', 'MT', 'WY', 'ND', 'SD', 'NE', 'KS', 'OK', 'TX', 'AZ']
};

// States that existed in 1862 (excluding Alaska and Hawaii)
export const states1862 = usaStates.map(s => s.abbreviation);
`;

// Write to file
writeFileSync(join(__dirname, 'usaStates.js'), output);

console.log(`Extracted ${states.length} states from us.svg`);
console.log('Generated usaStates.js successfully!');