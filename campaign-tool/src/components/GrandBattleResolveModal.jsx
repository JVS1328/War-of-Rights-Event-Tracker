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
    <div className="text-xs text-mist-300">
      <span className="text-mist-400">{label}:</span>{' '}
      <span className={`font-semibold ${color}`}>{t.name}</span>
      <span className="text-mist-500">
        {' · '}MP {t.manpower} · Fat {t.fatigue}
      </span>
    </div>
  );

  return (
    <div className="ui-modal-backdrop">
      <div className="ui-modal border-brass-400/50 p-4 sm:p-5 max-w-lg max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="ui-title">
            <Trophy className="w-5 h-5" /> Resolve Battle — {battle.mapName}
          </h3>
          <button onClick={onCancel} className="text-mist-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        <div className="bg-ink-900 rounded p-3 mb-3 space-y-1">
          {tokenLine(attacker, 'Attacker', 'text-rebel-400')}
          {attackerSupport && tokenLine(attackerSupport, 'Attacker supp.', 'text-rebel-400')}
          {tokenLine(defender, 'Defender', 'text-union-400')}
          {defenderSupport && tokenLine(defenderSupport, 'Defender supp.', 'text-union-400')}
          {winter && <div className="text-[11px] text-cyan-300 mt-1">Winter month — attacker casualties +{gc.settings.winterAttackerCasPct}%</div>}
        </div>

        {/* Raw casualties */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className="text-xs text-mist-300">Attacker raw casualties (WoR)</label>
            <input
              type="number"
              min="0"
              value={attackerRaw}
              onChange={e => setAttackerRaw(e.target.value)}
              className="w-full bg-ink-900 text-white px-2 py-1.5 rounded text-sm mt-1"
            />
            <label className="flex items-center gap-1 text-[10px] text-mist-400 mt-1">
              <input type="checkbox" checked={attackerOnTrainRiver} onChange={e => setAttackerOnTrainRiver(e.target.checked)} />
              Attacker on train/river (+{gc.settings.trainRiverCasPct}%)
            </label>
            <div className="text-[11px] text-brass-300 mt-1">
              Modified: <span className="font-bold">{attackerTotal}</span>
            </div>
          </div>
          <div>
            <label className="text-xs text-mist-300">Defender raw casualties (WoR)</label>
            <input
              type="number"
              min="0"
              value={defenderRaw}
              onChange={e => setDefenderRaw(e.target.value)}
              className="w-full bg-ink-900 text-white px-2 py-1.5 rounded text-sm mt-1"
            />
            <label className="flex items-center gap-1 text-[10px] text-mist-400 mt-1">
              <input type="checkbox" checked={defenderOnTrainRiver} onChange={e => setDefenderOnTrainRiver(e.target.checked)} />
              Defender on train/river (+{gc.settings.trainRiverCasPct}%)
            </label>
            <div className="text-[11px] text-brass-300 mt-1">
              Modified: <span className="font-bold">{defenderTotal}</span>
            </div>
          </div>
        </div>

        <div className="text-[10px] text-mist-500 mb-3">
          Fatigue on attacker (+{attacker.fatigue * gc.settings.fatigueCasPct}%) and defender (+{defender.fatigue * gc.settings.fatigueCasPct}%) applied automatically.
          Supporters absorb 40% of their side's total.
        </div>

        {/* Conquest indicator — so players remember whether the sides were
            swapped on the WoR board. */}
        {battle.isConquest && (
          <div className="mb-3 bg-brass-900/40 border border-brass-500 rounded p-2 text-[11px] text-brass-300">
            <span className="font-bold">Conquest map.</span>{' '}
            {battle.sidesSwapped
              ? 'Coin flip: TAILS — sides were swapped (USA plays CSA and vice versa on the WoR side).'
              : 'Coin flip: HEADS — teams played their normal factions.'}
            <br />
            Draws are allowed and split the battle payout evenly; both engaged tokens retreat 2 march-MP.
          </div>
        )}

        {/* Winner — labelled by the engaged token's name + campaign side.
            The underlying value we send to resolveGCBattle is still the
            side string, derived from the clicked token's side. */}
        <div className="mb-3">
          <div className="text-xs font-semibold text-mist-300 mb-1">Outcome</div>
          <div className={`grid ${battle.isConquest ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
            {[
              { token: attacker, label: 'Attacker wins' },
              { token: defender, label: 'Defender wins' },
            ].map(({ token, label }) => {
              const side = token.side;
              return (
                <button
                  key={token.id}
                  onClick={() => setWinner(side)}
                  className={`p-2 rounded border-2 text-sm font-semibold flex flex-col items-center gap-0.5 ${
                    winner === side
                      ? side === 'USA' ? 'bg-union-500 border-union-400 text-white' : 'bg-rebel-500 border-rebel-400 text-white'
                      : 'bg-ink-800 border-ink-700 text-mist-300 hover:bg-ink-700'
                  }`}
                >
                  <span className="truncate max-w-full">
                    {token.name}
                    <span className={`text-[10px] font-bold ml-1 ${side === 'USA' ? 'text-union-400' : 'text-rebel-400'}`}>
                      ({side})
                    </span>
                  </span>
                  <span className="text-[10px] text-mist-300/80 font-normal">{label}</span>
                </button>
              );
            })}
            {battle.isConquest && (
              <button
                onClick={() => setWinner('DRAW')}
                className={`p-2 rounded border-2 text-sm font-semibold flex flex-col items-center gap-0.5 ${
                  winner === 'DRAW'
                    ? 'bg-brass-500 border-brass-300 text-white'
                    : 'bg-ink-800 border-ink-700 text-mist-300 hover:bg-ink-700'
                }`}
              >
                <span>Draw</span>
                <span className="text-[10px] text-mist-300/80 font-normal">split payout, both retreat</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 bg-ink-800 hover:bg-ink-700 text-white rounded py-2 text-sm">Cancel</button>
          <button
            onClick={commit}
            disabled={!canResolve}
            className="flex-1 bg-green-600 hover:bg-green-500 disabled:bg-ink-800 disabled:text-mist-500 text-white rounded py-2 text-sm font-semibold"
          >
            Resolve Battle
          </button>
        </div>
      </div>
    </div>
  );
};

export default GrandBattleResolveModal;
