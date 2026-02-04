import { useState, useEffect } from 'react';
import { Map, Trophy, Plus, Download, Upload, Settings, Swords, SkipForward, AlertCircle, Edit, HelpCircle } from 'lucide-react';
import MapView from './components/MapView';
import CampaignStats from './components/CampaignStats';
import TerritoryList from './components/TerritoryList';
import BattleHistory from './components/BattleHistory';
import BattleRecorder from './components/BattleRecorder';
import SettingsModal from './components/SettingsModal';
import MapEditor from './components/MapEditor';
import HelpGuide from './components/HelpGuide';
import RegimentStats from './components/RegimentStats';
import { createDefaultCampaign, createEasternTheatreCampaign, CAMPAIGN_TEMPLATES } from './data/defaultCampaign';
import { processBattleResult, processTransitioningTerritories } from './utils/campaignLogic';
import { checkVictoryConditions } from './utils/victoryConditions';
import { advanceTurn as advanceCampaignDate, isCampaignOver } from './utils/dateSystem';
import { calculateCPGeneration } from './utils/cpSystem';
import { validateImportedCampaign, prepareCampaignExport, formatImportError } from './utils/campaignValidation';

const STORAGE_KEY = 'WarOfRightsCampaignTracker';

const CampaignTracker = () => {
  // State management
  const [campaign, setCampaign] = useState(null);
  const [selectedTerritory, setSelectedTerritory] = useState(null);
  const [showBattleRecorder, setShowBattleRecorder] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showVictory, setShowVictory] = useState(null);
  const [showMapEditor, setShowMapEditor] = useState(false);
  const [showHelpGuide, setShowHelpGuide] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);

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

    const battle = {
      ...battleData
    };

    // Process battle result and update campaign
    const updatedCampaign = processBattleResult(campaign, battle);
    setCampaign(updatedCampaign);
    setShowBattleRecorder(false);
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

  const saveSettings = (newSettings) => {
    if (!campaign) return;

    // Extract campaign name, regiments, and settings
    const { name, regiments, ...settings } = newSettings;

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

  const handleTerritoryClick = (territory) => {
    setSelectedTerritory(territory);
  };

  if (!campaign) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 flex items-center justify-center">
        <div className="text-amber-400 text-xl">Loading campaign...</div>
      </div>
    );
  }

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
                  Turn {campaign.currentTurn} • {campaign.battles.length} battles fought
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
            />
          </div>

          {/* Right Sidebar - Stats */}
          <div>
            <CampaignStats
              campaign={campaign}
              onUpdateCampaign={setCampaign}
            />
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
            onClose={() => setShowBattleRecorder(false)}
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

        {/* Help Guide Modal */}
        <HelpGuide
          isOpen={showHelpGuide}
          onClose={() => setShowHelpGuide(false)}
        />

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