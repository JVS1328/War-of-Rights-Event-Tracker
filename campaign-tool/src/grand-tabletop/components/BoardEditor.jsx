import { useState } from 'react';
import { X, Brush, MapPin, Trash2, Route, Check } from 'lucide-react';
import HexBoard from './HexBoard';
import { TERRAIN, MARKER_KIND, getCityByHex } from '../data/defaultBoard';

const TOOLS = {
  TERRAIN: 'terrain',
  MARKER:  'marker',
  RAIL:    'rail',
  DELETE:  'delete'
};

const BoardEditor = ({ board, onSave, onClose }) => {
  const [workingBoard, setWorkingBoard] = useState(board);
  const [tool, setTool] = useState(TOOLS.TERRAIN);
  const [terrainBrush, setTerrainBrush] = useState(TERRAIN.FIELD);
  const [markerKind, setMarkerKind] = useState(MARKER_KIND.CITY);
  const [markerOwner, setMarkerOwner] = useState('USA');
  const [markerName, setMarkerName] = useState('');
  const [railFrom, setRailFrom] = useState(null);
  const [selectedCity, setSelectedCity] = useState(null);

  const handleHexClick = (hexK) => {
    const city = getCityByHex(workingBoard, hexK);

    if (tool === TOOLS.TERRAIN) {
      const [q, r] = hexK.split(',').map(Number);
      setWorkingBoard(prev => ({
        ...prev,
        hexes: { ...prev.hexes, [hexK]: { ...prev.hexes[hexK], terrain: terrainBrush } }
      }));
      return;
    }

    if (tool === TOOLS.MARKER) {
      if (city) {
        setSelectedCity(city);
        return;
      }
      if (!markerName.trim()) {
        alert('Enter a marker name first.');
        return;
      }
      const [q, r] = hexK.split(',').map(Number);
      const id = `${markerKind}-${Date.now()}`;
      setWorkingBoard(prev => ({
        ...prev,
        cities: [...prev.cities, {
          id, name: markerName.trim(), kind: markerKind, owner: markerOwner,
          hexKey: hexK, q, r, garrison: 0
        }]
      }));
      setMarkerName('');
      return;
    }

    if (tool === TOOLS.RAIL) {
      if (!city) return;
      if (!railFrom) {
        setRailFrom(city.id);
        return;
      }
      if (railFrom === city.id) {
        setRailFrom(null);
        return;
      }
      const exists = workingBoard.rails.some(
        r => (r.from === railFrom && r.to === city.id) || (r.from === city.id && r.to === railFrom)
      );
      if (!exists) {
        setWorkingBoard(prev => ({
          ...prev,
          rails: [...prev.rails, { from: railFrom, to: city.id }]
        }));
      }
      setRailFrom(null);
      return;
    }

    if (tool === TOOLS.DELETE) {
      if (city) {
        setWorkingBoard(prev => ({
          ...prev,
          cities: prev.cities.filter(c => c.id !== city.id),
          rails: prev.rails.filter(r => r.from !== city.id && r.to !== city.id)
        }));
      }
      return;
    }
  };

  const updateSelectedCity = (patch) => {
    if (!selectedCity) return;
    setWorkingBoard(prev => ({
      ...prev,
      cities: prev.cities.map(c => c.id === selectedCity.id ? { ...c, ...patch } : c)
    }));
    setSelectedCity(prev => ({ ...prev, ...patch }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex flex-col">
      <div className="bg-slate-800 border-b border-slate-700 px-6 py-3 flex items-center justify-between">
        <h2 className="text-xl font-bold text-amber-400">Board Editor</h2>
        <div className="flex gap-2">
          <button
            onClick={() => onSave(workingBoard)}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded flex items-center gap-2"
          >
            <Check className="w-4 h-4" /> Save
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded flex items-center gap-2"
          >
            <X className="w-4 h-4" /> Cancel
          </button>
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Tool palette */}
        <div className="w-64 bg-slate-800 border-r border-slate-700 p-4 space-y-4 overflow-y-auto">
          <div>
            <div className="text-xs text-slate-400 mb-2 uppercase tracking-wide">Tool</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setTool(TOOLS.TERRAIN)}
                className={`px-3 py-2 text-sm rounded flex items-center justify-center gap-1 ${tool === TOOLS.TERRAIN ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
              >
                <Brush className="w-4 h-4" /> Terrain
              </button>
              <button
                onClick={() => setTool(TOOLS.MARKER)}
                className={`px-3 py-2 text-sm rounded flex items-center justify-center gap-1 ${tool === TOOLS.MARKER ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
              >
                <MapPin className="w-4 h-4" /> Marker
              </button>
              <button
                onClick={() => setTool(TOOLS.RAIL)}
                className={`px-3 py-2 text-sm rounded flex items-center justify-center gap-1 ${tool === TOOLS.RAIL ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
              >
                <Route className="w-4 h-4" /> Rail
              </button>
              <button
                onClick={() => setTool(TOOLS.DELETE)}
                className={`px-3 py-2 text-sm rounded flex items-center justify-center gap-1 ${tool === TOOLS.DELETE ? 'bg-red-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </div>
          </div>

          {tool === TOOLS.TERRAIN && (
            <div>
              <div className="text-xs text-slate-400 mb-2 uppercase tracking-wide">Terrain Brush</div>
              <div className="space-y-1">
                {Object.entries(TERRAIN).map(([k, v]) => (
                  <button
                    key={v}
                    onClick={() => setTerrainBrush(v)}
                    className={`w-full px-3 py-1.5 text-sm rounded text-left capitalize ${terrainBrush === v ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tool === TOOLS.MARKER && (
            <div className="space-y-3">
              <div>
                <div className="text-xs text-slate-400 mb-2 uppercase tracking-wide">Kind</div>
                <select
                  value={markerKind}
                  onChange={e => setMarkerKind(e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-700 text-white rounded text-sm"
                >
                  <option value="city">City</option>
                  <option value="fort">Fort</option>
                  <option value="station">Station</option>
                  <option value="capital">Capital</option>
                </select>
              </div>
              <div>
                <div className="text-xs text-slate-400 mb-2 uppercase tracking-wide">Owner</div>
                <select
                  value={markerOwner}
                  onChange={e => setMarkerOwner(e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-700 text-white rounded text-sm"
                >
                  <option value="USA">USA</option>
                  <option value="CSA">CSA</option>
                  <option value="NEUTRAL">Neutral</option>
                </select>
              </div>
              <div>
                <div className="text-xs text-slate-400 mb-2 uppercase tracking-wide">Name</div>
                <input
                  type="text"
                  value={markerName}
                  onChange={e => setMarkerName(e.target.value)}
                  placeholder="e.g. Richmond"
                  className="w-full px-2 py-1.5 bg-slate-700 text-white rounded text-sm"
                />
              </div>
              <p className="text-xs text-slate-400">Click an empty hex to place. Click an existing marker to edit.</p>
            </div>
          )}

          {tool === TOOLS.RAIL && (
            <div>
              <p className="text-xs text-slate-400">
                Click a city/fort/station to start a rail, then click another to connect.
              </p>
              {railFrom && (
                <p className="text-xs text-amber-400 mt-2">
                  From: {workingBoard.cities.find(c => c.id === railFrom)?.name}
                </p>
              )}
            </div>
          )}

          {tool === TOOLS.DELETE && (
            <p className="text-xs text-slate-400">Click a marker to remove it and its rail connections.</p>
          )}

          {selectedCity && (
            <div className="border-t border-slate-700 pt-4 space-y-2">
              <div className="text-xs text-slate-400 uppercase tracking-wide">Edit Marker</div>
              <input
                type="text"
                value={selectedCity.name}
                onChange={e => updateSelectedCity({ name: e.target.value })}
                className="w-full px-2 py-1.5 bg-slate-700 text-white rounded text-sm"
              />
              <select
                value={selectedCity.kind}
                onChange={e => updateSelectedCity({ kind: e.target.value })}
                className="w-full px-2 py-1.5 bg-slate-700 text-white rounded text-sm"
              >
                <option value="city">City</option>
                <option value="fort">Fort</option>
                <option value="station">Station</option>
                <option value="capital">Capital</option>
              </select>
              <select
                value={selectedCity.owner}
                onChange={e => updateSelectedCity({ owner: e.target.value })}
                className="w-full px-2 py-1.5 bg-slate-700 text-white rounded text-sm"
              >
                <option value="USA">USA</option>
                <option value="CSA">CSA</option>
                <option value="NEUTRAL">Neutral</option>
              </select>
              <button
                onClick={() => setSelectedCity(null)}
                className="w-full px-2 py-1.5 bg-slate-600 hover:bg-slate-500 text-white rounded text-sm"
              >
                Done
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 relative">
          <HexBoard
            board={workingBoard}
            onHexClick={handleHexClick}
            editorMode
          />
        </div>
      </div>
    </div>
  );
};

export default BoardEditor;
