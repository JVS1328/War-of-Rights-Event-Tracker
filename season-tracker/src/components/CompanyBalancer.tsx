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
    <div className="fld">
      <label className="cap">{label}</label>
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
    <div className="grid-f">
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
    <div style={{ marginTop: 11 }}>
      {companies.map((co, idx) => {
        const kind = COMPANY_KINDS[co.kind];
        const over = co.totalAvg > co.cap;
        return (
          <div
            key={idx}
            style={{
              borderTop: idx === 0 ? '1px solid var(--line)' : 0,
              borderBottom: '1px solid var(--line)',
              padding: '6px 0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span className={`tag q ${kind.text}`}>{co.label}</span>
              <span className="rule" />
              <span className="meta" style={over ? { color: 'var(--live)' } : undefined}>
                {Math.round(co.totalAvg)} of {co.cap}{over && ' — over cap'}
              </span>
            </div>
            <div className="note" style={{ marginTop: 3 }}>
              {co.regiments.length > 0 ? co.regiments.join(' · ') : 'Empty'}
            </div>
          </div>
        );
      })}
    </div>
  );
}
