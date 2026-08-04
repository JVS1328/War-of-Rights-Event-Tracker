import { COMPANY_KINDS } from '../utils/companySplit';
import type { Company, CompanySideConfig } from '../utils/companySplit';

const INPUT_CLASS =
  'fld-i';

/**
 * The company-count inputs for one side: how many companies, how many of them
 * are special or cavalry, and the cap on each of those kinds. Both caps are
 * per side — the special one used to be fixed at 20.
 */
export function CompanyConfigFields({
  config,
  onChange,
}: {
  config: CompanySideConfig;
  onChange: (patch: Partial<CompanySideConfig>) => void;
}) {
  // A count can legitimately be 0; a cap cannot, or nothing fits in it.
  const field = (label: string, key: keyof CompanySideConfig, max?: number, min = 0) => (
    <div>
      <label className="text-xs text-text-secondary">{label}</label>
      <input
        type="number"
        min={min}
        max={max}
        value={config[key]}
        onChange={(e) => onChange({ [key]: Math.max(min, parseInt(e.target.value, 10) || min) })}
        className={INPUT_CLASS}
      />
    </div>
  );

  return (
    <div className="grid grid-cols-2 gap-2">
      {field('Companies', 'count', 10)}
      {field('Special companies', 'specialCount', config.count)}
      {field('Special cap', 'specialCap', undefined, 1)}
      {field('Cavalry companies', 'cavalryCount', Math.max(0, config.count - config.specialCount))}
      {field('Cavalry cap', 'cavalryCap', undefined, 1)}
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
