// Horizontal bar-meter list — for ranked breakdowns (casualties by cause,
// distance by unit, leader time, …). Each row is a label + a proportional bar
// + a value. Optionally a split USA/CSA bar via `usa`/`csa`.

const TEAM_COLOR = { usa: '#3b82f6', csa: '#ef4444' };

export default function BarMeter({ rows, max, valueFormat = (v) => `${v}`, color = '#f59e0b', split = false }) {
  if (!rows || rows.length === 0) {
    return <div className="text-xs text-slate-500 py-2">No data.</div>;
  }
  const hi = max ?? Math.max(1, ...rows.map((r) => (split ? (r.usa || 0) + (r.csa || 0) : r.value || 0)));
  return (
    <div className="space-y-1">
      {rows.map((r) => {
        const total = split ? (r.usa || 0) + (r.csa || 0) : r.value || 0;
        return (
          <div key={r.key ?? r.label} className="flex items-center gap-2 text-[11px]">
            <span className="w-28 shrink-0 truncate text-slate-300" title={r.label}>{r.label}</span>
            <div className="flex-1 h-3 bg-slate-900/60 rounded overflow-hidden flex">
              {split ? (
                <>
                  <div className="h-full" style={{ width: `${((r.usa || 0) / hi) * 100}%`, background: TEAM_COLOR.usa }} />
                  <div className="h-full" style={{ width: `${((r.csa || 0) / hi) * 100}%`, background: TEAM_COLOR.csa }} />
                </>
              ) : (
                <div className="h-full rounded" style={{ width: `${(total / hi) * 100}%`, background: r.color || color }} />
              )}
            </div>
            <span className="w-14 shrink-0 text-right tabular-nums text-slate-200">{valueFormat(total)}</span>
          </div>
        );
      })}
    </div>
  );
}
