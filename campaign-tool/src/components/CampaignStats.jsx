import { Trophy, Calendar, Zap } from 'lucide-react';

const CampaignStats = ({ campaign }) => {
  if (!campaign) return null;

  // Calculate VP from owned territories
  const usaTerritoryVP = campaign.territories
    .filter(t => t.owner === 'USA')
    .reduce((sum, t) => sum + (t.pointValue || t.victoryPoints || 0), 0);
  const csaTerritoryVP = campaign.territories
    .filter(t => t.owner === 'CSA')
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
    </div>
  );
};

export default CampaignStats;