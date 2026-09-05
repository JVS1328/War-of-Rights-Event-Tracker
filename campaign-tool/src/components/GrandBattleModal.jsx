import { useState, useMemo, useEffect } from 'react';
import { Swords, X, Shield, Users, Map as MapIcon, Cloud, Sun, Moon, CloudRain, Dice6, Trees, Coins } from 'lucide-react';
import {
  findAttackTargets,
  findSupporters,
  findTerritoryAtSvgPoint,
  describeBattleLocation,
} from '../utils/grandCampaignLogic';
import {
  getAvailableMapsForTerritory,
  selectMapsForPickBan,
  rollTerrainType,
  resolveTerrainMaps,
  isConquestMap,
} from '../utils/mapSelection';
import {
  rollWeatherCondition,
  rollTimeCondition,
  WEATHER_CONDITIONS,
  TIME_CONDITIONS,
} from '../utils/battleConditions';

const SIDE_TAG = (side) =>
  side === 'USA'
    ? <span className="ml-1 text-[10px] font-bold text-union-400">(USA)</span>
    : <span className="ml-1 text-[10px] font-bold text-rebel-400">(CSA)</span>;

const weatherIcon = (id) => {
  if (id === 'clear') return <Sun className="w-4 h-4 text-brass-300" />;
  if (id === 'rain') return <CloudRain className="w-4 h-4 text-sky-300" />;
  return <Cloud className="w-4 h-4 text-mist-300" />;
};
const timeIcon = (id) => {
  if (id === 'night') return <Moon className="w-4 h-4 text-indigo-300" />;
  if (id === 'dawn') return <Sun className="w-4 h-4 text-brass-300" />;
  if (id === 'dusk') return <Sun className="w-4 h-4 text-orange-400" />;
  return <Sun className="w-4 h-4 text-yellow-300" />;
};

/**
 * GrandBattleModal — two-step attack initiator.
 *
 *   Step 1: pick target + optional supporter per side.
 *   Step 2: roll terrain + weather + time, draw 3 maps from that terrain's
 *           deck (honouring the campaign map cooldown), defender bans 1,
 *           attacker picks 1. That map + all three rolls are committed to
 *           the pending battle.
 */
const GrandBattleModal = ({ campaign, onCreate, onCancel }) => {
  const gc = campaign?.grandCampaign;
  const attackerId = gc?.currentTokenId;
  const attacker = gc?.tokens.find(t => t.id === attackerId);

  const [step, setStep] = useState(1);
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

  // Terrain / weather / time roll state
  const [terrainResult, setTerrainResult] = useState(null);    // { terrainType, roll, total }
  const [weatherResult, setWeatherResult] = useState(null);    // { condition, weight, total }
  const [timeResult, setTimeResult] = useState(null);
  const [mapCards, setMapCards] = useState([]);
  const [cooldownMaps, setCooldownMaps] = useState(new Map());
  const [bannedMap, setBannedMap] = useState(null);
  const [pickedMap, setPickedMap] = useState(null);

  // Conquest is auto-derived from the picked map against the campaign's
  // terrain groups (maps that live in any "*Conquest" group). A sides-swap
  // coin is flipped automatically the first time a conquest map is picked.
  const terrainGroupsForConquest = campaign.settings?.terrainGroups || {};
  const isConquest = pickedMap ? isConquestMap(pickedMap, terrainGroupsForConquest) : false;
  const [sidesSwapped, setSidesSwapped] = useState(false);
  const [conquestFlipForMap, setConquestFlipForMap] = useState(null);

  const terrainWeights = defenderTerritory?.terrainWeights;
  const terrainGroups = campaign.settings?.terrainGroups || {};
  const mapCooldownTurns = campaign.settings?.mapCooldownTurns ?? 2;

  // Kick off all three rolls once, the first time step 2 opens.
  useEffect(() => {
    if (step !== 2) return;
    if (!terrainResult && terrainWeights) {
      setTerrainResult(rollTerrainType(terrainWeights));
    }
    if (!weatherResult) {
      setWeatherResult(rollWeatherCondition(campaign.settings?.weatherWeights));
    }
    if (!timeResult) {
      setTimeResult(rollTimeCondition(campaign.settings?.timeWeights));
    }
  }, [step, terrainResult, terrainWeights, weatherResult, timeResult, campaign]);

  // Recompute map pool whenever the terrain roll changes.
  useEffect(() => {
    if (step !== 2) return;
    const rolledTerrainType = terrainResult?.terrainType || null;
    // Resolve the map pool using the rolled terrain type; falls back to
    // territory.maps / territory.terrainGroup / ALL_MAPS inside the util.
    const pool = resolveTerrainMaps(
      defenderTerritory || { maps: null, terrainGroup: null },
      terrainGroups,
      rolledTerrainType
    );
    // Apply cooldown using the shared helper — pass a pseudo-territory with
    // explicit maps so it respects our rolled pool, and reuse its cooldown map.
    const { availableMaps, cooldownMaps: cdMap } = getAvailableMapsForTerritory(
      { maps: pool },
      campaign.battles,
      campaign.currentTurn,
      terrainGroups,
      mapCooldownTurns
    );
    setMapCards(selectMapsForPickBan(availableMaps, 3));
    setCooldownMaps(cdMap);
    setBannedMap(null);
    setPickedMap(null);
  }, [step, terrainResult, defenderTerritory, terrainGroups, mapCooldownTurns, campaign.battles, campaign.currentTurn]);

  if (!attacker) return null;

  const commit = () => {
    if (!pickedMap || !targetId) return;
    onCreate({
      attackerId,
      defenderId: targetId,
      attackerSupportId: attackerSupportId || null,
      defenderSupportId: defenderSupportId || null,
      mapName: pickedMap,
      terrainType: terrainResult?.terrainType || null,
      weather: weatherResult ? {
        id: weatherResult.condition.id,
        name: weatherResult.condition.name,
      } : null,
      time: timeResult ? {
        id: timeResult.condition.id,
        name: timeResult.condition.name,
      } : null,
      isConquest,
      sidesSwapped: isConquest ? sidesSwapped : false,
    });
  };

  // Auto-flip the sides-swap coin the first time we land on a particular
  // conquest map. Changing to a different conquest map reflips; switching
  // away and back also reflips. Re-flip button lets the player reroll.
  useEffect(() => {
    if (!isConquest) {
      if (conquestFlipForMap !== null) setConquestFlipForMap(null);
      return;
    }
    if (conquestFlipForMap !== pickedMap) {
      setSidesSwapped(Math.random() < 0.5);
      setConquestFlipForMap(pickedMap);
    }
  }, [isConquest, pickedMap, conquestFlipForMap]);
  const reflipConquest = () => setSidesSwapped(Math.random() < 0.5);

  const reset = () => {
    setBannedMap(null);
    setPickedMap(null);
    setMapCards([]);
    setTerrainResult(null);
    setWeatherResult(null);
    setTimeResult(null);
    setStep(1);
  };

  // ---------- Render ----------
  const terrainOptions = terrainWeights ? Object.keys(terrainWeights) : [];

  return (
    <div className="ui-modal-backdrop">
      <div className="ui-modal border-rebel-500/50 p-4 sm:p-5 max-w-lg max-h-[92dvh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-rebel-400 flex items-center gap-2">
            <Swords className="w-5 h-5" /> {step === 1 ? 'Declare Attack' : 'Conditions & Map'}
          </h3>
          <button onClick={onCancel} className="text-mist-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        <div className="bg-ink-900 rounded p-3 mb-3 text-sm">
          Attacking with: <span className={`font-bold ${attacker.side === 'USA' ? 'text-union-400' : 'text-rebel-400'}`}>{attacker.name}</span>{SIDE_TAG(attacker.side)}
          <span className="ml-2 text-xs text-mist-400">MP: {attacker.manpower} · Fat: {attacker.fatigue}</span>
          {step === 2 && defender && (
            <div className="text-xs text-mist-300 mt-1">
              vs <span className={`font-bold ${defender.side === 'USA' ? 'text-union-400' : 'text-rebel-400'}`}>{defender.name}</span>{SIDE_TAG(defender.side)}
              {locationLabel && <span className="text-mist-400"> — {locationLabel}</span>}
            </div>
          )}
        </div>

        {step === 1 && (
          <>
            <div className="mb-3">
              <div className="text-xs font-semibold text-mist-300 mb-1">Target (adjacent enemy)</div>
              {targets.length === 0 ? (
                <div className="text-xs text-mist-500 italic bg-ink-900 rounded p-2">No enemy tokens in range.</div>
              ) : (
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {targets.map(t => (
                    <button
                      key={t.id}
                      onClick={() => { setTargetId(t.id); setDefenderSupportId(null); }}
                      className={`w-full text-left p-2 rounded text-xs flex items-center justify-between border ${
                        targetId === t.id ? 'border-brass-400 bg-brass-900/30' : 'border-ink-800 bg-ink-900 hover:bg-ink-800'
                      }`}
                    >
                      <span>
                        <span className={`font-semibold ${t.side === 'USA' ? 'text-union-400' : 'text-rebel-400'}`}>{t.name}</span>
                        {SIDE_TAG(t.side)}
                      </span>
                      <span className="text-mist-400">MP: {t.manpower} · Fat: {t.fatigue}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {targetId && (
              <>
                <div className="mb-3">
                  <div className="text-xs font-semibold text-mist-300 mb-1 flex items-center gap-1">
                    <Shield className="w-3 h-3" /> Attacker supporter (optional, one only)
                  </div>
                  <select
                    value={attackerSupportId || ''}
                    onChange={e => setAttackerSupportId(e.target.value || null)}
                    className="w-full bg-ink-900 text-white px-2 py-1.5 rounded text-xs"
                  >
                    <option value="">— none —</option>
                    {attackerSupports.map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.side}) — MP {t.manpower}</option>
                    ))}
                  </select>
                </div>

                <div className="mb-3">
                  <div className="text-xs font-semibold text-mist-300 mb-1 flex items-center gap-1">
                    <Users className="w-3 h-3" /> Defender supporter (optional, one only)
                  </div>
                  <select
                    value={defenderSupportId || ''}
                    onChange={e => setDefenderSupportId(e.target.value || null)}
                    className="w-full bg-ink-900 text-white px-2 py-1.5 rounded text-xs"
                  >
                    <option value="">— none —</option>
                    {defenderSupports.map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.side}) — MP {t.manpower}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div className="flex gap-2 mt-4">
              <button onClick={onCancel} className="flex-1 bg-ink-800 hover:bg-ink-700 text-white rounded py-2 text-sm">Cancel</button>
              <button
                onClick={() => setStep(2)}
                disabled={!targetId}
                className="flex-1 bg-rebel-500 hover:bg-rebel-500 disabled:bg-ink-800 disabled:text-mist-500 text-white rounded py-2 text-sm font-semibold flex items-center justify-center gap-1"
              >
                <MapIcon className="w-4 h-4" /> Next: Roll & Pick Map
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            {/* Conquest auto-detected from the picked map. When active the
                sides-swap coin is rolled on the fly; the player can re-flip
                or leave it. Draws are permitted only on conquest maps. */}
            {isConquest && (
              <div className="bg-brass-900/30 border border-brass-500 rounded p-3 mb-3">
                <div className="flex items-center gap-2 text-xs text-brass-300">
                  <Coins className="w-3.5 h-3.5 text-brass-400" />
                  <span className="font-semibold">Conquest map detected</span>
                  <span className="text-[10px] text-mist-400">— draws allowed, split payout</span>
                </div>
                <div className="mt-2 flex items-center gap-2 text-[11px]">
                  <span className="text-mist-400">Coin flip:</span>
                  <span className={`font-bold ${sidesSwapped ? 'text-orange-300' : 'text-green-300'}`}>
                    {sidesSwapped ? 'TAILS — sides swapped' : 'HEADS — normal sides'}
                  </span>
                  <button
                    onClick={reflipConquest}
                    className="ml-auto bg-brass-500 hover:bg-brass-500 text-white rounded px-2 py-0.5 text-[10px] flex items-center gap-1"
                  >
                    <Dice6 className="w-3 h-3" /> Re-flip
                  </button>
                </div>
              </div>
            )}

            {/* Terrain roll */}
            <div className="bg-ink-900 rounded p-3 mb-3">
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-xs font-semibold text-mist-300 flex items-center gap-1">
                  <Trees className="w-3 h-3" /> Terrain
                </div>
                <button
                  onClick={() => terrainWeights && setTerrainResult(rollTerrainType(terrainWeights))}
                  disabled={!terrainWeights}
                  className="ui-btn ui-btn-primary ui-btn-sm"
                >
                  <Dice6 className="w-3 h-3" /> {terrainResult ? 'Re-roll' : 'Roll'}
                </button>
              </div>
              {!terrainWeights ? (
                <div className="text-[11px] text-mist-500 italic">Defender's territory has no terrain weights — map pool falls back to the territory's own maps / global pool.</div>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-brass-300">
                    {terrainResult?.terrainType || '—'}
                  </span>
                  {/* Manual override dropdown */}
                  <select
                    value={terrainResult?.terrainType || ''}
                    onChange={e => setTerrainResult(e.target.value ? { terrainType: e.target.value, roll: 0, total: 0 } : null)}
                    className="bg-ink-850 text-white text-xs rounded px-1.5 py-0.5"
                  >
                    <option value="">— pick —</option>
                    {terrainOptions.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {terrainResult && terrainResult.total > 0 && (
                    <span className="text-[10px] text-mist-500">rolled {terrainResult.roll.toFixed(1)} of {terrainResult.total}</span>
                  )}
                </div>
              )}
            </div>

            {/* Weather + Time rolls side by side */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-ink-900 rounded p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="text-xs font-semibold text-mist-300 flex items-center gap-1">
                    {weatherIcon(weatherResult?.condition?.id)} Weather
                  </div>
                  <button
                    onClick={() => setWeatherResult(rollWeatherCondition(campaign.settings?.weatherWeights))}
                    className="ui-btn ui-btn-primary ui-btn-sm"
                  >
                    <Dice6 className="w-3 h-3" /> {weatherResult ? 'Re-roll' : 'Roll'}
                  </button>
                </div>
                <div className="text-sm font-semibold text-brass-300">
                  {weatherResult?.condition?.name || '—'}
                </div>
                <select
                  value={weatherResult?.condition?.id || ''}
                  onChange={e => e.target.value && setWeatherResult({ condition: WEATHER_CONDITIONS[e.target.value], weight: 0, total: 0 })}
                  className="mt-1 bg-ink-850 text-white text-xs rounded px-1.5 py-0.5 w-full"
                >
                  <option value="">— pick —</option>
                  {Object.values(WEATHER_CONDITIONS).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="bg-ink-900 rounded p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="text-xs font-semibold text-mist-300 flex items-center gap-1">
                    {timeIcon(timeResult?.condition?.id)} Time
                  </div>
                  <button
                    onClick={() => setTimeResult(rollTimeCondition(campaign.settings?.timeWeights))}
                    className="ui-btn ui-btn-primary ui-btn-sm"
                  >
                    <Dice6 className="w-3 h-3" /> {timeResult ? 'Re-roll' : 'Roll'}
                  </button>
                </div>
                <div className="text-sm font-semibold text-brass-300">
                  {timeResult?.condition?.name || '—'}
                </div>
                <select
                  value={timeResult?.condition?.id || ''}
                  onChange={e => e.target.value && setTimeResult({ condition: TIME_CONDITIONS[e.target.value], weight: 0, total: 0 })}
                  className="mt-1 bg-ink-850 text-white text-xs rounded px-1.5 py-0.5 w-full"
                >
                  <option value="">— pick —</option>
                  {Object.values(TIME_CONDITIONS).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            {/* Map pool info + cards */}
            <div className="text-[11px] text-mist-400 mb-2">
              Pool: {defenderTerritory ? (
                <>terrain deck <span className="text-brass-300">{terrainResult?.terrainType || '—'}</span> in <span className="text-brass-300">{defenderTerritory.name}</span></>
              ) : <span className="text-mist-500">global / fallback</span>}
              {cooldownMaps.size > 0 && (
                <span className="ml-2 text-mist-500">
                  · {cooldownMaps.size} on cooldown ({mapCooldownTurns}-turn)
                </span>
              )}
            </div>

            {mapCards.length === 0 ? (
              <div className="bg-ink-900 rounded p-3 text-xs text-mist-400 italic">
                No maps available right now (pool empty or all on cooldown). Go back to pick a different terrain or target.
              </div>
            ) : (
              <div className="mb-3">
                <div className="text-xs font-semibold mb-2">
                  {!bannedMap
                    ? <span className="text-union-400">Defender bans 1 of {mapCards.length}</span>
                    : !pickedMap
                      ? <span className="text-rebel-400">Attacker picks 1 of the remaining {mapCards.length - 1}</span>
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
                      ? 'bg-ink-900 border-ink-800 text-mist-500 line-through'
                      : isPicked
                        ? 'bg-green-800/30 border-green-400 text-green-200'
                        : selectableByDefender
                          ? 'bg-ink-800 border-union-500 hover:bg-union-900/40 text-white'
                          : selectableByAttacker
                            ? 'bg-ink-800 border-rebel-500 hover:bg-rebel-900/40 text-white'
                            : 'bg-ink-800 border-ink-700 text-mist-400';
                    return (
                      <button
                        key={m}
                        onClick={handler}
                        disabled={isBanned || (!selectableByDefender && !selectableByAttacker && !isPicked)}
                        className={`p-2 rounded border-2 text-sm font-semibold text-left ${state}`}
                      >
                        {isBanned && <span className="text-[10px] text-rebel-400 mr-2">BANNED</span>}
                        {isPicked && <span className="text-[10px] text-green-400 mr-2">PICKED</span>}
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex gap-2 mt-4">
              <button onClick={reset} className="flex-1 bg-ink-800 hover:bg-ink-700 text-white rounded py-2 text-sm">Back</button>
              <button onClick={onCancel} className="flex-1 bg-ink-800 hover:bg-ink-700 text-white rounded py-2 text-sm">Cancel</button>
              <button
                onClick={commit}
                disabled={!pickedMap}
                className="flex-1 bg-rebel-500 hover:bg-rebel-500 disabled:bg-ink-800 disabled:text-mist-500 text-white rounded py-2 text-sm font-semibold"
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
