import { useState } from 'react';
import { Trophy, Calendar, Zap, Edit2, Save, Map as MapIcon, Skull } from 'lucide-react';
import { Card, CardHead, CardBody, Row, ScoreBoard, Modal, SIDE_TEXT } from './ui/Primitives';

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
  const casualties = campaign.battles.reduce(
    (totals, battle) => {
      const usa = battle.casualties?.USA || 0;
      const csa = battle.casualties?.CSA || 0;
      return { usa: totals.usa + usa, csa: totals.csa + csa, total: totals.total + usa + csa };
    },
    { usa: 0, csa: 0, total: 0 }
  );

  const formatDate = (isoString) =>
    new Date(isoString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  const formatNumber = (num) => num.toLocaleString('en-US');

  const fought = campaign.battles.filter(b => b.status !== 'pending' && b.winner).length;
  const pending = campaign.battles.filter(b => b.status === 'pending' || !b.winner).length;

  const owned = (side) => campaign.territories.filter(t => t.owner === side).length;
  const territoryTotal = campaign.territories.length || 1;

  const handleOpenCPEditor = () => {
    setEditedCP({ USA: campaign.combatPowerUSA || 0, CSA: campaign.combatPowerCSA || 0 });
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
    <div className="space-y-4">
      {/* Scoreboard */}
      <Card>
        <CardHead
          icon={Trophy}
          title="Victory Points"
          actions={
            campaign.cpSystemEnabled && onUpdateCampaign ? (
              <button
                onClick={handleOpenCPEditor}
                className="ui-btn ui-btn-quiet ui-btn-icon"
                title="Edit Supply Points"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            ) : null
          }
        />
        <CardBody>
          <ScoreBoard
            usaVP={usaTerritoryVP}
            csaVP={csaTerritoryVP}
            usaSP={campaign.cpSystemEnabled ? (campaign.combatPowerUSA || 0) : null}
            csaSP={campaign.cpSystemEnabled ? (campaign.combatPowerCSA || 0) : null}
            usaNote={campaign.cpSystemEnabled ? `+${usaTerritoryVP} SP / turn` : null}
            csaNote={campaign.cpSystemEnabled ? `+${csaTerritoryVP} SP / turn` : null}
          />
        </CardBody>
      </Card>

      {/* Territory control */}
      <Card>
        <CardHead icon={MapIcon} title="Territory Control" meta={`${campaign.territories.length} total`} />
        <CardBody className="space-y-3">
          <div className="ui-meter">
            <div className="bg-union-500" style={{ width: `${(owned('USA') / territoryTotal) * 100}%` }} />
            <div className="bg-rebel-500" style={{ width: `${(owned('CSA') / territoryTotal) * 100}%` }} />
            <div className="bg-ink-500 flex-1" />
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {['USA', 'CSA', 'NEUTRAL'].map(side => (
              <div key={side} className="ui-inset py-2">
                <div className={`text-[11px] font-bold tracking-widest ${SIDE_TEXT[side]}`}>
                  {side === 'NEUTRAL' ? 'NEUTRAL' : side}
                </div>
                <div className="text-xl font-bold text-mist-100 tabular">{owned(side)}</div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Campaign info */}
      <Card>
        <CardHead icon={Calendar} title="Campaign Info" />
        <CardBody className="space-y-2.5">
          <Row label="Campaign" value={campaign.name} />
          <Row label="Turn" value={campaign.currentTurn} />
          <Row
            label="Date"
            value={campaign.campaignDate ? campaign.campaignDate.displayString : formatDate(campaign.startDate)}
          />
          <Row
            label="Battles fought"
            value={
              <>
                {fought}
                {pending > 0 && <span className="text-brass-300 font-normal text-xs ml-1.5">+{pending} pending</span>}
              </>
            }
          />

          <div className="pt-3 mt-1 border-t border-ink-700 space-y-2.5">
            <div className="ui-eyebrow flex items-center gap-1.5">
              <Skull className="w-3.5 h-3.5" />
              Casualties
            </div>
            <Row label={<span className={SIDE_TEXT.USA}>USA</span>} value={formatNumber(casualties.usa)} />
            <Row label={<span className={SIDE_TEXT.CSA}>CSA</span>} value={formatNumber(casualties.csa)} />
            <Row label="Total" value={formatNumber(casualties.total)} />
          </div>
        </CardBody>
      </Card>

      {/* SP editor */}
      {showCPEditor && (
        <Modal
          icon={<Zap className="w-5 h-5" />}
          title="Edit Supply Points"
          subtitle="Manual adjustments are logged in SP history."
          width="max-w-md"
          onClose={() => setShowCPEditor(false)}
          footer={
            <>
              <button onClick={handleSaveCPChanges} className="ui-btn ui-btn-primary flex-1">
                <Save className="w-4 h-4" />
                Save Changes
              </button>
              <button onClick={() => setShowCPEditor(false)} className="ui-btn ui-btn-ghost flex-1">
                Cancel
              </button>
            </>
          }
        >
          <div className="space-y-4">
            {['USA', 'CSA'].map(side => (
              <div key={side}>
                <label className={`ui-label ${SIDE_TEXT[side]}`}>{side} Supply Points</label>
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={editedCP[side]}
                  onChange={(e) => setEditedCP({ ...editedCP, [side]: e.target.value })}
                  className="ui-field text-lg font-bold tabular"
                />
                <div className="mt-1 text-xs text-mist-500">
                  Current: {(side === 'USA' ? campaign.combatPowerUSA : campaign.combatPowerCSA) || 0} SP
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default CampaignStats;
