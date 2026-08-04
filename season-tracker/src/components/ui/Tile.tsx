import type { ReactNode } from 'react';

/** One figure with its label — the cell a KPI strip is made of. */
export function Tile({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="kpi">
      <div className="cap">{label}</div>
      <div className="v">{value}</div>
      {hint != null && <div className="h">{hint}</div>}
    </div>
  );
}
