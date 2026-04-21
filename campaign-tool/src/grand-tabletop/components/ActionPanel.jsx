import { useState } from 'react';
import { Footprints, Swords, Shield, Package, Users, StopCircle, Ship, Train } from 'lucide-react';
import { MOVE_MODE } from '../utils/movementRules';
import { getCityByHex, TERRAIN } from '../data/defaultBoard';
import { hexKey, parseKey, neighbors } from '../utils/hexMath';

const ActionPanel = ({
  campaign,
  unit,
  moveMode,
  onSelectMoveMode,
  onAttack,
  onGarrison,
  onReplenish,
  onReinforce,
  onEndTurn,
  reinforcingIds
}) => {
  if (!unit) return null;
  const city = getCityByHex(campaign.board, unit.hexKey);
  const terrain = campaign.board.hexes[unit.hexKey]?.terrain;
  const factionColor = unit.faction === 'USA' ? 'text-blue-400' : 'text-red-400';

  // Adjacent enemy tokens or enemy cities/forts
  const { q, r } = parseKey(unit.hexKey);
  const adjKeys = neighbors(q, r).map(n => hexKey(n.q, n.r));
  const adjacentTargets = [];
  for (const k of adjKeys) {
    const hex = campaign.board.hexes[k];
    if (!hex) continue;
    const enemyUnit = campaign.units.find(u => u.hexKey === k && !u.wiped && u.faction !== unit.faction);
    const adjCity = getCityByHex(campaign.board, k);
    const canAttackCity = adjCity && adjCity.owner !== unit.faction && !enemyUnit;
    if (enemyUnit) adjacentTargets.push({ hexKey: k, kind: 'unit', label: `${enemyUnit.name} (${enemyUnit.manpower})` });
    else if (canAttackCity) adjacentTargets.push({ hexKey: k, kind: 'city', label: `${adjCity.name} (unoccupied ${adjCity.kind})` });
  }

  const canAttack = !unit.lastStand && !unit.onTrain && adjacentTargets.length > 0;
  const canReplenish = !!city && city.owner === unit.faction;
  const canGarrison = !!city && city.owner === unit.faction;
  const onCityOrFort = !!city;

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 space-y-3">
      <div className="border-b border-slate-700 pb-2">
        <div className="flex items-center justify-between">
          <span className={`font-bold ${factionColor}`}>{unit.faction}</span>
          <span className="text-white font-bold">{unit.name}</span>
        </div>
        <div className="text-xs text-slate-400 mt-1 grid grid-cols-2 gap-1">
          <div>MP: <span className="text-amber-300">{unit.remainingMP ?? campaign.settings.mpPerTurn}</span>/{campaign.settings.mpPerTurn}</div>
          <div>Men: <span className="text-amber-300">{unit.manpower}</span></div>
          <div>Fatigue: <span className="text-orange-300">{unit.fatigue || 0}</span></div>
          <div>Hex: <span className="text-slate-300">{unit.hexKey}</span></div>
        </div>
        {unit.lastStand && <div className="text-orange-400 text-xs italic mt-1">Last Stand — cannot attack or capture</div>}
        {unit.onTrain && <div className="text-yellow-300 text-xs italic mt-1">On train</div>}
        {unit.onRiver && <div className="text-cyan-300 text-xs italic mt-1">On river</div>}
      </div>

      <div>
        <div className="text-xs text-slate-400 uppercase mb-1">Move</div>
        <div className="grid grid-cols-3 gap-1">
          <button
            onClick={() => onSelectMoveMode(moveMode === MOVE_MODE.MARCH ? null : MOVE_MODE.MARCH)}
            className={`px-2 py-1.5 rounded text-xs flex items-center justify-center gap-1 ${moveMode === MOVE_MODE.MARCH ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
          >
            <Footprints className="w-3 h-3" /> March
          </button>
          <button
            onClick={() => onSelectMoveMode(moveMode === MOVE_MODE.RIVER ? null : MOVE_MODE.RIVER)}
            disabled={terrain !== TERRAIN.RIVER && !unit.onRiver}
            className={`px-2 py-1.5 rounded text-xs flex items-center justify-center gap-1 ${moveMode === MOVE_MODE.RIVER ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'} disabled:opacity-40`}
            title="Requires being on a river hex"
          >
            <Ship className="w-3 h-3" /> River
          </button>
          <button
            onClick={() => onSelectMoveMode(moveMode === MOVE_MODE.TRAIN ? null : MOVE_MODE.TRAIN)}
            disabled={!onCityOrFort || (!unit.onTrain && !['city', 'fort', 'station', 'capital'].includes(city?.kind))}
            className={`px-2 py-1.5 rounded text-xs flex items-center justify-center gap-1 ${moveMode === MOVE_MODE.TRAIN ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'} disabled:opacity-40`}
            title="Must embark at a city/fort/station"
          >
            <Train className="w-3 h-3" /> Train
          </button>
        </div>
        {moveMode && <div className="text-xs text-amber-300 mt-1 italic">Select a highlighted hex to move.</div>}
      </div>

      <div className="space-y-1">
        {canAttack && (
          <div>
            <div className="text-xs text-slate-400 uppercase mb-1">Attack (adjacent)</div>
            <div className="space-y-1">
              {adjacentTargets.map(t => (
                <button
                  key={t.hexKey}
                  onClick={() => onAttack(t.hexKey)}
                  className="w-full px-2 py-1 bg-red-700 hover:bg-red-600 text-white rounded text-xs flex items-center gap-1"
                >
                  <Swords className="w-3 h-3" /> {t.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={onReplenish}
          disabled={!canReplenish}
          className="w-full px-2 py-1.5 bg-green-700 hover:bg-green-600 disabled:bg-slate-700 disabled:opacity-40 text-white rounded text-xs flex items-center gap-1 justify-center"
        >
          <Package className="w-3 h-3" /> Replenish (ends turn)
        </button>

        <button
          onClick={onGarrison}
          disabled={!canGarrison}
          className="w-full px-2 py-1.5 bg-purple-700 hover:bg-purple-600 disabled:bg-slate-700 disabled:opacity-40 text-white rounded text-xs flex items-center gap-1 justify-center"
        >
          <Shield className="w-3 h-3" /> Garrison (ends turn)
        </button>

        <button
          onClick={onReinforce}
          className={`w-full px-2 py-1.5 ${reinforcingIds?.includes(unit.id) ? 'bg-cyan-600 hover:bg-cyan-500' : 'bg-slate-700 hover:bg-slate-600'} text-white rounded text-xs flex items-center gap-1 justify-center`}
        >
          <Users className="w-3 h-3" /> {reinforcingIds?.includes(unit.id) ? 'Reinforcing ✓' : 'Mark Reinforce'}
        </button>

        <button
          onClick={onEndTurn}
          className="w-full px-2 py-1.5 bg-slate-600 hover:bg-slate-500 text-white rounded text-xs flex items-center gap-1 justify-center"
        >
          <StopCircle className="w-3 h-3" /> End Turn
        </button>
      </div>
    </div>
  );
};

export default ActionPanel;
