import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Map, Users, Edit, Layers, Download, Upload, Plus, Trophy,
  ArrowLeftRight, HelpCircle
} from 'lucide-react';

import HexBoard from './components/HexBoard';
import BoardEditor from './components/BoardEditor';
import UnitRegistry from './components/UnitRegistry';
import FactionSheet from './components/FactionSheet';
import Calendar from './components/Calendar';
import TurnBags from './components/TurnBags';
import VictoriesBoard from './components/VictoriesBoard';
import DeckViewer from './components/DeckViewer';
import ActionPanel from './components/ActionPanel';
import GrandBattleRecorder from './components/GrandBattleRecorder';
import {
  GarrisonDialog, ReplenishDialog, CoinTossDialog, MonthEndDialog
} from './components/SmallDialogs';

import { createGrandCampaign } from './data/grandTemplate';
import { getCityByHex, TERRAIN } from './data/defaultBoard';
import { getCardById } from './data/starterCards';

import {
  fillBags, drawFromBag, bothBagsEmpty, advanceMonth, drawEventCard,
  discardEventCard, setCoinTossWinner, switchActiveSide, clearActiveUnit, setPhase
} from './utils/turnRules';
import {
  reachableForUnit, executeMove, endUnitTurn, resetMovementForUnit, MOVE_MODE
} from './utils/movementRules';
import { processBattleOutcome } from './utils/combatRules';
import {
  applyMonthlyIncome, executeReplenish, executeSetGarrison
} from './utils/economyRules';
import { checkGrandVictory } from './utils/victoryRules';
import { drawTop, discardCard } from './utils/cardRules';
import { prepareGrandExport, validateGrandCampaign } from './utils/grandValidation';
import { hexKey, parseKey } from './utils/hexMath';

const STORAGE_KEY = 'WarOfRightsGrandCampaign';

const GrandCampaign = ({
  campaign: initialCampaign,
  onExit
}) => {
  const [campaign, setCampaign] = useState(initialCampaign);

  const [showUnitRegistry, setShowUnitRegistry] = useState(false);
  const [showBoardEditor, setShowBoardEditor] = useState(false);
  const [showDeckViewer, setShowDeckViewer] = useState(false);
  const [showCoinToss, setShowCoinToss] = useState(false);
  const [showMonthEnd, setShowMonthEnd] = useState(null);
  const [showVictory, setShowVictory] = useState(null);
  const [showGarrison, setShowGarrison] = useState(null);
  const [showReplenish, setShowReplenish] = useState(null);
  const [battleContext, setBattleContext] = useState(null);

  const [selectedHex, setSelectedHex] = useState(null);
  const [moveMode, setMoveMode] = useState(null);
  const [reinforcingIds, setReinforcingIds] = useState([]);
  const [lastDrawResult, setLastDrawResult] = useState(null);

  // Persist to localStorage on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(campaign));
  }, [campaign]);

  // Victory watcher
  useEffect(() => {
    if (showVictory) return;
    const v = checkGrandVictory(campaign);
    if (v) setShowVictory(v);
  }, [campaign.factions.USA.vp, campaign.factions.CSA.vp]);

  const activeUnit = useMemo(() => {
    const id = campaign.turn.activeUnitId;
    return id ? campaign.units.find(u => u.id === id) : null;
  }, [campaign]);

  // Reachable hexes when in move mode
  const reachableHexes = useMemo(() => {
    if (!activeUnit || !moveMode) return null;
    return reachableForUnit(campaign, activeUnit, moveMode);
  }, [activeUnit, moveMode, campaign]);

  // === Phase entry points ===

  const handleCoinToss = (winner) => {
    let c = setCoinTossWinner(campaign, winner);
    c = fillBags(c);
    c = setPhase(c, 'placement');
    setCampaign(c);
    setShowCoinToss(false);
  };

  const handleDrawForPlacement = (side) => {
    const { campaign: after, unitId } = drawFromBag(campaign, side);
    if (!unitId) return;
    setCampaign({
      ...after,
      turn: { ...after.turn, placementDrawnId: unitId, activeUnitId: null }
    });
  };

  const handlePlacementClick = (hexK) => {
    const drawnId = campaign.turn.placementDrawnId;
    if (!drawnId) return;
    const tile = campaign.board.hexes[hexK];
    if (!tile || tile.terrain === TERRAIN.WATER) {
      alert('Cannot place on water.');
      return;
    }
    if (campaign.units.some(u => u.hexKey === hexK && !u.wiped)) {
      alert('Hex already occupied.');
      return;
    }
    const units = campaign.units.map(u =>
      u.id === drawnId ? { ...u, hexKey: hexK } : u
    );
    let c = { ...campaign, units, turn: { ...campaign.turn, placementDrawnId: null } };

    // If both bags now empty, advance to play phase and refill for month 1
    if (bothBagsEmpty(c)) {
      c = fillBags(c);
      c = setPhase(c, 'play');
      c = { ...c, turn: { ...c.turn, activeSide: c.turn.coinTossWinner, activeUnitId: null } };
    } else {
      // Switch sides if the next side still has units in bag
      c = switchActiveSide(c);
      // If the newly-active side has no units in bag, fall back
      if (c.turn.bags[c.turn.activeSide].length === 0 && c.turn.bags[c.turn.activeSide === 'USA' ? 'CSA' : 'USA'].length > 0) {
        c = switchActiveSide(c);
      }
    }
    setCampaign(c);
  };

  const handleDrawFromBag = (side) => {
    let c = campaign;
    let attempts = 0;
    while (attempts < 20) {
      const res = drawFromBag(c, side);
      if (!res.unitId) return;
      c = res.campaign;
      if (!res.skipped) {
        const unit = c.units.find(u => u.id === res.unitId);
        // Reset MP + fatigue-if-no-combat happens when turn ends
        c = resetMovementForUnit(c, res.unitId);
        setCampaign(c);
        setLastDrawResult({ side, unitName: unit.name, at: Date.now() });
        return;
      }
      // skipped (engaged in combat) → continue drawing
      attempts++;
    }
    setCampaign(c);
  };

  const handleEndUnitTurn = () => {
    if (!activeUnit) return;
    // Reset fatigue if this unit did not engage in combat this draw
    const engagedThisDraw = (campaign.battles || []).some(b =>
      b.turn === campaign.turn.turnNumber &&
      (b.attackerUnitId === activeUnit.id || b.defenderUnitId === activeUnit.id)
    );
    let c = { ...campaign };
    c.units = c.units.map(u =>
      u.id === activeUnit.id
        ? { ...u, fatigue: engagedThisDraw ? u.fatigue : 0, remainingMP: 0, currentMode: null, onTrain: false, onRiver: u.onRiver }
        : u
    );
    c = clearActiveUnit(c);
    c = switchActiveSide(c);

    // If both bags empty, kick into month-end
    if (bothBagsEmpty(c)) {
      triggerMonthEnd(c);
      return;
    }
    // If the new active side's bag is empty, fall back
    if (c.turn.bags[c.turn.activeSide].length === 0) {
      c = switchActiveSide(c);
    }
    setMoveMode(null);
    setCampaign(c);
  };

  const triggerMonthEnd = (baseCampaign) => {
    let c = baseCampaign;
    const income = {
      USA: {
        money: c.factions.USA.money,
        manpower: c.factions.USA.manpower
      },
      CSA: {
        money: c.factions.CSA.money,
        manpower: c.factions.CSA.manpower
      }
    };
    const beforeUSA = { ...c.factions.USA };
    const beforeCSA = { ...c.factions.CSA };
    c = applyMonthlyIncome(c);
    const deltaUSA = {
      money: c.factions.USA.money - beforeUSA.money,
      manpower: c.factions.USA.manpower - beforeUSA.manpower
    };
    const deltaCSA = {
      money: c.factions.CSA.money - beforeCSA.money,
      manpower: c.factions.CSA.manpower - beforeCSA.manpower
    };

    c = advanceMonth(c, c.settings.winterMonths || [12, 1, 2]);
    c = drawEventCard(c);
    const eventCard = c.turn.eventCardId ? getCardById('event', c.turn.eventCardId) : null;

    setCampaign(c);
    setShowMonthEnd({ incomeUSA: deltaUSA, incomeCSA: deltaCSA, eventCard });
  };

  const handleMonthEndContinue = () => {
    let c = fillBags(campaign);
    c = { ...c, turn: { ...c.turn, activeSide: c.turn.coinTossWinner, activeUnitId: null } };
    setCampaign(c);
    setShowMonthEnd(null);
  };

  const handleHexClick = (hexK) => {
    if (campaign.turn.phase === 'placement' && campaign.turn.placementDrawnId) {
      handlePlacementClick(hexK);
      return;
    }
    // In move mode, try to move the active unit to this hex
    if (campaign.turn.phase === 'play' && activeUnit && moveMode && reachableHexes?.[hexK]) {
      const target = reachableHexes[hexK];
      if (hexK === activeUnit.hexKey) return; // starting hex
      let c = executeMove(campaign, activeUnit.id, hexK, moveMode, target.mpUsed - (reachableHexes[activeUnit.hexKey]?.mpUsed || 0));
      // Full-cost version: target.mpUsed is total from start, so set remaining explicitly
      const originalMP = activeUnit.remainingMP ?? campaign.settings.mpPerTurn;
      c = {
        ...c,
        units: c.units.map(u =>
          u.id === activeUnit.id
            ? { ...u, remainingMP: Math.max(0, originalMP - target.mpUsed), hexKey: hexK, currentMode: moveMode }
            : u
        )
      };
      // Train/river embark disembark ends turn
      if (moveMode === MOVE_MODE.TRAIN) {
        // Per rules: disembark ends turn unless Rails card. We don't detect the card, so auto end.
        const targetCity = getCityByHex(c.board, hexK);
        if (!targetCity) {
          // jumped off train mid-route (shouldn't happen in our simplified model)
          c = { ...c, units: c.units.map(u => u.id === activeUnit.id ? { ...u, onTrain: false } : u) };
        }
      }
      if (moveMode === MOVE_MODE.RIVER) {
        c = { ...c, units: c.units.map(u => u.id === activeUnit.id ? { ...u, onRiver: true } : u) };
      }
      setCampaign(c);
      setMoveMode(null);
      // If MP exhausted, auto-end the unit's turn
      const updated = c.units.find(u => u.id === activeUnit.id);
      if (updated.remainingMP <= 0) {
        setTimeout(() => handleEndUnitTurn(), 100);
      }
      return;
    }
    setSelectedHex(prev => prev === hexK ? null : hexK);
  };

  const handleAttack = (targetHex) => {
    if (!activeUnit) return;
    const enemyUnit = campaign.units.find(u => u.hexKey === targetHex && !u.wiped && u.faction !== activeUnit.faction);
    setBattleContext({
      attackerId: activeUnit.id,
      defenderId: enemyUnit?.id || null,
      targetHex
    });
  };

  const handleBattleResolved = (battle) => {
    let c = { ...campaign };
    c.units = c.units.map(u =>
      (u.id === battle.attackerUnitId || u.id === battle.defenderUnitId)
        ? { ...u, engagedBattleId: battle.id }
        : u
    );
    battle.reinforcingUnitIds = reinforcingIds.filter(id => {
      const u = c.units.find(x => x.id === id);
      return u && !u.wiped && u.faction === (c.units.find(x => x.id === battle.attackerUnitId || x.id === battle.defenderUnitId)?.faction);
    });

    // Discard drawn weather/time cards
    if (battle.weatherCardId) {
      c = { ...c, decks: { ...c.decks, weather: discardCard(c.decks.weather, battle.weatherCardId) } };
    }
    if (battle.timeCardId) {
      c = { ...c, decks: { ...c.decks, time: discardCard(c.decks.time, battle.timeCardId) } };
    }

    c = processBattleOutcome(c, battle);

    // Auto-end attacker's turn after combat
    c = { ...c, units: c.units.map(u => u.id === battle.attackerUnitId ? { ...u, remainingMP: 0 } : u) };
    c = clearActiveUnit(c);
    c = switchActiveSide(c);

    if (c.turn.bags[c.turn.activeSide]?.length === 0 && c.turn.bags[c.turn.activeSide === 'USA' ? 'CSA' : 'USA'].length > 0) {
      c = switchActiveSide(c);
    }

    setCampaign(c);
    setBattleContext(null);
    setMoveMode(null);
    setReinforcingIds([]);

    if (bothBagsEmpty(c)) {
      triggerMonthEnd(c);
    }
  };

  const handleReinforceToggle = () => {
    if (!activeUnit) return;
    setReinforcingIds(prev =>
      prev.includes(activeUnit.id)
        ? prev.filter(id => id !== activeUnit.id)
        : [...prev, activeUnit.id]
    );
  };

  const handleReplenishConfirm = () => {
    if (!activeUnit) return;
    const { campaign: next, error } = executeReplenish(campaign, activeUnit.id);
    if (error) {
      alert(error);
      return;
    }
    setCampaign(next);
    setShowReplenish(null);
    setTimeout(() => handleEndUnitTurn(), 50);
  };

  const handleGarrisonConfirm = (amount) => {
    if (!activeUnit) return;
    const { campaign: next, error } = executeSetGarrison(campaign, activeUnit.id, amount);
    if (error) {
      alert(error);
      return;
    }
    setCampaign(next);
    setShowGarrison(null);
    setTimeout(() => handleEndUnitTurn(), 50);
  };

  const handleClaimSpecial = (side) => {
    const { card, deck: nextDeck } = drawTop(campaign.decks.special);
    if (!card) {
      alert('Special deck is empty.');
      return;
    }
    const faction = campaign.factions[side];
    setCampaign({
      ...campaign,
      decks: { ...campaign.decks, special: nextDeck },
      factions: {
        ...campaign.factions,
        [side]: {
          ...faction,
          specialCards: [...faction.specialCards, card],
          specialsEarned: (faction.specialsEarned || 0) + 1
        }
      }
    });
  };

  const handleExport = () => {
    const data = prepareGrandExport(campaign);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `grand-campaign-${campaign.name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        const v = validateGrandCampaign(data);
        if (!v.ok) { alert(v.error); return; }
        setCampaign(data);
      } catch (err) {
        alert(`Import failed: ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleBoardEditorSave = (newBoard) => {
    setCampaign({ ...campaign, board: newBoard });
    setShowBoardEditor(false);
  };

  const phase = campaign.turn.phase;
  const placementUnit = campaign.turn.placementDrawnId
    ? campaign.units.find(u => u.id === campaign.turn.placementDrawnId)
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="max-w-[1800px] mx-auto">
        {/* Header */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Map className="w-6 h-6 text-amber-400" />
            <div>
              <h1 className="text-2xl font-bold text-amber-400">{campaign.name}</h1>
              <p className="text-slate-400 text-xs">
                Phase: <span className="text-amber-300">{phase}</span> ·
                Units: {campaign.units.length} ·
                Cities USA/CSA: {campaign.board.cities.filter(c => c.owner === 'USA').length}/{campaign.board.cities.filter(c => c.owner === 'CSA').length}
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setShowUnitRegistry(true)} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm flex items-center gap-1">
              <Users className="w-4 h-4" /> Units
            </button>
            <button onClick={() => setShowBoardEditor(true)} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm flex items-center gap-1">
              <Edit className="w-4 h-4" /> Board
            </button>
            <button onClick={() => setShowDeckViewer(true)} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm flex items-center gap-1">
              <Layers className="w-4 h-4" /> Decks
            </button>
            <button onClick={handleExport} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-sm flex items-center gap-1">
              <Download className="w-4 h-4" /> Export
            </button>
            <label className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm flex items-center gap-1 cursor-pointer">
              <Upload className="w-4 h-4" /> Import
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>
            <button onClick={onExit} className="px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-white rounded text-sm flex items-center gap-1">
              <ArrowLeftRight className="w-4 h-4" /> Switch
            </button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-4">
          {/* Left column */}
          <div className="col-span-3 space-y-3">
            <Calendar campaign={campaign} />
            <FactionSheet campaign={campaign} side="USA" />
            <FactionSheet campaign={campaign} side="CSA" />
            <VictoriesBoard campaign={campaign} onClaimSpecial={handleClaimSpecial} />
            {phase === 'setup' && (
              <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 space-y-2">
                <div className="text-xs text-slate-400">
                  Add your units in the Unit Registry, then toss the coin to start.
                </div>
                <button
                  onClick={() => setShowCoinToss(true)}
                  disabled={campaign.units.length === 0}
                  className="w-full px-3 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-700 disabled:opacity-40 text-white rounded flex items-center gap-2 justify-center"
                >
                  <Plus className="w-4 h-4" /> Toss Coin & Begin
                </button>
                {campaign.units.length === 0 && (
                  <div className="text-xs text-red-400 italic">Register at least 1 unit per side first.</div>
                )}
              </div>
            )}
            {phase === 'placement' && (
              <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 space-y-2">
                <h3 className="text-sm font-semibold text-amber-400">Placement</h3>
                {placementUnit ? (
                  <div className="text-sm">
                    <div>Placing: <span className="text-white font-bold">{placementUnit.name}</span></div>
                    <div className={placementUnit.faction === 'USA' ? 'text-blue-400' : 'text-red-400'}>
                      {placementUnit.faction}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">Click a hex to place.</div>
                  </div>
                ) : (
                  <button
                    onClick={() => handleDrawForPlacement(campaign.turn.activeSide)}
                    className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
                  >
                    Draw for {campaign.turn.activeSide}
                  </button>
                )}
              </div>
            )}
            {phase === 'play' && (
              <TurnBags
                campaign={campaign}
                onDraw={handleDrawFromBag}
                onCoinToss={() => setShowCoinToss(true)}
                onAdvanceMonth={() => triggerMonthEnd(campaign)}
              />
            )}
            {lastDrawResult && (
              <div className="bg-amber-900 bg-opacity-40 border border-amber-700 rounded p-2 text-xs">
                Drew: <span className="text-white font-bold">{lastDrawResult.unitName}</span> ({lastDrawResult.side})
              </div>
            )}
          </div>

          {/* Center - Board */}
          <div className="col-span-6">
            <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden" style={{ height: 'calc(100vh - 130px)' }}>
              <HexBoard
                board={campaign.board}
                units={campaign.units}
                activeUnitId={campaign.turn.activeUnitId}
                reachableHexes={reachableHexes}
                selectedHex={selectedHex}
                onHexClick={handleHexClick}
                onTokenClick={(unitId) => {
                  const u = campaign.units.find(x => x.id === unitId);
                  if (u) setSelectedHex(u.hexKey);
                }}
              />
            </div>
          </div>

          {/* Right column */}
          <div className="col-span-3 space-y-3">
            {phase === 'play' && activeUnit && (
              <ActionPanel
                campaign={campaign}
                unit={activeUnit}
                moveMode={moveMode}
                onSelectMoveMode={(m) => {
                  setMoveMode(m);
                  if (m === MOVE_MODE.RIVER && !activeUnit.onRiver) {
                    setCampaign(prev => ({
                      ...prev,
                      units: prev.units.map(u => u.id === activeUnit.id ? { ...u, onRiver: true } : u)
                    }));
                  }
                  if (m === MOVE_MODE.TRAIN && !activeUnit.onTrain) {
                    setCampaign(prev => ({
                      ...prev,
                      units: prev.units.map(u => u.id === activeUnit.id ? { ...u, onTrain: true } : u)
                    }));
                  }
                }}
                onAttack={handleAttack}
                onGarrison={() => setShowGarrison(activeUnit.id)}
                onReplenish={() => setShowReplenish(activeUnit.id)}
                onReinforce={handleReinforceToggle}
                onEndTurn={handleEndUnitTurn}
                reinforcingIds={reinforcingIds}
              />
            )}

            {/* Battle log */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-3 overflow-y-auto" style={{ maxHeight: 420 }}>
              <h3 className="text-sm font-semibold text-amber-400 mb-2">Battle Log</h3>
              <div className="space-y-1 text-xs">
                {(campaign.log || []).slice(-20).reverse().map((entry, idx) => (
                  <div key={idx} className="bg-slate-900 rounded p-2">
                    <div className="text-slate-400">Turn {entry.turn} · {entry.date}</div>
                    <div className="text-white">
                      <span className={entry.attacker === 'USA' ? 'text-blue-400' : 'text-red-400'}>{entry.attacker}</span>
                      {' vs '}
                      <span className={entry.defender === 'USA' ? 'text-blue-400' : entry.defender === 'CSA' ? 'text-red-400' : 'text-slate-400'}>{entry.defender}</span>
                      {' on '}{entry.mapName}
                    </div>
                    <div className="text-amber-300">
                      Winner: {entry.winner} · Cas {entry.finalCasualties.attacker}/{entry.finalCasualties.defender}
                      {entry.capturedCityVP > 0 && ` · +${entry.capturedCityVP} VP`}
                      {entry.wipedUnits?.length > 0 && ` · ${entry.wipedUnits.length} wiped`}
                    </div>
                  </div>
                ))}
                {(!campaign.log || campaign.log.length === 0) && (
                  <div className="text-slate-500 italic">No battles yet.</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modals */}
        {showUnitRegistry && (
          <UnitRegistry
            campaign={campaign}
            onUpdate={setCampaign}
            onClose={() => setShowUnitRegistry(false)}
          />
        )}
        {showBoardEditor && (
          <BoardEditor
            board={campaign.board}
            onSave={handleBoardEditorSave}
            onClose={() => setShowBoardEditor(false)}
          />
        )}
        {showDeckViewer && (
          <DeckViewer
            campaign={campaign}
            onUpdate={setCampaign}
            onClose={() => setShowDeckViewer(false)}
          />
        )}
        {showCoinToss && (
          <CoinTossDialog
            onResult={handleCoinToss}
            onCancel={() => setShowCoinToss(false)}
          />
        )}
        {showMonthEnd && (
          <MonthEndDialog
            campaign={campaign}
            incomeUSA={showMonthEnd.incomeUSA}
            incomeCSA={showMonthEnd.incomeCSA}
            eventCard={showMonthEnd.eventCard}
            onContinue={handleMonthEndContinue}
          />
        )}
        {showGarrison && activeUnit && (
          <GarrisonDialog
            campaign={campaign}
            unit={activeUnit}
            onConfirm={handleGarrisonConfirm}
            onCancel={() => setShowGarrison(null)}
          />
        )}
        {showReplenish && activeUnit && (
          <ReplenishDialog
            campaign={campaign}
            unit={activeUnit}
            onConfirm={handleReplenishConfirm}
            onCancel={() => setShowReplenish(null)}
          />
        )}
        {battleContext && (
          <GrandBattleRecorder
            campaign={campaign}
            attackerId={battleContext.attackerId}
            defenderId={battleContext.defenderId}
            targetHex={battleContext.targetHex}
            onResolve={handleBattleResolved}
            onCancel={() => setBattleContext(null)}
          />
        )}

        {/* Victory modal */}
        {showVictory && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-lg border-2 border-amber-500 max-w-xl w-full p-8 text-center">
              <Trophy className="w-20 h-20 text-amber-400 mx-auto mb-4" />
              <h2 className="text-3xl font-bold text-amber-400 mb-2">Victory!</h2>
              <div className="text-2xl font-bold mb-1">
                <span className={showVictory.winner === 'USA' ? 'text-blue-400' : showVictory.winner === 'CSA' ? 'text-red-400' : 'text-slate-300'}>
                  {showVictory.winner}
                </span> wins
              </div>
              <div className="text-slate-300 mb-4">{showVictory.type}</div>
              <div className="text-sm text-slate-400 mb-6">USA {showVictory.usa} VP · CSA {showVictory.csa} VP</div>
              <button
                onClick={() => setShowVictory(null)}
                className="px-6 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded"
              >
                Continue Viewing
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GrandCampaign;
