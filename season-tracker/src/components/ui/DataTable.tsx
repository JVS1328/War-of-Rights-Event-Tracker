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
        <div className="ctl">
          <Search size={12} style={{ color: 'var(--ink-3)' }} />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder={searchPlaceholder}
            className="fld-i"
            style={{ flex: '0 1 220px' }}
          />
        </div>
      )}
      <table className="ledger">
        <thead>
          <tr>
            {columns.map((col) => {
              const active = sortKey === col.key;
              const canSort = col.sortable && col.sortValue;
              return (
                <th
                  key={col.key}
                  onClick={() => onHeaderClick(col)}
                  className={`${col.align === 'right' ? 'num' : ''}${canSort ? ' s' : ''}`}
                  style={canSort ? { cursor: 'pointer', userSelect: 'none' } : undefined}
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
                  className={renderExpanded ? 'click' : undefined}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`${col.align === 'right' ? 'num' : ''} ${col.className ?? ''}`.trim()}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
                {renderExpanded && isExpanded && (
                  <tr style={{ background: 'var(--raised)' }}>
                    <td colSpan={columns.length}>
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
        <div className="ctl" style={{ borderBottom: 0, borderTop: '1px solid var(--line)' }}>
          <span className="meta">
            {currentPage * pageSize + 1}–{currentPage * pageSize + pageRows.length} of {sorted.length}
          </span>
          <span className="rule" /><span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              onClick={() => setPage((p) => Math.max(0, Math.min(p, pageCount - 1) - 1))}
              disabled={currentPage === 0}
              aria-label="Previous page"
              className="gh"
            >
              ‹
            </button>
            <span className="meta">
              {currentPage + 1}/{pageCount}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pageCount - 1, Math.min(p, pageCount - 1) + 1))}
              disabled={currentPage >= pageCount - 1}
              aria-label="Next page"
              className="gh"
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
