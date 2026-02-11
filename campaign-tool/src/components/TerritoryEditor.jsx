import { useState } from 'react';
import { X, Save, Star, MapPin } from 'lucide-react';
import { MAPS_BY_MAPSET } from '../data/territories';

/**
 * TerritoryEditor - Modal for editing territory properties in-place.
 * Opened via Ctrl+double-click on the map.
 */
const TerritoryEditor = ({ territory, terrainGroups = {}, onSave, onClose }) => {
  const [name, setName] = useState(territory.name || '');
  const [owner, setOwner] = useState(territory.owner || 'NEUTRAL');
  const [victoryPoints, setVictoryPoints] = useState(territory.victoryPoints || territory.pointValue || 1);
  const [isCapital, setIsCapital] = useState(territory.isCapital || false);
  const [maps, setMaps] = useState(territory.maps || []);
  const [terrainWeights, setTerrainWeights] = useState(territory.terrainWeights || {});

  const availableGroupNames = Object.keys(terrainGroups);

  const handleToggleTerrainGroup = (groupName) => {
    setTerrainWeights(prev => {
      if (prev[groupName] !== undefined) {
        const { [groupName]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [groupName]: 1 };
    });
  };

  const handleWeightChange = (groupName, value) => {
    const num = parseInt(value) || 0;
    if (num <= 0) {
      const { [groupName]: _, ...rest } = terrainWeights;
      setTerrainWeights(rest);
    } else {
      setTerrainWeights({ ...terrainWeights, [groupName]: num });
    }
  };

  const handleToggleMap = (mapName) => {
    setMaps(prev =>
      prev.includes(mapName)
        ? prev.filter(m => m !== mapName)
        : [...prev, mapName]
    );
  };

  const handleSave = () => {
    onSave({
      ...territory,
      name,
      owner,
      victoryPoints,
      pointValue: victoryPoints,
      isCapital,
      maps,
      terrainWeights: Object.keys(terrainWeights).length > 0 ? terrainWeights : undefined,
    });
  };

  const totalWeight = Object.values(terrainWeights).reduce((s, w) => s + w, 0);

  return (
    <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-slate-800 rounded-lg shadow-2xl border border-slate-700 max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
              <MapPin className="w-6 h-6" />
              Edit Territory
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg transition">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm text-slate-300 mb-1 font-semibold">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:border-amber-500 outline-none"
              />
            </div>

            {/* Owner */}
            <div>
              <label className="block text-sm text-slate-300 mb-1 font-semibold">Owner</label>
              <div className="flex gap-2">
                {['USA', 'CSA', 'NEUTRAL'].map(side => (
                  <button
                    key={side}
                    onClick={() => setOwner(side)}
                    className={`flex-1 px-3 py-2 rounded font-semibold transition text-sm ${
                      owner === side
                        ? side === 'USA' ? 'bg-blue-600 text-white'
                          : side === 'CSA' ? 'bg-red-600 text-white'
                          : 'bg-slate-500 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {side === 'NEUTRAL' ? 'Neutral' : side}
                  </button>
                ))}
              </div>
            </div>

            {/* Victory Points */}
            <div>
              <label className="block text-sm text-slate-300 mb-1 font-semibold">
                Victory Points: {victoryPoints}
              </label>
              <input
                type="range"
                min="1"
                max="20"
                value={victoryPoints}
                onChange={(e) => setVictoryPoints(parseInt(e.target.value))}
                className="w-full"
              />
            </div>

            {/* Capital */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isCapital}
                onChange={(e) => setIsCapital(e.target.checked)}
                className="rounded"
              />
              <Star className={`w-4 h-4 ${isCapital ? 'text-amber-400 fill-amber-400' : 'text-slate-500'}`} />
              <span className="text-sm text-slate-300 font-semibold">Capital</span>
            </label>

            {/* Terrain Groups & Weights */}
            {availableGroupNames.length > 0 && (
              <div>
                <label className="block text-sm text-slate-300 mb-2 font-semibold">
                  Terrain Groups (for random roll)
                </label>
                <div className="space-y-2">
                  {availableGroupNames.map(groupName => {
                    const isActive = terrainWeights[groupName] !== undefined;
                    const weight = terrainWeights[groupName] || 0;
                    const pct = isActive && totalWeight > 0 ? Math.round((weight / totalWeight) * 100) : 0;
                    return (
                      <div key={groupName} className="flex items-center gap-3 bg-slate-700 rounded p-2">
                        <input
                          type="checkbox"
                          checked={isActive}
                          onChange={() => handleToggleTerrainGroup(groupName)}
                          className="rounded"
                        />
                        <span className="text-sm text-white flex-1">{groupName}</span>
                        {isActive && (
                          <>
                            <input
                              type="number"
                              min="1"
                              max="20"
                              value={weight}
                              onChange={(e) => handleWeightChange(groupName, e.target.value)}
                              className="w-16 px-2 py-1 bg-slate-600 text-white rounded border border-slate-500 text-sm text-center"
                            />
                            <span className="text-xs text-slate-400 w-10 text-right">{pct}%</span>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
                {Object.keys(terrainWeights).length > 0 && (
                  <p className="text-xs text-slate-500 mt-1">
                    Weights determine roll probability. Maps are pulled from terrain group definitions in Settings.
                  </p>
                )}
              </div>
            )}

            {/* Assigned Maps */}
            <div>
              <label className="block text-sm text-slate-300 mb-2 font-semibold">
                Assigned Maps {maps.length > 0 && <span className="text-amber-400">({maps.length})</span>}
              </label>
              <p className="text-xs text-slate-500 mb-2">
                Specific maps override terrain group rolls. Leave empty to use terrain groups.
              </p>
              <div className="bg-slate-700 rounded border border-slate-600 max-h-48 overflow-y-auto">
                {Object.entries(MAPS_BY_MAPSET).map(([mapset, mapList]) => (
                  <div key={mapset}>
                    <div className="px-3 py-1 bg-slate-600 text-xs text-amber-400 font-semibold sticky top-0">
                      {mapset}
                    </div>
                    {mapList.map(mapName => (
                      <label
                        key={mapName}
                        className="flex items-center gap-2 px-3 py-1 hover:bg-slate-600 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={maps.includes(mapName)}
                          onChange={() => handleToggleMap(mapName)}
                          className="rounded"
                        />
                        <span className="text-xs text-white">{mapName}</span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Save / Cancel */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3 bg-slate-600 hover:bg-slate-500 text-white rounded-lg font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!name.trim()}
                className={`flex-1 px-4 py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2 ${
                  name.trim()
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-slate-600 cursor-not-allowed opacity-50 text-slate-400'
                }`}
              >
                <Save className="w-4 h-4" />
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TerritoryEditor;
