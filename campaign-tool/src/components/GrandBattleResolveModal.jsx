import { useState, useMemo } from 'react';
import { Trophy, X } from 'lucide-react';
import { applyCasualtyModifiers, isWinterMonth } from '../utils/grandCampaignLogic';

/**
 * GrandBattleResolveModal — enter raw War of Rights casualty counts, pick a
 * winner, preview the applied modifiers (fatigue %, winter %, train/river %),
 * and confirm resolution. The store call does the manpower subtraction,
 * fatigue bump, retreat, last-stand / wipe status, and VP events.
 */
const GrandBattleResolveModal = ({ campaign, battle, onResolve, onCancel }) => {
  const gc = campaign?.grandCampaign;
  const [attackerRaw, setAttackerRaw] = useState('');
  const [defenderRaw, setDefenderRaw] = useState('');
  const [winner, setWinner] = useState(null);
  const [attackerOnTrainRiver, setAttackerOnTrainRiver] = useState(false);
  const [defenderOnTrainRiver, setDefenderOnTrainRiver] = useState(false);

  const attacker = gc?.tokens.find(t => t.id === battle?.attackerTokenId);
  const defender = gc?.tokens.find(t => t.id === battle?.defenderTokenId);
  const attackerSupport = battle?.attackerSupportId ? gc?.tokens.find(t => t.id === battle.attackerSupportId) : null;
  const defenderSupport = battle?.defenderSupportId ? gc?.tokens.find(t => t.id === battle.defenderSupportId) : null;

  const winter = useMemo(() => campaign ? isWinterMonth(campaign) : false, [campaign]);

  if (!attacker || !defender || !gc) return null;

  const rawAttacker = Number(attackerRaw) || 0;
  const rawDefender = Number(defenderRaw) || 0;

  const attackerTotal = applyCasualtyModifiers(rawAttacker, {
    fatigue: attacker.fatigue,
    isAttackerInWinter: winter,
    onTrainOrRiver: attackerOnTrainRiver,
  }, gc.settings);
  const defenderTotal = applyCasualtyModifiers(rawDefender, {
    fatigue: defender.fatigue,
    isAttackerInWinter: false,
    onTrainOrRiver: defenderOnTrainRiver,
  }, gc.settings);

  const canResolve = winner && (rawAttacker > 0 || rawDefender > 0);

  const commit = () => {
    if (!canResolve) return;
    onResolve({
      winner,
      attackerRaw: rawAttacker,
      defenderRaw: rawDefender,
      attackerOnTrainRiver,
      defenderOnTrainRiver,
    });
  };

  const tokenLine = (t, label, color) => (
    <div className="text-xs text-slate-300">
      <span className="text-slate-400">{label}:</span>{' '}
      <span className={`font-semibold ${color}`}>{t.name}</span>
      <span className="text-slate-500">
        {' · '}MP {t.manpower} · Fat {t.fatigue}
      </span>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border-2 border-amber-500 rounded-lg p-5 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-amber-400 flex items-center gap-2">
            <Trophy className="w-5 h-5" /> Resolve Battle — {battle.mapName}
          </h3>
          <button onClick={onCancel} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        <div className="bg-slate-900 rounded p-3 mb-3 space-y-1">
          {tokenLine(attacker, 'Attacker', 'text-red-400')}
          {attackerSupport && tokenLine(attackerSupport, 'Attacker supp.', 'text-red-400')}
          {tokenLine(defender, 'Defender', 'text-blue-400')}
          {defenderSupport && tokenLine(defenderSupport, 'Defender supp.', 'text-blue-400')}
          {winter && <div className="text-[11px] text-cyan-300 mt-1">Winter month — attacker casualties +{gc.settings.winterAttackerCasPct}%</div>}
        </div>

        {/* Raw casualties */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className="text-xs text-slate-300">Attacker raw casualties (WoR)</label>
            <input
              type="number"
              min="0"
              value={attackerRaw}
              onChange={e => setAttackerRaw(e.target.value)}
              className="w-full bg-slate-900 text-white px-2 py-1.5 rounded text-sm mt-1"
            />
            <label className="flex items-center gap-1 text-[10px] text-slate-400 mt-1">
              <input type="checkbox" checked={attackerOnTrainRiver} onChange={e => setAttackerOnTrainRiver(e.target.checked)} />
              Attacker on train/river (+{gc.settings.trainRiverCasPct}%)
            </label>
            <div className="text-[11px] text-amber-300 mt-1">
              Modified: <span className="font-bold">{attackerTotal}</span>
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-300">Defender raw casualties (WoR)</label>
            <input
              type="number"
              min="0"
              value={defenderRaw}
              onChange={e => setDefenderRaw(e.target.value)}
              className="w-full bg-slate-900 text-white px-2 py-1.5 rounded text-sm mt-1"
            />
            <label className="flex items-center gap-1 text-[10px] text-slate-400 mt-1">
              <input type="checkbox" checked={defenderOnTrainRiver} onChange={e => setDefenderOnTrainRiver(e.target.checked)} />
              Defender on train/river (+{gc.settings.trainRiverCasPct}%)
            </label>
            <div className="text-[11px] text-amber-300 mt-1">
              Modified: <span className="font-bold">{defenderTotal}</span>
            </div>
          </div>
        </div>

        <div className="text-[10px] text-slate-500 mb-3">
          Fatigue on attacker (+{attacker.fatigue * gc.settings.fatigueCasPct}%) and defender (+{defender.fatigue * gc.settings.fatigueCasPct}%) applied automatically.
          Supporters absorb 40% of their side's total.
        </div>

        {/* Winner */}
        <div className="mb-3">
          <div className="text-xs font-semibold text-slate-300 mb-1">Winner</div>
          <div className="grid grid-cols-2 gap-2">
            {['USA', 'CSA'].map(s => (
              <button
                key={s}
                onClick={() => setWinner(s)}
                className={`p-2 rounded border-2 text-sm font-semibold ${
                  winner === s
                    ? s === 'USA' ? 'bg-blue-700 border-blue-300 text-white' : 'bg-red-700 border-red-300 text-white'
                    : 'bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white rounded py-2 text-sm">Cancel</button>
          <button
            onClick={commit}
            disabled={!canResolve}
            className="flex-1 bg-green-600 hover:bg-green-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded py-2 text-sm font-semibold"
          >
            Resolve Battle
          </button>
        </div>
      </div>
    </div>
  );
};

export default GrandBattleResolveModal;
