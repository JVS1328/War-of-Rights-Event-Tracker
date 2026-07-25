import { Footprints, Waves, Zap, X, Check } from 'lucide-react';

/**
 * MoveConfirmModal — confirms a proposed move for the currently-acting token.
 *
 * Mode is derived server-side (evaluation.mode) based on whether the token is
 * boarded on a rail or river. No more multi-mode picker — the user embarks
 * or disembarks via dedicated turn actions.
 */
const MODE_META = {
  march: { label: 'March', Icon: Footprints, tone: 'text-mist-300' },
  river: { label: 'River', Icon: Waves,      tone: 'text-sky-300' },
  rail:  { label: 'Rail',  Icon: Zap,        tone: 'text-brass-300' },
};

const MoveConfirmModal = ({ evaluation, token, destination, mpLeft, onConfirm, onCancel }) => {
  if (!evaluation?.valid || !token || !destination) return null;

  const mode = evaluation.mode;
  const meta = MODE_META[mode] || MODE_META.march;
  const cost = evaluation.cost;
  const canAfford = cost <= mpLeft;
  const ratePerMP = evaluation.ratesMilesPerMP?.[mode];

  return (
    <div className="ui-modal-backdrop">
      <div className="ui-modal border-brass-400/50 p-5 max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-brass-400">Confirm Move</h3>
          <button onClick={onCancel} className="text-mist-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-ink-900 rounded p-3 mb-3 text-sm">
          <div className="text-mist-300 font-semibold">{token.name}</div>
          <div className="text-xs text-mist-400 mt-1">
            Distance: <span className="text-white">{evaluation.miles ?? 0} miles</span>
            {' · '}MP left: <span className="text-white">{mpLeft}</span>
            {evaluation.crossings > 0 && (
              <span className="text-orange-400">
                {' · '}River crossings: {evaluation.crossings} (+{evaluation.crossings} MP)
              </span>
            )}
          </div>
        </div>

        <div className="bg-ink-900 rounded p-3 mb-3 flex items-center gap-3">
          <meta.Icon className={`w-6 h-6 ${meta.tone}`} />
          <div className="flex-1">
            <div className={`text-sm font-bold ${meta.tone}`}>{meta.label}</div>
            {ratePerMP != null && (
              <div className="text-[11px] text-mist-500">{ratePerMP} mi per MP</div>
            )}
          </div>
          <div className="text-right">
            <div className="text-xs text-mist-400">Cost</div>
            <div className="text-lg font-bold text-white">{cost} MP</div>
          </div>
        </div>

        {evaluation.boardedType && (
          <div className="text-[11px] text-sky-300 mb-3 bg-sky-900/30 rounded p-2">
            Moving along the boarded {evaluation.boardedType}. Your turn continues while MP remain.
            Use Disembark when you're ready to get off (ends turn).
          </div>
        )}

        {!canAfford && (
          <div className="text-[11px] text-rebel-400 mb-3 bg-rebel-900/30 rounded p-2">
            Not enough movement points for this move.
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 bg-ink-800 hover:bg-ink-700 text-white rounded py-2 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm()}
            disabled={!canAfford}
            className="flex-1 bg-green-600 hover:bg-green-500 disabled:bg-ink-800 disabled:text-mist-500 text-white rounded py-2 text-sm font-semibold flex items-center justify-center gap-1"
          >
            <Check className="w-4 h-4" /> Move
          </button>
        </div>
      </div>
    </div>
  );
};

export default MoveConfirmModal;
