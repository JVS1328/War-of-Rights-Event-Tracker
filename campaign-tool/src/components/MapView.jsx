import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Map, Loader } from 'lucide-react';
import { usaStates } from '../data/usaStates';
import { getMaxBattleCPCosts, getVPMultiplier } from '../utils/cpSystem';
import { isTerritorySupplied } from '../utils/supplyLines';
import { generateTerrainPatterns, resolvePatternId, DEFAULT_TERRAIN_VIZ } from '../utils/terrainPatterns.jsx';

// Cache for county GeoJSON data
let countyGeoJsonCache = null;
let countyPathsCache = {};

/**
 * Fetch and cache county GeoJSON
 */
const fetchCountyGeoJson = async () => {
  if (countyGeoJsonCache) return countyGeoJsonCache;

  const response = await fetch('https://raw.githubusercontent.com/plotly/datasets/master/geojson-counties-fips.json');
  const data = await response.json();
  countyGeoJsonCache = data;
  return data;
};

/**
 * Convert GeoJSON coordinates to SVG path
 */
const coordinatesToSvgPath = (coordinates, bounds, width = 1000, height = 589) => {
  const { minLon, maxLon, minLat, maxLat } = bounds;
  const padding = 20;
  const scaleX = (width - padding * 2) / (maxLon - minLon);
  const scaleY = (height - padding * 2) / (maxLat - minLat);

  const project = ([lon, lat]) => {
    const x = padding + (lon - minLon) * scaleX;
    const y = height - (padding + (lat - minLat) * scaleY);
    return [x, y];
  };

  const pathParts = [];
  const polygons = coordinates[0]?.[0]?.[0] instanceof Array ? coordinates : [coordinates];

  polygons.forEach(polygon => {
    polygon.forEach(ring => {
      ring.forEach((coord, i) => {
        const [x, y] = project(coord);
        pathParts.push(i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : `L ${x.toFixed(1)} ${y.toFixed(1)}`);
      });
      pathParts.push('Z');
    });
  });

  return pathParts.join(' ');
};

/**
 * Calculate bounds for a set of FIPS codes
 */
const calculateBoundsForFips = (geoJson, allFips) => {
  let minLon = Infinity, maxLon = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;

  const fipsSet = new Set(allFips);

  geoJson.features.forEach(feature => {
    const fips = feature.id || feature.properties?.GEOID;
    if (!fipsSet.has(fips)) return;

    const coords = feature.geometry?.coordinates;
    if (!coords) return;

    const polygons = coords[0]?.[0]?.[0] instanceof Array ? coords : [coords];
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
 * Convert FIPS codes to SVG paths
 */
const convertFipsToPaths = (geoJson, fipsCodes, bounds) => {
  const fipsSet = new Set(fipsCodes);
  const paths = [];

  geoJson.features.forEach(feature => {
    const fips = feature.id || feature.properties?.GEOID;
    if (!fipsSet.has(fips)) return;

    const coords = feature.geometry?.coordinates;
    if (!coords) return;

    paths.push({
      fips,
      svgPath: coordinatesToSvgPath(coords, bounds)
    });
  });

  return paths;
};

const MapView = ({ territories, selectedTerritory, onTerritoryClick, onTerritoryDoubleClick, onTerritoryCtrlDoubleClick, isCountyView = false, pendingBattleTerritoryIds = [], recentBattleTerritoryIds = [], spSettings = null, terrainViz = null }) => {
  const [hoveredTerritory, setHoveredTerritory] = useState(null);
  const [countyPaths, setCountyPaths] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [bounds, setBounds] = useState(null);

  // Zoom and pan state
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Click timeout ref to distinguish single-click from double-click
  const clickTimeoutRef = useRef(null);
  const lastClickEventRef = useRef(null);

  // Unified click handler: single-click pins tooltip, double-click opens battle recorder, ctrl+double-click opens territory editor
  const handleTerritoryPathClick = useCallback((territory, e) => {
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
      if ((lastClickEventRef.current?.ctrlKey || lastClickEventRef.current?.metaKey) &&
          (e?.ctrlKey || e?.metaKey)) {
        onTerritoryCtrlDoubleClick?.(territory);
      } else {
        onTerritoryDoubleClick?.(territory);
      }
      lastClickEventRef.current = null;
    } else {
      lastClickEventRef.current = e;
      clickTimeoutRef.current = setTimeout(() => {
        clickTimeoutRef.current = null;
        lastClickEventRef.current = null;
        onTerritoryClick(territory);
      }, 250);
    }
  }, [onTerritoryClick, onTerritoryDoubleClick, onTerritoryCtrlDoubleClick]);

  // Cleanup click timeout on unmount
  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
    };
  }, []);

  // Check if any territory has countyFips
  const hasCountyData = useMemo(() => {
    return territories.some(t => t.countyFips && t.countyFips.length > 0);
  }, [territories]);

  // Load county data when needed
  useEffect(() => {
    if (!hasCountyData) return;

    const loadCountyData = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const geoJson = await fetchCountyGeoJson();

        // Collect all FIPS codes from all territories
        const allFips = [];
        territories.forEach(t => {
          if (t.countyFips) {
            allFips.push(...t.countyFips);
          }
        });

        // Calculate bounds for all counties
        const calculatedBounds = calculateBoundsForFips(geoJson, allFips);
        setBounds(calculatedBounds);

        // Convert each territory's FIPS codes to paths
        const pathsByTerritory = {};
        territories.forEach(t => {
          if (t.countyFips && t.countyFips.length > 0) {
            pathsByTerritory[t.id] = convertFipsToPaths(geoJson, t.countyFips, calculatedBounds);
          }
        });

        setCountyPaths(pathsByTerritory);
      } catch (error) {
        console.error('Failed to load county data:', error);
        setLoadError('Failed to load county map data');
      } finally {
        setIsLoading(false);
      }
    };

    loadCountyData();
  }, [territories, hasCountyData]);

  // Helper to get base color for an owner
  const getOwnerColor = (owner) => {
    if (owner === 'USA') return '#3b82f6'; // Blue
    if (owner === 'CSA') return '#ef4444'; // Red
    if (owner === 'NEUTRAL') return '#f59e0b'; // Orange
    return '#64748b'; // Gray (unassigned)
  };

  // Helper to interpolate between two hex colors
  const interpolateColor = (color1, color2, factor) => {
    const r1 = parseInt(color1.slice(1, 3), 16);
    const g1 = parseInt(color1.slice(3, 5), 16);
    const b1 = parseInt(color1.slice(5, 7), 16);

    const r2 = parseInt(color2.slice(1, 3), 16);
    const g2 = parseInt(color2.slice(3, 5), 16);
    const b2 = parseInt(color2.slice(5, 7), 16);

    const r = Math.round(r1 + (r2 - r1) * factor);
    const g = Math.round(g1 + (g2 - g1) * factor);
    const b = Math.round(b1 + (b2 - b1) * factor);

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  };

  const getTerritoryColor = (territory) => {
    if (territory.transitionState?.isTransitioning) {
      const transition = territory.transitionState;
      const previousColor = getOwnerColor(transition.previousOwner);
      const newColor = getOwnerColor(territory.owner);
      const turnsElapsed = transition.totalTurns - transition.turnsRemaining;
      const progress = turnsElapsed / transition.totalTurns;
      return interpolateColor(previousColor, newColor, progress);
    }
    return getOwnerColor(territory.owner);
  };

  const getTerritoryStroke = (territory) => {
    if (selectedTerritory?.id === territory.id) return '#fbbf24';
    if (hoveredTerritory?.id === territory.id) return '#fbbf24';
    return '#1e293b';
  };

  const getStrokeWidth = (territory) => {
    if (selectedTerritory?.id === territory.id) return hasCountyData ? '2' : '4';
    if (hoveredTerritory?.id === territory.id) return hasCountyData ? '1.5' : '3';
    return hasCountyData ? '0.5' : '2';
  };

  // Zoom and pan handlers
  const handleWheel = (e) => {
    if (e.shiftKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(0.5, Math.min(5, zoom * delta));
      setZoom(newZoom);
    }
  };

  const handleMouseDown = (e) => {
    const shouldPan = e.button === 1 || (e.button === 0 && e.shiftKey);
    if (shouldPan) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - panX, y: e.clientY - panY });
    }
  };

  const handleMouseMove = (e) => {
    if (isPanning) {
      setPanX(e.clientX - panStart.x);
      setPanY(e.clientY - panStart.y);
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Render loading state for county view
  if (hasCountyData && isLoading) {
    return (
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
            <Map className="w-6 h-6" />
            Campaign Map
          </h2>
        </div>
        <div className="relative bg-slate-900 rounded-lg p-4 h-96 flex items-center justify-center">
          <div className="text-center">
            <Loader className="w-12 h-12 text-amber-400 animate-spin mx-auto mb-4" />
            <p className="text-slate-400">Loading county map data...</p>
          </div>
        </div>
      </div>
    );
  }

  // Render error state
  if (loadError) {
    return (
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
            <Map className="w-6 h-6" />
            Campaign Map
          </h2>
        </div>
        <div className="relative bg-slate-900 rounded-lg p-4 h-96 flex items-center justify-center">
          <div className="text-center text-red-400">
            <p className="mb-2">{loadError}</p>
            <p className="text-sm text-slate-500">Try refreshing the page</p>
          </div>
        </div>
      </div>
    );
  }

  // Compute bounding box center from SVG path data (for territories without explicit center)
  const getPathsCenter = (pathsArray) => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const { svgPath } of pathsArray) {
      const re = /[ML]\s*(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)/gi;
      let match;
      while ((match = re.exec(svgPath)) !== null) {
        const x = parseFloat(match[1]);
        const y = parseFloat(match[2]);
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
    if (minX === Infinity) return null;
    return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  };

  // Resolve center for any territory type, falling back to SVG path computation
  const getTerritoryCenter = (territory) => {
    if (territory.center) return territory.center;
    if (territory.labelPosition) return territory.labelPosition;
    if (territory.countyFips && countyPaths[territory.id]) {
      return getPathsCenter(countyPaths[territory.id]);
    }
    if (territory.countyPaths?.length > 0) {
      return getPathsCenter(territory.countyPaths);
    }
    if (territory.states?.length > 0) {
      const statePaths = territory.states
        .map(abbr => usaStates.find(s => s.abbreviation === abbr))
        .filter(Boolean)
        .map(s => ({ svgPath: s.svgPath }));
      if (statePaths.length > 0) return getPathsCenter(statePaths);
    }
    return null;
  };

  // Smoke layer configs for battle effects (top-down battlefield view)
  // Active: dense rolling musket clouds with wind drift
  // Aftermath: lighter dissipating smoke, no flashes
  const SMOKE_LAYERS = {
    active: [
      { dx: -2, dy: 1, rx: 20, ry: 15, dur: '6s', delay: '0s', peak: 0.45, color: '#6b7280' },
      { dx: 3, dy: -2, rx: 18, ry: 13, dur: '7s', delay: '1.2s', peak: 0.4, color: '#78716c' },
      { dx: -5, dy: -3, rx: 16, ry: 14, dur: '6.5s', delay: '2.5s', peak: 0.38, color: '#6b7280' },
      { dx: 4, dy: 4, rx: 17, ry: 12, dur: '7.5s', delay: '0.7s', peak: 0.35, color: '#9ca3af' },
      { dx: 8, dy: -2, rx: 14, ry: 10, dur: '5.5s', delay: '1.8s', peak: 0.28, color: '#9ca3af' },
      { dx: -6, dy: 5, rx: 15, ry: 11, dur: '8s', delay: '3.2s', peak: 0.3, color: '#78716c' },
      { dx: 12, dy: -5, rx: 10, ry: 8, dur: '5s', delay: '0.4s', peak: 0.18, color: '#d1d5db' },
    ],
    aftermath: [
      { dx: 0, dy: 0, rx: 16, ry: 12, dur: '9s', delay: '0s', peak: 0.2, color: '#9ca3af' },
      { dx: -4, dy: -3, rx: 13, ry: 10, dur: '10s', delay: '2.5s', peak: 0.15, color: '#d1d5db' },
      { dx: 5, dy: 2, rx: 12, ry: 9, dur: '11s', delay: '5s', peak: 0.15, color: '#9ca3af' },
    ],
  };

  const WIND = { active: { dx: 15, dy: -6 }, aftermath: { dx: 8, dy: -3 } };

  // Unified battle effects renderer — 'active' for ongoing, 'aftermath' for recently fought
  const renderBattleEffects = (cx, cy, intensity = 'active') => {
    const layers = SMOKE_LAYERS[intensity];
    const wind = WIND[intensity];
    const isActive = intensity === 'active';

    return (
      <g className="pointer-events-none" filter="url(#battle-smoke)">
        {layers.map((layer, i) => (
          <ellipse
            key={i}
            cx={cx + layer.dx}
            cy={cy + layer.dy}
            rx="0"
            ry="0"
            fill={layer.color}
            opacity="0"
          >
            <animate attributeName="opacity" values={`0;${layer.peak};${layer.peak * 0.8};${layer.peak * 0.5};0`} dur={layer.dur} begin={layer.delay} repeatCount="indefinite" />
            <animate attributeName="rx" values={`${layer.rx * 0.2};${layer.rx * 0.6};${layer.rx}`} dur={layer.dur} begin={layer.delay} repeatCount="indefinite" />
            <animate attributeName="ry" values={`${layer.ry * 0.2};${layer.ry * 0.6};${layer.ry}`} dur={layer.dur} begin={layer.delay} repeatCount="indefinite" />
            <animate attributeName="cx" values={`${cx + layer.dx};${cx + layer.dx + wind.dx}`} dur={layer.dur} begin={layer.delay} repeatCount="indefinite" />
            <animate attributeName="cy" values={`${cy + layer.dy};${cy + layer.dy + wind.dy}`} dur={layer.dur} begin={layer.delay} repeatCount="indefinite" />
          </ellipse>
        ))}
        {isActive && (
          <>
            <circle cx={cx - 6} cy={cy - 2} fill="#fbbf24" opacity="0">
              <animate attributeName="opacity" values="0;0;0.9;0.4;0;0;0;0;0;0" dur="2.5s" repeatCount="indefinite" />
              <animate attributeName="r" values="1;1;7;3;1;1;1;1;1;1" dur="2.5s" repeatCount="indefinite" />
            </circle>
            <circle cx={cx + 5} cy={cy + 3} fill="#fb923c" opacity="0">
              <animate attributeName="opacity" values="0;0;0;0;0;0.85;0.3;0;0;0" dur="3.5s" begin="1.2s" repeatCount="indefinite" />
              <animate attributeName="r" values="1;1;1;1;1;6;2;1;1;1" dur="3.5s" begin="1.2s" repeatCount="indefinite" />
            </circle>
            <circle cx={cx + 1} cy={cy - 5} fill="#fde68a" opacity="0">
              <animate attributeName="opacity" values="0;0;0;0.95;0;0;0;0" dur="4s" begin="2.5s" repeatCount="indefinite" />
              <animate attributeName="r" values="1;1;1;5;1;1;1;1" dur="4s" begin="2.5s" repeatCount="indefinite" />
            </circle>
          </>
        )}
      </g>
    );
  };

  // Merge provided viz with defaults so every terrain group has a pattern definition
  const vizConfig = useMemo(() => ({ ...DEFAULT_TERRAIN_VIZ, ...terrainViz }), [terrainViz]);

  // Terrain overlay — returns pattern ID + opacity for a territory's dominant terrain
  const getTerrainOverlay = (territory) => {
    const weights = territory.terrainWeights;
    if (!weights) return null;
    const entries = Object.entries(weights);
    if (entries.length === 0) return null;

    const [dominant, dominantWeight] = entries.reduce((best, curr) => curr[1] > best[1] ? curr : best);
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    const dominance = dominantWeight / total;

    return { patternId: resolvePatternId(dominant, dominance, vizConfig), opacity: 0.08 + dominance * 0.14 };
  };

  // Render terrain pattern overlay on territory paths (DRY across all 4 rendering modes)
  const renderTerrainOverlay = (svgPaths, territory) => {
    const overlay = getTerrainOverlay(territory);
    if (!overlay) return null;
    return svgPaths.map((path, i) => (
      <path
        key={`terrain-${i}`}
        d={typeof path === 'string' ? path : path.svgPath}
        fill={`url(#${overlay.patternId})`}
        opacity={overlay.opacity}
        className="pointer-events-none"
      />
    ));
  };

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
          <Map className="w-6 h-6" />
          Campaign Map
          {hasCountyData && <span className="text-sm font-normal text-slate-400 ml-2">(County View)</span>}
        </h2>
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded"></div>
            <span className="text-slate-300">USA</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded"></div>
            <span className="text-slate-300">CSA</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-orange-500 rounded"></div>
            <span className="text-slate-300">Neutral</span>
          </div>
        </div>
      </div>

      <div className="relative bg-slate-900 rounded-lg p-4">
        <svg
          viewBox="0 0 1000 589"
          className="w-full h-full"
          style={{ cursor: isPanning ? 'grabbing' : 'default' }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <defs>
            <filter id="battle-smoke" x="-100%" y="-100%" width="300%" height="300%">
              <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="4" seed="3" result="noise">
                <animate attributeName="seed" values="1;2;3;4;5;6;7;8;9;10" dur="8s" repeatCount="indefinite" />
              </feTurbulence>
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="12" xChannelSelector="R" yChannelSelector="G" result="displaced" />
              <feGaussianBlur in="displaced" stdDeviation="1.5" />
            </filter>
            {/* Terrain patterns — generated from vizConfig for all terrain groups */}
            {Object.entries(vizConfig).flatMap(([name, cfg]) => generateTerrainPatterns(name, cfg))}
          </defs>
          <g transform={`translate(${panX}, ${panY}) scale(${zoom})`}>
            {/* Territory polygons */}
            {territories.map(territory => {
              const center = getTerritoryCenter(territory);
              const labelX = center?.x;
              const labelY = center?.y;
              const hasPendingBattle = pendingBattleTerritoryIds.includes(territory.id);
              const hasRecentBattle = !hasPendingBattle && recentBattleTerritoryIds.includes(territory.id);

              // For county-based territories, render each county
              if (territory.countyFips && countyPaths[territory.id]) {
                const paths = countyPaths[territory.id];
                return (
                  <g key={territory.id}>
                    {paths.map((county, idx) => (
                      <path
                        key={`${territory.id}-${county.fips || idx}`}
                        d={county.svgPath}
                        fill={getTerritoryColor(territory)}
                        stroke={getTerritoryStroke(territory)}
                        strokeWidth={getStrokeWidth(territory)}
                        className="cursor-pointer hover:opacity-80 transition-all"
                        onClick={(e) => handleTerritoryPathClick(territory, e)}
                        onMouseEnter={() => setHoveredTerritory(territory)}
                        onMouseLeave={() => setHoveredTerritory(null)}
                      />
                    ))}
                    {renderTerrainOverlay(paths, territory)}
                    {hasPendingBattle && labelX && labelY && renderBattleEffects(labelX, labelY, 'active')}
                    {hasRecentBattle && labelX && labelY && renderBattleEffects(labelX, labelY, 'aftermath')}
                  </g>
                );
              }

              // For grouped state-based territories, render each state individually
              if (territory.states && territory.states.length > 0) {
                return (
                  <g key={territory.id}>
                    {territory.states.map(stateAbbr => {
                      const state = usaStates.find(s => s.abbreviation === stateAbbr);
                      if (!state) return null;

                      return (
                        <path
                          key={`${territory.id}-${stateAbbr}`}
                          d={state.svgPath}
                          fill={getTerritoryColor(territory)}
                          stroke={getTerritoryStroke(territory)}
                          strokeWidth={getStrokeWidth(territory)}
                          className="cursor-pointer hover:opacity-80 transition-all"
                          onClick={(e) => handleTerritoryPathClick(territory, e)}
                          onMouseEnter={() => setHoveredTerritory(territory)}
                          onMouseLeave={() => setHoveredTerritory(null)}
                        />
                      );
                    })}
                    {renderTerrainOverlay(
                      territory.states.map(a => usaStates.find(s => s.abbreviation === a)).filter(Boolean),
                      territory
                    )}
                    {territory.isCapital && (
                      <circle
                        cx={labelX}
                        cy={labelY}
                        r="5"
                        fill="#fbbf24"
                        stroke="#1e293b"
                        strokeWidth="2"
                        className="pointer-events-none"
                      />
                    )}
                    {hasPendingBattle && labelX && labelY && renderBattleEffects(labelX, labelY, 'active')}
                    {hasRecentBattle && labelX && labelY && renderBattleEffects(labelX, labelY, 'aftermath')}
                  </g>
                );
              }

              // For grouped county-based territories (pre-loaded paths)
              if (territory.countyPaths && territory.countyPaths.length > 0) {
                return (
                  <g key={territory.id}>
                    {territory.countyPaths.map(county => (
                      <path
                        key={`${territory.id}-${county.id}`}
                        d={county.svgPath}
                        fill={getTerritoryColor(territory)}
                        stroke={getTerritoryStroke(territory)}
                        strokeWidth={getStrokeWidth(territory)}
                        className="cursor-pointer hover:opacity-80 transition-all"
                        onClick={(e) => handleTerritoryPathClick(territory, e)}
                        onMouseEnter={() => setHoveredTerritory(territory)}
                        onMouseLeave={() => setHoveredTerritory(null)}
                      />
                    ))}
                    {renderTerrainOverlay(territory.countyPaths, territory)}
                    {territory.isCapital && (
                      <circle
                        cx={labelX}
                        cy={labelY}
                        r="5"
                        fill="#fbbf24"
                        stroke="#1e293b"
                        strokeWidth="2"
                        className="pointer-events-none"
                      />
                    )}
                    {hasPendingBattle && labelX && labelY && renderBattleEffects(labelX, labelY, 'active')}
                    {hasRecentBattle && labelX && labelY && renderBattleEffects(labelX, labelY, 'aftermath')}
                  </g>
                );
              }

              // For other territories (legacy), use combined svgPath
              const pathData = territory.svgPath || territory.coordinates?.data;
              if (!pathData) return null;

              return (
                <g key={territory.id}>
                  <path
                    d={pathData}
                    fill={getTerritoryColor(territory)}
                    stroke={getTerritoryStroke(territory)}
                    strokeWidth={getStrokeWidth(territory)}
                    className="cursor-pointer hover:opacity-80 transition-all"
                    onClick={(e) => handleTerritoryPathClick(territory, e)}
                    onMouseEnter={() => setHoveredTerritory(territory)}
                    onMouseLeave={() => setHoveredTerritory(null)}
                  />
                  {renderTerrainOverlay([pathData], territory)}
                  {territory.isCapital && (
                    <circle
                      cx={labelX}
                      cy={labelY}
                      r="5"
                      fill="#fbbf24"
                      stroke="#1e293b"
                      strokeWidth="2"
                      className="pointer-events-none"
                    />
                  )}
                  {hasPendingBattle && labelX && labelY && renderBattleEffects(labelX, labelY, 'active')}
                    {hasRecentBattle && labelX && labelY && renderBattleEffects(labelX, labelY, 'aftermath')}
                </g>
              );
            })}
          </g>
        </svg>

        {/* Tooltip - shows for hovered territory, or pinned (selected) territory */}
        {(() => {
          const tooltipTerritory = hoveredTerritory || selectedTerritory;
          if (!tooltipTerritory) return null;
          const isPinned = !hoveredTerritory && selectedTerritory;
          return (
            <div className={`absolute top-4 right-4 bg-slate-800 border rounded-lg p-3 shadow-xl pointer-events-none ${
              isPinned ? 'border-amber-400' : 'border-amber-500'
            }`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-amber-400 font-bold">{tooltipTerritory.name}</span>
                {isPinned && <span className="text-[10px] text-slate-500 bg-slate-700 px-1.5 py-0.5 rounded">pinned</span>}
              </div>
              <div className="text-sm text-slate-300 space-y-1">
                <div>Owner: <span className={`font-semibold ${
                  tooltipTerritory.owner === 'USA' ? 'text-blue-400' :
                  tooltipTerritory.owner === 'CSA' ? 'text-red-400' :
                  'text-orange-400'
                }`}>{tooltipTerritory.owner}</span></div>
                <div>VP Value: <span className="text-green-400 font-semibold">{tooltipTerritory.pointValue || tooltipTerritory.victoryPoints}</span></div>
                {tooltipTerritory.terrainWeights && (() => {
                  const entries = Object.entries(tooltipTerritory.terrainWeights);
                  const total = entries.reduce((sum, [, w]) => sum + w, 0);
                  return (
                    <div>Terrain: {entries.map(([type, w], i) => (
                      <span key={type}>
                        {i > 0 && ' · '}
                        <span style={{ color: vizConfig[type]?.color || '#94a3b8' }}>{type} {Math.round(w / total * 100)}%</span>
                      </span>
                    ))}</div>
                  );
                })()}
                {tooltipTerritory.stateAbbr && (
                  <div>State: <span className="text-slate-400">{tooltipTerritory.stateAbbr}</span></div>
                )}
                {tooltipTerritory.transitionState?.isTransitioning && (
                  <div className="mt-2 pt-2 border-t border-slate-600">
                    <div className="text-orange-400 font-semibold mb-1">Capturing...</div>
                    <div className="text-xs">
                      <div>Turns Remaining: <span className="text-yellow-400 font-semibold">{tooltipTerritory.transitionState.turnsRemaining}</span></div>
                      <div>From: <span className={`font-semibold ${
                        tooltipTerritory.transitionState.previousOwner === 'USA' ? 'text-blue-400' :
                        tooltipTerritory.transitionState.previousOwner === 'CSA' ? 'text-red-400' :
                        'text-slate-400'
                      }`}>{tooltipTerritory.transitionState.previousOwner}</span></div>
                    </div>
                  </div>
                )}
                {pendingBattleTerritoryIds.includes(tooltipTerritory.id) && (
                  <div className="mt-2 pt-2 border-t border-slate-600">
                    <div className="text-amber-400 font-semibold text-xs">Battle Ongoing</div>
                  </div>
                )}
                {!pendingBattleTerritoryIds.includes(tooltipTerritory.id) && recentBattleTerritoryIds.includes(tooltipTerritory.id) && (
                  <div className="mt-2 pt-2 border-t border-slate-600">
                    <div className="text-slate-400 font-semibold text-xs">Battle Recently Fought</div>
                  </div>
                )}
                {tooltipTerritory.countyFips && (
                  <div className="text-xs text-slate-500">Counties: {tooltipTerritory.countyFips.length}</div>
                )}
                {spSettings && (() => {
                  const vp = tooltipTerritory.pointValue || tooltipTerritory.victoryPoints || 1;
                  const isNeutral = tooltipTerritory.owner === 'NEUTRAL';
                  const attacker = isNeutral ? 'USA' : (tooltipTerritory.owner === 'USA' ? 'CSA' : 'USA');
                  const defender = attacker === 'USA' ? 'CSA' : 'USA';
                  const isIsolated = !isNeutral && !isTerritorySupplied(tooltipTerritory, territories);
                  const { attackerMax, defenderMax } = getMaxBattleCPCosts(
                    vp, tooltipTerritory.owner, defender,
                    spSettings.vpBase, isIsolated, {
                      attackNeutral: spSettings.attackNeutral,
                      attackEnemy: spSettings.attackEnemy,
                      defenseFriendly: spSettings.defenseFriendly,
                      defenseNeutral: spSettings.defenseNeutral,
                    }
                  );
                  return (
                    <div className="mt-2 pt-2 border-t border-slate-600">
                      <div className="text-amber-400 font-semibold text-xs mb-1">Max SP Loss</div>
                      <div className="text-xs">
                        <div>Attacker: <span className="text-orange-400 font-semibold">-{attackerMax} SP</span></div>
                        <div>Defender: <span className="text-orange-400 font-semibold">-{defenderMax} SP</span>{isIsolated && <span className="text-red-400 ml-1">(2x isolated)</span>}</div>
                      </div>
                    </div>
                  );
                })()}
              </div>
              {isPinned && (
                <div className="text-[10px] text-slate-500 mt-2 pt-1 border-t border-slate-700">
                  Click to deselect · Double-click to record battle · Ctrl+dbl-click to edit
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Zoom/Pan hint */}
      <div className="mt-2 text-xs text-slate-500 text-center">
        Click to pin info | Double-click to record battle | Ctrl+double-click to edit territory | Shift+scroll to zoom | Shift+drag to pan
      </div>
    </div>
  );
};

export default MapView;