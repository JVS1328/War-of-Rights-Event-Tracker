import { Package, Shuffle, SkipForward } from 'lucide-react';

const TurnBags = ({ campaign, onDraw, onCoinToss, onAdvanceMonth }) => {
  const { phase, activeSide, bags, discards, coinTossWinner } = campaign.turn;

  if (phase === 'setup') {
    return (
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
        <div className="text-sm text-slate-400 mb-3">Setup phase — toss the coin.</div>
        <button
          onClick={onCoinToss}
          className="w-full px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded flex items-center gap-2 justify-center"
        >
          <Shuffle className="w-4 h-4" /> Toss Coin
        </button>
      </div>
    );
  }

  const bothEmpty = bags.USA.length === 0 && bags.CSA.length === 0;

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 space-y-3">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-blue-400" />
          <span className="text-blue-400 font-semibold">USA</span>
          <span className="text-white font-mono">{bags.USA.length}</span>
          <span className="text-slate-500">/ discard {discards.USA.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-red-400" />
          <span className="text-red-400 font-semibold">CSA</span>
          <span className="text-white font-mono">{bags.CSA.length}</span>
          <span className="text-slate-500">/ discard {discards.CSA.length}</span>
        </div>
      </div>

      <div className="text-sm text-slate-300">
        Active: <span className={activeSide === 'USA' ? 'text-blue-400' : 'text-red-400'}>{activeSide || '—'}</span>
        {coinTossWinner && <span className="text-slate-500 text-xs ml-2">(toss: {coinTossWinner})</span>}
      </div>

      {!bothEmpty ? (
        <button
          onClick={() => onDraw(activeSide)}
          disabled={bags[activeSide]?.length === 0}
          className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white rounded flex items-center gap-2 justify-center"
        >
          <Shuffle className="w-4 h-4" /> Draw from {activeSide} bag
        </button>
      ) : (
        <button
          onClick={onAdvanceMonth}
          className="w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded flex items-center gap-2 justify-center"
        >
          <SkipForward className="w-4 h-4" /> Advance to next month
        </button>
      )}
    </div>
  );
};

export default TurnBags;
