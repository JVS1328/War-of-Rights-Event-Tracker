import { DollarSign, Users, Trophy, Star } from 'lucide-react';

const FactionSheet = ({ campaign, side }) => {
  const f = campaign.factions[side];
  const color = side === 'USA' ? 'text-blue-400' : 'text-red-400';
  const cities = campaign.board.cities.filter(c => c.owner === side);
  const units = campaign.units.filter(u => u.faction === side && !u.wiped);
  const wiped = campaign.units.filter(u => u.faction === side && u.wiped).length;

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <h3 className={`text-lg font-bold ${color} mb-3`}>{side}</h3>

      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-green-400" />
          <span className="text-white font-mono">${f.money.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-amber-400" />
          <span className="text-white font-mono">{f.manpower.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-400" />
          <span className="text-white font-mono">{f.vp} VP</span>
        </div>
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-purple-400" />
          <span className="text-white font-mono">{f.victories} wins</span>
        </div>
      </div>

      <div className="text-xs text-slate-400 space-y-1">
        <div>Cities: <span className="text-white">{cities.length}</span></div>
        <div>Active Tokens: <span className="text-white">{units.length}</span></div>
        {wiped > 0 && <div>Wiped: <span className="text-red-400">{wiped}</span></div>}
        <div>Hand: <span className="text-white">{f.battleCards.length + f.specialCards.length}</span> cards</div>
      </div>
    </div>
  );
};

export default FactionSheet;
