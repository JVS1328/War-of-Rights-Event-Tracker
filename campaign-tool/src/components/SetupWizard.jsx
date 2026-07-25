import { useState, useEffect } from 'react';
import { Coins, X, Flag } from 'lucide-react';

/**
 * SetupWizard — walks a new Grand Campaign through:
 *
 *   1. Coin flip (USA = Heads, CSA = Tails).
 *   2. Alternating placement: winning side draws the first token from their
 *      bag and places it in friendly territory on the map, then the other
 *      side draws and places, and so on until every token has been placed.
 *
 * During step 2 the wizard is a *non-blocking* floating panel — the user
 * clicks directly on the main map, and the wizard just shows whose turn it
 * is, the name of the token awaiting placement, and any error from the last
 * placement attempt.
 */
const SetupWizard = ({
  campaign,
  lastPlacementError,
  onFlip,
  onClose,
  onClearError,
}) => {
  const gc = campaign?.grandCampaign;
  if (!gc) return null;

  const [flipping, setFlipping] = useState(false);
  const [flipResult, setFlipResult] = useState(null);

  // Clear transient error when the current token changes (successful placement).
  useEffect(() => {
    if (lastPlacementError) onClearError?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gc.currentTokenId]);

  const phase = gc.phase;

  // ----- Step 1: coin flip -----
  if (phase === 'setup-coinflip') {
    const handleFlip = () => {
      if (flipping) return;
      setFlipping(true);
      // Short animation then commit result.
      const result = Math.random() < 0.5 ? 'USA' : 'CSA';
      setTimeout(() => {
        setFlipResult(result);
        setFlipping(false);
      }, 900);
    };
    const commit = () => {
      if (!flipResult) return;
      onFlip(flipResult);
    };

    return (
      <div className="ui-modal-backdrop">
        <div className="ui-modal border-brass-500/50 p-6 max-w-md">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-brass-400 flex items-center gap-2">
              <Coins className="w-6 h-6" /> Grand Campaign — Coin Flip
            </h2>
            <button onClick={onClose} className="text-mist-400 hover:text-white"><X className="w-5 h-5" /></button>
          </div>
          <p className="text-sm text-mist-300 mb-4">
            Heads = <span className="text-union-400 font-semibold">USA</span>,
            {' '}Tails = <span className="text-rebel-400 font-semibold">CSA</span>.
            {' '}The winning side draws and places first — then tokens alternate.
          </p>

          <div className="bg-ink-900 rounded-lg p-6 flex flex-col items-center justify-center mb-4 min-h-[140px]">
            {flipping && (
              <div className="w-20 h-20 rounded-full border-4 border-brass-400 border-t-transparent animate-spin" />
            )}
            {!flipping && !flipResult && (
              <div className="text-mist-400 text-sm">Click flip to begin.</div>
            )}
            {!flipping && flipResult && (
              <div className="text-center">
                <div className="text-4xl font-bold mb-1" style={{
                  color: flipResult === 'USA' ? '#3b82f6' : '#ef4444'
                }}>
                  {flipResult}
                </div>
                <div className="text-xs text-mist-400">wins the toss and drawsfirst</div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleFlip}
              disabled={flipping || flipResult}
              className="flex-1 bg-brass-500 hover:bg-brass-400 disabled:bg-ink-800 disabled:text-mist-500 text-white rounded-lg py-2 font-semibold"
            >
              {flipResult ? 'Flipped' : 'Flip'}
            </button>
            <button
              onClick={commit}
              disabled={!flipResult}
              className="ui-btn ui-btn-primary flex-1"
            >
              Begin Placement
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ----- Step 2: placement (floating hud) -----
  if (phase === 'setup-placement') {
    const currentToken = gc.tokens.find(t => t.id === gc.currentTokenId);
    const remainingUSA = gc.bags.USA.length + (gc.activeSide === 'USA' && gc.currentTokenId ? 1 : 0);
    const remainingCSA = gc.bags.CSA.length + (gc.activeSide === 'CSA' && gc.currentTokenId ? 1 : 0);
    const sideColor = gc.activeSide === 'USA' ? 'text-union-400' : 'text-rebel-400';

    return (
      <div className="fixed top-24 right-6 z-40 bg-ink-900/95 border-2 border-brass-400 rounded-lg shadow-xl p-4 w-80 max-w-[90vw]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="ui-title">
            <Flag className="w-5 h-5" /> Placement
          </h3>
          <div className="flex items-center gap-3 text-xs text-mist-400">
            <span>USA left: <span className="text-union-400 font-semibold">{remainingUSA}</span></span>
            <span>CSA left: <span className="text-rebel-400 font-semibold">{remainingCSA}</span></span>
          </div>
        </div>

        {currentToken ? (
          <div className="bg-ink-850 rounded p-3 mb-2">
            <div className="text-xs text-mist-400 mb-1">Now placing:</div>
            <div className={`text-lg font-bold ${sideColor}`}>{currentToken.name}</div>
            <div className="text-[11px] text-mist-300 mt-1">
              Click in any <span className={sideColor + ' font-semibold'}>{currentToken.side}</span>-controlled
              territory. Tokens cannot overlap.
            </div>
          </div>
        ) : (
          <div className="bg-ink-850 rounded p-3 text-xs text-mist-400 italic">
            Awaiting next draw…
          </div>
        )}

        {lastPlacementError && (
          <div className="bg-rebel-900/50 border border-rebel-500 rounded p-2 text-xs text-red-200 mt-2">
            {lastPlacementError}
          </div>
        )}

        <div className="text-[10px] text-mist-500 mt-3 pt-2 border-t border-ink-800">
          Setup proceeds automatically after each valid placement.
        </div>
      </div>
    );
  }

  return null;
};

export default SetupWizard;
