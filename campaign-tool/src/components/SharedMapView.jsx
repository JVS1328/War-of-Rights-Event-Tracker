import { useState } from 'react';
import { Map, Trophy, Calendar, Zap, MapPin, ChevronDown, ChevronRight, Star, ExternalLink } from 'lucide-react';
import MapView from './MapView';
import { isTerritorySupplied } from '../utils/supplyLines';
import { getMaxBattleCPCosts, getVPMultiplier } from '../utils/cpSystem';

const SharedMapView = ({ shareData }) => {
  const [selectedTerritory, setSelectedTerritory] = useState(null);
  const [expandedTerritory, setExpandedTerritory] = useState(null);
  const [filterOwner, setFilterOwner] = useState('ALL');

  const { territories, pendingTerritoryIds = [] } = shareData;

  // VP calculations (mirrors CampaignStats logic)
  const usaTerritoryVP = territories
    .filter(t => t.owner === 'USA')
    .filter(t => shareData.instantVP || !t.transitionState?.isTransitioning)
    .reduce((sum, t) => sum + (t.victoryPoints || 0), 0);

  const csaTerritoryVP = territories
    .filter(t => t.owner === 'CSA')
    .filter(t => shareData.instantVP || !t.transitionState?.isTransitioning)
    .reduce((sum, t) => sum + (t.victoryPoints || 0), 0);

  // Territory list filtering & sorting
  const filteredTerritories = territories.filter(t => {
    if (filterOwner === 'ALL') return true;
    return t.owner === filterOwner;
  });

  const sortedTerritories = [...filteredTerritories].sort((a, b) => {
    if (a.owner !== b.owner) {
      const ownerOrder = { USA: 0, CSA: 1, NEUTRAL: 2 };
      return ownerOrder[a.owner] - ownerOrder[b.owner];
    }
    return b.victoryPoints - a.victoryPoints;
  });

  const handleTerritoryClick = (territory) => {
    setSelectedTerritory(prev => prev?.id === territory.id ? null : territory);
  };

  const toggleExpand = (territoryId) => {
    setExpandedTerritory(expandedTerritory === territoryId ? null : territoryId);
  };

  const getOwnerColor = (owner) => {
    if (owner === 'USA') return 'text-blue-400';
    if (owner === 'CSA') return 'text-red-400';
    return 'text-slate-400';
  };

  const getOwnerBg = (owner) => {
    if (owner === 'USA') return 'bg-blue-600';
    if (owner === 'CSA') return 'bg-red-600';
    return 'bg-slate-600';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Map className="w-8 h-8 text-amber-400" />
              <div>
                <h1 className="text-3xl font-bold text-amber-400">
                  {shareData.name}
                </h1>
                <p className="text-slate-400 text-sm mt-1">
                  Turn {shareData.turn}
                  {shareData.date && ` \u2022 ${shareData.date}`}
                  {' \u2022 '}{shareData.battleCount} battles fought
                  {shareData.pendingCount > 0 && (
                    <span className="text-amber-400"> {'\u2022'} {shareData.pendingCount} pending</span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded-lg text-sm border border-slate-600">
                Read-Only View
              </span>
              <a
                href={window.location.origin + window.location.pathname}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg flex items-center gap-2 transition text-sm"
              >
                <ExternalLink className="w-4 h-4" />
                Open Tracker
              </a>
            </div>
          </div>
        </div>

        {/* Map + Stats Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Map - 2 columns */}
          <div className="lg:col-span-2">
            <MapView
              territories={territories}
              selectedTerritory={selectedTerritory}
              onTerritoryClick={handleTerritoryClick}
              onTerritoryDoubleClick={handleTerritoryClick}
              pendingBattleTerritoryIds={pendingTerritoryIds}
              spSettings={shareData.spSettings}
              terrainViz={shareData.terrainViz}
            />
          </div>

          {/* Stats sidebar */}
          <div className="space-y-6">
            {/* Victory Points */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
              <h3 className="text-xl font-bold text-amber-400 flex items-center gap-2 mb-4">
                <Trophy className="w-5 h-5" />
                Victory Points
              </h3>

              <div className="mb-4">
                <div className="flex justify-between items-center">
                  <span className="text-blue-400 font-semibold">USA</span>
                  <div className="flex items-center gap-3">
                    <span className="text-white text-2xl font-bold">{usaTerritoryVP} VP</span>
                    {shareData.cpEnabled && (
                      <span className="text-blue-300 text-lg font-semibold flex items-center gap-1">
                        <Zap className="w-4 h-4" />
                        {shareData.cpUSA} SP
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center">
                  <span className="text-red-400 font-semibold">CSA</span>
                  <div className="flex items-center gap-3">
                    <span className="text-white text-2xl font-bold">{csaTerritoryVP} VP</span>
                    {shareData.cpEnabled && (
                      <span className="text-red-300 text-lg font-semibold flex items-center gap-1">
                        <Zap className="w-4 h-4" />
                        {shareData.cpCSA} SP
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Campaign Info */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
              <h3 className="text-xl font-bold text-amber-400 flex items-center gap-2 mb-4">
                <Calendar className="w-5 h-5" />
                Campaign Info
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Current Turn:</span>
                  <span className="text-white font-semibold">{shareData.turn}</span>
                </div>
                {shareData.date && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Date:</span>
                    <span className="text-white font-semibold">{shareData.date}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Battles Fought:</span>
                  <span className="text-white font-semibold">
                    {shareData.battleCount}
                    {shareData.pendingCount > 0 && (
                      <span className="text-amber-400 text-xs ml-1">
                        (+{shareData.pendingCount} pending)
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Territory Control */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
              <h3 className="text-xl font-bold text-amber-400 mb-4">
                Territory Control
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-blue-400 font-semibold">USA Territories:</span>
                  <span className="text-white font-bold">
                    {territories.filter(t => t.owner === 'USA').length}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-red-400 font-semibold">CSA Territories:</span>
                  <span className="text-white font-bold">
                    {territories.filter(t => t.owner === 'CSA').length}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-semibold">Neutral:</span>
                  <span className="text-white font-bold">
                    {territories.filter(t => t.owner === 'NEUTRAL').length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Territory List */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-amber-400 flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Territories ({filteredTerritories.length})
            </h3>

            <div className="flex gap-1">
              {['ALL', 'USA', 'CSA', 'NEUTRAL'].map(filter => (
                <button
                  key={filter}
                  onClick={() => setFilterOwner(filter)}
                  className={`px-3 py-1 rounded text-xs font-semibold transition ${
                    filterOwner === filter
                      ? filter === 'ALL' ? 'bg-amber-600 text-white'
                        : filter === 'USA' ? 'bg-blue-600 text-white'
                        : filter === 'CSA' ? 'bg-red-600 text-white'
                        : 'bg-slate-500 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {filter === 'ALL' ? 'All' : filter === 'NEUTRAL' ? 'Neutral' : filter}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 max-h-[500px] overflow-y-auto items-start">
            {sortedTerritories.map(territory => {
              const supplied = isTerritorySupplied(territory, territories);
              const isNeutral = territory.owner === 'NEUTRAL';
              const hasPending = pendingTerritoryIds.includes(territory.id);
              const neighbors = territory.adjacentTerritories
                .map(id => territories.find(t => t.id === id))
                .filter(Boolean);

              return (
                <div key={territory.id} className="bg-slate-700 rounded-lg overflow-hidden">
                  <div
                    className="p-3 cursor-pointer hover:bg-slate-600 transition"
                    onClick={() => {
                      toggleExpand(territory.id);
                      handleTerritoryClick(territory);
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1">
                        {expandedTerritory === territory.id ? (
                          <ChevronDown className="w-4 h-4 text-amber-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        )}
                        <div className="flex items-center gap-2">
                          {territory.isCapital && (
                            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                          )}
                          <span className="text-white font-semibold">{territory.name}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {hasPending && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-600 text-white">
                            BATTLE
                          </span>
                        )}
                        {!isNeutral && !supplied && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-700 text-orange-200">
                            ISOLATED
                          </span>
                        )}
                        <span className={`px-2 py-1 rounded text-xs font-bold ${getOwnerBg(territory.owner)} text-white`}>
                          {territory.owner}
                        </span>
                        <span className="text-green-400 font-bold text-sm">
                          {territory.victoryPoints} VP
                        </span>
                      </div>
                    </div>
                  </div>

                  {expandedTerritory === territory.id && (
                    <div className="bg-slate-800 p-4 border-t border-slate-600">
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Current Owner:</span>
                          <span className={`font-semibold ${getOwnerColor(territory.owner)}`}>
                            {territory.owner}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Victory Points:</span>
                          <span className="text-green-400 font-semibold">{territory.victoryPoints}</span>
                        </div>
                        {!isNeutral && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Supply Status:</span>
                            <span className={`font-semibold ${supplied ? 'text-green-400' : 'text-orange-400'}`}>
                              {supplied ? 'Supplied' : 'Isolated'}
                            </span>
                          </div>
                        )}
                        {territory.isCapital && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Type:</span>
                            <span className="text-amber-400 font-semibold flex items-center gap-1">
                              <Star className="w-3 h-3 fill-amber-400" />
                              Capital
                            </span>
                          </div>
                        )}

                        {/* Transition state */}
                        {territory.transitionState?.isTransitioning && (
                          <div className="mt-2 pt-2 border-t border-slate-700">
                            <div className="text-orange-400 font-semibold text-xs mb-1">Ownership Transfer In Progress</div>
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-400">Turns Remaining:</span>
                              <span className="text-yellow-400 font-semibold">{territory.transitionState.turnsRemaining}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-400">Previous Owner:</span>
                              <span className={`font-semibold ${getOwnerColor(territory.transitionState.previousOwner)}`}>
                                {territory.transitionState.previousOwner}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Pending battle */}
                        {hasPending && (
                          <div className="mt-2 pt-2 border-t border-slate-700">
                            <div className="text-amber-400 font-semibold text-xs">Battle Ongoing</div>
                          </div>
                        )}

                        {/* SP Cost Info */}
                        {shareData.spSettings && (() => {
                          const sp = shareData.spSettings;
                          const vp = territory.victoryPoints || 1;
                          const vpMult = getVPMultiplier(vp, sp.vpBase);
                          const attacker = isNeutral ? 'Either side' : (territory.owner === 'USA' ? 'CSA' : 'USA');
                          const defender = isNeutral ? 'Opposing side' : territory.owner;
                          const defenderSide = isNeutral ? 'USA' : (territory.owner === 'USA' ? 'USA' : 'CSA');
                          const isIsolated = !isNeutral && !supplied;
                          const attackBase = isNeutral ? sp.attackNeutral : sp.attackEnemy;
                          const defenseBase = isNeutral ? sp.defenseNeutral : sp.defenseFriendly;
                          const { attackerMax, defenderMax } = getMaxBattleCPCosts(
                            vp, territory.owner, defenderSide,
                            sp.vpBase, isIsolated, {
                              attackNeutral: sp.attackNeutral,
                              attackEnemy: sp.attackEnemy,
                              defenseFriendly: sp.defenseFriendly,
                              defenseNeutral: sp.defenseNeutral,
                            }
                          );

                          return (
                            <div className="mt-2 pt-2 border-t border-slate-700">
                              <div className="text-amber-400 font-semibold text-xs mb-2">Max SP Loss</div>
                              <div className="space-y-2">
                                <div className="bg-slate-700 rounded p-2">
                                  <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-300">{attacker} (Attacker)</span>
                                    <span className="text-orange-400 font-bold">-{attackerMax} SP</span>
                                  </div>
                                  <div className="text-[10px] text-slate-500 mt-1">
                                    {attackBase} base x {vpMult} VP mult • Attacking {isNeutral ? 'neutral' : 'enemy'} territory
                                  </div>
                                </div>
                                <div className="bg-slate-700 rounded p-2">
                                  <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-300">{defender} (Defender)</span>
                                    <span className="text-orange-400 font-bold">-{defenderMax} SP</span>
                                  </div>
                                  <div className="text-[10px] text-slate-500 mt-1">
                                    {defenseBase} base x {vpMult} VP mult{isIsolated ? ' x 2 (isolated)' : ''} • Defending {isNeutral ? 'neutral' : 'friendly'} territory
                                  </div>
                                  {isIsolated && (
                                    <div className="text-[10px] text-red-400 mt-0.5">
                                      2x cost - territory is isolated from supply lines
                                    </div>
                                  )}
                                  {!isNeutral && !isIsolated && (
                                    <div className="text-[10px] text-slate-500 mt-0.5 italic">
                                      Lower cost defending your own territory
                                    </div>
                                  )}
                                  {isNeutral && (
                                    <div className="text-[10px] text-slate-500 mt-0.5 italic">
                                      Higher cost defending neutral ground - no home advantage
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Neighbors */}
                        {neighbors.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-slate-700">
                            <div className="text-slate-400 text-xs mb-1">Neighbors:</div>
                            <div className="flex flex-wrap gap-1">
                              {neighbors.map(n => (
                                <span
                                  key={n.id}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                    n.owner === 'USA' ? 'bg-blue-900 text-blue-300'
                                    : n.owner === 'CSA' ? 'bg-red-900 text-red-300'
                                    : 'bg-slate-600 text-slate-300'
                                  }`}
                                >
                                  {n.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SharedMapView;
