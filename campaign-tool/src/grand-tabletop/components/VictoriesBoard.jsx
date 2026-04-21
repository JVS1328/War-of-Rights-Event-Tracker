import { Trophy, Star } from 'lucide-react';

const VictoriesBoard = ({ campaign, onClaimSpecial }) => {
  const { victoriesForSpecialCard } = campaign.settings;
  const factions = campaign.factions;

  const pending = (side) => {
    const earned = Math.floor(factions[side].victories / victoriesForSpecialCard);
    return earned - (factions[side].specialsEarned || 0);
  };

  const usaPending = pending('USA');
  const csaPending = pending('CSA');

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <h3 className="text-sm font-semibold text-amber-400 uppercase mb-2 flex items-center gap-2">
        <Trophy className="w-4 h-4" /> Victories Board
      </h3>
      <div className="grid grid-cols-2 gap-3 text-sm">
        {['USA', 'CSA'].map(side => (
          <div key={side} className="bg-slate-900 rounded p-2">
            <div className={side === 'USA' ? 'text-blue-400 font-semibold' : 'text-red-400 font-semibold'}>{side}</div>
            <div className="text-white text-xl font-bold font-mono">{factions[side].victories}</div>
            <div className="text-xs text-slate-500">specials earned {factions[side].specialsEarned || 0}</div>
            {pending(side) > 0 && (
              <button
                onClick={() => onClaimSpecial(side)}
                className="w-full mt-2 px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs flex items-center gap-1 justify-center"
              >
                <Star className="w-3 h-3" /> Claim {pending(side)} Special
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default VictoriesBoard;
