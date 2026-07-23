import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Search } from 'lucide-react';
import { EmptyHint } from './EmptyHint';

export type SortDir = 'asc' | 'desc';

export interface Column<T> {
  /** Unique column id, also used as the sort key. */
  key: string;
  header: ReactNode;
  align?: 'left' | 'right' | 'center';
  sortable?: boolean;
  /** Value used for sorting. If omitted, the column is treated as unsortable. */
  sortValue?: (row: T) => string | number;
  render: (row: T) => ReactNode;
  /** Extra classes applied to each cell in this column. */
  className?: string;
}

const ALIGN: Record<NonNullable<Column<unknown>['align']>, string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
};

/**
 * Compact, sortable, optionally searchable + expandable data table in the
 * Palantir aesthetic (mono, tabular numbers, squared, dense).
 */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  initialSortKey,
  initialSortDir = 'desc',
  searchValue,
  searchPlaceholder = 'Search…',
  renderExpanded,
  emptyHint = 'No data',
  className = '',
  pageSize,
}: {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  initialSortKey?: string;
  initialSortDir?: SortDir;
  /** Provide to render a search box filtering on the returned string. */
  searchValue?: (row: T) => string;
  searchPlaceholder?: string;
  /** Provide to make rows expandable; returns the expanded content. */
  renderExpanded?: (row: T) => ReactNode;
  emptyHint?: ReactNode;
  className?: string;
  /** When set, only this many rows show per page with a pager beneath the table. */
  pageSize?: number;
}) {
  const [sortKey, setSortKey] = useState<string | undefined>(initialSortKey);
  const [sortDir, setSortDir] = useState<SortDir>(initialSortDir);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const sortedColumn = columns.find((c) => c.key === sortKey);

  const filtered = useMemo(() => {
    if (!searchValue || !query.trim()) return rows;
    const q = query.trim().toLowerCase();
    return rows.filter((r) => searchValue(r).toLowerCase().includes(q));
  }, [rows, query, searchValue]);

  const sorted = useMemo(() => {
    if (!sortedColumn?.sortValue) return filtered;
    const getVal = sortedColumn.sortValue;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = getVal(a);
      const bv = getVal(b);
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [filtered, sortedColumn, sortDir]);

  // Pagination (opt-in). `page` is clamped for display so a shrinking result set
  // never strands the view on an empty page; handlers reset it to the first page.
  const pageCount = pageSize ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = pageSize ? sorted.slice(currentPage * pageSize, currentPage * pageSize + pageSize) : sorted;

  const onHeaderClick = (col: Column<T>) => {
    if (!col.sortable || !col.sortValue) return;
    setPage(0);
    if (sortKey === col.key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(col.key);
      setSortDir('desc');
    }
  };

  const toggleExpand = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className={className}>
      {searchValue && (
        <div className="flex items-center gap-2 border-b border-[color:var(--color-border)] bg-[color:var(--color-bg-2)] px-3 py-1.5">
          <Search size={12} className="text-[color:var(--color-text-2)]" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder={searchPlaceholder}
            className="w-full bg-transparent text-sm font-mono text-[color:var(--color-text-0)] placeholder:text-[color:var(--color-text-2)] outline-none"
          />
        </div>
      )}
      <table className="w-full border-collapse font-mono text-sm">
        <thead>
          <tr className="border-b border-[color:var(--color-border)] bg-[color:var(--color-bg-2)]">
            {columns.map((col) => {
              const active = sortKey === col.key;
              const canSort = col.sortable && col.sortValue;
              return (
                <th
                  key={col.key}
                  onClick={() => onHeaderClick(col)}
                  className={`px-2 py-1 text-xs uppercase tracking-wider text-[color:var(--color-text-2)] ${
                    ALIGN[col.align ?? 'left']
                  } ${canSort ? 'cursor-pointer select-none hover:text-[color:var(--color-text-0)]' : ''}`}
                >
                  {col.header}
                  {active && <span className="ml-1">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && (
            <tr>
              <td colSpan={columns.length}>
                <EmptyHint>{emptyHint}</EmptyHint>
              </td>
            </tr>
          )}
          {pageRows.map((row) => {
            const key = getRowKey(row);
            const isExpanded = expanded.has(key);
            return (
              <FragmentRow key={key}>
                <tr
                  onClick={renderExpanded ? () => toggleExpand(key) : undefined}
                  className={`border-b border-[color:var(--color-border)] ${
                    renderExpanded ? 'cursor-pointer hover:bg-[color:var(--color-bg-3)]' : ''
                  }`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-2 py-1 text-[color:var(--color-text-0)] tabular-nums ${
                        ALIGN[col.align ?? 'left']
                      } ${col.className ?? ''}`}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
                {renderExpanded && isExpanded && (
                  <tr className="bg-[color:var(--color-bg-2)]">
                    <td colSpan={columns.length} className="px-2 py-2">
                      {renderExpanded(row)}
                    </td>
                  </tr>
                )}
              </FragmentRow>
            );
          })}
        </tbody>
      </table>
      {pageSize && pageCount > 1 && (
        <div className="flex items-center justify-between border-t border-[color:var(--color-border)] bg-[color:var(--color-bg-2)] px-3 py-1.5 text-xs uppercase tracking-wider text-[color:var(--color-text-2)]">
          <span className="tabular-nums">
            {currentPage * pageSize + 1}–{currentPage * pageSize + pageRows.length} of {sorted.length}
          </span>
          <span className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, Math.min(p, pageCount - 1) - 1))}
              disabled={currentPage === 0}
              aria-label="Previous page"
              className="border border-[color:var(--color-border)] px-1.5 py-0.5 leading-none hover:bg-[color:var(--color-bg-3)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              ‹
            </button>
            <span className="px-1 tabular-nums">
              {currentPage + 1}/{pageCount}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pageCount - 1, Math.min(p, pageCount - 1) + 1))}
              disabled={currentPage >= pageCount - 1}
              aria-label="Next page"
              className="border border-[color:var(--color-border)] px-1.5 py-0.5 leading-none hover:bg-[color:var(--color-bg-3)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              ›
            </button>
          </span>
        </div>
      )}
    </div>
  );
}

/** Renders multiple sibling rows without an extra DOM wrapper. */
function FragmentRow({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
