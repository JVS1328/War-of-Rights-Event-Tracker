/**
 * The frame: a rail of sections down the left, a crumb bar across the top of
 * the main column, and one screen at a time in a single measured column.
 *
 * Taken from the prototype. The point of the shape is that everything the app
 * can do is visible in the rail — no view hidden behind a modal, no feature
 * reachable only from a button on some other page. The crumb says where you
 * are and carries the two things that change what every screen means: which
 * event, and which season.
 */
import type { ReactNode } from 'react';
import { ThemeControls } from './ThemeControls';

export interface NavItem {
  key: string;
  label: string;
  /** Small figure at the end of the row — week count, unit count, and such. */
  count?: number | string | null;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export function Shell({
  nav,
  screen,
  onScreen,
  title,
  subtitle,
  crumb,
  children,
}: {
  nav: NavGroup[];
  screen: string;
  onScreen: (key: string) => void;
  /** Rail heading — the app's name. */
  title: string;
  /** Under it: the event and season in play. */
  subtitle: string;
  /** The crumb bar's contents: pickers, scope, whatever the screen needs. */
  crumb: ReactNode;
  children: ReactNode;
}) {
  const here = nav.flatMap((g) => g.items.map((i) => ({ ...i, group: g.title }))).find((i) => i.key === screen);

  return (
    <div className="app">
      <nav className="rail" aria-label="Sections">
        <div className="rail-h">
          <span className="t">{title}</span>
          <span className="s wor-name">{subtitle}</span>
        </div>
        <div className="rail-nav">
          {nav.map((group) => (
            <div className="rgrp" key={group.title || 'ungrouped'}>
              {group.title && <span className="cap">{group.title}</span>}
              {group.items.map((item) => (
                <button
                  key={item.key}
                  data-v={item.key}
                  aria-current={item.key === screen}
                  onClick={() => onScreen(item.key)}
                >
                  {item.label}
                  {item.count != null && item.count !== '' && <span className="n">{item.count}</span>}
                </button>
              ))}
            </div>
          ))}
        </div>
      </nav>
      <div className="main">
        <div className="crumb">
          {crumb}
          <span className="rule" />
          <ThemeControls />
          <span className="cap">{here?.group ?? ''}</span>
          <span className="cap" style={{ color: 'var(--color-text-0)' }}>
            {here?.label ?? ''}
          </span>
        </div>
        <div className="body">{children}</div>
      </div>
    </div>
  );
}

/** A titled panel: header rule, optional right-hand note, then the body. */
export function LPanel({
  title,
  note,
  right,
  flush = false,
  children,
}: {
  title: ReactNode;
  /** Small uppercase qualifier after the rule. */
  note?: ReactNode;
  /** Controls that belong in the header, before the rule. */
  right?: ReactNode;
  /** Drop the body padding — for tables and column grids that rule themselves. */
  flush?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="panel">
      <header className="ph">
        <h2>{title}</h2>
        {right}
        <span className="rule" />
        {note && <span className="meta">{note}</span>}
      </header>
      <div className={flush ? 'pb flush' : 'pb'}>{children}</div>
    </div>
  );
}

/** A row of KPI cells across the top of a screen. */
export function Kpis({ children }: { children: ReactNode }) {
  return <div className="kpis">{children}</div>;
}

export function Kpi({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="kpi">
      <div className="cap">{label}</div>
      <div className="v">{value}</div>
      {hint != null && <div className="h">{hint}</div>}
    </div>
  );
}

/** Segmented control — the chosen option inverts to ink-on-ground. */
export function Seg<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { key: T; label: string; title?: string }[];
  onChange: (key: T) => void;
  label?: string;
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.key} aria-pressed={o.key === value} title={o.title} onClick={() => onChange(o.key)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
