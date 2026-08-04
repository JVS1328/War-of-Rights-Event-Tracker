// Small presentational helpers shared by the player and round (scoreboard)
// drawers. Kept here so the round drawer's tab files and PlayerDrawer don't
// duplicate the same cell / cause-table / formatting primitives.
import type { ReactNode } from 'react';
import type { Team } from '../../stats/types';
import { formatPct, formatCompany } from '../../stats/labels';

export const kdStr = (k: number, d: number) => (d > 0 ? k / d : k).toFixed(2);

/**
 * Compose a player's in-game identity line — `Regiment · Co. X · Rank · Class`
 * (· Artillery when on a battery) — from whatever pieces are known, skipping
 * missing ones. Shared by the player profile's round cards and the round
 * drawer's player cards so both read the same.
 */
export function roleLine(parts: {
  regiment?: string | null;
  company?: string | null;
  rank?: string | null;
  className?: string | null;
  battery?: boolean;
}): string {
  const out: string[] = [];
  if (parts.regiment) out.push(parts.company ? `${parts.regiment} · Co. ${formatCompany(parts.company)}` : parts.regiment);
  if (parts.rank) out.push(parts.rank);
  if (parts.className) out.push(parts.className);
  if (parts.battery) out.push('Artillery');
  return out.join(' · ');
}

/**
 * A ticket-damage figure: the share of the team's ticket damage, with
 * `shareTitle` as its hover text (TDI/TDR). Used everywhere TDI/TDR appears so
 * they read consistently.
 */
export function TicketPct({ share, shareTitle }: { share: number | null; shareTitle?: string }) {
  return (
    <span className={`whitespace-nowrap tabular-nums ${shareTitle ? 'cursor-help' : ''}`} title={shareTitle}>
      {formatPct(share)}
    </span>
  );
}

/** `YYYY-MM-DD HH:MM` from an ISO string, or `—` when null. */
export const whenOf = (r: string | null) => (r ? `${r.slice(0, 10)} ${r.slice(11, 16)}` : '—');

export function fmtDuration(sec: number | null): string {
  if (sec == null) return '—';
  return `${Math.floor(sec / 60)}m ${String(sec % 60).padStart(2, '0')}s`;
}

export const teamTone = (t: Team) => (t === 'USA' ? 'usa' : 'csa') as 'usa' | 'csa';

/** Labeled stat tile. `title` makes it a hover-help cell. */
export function Cell({ label, value, title, hint }: { label: string; value: ReactNode; title?: string; hint?: ReactNode }) {
  return (
    <div className="kpi" title={title} style={title ? { cursor: 'help' } : undefined}>
      <div className="cap">{label}</div>
      <div className="v">{value}</div>
      {hint && <div className="h">{hint}</div>}
    </div>
  );
}

/**
 * Count + share for a `cause → count` map (killed with / died to). Bars against
 * the largest rather than bare counts — a killfeed's long tail is mostly ones
 * and twos, and the shape of the distribution is the point.
 */
export function CauseTable({ title, data }: { title: string; data: Record<string, number> }) {
  const rows = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((s, [, v]) => s + v, 0);
  const max = rows.reduce((m, [, v]) => Math.max(m, v), 0);
  return (
    <div>
      <div className="cap">{title}</div>
      {rows.length === 0 ? (
        <p className="note" style={{ marginTop: 5 }}>No killfeed data.</p>
      ) : (
        <div style={{ marginTop: 5 }}>
          {rows.map(([cause, count]) => (
            <div key={cause} className="hb">
              <span className="nm" style={{ textTransform: 'capitalize' }}>{cause}</span>
              <span className="t">
                <i style={{ width: `${max > 0 ? (count / max) * 100 : 0}%` }} />
              </span>
              <span className="n">
                {count}
                <span style={{ color: 'var(--ink-3)' }}> · {total ? Math.round((count / total) * 100) : 0}%</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
