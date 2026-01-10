import { useState } from 'react';
import { X, Settings, Save } from 'lucide-react';

const SettingsModal = ({ campaign, onSave, onClose }) => {
  const [settings, setSettings] = useState({
    name: campaign.name,
    ...campaign.settings
  });

  const handleSubmit = () => {
    onSave(settings);
  };

  const updateSetting = (key, value) => {
    setSettings({ ...settings, [key]: value });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg shadow-2xl border border-slate-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
              <Settings className="w-6 h-6" />
              Campaign Settings
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-700 rounded-lg transition"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          {/* Form */}
          <div className="space-y-6">
            {/* Campaign Info */}
            <div className="bg-slate-700 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-amber-300 mb-4">Campaign Information</h3>
              <div>
                <label className="block text-sm text-slate-300 mb-2 font-semibold">
                  Campaign Name
                </label>
                <input
                  type="text"
                  value={settings.name}
                  onChange={(e) => updateSetting('name', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 text-white rounded border border-slate-600 focus:border-amber-500 outline-none"
                />
              </div>
            </div>

            {/* Game Rules */}
            <div className="bg-slate-700 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-amber-300 mb-4">Game Rules</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.allowTerritoryRecapture}
                    onChange={(e) => updateSetting('allowTerritoryRecapture', e.target.checked)}
                    className="w-4 h-4 rounded border-slate-500 bg-slate-800 text-amber-500 focus:ring-amber-500"
                  />
                  <div>
                    <div className="text-white font-semibold">Allow Territory Recapture</div>
                    <div className="text-xs text-slate-400">
                      Territories can change hands multiple times during the campaign
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.requireAdjacentAttack}
                    onChange={(e) => updateSetting('requireAdjacentAttack', e.target.checked)}
                    className="w-4 h-4 rounded border-slate-500 bg-slate-800 text-amber-500 focus:ring-amber-500"
                  />
                  <div>
                    <div className="text-white font-semibold">Require Adjacent Territory Attacks</div>
                    <div className="text-xs text-slate-400">
                      Can only attack territories adjacent to owned territories
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.casualtyTracking}
                    onChange={(e) => updateSetting('casualtyTracking', e.target.checked)}
                    className="w-4 h-4 rounded border-slate-500 bg-slate-800 text-amber-500 focus:ring-amber-500"
                  />
                  <div>
                    <div className="text-white font-semibold">Track Casualties</div>
                    <div className="text-xs text-slate-400">
                      Record casualty counts for each battle
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.failedNeutralAttackToEnemy !== false}
                    onChange={(e) => updateSetting('failedNeutralAttackToEnemy', e.target.checked)}
                    className="w-4 h-4 rounded border-slate-500 bg-slate-800 text-amber-500 focus:ring-amber-500"
                  />
                  <div>
                    <div className="text-white font-semibold">Failed Attack on Neutral Territories Falls to Enemy Hands?</div>
                    <div className="text-xs text-slate-400">
                      When enabled, a failed attack on a neutral territory transfers control to the opposing side
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.instantVPGains !== false}
                    onChange={(e) => updateSetting('instantVPGains', e.target.checked)}
                    className="w-4 h-4 rounded border-slate-500 bg-slate-800 text-amber-500 focus:ring-amber-500"
                  />
                  <div>
                    <div className="text-white font-semibold">Instant VP Gains</div>
                    <div className="text-xs text-slate-400">
                      Award victory points immediately upon capturing a region
                    </div>
                  </div>
                </label>

                {settings.instantVPGains === false && (
                  <div className="ml-7 mt-2 bg-slate-800 rounded-lg p-3 border border-slate-600">
                    <label className="block">
                      <div className="text-white font-semibold mb-2 text-sm">
                        Capture Transition Duration (turns)
                      </div>
                      <div className="text-xs text-slate-400 mb-2">
                        Number of turns required to fully capture a region and gain its VP
                      </div>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={settings.captureTransitionTurns || 2}
                        onChange={(e) => updateSetting('captureTransitionTurns', parseInt(e.target.value))}
                        className="w-24 px-3 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:border-amber-500 outline-none"
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>
  
            {/* Combat Power System */}
            <div className="bg-slate-700 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-amber-300 mb-4">Combat Power (CP) System</h3>
              <div className="space-y-4">
                {/* Starting CP/VP */}
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <div className="text-white font-semibold mb-2 text-sm">
                      Starting CP per side
                    </div>
                    <div className="text-xs text-slate-400 mb-2">
                      Initial Combat Power pool for each faction
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="50"
                      value={settings.startingCP || 500}
                      onChange={(e) => updateSetting('startingCP', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-slate-800 text-white rounded border border-slate-600 focus:border-amber-500 outline-none"
                    />
                  </label>
                </div>
  
                {/* CP Calculation Mode */}
                <div>
                  <label className="block">
                    <div className="text-white font-semibold mb-2">
                      CP Loss Calculation Mode
                    </div>
                    <div className="text-xs text-slate-400 mb-2">
                      Choose how CP losses are calculated during battles
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => updateSetting('cpCalculationMode', 'auto')}
                        className={`flex-1 px-4 py-2 rounded font-semibold transition ${
                          (settings.cpCalculationMode || 'auto') === 'auto'
                            ? 'bg-amber-600 text-white'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        <div className="text-sm font-bold">Auto Calculate</div>
                        <div className="text-xs mt-1 opacity-80">Based on VP & casualties</div>
                      </button>
                      <button
                        onClick={() => updateSetting('cpCalculationMode', 'manual')}
                        className={`flex-1 px-4 py-2 rounded font-semibold transition ${
                          settings.cpCalculationMode === 'manual'
                            ? 'bg-amber-600 text-white'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        <div className="text-sm font-bold">Manual Entry</div>
                        <div className="text-xs mt-1 opacity-80">Enter CP loss manually</div>
                      </button>
                    </div>
                  </label>
                </div>
              </div>
            </div>
  
            {/* Team Abilities */}
            <div className="bg-slate-700 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-amber-300 mb-4">Team Abilities</h3>
              <div>
                <label className="block">
                  <div className="text-white font-semibold mb-2">
                    Ability Cooldown (turns)
                  </div>
                  <div className="text-xs text-slate-400 mb-2">
                    Number of turns before an ability can be used again after activation
                  </div>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={settings.abilityCooldown || 2}
                    onChange={(e) => updateSetting('abilityCooldown', parseInt(e.target.value))}
                    className="w-24 px-3 py-2 bg-slate-800 text-white rounded border border-slate-600 focus:border-amber-500 outline-none"
                  />
                </label>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="bg-slate-800 rounded p-3">
                    <div className="text-red-400 font-semibold mb-1">Valley Supply Lines (CSA)</div>
                    <div className="text-slate-300 text-xs">
                      When attacking: Attack CP loss reduced by 50%
                    </div>
                  </div>
                  <div className="bg-slate-800 rounded p-3">
                    <div className="text-blue-400 font-semibold mb-1">Special Orders 191 (USA)</div>
                    <div className="text-slate-300 text-xs">
                      When attacking: Failed attacks on neutral territories keep them neutral (if setting enabled),
                      successful attacks triple CSA CP loss
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={handleSubmit}
              className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save Settings
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-slate-600 hover:bg-slate-500 text-white rounded-lg font-semibold transition"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;