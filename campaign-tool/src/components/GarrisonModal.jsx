import { useState } from 'react';
import { Shield, X } from 'lucide-react';

/**
 * GarrisonModal — detach men from the current token into (or pull them from)
 * the friendly city/fort at the token's position. Either operation ends the
 * token's turn.
 */
const GarrisonModal = ({ campaign, token, feature, onGarrison, onRecall, onCancel }) => {
  const [amount, setAmount] = useState('100');
  const [mode, setMode] = useState('detach'); // 'detach' | 'recall'

  if (!campaign || !token || !feature) return null;
  const gc = campaign.grandCampaign;
  const maxGarrison = gc.settings.maxGarrison;
  const currentGarrison = feature.garrison?.men || 0;

  const n = Math.max(0, Math.round(Number(amount) || 0));
  const detachCap = Math.min(token.manpower, maxGarrison - currentGarrison);
  const recallCap = currentGarrison;

  const validDetach = mode === 'detach' && n > 0 && n <= detachCap;
  const validRecall = mode === 'recall' && n > 0 && n <= recallCap;
  const canSubmit = validDetach || validRecall;

  const submit = () => {
    if (!canSubmit) return;
    if (mode === 'detach') onGarrison(feature.id, n);
    else onRecall(feature.id, n);
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border-2 border-amber-500 rounded-lg p-5 max-w-sm w-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-amber-400 flex items-center gap-2">
            <Shield className="w-5 h-5" /> Garrison — {feature.name}
          </h3>
          <button onClick={onCancel} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        <div className="bg-slate-900 rounded p-2 mb-3 text-xs text-slate-300">
          Current garrison: <span className="font-bold text-white">{currentGarrison}</span>
          {' / '}{maxGarrison}
          <br />
          Token: <span className="font-bold text-white">{token.name}</span> · MP: {token.manpower}
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            onClick={() => setMode('detach')}
            className={`py-1.5 rounded text-sm font-semibold ${
              mode === 'detach' ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-200'
            }`}
          >
            Detach to garrison
          </button>
          <button
            onClick={() => setMode('recall')}
            className={`py-1.5 rounded text-sm font-semibold ${
              mode === 'recall' ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-200'
            }`}
          >
            Recall from garrison
          </button>
        </div>

        <div className="mb-3">
          <label className="text-xs text-slate-300">
            Amount {mode === 'detach' ? `(max ${detachCap})` : `(max ${recallCap})`}
          </label>
          <input
            type="number"
            min="0"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="w-full bg-slate-900 text-white px-2 py-1.5 rounded text-sm mt-1"
          />
        </div>

        <div className="text-[10px] text-slate-500 mb-3 italic">
          This action ends the token's turn.
        </div>

        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white rounded py-2 text-sm">Cancel</button>
          <button
            onClick={submit}
            disabled={!canSubmit}
            className="flex-1 bg-green-600 hover:bg-green-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded py-2 text-sm font-semibold"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

export default GarrisonModal;
