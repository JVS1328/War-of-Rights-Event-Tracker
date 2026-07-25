import { useState, useMemo } from 'react';
import { Package, X, DollarSign, Users } from 'lucide-react';

/**
 * ReplenishModal — buy men for the current token in 100-unit increments.
 *
 * Live cost preview in treasury + national manpower. Amount is capped by
 * whichever pool runs out first. Button +/- moves one unit (replenishYield)
 * at a time; a slider and direct input are also available.
 */
const ReplenishModal = ({ campaign, token, onConfirm, onCancel }) => {
  const gc = campaign?.grandCampaign;
  const s = gc?.settings;

  const unit = s?.replenishYield || 100;
  const maxByTreasury = s ? Math.floor(gc.pools[token.side].treasury / s.replenishMoneyCost) * unit : 0;
  const maxByManpower = s ? Math.floor(gc.pools[token.side].manpower / s.replenishManpowerCost) * unit : 0;
  const maxAffordable = Math.max(0, Math.min(maxByTreasury, maxByManpower));

  const [men, setMen] = useState(Math.min(unit, maxAffordable));

  const breakdown = useMemo(() => {
    if (!s) return null;
    const units = Math.max(0, Math.floor(men / unit));
    return {
      units,
      actualMen: units * unit,
      moneyCost: units * s.replenishMoneyCost,
      manpowerCost: units * s.replenishManpowerCost,
    };
  }, [men, unit, s]);

  if (!gc || !token || !breakdown) return null;

  const pool = gc.pools[token.side];
  const canBuy = breakdown.units > 0 && breakdown.moneyCost <= pool.treasury && breakdown.manpowerCost <= pool.manpower;

  const adjust = (delta) => {
    const raw = Math.max(0, Math.min(maxAffordable, men + delta));
    setMen(Math.round(raw / unit) * unit);
  };

  return (
    <div className="ui-modal-backdrop">
      <div className="ui-modal border-emerald-500/50 p-5 max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-emerald-400 flex items-center gap-2">
            <Package className="w-5 h-5" /> Replenish — {token.name}
          </h3>
          <button onClick={onCancel} className="text-mist-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        <div className="bg-ink-900 rounded p-3 mb-3 text-xs">
          <div>
            Current strength: <span className="text-white font-bold">{token.manpower}</span>
          </div>
          <div className="text-mist-400 mt-1">
            Rate: <span className="text-white">{unit} men</span> cost <span className="text-green-400">${s.replenishMoneyCost}</span> + <span className="text-brass-400">{s.replenishManpowerCost} manpower</span>
          </div>
        </div>

        <div className="bg-ink-900 rounded p-3 mb-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-mist-300">Amount</div>
            <div className="text-xs text-mist-500">Max affordable: {maxAffordable}</div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => adjust(-unit)} disabled={men <= 0} className="px-2 py-1 bg-ink-800 hover:bg-ink-700 disabled:bg-ink-850 disabled:text-mist-500 text-white rounded text-sm">−{unit}</button>
            <input
              type="number"
              step={unit}
              min="0"
              max={maxAffordable}
              value={men}
              onChange={e => setMen(Math.max(0, Math.min(maxAffordable, Number(e.target.value) || 0)))}
              className="flex-1 bg-ink-850 text-white text-center px-2 py-1 rounded text-sm font-bold"
            />
            <button onClick={() => adjust(unit)} disabled={men >= maxAffordable} className="px-2 py-1 bg-ink-800 hover:bg-ink-700 disabled:bg-ink-850 disabled:text-mist-500 text-white rounded text-sm">+{unit}</button>
          </div>
          {maxAffordable > 0 && (
            <input
              type="range"
              min="0"
              max={maxAffordable}
              step={unit}
              value={Math.min(men, maxAffordable)}
              onChange={e => setMen(Number(e.target.value))}
              className="w-full mt-2 accent-emerald-500"
            />
          )}
        </div>

        <div className="bg-ink-900 rounded p-3 mb-3 space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-mist-400 flex items-center gap-1">
              <DollarSign className="w-3 h-3 text-green-400" /> Treasury cost
            </span>
            <span className={breakdown.moneyCost > pool.treasury ? 'text-rebel-400 font-bold' : 'text-white font-bold'}>
              ${breakdown.moneyCost}
              <span className="text-mist-500 font-normal"> / ${pool.treasury}</span>
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-mist-400 flex items-center gap-1">
              <Users className="w-3 h-3 text-brass-400" /> Manpower cost
            </span>
            <span className={breakdown.manpowerCost > pool.manpower ? 'text-rebel-400 font-bold' : 'text-white font-bold'}>
              {breakdown.manpowerCost}
              <span className="text-mist-500 font-normal"> / {pool.manpower}</span>
            </span>
          </div>
          <div className="flex justify-between border-t border-ink-800 pt-1 mt-1">
            <span className="text-mist-400">Token strength after</span>
            <span className="text-emerald-300 font-bold">{token.manpower + breakdown.actualMen}</span>
          </div>
        </div>

        <div className="text-[10px] text-mist-500 mb-3 italic">
          This action ends the token's turn.
        </div>

        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 bg-ink-800 hover:bg-ink-700 text-white rounded py-2 text-sm">Cancel</button>
          <button
            onClick={() => onConfirm(breakdown.actualMen)}
            disabled={!canBuy}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-ink-800 disabled:text-mist-500 text-white rounded py-2 text-sm font-semibold"
          >
            Replenish +{breakdown.actualMen}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReplenishModal;
