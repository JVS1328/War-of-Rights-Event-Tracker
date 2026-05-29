import type { ReactNode } from 'react';

/** KPI block: small uppercase label over a large mono value, optional hint. */
export function Tile({
  label,
  value,
  hint,
  pulse,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  pulse?: boolean;
}) {
  return (
    <div
      className={`border border-[color:var(--color-border)] bg-[color:var(--color-bg-1)] px-3 py-2 ${
        pulse ? 'pulse' : ''
      }`}
    >
      <div className="text-[10px] uppercase tracking-wider text-[color:var(--color-text-2)] font-mono">
        {label}
      </div>
      <div className="mt-1 text-[18px] font-mono text-[color:var(--color-text-0)] tabular-nums">
        {value}
      </div>
      {hint && (
        <div className="mt-0.5 text-[10px] text-[color:var(--color-text-2)] font-mono">{hint}</div>
      )}
    </div>
  );
}
