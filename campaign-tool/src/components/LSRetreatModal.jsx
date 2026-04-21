import { Flag, X, MapPin, Footprints } from 'lucide-react';
import { inchesToMiles } from '../utils/grandCampaignLogic';

/**
 * LSRetreatModal — offered when a last-stand token wins a battle.
 *
 * The rules say this is a *may* retreat (up to N march-MP toward the
 * nearest friendly city). We give the player three options:
 *   - Skip: stay put.
 *   - Auto-retreat: use applyRetreat() toward the nearest stronghold.
 *   - Pick spot: close modal and enter a retreat-click mode on the map.
 */
const LSRetreatModal = ({ campaign, tokenId, maxMP, onSkip, onAuto, onPickSpot }) => {
  const gc = campaign?.grandCampaign;
  if (!gc || !tokenId) return null;
  const token = gc.tokens.find(t => t.id === tokenId);
  if (!token) return null;

  const maxInches = maxMP * gc.settings.marchInchesPerMP;
  const maxMiles = inchesToMiles(maxInches, gc.settings);

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border-2 border-orange-500 rounded-lg p-5 max-w-md w-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-orange-300 flex items-center gap-2">
            <Flag className="w-5 h-5" /> Last Stand Survived — May Retreat
          </h3>
          <button onClick={onSkip} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        <div className="bg-slate-900 rounded p-3 mb-3 text-sm">
          <div className={`font-semibold ${token.side === 'USA' ? 'text-blue-400' : 'text-red-400'}`}>
            {token.name} <span className="text-[10px]">({token.side})</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">
            MP: <span className="text-white">{token.manpower}</span>
            {' · '}Retreat range: <span className="text-white">{maxMiles} miles ({maxMP} march-MP)</span>
          </div>
          <div className="text-[11px] text-orange-300 mt-2">
            Rule: A last-stand winner takes no casualties and may retreat up to {maxMP} hexes toward its nearest friendly city. Optional — hold if you'd rather stay in place.
          </div>
        </div>

        <div className="space-y-2">
          <button
            onClick={onAuto}
            className="w-full bg-orange-700 hover:bg-orange-600 text-white rounded py-2 text-sm font-semibold flex items-center justify-center gap-2"
          >
            <MapPin className="w-4 h-4" /> Retreat toward nearest friendly city/fort
          </button>
          <button
            onClick={onPickSpot}
            className="w-full bg-slate-700 hover:bg-slate-600 text-white rounded py-2 text-sm font-semibold flex items-center justify-center gap-2"
          >
            <Footprints className="w-4 h-4" /> Choose destination on map…
          </button>
          <button
            onClick={onSkip}
            className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 rounded py-2 text-sm"
          >
            Hold position (skip retreat)
          </button>
        </div>
      </div>
    </div>
  );
};

export default LSRetreatModal;
