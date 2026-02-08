import { useState } from 'react';
import { Swords, ChevronDown, ChevronRight, Trophy, Skull, Calendar, Clock, Edit3 } from 'lucide-react';

const BattleHistory = ({ battles, territories, onEditBattle }) => {
  const [expandedBattle, setExpandedBattle] = useState(null);

  const toggleExpand = (battleId) => {
    setExpandedBattle(expandedBattle === battleId ? null : battleId);
  };

  const getTerritoryName = (territoryId) => {
    const territory = territories.find(t => t.id === territoryId);
    return territory ? territory.name : 'Unknown';
  };

  const formatDate = (isoString) => {
    return new Date(isoString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getWinnerColor = (winner) => {
    if (!winner) return 'text-amber-400';
    return winner === 'USA' ? 'text-blue-400' : 'text-red-400';
  };

  const getWinnerBg = (winner) => {
    if (!winner) return 'bg-amber-600';
    return winner === 'USA' ? 'bg-blue-600' : 'bg-red-600';
  };

  const isPending = (battle) => battle.status === 'pending' || !battle.winner;

  // Sort battles by turn (most recent first)
  const sortedBattles = [...battles].sort((a, b) => b.turn - a.turn);

  if (battles.length === 0) {
    return (
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <h2 className="text-2xl font-bold text-amber-400 mb-4 flex items-center gap-2">
          <Swords className="w-6 h-6" />
          Battle History
        </h2>
        <div className="bg-slate-900 rounded-lg p-8 flex items-center justify-center min-h-[200px]">
          <p className="text-slate-500">
            No battles recorded yet
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
      <h2 className="text-2xl font-bold text-amber-400 mb-4 flex items-center gap-2">
        <Swords className="w-6 h-6" />
        Battle History ({battles.length})
      </h2>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {sortedBattles.map((battle, index) => (
          <div key={battle.id} className="bg-slate-700 rounded-lg overflow-hidden">
            <div
              className="p-4 cursor-pointer hover:bg-slate-600 transition"
              onClick={() => toggleExpand(battle.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  {expandedBattle === battle.id ? (
                    <ChevronDown className="w-4 h-4 text-amber-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-sm">Turn {battle.turn}</span>
                      <span className="text-white font-semibold">{battle.mapName}</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {getTerritoryName(battle.territoryId)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {isPending(battle) ? (
                    <span className="px-3 py-1 rounded text-sm font-bold bg-amber-600 text-white flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Pending
                    </span>
                  ) : (
                    <>
                      <span className={`px-3 py-1 rounded text-sm font-bold ${getWinnerBg(battle.winner)} text-white`}>
                        {battle.winner} Victory
                      </span>
                      <span className="text-green-400 font-bold text-sm">
                        +{battle.victoryPointsAwarded || 0} VP
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Expanded details */}
            {expandedBattle === battle.id && (
              <div className="bg-slate-800 p-4 border-t border-slate-600">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-slate-400 mb-2">Battle Details</div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Turn:</span>
                        <span className="text-white font-semibold">{battle.turn}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Date:</span>
                        <span className="text-white font-semibold">{formatDate(battle.date)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Map:</span>
                        <span className="text-white font-semibold">{battle.mapName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Territory:</span>
                        <span className="text-white font-semibold">{getTerritoryName(battle.territoryId)}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-slate-400 mb-2">Outcome</div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Attacker:</span>
                        <span className={`font-semibold ${getWinnerColor(battle.attacker)}`}>
                          {battle.attacker}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Winner:</span>
                        {isPending(battle) ? (
                          <span className="font-semibold text-amber-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Pending
                          </span>
                        ) : (
                          <span className={`font-semibold ${getWinnerColor(battle.winner)}`}>
                            {battle.winner}
                          </span>
                        )}
                      </div>
                      {!isPending(battle) && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">VP Awarded:</span>
                          <span className="text-green-400 font-semibold">
                            +{battle.victoryPointsAwarded || 0}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Casualties */}
                {battle.casualties && (battle.casualties.USA > 0 || battle.casualties.CSA > 0) && (
                  <div className="mt-4 pt-4 border-t border-slate-700">
                    <div className="text-slate-400 mb-2 flex items-center gap-2">
                      <Skull className="w-4 h-4" />
                      Casualties
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex justify-between">
                        <span className="text-blue-400">USA:</span>
                        <span className="text-white font-semibold">{battle.casualties.USA}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-red-400">CSA:</span>
                        <span className="text-white font-semibold">{battle.casualties.CSA}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Notes */}
                {battle.notes && (
                  <div className="mt-4 pt-4 border-t border-slate-700">
                    <div className="text-slate-400 mb-2 text-sm">Notes</div>
                    <div className="text-white text-sm italic">{battle.notes}</div>
                  </div>
                )}

                {/* Edit Button */}
                {onEditBattle && (
                  <div className="mt-4 pt-4 border-t border-slate-700">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditBattle(battle);
                      }}
                      className={`w-full px-3 py-2 rounded font-semibold text-sm transition flex items-center justify-center gap-2 ${
                        isPending(battle)
                          ? 'bg-amber-600 hover:bg-amber-500 text-white'
                          : 'bg-slate-600 hover:bg-slate-500 text-white'
                      }`}
                    >
                      <Edit3 className="w-4 h-4" />
                      {isPending(battle) ? 'Complete Battle' : 'Edit Battle'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default BattleHistory;