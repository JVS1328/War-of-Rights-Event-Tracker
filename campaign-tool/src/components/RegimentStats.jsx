import { useState } from 'react';
import { ChevronDown, ChevronRight, Users, Trophy } from 'lucide-react';
import { Card, CardHead, CardBody } from './ui/Primitives';

/**
 * RegimentStats - Regiment leaderboard with expandable battle history
 *
 * Collapsed by default, showing W/L and casualties. Expanding a regiment
 * reveals its aggregate stats and every battle it commanded.
 */
const RegimentStats = ({ campaign }) => {
  const [expandedRegiments, setExpandedRegiments] = useState({});

  const regiments = campaign?.regiments || { USA: [], CSA: [] };
  const regimentStats = campaign?.regimentStats || {};

  const hasRegiments = regiments.USA.length > 0 || regiments.CSA.length > 0;
  if (!hasRegiments) return null;

  const toggleRegiment = (regimentId) => {
    setExpandedRegiments(prev => ({ ...prev, [regimentId]: !prev[regimentId] }));
  };

  const getRegimentStats = (regimentId) =>
    regimentStats[regimentId] || {
      wins: 0, losses: 0, casualties: 0, spLost: 0, vpGained: 0, vpLost: 0, battles: []
    };

  const getWinRate = (stats) => {
    const total = stats.wins + stats.losses;
    return total === 0 ? 0 : Math.round((stats.wins / total) * 100);
  };

  const renderRegimentRow = (regiment, side) => {
    const stats = getRegimentStats(regiment.id);
    const isExpanded = expandedRegiments[regiment.id];
    const isUSA = side === 'USA';
    const accent = isUSA ? 'text-union-400' : 'text-rebel-400';
    const winRate = getWinRate(stats);
    const played = stats.wins + stats.losses;

    return (
      <div key={regiment.id} className="ui-listitem" data-open={isExpanded}>
        <button onClick={() => toggleRegiment(regiment.id)} className="ui-listitem-head">
          <div className="flex items-center gap-2 min-w-0">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-brass-400 shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-mist-500 shrink-0" />
            )}
            <span className={`text-sm font-semibold ${accent} truncate`}>{regiment.name}</span>
          </div>
          <div className="flex items-center gap-3 shrink-0 tabular">
            {played === 0 ? (
              <span className="text-xs text-mist-500">No battles</span>
            ) : (
              <>
                <span className="text-xs">
                  <span className="text-emerald-400 font-semibold">{stats.wins}</span>
                  <span className="text-mist-600 mx-0.5">–</span>
                  <span className="text-rebel-400 font-semibold">{stats.losses}</span>
                </span>
                <span className="text-[11px] text-mist-500 w-9 text-right">{winRate}%</span>
              </>
            )}
          </div>
        </button>

        {isExpanded && (
          <div className="ui-listitem-body !p-0">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 border-b border-ink-700 text-center">
              {[
                ['Casualties', stats.casualties.toLocaleString(), 'text-mist-100'],
                ['SP Lost', stats.spLost, 'text-brass-300'],
                ['VP Gained', `+${stats.vpGained}`, 'text-emerald-400'],
                ['VP Lost', `-${stats.vpLost}`, 'text-rebel-400'],
              ].map(([label, value, tone]) => (
                <div key={label}>
                  <div className="text-[10px] uppercase tracking-wider text-mist-500 mb-0.5">{label}</div>
                  <div className={`text-sm font-bold tabular ${tone}`}>{value}</div>
                </div>
              ))}
            </div>

            <div className="ui-scroll max-h-48">
              {stats.battles.length === 0 ? (
                <div className="p-3 text-center text-xs text-mist-500">No battles commanded yet</div>
              ) : (
                <div className="divide-y divide-ink-700">
                  {stats.battles.map((battle, idx) => (
                    <div key={idx} className="p-2.5 hover:bg-ink-800/60 transition">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${battle.won ? 'bg-emerald-400' : 'bg-rebel-500'}`} />
                          <span className="text-xs font-medium text-mist-100 truncate">{battle.territoryName}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
                            battle.role === 'Attacker'
                              ? 'bg-orange-950 text-orange-300'
                              : 'bg-union-900 text-union-400'
                          }`}>
                            {battle.role}
                          </span>
                        </div>
                        <span className="text-[11px] text-mist-500 shrink-0">Turn {battle.turn}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2.5 mt-1 ml-3.5 text-[11px] text-mist-500 tabular">
                        <span>{battle.mapName}</span>
                        <span className="text-rebel-400">{battle.casualties} cas.</span>
                        <span className="text-brass-300">-{battle.spLost} SP</span>
                        {battle.vpGained > 0 && <span className="text-emerald-400">+{battle.vpGained} VP</span>}
                        {battle.vpLost > 0 && <span className="text-rebel-400">-{battle.vpLost} VP</span>}
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
    <Card>
      <CardHead icon={Trophy} title="Regiment Leaderboard" />
      <CardBody className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
        {['USA', 'CSA'].map(side => (
          <div key={side}>
            <div className={`ui-eyebrow mb-2 flex items-center gap-1.5 ${side === 'USA' ? 'text-union-400' : 'text-rebel-400'}`}>
              <Users className="w-3.5 h-3.5" />
              {side} Regiments
            </div>
            {regiments[side].length === 0 ? (
              <div className="text-xs text-mist-500">No regiments</div>
            ) : (
              <div className="space-y-1.5">
                {regiments[side].map(regiment => renderRegimentRow(regiment, side))}
              </div>
            )}
          </div>
        ))}
      </CardBody>
    </Card>
  );
};

export default RegimentStats;
