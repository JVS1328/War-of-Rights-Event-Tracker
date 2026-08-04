import { FORMATION_LABEL, TICKET_WEIGHT } from '../../stats/labels';
import type { FormationCounts } from '../../stats/statsEngine';

const STOPS = [
  { key: 'in_form', hue: 'var(--color-stance-1)' },
  { key: 'skirm', hue: 'var(--color-stance-2)' },
  { key: 'oob', hue: 'var(--color-stance-3)' },
] as const;

/**
 * Where a side's losses happened, as one stacked bar.
 *
 * The three stances are an ordinal cost scale (1 · 3 · 5 tickets), so they get
 * their own sequential ramp rather than borrowing the faction hues — a green
 * segment must never have to mean both "in formation" and "Union".
 */
export function StanceBar({ counts, label }: { counts: FormationCounts; label: string }) {
  const total = counts.in_form + counts.skirm + counts.oob;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-[color:var(--color-text-2)]">{label}</div>
      <div className="mt-2 flex h-2.5 bg-[color:var(--color-bg-2)]">
        {total > 0 &&
          STOPS.map(({ key, hue }) => (
            <span key={key} style={{ width: `${(counts[key] / total) * 100}%`, background: hue }} />
          ))}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-2xs text-[color:var(--color-text-1)]">
        {STOPS.map(({ key, hue }) => (
          <span key={key} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2" style={{ background: hue }} />
            {FORMATION_LABEL[key]} · {TICKET_WEIGHT[key]} tkt
            <span className="tabular-nums text-[color:var(--color-text-0)]">{counts[key]}</span>
            <span className="tabular-nums text-[color:var(--color-text-2)]">{pct(counts[key])}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}
