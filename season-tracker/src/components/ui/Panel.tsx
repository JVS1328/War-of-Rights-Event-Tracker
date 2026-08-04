import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * A ledger panel: a header band with the title, a rule, and whatever sits at
 * the end, then the body. Optionally collapsible with localStorage-persisted
 * state.
 */
export function Panel({
  title,
  right,
  children,
  className = '',
  flush = false,
  collapsible = false,
  defaultOpen = true,
  storageKey,
  openSignal,
}: {
  title: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Drop the body padding — for tables and column grids that rule themselves. */
  flush?: boolean;
  collapsible?: boolean;
  defaultOpen?: boolean;
  storageKey?: string;
  openSignal?: unknown;
}) {
  const [open, setOpen] = useState<boolean>(defaultOpen);

  useEffect(() => {
    if (!collapsible || !storageKey) return;
    const v = window.localStorage.getItem(storageKey);
    if (v === '0') setOpen(false);
    else if (v === '1') setOpen(true);
  }, [collapsible, storageKey]);

  useEffect(() => {
    if (openSignal !== undefined && openSignal !== null) setOpen(true);
  }, [openSignal]);

  const toggle = () => {
    if (!collapsible) return;
    const next = !open;
    setOpen(next);
    if (storageKey) window.localStorage.setItem(storageKey, next ? '1' : '0');
  };

  return (
    <div className={`panel ${className}`}>
      <header className="ph">
        {collapsible ? (
          <button
            onClick={toggle}
            aria-expanded={open}
            style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}
          >
            <span style={{ color: 'var(--ink-3)', fontSize: 10 }}>{open ? '▾' : '▸'}</span>
            <h2>{title}</h2>
          </button>
        ) : (
          <h2>{title}</h2>
        )}
        <span className="rule" />
        {right}
      </header>
      {open && <div className={flush ? 'pb flush' : 'pb'}>{children}</div>}
    </div>
  );
}
