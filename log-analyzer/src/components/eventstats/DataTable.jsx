import { useMemo, useState } from 'react';
import { Search, ChevronRight } from 'lucide-react';

// Compact sortable / searchable / expandable table in the Replay Suite style.
// Column API mirrors season-tracker's: { key, header, align?, sortable?,
// sortValue?(row), render(row), className? }.

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
}) {
  const [sortKey, setSortKey] = useState(initialSortKey);
  const [sortDir, setSortDir] = useState(initialSortDir);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(() => new Set());

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
    <div className="bg-slate-800 rounded-lg overflow-hidden">
      {searchValue && (
        <div className="flex items-center gap-2 border-b border-slate-700 px-3 py-1.5">
          <Search className="w-3.5 h-3.5 text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full bg-transparent text-sm text-slate-200 placeholder:text-slate-500 outline-none"
          />
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-700 bg-slate-800">
              {renderExpanded && <th className="w-6" />}
              {columns.map((col) => {
                const active = sortKey === col.key;
                const canSort = col.sortable && col.sortValue;
                return (
                  <th
                    key={col.key}
                    onClick={() => onHeaderClick(col)}
                    className={`px-2 py-1.5 text-[11px] uppercase tracking-wider text-slate-500 ${ALIGN[col.align ?? 'left']} ${canSort ? 'cursor-pointer select-none hover:text-slate-300' : ''}`}
                  >
                    {col.header}
                    {active && <span className="ml-1 text-amber-400">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={columns.length + (renderExpanded ? 1 : 0)} className="px-3 py-6 text-center text-slate-500 text-xs">
                  {emptyHint}
                </td>
              </tr>
            )}
            {sorted.map((row) => {
              const key = getRowKey(row);
              const isExpanded = expanded.has(key);
              return (
                <FragmentRow key={key}>
                  <tr
                    onClick={renderExpanded ? () => toggle(key) : undefined}
                    className={`border-b border-slate-700/60 ${renderExpanded ? 'cursor-pointer hover:bg-slate-700/40' : ''}`}
                  >
                    {renderExpanded && (
                      <td className="pl-2 text-slate-500">
                        <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td key={col.key} className={`px-2 py-1.5 text-slate-200 tabular-nums ${ALIGN[col.align ?? 'left']} ${col.className ?? ''}`}>
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                  {renderExpanded && isExpanded && (
                    <tr className="bg-slate-900/40">
                      <td colSpan={columns.length + 1} className="px-3 py-2">
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
    </div>
  );
}

function FragmentRow({ children }) {
  return <>{children}</>;
}
