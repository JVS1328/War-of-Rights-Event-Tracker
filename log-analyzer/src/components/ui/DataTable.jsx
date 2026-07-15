import { useEffect, useMemo, useState } from 'react';
import { Search, ChevronRight, ChevronLeft } from 'lucide-react';

// Compact sortable / searchable / expandable / paginated table. Column API
// mirrors season-tracker's: { key, header, align?, sortable?, sortValue?(row),
// render(row), className? }.
//
// Pass `pageSize` to paginate — the footer only appears when the filtered set
// spills past one page.

const ALIGN = { left: 'text-left', right: 'text-right', center: 'text-center' };

export default function DataTable({
  columns,
  rows,
  getRowKey,
  initialSortKey,
  initialSortDir = 'desc',
  searchValue,
  searchPlaceholder = 'Search…',
  renderExpanded,
  emptyHint = 'No data',
  pageSize,
}) {
  const [sortKey, setSortKey] = useState(initialSortKey);
  const [sortDir, setSortDir] = useState(initialSortDir);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(() => new Set());
  const [page, setPage] = useState(0);

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

  // Pagination — clamp the page whenever the result set or sort changes so we
  // never strand the view on an empty trailing page.
  const paginated = pageSize != null && pageSize > 0;
  const pageCount = paginated ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  useEffect(() => { setPage(0); }, [query, sortKey, sortDir, pageSize]);
  const safePage = Math.min(page, pageCount - 1);
  const visible = paginated ? sorted.slice(safePage * pageSize, safePage * pageSize + pageSize) : sorted;

  const onHeaderClick = (col) => {
    if (!col.sortable || !col.sortValue) return;
    if (sortKey === col.key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(col.key); setSortDir('desc'); }
  };

  const toggle = (key) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  return (
    <div className="card overflow-hidden">
      {searchValue && (
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Search className="w-3.5 h-3.5 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full bg-transparent text-sm text-text placeholder:text-faint outline-none"
          />
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              {renderExpanded && <th className="w-6" />}
              {columns.map((col) => {
                const active = sortKey === col.key;
                const canSort = col.sortable && col.sortValue;
                return (
                  <th
                    key={col.key}
                    onClick={() => onHeaderClick(col)}
                    className={`px-2.5 py-2 text-[11px] uppercase tracking-[0.06em] text-faint font-medium ${ALIGN[col.align ?? 'left']} ${canSort ? 'cursor-pointer select-none hover:text-text' : ''}`}
                  >
                    {col.header}
                    {active && <span className="ml-1 text-accent">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={columns.length + (renderExpanded ? 1 : 0)} className="px-3 py-8 text-center text-faint text-xs">
                  {emptyHint}
                </td>
              </tr>
            )}
            {visible.map((row) => {
              const key = getRowKey(row);
              const isExpanded = expanded.has(key);
              return (
                <FragmentRow key={key}>
                  <tr
                    onClick={renderExpanded ? () => toggle(key) : undefined}
                    className={`border-b border-border/60 ${renderExpanded ? 'cursor-pointer hover:bg-elevated' : ''}`}
                  >
                    {renderExpanded && (
                      <td className="pl-2.5 text-faint">
                        <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td key={col.key} className={`px-2.5 py-2 text-text tabular-nums ${ALIGN[col.align ?? 'left']} ${col.className ?? ''}`}>
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                  {renderExpanded && isExpanded && (
                    <tr className="bg-elevated">
                      <td colSpan={columns.length + 1} className="px-3 py-3">
                        {renderExpanded(row)}
                      </td>
                    </tr>
                  )}
                </FragmentRow>
              );
            })}
          </tbody>
        </table>
      </div>
      {paginated && sorted.length > pageSize && (
        <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2 text-[11px] text-muted">
          <span className="tabular-nums">
            {safePage * pageSize + 1}–{Math.min(sorted.length, safePage * pageSize + pageSize)} of {sorted.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              className="btn-bare p-1 disabled:opacity-30 hover:text-text"
              title="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="tabular-nums px-1">{safePage + 1} / {pageCount}</span>
            <button
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={safePage >= pageCount - 1}
              className="btn-bare p-1 disabled:opacity-30 hover:text-text"
              title="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FragmentRow({ children }) {
  return <>{children}</>;
}
