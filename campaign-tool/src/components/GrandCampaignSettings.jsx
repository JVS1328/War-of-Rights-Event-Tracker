import { GRAND_CAMPAIGN_DEFAULTS } from '../data/grandCampaign';

/**
 * GrandCampaignSettings — compact form for all Grand Campaign tunables.
 *
 * Renders as a single section inside the existing SettingsModal. Receives the
 * current gcSettings and an onChange callback that fires with the next full
 * settings object whenever any field is edited.
 */

// Group definitions drive the rendering — keeps the JSX from becoming a wall.
const FIELD_GROUPS = [
  {
    title: 'Starting Pools',
    fields: [
      { key: 'startingTreasury', label: 'Starting Treasury ($)', type: 'number' },
      { key: 'startingManpower', label: 'Starting Manpower (pool)', type: 'number' },
      { key: 'startingTokenStrength', label: 'Token Starting Strength', type: 'number' },
    ],
  },
  {
    title: 'Monthly Income (per owned city)',
    fields: [
      { key: 'incomePerCity', label: 'Money / city / month', type: 'number' },
      { key: 'manpowerPerCity', label: 'Manpower / city / month', type: 'number' },
    ],
  },
  {
    title: 'Battle Rewards',
    fields: [
      { key: 'moneyPerBattleWin', label: 'Money per battle won', type: 'number' },
      { key: 'moneyPerCityCapture', label: 'Money per city/fort captured', type: 'number' },
    ],
  },
  {
    title: 'Replenishment (at a friendly city/fort, ends turn)',
    fields: [
      { key: 'replenishMoneyCost', label: 'Treasury cost', type: 'number' },
      { key: 'replenishManpowerCost', label: 'National manpower cost', type: 'number' },
      { key: 'replenishYield', label: 'Men added to token', type: 'number' },
    ],
  },
  {
    title: 'Garrison',
    fields: [
      { key: 'maxGarrison', label: 'Max men per garrison', type: 'number' },
      { key: 'garrisonCasPer100', label: 'Counter-cas per 100 garrison men', type: 'number' },
    ],
  },
  {
    title: 'Movement (inches per MP)',
    fields: [
      { key: 'movementPointsPerTurn', label: 'MP per turn', type: 'number' },
      { key: 'marchInchesPerMP', label: 'March', type: 'number' },
      { key: 'riverInchesPerMP', label: 'River', type: 'number' },
      { key: 'railInchesPerMP', label: 'Rail', type: 'number' },
      { key: 'riverCrossCost', label: 'River crossing cost (MP)', type: 'number' },
    ],
  },
  {
    title: 'Proximity (inches)',
    fields: [
      { key: 'railSnapInches', label: 'Rail snap distance', type: 'number', step: '0.1' },
      { key: 'riverSnapInches', label: 'River snap distance', type: 'number', step: '0.1' },
      { key: 'combatAdjacencyInches', label: 'Combat adjacency', type: 'number', step: '0.1' },
      { key: 'supportRangeInches', label: 'Supporter range', type: 'number', step: '0.1' },
      { key: 'tokenFootprintInches', label: 'Token footprint (collision)', type: 'number', step: '0.1' },
      { key: 'svgUnitsPerInch', label: 'SVG units per inch (map calibration)', type: 'number' },
    ],
  },
  {
    title: 'Combat Casualty Modifiers (% added to raw casualties)',
    fields: [
      { key: 'fatigueCasPct', label: 'Fatigue — per point', type: 'number' },
      { key: 'winterAttackerCasPct', label: 'Winter — attacker', type: 'number' },
      { key: 'trainRiverCasPct', label: 'Train or river', type: 'number' },
    ],
  },
  {
    title: 'Last Stand',
    fields: [
      { key: 'lastStandMin', label: 'Lower bound (wipe below this)', type: 'number' },
      { key: 'lastStandMax', label: 'Upper bound (enter last stand ≤)', type: 'number' },
    ],
  },
  {
    title: 'Victory',
    fields: [
      { key: 'vpToWin', label: 'VP to win', type: 'number' },
      { key: 'vpPerCapitalCapture', label: 'VP per capital captured', type: 'number' },
      { key: 'vpPerTokenWipe', label: 'VP per token wiped', type: 'number' },
    ],
  },
];

const GrandCampaignSettings = ({ gcSettings, onChange }) => {
  const s = { ...GRAND_CAMPAIGN_DEFAULTS, ...(gcSettings || {}) };

  const set = (key, raw) => {
    const value = raw === '' ? 0 : Number(raw);
    onChange({ ...s, [key]: Number.isFinite(value) ? value : 0 });
  };

  const setWinterMonths = (raw) => {
    const months = raw.split(',')
      .map(x => parseInt(x.trim(), 10))
      .filter(n => Number.isFinite(n) && n >= 1 && n <= 12);
    onChange({ ...s, winterMonths: months });
  };

  return (
    <div className="bg-slate-700 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-amber-300 mb-3">Grand Campaign Settings</h3>
      <div className="space-y-4">
        {FIELD_GROUPS.map(group => (
          <div key={group.title}>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{group.title}</div>
            <div className="grid grid-cols-2 gap-2">
              {group.fields.map(f => (
                <label key={f.key} className="block">
                  <div className="text-[11px] text-slate-300 mb-1">{f.label}</div>
                  <input
                    type={f.type}
                    step={f.step || '1'}
                    value={s[f.key]}
                    onChange={e => set(f.key, e.target.value)}
                    className="w-full bg-slate-800 text-white px-2 py-1 rounded text-sm border border-slate-600 focus:border-amber-500 outline-none"
                  />
                </label>
              ))}
            </div>
          </div>
        ))}

        {/* Winter months — comma-separated list */}
        <div>
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Winter Months</div>
          <label className="block">
            <div className="text-[11px] text-slate-300 mb-1">Comma-separated month numbers 1–12 (defaults 12,1,2)</div>
            <input
              type="text"
              value={(s.winterMonths || []).join(',')}
              onChange={e => setWinterMonths(e.target.value)}
              className="w-full bg-slate-800 text-white px-2 py-1 rounded text-sm border border-slate-600 focus:border-amber-500 outline-none"
            />
          </label>
        </div>
      </div>

      <div className="mt-3 text-[10px] text-slate-500 italic">
        All values are persisted in campaign.grandCampaign.settings. Existing live state (pools, tokens, map features) is not reset by settings changes — only future actions use the new values.
      </div>
    </div>
  );
};

export default GrandCampaignSettings;
