import { Calendar, Archive, Flag, SkipForward, Play, DollarSign, Users, Footprints, Swords, Package, Shield } from 'lucide-react';
import { findAttackTargets, findStrongholdAtToken, canReplenish } from '../utils/grandCampaignLogic';

/**
 * TurnTracker — the "whose turn is it" HUD for Grand Campaign.
 *
 * Shows current month, active side, current token, bag/discard counts, and
 * the national pools. Buttons:
 *   - Draw Next Token: starts the next token's turn (from activeSide's bag)
 *   - End Turn: ends the currently-drawn token's turn, flips activeSide
 */
const TurnTracker = ({ campaign, onDrawNext, onEndTurn, onBeginMove, turnMoveActive, onAttack, onReplenish, onGarrison }) => {
  const gc = campaign?.grandCampaign;
  if (!gc || gc.phase !== 'playing') return null;

  const currentToken = gc.tokens.find(t => t.id === gc.currentTokenId);
  const activeSide = gc.activeSide;
  const sideColor = activeSide === 'USA' ? 'text-blue-400' : 'text-red-400';
  const bagUSA = gc.bags.USA.length;
  const bagCSA = gc.bags.CSA.length;
  const discardUSA = gc.bags.discardUSA.length;
  const discardCSA = gc.bags.discardCSA.length;
  const month = campaign.currentTurn;

  return (
    <div className="bg-slate-800 rounded-lg border-2 border-amber-500 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold text-amber-400 flex items-center gap-2">
          <Calendar className="w-5 h-5" /> Month {month}
        </h3>
        <div className="text-xs text-slate-400">
          {gc.monthStartedBy && (
            <>Month started by <span className={gc.monthStartedBy === 'USA' ? 'text-blue-400' : 'text-red-400'}>
              {gc.monthStartedBy}
            </span></>
          )}
        </div>
      </div>

      {/* Current turn indicator */}
      <div className="bg-slate-900 rounded p-3 mb-3">
        <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
          <Flag className="w-3.5 h-3.5" /> Now acting
        </div>
        {currentToken ? (
          <>
            <div className={`text-xl font-bold ${sideColor}`}>{currentToken.name}</div>
            <div className="text-[11px] text-slate-300 mt-1">
              MP used: <span className="text-white">{currentToken.movementPointsUsed || 0}</span>
              {' / '}{gc.settings.movementPointsPerTurn}
              {' · '}Manpower: <span className="text-white">{currentToken.manpower}</span>
              {' · '}Fatigue: <span className="text-white">{currentToken.fatigue}</span>
              {currentToken.status === 'last-stand' && <span className="text-orange-400 ml-1 font-bold">LAST STAND</span>}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {onBeginMove && (currentToken.movementPointsUsed || 0) < gc.settings.movementPointsPerTurn && currentToken.status !== 'wiped' && (
                <button
                  onClick={onBeginMove}
                  className={`flex-1 min-w-[80px] rounded py-1.5 text-sm font-semibold flex items-center justify-center gap-1 ${
                    turnMoveActive
                      ? 'bg-amber-600 hover:bg-amber-500 text-white'
                      : 'bg-amber-700 hover:bg-amber-600 text-white'
                  }`}
                >
                  <Footprints className="w-4 h-4" />
                  {turnMoveActive ? 'Cancel' : 'Move'}
                </button>
              )}
              {onAttack && currentToken.status === 'active' && findAttackTargets(campaign, currentToken.id).length > 0 && (
                <button
                  onClick={onAttack}
                  className="flex-1 min-w-[80px] bg-red-700 hover:bg-red-600 text-white rounded py-1.5 text-sm font-semibold flex items-center justify-center gap-1"
                >
                  <Swords className="w-4 h-4" /> Attack
                </button>
              )}
              {onReplenish && canReplenish(campaign, currentToken.id).ok && (
                <button
                  onClick={onReplenish}
                  className="flex-1 min-w-[80px] bg-emerald-700 hover:bg-emerald-600 text-white rounded py-1.5 text-sm font-semibold flex items-center justify-center gap-1"
                  title="Replenish at city/fort"
                >
                  <Package className="w-4 h-4" /> Replenish
                </button>
              )}
              {onGarrison && findStrongholdAtToken(campaign, currentToken.id) && currentToken.status === 'active' && (
                <button
                  onClick={onGarrison}
                  className="flex-1 min-w-[80px] bg-slate-500 hover:bg-slate-400 text-white rounded py-1.5 text-sm font-semibold flex items-center justify-center gap-1"
                  title="Garrison men here"
                >
                  <Shield className="w-4 h-4" /> Garrison
                </button>
              )}
              <button
                onClick={onEndTurn}
                className="flex-1 min-w-[80px] bg-blue-700 hover:bg-blue-600 text-white rounded py-1.5 text-sm font-semibold flex items-center justify-center gap-1"
              >
                <SkipForward className="w-4 h-4" /> End
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="text-sm text-slate-400 italic mb-2">
              No token drawn. Active side: <span className={sideColor + ' font-semibold'}>{activeSide}</span>.
            </div>
            <button
              onClick={onDrawNext}
              className="w-full bg-green-700 hover:bg-green-600 text-white rounded py-1.5 text-sm font-semibold flex items-center justify-center gap-1.5"
            >
              <Play className="w-4 h-4" /> Draw Next Token
            </button>
          </>
        )}
      </div>

      {/* Bag state */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-slate-900 rounded p-2">
          <div className="text-[10px] uppercase tracking-wide text-blue-400 mb-1">USA Bag</div>
          <div className="text-xs text-slate-300 flex items-center gap-1">
            <Archive className="w-3 h-3" /> Draw: <span className="text-white font-semibold">{bagUSA}</span>
            <span className="mx-1">·</span> Disc: <span className="text-slate-400">{discardUSA}</span>
          </div>
        </div>
        <div className="bg-slate-900 rounded p-2">
          <div className="text-[10px] uppercase tracking-wide text-red-400 mb-1">CSA Bag</div>
          <div className="text-xs text-slate-300 flex items-center gap-1">
            <Archive className="w-3 h-3" /> Draw: <span className="text-white font-semibold">{bagCSA}</span>
            <span className="mx-1">·</span> Disc: <span className="text-slate-400">{discardCSA}</span>
          </div>
        </div>
      </div>

      {/* National pools */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-slate-900 rounded p-2">
          <div className="text-[10px] uppercase tracking-wide text-blue-400 mb-1">USA Pool</div>
          <div className="text-xs text-slate-300 flex items-center gap-1">
            <DollarSign className="w-3 h-3 text-green-400" />
            <span className="text-white font-semibold">${gc.pools.USA.treasury.toLocaleString()}</span>
          </div>
          <div className="text-xs text-slate-300 flex items-center gap-1 mt-0.5">
            <Users className="w-3 h-3 text-amber-400" />
            <span className="text-white font-semibold">{gc.pools.USA.manpower.toLocaleString()}</span>
          </div>
        </div>
        <div className="bg-slate-900 rounded p-2">
          <div className="text-[10px] uppercase tracking-wide text-red-400 mb-1">CSA Pool</div>
          <div className="text-xs text-slate-300 flex items-center gap-1">
            <DollarSign className="w-3 h-3 text-green-400" />
            <span className="text-white font-semibold">${gc.pools.CSA.treasury.toLocaleString()}</span>
          </div>
          <div className="text-xs text-slate-300 flex items-center gap-1 mt-0.5">
            <Users className="w-3 h-3 text-amber-400" />
            <span className="text-white font-semibold">{gc.pools.CSA.manpower.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="text-[10px] text-slate-500 mt-2 italic">
        When both bags empty, the month rolls over: income, manpower regen, and the first drawer flips.
      </div>
    </div>
  );
};

export default TurnTracker;
