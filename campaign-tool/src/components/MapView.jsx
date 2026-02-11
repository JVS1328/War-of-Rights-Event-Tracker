import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Map, Loader } from 'lucide-react';
import { usaStates } from '../data/usaStates';
import { getMaxBattleCPCosts, getVPMultiplier } from '../utils/cpSystem';
import { isTerritorySupplied } from '../utils/supplyLines';

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

const MapView = ({ territories, selectedTerritory, onTerritoryClick, onTerritoryDoubleClick, onTerritoryCtrlDoubleClick, isCountyView = false, pendingBattleTerritoryIds = [], spSettings = null }) => {
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

  // Battle smoke & cannon flash effect for pending battles
  const renderBattleSmoke = (cx, cy) => (
    <g className="pointer-events-none">
      {/* Smoke puffs drifting upward */}
      <circle cx={cx - 5} cy={cy} fill="#94a3b8" opacity="0">
        <animate attributeName="opacity" values="0;0.35;0.2;0" dur="3.5s" repeatCount="indefinite" />
        <animate attributeName="cy" values={`${cy};${cy - 20}`} dur="3.5s" repeatCount="indefinite" />
        <animate attributeName="r" values="4;12" dur="3.5s" repeatCount="indefinite" />
      </circle>
      <circle cx={cx + 4} cy={cy} fill="#64748b" opacity="0">
        <animate attributeName="opacity" values="0;0.3;0.15;0" dur="4s" begin="1.3s" repeatCount="indefinite" />
        <animate attributeName="cy" values={`${cy};${cy - 18}`} dur="4s" begin="1.3s" repeatCount="indefinite" />
        <animate attributeName="r" values="3;10" dur="4s" begin="1.3s" repeatCount="indefinite" />
      </circle>
      <circle cx={cx} cy={cy + 3} fill="#94a3b8" opacity="0">
        <animate attributeName="opacity" values="0;0.25;0.1;0" dur="4.5s" begin="2.8s" repeatCount="indefinite" />
        <animate attributeName="cy" values={`${cy + 3};${cy - 16}`} dur="4.5s" begin="2.8s" repeatCount="indefinite" />
        <animate attributeName="r" values="3;11" dur="4.5s" begin="2.8s" repeatCount="indefinite" />
      </circle>
      {/* Cannon flashes */}
      <circle cx={cx - 3} cy={cy} fill="#fbbf24" opacity="0">
        <animate attributeName="opacity" values="0;0;0.9;0;0;0;0;0;0;0" dur="3s" repeatCount="indefinite" />
        <animate attributeName="r" values="1;1;6;2;1;1;1;1;1;1" dur="3s" repeatCount="indefinite" />
      </circle>
      <circle cx={cx + 4} cy={cy - 1} fill="#fb923c" opacity="0">
        <animate attributeName="opacity" values="0;0;0;0;0;0.8;0;0;0;0" dur="4.5s" begin="1.8s" repeatCount="indefinite" />
        <animate attributeName="r" values="1;1;1;1;1;5;1;1;1;1" dur="4.5s" begin="1.8s" repeatCount="indefinite" />
      </circle>
    </g>
  );

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
          <g transform={`translate(${panX}, ${panY}) scale(${zoom})`}>
            {/* Territory polygons */}
            {territories.map(territory => {
              const labelX = territory.center?.x || territory.labelPosition?.x;
              const labelY = territory.center?.y || territory.labelPosition?.y;
              const hasPendingBattle = pendingBattleTerritoryIds.includes(territory.id);

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
                    {hasPendingBattle && labelX && labelY && renderBattleSmoke(labelX, labelY)}
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
                    {hasPendingBattle && labelX && labelY && renderBattleSmoke(labelX, labelY)}
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
                    {hasPendingBattle && labelX && labelY && renderBattleSmoke(labelX, labelY)}
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
                  {hasPendingBattle && labelX && labelY && renderBattleSmoke(labelX, labelY)}
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