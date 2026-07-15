// Titled section card used across the after-action tabs.
export function Card({ title, hint, children, right }) {
  return (
    <div className="bg-slate-800 rounded-lg p-3">
      {(title || right) && (
        <div className="flex items-center gap-2 mb-2">
          <div>
            {title && <div className="text-sm font-semibold text-slate-200">{title}</div>}
            {hint && <div className="text-[11px] text-slate-500">{hint}</div>}
          </div>
          {right && <div className="ml-auto">{right}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

export function StatTile({ label, value, sub, color }) {
  return (
    <div className="bg-slate-900/60 rounded px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-lg font-bold tabular-nums" style={color ? { color } : undefined}>{value}</div>
      {sub && <div className="text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}
