import { useState } from 'react';
import { X } from 'lucide-react';
import { DEFAULT_GRAND_SETTINGS, createGrandCampaign } from '../data/grandTemplate';

const NumField = ({ label, value, onChange, step = 1 }) => (
  <label className="block">
    <span className="text-xs text-slate-400 uppercase tracking-wide">{label}</span>
    <input
      type="number"
      value={value}
      step={step}
      onChange={e => onChange(Number(e.target.value))}
      className="w-full mt-1 px-2 py-1.5 bg-slate-700 text-white rounded text-sm"
    />
  </label>
);

const NewGrandCampaignModal = ({ onCreate, onClose }) => {
  const [name, setName] = useState('Grand Campaign');
  const [s, setS] = useState({ ...DEFAULT_GRAND_SETTINGS });

  const update = (patch) => setS(prev => ({ ...prev, ...patch }));

  const handleCreate = () => {
    const campaign = createGrandCampaign({ name, settings: s });
    onCreate(campaign);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg border border-slate-700 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-2xl font-bold text-amber-400">New Grand Campaign</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <label className="block">
            <span className="text-xs text-slate-400 uppercase tracking-wide">Campaign Name</span>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full mt-1 px-3 py-2 bg-slate-700 text-white rounded"
            />
          </label>

          <div>
            <h3 className="text-sm font-semibold text-amber-400 uppercase mb-3">Starting Resources</h3>
            <div className="grid grid-cols-3 gap-3">
              <NumField label="Starting $" value={s.startingMoney} onChange={v => update({ startingMoney: v })} step={100} />
              <NumField label="Starting Manpower Pool" value={s.startingManpower} onChange={v => update({ startingManpower: v })} step={500} />
              <NumField label="Manpower / Token" value={s.manpowerPerToken} onChange={v => update({ manpowerPerToken: v })} step={100} />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-amber-400 uppercase mb-3">Income & Payouts</h3>
            <div className="grid grid-cols-3 gap-3">
              <NumField label="$/city/month" value={s.cityIncomeMoney} onChange={v => update({ cityIncomeMoney: v })} step={10} />
              <NumField label="MP/city/month" value={s.cityIncomeManpower} onChange={v => update({ cityIncomeManpower: v })} step={50} />
              <NumField label="Capture Bonus ($)" value={s.captureBonus} onChange={v => update({ captureBonus: v })} step={50} />
              <NumField label="Battle Win ($)" value={s.winBonus} onChange={v => update({ winBonus: v })} step={50} />
              <NumField label="Replenish $" value={s.replenishCost} onChange={v => update({ replenishCost: v })} step={50} />
              <NumField label="Replenish MP" value={s.replenishManpowerCost} onChange={v => update({ replenishManpowerCost: v })} step={25} />
              <NumField label="Replenish Soldiers" value={s.replenishSoldiers} onChange={v => update({ replenishSoldiers: v })} step={25} />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-amber-400 uppercase mb-3">Combat</h3>
            <div className="grid grid-cols-3 gap-3">
              <NumField label="Winter Attrition %" value={s.winterAttritionPct} onChange={v => update({ winterAttritionPct: v })} />
              <NumField label="Train/River Ambush %" value={s.trainRiverAmbushPct} onChange={v => update({ trainRiverAmbushPct: v })} />
              <NumField label="Fatigue % / point" value={s.fatigueCasPctPerPoint} onChange={v => update({ fatigueCasPctPerPoint: v })} />
              <NumField label="Garrison Max" value={s.garrisonMax} onChange={v => update({ garrisonMax: v })} step={50} />
              <NumField label="Last Stand Low (wipe under)" value={s.lastStandLow} onChange={v => update({ lastStandLow: v })} step={50} />
              <NumField label="Last Stand High (ceil)" value={s.lastStandHigh} onChange={v => update({ lastStandHigh: v })} step={50} />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-amber-400 uppercase mb-3">Movement</h3>
            <div className="grid grid-cols-4 gap-3">
              <NumField label="MP / turn" value={s.mpPerTurn} onChange={v => update({ mpPerTurn: v })} />
              <NumField label="March hex/MP" value={s.marchHexPerMP} onChange={v => update({ marchHexPerMP: v })} />
              <NumField label="River hex/MP" value={s.riverHexPerMP} onChange={v => update({ riverHexPerMP: v })} />
              <NumField label="Train hex/MP" value={s.trainHexPerMP} onChange={v => update({ trainHexPerMP: v })} />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-amber-400 uppercase mb-3">Victory</h3>
            <div className="grid grid-cols-4 gap-3">
              <NumField label="VP to win" value={s.vpToWin} onChange={v => update({ vpToWin: v })} />
              <NumField label="VP / capital" value={s.vpPerCapital} onChange={v => update({ vpPerCapital: v })} />
              <NumField label="VP / wipe" value={s.vpPerWipe} onChange={v => update({ vpPerWipe: v })} />
              <NumField label="Victories / Special" value={s.victoriesForSpecialCard} onChange={v => update({ victoriesForSpecialCard: v })} />
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded">Cancel</button>
          <button onClick={handleCreate} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-semibold">
            Create Campaign
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewGrandCampaignModal;
