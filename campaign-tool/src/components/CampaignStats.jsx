import { useState } from 'react';
import { Trophy, Calendar, Zap, Edit2, X, Save } from 'lucide-react';

const CampaignStats = ({ campaign, onUpdateCampaign }) => {
  const [showCPEditor, setShowCPEditor] = useState(false);
  const [editedCP, setEditedCP] = useState({ USA: 0, CSA: 0 });

  if (!campaign) return null;

  // Calculate VP from owned territories
  // If instant VP is disabled, exclude territories in transition
  const instantVPGains = campaign.settings?.instantVPGains !== false;

  const usaTerritoryVP = campaign.territories
    .filter(t => t.owner === 'USA')
    .filter(t => instantVPGains || !t.transitionState?.isTransitioning)
    .reduce((sum, t) => sum + (t.pointValue || t.victoryPoints || 0), 0);
  const csaTerritoryVP = campaign.territories
    .filter(t => t.owner === 'CSA')
    .filter(t => instantVPGains || !t.transitionState?.isTransitioning)
    .reduce((sum, t) => sum + (t.pointValue || t.victoryPoints || 0), 0);

  // Calculate casualty totals from battle history
  const calculateCasualties = () => {
    const totals = {
      usa: 0,
      csa: 0,
      total: 0
    };

    campaign.battles.forEach(battle => {
      const usaCas = battle.casualties?.USA || 0;
      const csaCas = battle.casualties?.CSA || 0;
      totals.usa += usaCas;
      totals.csa += csaCas;
      totals.total += usaCas + csaCas;
    });

    return totals;
  };

  const casualties = calculateCasualties();

  const formatDate = (isoString) => {
    return new Date(isoString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatNumber = (num) => {
    return num.toLocaleString('en-US');
  };

  const handleOpenCPEditor = () => {
    setEditedCP({
      USA: campaign.combatPowerUSA || 0,
      CSA: campaign.combatPowerCSA || 0
    });
    setShowCPEditor(true);
  };

  const handleSaveCPChanges = () => {
    if (!onUpdateCampaign) {
      alert('Campaign update function not available');
      return;
    }

    const updatedCampaign = {
      ...campaign,
      combatPowerUSA: parseInt(editedCP.USA) || 0,
      combatPowerCSA: parseInt(editedCP.CSA) || 0
    };

    // Add CP history entries for manual adjustments
    const cpHistory = [...(campaign.cpHistory || [])];
    
    const usaChange = (parseInt(editedCP.USA) || 0) - (campaign.combatPowerUSA || 0);
    const csaChange = (parseInt(editedCP.CSA) || 0) - (campaign.combatPowerCSA || 0);

    if (usaChange !== 0) {
      cpHistory.push({
        turn: campaign.currentTurn,
        date: new Date().toISOString(),
        action: 'Manual Adjustment',
        side: 'USA',
        cpChange: usaChange,
        newBalance: parseInt(editedCP.USA) || 0
      });
    }

    if (csaChange !== 0) {
      cpHistory.push({
        turn: campaign.currentTurn,
        date: new Date().toISOString(),
        action: 'Manual Adjustment',
        side: 'CSA',
        cpChange: csaChange,
        newBalance: parseInt(editedCP.CSA) || 0
      });
    }

    updatedCampaign.cpHistory = cpHistory;

    onUpdateCampaign(updatedCampaign);
    setShowCPEditor(false);
  };

  return (
    <div className="space-y-6">
      {/* Victory Points */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <h3 className="text-xl font-bold text-amber-400 flex items-center gap-2 mb-4">
          <Trophy className="w-5 h-5" />
          Victory Points
          {campaign.cpSystemEnabled && onUpdateCampaign && (
            <button
              onClick={handleOpenCPEditor}
              className="ml-auto p-1.5 hover:bg-slate-700 rounded transition"
              title="Edit CP Values"
            >
              <Edit2 className="w-4 h-4 text-slate-400 hover:text-amber-400" />
            </button>
          )}
        </h3>
        
        {/* USA */}
        <div className="mb-4">
          <div className="flex justify-between items-center">
            <span className="text-blue-400 font-semibold">USA</span>
            <div className="flex items-center gap-3">
              <span className="text-white text-2xl font-bold">
                {usaTerritoryVP} VP
              </span>
              {campaign.cpSystemEnabled && (
                <span className="text-blue-300 text-lg font-semibold flex items-center gap-1">
                  <Zap className="w-4 h-4" />
                  {campaign.combatPowerUSA || 0} CP
                </span>
              )}
            </div>
          </div>
          {campaign.cpSystemEnabled && (
            <div className="text-xs text-slate-400 mt-1">
              +{usaTerritoryVP} CP per turn from territories
            </div>
          )}
        </div>

        {/* CSA */}
        <div>
          <div className="flex justify-between items-center">
            <span className="text-red-400 font-semibold">CSA</span>
            <div className="flex items-center gap-3">
              <span className="text-white text-2xl font-bold">
                {csaTerritoryVP} VP
              </span>
              {campaign.cpSystemEnabled && (
                <span className="text-red-300 text-lg font-semibold flex items-center gap-1">
                  <Zap className="w-4 h-4" />
                  {campaign.combatPowerCSA || 0} CP
                </span>
              )}
            </div>
          </div>
          {campaign.cpSystemEnabled && (
            <div className="text-xs text-slate-400 mt-1">
              +{csaTerritoryVP} CP per turn from territories
            </div>
          )}
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
            <span className="text-slate-400">Campaign Name:</span>
            <span className="text-white font-semibold">{campaign.name}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Current Turn:</span>
            <span className="text-white font-semibold">{campaign.currentTurn}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Date:</span>
            <span className="text-white font-semibold">
              {campaign.campaignDate ? campaign.campaignDate.displayString : formatDate(campaign.startDate)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Battles Fought:</span>
            <span className="text-white font-semibold">{campaign.battles.length}</span>
          </div>
          
          {/* Casualty Statistics */}
          <div className="pt-3 mt-3 border-t border-slate-700">
            <div className="text-sm text-slate-400 mb-2 font-semibold">Campaign Casualties</div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-blue-400">USA Casualties:</span>
                <span className="text-white font-semibold">{formatNumber(casualties.usa)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-red-400">CSA Casualties:</span>
                <span className="text-white font-semibold">{formatNumber(casualties.csa)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-300">Total Casualties:</span>
                <span className="text-white font-bold">{formatNumber(casualties.total)}</span>
              </div>
            </div>
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
              {campaign.territories.filter(t => t.owner === 'USA').length}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-red-400 font-semibold">CSA Territories:</span>
            <span className="text-white font-bold">
              {campaign.territories.filter(t => t.owner === 'CSA').length}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400 font-semibold">Neutral:</span>
            <span className="text-white font-bold">
              {campaign.territories.filter(t => t.owner === 'NEUTRAL').length}
            </span>
          </div>
        </div>
      </div>

      {/* CP Editor Modal */}
      {showCPEditor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg shadow-2xl border border-slate-700 max-w-md w-full">
            <div className="p-6">
              {/* Header */}
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-amber-400 flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  Edit Combat Power
                </h3>
                <button
                  onClick={() => setShowCPEditor(false)}
                  className="p-2 hover:bg-slate-700 rounded-lg transition"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              {/* CP Input Fields */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-blue-400 mb-2 font-semibold">
                    USA Combat Power
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={editedCP.USA}
                    onChange={(e) => setEditedCP({ ...editedCP, USA: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-700 text-white rounded border border-slate-600 focus:border-blue-500 outline-none text-lg font-bold"
                  />
                  <div className="text-xs text-slate-400 mt-1">
                    Current: {campaign.combatPowerUSA || 0} CP
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-red-400 mb-2 font-semibold">
                    CSA Combat Power
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={editedCP.CSA}
                    onChange={(e) => setEditedCP({ ...editedCP, CSA: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-700 text-white rounded border border-slate-600 focus:border-red-500 outline-none text-lg font-bold"
                  />
                  <div className="text-xs text-slate-400 mt-1">
                    Current: {campaign.combatPowerCSA || 0} CP
                  </div>
                </div>

                <div className="bg-amber-900/20 border border-amber-700 rounded-lg p-3 mt-4">
                  <div className="text-xs text-amber-300">
                    <strong>Note:</strong> Manual CP adjustments will be logged in CP history.
                    Use this to correct errors or apply custom modifiers.
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleSaveCPChanges}
                  className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Save Changes
                </button>
                <button
                  onClick={() => setShowCPEditor(false)}
                  className="flex-1 px-4 py-3 bg-slate-600 hover:bg-slate-500 text-white rounded-lg font-semibold transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CampaignStats;