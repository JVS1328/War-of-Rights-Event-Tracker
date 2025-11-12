import { useState } from 'react';
import { MapPin, ChevronDown, ChevronRight, Star } from 'lucide-react';

const TerritoryList = ({ territories, onTerritorySelect }) => {
  const [expandedTerritory, setExpandedTerritory] = useState(null);
  const [filterOwner, setFilterOwner] = useState('ALL');

  const filteredTerritories = territories.filter(t => {
    if (filterOwner === 'ALL') return true;
    return t.owner === filterOwner;
  });

  const sortedTerritories = [...filteredTerritories].sort((a, b) => {
    // Sort by owner first, then by VP value
    if (a.owner !== b.owner) {
      const ownerOrder = { USA: 0, CSA: 1, NEUTRAL: 2 };
      return ownerOrder[a.owner] - ownerOrder[b.owner];
    }
    return b.victoryPoints - a.victoryPoints;
  });

  const toggleExpand = (territoryId) => {
    setExpandedTerritory(expandedTerritory === territoryId ? null : territoryId);
  };

  const getOwnerColor = (owner) => {
    if (owner === 'USA') return 'text-blue-400';
    if (owner === 'CSA') return 'text-red-400';
    return 'text-slate-400';
  };

  const getOwnerBg = (owner) => {
    if (owner === 'USA') return 'bg-blue-600';
    if (owner === 'CSA') return 'bg-red-600';
    return 'bg-slate-600';
  };

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-amber-400 flex items-center gap-2">
          <MapPin className="w-5 h-5" />
          Territories ({filteredTerritories.length})
        </h3>
        
        {/* Filter buttons */}
        <div className="flex gap-1">
          <button
            onClick={() => setFilterOwner('ALL')}
            className={`px-3 py-1 rounded text-xs font-semibold transition ${
              filterOwner === 'ALL'
                ? 'bg-amber-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterOwner('USA')}
            className={`px-3 py-1 rounded text-xs font-semibold transition ${
              filterOwner === 'USA'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            USA
          </button>
          <button
            onClick={() => setFilterOwner('CSA')}
            className={`px-3 py-1 rounded text-xs font-semibold transition ${
              filterOwner === 'CSA'
                ? 'bg-red-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            CSA
          </button>
          <button
            onClick={() => setFilterOwner('NEUTRAL')}
            className={`px-3 py-1 rounded text-xs font-semibold transition ${
              filterOwner === 'NEUTRAL'
                ? 'bg-slate-500 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            Neutral
          </button>
        </div>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {sortedTerritories.map(territory => (
          <div key={territory.id} className="bg-slate-700 rounded-lg overflow-hidden">
            <div
              className="p-3 cursor-pointer hover:bg-slate-600 transition"
              onClick={() => {
                toggleExpand(territory.id);
                onTerritorySelect(territory);
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1">
                  {expandedTerritory === territory.id ? (
                    <ChevronDown className="w-4 h-4 text-amber-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  )}
                  <div className="flex items-center gap-2">
                    {territory.isCapital && (
                      <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                    )}
                    <span className="text-white font-semibold">{territory.name}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${getOwnerBg(territory.owner)} text-white`}>
                    {territory.owner}
                  </span>
                  <span className="text-green-400 font-bold text-sm">
                    {territory.victoryPoints} VP
                  </span>
                </div>
              </div>
            </div>

            {/* Expanded details */}
            {expandedTerritory === territory.id && (
              <div className="bg-slate-800 p-4 border-t border-slate-600">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Map:</span>
                    <span className="text-white font-semibold">{territory.mapName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Victory Points:</span>
                    <span className="text-green-400 font-semibold">{territory.victoryPoints}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Current Owner:</span>
                    <span className={`font-semibold ${getOwnerColor(territory.owner)}`}>
                      {territory.owner}
                    </span>
                  </div>
                  {territory.isCapital && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Type:</span>
                      <span className="text-amber-400 font-semibold flex items-center gap-1">
                        <Star className="w-3 h-3 fill-amber-400" />
                        Capital
                      </span>
                    </div>
                  )}
                  
                  {/* Capture history */}
                  {territory.captureHistory && territory.captureHistory.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-700">
                      <div className="text-slate-400 text-xs mb-2">Capture History:</div>
                      <div className="space-y-1">
                        {territory.captureHistory.slice(-3).reverse().map((capture, idx) => (
                          <div key={idx} className="text-xs flex justify-between">
                            <span className="text-slate-500">Turn {capture.turn}:</span>
                            <span className={getOwnerColor(capture.owner)}>
                              Captured by {capture.owner}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TerritoryList;