import { Trophy, Calendar, Target, Zap } from 'lucide-react';

const CampaignStats = ({ campaign }) => {
  if (!campaign) return null;

  const usaProgress = (campaign.victoryPointsUSA / campaign.victoryPointTarget) * 100;
  const csaProgress = (campaign.victoryPointsCSA / campaign.victoryPointTarget) * 100;
  
  // Calculate current VP from territories
  const usaTerritoryVP = campaign.territories
    .filter(t => t.owner === 'USA')
    .reduce((sum, t) => sum + (t.pointValue || t.victoryPoints || 0), 0);
  const csaTerritoryVP = campaign.territories
    .filter(t => t.owner === 'CSA')
    .reduce((sum, t) => sum + (t.pointValue || t.victoryPoints || 0), 0);

  const formatDate = (isoString) => {
    return new Date(isoString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Victory Points */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <h3 className="text-xl font-bold text-amber-400 flex items-center gap-2 mb-4">
          <Trophy className="w-5 h-5" />
          Victory Points
        </h3>
        
        {/* USA */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-blue-400 font-semibold">USA</span>
            <div className="flex items-center gap-3">
              <span className="text-white text-2xl font-bold">
                {campaign.victoryPointsUSA} VP
              </span>
              {campaign.cpSystemEnabled && (
                <span className="text-blue-300 text-lg font-semibold flex items-center gap-1">
                  <Zap className="w-4 h-4" />
                  {campaign.combatPowerUSA || 0} CP
                </span>
              )}
            </div>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, usaProgress)}%` }}
            />
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {usaProgress.toFixed(1)}% of target
            {campaign.cpSystemEnabled && ` • Territory VP: ${usaTerritoryVP} (+${usaTerritoryVP} CP/turn)`}
          </div>
        </div>

        {/* CSA */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-red-400 font-semibold">CSA</span>
            <div className="flex items-center gap-3">
              <span className="text-white text-2xl font-bold">
                {campaign.victoryPointsCSA} VP
              </span>
              {campaign.cpSystemEnabled && (
                <span className="text-red-300 text-lg font-semibold flex items-center gap-1">
                  <Zap className="w-4 h-4" />
                  {campaign.combatPowerCSA || 0} CP
                </span>
              )}
            </div>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-red-500 to-red-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, csaProgress)}%` }}
            />
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {csaProgress.toFixed(1)}% of target
            {campaign.cpSystemEnabled && ` • Territory VP: ${csaTerritoryVP} (+${csaTerritoryVP} CP/turn)`}
          </div>
        </div>

        {/* Victory Target */}
        <div className="mt-4 pt-4 border-t border-slate-700">
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-400">Victory Target:</span>
            <span className="text-amber-400 font-bold flex items-center gap-1">
              <Target className="w-4 h-4" />
              {campaign.victoryPointTarget} VP
            </span>
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
    </div>
  );
};

export default CampaignStats;