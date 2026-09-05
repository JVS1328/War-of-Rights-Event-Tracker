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
    <div className="ui-modal-backdrop">
      <div className="ui-modal border-brass-400/50 p-4 sm:p-5 max-w-sm overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="ui-title">
            <Shield className="w-5 h-5" /> Garrison — {feature.name}
          </h3>
          <button onClick={onCancel} className="text-mist-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        <div className="bg-ink-900 rounded p-2 mb-3 text-xs text-mist-300">
          Current garrison: <span className="font-bold text-white">{currentGarrison}</span>
          {' / '}{maxGarrison}
          <br />
          Token: <span className="font-bold text-white">{token.name}</span> · MP: {token.manpower}
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            onClick={() => setMode('detach')}
            className={`py-1.5 rounded text-sm font-semibold ${
              mode === 'detach' ? 'bg-brass-500 text-white' : 'bg-ink-800 text-mist-300'
            }`}
          >
            Detach to garrison
          </button>
          <button
            onClick={() => setMode('recall')}
            className={`py-1.5 rounded text-sm font-semibold ${
              mode === 'recall' ? 'bg-brass-500 text-white' : 'bg-ink-800 text-mist-300'
            }`}
          >
            Recall from garrison
          </button>
        </div>

        <div className="mb-3">
          <label className="text-xs text-mist-300">
            Amount {mode === 'detach' ? `(max ${detachCap})` : `(max ${recallCap})`}
          </label>
          <input
            type="number"
            min="0"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="w-full bg-ink-900 text-white px-2 py-1.5 rounded text-sm mt-1"
          />
        </div>

        <div className="text-[10px] text-mist-500 mb-3 italic">
          This action ends the token's turn.
        </div>

        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 bg-ink-800 hover:bg-ink-700 text-white rounded py-2 text-sm">Cancel</button>
          <button
            onClick={submit}
            disabled={!canSubmit}
            className="flex-1 bg-green-600 hover:bg-green-500 disabled:bg-ink-800 disabled:text-mist-500 text-white rounded py-2 text-sm font-semibold"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

export default GarrisonModal;
