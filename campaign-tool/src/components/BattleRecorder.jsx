import { useState, useEffect } from 'react';
import { X, Swords, Save, AlertCircle } from 'lucide-react';
import { ALL_MAPS } from '../data/territories';
import {
  calculateBattleCPCost,
  getMaxBattleCPCosts,
  getVPMultiplier
} from '../utils/cpSystem';
import {
  getAvailableMapsForTerritory,
  getMapCooldownMessage,
  selectMapsForPickBan
} from '../utils/mapSelection';

const BattleRecorder = ({ territories, currentTurn, onRecordBattle, onClose, campaign }) => {
  const [selectedMap, setSelectedMap] = useState('');
  const [selectedTerritory, setSelectedTerritory] = useState('');
  const [attacker, setAttacker] = useState('USA');
  const [winner, setWinner] = useState('');
  const [casualties, setCasualties] = useState({ USA: 0, CSA: 0 });
  const [notes, setNotes] = useState('');

  // Team ability state
  const [abilityActive, setAbilityActive] = useState(false);

  // Manual CP loss state
  const [manualCPLoss, setManualCPLoss] = useState({ attacker: 0, defender: 0 });

  // Reset ability and pick/ban when attacker changes
  useEffect(() => {
    setAbilityActive(false);
    // Reset pick/ban since defender (who bans first) changes with attacker
    if (pickBanMaps.length > 0 && bannedMaps.length > 0) {
      setBannedMaps([]);
      setPickBanActive(true);
      setSelectedMap('');
    }
  }, [attacker]);

  // Initialize abilities if they don't exist (for backward compatibility)
  const abilities = campaign?.abilities || {
    USA: { name: 'Special Orders 191', cooldown: 0, lastUsedTurn: null },
    CSA: { name: 'Valley Supply Lines', cooldown: 0, lastUsedTurn: null }
  };

  // Map selection with cooldown enforcement
  const [availableMaps, setAvailableMaps] = useState([]);
  const [cooldownMaps, setCooldownMaps] = useState(new Map());
  const [allTerritoryMaps, setAllTerritoryMaps] = useState([]);

  // Pick/ban state
  const [pickBanMaps, setPickBanMaps] = useState([]); // 5 maps for pick/ban
  const [bannedMaps, setBannedMaps] = useState([]); // Maps that have been banned
  const [pickBanActive, setPickBanActive] = useState(false); // Whether pick/ban is in progress

  // CP cost estimation
  const [estimatedCPCost, setEstimatedCPCost] = useState({ attacker: 0, defender: 0 });
  const [maxCPCost, setMaxCPCost] = useState({ attacker: 0, defender: 0 });
  const [cpWarning, setCpWarning] = useState('');
  const [cpBlockingError, setCpBlockingError] = useState('');

  // Check if manual CP mode is enabled
  const isManualCPMode = campaign?.settings?.cpCalculationMode === 'manual';

  // Calculate available maps when territory changes
  useEffect(() => {
    if (!selectedTerritory) {
      setAvailableMaps([]);
      setCooldownMaps(new Map());
      setAllTerritoryMaps([]);
      setSelectedMap('');
      setPickBanMaps([]);
      setBannedMaps([]);
      setPickBanActive(false);
      return;
    }

    const territory = territories.find(t => t.id === selectedTerritory);
    if (!territory) return;

    const { availableMaps: available, cooldownMaps: cooldown } = getAvailableMapsForTerritory(
      territory,
      campaign?.battles || [],
      currentTurn
    );

    // Store all maps for this territory (for showing cooldown info)
    const territoryMaps = territory?.maps && territory.maps.length > 0
      ? territory.maps
      : ALL_MAPS;

    setAllTerritoryMaps(territoryMaps);
    setAvailableMaps(available);
    setCooldownMaps(cooldown);

    // Initialize pick/ban if we have at least 5 available maps
    if (available.length >= 5) {
      const selectedForPickBan = selectMapsForPickBan(available, 5);
      setPickBanMaps(selectedForPickBan);
      setBannedMaps([]);
      setPickBanActive(true);
      setSelectedMap('');
    } else {
      // Not enough maps for pick/ban, use direct selection
      setPickBanMaps([]);
      setBannedMaps([]);
      setPickBanActive(false);
      if (selectedMap && !available.includes(selectedMap)) {
        setSelectedMap('');
      }
    }
  }, [selectedTerritory, territories, campaign, currentTurn]);

  // Calculate estimated CP cost whenever relevant fields change (only in auto mode)
  useEffect(() => {
    if (!selectedTerritory || !campaign?.cpSystemEnabled || isManualCPMode) {
      setEstimatedCPCost({ attacker: 0, defender: 0 });
      setMaxCPCost({ attacker: 0, defender: 0 });
      setCpWarning('');
      setCpBlockingError('');
      return;
    }

    const territory = territories.find(t => t.id === selectedTerritory);
    if (!territory) return;

    // Determine defender - the opposing team always defends, even on neutral ground
    const defender = attacker === 'USA' ? 'CSA' : 'USA';

    // Get casualties
    const attackerCasualties = parseInt(casualties[attacker]) || 0;
    const defenderCasualties = parseInt(casualties[defender === 'USA' ? 'USA' : 'CSA']) || 0;

    const territoryPointValue = territory.pointValue || territory.victoryPoints || 10;

    // Get vpBase from campaign settings (default to 1 for backward compatibility)
    const vpBase = campaign?.settings?.vpBase || 1;

    // Calculate maximum possible CP costs
    const maxCosts = getMaxBattleCPCosts(territoryPointValue, territory.owner, defender, vpBase);
    setMaxCPCost({ attacker: maxCosts.attackerMax, defender: maxCosts.defenderMax });

    // Calculate estimated CP costs using the new system
    const cpResult = calculateBattleCPCost({
      territoryPointValue,
      territoryOwner: territory.owner,
      attacker: attacker,
      winner: winner || attacker, // Default to attacker if no winner selected yet
      attackerCasualties,
      defenderCasualties,
      abilityActive: abilityActive, // Pass ability state
      vpBase: vpBase // Pass VP base from campaign settings
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
  }, [selectedTerritory, attacker, winner, casualties, territories, campaign, abilityActive, isManualCPMode]);

  // Validate manual CP loss inputs
  useEffect(() => {
    if (!campaign?.cpSystemEnabled || !isManualCPMode || !selectedTerritory) {
      return;
    }

    const attackerCP = attacker === 'USA' ? campaign.combatPowerUSA : campaign.combatPowerCSA;
    const territory = territories.find(t => t.id === selectedTerritory);
    // Defender is always the opposing team, even on neutral ground
    const defender = attacker === 'USA' ? 'CSA' : 'USA';
    const defenderCP = defender === 'USA' ? campaign.combatPowerUSA : campaign.combatPowerCSA;

    const attackerLoss = parseInt(manualCPLoss.attacker) || 0;
    const defenderLoss = parseInt(manualCPLoss.defender) || 0;

    // Check if attacker can afford the specified CP loss
    if (attackerCP < attackerLoss) {
      setCpBlockingError(`Attack impossible! ${attacker} needs ${attackerLoss} CP but only has ${attackerCP} CP available.`);
      setCpWarning('');
    } else {
      setCpBlockingError('');
      
      // Non-blocking warning for defender
      if (defender !== 'NEUTRAL' && defenderCP < defenderLoss) {
        setCpWarning(`Warning: ${defender} has insufficient CP. Required: ${defenderLoss}, Available: ${defenderCP}`);
      } else {
        setCpWarning('');
      }
    }
  }, [manualCPLoss, selectedTerritory, attacker, campaign, territories, isManualCPMode]);

  // Pick/ban logic
  const defender = attacker === 'USA' ? 'CSA' : 'USA';
  const remainingMaps = pickBanMaps.filter(m => !bannedMaps.includes(m));

  // Ban order: Defender, Attacker, Defender, Attacker (4 bans total)
  const getBanningTeam = () => {
    const banCount = bannedMaps.length;
    return banCount % 2 === 0 ? defender : attacker;
  };

  const handleBan = (mapName) => {
    if (!pickBanActive || bannedMaps.includes(mapName)) return;

    const newBannedMaps = [...bannedMaps, mapName];
    setBannedMaps(newBannedMaps);

    // After 4 bans, auto-select the remaining map
    if (newBannedMaps.length === 4) {
      const finalMap = pickBanMaps.find(m => !newBannedMaps.includes(m));
      setSelectedMap(finalMap);
      setPickBanActive(false);
    }
  };

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
      notes: notes.trim(),
      abilityUsed: abilityActive ? attacker : null, // Track which side used ability
      manualCPLoss: isManualCPMode ? {
        attacker: parseInt(manualCPLoss.attacker) || 0,
        defender: parseInt(manualCPLoss.defender) || 0
      } : undefined
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
            {/* Territory Selection - Moved before Map Selection */}
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

            {/* Map Selection */}
            <div>
              <label className="block text-sm text-slate-300 mb-2 font-semibold">
                Map <span className="text-red-400">*</span>
              </label>

              {/* Pick/Ban UI - shown when 5+ maps available */}
              {selectedTerritory && pickBanMaps.length === 5 && (
                <div className="bg-slate-700 rounded-lg p-4">
                  {/* Pick/Ban Header */}
                  <div className="flex justify-between items-center mb-3">
                    <div className="text-sm font-semibold text-amber-400">
                      Map Pick/Ban
                    </div>
                    {pickBanActive && (
                      <div className={`text-xs px-2 py-1 rounded border ${
                        getBanningTeam() === 'USA'
                          ? 'bg-blue-900/50 text-blue-300 border-blue-700'
                          : 'bg-red-900/50 text-red-300 border-red-700'
                      }`}>
                        {getBanningTeam()} bans ({bannedMaps.length + 1}/4)
                      </div>
                    )}
                    {!pickBanActive && selectedMap && (
                      <div className="text-xs bg-green-900/50 text-green-300 px-2 py-1 rounded border border-green-700">
                        Map Selected
                      </div>
                    )}
                  </div>

                  {/* Pick/Ban Instructions */}
                  {pickBanActive && (
                    <div className="text-xs text-slate-400 mb-3">
                      {defender} (Defender) bans first. Click a map to ban it.
                    </div>
                  )}

                  {/* Map Grid */}
                  <div className="space-y-2">
                    {pickBanMaps.map((mapName) => {
                      const isBanned = bannedMaps.includes(mapName);
                      const isSelected = selectedMap === mapName;
                      const banIndex = bannedMaps.indexOf(mapName);
                      const bannedBy = banIndex >= 0
                        ? (banIndex % 2 === 0 ? defender : attacker)
                        : null;

                      return (
                        <button
                          key={mapName}
                          onClick={() => handleBan(mapName)}
                          disabled={!pickBanActive || isBanned}
                          className={`w-full px-3 py-2 rounded text-left text-sm transition flex justify-between items-center ${
                            isSelected
                              ? 'bg-green-600 text-white cursor-default'
                              : isBanned
                              ? 'bg-slate-800 text-slate-500 cursor-not-allowed line-through'
                              : 'bg-slate-600 text-white hover:bg-slate-500'
                          }`}
                        >
                          <span>{mapName}</span>
                          {isBanned && (
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              bannedBy === 'USA'
                                ? 'bg-blue-900/50 text-blue-400'
                                : 'bg-red-900/50 text-red-400'
                            }`}>
                              Banned by {bannedBy}
                            </span>
                          )}
                          {isSelected && (
                            <span className="text-xs bg-green-700 px-2 py-0.5 rounded">
                              Playing
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Ban Progress */}
                  {pickBanActive && (
                    <div className="mt-3 flex gap-1">
                      {[0, 1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className={`flex-1 h-1 rounded ${
                            i < bannedMaps.length
                              ? (i % 2 === 0
                                ? (defender === 'USA' ? 'bg-blue-500' : 'bg-red-500')
                                : (attacker === 'USA' ? 'bg-blue-500' : 'bg-red-500'))
                              : 'bg-slate-600'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Regular dropdown - shown when <5 maps available or no territory selected */}
              {selectedTerritory && pickBanMaps.length < 5 && (
                <>
                  <select
                    value={selectedMap}
                    onChange={(e) => setSelectedMap(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:border-amber-500 outline-none"
                  >
                    <option value="">Select map... ({availableMaps.length} available)</option>
                    {availableMaps.map(map => (
                      <option key={map} value={map}>{map}</option>
                    ))}
                  </select>
                  <div className="mt-2 text-xs text-amber-400">
                    Not enough maps for pick/ban (need 5, have {availableMaps.length})
                  </div>
                </>
              )}

              {!selectedTerritory && (
                <select
                  disabled
                  className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600 opacity-50 cursor-not-allowed"
                >
                  <option>Select a territory first...</option>
                </select>
              )}

              {/* Map cooldown information */}
              {selectedTerritory && cooldownMaps.size > 0 && (
                <div className="mt-2 p-3 bg-slate-700/50 rounded border border-slate-600">
                  <div className="text-xs text-amber-400 font-semibold mb-2">
                    Maps on Cooldown ({cooldownMaps.size})
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {Array.from(cooldownMaps.entries())
                      .filter(([mapName]) => allTerritoryMaps.includes(mapName))
                      .sort((a, b) => b[1] - a[1])
                      .map(([mapName, turn]) => (
                        <div key={mapName} className="text-xs text-slate-400 flex justify-between items-center">
                          <span className="truncate">{mapName}</span>
                          <span className="text-orange-400 ml-2 whitespace-nowrap">
                            {getMapCooldownMessage(mapName, cooldownMaps, currentTurn)}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
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

            {/* Team Ability */}
            <div className="bg-slate-700 rounded-lg p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="text-sm font-semibold text-amber-400 mb-1">
                    {abilities[attacker]?.name}
                  </div>
                  <div className="text-xs text-slate-400">
                    {attacker === 'USA'
                      ? 'Failed attacks keep territory neutral, wins triple CSA CP loss'
                      : 'Reduces attack CP loss by 50%'}
                  </div>
                </div>
                {abilities[attacker]?.cooldown > 0 && (
                  <div className="text-xs bg-orange-900/50 text-orange-300 px-2 py-1 rounded border border-orange-700">
                    Cooldown: {abilities[attacker].cooldown} turns
                  </div>
                )}
              </div>

              <button
                onClick={() => setAbilityActive(!abilityActive)}
                disabled={abilities[attacker]?.cooldown > 0}
                className={`w-full px-4 py-2 rounded font-semibold transition flex items-center justify-center gap-2 ${
                  abilities[attacker]?.cooldown > 0
                    ? 'bg-slate-600 cursor-not-allowed opacity-50 text-slate-400'
                    : abilityActive
                    ? attacker === 'USA'
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-slate-600 hover:bg-slate-500 text-white'
                }`}
              >
                {abilityActive ? '✓ Ability Active' : 'Use Ability'}
              </button>

              {abilityActive && (
                <div className="mt-2 p-2 bg-green-900/30 border border-green-700 rounded text-xs text-green-300">
                  ✓ Ability will be activated for this battle
                </div>
              )}
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
                <div className="text-sm font-semibold text-amber-400 mb-3 flex items-center justify-between">
                  <span>Combat Power Costs</span>
                  {isManualCPMode && (
                    <span className="text-xs bg-purple-900/50 text-purple-300 px-2 py-1 rounded border border-purple-700">
                      Manual Mode
                    </span>
                  )}
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
                  
                  {/* Battle CP Costs - Manual Mode */}
                  {isManualCPMode && (
                    <div className="space-y-3">
                      <div className="text-xs text-slate-400 mb-2">
                        Enter CP loss for each side:
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-amber-400 mb-1 font-semibold">
                            {attacker} (Attacker) CP Loss
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={manualCPLoss.attacker}
                            onChange={(e) => setManualCPLoss({ ...manualCPLoss, attacker: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-800 text-white rounded border border-slate-600 focus:border-amber-500 outline-none"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-amber-400 mb-1 font-semibold">
                            {(() => {
                              const territory = territories.find(t => t.id === selectedTerritory);
                              return attacker === 'USA' ?
                                (territory?.owner === 'CSA' ? 'CSA' : 'Defender') :
                                (territory?.owner === 'USA' ? 'USA' : 'Defender');
                            })()} CP Loss
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={manualCPLoss.defender}
                            onChange={(e) => setManualCPLoss({ ...manualCPLoss, defender: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-800 text-white rounded border border-slate-600 focus:border-amber-500 outline-none"
                            placeholder="0"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Battle CP Costs - Auto Mode */}
                  {!isManualCPMode && (
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
                        <div className="text-xs text-slate-400 mb-1">
                          {(() => {
                            const territory = territories.find(t => t.id === selectedTerritory);
                            const isNeutral = territory?.owner === 'NEUTRAL';
                            const baseCP = isNeutral ? 50 : 75;
                            const vpBase = campaign?.settings?.vpBase || 1;
                            const vpMultiplier = getVPMultiplier(territory?.pointValue || territory?.victoryPoints || 10, vpBase);
                            return `Base: ${baseCP} × ${vpMultiplier} (VP mult) × (your casualties ÷ total casualties)`;
                          })()}
                        </div>
                        <div className="text-xs text-amber-400">
                          Max: {maxCPCost.attacker} CP • Attacking {(() => {
                            const territory = territories.find(t => t.id === selectedTerritory);
                            return territory?.owner === 'NEUTRAL' ? 'neutral' : 'enemy';
                          })()} territory
                        </div>
                        <div className="text-xs text-slate-500 mt-1 italic">
                          Attackers pay more CP - the aggressor's burden
                        </div>
                      </div>
                      
                      {(() => {
                        const territory = territories.find(t => t.id === selectedTerritory);
                        const defender = attacker === 'USA' ? 'CSA' : 'USA';
                        
                        const isNeutral = territory.owner === 'NEUTRAL';
                        const isFriendly = territory.owner === defender;
                        // Defender base cost: 25 if defending own territory, 50 if defending neutral/enemy
                        const baseCP = isFriendly ? 25 : 50;
                        const vpBase = campaign?.settings?.vpBase || 1;
                        const vpMultiplier = getVPMultiplier(territory?.pointValue || territory?.victoryPoints || 10, vpBase);
                        
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
                            <div className="text-xs text-slate-400 mb-1">
                              Base: {baseCP} × {vpMultiplier} (VP mult) × (your casualties ÷ total casualties)
                            </div>
                            <div className="text-xs text-amber-400">
                              Max: {maxCPCost.defender} CP • Defending {isFriendly ? 'friendly' : 'neutral'} territory
                            </div>
                            <div className="text-xs text-slate-500 mt-1 italic">
                              {isFriendly
                                ? 'Lower cost defending your own territory'
                                : 'Higher cost defending neutral ground - no home advantage'}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
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