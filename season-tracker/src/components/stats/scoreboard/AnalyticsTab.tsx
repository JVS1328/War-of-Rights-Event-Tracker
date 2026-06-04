// Analytics tab of the round drawer. Per-round insight moved verbatim from the
// old single-scroll scoreboard drawer: top individual kills/deaths, regiment
// loss/kill rates, first & last death, and nemesis pairings.
import { useMemo } from 'react';
import { EmptyHint } from '../../ui';
import type { Scoreboard } from '../../../stats/types';
import {
  topLossRates,
  topKillRates,
  topIndividualKills,
  topIndividualDeaths,
  firstAndLastDeath,
  computeNemeses,
} from '../../../stats/roundAnalytics';
import type {
  UnitRateRow,
  IndividualStatRow,
  DeathEventRow,
  NemesisRow,
} from '../../../stats/roundAnalytics';

const SECTION_HEAD = 'mb-1 text-xs uppercase tracking-wider text-[color:var(--color-text-2)]';

function IndividualList({
  title,
  rows,
  tone,
  onOpenPlayer,
}: {
  title: string;
  rows: IndividualStatRow[];
  tone: 'ok' | 'danger';
  onOpenPlayer: (key: string) => void;
}) {
  if (rows.length === 0) return null;
  const color = tone === 'ok' ? 'var(--color-ok)' : 'var(--color-danger)';
  return (
    <div>
      <div className={SECTION_HEAD}>{title}</div>
      <table className="w-full text-sm">
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={`${r.key}-${i}`}
              onClick={() => onOpenPlayer(r.key)}
              className="cursor-pointer border-b border-[color:var(--color-border)] hover:bg-[color:var(--color-bg-3)]"
            >
              <td className="w-6 px-1 py-0.5 text-right tabular-nums text-[color:var(--color-text-2)]">{i + 1}</td>
              <td className="px-1 py-0.5">
                <div className="truncate text-[color:var(--color-text-0)]">{r.name}</div>
                {r.regiment && <div className="truncate text-2xs text-[color:var(--color-text-2)]">{r.regiment}</div>}
              </td>
              <td className="px-1 py-0.5 text-right font-semibold tabular-nums whitespace-nowrap" style={{ color }}>
                {r.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RateList({ title, rows, kind }: { title: string; rows: UnitRateRow[]; kind: 'loss' | 'kill' }) {
  if (rows.length === 0) return null;
  const isLoss = kind === 'loss';
  const color = isLoss ? 'var(--color-danger)' : 'var(--color-ok)';
  const max = Math.max(1, ...rows.map((r) => (isLoss ? r.lossRate : r.killRate)));
  return (
    <div>
      <div className={SECTION_HEAD}>{title}</div>
      <div className="space-y-1.5">
        {rows.map((r, i) => {
          const rate = isLoss ? r.lossRate : r.killRate;
          const detail = isLoss ? `${r.deaths} cas · ${r.players} plr` : `${r.kills} k · ${r.players} plr`;
          return (
            <div key={`${r.regiment}-${r.team}-${i}`} className="text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[color:var(--color-text-0)]">
                  <span className="text-[color:var(--color-text-2)]">{i + 1}.</span> {r.regiment}
                </span>
                <span className="shrink-0 font-semibold tabular-nums" style={{ color }}>
                  {rate.toFixed(2)}
                </span>
              </div>
              <div className="relative mt-0.5 h-1.5 bg-[color:var(--color-bg-2)]">
                <div className="absolute left-0 top-0 h-full" style={{ width: `${(rate / max) * 100}%`, backgroundColor: color }} />
              </div>
              <div className="text-2xs text-[color:var(--color-text-2)]">{detail}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DeathCard({
  title,
  row,
  tone,
  onOpenPlayer,
}: {
  title: string;
  row: DeathEventRow | null;
  tone: 'ok' | 'danger';
  onOpenPlayer: (key: string) => void;
}) {
  if (!row) return null;
  const color = tone === 'ok' ? 'var(--color-ok)' : 'var(--color-danger)';
  return (
    <div className="border border-[color:var(--color-border)] bg-[color:var(--color-bg-1)] px-2 py-1.5">
      <div className="text-xs uppercase tracking-wider" style={{ color }}>
        {title}
      </div>
      <button
        onClick={() => onOpenPlayer(row.victimKey)}
        className="mt-0.5 block max-w-full truncate text-left text-base text-[color:var(--color-text-0)] hover:text-[color:var(--color-accent)]"
      >
        {row.victim}
      </button>
      <div className="text-2xs text-[color:var(--color-text-2)]">
        {row.regiment ? `${row.regiment} · ` : ''}
        {row.ts || '—'}
      </div>
      {row.killer && (
        <div className="mt-0.5 truncate text-xs text-[color:var(--color-text-1)]">
          by{' '}
          <button onClick={() => row.killerKey && onOpenPlayer(row.killerKey)} className="hover:text-[color:var(--color-accent)]">
            {row.killer}
          </button>
          {row.cause ? ` · ${row.cause}` : ''}
        </div>
      )}
    </div>
  );
}

function NemesisList({ rows, onOpenPlayer }: { rows: NemesisRow[]; onOpenPlayer: (key: string) => void }) {
  if (rows.length === 0) return null;
  return (
    <div>
      <div className={SECTION_HEAD}>Nemeses</div>
      <div className="space-y-0.5 text-sm">
        {rows.map((r, i) => (
          <div key={`${r.killerKey}-${r.victimKey}-${i}`} className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1">
              <span className="w-4 shrink-0 text-right text-[color:var(--color-text-2)]">{i + 1}</span>
              <button onClick={() => onOpenPlayer(r.killerKey)} className="truncate hover:underline" style={{ color: 'var(--color-ok)' }}>
                {r.killer}
              </button>
              <span className="shrink-0 text-[color:var(--color-text-2)]">→</span>
              <button onClick={() => onOpenPlayer(r.victimKey)} className="truncate hover:underline" style={{ color: 'var(--color-danger)' }}>
                {r.victim}
              </button>
            </div>
            <span className="shrink-0 tabular-nums text-[color:var(--color-text-0)]">
              <span className="font-semibold">{r.count}</span>{' '}
              <span className="text-2xs text-[color:var(--color-text-2)]">{r.count === 1 ? 'kill' : 'kills'}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AnalyticsTab({
  sb,
  onOpenPlayer,
}: {
  sb: Scoreboard;
  onOpenPlayer: (key: string) => void;
}) {
  const analytics = useMemo(() => {
    const { first, last } = firstAndLastDeath(sb);
    return {
      lossRates: topLossRates(sb, { minPlayers: 2, limit: 8 }),
      killRates: topKillRates(sb, { minPlayers: 2, limit: 8 }),
      topKills: topIndividualKills(sb, 10),
      topDeaths: topIndividualDeaths(sb, 10),
      nemeses: computeNemeses(sb, { minKills: 2, limit: 10 }),
      firstDeath: first,
      lastDeath: last,
    };
  }, [sb]);

  const hasAny =
    analytics.topKills.length > 0 ||
    analytics.topDeaths.length > 0 ||
    analytics.lossRates.length > 0 ||
    analytics.killRates.length > 0 ||
    analytics.nemeses.length > 0 ||
    !!analytics.firstDeath ||
    !!analytics.lastDeath;

  if (!hasAny) return <EmptyHint>No killfeed data for round analytics</EmptyHint>;

  return (
    <div className="space-y-3 p-3 font-mono">
      {(analytics.topKills.length > 0 || analytics.topDeaths.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <IndividualList title="Top kills" rows={analytics.topKills} tone="ok" onOpenPlayer={onOpenPlayer} />
          <IndividualList title="Top deaths" rows={analytics.topDeaths} tone="danger" onOpenPlayer={onOpenPlayer} />
        </div>
      )}

      {(analytics.lossRates.length > 0 || analytics.killRates.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <RateList title="Highest loss rates" rows={analytics.lossRates} kind="loss" />
          <RateList title="Highest kill rates" rows={analytics.killRates} kind="kill" />
        </div>
      )}

      {(analytics.firstDeath || analytics.lastDeath) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <DeathCard title="First death" row={analytics.firstDeath} tone="ok" onOpenPlayer={onOpenPlayer} />
          <DeathCard title="Last death" row={analytics.lastDeath} tone="danger" onOpenPlayer={onOpenPlayer} />
        </div>
      )}

      {analytics.nemeses.length > 0 && <NemesisList rows={analytics.nemeses} onOpenPlayer={onOpenPlayer} />}
    </div>
  );
}
