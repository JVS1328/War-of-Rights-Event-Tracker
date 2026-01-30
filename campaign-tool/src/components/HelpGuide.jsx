import { useState } from 'react';
import { HelpCircle, X, ChevronDown, ChevronRight, Map, Swords, Trophy, Zap, Clock, Target } from 'lucide-react';

const HelpGuide = ({ isOpen, onClose }) => {
  const [expandedSections, setExpandedSections] = useState({
    overview: true,
    howToPlay: false,
    cpSystem: false,
    battles: false,
    abilities: false,
    victory: false,
    tips: false
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  if (!isOpen) return null;

  const Section = ({ id, title, icon: Icon, children }) => (
    <div className="border border-slate-600 rounded-lg overflow-hidden mb-3">
      <button
        onClick={() => toggleSection(id)}
        className="w-full flex items-center justify-between p-4 bg-slate-700 hover:bg-slate-600 transition"
      >
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-amber-400" />
          <span className="font-semibold text-white">{title}</span>
        </div>
        {expandedSections[id] ? (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-slate-400" />
        )}
      </button>
      {expandedSections[id] && (
        <div className="p-4 bg-slate-800 text-slate-300 text-sm leading-relaxed">
          {children}
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg shadow-2xl border border-slate-700 max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <HelpCircle className="w-8 h-8 text-amber-400" />
            <div>
              <h2 className="text-2xl font-bold text-amber-400">Campaign Tracker Guide</h2>
              <p className="text-slate-400 text-sm">For War of Rights Regiment Leaders</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition"
          >
            <X className="w-6 h-6 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <Section id="overview" title="What is the Campaign Tracker?" icon={Map}>
            <p className="mb-3">
              The <strong className="text-amber-400">Campaign Tracker</strong> is a strategic meta-game layer for War of Rights events.
              It allows regiment leaders to fight for control of territories across a campaign map, with each battle in War of Rights
              affecting the overall strategic situation.
            </p>
            <p className="mb-3">
              Think of it like a board game where the "battles" are resolved by actually playing War of Rights matches.
              Your regiment's performance in-game directly impacts whether you capture or hold territories on the campaign map.
            </p>
            <div className="bg-slate-700 p-3 rounded-lg mt-3">
              <p className="text-amber-400 font-semibold mb-2">Key Concepts:</p>
              <ul className="list-disc list-inside space-y-1">
                <li><strong>Territories</strong> - Regions on the map worth Victory Points (VP)</li>
                <li><strong>Combat Power (CP)</strong> - Your strategic resource for fighting battles</li>
                <li><strong>Turns</strong> - Campaign time advances in 2-month increments</li>
                <li><strong>Victory</strong> - Achieved by depleting enemy CP, controlling all territories, or having the most VP at war's end</li>
              </ul>
            </div>
          </Section>

          <Section id="howToPlay" title="How to Play" icon={Target}>
            <div className="space-y-4">
              <div>
                <p className="text-amber-400 font-semibold mb-2">1. Choose Your Target</p>
                <p>Select a territory to attack. You can attack neutral territories or enemy-held territories.
                Some campaigns require attacking adjacent territories only.</p>
              </div>
              <div>
                <p className="text-amber-400 font-semibold mb-2">2. Play the Battle</p>
                <p>Organize your War of Rights match. The attacking side picks the map (from available options).
                Play the match and record the results - who won and casualties on each side.</p>
              </div>
              <div>
                <p className="text-amber-400 font-semibold mb-2">3. Record the Battle</p>
                <p>Use the "Record Battle" button to log the results. The tracker will calculate CP costs for both sides
                based on the territory value, casualties, and outcome.</p>
              </div>
              <div>
                <p className="text-amber-400 font-semibold mb-2">4. Advance the Turn</p>
                <p>When ready to move to the next campaign phase, click "Advance Turn". This:</p>
                <ul className="list-disc list-inside ml-4 mt-1">
                  <li>Moves the campaign date forward 2 months</li>
                  <li>Generates CP for each side based on controlled territories</li>
                  <li>Reduces ability cooldowns</li>
                </ul>
              </div>
            </div>
          </Section>

          <Section id="cpSystem" title="Combat Power (CP) System" icon={Zap}>
            <p className="mb-3">
              CP represents your army's strategic strength and ability to wage war. Running out of CP means defeat!
            </p>

            <div className="space-y-3">
              <div className="bg-blue-900 bg-opacity-30 p-3 rounded-lg border border-blue-700">
                <p className="text-blue-400 font-semibold mb-2">📊 Understanding VP Multiplier</p>
                <p className="mb-2">
                  The VP Multiplier dynamically scales CP costs based on territory value:
                </p>
                <div className="bg-slate-800 p-2 rounded mt-2 font-mono text-xs">
                  <p className="text-amber-400 mb-1">Formula: VP Multiplier = Territory VP ÷ 5</p>
                  <p className="text-slate-400 mb-2">This works for ANY VP value, not just 5/10/15:</p>
                  <ul className="list-disc list-inside space-y-1 text-slate-300">
                    <li>5 VP = 1.0× multiplier</li>
                    <li>7 VP = 1.4× multiplier</li>
                    <li>10 VP = 2.0× multiplier</li>
                    <li>12 VP = 2.4× multiplier</li>
                    <li>15 VP = 3.0× multiplier</li>
                    <li>20 VP = 4.0× multiplier</li>
                  </ul>
                </div>
                <p className="text-green-400 text-xs mt-2 italic">
                  💡 Why? More valuable territories are harder to take and more costly to fight over.
                  The system scales smoothly for custom VP values, making it flexible for any campaign setup!
                </p>
              </div>

              <div className="bg-slate-700 p-3 rounded-lg">
                <p className="text-amber-400 font-semibold mb-2">CP Costs (Attackers)</p>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>Attacking Neutral:</strong> Base 50 CP × VP multiplier × (your casualties ÷ total casualties)</li>
                  <li><strong>Attacking Enemy:</strong> Base 75 CP × VP multiplier × (your casualties ÷ total casualties)</li>
                </ul>
                <p className="text-slate-400 text-xs mt-2">
                  VP Multiplier = Territory VP ÷ 5 (e.g., 10 VP = 2x multiplier)
                </p>
                <p className="text-green-400 text-xs mt-2 italic">
                  💡 Why? Attackers pay more because they're the aggressors - they must commit more resources to take territory.
                  Enemy territories cost even more (75 vs 50) because they're fortified and defended.
                </p>
              </div>

              <div className="bg-slate-700 p-3 rounded-lg">
                <p className="text-amber-400 font-semibold mb-2">CP Costs (Defenders)</p>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>Defending Friendly Territory:</strong> Base 25 CP × VP multiplier × (your casualties ÷ total casualties)</li>
                  <li><strong>Defending Neutral Territory:</strong> Base 50 CP × VP multiplier × (your casualties ÷ total casualties)</li>
                </ul>
                <p className="text-slate-400 text-xs mt-2">
                  Defender CP loss scales with their proportion of total casualties - the more you bleed, the more CP you lose.
                </p>
                <p className="text-green-400 text-xs mt-2 italic">
                  💡 Why? Defending your own territory is cheaper (25) because you have home advantage, supply lines, and fortifications.
                  Defending neutral ground costs more (50) because you lack these advantages - you're fighting away from home.
                </p>
              </div>

              <div className="bg-slate-700 p-3 rounded-lg">
                <p className="text-amber-400 font-semibold mb-2">Casualty Ratio Matters!</p>
                <p className="mb-2">
                  Both attackers and defenders pay CP based on the proportion of casualties they take:
                </p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>If you take 50% of total casualties, you pay 50% of max CP cost</li>
                  <li>If you take 80% of total casualties, you pay 80% of max CP cost</li>
                  <li>Win or lose, heavy casualties mean heavy CP losses</li>
                </ul>
                <p className="text-orange-400 text-xs mt-2 italic">
                  ⚠️ Pyrrhic victories hurt! Even if you win, taking massive casualties can cripple your campaign.
                </p>
              </div>

              <div className="bg-slate-700 p-3 rounded-lg">
                <p className="text-amber-400 font-semibold mb-2">CP Generation</p>
                <p>Each turn, you gain CP equal to the total VP of territories you control.
                Holding valuable territories is crucial for sustaining your war effort!</p>
              </div>
            </div>
          </Section>

          <Section id="battles" title="Battle Outcomes" icon={Swords}>
            <div className="space-y-3">
              <div>
                <p className="text-amber-400 font-semibold mb-2">If the Attacker Wins:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>The territory changes ownership to the attacker</li>
                  <li>VP is transferred immediately (or gradually, depending on settings)</li>
                  <li>Both sides pay CP based on casualties</li>
                </ul>
              </div>

              <div>
                <p className="text-amber-400 font-semibold mb-2">If the Defender Wins:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>The territory remains with its current owner</li>
                  <li>If it was neutral: may flip to the defender (configurable)</li>
                  <li>Both sides still pay CP based on casualties</li>
                </ul>
              </div>

              <div className="bg-slate-700 p-3 rounded-lg">
                <p className="text-amber-400 font-semibold mb-2">Map Cooldowns</p>
                <p>After a map is played, it goes on cooldown for 2 turns. This prevents the same battlefield
                from being used repeatedly and encourages variety.</p>
              </div>
            </div>
          </Section>

          <Section id="abilities" title="Special Abilities" icon={Zap}>
            <p className="mb-3">Each side has a unique ability that can turn the tide of a campaign:</p>

            <div className="space-y-3">
              <div className="bg-blue-900 bg-opacity-30 p-3 rounded-lg border border-blue-700">
                <p className="text-blue-400 font-semibold mb-2">USA: Special Orders 191</p>
                <p>When activated during an attack, if USA wins, the CSA defender loses <strong>3× their normal CP cost</strong>.
                Represents capturing Confederate battle plans, as happened before Antietam.</p>
              </div>

              <div className="bg-red-900 bg-opacity-30 p-3 rounded-lg border border-red-700">
                <p className="text-red-400 font-semibold mb-2">CSA: Valley Supply Lines</p>
                <p>When activated during an attack, the CSA attacker pays <strong>only 50% of normal CP cost</strong>.
                Represents efficient use of the Shenandoah Valley for logistics.</p>
              </div>

              <p className="text-slate-400 text-sm mt-2">
                Abilities have a cooldown (default: 2 turns) after use. Use them wisely!
              </p>
            </div>
          </Section>

          <Section id="victory" title="Victory Conditions" icon={Trophy}>
            <p className="mb-3">The campaign can end in several ways:</p>

            <div className="space-y-3">
              <div className="bg-amber-900 bg-opacity-30 p-3 rounded-lg border border-amber-700">
                <p className="text-amber-400 font-semibold mb-2">1. CP Depletion (Immediate Victory)</p>
                <p>If either side's CP drops to 0 or below, they immediately lose.
                This represents their army's collapse from exhaustion and attrition.</p>
              </div>

              <div className="bg-amber-900 bg-opacity-30 p-3 rounded-lg border border-amber-700">
                <p className="text-amber-400 font-semibold mb-2">2. Total Control (Immediate Victory)</p>
                <p>If one side controls ALL territories on the map, they win immediately.
                Total conquest!</p>
              </div>

              <div className="bg-amber-900 bg-opacity-30 p-3 rounded-lg border border-amber-700">
                <p className="text-amber-400 font-semibold mb-2">3. Campaign End Date (December 1865)</p>
                <p>If the campaign reaches its end date, the side with the most VP wins.
                This represents the political/strategic situation at war's end.</p>
              </div>
            </div>
          </Section>

          <Section id="tips" title="Tips for Regiment Leaders" icon={Clock}>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-amber-400">•</span>
                <span><strong>Manage CP carefully</strong> - Aggressive campaigns can deplete your CP quickly. Balance offense with defense.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400">•</span>
                <span><strong>High-value territories matter</strong> - They give more VP and generate more CP per turn. Prioritize them.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400">•</span>
                <span><strong>Casualties affect CP loss</strong> - Even if you win, taking heavy casualties costs you more CP. Fight smart!</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400">•</span>
                <span><strong>Use abilities at key moments</strong> - Don't waste them on minor battles. Save them for critical campaigns.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400">•</span>
                <span><strong>Export regularly</strong> - Use the Export button to save your campaign progress. Imports let you restore or share campaigns.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400">•</span>
                <span><strong>Edit Map for custom campaigns</strong> - Use the Map Editor to create custom territory layouts and VP values.</span>
              </li>
            </ul>
          </Section>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 bg-slate-900">
          <button
            onClick={onClose}
            className="w-full px-4 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold transition"
          >
            Got It!
          </button>
        </div>
      </div>
    </div>
  );
};

export default HelpGuide;
