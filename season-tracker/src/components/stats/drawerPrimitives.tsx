// Small presentational helpers shared by the player and round (scoreboard)
// drawers. Kept here so the round drawer's tab files and PlayerDrawer don't
// duplicate the same cell / cause-table / formatting primitives.
import type { ReactNode } from 'react';
import type { Team } from '../../stats/types';
import { formatPct, formatCompany, efficiencyTitle } from '../../stats/labels';

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
 * A ticket-damage figure: the headline share (of the team's ticket damage) with
 * the size-adjusted efficiency dimmed beside it. Both halves carry their own
 * hover text — `shareTitle` explains the share (TDI/TDR); the efficiency's title
 * is built from the roster split + `kind` (so it reads "higher is better" for
 * inflicted, "lower is better" for received) and shows the `1.75×` ratio. Used
 * everywhere TDI/TDR appears so they read consistently.
 */
export function TicketPct({
  share,
  eff,
  shareTitle,
  unitPlayers,
  teamPlayers,
  kind,
  avg = false,
}: {
  share: number | null;
  eff: number | null;
  shareTitle?: string;
  unitPlayers: number;
  teamPlayers: number;
  kind: 'inflicted' | 'received';
  avg?: boolean;
}) {
  const effTitle = efficiencyTitle(eff, unitPlayers, teamPlayers, kind, avg);
  return (
    <span className="whitespace-nowrap tabular-nums">
      <span className={shareTitle ? 'cursor-help' : undefined} title={shareTitle}>
        {formatPct(share)}
      </span>
      <span className="text-[color:var(--color-text-2)]"> · </span>
      <span className="opacity-70 cursor-help" title={effTitle}>
        {formatPct(eff)}
      </span>
    </span>
  );
}

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
      <div className="text-2xs uppercase tracking-wider text-[color:var(--color-text-2)]">{label}</div>
      <div className="text-lg tabular-nums text-[color:var(--color-text-0)]">{value}</div>
    </div>
  );
}

/** Count + share table for a `cause → count` map (kills with / died to, etc.). */
export function CauseTable({ title, data }: { title: string; data: Record<string, number> }) {
  const rows = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((s, [, v]) => s + v, 0);
  return (
    <div>
      <div className="mb-1 text-xs uppercase tracking-wider text-[color:var(--color-text-2)]">{title}</div>
      {rows.length === 0 ? (
        <div className="text-xs text-[color:var(--color-text-2)] py-2">No killfeed data</div>
      ) : (
        <table className="w-full text-sm">
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
