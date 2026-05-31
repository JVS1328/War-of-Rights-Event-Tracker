// Small presentational helpers shared by the player and round (scoreboard)
// drawers. Kept here so the round drawer's tab files and PlayerDrawer don't
// duplicate the same cell / cause-table / formatting primitives.
import type { ReactNode } from 'react';
import type { Team } from '../../stats/types';

export const kdStr = (k: number, d: number) => (d > 0 ? k / d : k).toFixed(2);

/** `YYYY-MM-DD HH:MM` from an ISO string, or `—` when null. */
export const whenOf = (r: string | null) => (r ? `${r.slice(0, 10)} ${r.slice(11, 16)}` : '—');

export function fmtDuration(sec: number | null): string {
  if (sec == null) return '—';
  return `${Math.floor(sec / 60)}m ${String(sec % 60).padStart(2, '0')}s`;
}

export const teamTone = (t: Team) => (t === 'USA' ? 'ok' : 'accent') as 'ok' | 'accent';

/** Labeled stat tile. `title` makes it a hover-help cell. */
export function Cell({ label, value, title }: { label: string; value: ReactNode; title?: string }) {
  return (
    <div
      className={`border border-[color:var(--color-border)] bg-[color:var(--color-bg-1)] px-2 py-1.5 ${title ? 'cursor-help' : ''}`}
      title={title}
    >
      <div className="text-[9px] uppercase tracking-wider text-[color:var(--color-text-2)]">{label}</div>
      <div className="text-[13px] tabular-nums text-[color:var(--color-text-0)]">{value}</div>
    </div>
  );
}

/** Count + share table for a `cause → count` map (kills with / died to, etc.). */
export function CauseTable({ title, data }: { title: string; data: Record<string, number> }) {
  const rows = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((s, [, v]) => s + v, 0);
  return (
    <div>
      <div className="mb-1 text-[10px] uppercase tracking-wider text-[color:var(--color-text-2)]">{title}</div>
      {rows.length === 0 ? (
        <div className="text-[10px] text-[color:var(--color-text-2)] py-2">No killfeed data</div>
      ) : (
        <table className="w-full text-[11px]">
          <tbody>
            {rows.map(([cause, count]) => (
              <tr key={cause} className="border-b border-[color:var(--color-border)]">
                <td className="py-0.5 text-[color:var(--color-text-1)] capitalize">{cause}</td>
                <td className="py-0.5 text-right tabular-nums text-[color:var(--color-text-0)]">{count}</td>
                <td className="py-0.5 text-right tabular-nums text-[color:var(--color-text-2)] w-10">
                  {total ? `${Math.round((count / total) * 100)}%` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
