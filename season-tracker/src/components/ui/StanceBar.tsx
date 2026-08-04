import { FORMATION_LABEL, TICKET_WEIGHT } from '../../stats/labels';
import type { FormationCounts } from '../../stats/statsEngine';

const STOPS = [
  { key: 'in_form', hue: 'var(--st1)' },
  { key: 'skirm', hue: 'var(--st2)' },
  { key: 'oob', hue: 'var(--st3)' },
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
      <div className="cap">{label}</div>
      <div className="stack" style={{ marginTop: 7 }}>
        {total > 0 &&
          STOPS.map(({ key, hue }) => (
            <i key={key} style={{ width: `${(counts[key] / total) * 100}%`, background: hue }} />
          ))}
      </div>
      <div className="leg">
        {STOPS.map(({ key, hue }) => (
          <span key={key}>
            <i style={{ background: hue }} />
            {FORMATION_LABEL[key]} · {TICKET_WEIGHT[key]} tkt
            <b style={{ color: 'var(--ink)', fontWeight: 400 }}>{counts[key]}</b>
            <span style={{ color: 'var(--ink-3)' }}>· {pct(counts[key])}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}
