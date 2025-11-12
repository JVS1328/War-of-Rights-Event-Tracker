import { useState, useEffect } from 'react';
import { X, Swords, Save, AlertCircle } from 'lucide-react';
import { ALL_MAPS } from '../data/territories';
import {
  calculateBattleCPCost,
  getMaxBattleCPCosts
} from '../utils/cpSystem';

const BattleRecorder = ({ territories, currentTurn, onRecordBattle, onClose, campaign }) => {
  const [selectedMap, setSelectedMap] = useState('');
  const [selectedTerritory, setSelectedTerritory] = useState('');
  const [attacker, setAttacker] = useState('USA');
  const [winner, setWinner] = useState('');
  const [casualties, setCasualties] = useState({ USA: 0, CSA: 0 });
  const [notes, setNotes] = useState('');
  
  // CP cost estimation
  const [estimatedCPCost, setEstimatedCPCost] = useState({ attacker: 0, defender: 0 });
  const [maxCPCost, setMaxCPCost] = useState({ attacker: 0, defender: 0 });
  const [cpWarning, setCpWarning] = useState('');
  const [cpBlockingError, setCpBlockingError] = useState('');

  // Calculate estimated CP cost whenever relevant fields change
  useEffect(() => {
    if (!selectedTerritory || !campaign?.cpSystemEnabled) {
      setEstimatedCPCost({ attacker: 0, defender: 0 });
      setMaxCPCost({ attacker: 0, defender: 0 });
      setCpWarning('');
      setCpBlockingError('');
      return;
    }

    const territory = territories.find(t => t.id === selectedTerritory);
    if (!territory) return;

    // Determine defender
    const defender = attacker === 'USA' ?
      (territory.owner === 'CSA' ? 'CSA' : 'NEUTRAL') :
      (territory.owner === 'USA' ? 'USA' : 'NEUTRAL');

    // Get casualties
    const attackerCasualties = parseInt(casualties[attacker]) || 0;
    const defenderCasualties = parseInt(casualties[defender === 'USA' ? 'USA' : 'CSA']) || 0;

    const territoryPointValue = territory.pointValue || territory.victoryPoints || 10;

    // Calculate maximum possible CP costs
    const maxCosts = getMaxBattleCPCosts(territoryPointValue, territory.owner, defender);
    setMaxCPCost({ attacker: maxCosts.attackerMax, defender: maxCosts.defenderMax });

    // Calculate estimated CP costs using the new system
    const cpResult = calculateBattleCPCost({
      territoryPointValue,
      territoryOwner: territory.owner,
      attacker: attacker,
      winner: winner || attacker, // Default to attacker if no winner selected yet
      attackerCasualties,
      defenderCasualties
    });

    setEstimatedCPCost({ attacker: cpResult.attackerLoss, defender: cpResult.defenderLoss });

    // Check CP availability
    const attackerCP = attacker === 'USA' ? campaign.combatPowerUSA : campaign.combatPowerCSA;
    const defenderCP = defender === 'USA' ? campaign.combatPowerUSA :
                       defender === 'CSA' ? campaign.combatPowerCSA : 0;

    // BLOCKING ERROR: Check if attacker can afford maximum possible CP loss
    if (attackerCP < maxCosts.attackerMax) {
      setCpBlockingError(`Attack impossible! ${attacker} needs ${maxCosts.attackerMax} CP to attack this territory but only has ${attackerCP} CP available.`);
      setCpWarning('');
    } else {
      setCpBlockingError('');
      
      // Non-blocking warnings for estimated costs
      if (attackerCP < cpResult.attackerLoss) {
        setCpWarning(`Warning: Estimated CP cost (${cpResult.attackerLoss}) exceeds available CP (${attackerCP})`);
      } else if (defender !== 'NEUTRAL' && defenderCP < cpResult.defenderLoss) {
        setCpWarning(`Warning: ${defender} has insufficient CP. Required: ${cpResult.defenderLoss}, Available: ${defenderCP}`);
      } else {
        setCpWarning('');
      }
    }
  }, [selectedTerritory, attacker, winner, casualties, territories, campaign]);

  const handleSubmit = () => {
    if (!selectedMap || !selectedTerritory || !winner) {
      alert('Please select a map, territory, and winner');
      return;
    }

    // HARD BLOCK: Prevent battle if attacker cannot afford maximum possible CP loss
    if (campaign?.cpSystemEnabled && cpBlockingError) {
      alert(cpBlockingError);
      return;
    }

    // Non-blocking warning for estimated costs
    if (campaign?.cpSystemEnabled && cpWarning) {
      if (!confirm(`${cpWarning}\n\nProceed anyway? (Battle will use available CP)`)) {
        return;
      }
    }

    const battle = {
      id: Date.now().toString(),
      turn: currentTurn,
      date: new Date().toISOString(),
      territoryId: selectedTerritory,
      mapName: selectedMap,
      attacker,
      winner,
      casualties: {
        USA: parseInt(casualties.USA) || 0,
        CSA: parseInt(casualties.CSA) || 0
      },
      notes: notes.trim()
    };

    onRecordBattle(battle);
  };

  const getWinnerColor = (side) => {
    return side === 'USA' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg shadow-2xl border border-slate-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
              <Swords className="w-6 h-6" />
              Record Battle - Turn {currentTurn}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-700 rounded-lg transition"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          {/* Form */}
          <div className="space-y-4">
            {/* Map Selection */}
            <div>
              <label className="block text-sm text-slate-300 mb-2 font-semibold">
                Map <span className="text-red-400">*</span>
              </label>
              <select
                value={selectedMap}
                onChange={(e) => setSelectedMap(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:border-amber-500 outline-none"
              >
                <option value="">Select map...</option>
                {ALL_MAPS.map(map => (
                  <option key={map} value={map}>{map}</option>
                ))}
              </select>
            </div>

            {/* Territory Selection */}
            <div>
              <label className="block text-sm text-slate-300 mb-2 font-semibold">
                Territory <span className="text-red-400">*</span>
              </label>
              <select
                value={selectedTerritory}
                onChange={(e) => setSelectedTerritory(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:border-amber-500 outline-none"
              >
                <option value="">Select territory...</option>
                {territories.map(territory => (
                  <option key={territory.id} value={territory.id}>
                    {territory.name} ({territory.owner}) - {territory.victoryPoints} VP
                  </option>
                ))}
              </select>
            </div>

            {/* Territory Info Display */}
            {selectedTerritory && (
              <div className="bg-slate-700 rounded p-3">
                {(() => {
                  const territory = territories.find(t => t.id === selectedTerritory);
                  return (
                    <>
                      <div className="text-sm text-slate-400 mb-1">Selected Territory:</div>
                      <div className="flex justify-between items-center">
                        <span className="text-white font-semibold">{territory.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-400 text-sm">
                            Current Owner: <span className={`font-semibold ${
                              territory.owner === 'USA' ? 'text-blue-400' :
                              territory.owner === 'CSA' ? 'text-red-400' :
                              'text-slate-400'
                            }`}>{territory.owner}</span>
                          </span>
                          <span className="text-green-400 font-semibold text-sm">
                            {territory.victoryPoints} VP
                          </span>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {/* Attacker Selection */}
            <div>
              <label className="block text-sm text-slate-300 mb-2 font-semibold">
                Attacker
              </label>
              <div className="flex gap-3">
                <button
                  onClick={() => setAttacker('USA')}
                  className={`flex-1 px-4 py-2 rounded font-semibold transition ${
                    attacker === 'USA'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  USA
                </button>
                <button
                  onClick={() => setAttacker('CSA')}
                  className={`flex-1 px-4 py-2 rounded font-semibold transition ${
                    attacker === 'CSA'
                      ? 'bg-red-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  CSA
                </button>
              </div>
            </div>

            {/* Winner Selection */}
            <div>
              <label className="block text-sm text-slate-300 mb-2 font-semibold">
                Winner <span className="text-red-400">*</span>
              </label>
              <div className="flex gap-3">
                <button
                  onClick={() => setWinner('USA')}
                  className={`flex-1 px-4 py-2 rounded font-semibold transition ${
                    winner === 'USA'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  USA Victory
                </button>
                <button
                  onClick={() => setWinner('CSA')}
                  className={`flex-1 px-4 py-2 rounded font-semibold transition ${
                    winner === 'CSA'
                      ? 'bg-red-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  CSA Victory
                </button>
              </div>
            </div>

            {/* Casualties */}
            <div>
              <label className="block text-sm text-slate-300 mb-2 font-semibold">
                Casualties (Optional)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-blue-400 mb-1">USA Casualties</label>
                  <input
                    type="number"
                    min="0"
                    value={casualties.USA}
                    onChange={(e) => setCasualties({ ...casualties, USA: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:border-amber-500 outline-none"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs text-red-400 mb-1">CSA Casualties</label>
                  <input
                    type="number"
                    min="0"
                    value={casualties.CSA}
                    onChange={(e) => setCasualties({ ...casualties, CSA: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:border-amber-500 outline-none"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* CP Cost Display */}
            {campaign?.cpSystemEnabled && selectedTerritory && (
              <div className="bg-slate-700 rounded-lg p-4">
                <div className="text-sm font-semibold text-amber-400 mb-3">
                  Combat Power Costs
                </div>
                
                <div className="space-y-3">
                  {/* Current CP Pools */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-slate-800 rounded p-2">
                      <div className="text-slate-400 text-xs mb-1">USA CP Pool</div>
                      <div className="text-blue-400 font-bold text-lg">{campaign.combatPowerUSA || 0}</div>
                    </div>
                    <div className="bg-slate-800 rounded p-2">
                      <div className="text-slate-400 text-xs mb-1">CSA CP Pool</div>
                      <div className="text-red-400 font-bold text-lg">{campaign.combatPowerCSA || 0}</div>
                    </div>
                  </div>
                  
                  <div className="border-t border-slate-600"></div>
                  
                  {/* Battle CP Costs */}
                  <div className="space-y-2 text-sm">
                    <div className="bg-slate-800 rounded p-3">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-slate-300 font-semibold">
                          {attacker} (Attacker)
                        </span>
                        <span className={`font-bold text-lg ${
                          attacker === 'USA' ? 'text-blue-400' : 'text-red-400'
                        }`}>
                          -{estimatedCPCost.attacker} CP
                        </span>
                      </div>
                      <div className="text-xs text-slate-400">
                        Estimated cost based on casualties
                      </div>
                      <div className="text-xs text-amber-400 mt-1">
                        Maximum possible loss: {maxCPCost.attacker} CP
                      </div>
                    </div>
                    
                    {(() => {
                      const territory = territories.find(t => t.id === selectedTerritory);
                      const defender = attacker === 'USA' ? 'CSA' : 'USA';
                      
                      const defenderWon = winner !== attacker;
                      const isNeutral = territory.owner === 'NEUTRAL';
                      const isFriendly = territory.owner === defender;
                      
                      return (
                        <div className="bg-slate-800 rounded p-3">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-slate-300 font-semibold">
                              {defender} (Defender)
                            </span>
                            <span className={`font-bold text-lg ${
                              defender === 'USA' ? 'text-blue-400' : 'text-red-400'
                            }`}>
                              -{estimatedCPCost.defender} CP
                            </span>
                          </div>
                          <div className="text-xs text-slate-400">
                            {defenderWon
                              ? 'Base: 25 × VP multiplier × (casualties / total casualties)'
                              : `Max loss: ${isFriendly ? '25' : '50'} CP (${isNeutral ? 'neutral' : isFriendly ? 'friendly' : 'enemy'} territory)`
                            }
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Blocking Error - Attack Impossible */}
                {cpBlockingError && (
                  <div className="mt-3 p-3 bg-red-900/50 border-2 border-red-500 rounded flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="text-red-300 font-bold text-sm mb-1">ATTACK BLOCKED</div>
                      <span className="text-red-300 text-sm">{cpBlockingError}</span>
                    </div>
                  </div>
                )}
                
                {/* Non-blocking Warning */}
                {!cpBlockingError && cpWarning && (
                  <div className="mt-3 p-3 bg-yellow-900/30 border border-yellow-500 rounded flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <span className="text-yellow-300 text-sm">{cpWarning}</span>
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-sm text-slate-300 mb-2 font-semibold">
                Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:border-amber-500 outline-none resize-none"
                rows="3"
                placeholder="Add any additional notes about this battle..."
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={handleSubmit}
              disabled={campaign?.cpSystemEnabled && cpBlockingError}
              className={`flex-1 px-4 py-3 text-white rounded-lg font-semibold transition flex items-center justify-center gap-2 ${
                campaign?.cpSystemEnabled && cpBlockingError
                  ? 'bg-slate-600 cursor-not-allowed opacity-50'
                  : campaign?.cpSystemEnabled && cpWarning
                  ? 'bg-orange-600 hover:bg-orange-700'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              <Save className="w-4 h-4" />
              {campaign?.cpSystemEnabled && cpBlockingError
                ? 'Attack Blocked - Insufficient CP'
                : campaign?.cpSystemEnabled && cpWarning
                ? 'Record Battle (Warning)'
                : 'Record Battle'}
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-slate-600 hover:bg-slate-500 text-white rounded-lg font-semibold transition"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BattleRecorder;