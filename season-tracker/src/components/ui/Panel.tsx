import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

/** Titled section, optionally collapsible with localStorage-persisted state. */
export function Panel({
  title,
  right,
  children,
  className = '',
  collapsible = false,
  defaultOpen = true,
  storageKey,
  openSignal,
}: {
  title: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  /** If provided, persists collapse state to localStorage. */
  storageKey?: string;
  /** When this changes to a non-null value, force the panel open (e.g. focus nav). */
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
    setOpen((prev) => {
      const next = !prev;
      if (storageKey) window.localStorage.setItem(storageKey, next ? '1' : '0');
      return next;
    });
  };

  return (
    <section
      className={`border border-[color:var(--color-border)] bg-[color:var(--color-bg-1)] flex flex-col ${className}`}
    >
      <header
        className={`flex items-center justify-between border-b border-[color:var(--color-border)] px-3 py-1.5 bg-[color:var(--color-bg-2)] ${
          collapsible ? 'cursor-pointer select-none hover:bg-[color:var(--color-bg-3)]' : ''
        }`}
        onClick={collapsible ? toggle : undefined}
        role={collapsible ? 'button' : undefined}
        tabIndex={collapsible ? 0 : undefined}
        onKeyDown={
          collapsible
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggle();
                }
              }
            : undefined
        }
      >
        <h2 className="text-sm uppercase tracking-wider text-[color:var(--color-text-1)] font-mono flex items-center gap-2">
          {collapsible && (
            <span className="text-[color:var(--color-text-2)] inline-block w-3">
              {open ? '▼' : '▶'}
            </span>
          )}
          {title}
        </h2>
        {right && (
          <div
            className="text-xs text-[color:var(--color-text-2)] font-mono"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {right}
          </div>
        )}
      </header>
      {open && <div className="flex-1 min-h-0 overflow-auto">{children}</div>}
    </section>
  );
}
