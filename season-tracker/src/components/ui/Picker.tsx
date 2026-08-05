/**
 * A select you can type into.
 *
 * A native <select> is fine for four maps and useless for four hundred
 * players: the browser's own type-ahead only matches from the first character,
 * so finding "[51stNY]Vol.Sturgis" means knowing it starts with a bracket.
 * This filters on any part of the label, and on a second field — a player's
 * unit, a unit's division — so you can narrow by the thing you remember.
 *
 * Deliberately not a combobox that accepts free text: the value is always one
 * of the options, and typing only ever filters. That keeps it impossible to
 * end up with a subject that does not exist.
 */
import { useEffect, useMemo, useRef, useState } from 'react';

export interface PickerOption {
  value: string;
  label: string;
  /** Secondary text — searched, and shown muted after the label. */
  hint?: string;
}

/** Case- and punctuation-insensitive, so "51stny" finds "[51stNY]". */
const norm = (s: string) => s.toLowerCase().replace(/[\s\-_.[\]()]/g, '');

export function Picker({
  value,
  options,
  onChange,
  label,
  placeholder = 'type to filter',
  emptyText = 'nothing to pick',
  width = 260,
}: {
  value: string | null;
  options: PickerOption[];
  onChange: (value: string) => void;
  /** Accessible name — what the thing being picked is. */
  label: string;
  placeholder?: string;
  emptyText?: string;
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const current = options.find((o) => o.value === value) ?? null;

  const hits = useMemo(() => {
    const q = norm(query);
    if (!q) return options;
    return options.filter((o) => norm(o.label).includes(q) || norm(o.hint ?? '').includes(q));
  }, [options, query]);

  // Opening starts fresh, on the current value so the list is where you left it.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    inputRef.current?.focus();
  }, [open, options, value]);

  // Filtering can strand the cursor past the end of the list.
  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, hits.length - 1)));
  }, [hits.length]);

  // Keep the cursor in view while arrowing through a long roster.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      const hit = hits[active];
      if (hit) pick(hit.value);
    }
  };

  return (
    <div className="picker" ref={boxRef} style={{ width }}>
      <button
        type="button"
        className="picker-v"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="picker-t">
          {current ? current.label : <span style={{ color: 'var(--ink-3)' }}>{emptyText}</span>}
          {current?.hint && <span style={{ color: 'var(--ink-3)' }}> · {current.hint}</span>}
        </span>
        <span aria-hidden style={{ color: 'var(--ink-3)', flex: 'none' }}>▾</span>
      </button>

      {open && (
        <div className="picker-p">
          <input
            ref={inputRef}
            type="search"
            value={query}
            placeholder={placeholder}
            aria-label={`Filter ${label}`}
            onChange={(e) => { setQuery(e.target.value); setActive(0); }}
            onKeyDown={onKey}
          />
          <div className="picker-l" role="listbox" aria-label={label} ref={listRef}>
            {hits.map((o, i) => (
              <button
                type="button"
                key={o.value}
                role="option"
                aria-selected={o.value === value}
                data-active={i === active}
                className={o.value === value ? 'on' : undefined}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(o.value)}
              >
                <span className="picker-t">{o.label}</span>
                {o.hint && <span style={{ color: 'var(--ink-3)', flex: 'none' }}>{o.hint}</span>}
              </button>
            ))}
            {hits.length === 0 && (
              <p className="note" style={{ padding: '7px 9px' }}>No match for "{query.trim()}".</p>
            )}
          </div>
          {options.length > 12 && (
            <div className="picker-f">
              {hits.length} of {options.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
