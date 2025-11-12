import { useState } from 'react';
import { Map } from 'lucide-react';

const MapView = ({ territories, selectedTerritory, onTerritoryClick }) => {
  const [hoveredTerritory, setHoveredTerritory] = useState(null);

  const getTerritoryColor = (territory) => {
    if (territory.owner === 'USA') return '#3b82f6'; // Blue
    if (territory.owner === 'CSA') return '#ef4444'; // Red
    return '#64748b'; // Gray (neutral)
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
            <div className="w-4 h-4 bg-slate-500 rounded"></div>
            <span className="text-slate-300">Neutral</span>
          </div>
        </div>
      </div>
      
      <div className="relative bg-slate-900 rounded-lg p-4">
        <svg viewBox="0 0 1000 589" className="w-full h-full">
          {/* Territory polygons */}
          {territories.map(territory => {
            // Support both default territories (coordinates.data) and custom territories (svgPath)
            const pathData = territory.svgPath || territory.coordinates?.data;
            const labelX = territory.center?.x || territory.labelPosition?.x;
            const labelY = territory.center?.y || territory.labelPosition?.y;
            
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