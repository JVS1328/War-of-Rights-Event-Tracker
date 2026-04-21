import { useState } from 'react';
import { X, Plus, Trash2, Edit3 } from 'lucide-react';

const UnitRegistry = ({ campaign, onUpdate, onClose }) => {
  const [newName, setNewName] = useState('');
  const [newFaction, setNewFaction] = useState('USA');
  const [editingId, setEditingId] = useState(null);

  const addUnit = () => {
    if (!newName.trim()) return;
    const unit = {
      id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: newName.trim(),
      faction: newFaction,
      manpower: campaign.settings.manpowerPerToken,
      fatigue: 0,
      hexKey: null,
      lastStand: false,
      wiped: false,
      onTrain: false,
      onRiver: false,
      engagedBattleId: null,
      remainingMP: campaign.settings.mpPerTurn,
      currentMode: null,
      turnActedThisDraw: false
    };
    onUpdate({ ...campaign, units: [...campaign.units, unit] });
    setNewName('');
  };

  const renameUnit = (id, name) => {
    onUpdate({
      ...campaign,
      units: campaign.units.map(u => u.id === id ? { ...u, name } : u)
    });
  };

  const updateField = (id, field, value) => {
    onUpdate({
      ...campaign,
      units: campaign.units.map(u => u.id === id ? { ...u, [field]: Number(value) } : u)
    });
  };

  const removeUnit = (id) => {
    if (!confirm('Remove this unit?')) return;
    onUpdate({
      ...campaign,
      units: campaign.units.filter(u => u.id !== id)
    });
  };

  const usaUnits = campaign.units.filter(u => u.faction === 'USA');
  const csaUnits = campaign.units.filter(u => u.faction === 'CSA');
  const mercUnits = campaign.units.filter(u => !u.faction);

  const renderList = (units, label, color) => (
    <div>
      <h3 className={`text-sm font-semibold uppercase mb-2 ${color}`}>{label} ({units.length})</h3>
      <div className="space-y-1">
        {units.map(u => (
          <div key={u.id} className="bg-slate-700 rounded px-3 py-2 flex items-center gap-2 text-sm">
            {editingId === u.id ? (
              <input
                autoFocus
                type="text"
                value={u.name}
                onChange={e => renameUnit(u.id, e.target.value)}
                onBlur={() => setEditingId(null)}
                onKeyDown={e => e.key === 'Enter' && setEditingId(null)}
                className="flex-1 px-2 py-0.5 bg-slate-900 text-white rounded"
              />
            ) : (
              <span className="flex-1 text-white font-medium">{u.name}</span>
            )}
            <input
              type="number"
              value={u.manpower}
              onChange={e => updateField(u.id, 'manpower', e.target.value)}
              className="w-20 px-2 py-0.5 bg-slate-900 text-amber-300 rounded text-xs"
              title="Manpower"
            />
            <input
              type="number"
              value={u.fatigue}
              onChange={e => updateField(u.id, 'fatigue', e.target.value)}
              className="w-14 px-2 py-0.5 bg-slate-900 text-orange-300 rounded text-xs"
              title="Fatigue"
            />
            {u.wiped && <span className="text-red-400 text-xs">WIPED</span>}
            {u.lastStand && <span className="text-orange-400 text-xs">LS</span>}
            {u.hexKey && <span className="text-slate-400 text-xs">@{u.hexKey}</span>}
            <button onClick={() => setEditingId(u.id)} className="p-1 text-slate-400 hover:text-white" title="Rename">
              <Edit3 className="w-3 h-3" />
            </button>
            <button onClick={() => removeUnit(u.id)} className="p-1 text-red-400 hover:text-red-300">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
        {units.length === 0 && <div className="text-slate-500 text-xs italic">None.</div>}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg border border-slate-700 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-2xl font-bold text-amber-400">Unit Registry</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-slate-900 rounded p-4 flex gap-2 items-end">
            <div className="flex-1">
              <div className="text-xs text-slate-400 mb-1 uppercase tracking-wide">Unit Name</div>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addUnit()}
                placeholder="e.g. 42nd PA"
                className="w-full px-3 py-1.5 bg-slate-700 text-white rounded"
              />
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1 uppercase tracking-wide">Faction</div>
              <select
                value={newFaction}
                onChange={e => setNewFaction(e.target.value)}
                className="px-2 py-1.5 bg-slate-700 text-white rounded"
              >
                <option value="USA">USA</option>
                <option value="CSA">CSA</option>
              </select>
            </div>
            <button
              onClick={addUnit}
              className="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded flex items-center gap-1"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>

          {renderList(usaUnits, 'USA Units', 'text-blue-400')}
          {renderList(csaUnits, 'CSA Units', 'text-red-400')}
          {mercUnits.length > 0 && renderList(mercUnits, 'Merc Units (no faction)', 'text-slate-400')}

          <div className="text-xs text-slate-400 border-t border-slate-700 pt-3">
            Units with no faction are Merc tokens (controlled by the whole faction they're placed for).
            Edit manpower/fatigue inline. Units can be added mid-campaign.
          </div>
        </div>

        <div className="p-6 border-t border-slate-700 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded">Done</button>
        </div>
      </div>
    </div>
  );
};

export default UnitRegistry;
