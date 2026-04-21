import { useState, useMemo } from 'react';
import { Swords, X, Shield, Users } from 'lucide-react';
import { findAttackTargets, findSupporters } from '../utils/grandCampaignLogic';

/**
 * GrandBattleModal — initiate a Grand Campaign attack.
 *
 * Steps (shown on one screen for speed):
 *   1. Pick the target — any enemy token adjacent to the current attacker.
 *   2. (Optional) Pick ONE attacker supporter, within support range of the attacker.
 *   3. (Optional) Pick ONE defender supporter, within support range of the target.
 *   4. Enter a map name (free-text for now — map decks come later).
 *   5. Create Battle → creates a pending battle, ends the attacker's turn.
 */
const GrandBattleModal = ({ campaign, onCreate, onCancel }) => {
  const gc = campaign?.grandCampaign;
  const attackerId = gc?.currentTokenId;
  const attacker = gc?.tokens.find(t => t.id === attackerId);

  const [targetId, setTargetId] = useState(null);
  const [attackerSupportId, setAttackerSupportId] = useState(null);
  const [defenderSupportId, setDefenderSupportId] = useState(null);
  const [mapName, setMapName] = useState('');

  const targets = useMemo(
    () => attackerId ? findAttackTargets(campaign, attackerId) : [],
    [campaign, attackerId]
  );
  const attackerSupports = useMemo(
    () => attackerId ? findSupporters(campaign, attackerId, [targetId].filter(Boolean)) : [],
    [campaign, attackerId, targetId]
  );
  const defenderSupports = useMemo(
    () => targetId ? findSupporters(campaign, targetId, [attackerSupportId].filter(Boolean)) : [],
    [campaign, targetId, attackerSupportId]
  );

  if (!attacker) return null;

  const canCreate = !!targetId && mapName.trim().length > 0;

  const commit = () => {
    if (!canCreate) return;
    onCreate({
      attackerId,
      defenderId: targetId,
      attackerSupportId: attackerSupportId || null,
      defenderSupportId: defenderSupportId || null,
      mapName: mapName.trim(),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border-2 border-red-600 rounded-lg p-5 max-w-lg w-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-red-400 flex items-center gap-2">
            <Swords className="w-5 h-5" /> Declare Attack
          </h3>
          <button onClick={onCancel} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        <div className="bg-slate-900 rounded p-3 mb-3 text-sm">
          Attacking with: <span className={`font-bold ${attacker.side === 'USA' ? 'text-blue-400' : 'text-red-400'}`}>{attacker.name}</span>
          <span className="ml-2 text-xs text-slate-400">MP: {attacker.manpower} · Fat: {attacker.fatigue}</span>
        </div>

        {/* Target */}
        <div className="mb-3">
          <div className="text-xs font-semibold text-slate-300 mb-1">Target (adjacent enemy)</div>
          {targets.length === 0 ? (
            <div className="text-xs text-slate-500 italic bg-slate-900 rounded p-2">No enemy tokens in range.</div>
          ) : (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {targets.map(t => (
                <button
                  key={t.id}
                  onClick={() => { setTargetId(t.id); setDefenderSupportId(null); }}
                  className={`w-full text-left p-2 rounded text-xs flex items-center justify-between border ${
                    targetId === t.id ? 'border-amber-400 bg-amber-900/30' : 'border-slate-700 bg-slate-900 hover:bg-slate-700'
                  }`}
                >
                  <span className={`font-semibold ${t.side === 'USA' ? 'text-blue-400' : 'text-red-400'}`}>{t.name}</span>
                  <span className="text-slate-400">MP: {t.manpower} · Fat: {t.fatigue}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Attacker support */}
        {targetId && (
          <div className="mb-3">
            <div className="text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
              <Shield className="w-3 h-3" /> Attacker supporter (optional, one only)
            </div>
            <select
              value={attackerSupportId || ''}
              onChange={e => setAttackerSupportId(e.target.value || null)}
              className="w-full bg-slate-900 text-white px-2 py-1.5 rounded text-xs"
            >
              <option value="">— none —</option>
              {attackerSupports.map(t => (
                <option key={t.id} value={t.id}>{t.name} (MP {t.manpower})</option>
              ))}
            </select>
          </div>
        )}

        {/* Defender support */}
        {targetId && (
          <div className="mb-3">
            <div className="text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
              <Users className="w-3 h-3" /> Defender supporter (optional, one only)
            </div>
            <select
              value={defenderSupportId || ''}
              onChange={e => setDefenderSupportId(e.target.value || null)}
              className="w-full bg-slate-900 text-white px-2 py-1.5 rounded text-xs"
            >
              <option value="">— none —</option>
              {defenderSupports.map(t => (
                <option key={t.id} value={t.id}>{t.name} (MP {t.manpower})</option>
              ))}
            </select>
          </div>
        )}

        {/* Map */}
        {targetId && (
          <div className="mb-3">
            <div className="text-xs font-semibold text-slate-300 mb-1">Map</div>
            <input
              value={mapName}
              onChange={e => setMapName(e.target.value)}
              placeholder="e.g. Dunker Church"
              className="w-full bg-slate-900 text-white px-2 py-1.5 rounded text-xs"
            />
          </div>
        )}

        <div className="flex gap-2 mt-4">
          <button onClick={onCancel} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white rounded py-2 text-sm">
            Cancel
          </button>
          <button
            onClick={commit}
            disabled={!canCreate}
            className="flex-1 bg-red-700 hover:bg-red-600 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded py-2 text-sm font-semibold"
          >
            Create Battle & End Turn
          </button>
        </div>
      </div>
    </div>
  );
};

export default GrandBattleModal;
