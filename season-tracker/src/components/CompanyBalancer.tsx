import { COMPANY_KINDS, SPECIAL_COMPANY_CAP } from '../utils/companySplit';
import type { Company, CompanySideConfig } from '../utils/companySplit';

const INPUT_CLASS =
  'w-full px-2 py-1 bg-bg-inset text-text-primary text-sm rounded border border-border-default focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none';

/** The company-count inputs for one side: companies, special, cavalry + its cap. */
export function CompanyConfigFields({
  config,
  onChange,
}: {
  config: CompanySideConfig;
  onChange: (patch: Partial<CompanySideConfig>) => void;
}) {
  const field = (label: string, key: keyof CompanySideConfig, max?: number) => (
    <div>
      <label className="text-xs text-text-secondary">{label}</label>
      <input
        type="number"
        min="0"
        max={max}
        value={config[key]}
        onChange={(e) => onChange({ [key]: Math.max(0, parseInt(e.target.value, 10) || 0) })}
        className={INPUT_CLASS}
      />
    </div>
  );

  return (
    <div className="grid grid-cols-2 gap-2">
      {field('Companies', 'count', 10)}
      {field(`Special (cap ${SPECIAL_COMPANY_CAP})`, 'specialCount', config.count)}
      {field('Cavalry', 'cavalryCount', Math.max(0, config.count - config.specialCount))}
      {field('Cavalry cap', 'cavalryCap')}
    </div>
  );
}

/** The packed companies for one side: kind-coloured, with an over-cap warning. */
export function CompanyList({ companies }: { companies: Company[] }) {
  if (companies.length === 0) return null;
  return (
    <div className="space-y-1 mt-1">
      {companies.map((co, idx) => {
        const kind = COMPANY_KINDS[co.kind];
        return (
          <div key={idx} className={`text-xs rounded px-2 py-1 ${kind.box}`}>
            <span className={`font-semibold ${kind.text}`}>{co.label}</span>
            <span className="text-text-secondary ml-1">({Math.round(co.totalAvg)} avg)</span>
            {co.totalAvg > co.cap && <span className="text-red-400 ml-1">OVER CAP</span>}
            <div className="text-text-secondary mt-0.5">
              {co.regiments.length > 0 ? co.regiments.join(', ') : 'Empty'}
            </div>
          </div>
        );
      })}
    </div>
  );
}
