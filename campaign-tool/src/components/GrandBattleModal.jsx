import { useState, useMemo, useEffect } from 'react';
import { Swords, X, Shield, Users, Map as MapIcon } from 'lucide-react';
import {
  findAttackTargets,
  findSupporters,
  findTerritoryAtSvgPoint,
  describeBattleLocation,
} from '../utils/grandCampaignLogic';
import {
  getAvailableMapsForTerritory,
  selectMapsForPickBan,
} from '../utils/mapSelection';

/**
 * GrandBattleModal — two-step attack initiator.
 *
 *   Step 1: pick target + optional supporter per side.
 *   Step 2: map pick/ban per GC rules — 3 map cards drawn from the map pool
 *           for the territory the defender is standing in (falls back to the
 *           global pool when no territory can be resolved). Defender bans 1,
 *           attacker picks 1 of the remaining 2. That map is committed.
 */
const GrandBattleModal = ({ campaign, onCreate, onCancel }) => {
  const gc = campaign?.grandCampaign;
  const attackerId = gc?.currentTokenId;
  const attacker = gc?.tokens.find(t => t.id === attackerId);

  const [step, setStep] = useState(1); // 1 = targeting, 2 = pick/ban
  const [targetId, setTargetId] = useState(null);
  const [attackerSupportId, setAttackerSupportId] = useState(null);
  const [defenderSupportId, setDefenderSupportId] = useState(null);

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

  // Defender-side derived info for map pool selection & location label.
  const defender = useMemo(
    () => targetId ? gc.tokens.find(t => t.id === targetId) : null,
    [gc, targetId]
  );
  const defenderTerritory = useMemo(
    () => defender?.position ? findTerritoryAtSvgPoint(campaign, defender.position) : null,
    [campaign, defender]
  );
  const locationLabel = useMemo(
    () => defender?.position ? describeBattleLocation(campaign, defender.position) : null,
    [campaign, defender]
  );

  // Draw 3 maps when we enter step 2.
  const [mapCards, setMapCards] = useState([]);        // 3 drawn maps
  const [bannedMap, setBannedMap] = useState(null);    // chosen by defender
  const [pickedMap, setPickedMap] = useState(null);    // chosen by attacker

  // Draw maps once the first time step 2 becomes active and targetId is set.
  useEffect(() => {
    if (step !== 2 || mapCards.length > 0 || !targetId) return;
    const territory = defenderTerritory;
    const terrainGroups = campaign.settings?.terrainGroups || {};
    const mapCooldownTurns = campaign.settings?.mapCooldownTurns ?? 2;
    const { availableMaps } = getAvailableMapsForTerritory(
      territory || { maps: null, terrainGroup: null },
      campaign.battles,
      campaign.currentTurn,
      terrainGroups,
      mapCooldownTurns
    );
    setMapCards(selectMapsForPickBan(availableMaps, 3));
  }, [step, targetId, defenderTerritory, campaign, mapCards.length]);

  if (!attacker) return null;

  const commit = () => {
    if (!pickedMap || !targetId) return;
    onCreate({
      attackerId,
      defenderId: targetId,
      attackerSupportId: attackerSupportId || null,
      defenderSupportId: defenderSupportId || null,
      mapName: pickedMap,
    });
  };

  const advanceToPickBan = () => {
    if (!targetId) return;
    setStep(2);
  };
  const reset = () => {
    setBannedMap(null);
    setPickedMap(null);
    setMapCards([]);
    setStep(1);
  };

  // ---------- Render ----------

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border-2 border-red-600 rounded-lg p-5 max-w-lg w-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-red-400 flex items-center gap-2">
            <Swords className="w-5 h-5" /> {step === 1 ? 'Declare Attack' : 'Map Pick / Ban'}
          </h3>
          <button onClick={onCancel} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        <div className="bg-slate-900 rounded p-3 mb-3 text-sm">
          Attacking with: <span className={`font-bold ${attacker.side === 'USA' ? 'text-blue-400' : 'text-red-400'}`}>{attacker.name}</span>
          <span className="ml-2 text-xs text-slate-400">MP: {attacker.manpower} · Fat: {attacker.fatigue}</span>
          {step === 2 && defender && (
            <div className="text-xs text-slate-300 mt-1">
              vs <span className={`font-bold ${defender.side === 'USA' ? 'text-blue-400' : 'text-red-400'}`}>{defender.name}</span>
              {locationLabel && <span className="text-slate-400"> — {locationLabel}</span>}
            </div>
          )}
        </div>

        {step === 1 && (
          <>
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

            {targetId && (
              <>
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
              </>
            )}

            <div className="flex gap-2 mt-4">
              <button onClick={onCancel} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white rounded py-2 text-sm">Cancel</button>
              <button
                onClick={advanceToPickBan}
                disabled={!targetId}
                className="flex-1 bg-red-700 hover:bg-red-600 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded py-2 text-sm font-semibold flex items-center justify-center gap-1"
              >
                <MapIcon className="w-4 h-4" /> Next: Pick Map
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="text-[11px] text-slate-400 mb-2">
              Map pool: {defenderTerritory ? (
                <>from <span className="text-amber-300">{defenderTerritory.name}</span>'s deck</>
              ) : <span className="text-slate-500">global pool (no territory resolved)</span>}
              {campaign.settings?.mapCooldownTurns > 0 && <> · cooldown {campaign.settings.mapCooldownTurns} turns</>}
            </div>

            {mapCards.length === 0 ? (
              <div className="bg-slate-900 rounded p-3 text-xs text-slate-400 italic">
                No maps available from this pool right now (all on cooldown). Go back and pick a different target, or wait for maps to clear.
              </div>
            ) : (
              <>
                <div className="mb-3">
                  <div className="text-xs font-semibold mb-2">
                    {!bannedMap
                      ? <span className="text-blue-300">Defender bans 1 of {mapCards.length}</span>
                      : !pickedMap
                        ? <span className="text-red-300">Attacker picks 1 of the remaining {mapCards.length - 1}</span>
                        : <span className="text-green-400">Map locked in</span>}
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {mapCards.map(m => {
                      const isBanned = bannedMap === m;
                      const isPicked = pickedMap === m;
                      const selectableByDefender = !bannedMap;
                      const selectableByAttacker = bannedMap && !pickedMap && !isBanned;
                      const handler = () => {
                        if (selectableByDefender) setBannedMap(m);
                        else if (selectableByAttacker) setPickedMap(m);
                      };
                      const state = isBanned
                        ? 'bg-slate-900 border-slate-700 text-slate-500 line-through'
                        : isPicked
                          ? 'bg-green-800/30 border-green-400 text-green-200'
                          : selectableByDefender
                            ? 'bg-slate-700 border-blue-600 hover:bg-blue-900/40 text-white'
                            : selectableByAttacker
                              ? 'bg-slate-700 border-red-600 hover:bg-red-900/40 text-white'
                              : 'bg-slate-700 border-slate-600 text-slate-400';
                      return (
                        <button
                          key={m}
                          onClick={handler}
                          disabled={isBanned || (!selectableByDefender && !selectableByAttacker && !isPicked)}
                          className={`p-2 rounded border-2 text-sm font-semibold text-left ${state}`}
                        >
                          {isBanned && <span className="text-[10px] text-red-400 mr-2">BANNED</span>}
                          {isPicked && <span className="text-[10px] text-green-400 mr-2">PICKED</span>}
                          {m}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            <div className="flex gap-2 mt-4">
              <button onClick={reset} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white rounded py-2 text-sm">
                Back
              </button>
              <button onClick={onCancel} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white rounded py-2 text-sm">
                Cancel
              </button>
              <button
                onClick={commit}
                disabled={!pickedMap}
                className="flex-1 bg-red-700 hover:bg-red-600 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded py-2 text-sm font-semibold"
              >
                Confirm &amp; End Turn
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default GrandBattleModal;
