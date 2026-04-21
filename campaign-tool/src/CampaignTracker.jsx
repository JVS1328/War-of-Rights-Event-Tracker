import { useState, useEffect } from 'react';
import { Map, Trophy, Plus, Download, Upload, Settings, Swords, SkipForward, AlertCircle, Edit, HelpCircle, Share2 } from 'lucide-react';
import MapView from './components/MapView';
import CampaignStats from './components/CampaignStats';
import TerritoryList from './components/TerritoryList';
import BattleHistory from './components/BattleHistory';
import BattleRecorder from './components/BattleRecorder';
import SettingsModal from './components/SettingsModal';
import MapEditor from './components/MapEditor';
import TerritoryEditor from './components/TerritoryEditor';
import HelpGuide from './components/HelpGuide';
import RegimentStats from './components/RegimentStats';
import TokenPanel from './components/TokenPanel';
import MapFeaturesPanel from './components/MapFeaturesPanel';
import SetupWizard from './components/SetupWizard';
import TurnTracker from './components/TurnTracker';
import MoveConfirmModal from './components/MoveConfirmModal';
import {
  isGrandCampaign,
  addToken as gcAddToken,
  renameToken as gcRenameToken,
  removeToken as gcRemoveToken,
  updateToken as gcUpdateToken,
  moveTokenTo as gcMoveTokenTo,
  addMapPoint as gcAddMapPoint,
  addMapLine as gcAddMapLine,
  updateMapFeature as gcUpdateMapFeature,
  removeMapFeature as gcRemoveMapFeature,
  resolveCoinFlip as gcResolveCoinFlip,
  drawNextSetupToken as gcDrawNextSetupToken,
  placeSetupToken as gcPlaceSetupToken,
  drawNextToken as gcDrawNextToken,
  endTokenTurn as gcEndTokenTurn,
  evaluateMove as gcEvaluateMove,
  performMove as gcPerformMove,
} from './utils/grandCampaignLogic';
import { createDefaultCampaign, createEasternTheatreCampaign, CAMPAIGN_TEMPLATES } from './data/defaultCampaign';
import { processBattleResult, processTransitioningTerritories, applyCommanderPoolUpdate } from './utils/campaignLogic';
import { checkVictoryConditions } from './utils/victoryConditions';
import { advanceTurn as advanceCampaignDate, isCampaignOver } from './utils/dateSystem';
import { calculateCPGeneration } from './utils/cpSystem';
import { validateImportedCampaign, prepareCampaignExport, formatImportError } from './utils/campaignValidation';
import { generateShareUrl, generateShortShareUrl } from './utils/shareMap';

const STORAGE_KEY = 'WarOfRightsCampaignTracker';

const CampaignTracker = () => {
  // State management
  const [campaign, setCampaign] = useState(null);
  const [selectedTerritory, setSelectedTerritory] = useState(null);
  const [showBattleRecorder, setShowBattleRecorder] = useState(false);
  const [editingBattle, setEditingBattle] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showVictory, setShowVictory] = useState(null);
  const [showMapEditor, setShowMapEditor] = useState(false);
  const [showHelpGuide, setShowHelpGuide] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [battleRecorderInitialTerritory, setBattleRecorderInitialTerritory] = useState(null);
  const [territoryEditorTarget, setTerritoryEditorTarget] = useState(null);

  // Grand Campaign: which token (if any) is currently in "click-to-place" mode
  const [moveModeTokenId, setMoveModeTokenId] = useState(null);

  // Grand Campaign: feature-edit mode state. `featureEditMode` is a top-level
  // boolean that swaps the sidebar; `featureTool` is the currently selected
  // placement tool (city/fort/station/railway/river). `lineDraft` accumulates
  // points for in-progress railways/rivers.
  const [featureEditMode, setFeatureEditMode] = useState(false);
  const [featureTool, setFeatureTool] = useState(null);
  const [featurePointSide, setFeaturePointSide] = useState('USA');
  const [featurePointIsCapital, setFeaturePointIsCapital] = useState(false);
  const [lineDraft, setLineDraft] = useState([]);

  // Grand Campaign setup wizard state
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [setupError, setSetupError] = useState(null);

  // Grand Campaign in-turn movement state. When a token's turn is active the
  // user can click "Move", which enters targeting mode; the next valid map
  // click computes an evaluation and pops the MoveConfirmModal.
  const [turnMoveActive, setTurnMoveActive] = useState(false);
  const [pendingMove, setPendingMove] = useState(null); // { evaluation, destination }

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setCampaign(JSON.parse(saved));
      } catch (error) {
        console.error('Error loading campaign:', error);
        setCampaign(createDefaultCampaign());
      }
    } else {
      setCampaign(createDefaultCampaign());
    }
  }, []);

  // Save to localStorage on campaign changes
  useEffect(() => {
    if (campaign) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(campaign));
      
      // Check victory conditions
      const victory = checkVictoryConditions(campaign);
      if (victory && !showVictory) {
        setShowVictory(victory);
      }
    }
  }, [campaign]);

  // Core methods
  const recordBattle = (battleData) => {
    if (!campaign) return;

    const battle = { ...battleData };

    if (battle.status === 'pending') {
      // Pending battle: add to history and update commander pool, but no territory/VP/CP processing
      const updatedCampaign = applyCommanderPoolUpdate({
        ...campaign,
        battles: [...campaign.battles, battle]
      }, battle);
      setCampaign(updatedCampaign);
    } else {
      // Completed battle: process territory changes, VP, CP
      const updatedCampaign = processBattleResult(campaign, battle);
      setCampaign(updatedCampaign);
    }

    setShowBattleRecorder(false);
    setEditingBattle(null);
    setBattleRecorderInitialTerritory(null);
  };

  const updateBattle = (battleData) => {
    if (!campaign) return;

    const battle = { ...battleData };
    const oldBattle = campaign.battles.find(b => b.id === battle.id);
    if (!oldBattle) return;

    const wasPending = oldBattle.status === 'pending' || !oldBattle.winner;
    const isNowCompleted = battle.status === 'completed' && battle.winner;

    if (wasPending && isNowCompleted) {
      // Pending → completed: process territory/VP/CP changes now
      const campaignWithoutOld = {
        ...campaign,
        battles: campaign.battles.filter(b => b.id !== battle.id)
      };
      const updatedCampaign = processBattleResult(campaignWithoutOld, battle);
      setCampaign(updatedCampaign);
    } else {
      // Metadata-only update (casualties, notes, etc.) or still pending
      const updatedBattles = campaign.battles.map(b =>
        b.id === battle.id ? { ...b, ...battle } : b
      );
      setCampaign({ ...campaign, battles: updatedBattles });
    }

    setShowBattleRecorder(false);
    setEditingBattle(null);
    setBattleRecorderInitialTerritory(null);
  };

  const handleEditBattle = (battle) => {
    setEditingBattle(battle);
    setShowBattleRecorder(true);
  };

  const advanceTurn = () => {
    if (!campaign) return;
    
    if (!confirm(`Advance to Turn ${campaign.currentTurn + 1}?`)) return;

    // Create updated campaign object
    const updatedCampaign = { ...campaign };
    
    // Advance turn counter
    updatedCampaign.currentTurn = campaign.currentTurn + 1;

    // === DATE SYSTEM ===
    // Advance campaign date by 2 months
    if (campaign.campaignDate) {
      updatedCampaign.campaignDate = advanceCampaignDate(campaign.campaignDate);
      
      // Check if campaign has ended
      if (isCampaignOver(updatedCampaign.campaignDate)) {
        alert('Campaign has reached its end date (December 1865)!');
      }
    }

    // === CP GENERATION (if enabled) ===
    if (campaign.cpSystemEnabled) {
      // Calculate VP from controlled territories
      const cpGeneration = calculateCPGeneration(campaign.territories);

      // Add CP to each side's pool
      updatedCampaign.combatPowerUSA = (campaign.combatPowerUSA || 0) + cpGeneration.usa;
      updatedCampaign.combatPowerCSA = (campaign.combatPowerCSA || 0) + cpGeneration.csa;

      // Add CP history entries
      const cpHistory = [...(campaign.cpHistory || [])];

      // USA CP generation
      if (cpGeneration.usa > 0) {
        cpHistory.push({
          turn: updatedCampaign.currentTurn,
          date: new Date().toISOString(),
          action: 'Turn Generation',
          side: 'USA',
          cpChange: cpGeneration.usa,
          newBalance: updatedCampaign.combatPowerUSA
        });
      }

      // CSA CP generation
      if (cpGeneration.csa > 0) {
        cpHistory.push({
          turn: updatedCampaign.currentTurn,
          date: new Date().toISOString(),
          action: 'Turn Generation',
          side: 'CSA',
          cpChange: cpGeneration.csa,
          newBalance: updatedCampaign.combatPowerCSA
        });
      }

      updatedCampaign.cpHistory = cpHistory;
    }

    // === PROCESS TERRITORY TRANSITIONS ===
    // Progress any territories in capture transition state
    const campaignWithTransitions = processTransitioningTerritories(updatedCampaign);

    // === REDUCE ABILITY COOLDOWNS ===
    if (campaignWithTransitions.abilities) {
      // Reduce cooldowns for all abilities
      ['USA', 'CSA'].forEach(side => {
        if (campaignWithTransitions.abilities[side] && campaignWithTransitions.abilities[side].cooldown > 0) {
          campaignWithTransitions.abilities[side] = {
            ...campaignWithTransitions.abilities[side],
            cooldown: Math.max(0, campaignWithTransitions.abilities[side].cooldown - 1)
          };
        }
      });
    }

    setCampaign(campaignWithTransitions);
  };

  const newCampaign = () => {
    if (!confirm('Start a new campaign? This will clear all current data. Make sure to export first!')) {
      return;
    }
    setShowTemplateSelector(true);
  };

  const handleTemplateSelect = (templateKey) => {
    const template = CAMPAIGN_TEMPLATES[templateKey];
    if (template) {
      const fresh = template.create();
      setCampaign(fresh);
      setSelectedTerritory(null);
      setShowVictory(null);
    }
    setShowTemplateSelector(false);
  };

  const handleMapEditorSave = (modifiedTerritories) => {
    if (!campaign) return;

    // Calculate new VP totals based on modified territories
    let vpUSA = 0;
    let vpCSA = 0;
    
    modifiedTerritories.forEach(territory => {
      if (territory.owner === 'USA') {
        vpUSA += territory.victoryPoints;
      } else if (territory.owner === 'CSA') {
        vpCSA += territory.victoryPoints;
      }
    });

    // Update campaign with modified territories while preserving battle history
    setCampaign({
      ...campaign,
      territories: modifiedTerritories,
      victoryPointsUSA: vpUSA,
      victoryPointsCSA: vpCSA
    });
    
    setSelectedTerritory(null);
    setShowMapEditor(false);
  };

  const handleMapEditorClose = () => {
    setShowMapEditor(false);
    // If no campaign exists, create default one
    if (!campaign) {
      const fresh = createDefaultCampaign();
      setCampaign(fresh);
    }
  };

  const editCampaignMap = () => {
    if (!confirm('Edit campaign map? You can modify territories, VP values, and ownership. Battle history will be preserved.')) {
      return;
    }
    setShowMapEditor(true);
  };

  const exportCampaign = () => {
    if (!campaign) return;

    // Prepare campaign data with version and metadata
    const data = prepareCampaignExport(campaign);

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `campaign-${campaign.name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importCampaign = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);

        // Comprehensive validation of campaign state
        const validation = validateImportedCampaign(data);

        if (!validation.success) {
          alert(formatImportError(validation.error));
          return;
        }

        // Import successful - update campaign state and reset UI
        setCampaign(validation.campaign);
        setSelectedTerritory(null);
        setShowVictory(null);
        setShowBattleRecorder(false);
        setShowSettings(false);
        setShowMapEditor(false);

        alert('Campaign imported successfully!');
      } catch (error) {
        alert(formatImportError(`JSON parsing error: ${error.message}`));
      }
    };
    reader.readAsText(file);

    // Reset file input to allow re-importing the same file
    event.target.value = '';
  };

  const shareCampaignMap = async () => {
    if (!campaign) return;

    let url;
    try {
      url = await generateShortShareUrl(campaign);
    } catch {
      // Server unavailable — fall back to client-only long URL
      url = generateShareUrl(campaign);
    }

    try {
      await navigator.clipboard.writeText(url);
      alert('Share link copied to clipboard! Anyone with this link can view your campaign map.');
    } catch {
      prompt('Copy this link to share your campaign map:', url);
    }
  };

  const saveSettings = (newSettings) => {
    if (!campaign) return;

    // Extract campaign name, regiments, terrain groups, viz, and settings
    const { name, regiments, terrainGroups, terrainViz, ...settings } = newSettings;

    // Persist terrain groups & visualization config inside settings
    if (terrainGroups) {
      settings.terrainGroups = terrainGroups;
    }
    if (terrainViz) {
      settings.terrainViz = terrainViz;
    }

    // Update commander pool when regiments change
    const updatedCampaign = {
      ...campaign,
      name: name,
      settings: settings
    };

    // Update regiments if provided
    if (regiments) {
      updatedCampaign.regiments = regiments;

      // Reset commander pools to include all regiments
      updatedCampaign.commanderPool = {
        USA: regiments.USA.map(r => r.id),
        CSA: regiments.CSA.map(r => r.id)
      };
    }

    setCampaign(updatedCampaign);
    setShowSettings(false);
  };

  // === Grand Campaign handlers ===
  const handleAddToken = (payload) => setCampaign(c => gcAddToken(c, payload));
  const handleRenameToken = (tokenId, newName) => setCampaign(c => gcRenameToken(c, tokenId, newName));
  const handleRemoveToken = (tokenId) => {
    setCampaign(c => gcRemoveToken(c, tokenId));
    if (moveModeTokenId === tokenId) setMoveModeTokenId(null);
  };
  const handleUpdateToken = (tokenId, patch) => setCampaign(c => gcUpdateToken(c, tokenId, patch));
  const handleEnterMoveMode = (tokenId) => setMoveModeTokenId(tokenId);
  const handleCancelMoveMode = () => setMoveModeTokenId(null);
  const handleMapPlaceClick = (point) => {
    // In-turn movement targeting has priority whenever a move is being
    // chosen for the currently-drawn token.
    if (isGC && turnMoveActive && campaign.grandCampaign.currentTokenId) {
      const evaluation = gcEvaluateMove(campaign, campaign.grandCampaign.currentTokenId, { x: point.x, y: point.y });
      if (!evaluation.valid) {
        alert(`Cannot move there: ${evaluation.error}`);
        return;
      }
      setPendingMove({ evaluation, destination: { x: point.x, y: point.y } });
      return;
    }
    // Grand Campaign setup placement takes highest priority when active.
    if (isGC && campaign.grandCampaign.phase === 'setup-placement') {
      // Need the territory at the click point (supplied by MapView as point.territoryId).
      const territory = point.territoryId
        ? campaign.territories.find(t => t.id === point.territoryId)
        : null;
      const owner = territory?.owner || null;
      const result = gcPlaceSetupToken(campaign, { x: point.x, y: point.y }, owner);
      if (result.error) {
        setSetupError(result.error);
      } else {
        setSetupError(null);
        setCampaign(result.campaign);
      }
      return;
    }
    // Priority 1: placing a token in move mode
    if (moveModeTokenId) {
      setCampaign(c => gcMoveTokenTo(c, moveModeTokenId, point));
      setMoveModeTokenId(null);
      return;
    }
    // Priority 2: placing a map feature via the current tool
    if (featureTool === 'city' || featureTool === 'fort' || featureTool === 'station') {
      setCampaign(c => gcAddMapPoint(c, {
        kind: featureTool,
        x: point.x,
        y: point.y,
        side: featurePointSide,
        isCapital: featurePointIsCapital,
      }));
      // Stay in tool so user can drop multiple points in sequence.
      return;
    }
    if (featureTool === 'railway' || featureTool === 'river') {
      setLineDraft(prev => [...prev, { x: point.x, y: point.y }]);
      return;
    }
  };

  // === Setup wizard handlers ===
  const handleOpenSetupWizard = () => {
    if (!isGC) return;
    // Reset any edit modes so the map is free for setup clicks.
    setMoveModeTokenId(null);
    setFeatureEditMode(false);
    setFeatureTool(null);
    setLineDraft([]);
    setShowSetupWizard(true);
  };
  const handleCloseSetupWizard = () => setShowSetupWizard(false);
  const handleCoinFlipCommit = (winner) => {
    // resolveCoinFlip populates bags; then immediately draw the first token.
    const withFlip = gcResolveCoinFlip(campaign, winner);
    const drawn = gcDrawNextSetupToken(withFlip);
    setCampaign(drawn);
    setSetupError(null);
  };

  // === Turn-machine handlers (phase: 'playing') ===
  const handleDrawNextToken = () => setCampaign(c => gcDrawNextToken(c));
  const handleEndTokenTurn = () => {
    // End the current token's turn, then immediately draw the next one.
    setCampaign(c => gcDrawNextToken(gcEndTokenTurn(c)));
    setTurnMoveActive(false);
    setPendingMove(null);
  };

  // === In-turn movement handlers ===
  const handleBeginMove = () => {
    if (turnMoveActive) {
      setTurnMoveActive(false);
      setPendingMove(null);
    } else {
      setTurnMoveActive(true);
    }
  };
  const handleCancelPendingMove = () => setPendingMove(null);
  const handleConfirmMove = (mode) => {
    if (!pendingMove) return;
    const tokenId = campaign.grandCampaign.currentTokenId;
    const result = gcPerformMove(campaign, tokenId, pendingMove.destination, mode);
    if (result.error) {
      alert(result.error);
      return;
    }
    setCampaign(result.campaign);
    setPendingMove(null);
    // Rail/river disembark ends the turn. March leaves the "Move" mode on so
    // the user can continue if MP remain.
    if (result.turnEnds) {
      setTurnMoveActive(false);
    }
  };

  // === Feature edit mode handlers ===
  const enterFeatureEditMode = () => {
    setFeatureEditMode(true);
    setMoveModeTokenId(null); // don't mix modes
  };
  const exitFeatureEditMode = () => {
    setFeatureEditMode(false);
    setFeatureTool(null);
    setLineDraft([]);
  };
  const handleSelectTool = (tool) => {
    setFeatureTool(tool);
    setLineDraft([]); // reset draft when switching tools
  };
  const handleFinishLine = () => {
    if (!featureTool || lineDraft.length < 2) return;
    setCampaign(c => gcAddMapLine(c, { kind: featureTool, points: lineDraft }));
    setLineDraft([]);
  };
  const handleCancelLine = () => setLineDraft([]);
  const handleUndoLinePoint = () => setLineDraft(d => d.slice(0, -1));
  const handleUpdateFeature = (id, patch) => setCampaign(c => gcUpdateMapFeature(c, id, patch));
  const handleRemoveFeature = (id) => setCampaign(c => gcRemoveMapFeature(c, id));

  const handleTerritoryClick = (territory) => {
    setSelectedTerritory(prev => prev?.id === territory.id ? null : territory);
  };

  const handleTerritoryDoubleClick = (territory) => {
    setSelectedTerritory(territory);
    setEditingBattle(null);
    setBattleRecorderInitialTerritory(territory.id);
    setShowBattleRecorder(true);
  };

  const handleTerritoryCtrlDoubleClick = (territory) => {
    setTerritoryEditorTarget(territory);
  };

  const handleTerritoryEditorSave = (updatedTerritory) => {
    setCampaign(prev => ({
      ...prev,
      territories: prev.territories.map(t =>
        t.id === updatedTerritory.id ? { ...t, ...updatedTerritory } : t
      ),
    }));
    setTerritoryEditorTarget(null);
  };

  if (!campaign) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 flex items-center justify-center">
        <div className="text-amber-400 text-xl">Loading campaign...</div>
      </div>
    );
  }

  const isGC = isGrandCampaign(campaign);
  const gcTokens = isGC ? campaign.grandCampaign.tokens : null;
  const gcMapFeatures = isGC ? campaign.grandCampaign.mapFeatures : null;
  const gcPhase = isGC ? campaign.grandCampaign.phase : null;
  const isSetupActive = gcPhase === 'setup-coinflip' || gcPhase === 'setup-placement';
  const interactionLocked = gcPhase === 'setup-placement' || turnMoveActive;

  const spSettings = campaign.cpSystemEnabled ? {
    vpBase: campaign.settings?.vpBase || 1,
    attackEnemy: campaign.settings?.baseAttackCostEnemy ?? 75,
    attackNeutral: campaign.settings?.baseAttackCostNeutral ?? 50,
    defenseFriendly: campaign.settings?.baseDefenseCostFriendly ?? 25,
    defenseNeutral: campaign.settings?.baseDefenseCostNeutral ?? 50,
  } : null;

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
                  {campaign.name}
                </h1>
                <p className="text-slate-400 text-sm mt-1">
                  Turn {campaign.currentTurn} • {campaign.battles.filter(b => b.status !== 'pending' && b.winner).length} battles fought
                  {campaign.battles.some(b => b.status === 'pending' || !b.winner) && (
                    <span className="text-amber-400"> • {campaign.battles.filter(b => b.status === 'pending' || !b.winner).length} pending</span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={editCampaignMap}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2 transition"
                title="Edit Campaign Map"
              >
                <Edit className="w-4 h-4" />
                Edit Map
              </button>
              <button
                onClick={newCampaign}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg flex items-center gap-2 transition"
                title="New Campaign"
              >
                <Plus className="w-4 h-4" />
                New
              </button>
              <button
                onClick={shareCampaignMap}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg flex items-center gap-2 transition"
                title="Share Campaign Map"
              >
                <Share2 className="w-4 h-4" />
                Share
              </button>
              <button
                onClick={exportCampaign}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 transition"
                title="Export Campaign"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
              <label className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition cursor-pointer">
                <Upload className="w-4 h-4" />
                Import
                <input
                  type="file"
                  accept=".json"
                  onChange={importCampaign}
                  className="hidden"
                />
              </label>
              <button
                onClick={() => setShowSettings(true)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2 transition"
                title="Settings"
              >
                <Settings className="w-4 h-4" />
                Settings
              </button>
              <button
                onClick={() => setShowHelpGuide(true)}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg flex items-center gap-2 transition"
                title="Help Guide"
              >
                <HelpCircle className="w-4 h-4" />
                Guide
              </button>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Map View - Takes 2 columns */}
          <div className="lg:col-span-2">
            <MapView
              territories={campaign.territories}
              selectedTerritory={selectedTerritory}
              onTerritoryClick={handleTerritoryClick}
              onTerritoryDoubleClick={handleTerritoryDoubleClick}
              onTerritoryCtrlDoubleClick={handleTerritoryCtrlDoubleClick}
              pendingBattleTerritoryIds={
                campaign.battles
                  .filter(b => b.status === 'pending' || !b.winner)
                  .map(b => b.territoryId)
              }
              recentBattleTerritoryIds={
                campaign.battles
                  .filter(b => b.status === 'completed' && b.winner && b.turn >= campaign.currentTurn - 1)
                  .map(b => b.territoryId)
              }
              spSettings={spSettings}
              terrainViz={campaign.settings?.terrainViz}
              tokens={gcTokens}
              moveModeTokenId={moveModeTokenId}
              onMapClick={handleMapPlaceClick}
              mapFeatures={gcMapFeatures}
              featureTool={featureTool}
              lineDraft={lineDraft}
              interactionLocked={interactionLocked}
            />
          </div>

          {/* Right Sidebar — swaps based on mode:
              - Standard campaign: CampaignStats
              - Grand Campaign (default): TokenPanel (+ "Edit Map Features" button)
              - Grand Campaign (features-edit mode): MapFeaturesPanel */}
          <div className="space-y-6">
            {isGC && featureEditMode && (
              <MapFeaturesPanel
                campaign={campaign}
                tool={featureTool}
                pointSide={featurePointSide}
                pointIsCapital={featurePointIsCapital}
                lineDraft={lineDraft}
                onSelectTool={handleSelectTool}
                onChangePointSide={setFeaturePointSide}
                onTogglePointCapital={() => setFeaturePointIsCapital(v => !v)}
                onFinishLine={handleFinishLine}
                onCancelLine={handleCancelLine}
                onUndoLinePoint={handleUndoLinePoint}
                onUpdateFeature={handleUpdateFeature}
                onRemoveFeature={handleRemoveFeature}
                onExitEditMode={exitFeatureEditMode}
              />
            )}
            {isGC && !featureEditMode && (
              <>
                {gcPhase === 'setup-coinflip' && gcTokens.length > 0 && (
                  <button
                    onClick={handleOpenSetupWizard}
                    className="w-full px-3 py-2 bg-green-700 hover:bg-green-600 text-white rounded-lg text-sm font-bold animate-pulse"
                  >
                    Begin Setup — Coin Flip & Placement
                  </button>
                )}
                {gcPhase === 'setup-placement' && (
                  <div className="px-3 py-2 bg-amber-900/50 border border-amber-600 text-amber-200 rounded-lg text-xs">
                    Setup in progress — follow the floating panel to place tokens.
                  </div>
                )}
                {gcPhase === 'playing' && (
                  <TurnTracker
                    campaign={campaign}
                    onDrawNext={handleDrawNextToken}
                    onEndTurn={handleEndTokenTurn}
                    onBeginMove={handleBeginMove}
                    turnMoveActive={turnMoveActive}
                  />
                )}
                <button
                  onClick={enterFeatureEditMode}
                  className="w-full px-3 py-2 bg-amber-700 hover:bg-amber-600 text-white rounded-lg text-sm font-semibold"
                >
                  Edit Map Features (cities / forts / rails / rivers)
                </button>
                <TokenPanel
                  campaign={campaign}
                  moveModeTokenId={moveModeTokenId}
                  onAddToken={handleAddToken}
                  onRenameToken={handleRenameToken}
                  onRemoveToken={handleRemoveToken}
                  onUpdateToken={handleUpdateToken}
                  onEnterMoveMode={handleEnterMoveMode}
                  onCancelMoveMode={handleCancelMoveMode}
                />
              </>
            )}
            {!isGC && (
              <CampaignStats
                campaign={campaign}
                onUpdateCampaign={setCampaign}
              />
            )}
          </div>
        </div>

        {/* Regiment Leaderboard - Shows if regiments are configured */}
        {(campaign.regiments?.USA?.length > 0 || campaign.regiments?.CSA?.length > 0) && (
          <div className="mb-6">
            <RegimentStats campaign={campaign} />
          </div>
        )}

        {/* Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Territory List */}
          <div>
            <TerritoryList
              territories={campaign.territories}
              onTerritorySelect={handleTerritoryClick}
              spSettings={spSettings}
            />
          </div>

          {/* Battle Controls and History */}
          <div className="space-y-6">
            {/* Battle Controls */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
              <h3 className="text-xl font-bold text-amber-400 mb-4">
                Campaign Actions
              </h3>
              <div className="space-y-3">
                <button
                  onClick={() => setShowBattleRecorder(true)}
                  className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition flex items-center justify-center gap-2"
                >
                  <Swords className="w-5 h-5" />
                  Record Battle
                </button>
                <button
                  onClick={advanceTurn}
                  className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition flex items-center justify-center gap-2"
                >
                  <SkipForward className="w-5 h-5" />
                  Advance Turn
                </button>
              </div>
            </div>

            {/* Battle History Preview */}
            <BattleHistory
              battles={campaign.battles}
              territories={campaign.territories}
              onEditBattle={handleEditBattle}
            />
          </div>
        </div>

        {/* Battle Recorder Modal */}
        {showBattleRecorder && (
          <BattleRecorder
            territories={campaign.territories}
            currentTurn={campaign.currentTurn}
            campaign={campaign}
            onRecordBattle={recordBattle}
            onUpdateBattle={updateBattle}
            onClose={() => { setShowBattleRecorder(false); setEditingBattle(null); setBattleRecorderInitialTerritory(null); }}
            editingBattle={editingBattle}
            initialTerritoryId={battleRecorderInitialTerritory}
          />
        )}

        {/* Settings Modal */}
        {showSettings && (
          <SettingsModal
            campaign={campaign}
            onSave={saveSettings}
            onClose={() => setShowSettings(false)}
          />
        )}

        {/* Map Editor Modal */}
        {showMapEditor && (
          <MapEditor
            isOpen={showMapEditor}
            onClose={handleMapEditorClose}
            onSave={handleMapEditorSave}
            existingCampaign={campaign}
          />
        )}

        {/* Territory Editor Modal (Ctrl+double-click) */}
        {territoryEditorTarget && (
          <TerritoryEditor
            territory={territoryEditorTarget}
            terrainGroups={campaign.settings?.terrainGroups || {}}
            onSave={handleTerritoryEditorSave}
            onClose={() => setTerritoryEditorTarget(null)}
          />
        )}

        {/* Help Guide Modal */}
        <HelpGuide
          isOpen={showHelpGuide}
          onClose={() => setShowHelpGuide(false)}
        />

        {/* Grand Campaign Setup Wizard — opened either explicitly from the
            sidebar button, or automatically once the placement phase begins. */}
        {isGC && (showSetupWizard || gcPhase === 'setup-placement') && (
          <SetupWizard
            campaign={campaign}
            lastPlacementError={setupError}
            onFlip={handleCoinFlipCommit}
            onClose={handleCloseSetupWizard}
            onClearError={() => setSetupError(null)}
          />
        )}

        {/* Grand Campaign in-turn move confirmation */}
        {isGC && pendingMove && (() => {
          const token = campaign.grandCampaign.tokens.find(t => t.id === campaign.grandCampaign.currentTokenId);
          const mpLeft = campaign.grandCampaign.settings.movementPointsPerTurn - (token?.movementPointsUsed || 0);
          return (
            <MoveConfirmModal
              evaluation={pendingMove.evaluation}
              token={token}
              destination={pendingMove.destination}
              mpLeft={mpLeft}
              onConfirm={handleConfirmMove}
              onCancel={handleCancelPendingMove}
            />
          );
        })()}

        {/* Campaign Template Selector Modal */}
        {showTemplateSelector && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-lg shadow-2xl border border-slate-700 max-w-lg w-full p-6">
              <h2 className="text-2xl font-bold text-amber-400 mb-4">Select Campaign Template</h2>
              <p className="text-slate-400 mb-6">Choose a map template for your new campaign:</p>
              <div className="space-y-3">
                {Object.entries(CAMPAIGN_TEMPLATES).map(([key, template]) => (
                  <button
                    key={key}
                    onClick={() => handleTemplateSelect(key)}
                    className="w-full p-4 bg-slate-700 hover:bg-slate-600 rounded-lg text-left transition border border-slate-600 hover:border-amber-500"
                  >
                    <div className="font-semibold text-white">{template.name}</div>
                    <div className="text-sm text-slate-400 mt-1">{template.description}</div>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowTemplateSelector(false)}
                className="w-full mt-4 px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Victory Modal */}
        {showVictory && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-lg shadow-2xl border-2 border-amber-500 max-w-2xl w-full p-8">
              <div className="text-center">
                <Trophy className="w-24 h-24 text-amber-400 mx-auto mb-6" />
                <h2 className="text-4xl font-bold text-amber-400 mb-4">
                  Campaign Victory!
                </h2>
                <div className="text-2xl font-bold mb-2">
                  <span className={showVictory.winner === 'USA' ? 'text-blue-400' : 'text-red-400'}>
                    {showVictory.winner}
                  </span>
                  <span className="text-white"> Wins!</span>
                </div>
                <div className="text-lg text-slate-300 mb-6">
                  Victory Type: <span className="text-amber-400 font-semibold">{showVictory.type}</span>
                </div>
                <div className="text-slate-400 mb-8">
                  {showVictory.description}
                </div>

                {/* Final Stats */}
                <div className="bg-slate-700 rounded-lg p-6 mb-6">
                  <h3 className="text-xl font-bold text-amber-400 mb-4">Final Campaign Stats</h3>
                  <div className="grid grid-cols-2 gap-6 text-left">
                    <div>
                      <div className="text-sm text-slate-400 mb-2">Victory Points</div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-blue-400">USA:</span>
                          <span className="text-white font-bold">{campaign.victoryPointsUSA}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-red-400">CSA:</span>
                          <span className="text-white font-bold">{campaign.victoryPointsCSA}</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-400 mb-2">Campaign Info</div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Turns:</span>
                          <span className="text-white font-semibold">{campaign.currentTurn}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Battles:</span>
                          <span className="text-white font-semibold">{campaign.battles.length}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowVictory(null)}
                    className="flex-1 px-6 py-3 bg-slate-600 hover:bg-slate-500 text-white rounded-lg font-semibold transition"
                  >
                    Continue Viewing
                  </button>
                  <button
                    onClick={() => {
                      setShowVictory(null);
                      newCampaign();
                    }}
                    className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition"
                  >
                    New Campaign
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CampaignTracker;