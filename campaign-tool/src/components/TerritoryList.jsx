import { useState } from 'react';
import { MapPin, ChevronDown, ChevronRight, Star } from 'lucide-react';
import { getMaxBattleCPCosts, getVPMultiplier } from '../utils/cpSystem';
import { isTerritorySupplied } from '../utils/supplyLines';
import { Card, CardHead, CardBody, Badge, Row, SIDE_TEXT } from './ui/Primitives';

const FILTERS = [
  { key: 'ALL', label: 'All' },
  { key: 'USA', label: 'USA' },
  { key: 'CSA', label: 'CSA' },
  { key: 'NEUTRAL', label: 'Neutral' },
];

const TerritoryList = ({ territories, onTerritorySelect, spSettings = null }) => {
  const [expandedTerritory, setExpandedTerritory] = useState(null);
  const [filterOwner, setFilterOwner] = useState('ALL');

  const filteredTerritories = territories.filter(t =>
    filterOwner === 'ALL' ? true : t.owner === filterOwner
  );

  const sortedTerritories = [...filteredTerritories].sort((a, b) => {
    // Sort by owner first, then by VP value
    if (a.owner !== b.owner) {
      const ownerOrder = { USA: 0, CSA: 1, NEUTRAL: 2 };
      return ownerOrder[a.owner] - ownerOrder[b.owner];
    }
    return b.victoryPoints - a.victoryPoints;
  });

  const toggleExpand = (territoryId) => {
    setExpandedTerritory(expandedTerritory === territoryId ? null : territoryId);
  };

  return (
    <Card>
      <CardHead
        icon={MapPin}
        title="Territories"
        meta={filteredTerritories.length}
        actions={
          <div className="ui-segment">
            {FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setFilterOwner(f.key)}
                data-active={filterOwner === f.key}
                data-side={f.key}
              >
                {f.label}
              </button>
            ))}
          </div>
        }
      />
      <CardBody className="!p-2">
        <div className="ui-scroll max-h-[30rem] p-1 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-1.5 items-start">
          {sortedTerritories.map(territory => {
            const isOpen = expandedTerritory === territory.id;
            return (
              <div key={territory.id} className="ui-listitem" data-open={isOpen}>
                <div
                  className="ui-listitem-head"
                  onClick={() => {
                    toggleExpand(territory.id);
                    onTerritorySelect(territory);
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isOpen ? (
                      <ChevronDown className="w-4 h-4 text-brass-400 shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-mist-500 shrink-0" />
                    )}
                    {territory.isCapital && (
                      <Star className="w-3.5 h-3.5 text-brass-400 fill-brass-400 shrink-0" />
                    )}
                    <span className="text-sm font-semibold text-mist-100 truncate">{territory.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge tone={territory.owner}>{territory.owner}</Badge>
                    <span className="text-sm font-bold text-mist-100 tabular">
                      {territory.victoryPoints}
                      <span className="text-[10px] text-mist-500 ml-0.5">VP</span>
                    </span>
                  </div>
                </div>

                {isOpen && (
                  <div className="ui-listitem-body space-y-2.5">
                    <Row label="Map" value={territory.mapName} />
                    <Row label="Victory Points" value={territory.victoryPoints} />
                    <Row
                      label="Current Owner"
                      value={<span className={SIDE_TEXT[territory.owner]}>{territory.owner}</span>}
                    />
                    {territory.isCapital && (
                      <Row
                        label="Type"
                        value={
                          <span className="flex items-center gap-1 text-brass-300">
                            <Star className="w-3 h-3 fill-brass-300" />
                            Capital
                          </span>
                        }
                      />
                    )}

                    {/* Capture history */}
                    {territory.captureHistory && territory.captureHistory.length > 0 && (
                      <div className="pt-2.5 border-t border-ink-700">
                        <div className="ui-eyebrow mb-1.5">Capture History</div>
                        <div className="space-y-1">
                          {territory.captureHistory.slice(-3).reverse().map((capture, idx) => (
                            <div key={idx} className="flex justify-between text-xs">
                              <span className="text-mist-500">Turn {capture.turn}</span>
                              <span className={SIDE_TEXT[capture.owner]}>Captured by {capture.owner}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* SP Cost Info */}
                    {spSettings && (() => {
                      const vp = territory.victoryPoints || 1;
                      const isNeutral = territory.owner === 'NEUTRAL';
                      const vpMult = getVPMultiplier(vp, spSettings.vpBase);
                      const attacker = isNeutral ? 'Either side' : (territory.owner === 'USA' ? 'CSA' : 'USA');
                      const defender = isNeutral ? 'Opposing side' : territory.owner;
                      const defenderSide = isNeutral ? 'USA' : territory.owner;
                      const isIsolated = !isNeutral && !isTerritorySupplied(territory, territories);
                      const attackBase = isNeutral ? spSettings.attackNeutral : spSettings.attackEnemy;
                      const defenseBase = isNeutral ? spSettings.defenseNeutral : spSettings.defenseFriendly;
                      const { attackerMax, defenderMax } = getMaxBattleCPCosts(
                        vp, territory.owner, defenderSide,
                        spSettings.vpBase, isIsolated, {
                          attackNeutral: spSettings.attackNeutral,
                          attackEnemy: spSettings.attackEnemy,
                          defenseFriendly: spSettings.defenseFriendly,
                          defenseNeutral: spSettings.defenseNeutral,
                        }
                      );

                      return (
                        <div className="pt-2.5 border-t border-ink-700">
                          <div className="ui-eyebrow mb-1.5">Max SP Loss</div>
                          <div className="space-y-1.5">
                            <div className="ui-inset p-2">
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-mist-300">{attacker} (Attacker)</span>
                                <span className="text-orange-400 font-bold tabular">-{attackerMax} SP</span>
                              </div>
                              <div className="text-[10px] text-mist-500 mt-1">
                                {attackBase} base × {vpMult} VP mult • Attacking {isNeutral ? 'neutral' : 'enemy'} territory
                              </div>
                            </div>
                            <div className="ui-inset p-2">
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-mist-300">{defender} (Defender)</span>
                                <span className="text-orange-400 font-bold tabular">-{defenderMax} SP</span>
                              </div>
                              <div className="text-[10px] text-mist-500 mt-1">
                                {defenseBase} base × {vpMult} VP mult{isIsolated ? ' × 2 (isolated)' : ''} • Defending {isNeutral ? 'neutral' : 'friendly'} territory
                              </div>
                              {isIsolated && (
                                <div className="text-[10px] text-rebel-400 mt-0.5">
                                  2× cost — territory is cut off from supply
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
};

export default TerritoryList;
