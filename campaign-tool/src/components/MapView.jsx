import { useState } from 'react';
import { Map } from 'lucide-react';
import { usaStates } from '../data/usaStates';

const MapView = ({ territories, selectedTerritory, onTerritoryClick }) => {
  const [hoveredTerritory, setHoveredTerritory] = useState(null);

  // Zoom and pan state
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Helper to get base color for an owner
  const getOwnerColor = (owner) => {
    if (owner === 'USA') return '#3b82f6'; // Blue
    if (owner === 'CSA') return '#ef4444'; // Red
    if (owner === 'NEUTRAL') return '#f59e0b'; // Orange
    return '#64748b'; // Gray (unassigned)
  };

  // Helper to interpolate between two hex colors
  const interpolateColor = (color1, color2, factor) => {
    // Parse hex colors
    const r1 = parseInt(color1.slice(1, 3), 16);
    const g1 = parseInt(color1.slice(3, 5), 16);
    const b1 = parseInt(color1.slice(5, 7), 16);

    const r2 = parseInt(color2.slice(1, 3), 16);
    const g2 = parseInt(color2.slice(3, 5), 16);
    const b2 = parseInt(color2.slice(5, 7), 16);

    // Interpolate
    const r = Math.round(r1 + (r2 - r1) * factor);
    const g = Math.round(g1 + (g2 - g1) * factor);
    const b = Math.round(b1 + (b2 - b1) * factor);

    // Convert back to hex
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  };

  const getTerritoryColor = (territory) => {
    // Check if territory is in transition state
    if (territory.transitionState?.isTransitioning) {
      const transition = territory.transitionState;
      const previousColor = getOwnerColor(transition.previousOwner);
      const newColor = getOwnerColor(territory.owner);

      // Calculate progress (how far through the transition we are)
      const turnsElapsed = transition.totalTurns - transition.turnsRemaining;
      const progress = turnsElapsed / transition.totalTurns;

      // Interpolate between previous and new color
      return interpolateColor(previousColor, newColor, progress);
    }

    // Normal color for non-transitioning territories
    return getOwnerColor(territory.owner);
  };

  const getTerritoryStroke = (territory) => {
    if (selectedTerritory?.id === territory.id) return '#fbbf24'; // Amber for selected
    if (hoveredTerritory?.id === territory.id) return '#fbbf24'; // Amber for hover
    return '#1e293b'; // Dark slate for normal
  };

  const getStrokeWidth = (territory) => {
    if (selectedTerritory?.id === territory.id) return '4';
    if (hoveredTerritory?.id === territory.id) return '3';
    return '2';
  };

  // Zoom and pan handlers
  const handleWheel = (e) => {
    // Only zoom if shift is held
    if (e.shiftKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(0.5, Math.min(5, zoom * delta));
      setZoom(newZoom);
    }
  };

  const handleMouseDown = (e) => {
    // Pan with middle mouse button or shift + left click
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

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
          <Map className="w-6 h-6" />
          Campaign Map
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
                        onClick={() => onTerritoryClick(territory)}
                        onMouseEnter={() => setHoveredTerritory(territory)}
                        onMouseLeave={() => setHoveredTerritory(null)}
                      />
                    );
                  })}
                  {/* Capital indicator */}
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
                </g>
              );
            }

            // For grouped county-based territories, render each county individually
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
                      onClick={() => onTerritoryClick(territory)}
                      onMouseEnter={() => setHoveredTerritory(territory)}
                      onMouseLeave={() => setHoveredTerritory(null)}
                    />
                  ))}
                  {/* Capital indicator */}
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
                </g>
              );
            }

            // For other territories (legacy), use combined svgPath
            const pathData = territory.svgPath || territory.coordinates?.data;
            return (
              <g key={territory.id}>
                <path
                  d={pathData}
                  fill={getTerritoryColor(territory)}
                  stroke={getTerritoryStroke(territory)}
                  strokeWidth={getStrokeWidth(territory)}
                  className="cursor-pointer hover:opacity-80 transition-all"
                  onClick={() => onTerritoryClick(territory)}
                  onMouseEnter={() => setHoveredTerritory(territory)}
                  onMouseLeave={() => setHoveredTerritory(null)}
                />
                {/* Capital indicator */}
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
              </g>
            );
          })}
          </g>
        </svg>
        
        {/* Tooltip */}
        {hoveredTerritory && (
          <div className="absolute top-4 right-4 bg-slate-800 border border-amber-500 rounded-lg p-3 shadow-xl pointer-events-none">
            <div className="text-amber-400 font-bold mb-1">{hoveredTerritory.name}</div>
            <div className="text-sm text-slate-300 space-y-1">
              <div>Owner: <span className={`font-semibold ${
                hoveredTerritory.owner === 'USA' ? 'text-blue-400' :
                hoveredTerritory.owner === 'CSA' ? 'text-red-400' :
                'text-slate-400'
              }`}>{hoveredTerritory.owner}</span></div>
              <div>VP Value: <span className="text-green-400 font-semibold">{hoveredTerritory.victoryPoints}</span></div>
              {hoveredTerritory.transitionState?.isTransitioning && (
                <div className="mt-2 pt-2 border-t border-slate-600">
                  <div className="text-orange-400 font-semibold mb-1">🕐 Capturing...</div>
                  <div className="text-xs">
                    <div>Turns Remaining: <span className="text-yellow-400 font-semibold">{hoveredTerritory.transitionState.turnsRemaining}</span></div>
                    <div>From: <span className={`font-semibold ${
                      hoveredTerritory.transitionState.previousOwner === 'USA' ? 'text-blue-400' :
                      hoveredTerritory.transitionState.previousOwner === 'CSA' ? 'text-red-400' :
                      'text-slate-400'
                    }`}>{hoveredTerritory.transitionState.previousOwner}</span></div>
                    <div className="text-slate-400 mt-1">VP awarded when complete</div>
                  </div>
                </div>
              )}
              {hoveredTerritory.mapName && (
                <div>Map: <span className="text-slate-400">{hoveredTerritory.mapName}</span></div>
              )}
              {hoveredTerritory.maps && hoveredTerritory.maps.length > 0 && (
                <div>Maps: <span className="text-slate-400">{hoveredTerritory.maps.length}</span></div>
              )}
              {hoveredTerritory.states && (
                <div>States: <span className="text-slate-400">{hoveredTerritory.states.join(', ')}</span></div>
              )}
              {hoveredTerritory.isCapital && (
                <div className="text-amber-400 font-semibold">⭐ Capital</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MapView;