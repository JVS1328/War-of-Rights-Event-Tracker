import { Dice6, Users, Swords } from 'lucide-react';
import CommanderSpinner from './CommanderSpinner';

/**
 * CommanderRollPanel - Campaign-map side panel for rolling the commanders
 * who will lead the next battle.
 *
 * Rolling here reserves the regiment: it comes out of that side's commander
 * pool immediately and is pre-selected when the Battle Recorder is opened.
 * Standard campaigns only — Grand Campaign draws its commanders from tokens.
 */
const CommanderRollPanel = ({ campaign, onReserveCommander, onRecordBattle }) => {
  if (!campaign) return null;

  const regiments = campaign.regiments || { USA: [], CSA: [] };
  const pending = campaign.pendingCommanders || { USA: null, CSA: null };
  const hasRegiments = (regiments.USA?.length || 0) > 0 || (regiments.CSA?.length || 0) > 0;
  const rolledSides = ['USA', 'CSA'].filter(side => pending[side]);

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
      <div className="flex items-center gap-2 mb-1">
        <Dice6 className="w-5 h-5 text-amber-400" />
        <h3 className="text-xl font-bold text-amber-400">Battle Commanders</h3>
      </div>
      <p className="text-xs text-slate-400 mb-4">
        Roll who commands the next battle of Turn {campaign.currentTurn}. The winner is
        pulled from that side's pool and pre-selected in the Battle Recorder.
      </p>

      {!hasRegiments ? (
        <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-4 text-center">
          <Users className="w-6 h-6 text-slate-500 mx-auto mb-2" />
          <div className="text-sm text-slate-400">No regiments configured</div>
          <div className="text-xs text-slate-500 mt-1">
            Add regiments for USA and CSA in Settings to roll for commanders.
          </div>
        </div>
      ) : (
        <>
          <CommanderSpinner
            regiments={regiments}
            commanderPool={campaign.commanderPool}
            benchedCommanders={campaign.benchedCommanders}
            selectedCommanders={pending}
            onSelect={onReserveCommander}
          />

          <div className="mt-4 space-y-2">
            <div className="text-xs">
              {rolledSides.length === 0 ? (
                <span className="text-slate-500">Nobody rolled yet</span>
              ) : (
                <span className="text-green-400">
                  {rolledSides.map(side => `${side}: ${pending[side].name}`).join('  •  ')}
                  {rolledSides.length === 1 && (
                    <span className="text-slate-500"> — still need the other side</span>
                  )}
                </span>
              )}
            </div>
            {onRecordBattle && rolledSides.length > 0 && (
              <button
                onClick={onRecordBattle}
                className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2"
              >
                <Swords className="w-4 h-4" />
                Set Up Battle
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default CommanderRollPanel;
