// Titled section card used across the after-action tabs.
export function Card({ title, hint, children, right }) {
  return (
    <div className="card p-4">
      {(title || right) && (
        <div className="flex items-start gap-3 mb-3">
          <div className="min-w-0">
            {title && <div className="text-[13px] font-semibold text-text tracking-tight">{title}</div>}
            {hint && <div className="text-[11px] text-muted mt-0.5 leading-snug max-w-prose">{hint}</div>}
          </div>
          {right && <div className="ml-auto shrink-0">{right}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

export function StatTile({ label, value, sub, color }) {
  return (
    <div className="inset px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-[0.08em] text-faint">{label}</div>
      <div className="text-xl font-semibold tabular-nums mt-0.5 leading-none" style={color ? { color } : undefined}>{value}</div>
      {sub && <div className="text-[11px] text-muted mt-1">{sub}</div>}
    </div>
  );
}
