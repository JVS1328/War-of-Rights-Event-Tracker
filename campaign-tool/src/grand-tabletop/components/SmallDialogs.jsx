import { useState } from 'react';
import { X } from 'lucide-react';
import { getCityByHex } from '../data/defaultBoard';

export const GarrisonDialog = ({ campaign, unit, onConfirm, onCancel }) => {
  const city = getCityByHex(campaign.board, unit.hexKey);
  const currentGarrison = city?.garrison || 0;
  const maxAdd = Math.min(
    campaign.settings.garrisonMax - currentGarrison,
    unit.manpower - 500
  );
  const [amount, setAmount] = useState(Math.max(0, Math.min(100, maxAdd)));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg border border-slate-700 max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-amber-400">Set Garrison — {city?.name}</h3>
          <button onClick={onCancel} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div className="text-sm text-slate-300">
            Current garrison: <span className="text-amber-300 font-mono">{currentGarrison}</span> /
            max <span className="text-slate-400">{campaign.settings.garrisonMax}</span>
          </div>
          <div className="text-sm text-slate-300">
            Your manpower: <span className="text-amber-300 font-mono">{unit.manpower}</span> (can't drop below 500)
          </div>
          <label className="block">
            <span className="text-xs text-slate-400 uppercase">Amount to add</span>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(Number(e.target.value))}
              min={0}
              max={maxAdd}
              step={50}
              className="w-full mt-1 px-2 py-1.5 bg-slate-700 text-white rounded"
            />
            <div className="text-xs text-slate-500 mt-1">Max addable: {maxAdd}</div>
          </label>
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={onCancel} className="px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-white rounded text-sm">Cancel</button>
            <button
              onClick={() => onConfirm(amount)}
              disabled={amount <= 0 || amount > maxAdd}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 text-white rounded text-sm"
            >
              Set Garrison
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ReplenishDialog = ({ campaign, unit, onConfirm, onCancel }) => {
  const { replenishCost, replenishManpowerCost, replenishSoldiers } = campaign.settings;
  const faction = campaign.factions[unit.faction];
  const canAfford = faction.money >= replenishCost && faction.manpower >= replenishManpowerCost;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg border border-slate-700 max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-amber-400">Replenish Unit</h3>
          <button onClick={onCancel} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3 text-sm text-slate-300">
          <div>Cost: <span className="text-green-400 font-mono">${replenishCost}</span> + <span className="text-amber-300 font-mono">{replenishManpowerCost}</span> manpower pool</div>
          <div>Reinforces <span className="text-white font-bold">+{replenishSoldiers}</span> soldiers to {unit.name}.</div>
          <div className="pt-2 border-t border-slate-700">
            Faction: <span className="text-green-400 font-mono">${faction.money}</span> · pool <span className="text-amber-300 font-mono">{faction.manpower}</span>
          </div>
          {!canAfford && <div className="text-red-400">Insufficient funds or manpower pool.</div>}
        </div>
        <div className="flex gap-2 justify-end pt-4">
          <button onClick={onCancel} className="px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-white rounded text-sm">Cancel</button>
          <button
            onClick={onConfirm}
            disabled={!canAfford}
            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-slate-700 text-white rounded text-sm"
          >
            Replenish (ends turn)
          </button>
        </div>
      </div>
    </div>
  );
};

export const CoinTossDialog = ({ onResult, onCancel }) => {
  const [result, setResult] = useState(null);

  const toss = () => {
    const r = Math.random() < 0.5 ? 'heads' : 'tails';
    setResult(r);
  };

  const winner = result === 'heads' ? 'USA' : result === 'tails' ? 'CSA' : null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg border border-slate-700 max-w-md w-full p-6 text-center">
        <h3 className="text-2xl font-bold text-amber-400 mb-4">Coin Toss</h3>
        <p className="text-slate-300 mb-4 text-sm">Heads = USA, Tails = CSA. Winner draws first.</p>
        {!result ? (
          <button
            onClick={toss}
            className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded font-semibold"
          >
            Toss Coin
          </button>
        ) : (
          <div>
            <div className="text-4xl font-bold text-amber-400 mb-2">{result.toUpperCase()}</div>
            <div className={`text-xl font-bold mb-4 ${winner === 'USA' ? 'text-blue-400' : 'text-red-400'}`}>
              {winner} draws first
            </div>
            <div className="flex gap-2 justify-center">
              <button onClick={onCancel} className="px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-white rounded text-sm">Cancel</button>
              <button
                onClick={() => onResult(winner)}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-semibold"
              >
                Continue
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const MonthEndDialog = ({ campaign, incomeUSA, incomeCSA, eventCard, onContinue }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg border border-slate-700 max-w-lg w-full p-6">
        <h3 className="text-2xl font-bold text-amber-400 mb-4">End of Month</h3>
        <div className="space-y-4 text-sm">
          <div>
            <div className="text-xs text-slate-400 uppercase mb-2">Monthly Income</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-900 rounded p-2">
                <div className="text-blue-400 font-semibold mb-1">USA</div>
                <div className="text-green-400">+${incomeUSA.money}</div>
                <div className="text-amber-300">+{incomeUSA.manpower} MP</div>
              </div>
              <div className="bg-slate-900 rounded p-2">
                <div className="text-red-400 font-semibold mb-1">CSA</div>
                <div className="text-green-400">+${incomeCSA.money}</div>
                <div className="text-amber-300">+{incomeCSA.manpower} MP</div>
              </div>
            </div>
          </div>

          {eventCard && (
            <div>
              <div className="text-xs text-slate-400 uppercase mb-2">Event Card Drawn</div>
              <div className="bg-purple-900 bg-opacity-40 border border-purple-700 rounded p-3">
                <div className="font-bold text-purple-300">{eventCard.name}</div>
                <div className="text-slate-300 text-xs mt-1">{eventCard.text}</div>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={onContinue}
          className="w-full mt-6 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded font-semibold"
        >
          Begin next month
        </button>
      </div>
    </div>
  );
};
