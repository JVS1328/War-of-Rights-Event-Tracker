// Analytics tab of the round drawer. Per-round insight moved verbatim from the
// old single-scroll scoreboard drawer: top individual kills/deaths, regiment
// loss/kill rates, first & last death, and nemesis pairings.
//
// The player/regiment ranking sections (top kills, top deaths, loss/kill rates,
// nemeses) are each searchable and paginated so a full round's roster stays
// browsable without an endless scroll.
import { useMemo, useState, type ReactNode } from 'react';
import { Search } from 'lucide-react';
import { EmptyHint } from '../../ui';
import type { Scoreboard } from '../../../stats/types';
import {
  topLossRates,
  topKillRates,
  topIndividualKills,
  topIndividualDeaths,
  topTicketInflicted,
  topTicketReceived,
  topRegimentTicketInflicted,
  topRegimentTicketReceived,
  firstAndLastDeath,
  computeNemeses,
} from '../../../stats/roundAnalytics';
import { TICKET_INFLICTED_LABEL, TICKET_RECEIVED_LABEL } from '../../../stats/labels';
import { TicketPct } from '../drawerPrimitives';
import type {
  UnitRateRow,
  IndividualStatRow,
  TicketStatRow,
  DeathEventRow,
  NemesisRow,
} from '../../../stats/roundAnalytics';

const SECTION_HEAD = 'text-xs uppercase tracking-wider text-[color:var(--color-text-2)]';
const PAGE_SIZE = 8;

// Stable search-text accessors (module-level so PagedSection's filter memo
// isn't invalidated every render).
const individualSearch = (r: IndividualStatRow) => `${r.name} ${r.regiment ?? ''}`;
const ticketSearch = (r: TicketStatRow) => `${r.name} ${r.regiment ?? ''}`;
const rateSearch = (r: UnitRateRow) => r.regiment;
const nemesisSearch = (r: NemesisRow) => `${r.killer} ${r.victim}`;

const rateMax = (rows: UnitRateRow[], kind: 'loss' | 'kill') =>
  Math.max(1, ...rows.map((r) => (kind === 'loss' ? r.lossRate : r.killRate)));

/**
 * Section wrapper adding a search box + pager around any ranked list. Filters
 * `rows` by `searchText`, slices the match set into pages, and hands each page
 * (plus its absolute offset and the full filtered set) to `children`.
 */
function PagedSection<T>({
  title,
  rows,
  searchText,
  searchPlaceholder = 'search…',
  pageSize = PAGE_SIZE,
  children,
}: {
  title: ReactNode;
  rows: T[];
  searchText: (r: T) => string;
  searchPlaceholder?: string;
  pageSize?: number;
  children: (pageRows: T[], offset: number, filtered: T[]) => ReactNode;
}) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => searchText(r).toLowerCase().includes(q));
  }, [rows, query, searchText]);

  if (rows.length === 0) return null;

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pageCount - 1);
  const offset = current * pageSize;
  const pageRows = filtered.slice(offset, offset + pageSize);

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className={`${SECTION_HEAD} min-w-0 truncate`}>{title}</div>
        <div className="flex shrink-0 items-center gap-1 border border-[color:var(--color-border)] bg-[color:var(--color-bg-1)] px-1.5 py-0.5">
          <Search size={11} className="text-[color:var(--color-text-2)]" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder={searchPlaceholder}
            className="w-24 bg-transparent text-xs text-[color:var(--color-text-0)] placeholder:text-[color:var(--color-text-2)] outline-none"
          />
        </div>
      </div>
      {filtered.length === 0 ? (
        <div className="py-3 text-center text-2xs uppercase tracking-wider text-[color:var(--color-text-2)]">
          no matches for "{query.trim()}"
        </div>
      ) : (
        children(pageRows, offset, filtered)
      )}
      {pageCount > 1 && (
        <Pager
          offset={offset}
          shown={pageRows.length}
          total={filtered.length}
          page={current}
          pageCount={pageCount}
          onPrev={() => setPage((p) => Math.max(0, p - 1))}
          onNext={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
        />
      )}
    </div>
  );
}

function Pager({
  offset,
  shown,
  total,
  page,
  pageCount,
  onPrev,
  onNext,
}: {
  offset: number;
  shown: number;
  total: number;
  page: number;
  pageCount: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const btn =
    'border border-[color:var(--color-border)] px-1.5 py-0.5 leading-none hover:bg-[color:var(--color-bg-3)] disabled:opacity-40 disabled:cursor-not-allowed';
  return (
    <div className="mt-1.5 flex items-center justify-between text-2xs uppercase tracking-wider text-[color:var(--color-text-2)]">
      <span className="tabular-nums">
        {offset + 1}–{offset + shown} of {total}
      </span>
      <span className="flex items-center gap-1">
        <button onClick={onPrev} disabled={page === 0} className={btn} aria-label="Previous page">
          ‹
        </button>
        <span className="px-1 tabular-nums">
          {page + 1}/{pageCount}
        </span>
        <button onClick={onNext} disabled={page >= pageCount - 1} className={btn} aria-label="Next page">
          ›
        </button>
      </span>
    </div>
  );
}

function IndividualRows({
  rows,
  offset,
  tone,
  onOpenPlayer,
}: {
  rows: IndividualStatRow[];
  offset: number;
  tone: 'ok' | 'danger';
  onOpenPlayer: (key: string) => void;
}) {
  const color = tone === 'ok' ? 'var(--color-ok)' : 'var(--color-danger)';
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map((r, i) => (
          <tr
            key={`${r.key}-${offset + i}`}
            onClick={() => onOpenPlayer(r.key)}
            className="cursor-pointer border-b border-[color:var(--color-border)] hover:bg-[color:var(--color-bg-3)]"
          >
            <td className="w-6 px-1 py-0.5 text-right tabular-nums text-[color:var(--color-text-2)]">{offset + i + 1}</td>
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
  );
}

/** Ranked ticket-damage rows showing each entry's share of the team (via
 *  {@link TicketPct}). Player rows open the player drawer; regiment rows,
 *  whose name IS the regiment, are display-only. */
function TicketRows({
  rows,
  offset,
  kind,
  onOpenPlayer,
}: {
  rows: TicketStatRow[];
  offset: number;
  kind: 'inflicted' | 'received';
  /** Provided for player rows (clickable); omitted for regiment rows. */
  onOpenPlayer?: (key: string) => void;
}) {
  const shareTitle = kind === 'inflicted' ? TICKET_INFLICTED_LABEL : TICKET_RECEIVED_LABEL;
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map((r, i) => (
          <tr
            key={`${r.key}-${offset + i}`}
            onClick={onOpenPlayer ? () => onOpenPlayer(r.key) : undefined}
            className={`border-b border-[color:var(--color-border)] ${onOpenPlayer ? 'cursor-pointer hover:bg-[color:var(--color-bg-3)]' : ''}`}
          >
            <td className="w-6 px-1 py-0.5 text-right tabular-nums text-[color:var(--color-text-2)]">{offset + i + 1}</td>
            <td className="px-1 py-0.5">
              <div className="truncate text-[color:var(--color-text-0)]">{r.name}</div>
              {r.regiment && r.regiment !== r.name && (
                <div className="truncate text-2xs text-[color:var(--color-text-2)]">{r.regiment}</div>
              )}
            </td>
            <td className="px-1 py-0.5 text-right text-[color:var(--color-text-0)]">
              <TicketPct share={r.share} shareTitle={shareTitle} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RateRows({
  rows,
  offset,
  kind,
  max,
}: {
  rows: UnitRateRow[];
  offset: number;
  kind: 'loss' | 'kill';
  max: number;
}) {
  const isLoss = kind === 'loss';
  const color = isLoss ? 'var(--color-danger)' : 'var(--color-ok)';
  return (
    <div className="space-y-1.5">
      {rows.map((r, i) => {
        const rate = isLoss ? r.lossRate : r.killRate;
        const detail = isLoss ? `${r.deaths} cas · ${r.players} plr` : `${r.kills} k · ${r.players} plr`;
        return (
          <div key={`${r.regiment}-${r.team}-${offset + i}`} className="text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[color:var(--color-text-0)]">
                <span className="text-[color:var(--color-text-2)]">{offset + i + 1}.</span> {r.regiment}
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

function NemesisRows({
  rows,
  offset,
  onOpenPlayer,
}: {
  rows: NemesisRow[];
  offset: number;
  onOpenPlayer: (key: string) => void;
}) {
  return (
    <div className="space-y-0.5 text-sm">
      {rows.map((r, i) => (
        <div key={`${r.killerKey}-${r.victimKey}-${offset + i}`} className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1">
            <span className="w-6 shrink-0 text-right text-[color:var(--color-text-2)]">{offset + i + 1}</span>
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
      lossRates: topLossRates(sb, { minPlayers: 2 }),
      killRates: topKillRates(sb, { minPlayers: 2 }),
      topKills: topIndividualKills(sb),
      topDeaths: topIndividualDeaths(sb),
      ticketInflictedPlayers: topTicketInflicted(sb),
      ticketReceivedPlayers: topTicketReceived(sb),
      ticketInflictedRegiments: topRegimentTicketInflicted(sb),
      ticketReceivedRegiments: topRegimentTicketReceived(sb),
      nemeses: computeNemeses(sb, { minKills: 2 }),
      firstDeath: first,
      lastDeath: last,
    };
  }, [sb]);

  const hasAny =
    analytics.topKills.length > 0 ||
    analytics.topDeaths.length > 0 ||
    analytics.ticketInflictedPlayers.length > 0 ||
    analytics.ticketReceivedPlayers.length > 0 ||
    analytics.ticketInflictedRegiments.length > 0 ||
    analytics.ticketReceivedRegiments.length > 0 ||
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
          <PagedSection title="Top kills" rows={analytics.topKills} searchText={individualSearch} searchPlaceholder="player…">
            {(pageRows, offset) => <IndividualRows rows={pageRows} offset={offset} tone="ok" onOpenPlayer={onOpenPlayer} />}
          </PagedSection>
          <PagedSection title="Top deaths" rows={analytics.topDeaths} searchText={individualSearch} searchPlaceholder="player…">
            {(pageRows, offset) => <IndividualRows rows={pageRows} offset={offset} tone="danger" onOpenPlayer={onOpenPlayer} />}
          </PagedSection>
        </div>
      )}

      {(analytics.ticketInflictedPlayers.length > 0 || analytics.ticketReceivedPlayers.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <PagedSection
            title={<span className="cursor-help" title={TICKET_INFLICTED_LABEL}>Ticket damage inflicted · players</span>}
            rows={analytics.ticketInflictedPlayers}
            searchText={ticketSearch}
            searchPlaceholder="player…"
          >
            {(pageRows, offset) => <TicketRows rows={pageRows} offset={offset} kind="inflicted" onOpenPlayer={onOpenPlayer} />}
          </PagedSection>
          <PagedSection
            title={<span className="cursor-help" title={TICKET_RECEIVED_LABEL}>Ticket damage received · players</span>}
            rows={analytics.ticketReceivedPlayers}
            searchText={ticketSearch}
            searchPlaceholder="player…"
          >
            {(pageRows, offset) => <TicketRows rows={pageRows} offset={offset} kind="received" onOpenPlayer={onOpenPlayer} />}
          </PagedSection>
        </div>
      )}

      {(analytics.ticketInflictedRegiments.length > 0 || analytics.ticketReceivedRegiments.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <PagedSection
            title={<span className="cursor-help" title={TICKET_INFLICTED_LABEL}>Ticket damage inflicted · regiments</span>}
            rows={analytics.ticketInflictedRegiments}
            searchText={ticketSearch}
            searchPlaceholder="regiment…"
          >
            {(pageRows, offset) => <TicketRows rows={pageRows} offset={offset} kind="inflicted" />}
          </PagedSection>
          <PagedSection
            title={<span className="cursor-help" title={TICKET_RECEIVED_LABEL}>Ticket damage received · regiments</span>}
            rows={analytics.ticketReceivedRegiments}
            searchText={ticketSearch}
            searchPlaceholder="regiment…"
          >
            {(pageRows, offset) => <TicketRows rows={pageRows} offset={offset} kind="received" />}
          </PagedSection>
        </div>
      )}

      {(analytics.lossRates.length > 0 || analytics.killRates.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <PagedSection title="Highest loss rates" rows={analytics.lossRates} searchText={rateSearch} searchPlaceholder="regiment…">
            {(pageRows, offset, filtered) => <RateRows rows={pageRows} offset={offset} kind="loss" max={rateMax(filtered, 'loss')} />}
          </PagedSection>
          <PagedSection title="Highest kill rates" rows={analytics.killRates} searchText={rateSearch} searchPlaceholder="regiment…">
            {(pageRows, offset, filtered) => <RateRows rows={pageRows} offset={offset} kind="kill" max={rateMax(filtered, 'kill')} />}
          </PagedSection>
        </div>
      )}

      {(analytics.firstDeath || analytics.lastDeath) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <DeathCard title="First death" row={analytics.firstDeath} tone="ok" onOpenPlayer={onOpenPlayer} />
          <DeathCard title="Last death" row={analytics.lastDeath} tone="danger" onOpenPlayer={onOpenPlayer} />
        </div>
      )}

      {analytics.nemeses.length > 0 && (
        <PagedSection title="Nemeses" rows={analytics.nemeses} searchText={nemesisSearch} searchPlaceholder="player…" pageSize={10}>
          {(pageRows, offset) => <NemesisRows rows={pageRows} offset={offset} onOpenPlayer={onOpenPlayer} />}
        </PagedSection>
      )}
    </div>
  );
}
