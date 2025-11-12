import React, { useState, useEffect } from 'react';
import { X, Save, RotateCcw, Plus, Trash2, GripVertical, MapPin } from 'lucide-react';
import { usaStates, getStatesByAbbrs, calculateGroupCenter, combineStatePaths } from '../data/usaStates';

const MapEditor = ({ isOpen, onClose, onSave, existingCampaign = null }) => {
  const [selectedStates, setSelectedStates] = useState(new Set());
  const [territories, setTerritories] = useState([]);
  const [hoveredState, setHoveredState] = useState(null);
  const [editingTerritory, setEditingTerritory] = useState(null);
  const [draggedTerritory, setDraggedTerritory] = useState(null);

  // Available War of Rights maps organized by mapset
  const mapsByMapset = {
    'Antietam': [
      "East Woods Skirmish",
      "Hooker's Push",
      "Hagerstown Turnpike",
      "Miller's Cornfield",
      "East Woods",
      "Nicodemus Hill",
      "Bloody Lane",
      "Pry Ford",
      "Pry Grist Mill",
      "Pry House",
      "West Woods",
      "Dunker Church",
      "Burnside's Bridge",
      "Cooke's Countercharge",
      "Otto and Sherrick Farms",
      "Roulette Lane",
      "Piper Farm",
      "Hill's Counterattack"
    ],
    'Harpers Ferry': [
      "Maryland Heights",
      "River Crossing",
      "Downtown",
      "School House Ridge",
      "Bolivar Heights Camp",
      "High Street",
      "Shenandoah Street",
      "Harpers Ferry Graveyard",
      "Washington Street",
      "Bolivar Heights Redoubt"
    ],
    'South Mountain': [
      "Garland's Stand",
      "Cox's Push",
      "Hatch's Attack",
      "Anderson's Counterattack",
      "Reno's Fall",
      "Colquitt's Defense"
    ],
    'Drill Camp': [
      "Alexander Farm",
      "Crossroads",
      "Smith Field",
      "Crecy's Cornfield",
      "Crossley Creek",
      "Larsen Homestead",
      "South Woodlot",
      "Flemming's Meadow",
      "Wagon Road",
      "Union Camp",
      "Pat's Turnpike",
      "Stefan's Lot",
      "Confederate Encampment"
    ]
  };

  // Flatten all maps for the select dropdown
  const allMaps = Object.entries(mapsByMapset).flatMap(([mapset, maps]) => 
    maps.map(map => ({ name: map, mapset }))
  );

  useEffect(() => {
    if (existingCampaign?.customMap) {
      // Load existing custom map
      setTerritories(existingCampaign.customMap.territories);
      const allStates = new Set();
      existingCampaign.customMap.territories.forEach(t => {
        t.states.forEach(s => allStates.add(s));
      });
      setSelectedStates(allStates);
    }
  }, [existingCampaign]);

  const handleStateClick = (stateAbbr) => {
    const newSelected = new Set(selectedStates);
    
    if (newSelected.has(stateAbbr)) {
      // Remove state from selection and any territories
      newSelected.delete(stateAbbr);
      setTerritories(territories.filter(t => !t.states.includes(stateAbbr)));
    } else {
      // Add state to selection
      newSelected.add(stateAbbr);
      
      // Create a new territory for this state
      const state = usaStates.find(s => s.abbreviation === stateAbbr);
      const newTerritory = {
        id: `territory-${Date.now()}`,
        name: state.name,
        states: [stateAbbr],
        victoryPoints: 1,
        maps: [],
        initialOwner: 'Contested',
        isCapital: false,
        svgPath: state.svgPath,
        center: state.center
      };
      setTerritories([...territories, newTerritory]);
    }
    
    setSelectedStates(newSelected);
  };

  const handleTerritoryUpdate = (territoryId, field, value) => {
    setTerritories(territories.map(t => 
      t.id === territoryId ? { ...t, [field]: value } : t
    ));
  };

  const handleMergeStates = (territoryIds) => {
    if (territoryIds.length < 2) return;

    const territoriesToMerge = territories.filter(t => territoryIds.includes(t.id));
    const allStates = territoriesToMerge.flatMap(t => t.states);
    const mergedName = territoriesToMerge.map(t => t.name).join(' & ');

    const mergedTerritory = {
      id: `territory-${Date.now()}`,
      name: mergedName,
      states: allStates,
      victoryPoints: Math.max(...territoriesToMerge.map(t => t.victoryPoints)),
      maps: [...new Set(territoriesToMerge.flatMap(t => t.maps))],
      initialOwner: territoriesToMerge[0].initialOwner,
      isCapital: territoriesToMerge.some(t => t.isCapital),
      svgPath: combineStatePaths(allStates),
      center: calculateGroupCenter(allStates)
    };

    setTerritories([
      ...territories.filter(t => !territoryIds.includes(t.id)),
      mergedTerritory
    ]);
  };

  const handleDeleteTerritory = (territoryId) => {
    const territory = territories.find(t => t.id === territoryId);
    if (territory) {
      const newSelected = new Set(selectedStates);
      territory.states.forEach(s => newSelected.delete(s));
      setSelectedStates(newSelected);
      setTerritories(territories.filter(t => t.id !== territoryId));
    }
  };

  const handleReset = () => {
    setSelectedStates(new Set());
    setTerritories([]);
    setEditingTerritory(null);
  };

  const handleSave = () => {
    if (territories.length < 2) {
      alert('Please create at least 2 territories for your campaign.');
      return;
    }

    const customMap = {
      territories: territories.map(t => ({
        ...t,
        svgPath: combineStatePaths(t.states),
        center: calculateGroupCenter(t.states)
      }))
    };

    onSave(customMap);
  };

  const handleDragStart = (e, territoryId) => {
    setDraggedTerritory(territoryId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, territoryId) => {
    e.preventDefault();
    if (draggedTerritory && draggedTerritory !== territoryId) {
      const draggedIdx = territories.findIndex(t => t.id === draggedTerritory);
      const targetIdx = territories.findIndex(t => t.id === territoryId);
      
      if (draggedIdx !== -1 && targetIdx !== -1) {
        const newTerritories = [...territories];
        const [removed] = newTerritories.splice(draggedIdx, 1);
        newTerritories.splice(targetIdx, 0, removed);
        setTerritories(newTerritories);
      }
    }
  };

  const handleDragEnd = () => {
    setDraggedTerritory(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-lg w-full max-w-7xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-2xl font-bold text-amber-400">Custom Campaign Map Editor</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Map View */}
          <div className="flex-1 p-4 overflow-auto">
            <div className="bg-slate-800 rounded-lg p-4 h-full flex items-center justify-center">
              <svg
                viewBox="0 0 1000 589"
                className="w-full h-full"
                style={{ maxHeight: '100%', maxWidth: '100%' }}
              >
                {/* Render all states */}
                {usaStates.map(state => {
                  const isSelected = selectedStates.has(state.abbreviation);
                  const isHovered = hoveredState === state.abbreviation;
                  
                  return (
                    <path
                      key={state.abbreviation}
                      d={state.svgPath}
                      fill={isSelected ? '#fbbf24' : '#64748b'}
                      fillOpacity={isSelected ? 0.6 : 0.3}
                      stroke="#ffffff"
                      strokeWidth="1"
                      className="cursor-pointer transition-all duration-200"
                      style={{
                        filter: isHovered ? 'brightness(1.3)' : 'none'
                      }}
                      onClick={() => handleStateClick(state.abbreviation)}
                      onMouseEnter={() => setHoveredState(state.abbreviation)}
                      onMouseLeave={() => setHoveredState(null)}
                    />
                  );
                })}
              </svg>
            </div>
            
            {/* Instructions */}
            <div className="mt-4 p-3 bg-slate-800 rounded-lg text-sm text-slate-300">
              <p className="font-semibold text-amber-400 mb-2">Instructions:</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Click states to select/deselect them for your campaign</li>
                <li>Selected states appear in amber and create territories automatically</li>
                <li>Configure each territory in the right panel</li>
                <li>Drag territories to reorder them</li>
                <li>Create at least 2 territories before saving</li>
              </ul>
            </div>
          </div>

          {/* Territory Configuration Panel */}
          <div className="w-96 border-l border-slate-700 flex flex-col">
            <div className="p-4 border-b border-slate-700">
              <h3 className="text-lg font-semibold text-amber-400 mb-2">
                Territories ({territories.length})
              </h3>
              <p className="text-sm text-slate-400">
                {selectedStates.size} states selected
              </p>
            </div>

            {/* Territory List */}
            <div className="flex-1 overflow-auto p-4 space-y-3">
              {territories.length === 0 ? (
                <div className="text-center text-slate-400 py-8">
                  <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No territories yet</p>
                  <p className="text-sm mt-1">Click states on the map to begin</p>
                </div>
              ) : (
                territories.map((territory, index) => (
                  <div
                    key={territory.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, territory.id)}
                    onDragOver={(e) => handleDragOver(e, territory.id)}
                    onDragEnd={handleDragEnd}
                    className={`bg-slate-800 rounded-lg p-3 cursor-move ${
                      draggedTerritory === territory.id ? 'opacity-50' : ''
                    }`}
                  >
                    {/* Territory Header */}
                    <div className="flex items-start gap-2 mb-3">
                      <GripVertical className="w-5 h-5 text-slate-500 mt-1 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <input
                          type="text"
                          value={territory.name}
                          onChange={(e) => handleTerritoryUpdate(territory.id, 'name', e.target.value)}
                          className="w-full bg-slate-700 text-white px-2 py-1 rounded text-sm font-semibold"
                          placeholder="Territory Name"
                        />
                        <p className="text-xs text-slate-400 mt-1">
                          States: {territory.states.join(', ')}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteTerritory(territory.id)}
                        className="p-1 hover:bg-slate-700 rounded transition-colors flex-shrink-0"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>

                    {/* Victory Points */}
                    <div className="mb-3">
                      <label className="text-xs text-slate-400 block mb-1">
                        Victory Points: {territory.victoryPoints}
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="5"
                        value={territory.victoryPoints}
                        onChange={(e) => handleTerritoryUpdate(territory.id, 'victoryPoints', parseInt(e.target.value))}
                        className="w-full"
                      />
                    </div>

                    {/* Initial Owner */}
                    <div className="mb-3">
                      <label className="text-xs text-slate-400 block mb-1">Initial Owner</label>
                      <select
                        value={territory.initialOwner}
                        onChange={(e) => handleTerritoryUpdate(territory.id, 'initialOwner', e.target.value)}
                        className="w-full bg-slate-700 text-white px-2 py-1 rounded text-sm"
                      >
                        <option value="USA">USA</option>
                        <option value="CSA">CSA</option>
                        <option value="Contested">Contested</option>
                      </select>
                    </div>

                    {/* Assigned Maps */}
                    <div className="mb-3">
                      <label className="text-xs text-slate-400 block mb-1">Assigned Maps</label>
                      <select
                        multiple
                        value={territory.maps}
                        onChange={(e) => {
                          const selected = Array.from(e.target.selectedOptions, option => option.value);
                          handleTerritoryUpdate(territory.id, 'maps', selected);
                        }}
                        className="w-full bg-slate-700 text-white px-2 py-1 rounded text-sm h-32"
                      >
                        {Object.entries(mapsByMapset).map(([mapset, maps]) => (
                          <optgroup key={mapset} label={mapset}>
                            {maps.map(map => (
                              <option key={map} value={map}>{map}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                      <p className="text-xs text-slate-500 mt-1">
                        Hold Ctrl/Cmd to select multiple
                      </p>
                    </div>

                    {/* Capital Status */}
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={territory.isCapital}
                        onChange={(e) => handleTerritoryUpdate(territory.id, 'isCapital', e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-slate-300">Capital Territory</span>
                    </label>
                  </div>
                ))
              )}
            </div>

            {/* Action Buttons */}
            <div className="p-4 border-t border-slate-700 space-y-2">
              <button
                onClick={handleReset}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Reset All
              </button>
              <button
                onClick={handleSave}
                disabled={territories.length < 2}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed rounded-lg transition-colors font-semibold"
              >
                <Save className="w-4 h-4" />
                Save Custom Map
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapEditor;