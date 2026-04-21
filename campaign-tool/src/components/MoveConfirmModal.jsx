import { useState, useEffect } from 'react';
import { Footprints, Waves, Zap, X, Check } from 'lucide-react';

/**
 * MoveConfirmModal — confirms a proposed move for the currently-acting token.
 *
 * Takes an `evaluation` object from evaluateMove() plus the token and lets
 * the user pick from available movement modes (march / river / rail). Shows
 * inch distance, MP cost per mode, river crossings, and whether a rail/river
 * move will exhaust the rest of the token's turn.
 */
const MODE_META = {
  march: { label: 'March', Icon: Footprints },
  river: { label: 'River', Icon: Waves },
  rail:  { label: 'Rail',  Icon: Zap },
};

const MoveConfirmModal = ({ evaluation, token, destination, mpLeft, onConfirm, onCancel }) => {
  const [mode, setMode] = useState(evaluation?.suggested || 'march');

  // Re-sync default when the evaluation changes (new click).
  useEffect(() => {
    if (evaluation?.suggested) setMode(evaluation.suggested);
  }, [evaluation?.suggested]);

  if (!evaluation?.valid || !token || !destination) return null;

  const option = evaluation.options[mode];
  const cost = option?.cost ?? Infinity;
  const canAfford = cost <= mpLeft;
  const willEndTurn = mode === 'rail' || mode === 'river';

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border-2 border-amber-500 rounded-lg p-5 max-w-md w-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-amber-400">Confirm Move</h3>
          <button onClick={onCancel} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-slate-900 rounded p-3 mb-3 text-sm">
          <div className="text-slate-200 font-semibold">{token.name}</div>
          <div className="text-xs text-slate-400 mt-1">
            Distance: <span className="text-white">{evaluation.inches.toFixed(2)} in</span>
            {' · '}MP left: <span className="text-white">{mpLeft}</span>
            {evaluation.crossings > 0 && (
              <span className="text-orange-400">
                {' · '}River crossings: {evaluation.crossings} (+{evaluation.crossings})
              </span>
            )}
          </div>
        </div>

        {/* Mode selector — one button per available mode */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {['march', 'river', 'rail'].map(m => {
            const opt = evaluation.options[m];
            const meta = MODE_META[m];
            const available = !!opt?.available;
            const isActive = mode === m;
            return (
              <button
                key={m}
                disabled={!available}
                onClick={() => setMode(m)}
                className={`p-2 rounded border-2 text-xs flex flex-col items-center gap-1 ${
                  !available
                    ? 'bg-slate-800 border-slate-700 text-slate-600 cursor-not-allowed'
                    : isActive
                    ? 'bg-amber-700 border-amber-400 text-white'
                    : 'bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600'
                }`}
              >
                <meta.Icon className="w-4 h-4" />
                <span className="font-semibold">{meta.label}</span>
                <span className="text-[10px]">
                  {available ? `${opt.cost} MP` : 'n/a'}
                </span>
              </button>
            );
          })}
        </div>

        {willEndTurn && (
          <div className="text-[11px] text-amber-300 mb-3 bg-amber-900/30 rounded p-2">
            {mode === 'rail' ? 'Disembarking rail' : 'Disembarking river'} will end this token's turn.
          </div>
        )}

        {!canAfford && (
          <div className="text-[11px] text-red-300 mb-3 bg-red-900/30 rounded p-2">
            Not enough movement points for this move.
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white rounded py-2 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(mode)}
            disabled={!canAfford}
            className="flex-1 bg-green-600 hover:bg-green-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded py-2 text-sm font-semibold flex items-center justify-center gap-1"
          >
            <Check className="w-4 h-4" /> Move
          </button>
        </div>
      </div>
    </div>
  );
};

export default MoveConfirmModal;
