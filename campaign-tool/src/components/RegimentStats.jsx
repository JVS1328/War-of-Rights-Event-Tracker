import { useState } from 'react';
import { ChevronDown, ChevronRight, Users, Trophy, Skull, Zap, Target } from 'lucide-react';

/**
 * RegimentStats - Display regiment leaderboard with expandable battle history
 *
 * Features:
 * - Collapsed by default, showing summary stats
 * - Expandable dropdown for each regiment showing battle history
 * - Tracks: W/L, casualties, SP lost, VP gained/lost
 */
const RegimentStats = ({ campaign }) => {
  const [expandedRegiments, setExpandedRegiments] = useState({});

  const regiments = campaign?.regiments || { USA: [], CSA: [] };
  const regimentStats = campaign?.regimentStats || {};

  const hasRegiments = regiments.USA.length > 0 || regiments.CSA.length > 0;

  if (!hasRegiments) {
    return null;
  }

  const toggleRegiment = (regimentId) => {
    setExpandedRegiments(prev => ({
      ...prev,
      [regimentId]: !prev[regimentId]
    }));
  };

  const getRegimentStats = (regimentId) => {
    return regimentStats[regimentId] || {
      wins: 0,
      losses: 0,
      casualties: 0,
      spLost: 0,
      vpGained: 0,
      vpLost: 0,
      battles: []
    };
  };

  const getWinRate = (stats) => {
    const total = stats.wins + stats.losses;
    if (total === 0) return 0;
    return Math.round((stats.wins / total) * 100);
  };

  const renderRegimentRow = (regiment, side) => {
    const stats = getRegimentStats(regiment.id);
    const isExpanded = expandedRegiments[regiment.id];
    const isUSA = side === 'USA';
    const textColor = isUSA ? 'text-blue-400' : 'text-red-400';
    const bgColor = isUSA ? 'bg-blue-900/20' : 'bg-red-900/20';
    const borderColor = isUSA ? 'border-blue-700' : 'border-red-700';
    const winRate = getWinRate(stats);

    return (
      <div key={regiment.id} className="mb-2">
        {/* Regiment Summary Row */}
        <button
          onClick={() => toggleRegiment(regiment.id)}
          className={`w-full ${bgColor} rounded-lg p-3 border ${borderColor} hover:opacity-90 transition text-left`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400" />
              )}
              <span className={`font-semibold ${textColor}`}>{regiment.name}</span>
            </div>
            <div className="flex items-center gap-4 text-xs">
              {/* W-L Record */}
              <div className="flex items-center gap-1">
                <Trophy className="w-3 h-3 text-amber-400" />
                <span className="text-green-400">{stats.wins}</span>
                <span className="text-slate-500">-</span>
                <span className="text-red-400">{stats.losses}</span>
                <span className="text-slate-500 ml-1">({winRate}%)</span>
              </div>
              {/* Casualties */}
              <div className="flex items-center gap-1 text-slate-400">
                <Skull className="w-3 h-3" />
                <span>{stats.casualties.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </button>

        {/* Expanded Battle History */}
        {isExpanded && (
          <div className="mt-1 ml-4 bg-slate-800 rounded-lg border border-slate-600 overflow-hidden">
            {/* Stats Summary */}
            <div className="p-3 border-b border-slate-600">
              <div className="grid grid-cols-4 gap-3 text-xs">
                <div className="text-center">
                  <div className="text-slate-400 mb-1">Casualties</div>
                  <div className="text-white font-bold">{stats.casualties.toLocaleString()}</div>
                </div>
                <div className="text-center">
                  <div className="text-slate-400 mb-1">SP Lost</div>
                  <div className="text-amber-400 font-bold">{stats.spLost}</div>
                </div>
                <div className="text-center">
                  <div className="text-slate-400 mb-1">VP Gained</div>
                  <div className="text-green-400 font-bold">+{stats.vpGained}</div>
                </div>
                <div className="text-center">
                  <div className="text-slate-400 mb-1">VP Lost</div>
                  <div className="text-red-400 font-bold">-{stats.vpLost}</div>
                </div>
              </div>
            </div>

            {/* Battle History */}
            <div className="max-h-48 overflow-y-auto">
              {stats.battles.length === 0 ? (
                <div className="p-3 text-center text-slate-500 text-xs italic">
                  No battles commanded yet
                </div>
              ) : (
                <div className="divide-y divide-slate-700">
                  {stats.battles.map((battle, idx) => (
                    <div key={idx} className="p-2 hover:bg-slate-700/50 transition">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${battle.won ? 'bg-green-500' : 'bg-red-500'}`} />
                          <span className="text-white text-xs font-medium">{battle.territoryName}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            battle.role === 'Attacker' ? 'bg-orange-900/50 text-orange-300' : 'bg-blue-900/50 text-blue-300'
                          }`}>
                            {battle.role}
                          </span>
                        </div>
                        <span className="text-slate-500 text-xs">Turn {battle.turn}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 ml-4 text-xs text-slate-400">
                        <span>{battle.mapName}</span>
                        <span>|</span>
                        <span className="text-red-400">{battle.casualties} cas.</span>
                        <span>|</span>
                        <span className="text-amber-400">-{battle.spLost} SP</span>
                        {battle.vpGained > 0 && (
                          <>
                            <span>|</span>
                            <span className="text-green-400">+{battle.vpGained} VP</span>
                          </>
                        )}
                        {battle.vpLost > 0 && (
                          <>
                            <span>|</span>
                            <span className="text-red-400">-{battle.vpLost} VP</span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <h3 className="text-lg font-bold text-amber-400 flex items-center gap-2 mb-4">
        <Users className="w-5 h-5" />
        Regiment Leaderboard
      </h3>

      <div className="grid grid-cols-2 gap-4">
        {/* USA Regiments */}
        <div>
          <div className="text-blue-400 font-semibold text-sm mb-2 flex items-center gap-2">
            <Target className="w-4 h-4" />
            USA Regiments
          </div>
          {regiments.USA.length === 0 ? (
            <div className="text-slate-500 text-xs italic">No regiments</div>
          ) : (
            regiments.USA.map(regiment => renderRegimentRow(regiment, 'USA'))
          )}
        </div>

        {/* CSA Regiments */}
        <div>
          <div className="text-red-400 font-semibold text-sm mb-2 flex items-center gap-2">
            <Target className="w-4 h-4" />
            CSA Regiments
          </div>
          {regiments.CSA.length === 0 ? (
            <div className="text-slate-500 text-xs italic">No regiments</div>
          ) : (
            regiments.CSA.map(regiment => renderRegimentRow(regiment, 'CSA'))
          )}
        </div>
      </div>
    </div>
  );
};

export default RegimentStats;
