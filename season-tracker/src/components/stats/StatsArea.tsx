import { useEffect, useMemo, useRef, useState } from 'react';
import { Upload, Trash2, Pencil, X, GitMerge } from 'lucide-react';
import { Panel, Tile, Pill, DataTable, EmptyHint } from '../ui';
import type { Column } from '../ui';
import { useStats, type UseStats } from './useStats';
import {
  computePlayerLeaderboard,
  computeRegimentBreakdown,
  computeCombatTotals,
  computeRounds,
  computeOverview,
  computePlayerDetail,
  resolveFor,
} from '../../stats/statsEngine';
import type { PlayerStatRow, RegimentStatRow, RoundSummary, FormationCounts } from '../../stats/statsEngine';
import type { Team } from '../../stats/types';
import { formatAvgT, FORMATION_LABEL, AVG_TD_LABEL, AVG_TK_LABEL } from '../../stats/labels';
import { parseRegimentList, UNTAGGED } from '../../stats/regimentMatcher';
import { buildRoundAutofill, roundFieldUpdates } from '../../stats/eventBinding';
import type { TeamNames, RoundAutofill } from '../../stats/eventBinding';
import { PlayerDrawer, ScoreboardDrawer } from './StatsDrawers';

export interface WeekRef {
  id: string;
  name: string;
  round1Flipped?: boolean;
  round2Flipped?: boolean;
}

type SubTab = 'overview' | 'players' | 'regiments' | 'rounds' | 'import';
const TABS: SubTab[] = ['overview', 'players', 'regiments', 'rounds', 'import'];

const teamTone = (t: Team) => (t === 'USA' ? 'ok' : 'accent');

function fmtDuration(sec: number | null): string {
  if (sec == null) return '—';
  return `${Math.floor(sec / 60)}m ${String(sec % 60).padStart(2, '0')}s`;
}
const dateOf = (r: string | null) => (r ? r.slice(0, 10) : 'unknown');
const timeOf = (r: string | null) => (r ? r.slice(11, 19) : '—');
const whenOf = (r: string | null) => (r ? `${r.slice(0, 10)} ${r.slice(11, 16)}` : '—');
const kdStr = (k: number, d: number) => (d > 0 ? k / d : k).toFixed(2);
const TdHead = <span title={AVG_TD_LABEL}>×Td</span>;
const TkHead = <span title={AVG_TK_LABEL}>×Tk</span>;

interface StatsAreaProps {
  eventId: string;
  eventName: string;
  registryUnits?: string[];
  /** Weeks of the active season, for binding scoreboards to a round. */
  weeks?: WeekRef[];
  teamNames?: TeamNames;
  /** Known map-area names (ALL_MAPS) for validating auto-filled maps. */
  validMaps?: string[];
  /** Writes auto-filled round fields back into the tracker's week. */
  onApplyRound?: (weekId: string, updates: Record<string, unknown>) => void;
}

/** Live stats area — reads the event's scoreboards from the repo (IndexedDB). */
export default function StatsArea(props: StatsAreaProps) {
  const stats = useStats(props.eventId);
  return <StatsPanel {...props} stats={stats} />;
}

/**
 * Presentational stats panel. Renders from an injected {@link UseStats} object,
 * so it serves both the live tracker (via {@link StatsArea}) and the read-only
 * shared-link view (which feeds it a bundle-backed, no-op stats object).
 * When `readOnly`, the Import tab and all assignment-editing affordances hide.
 */
export function StatsPanel({
  eventName,
  registryUnits = [],
  weeks = [],
  teamNames = { A: 'USA', B: 'CSA' },
  validMaps = [],
  onApplyRound,
  stats,
  readOnly = false,
}: StatsAreaProps & { stats: UseStats; readOnly?: boolean }) {
  const [tab, setTab] = useState<SubTab>('overview');
  // Regiment-list textarea starts empty — it's a manual override, no longer
  // pre-filled from the event unit registry. (Registry-based matching still
  // happens automatically via `opts` below.)
  const [listText, setListText] = useState('');
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<'all' | 'inf' | 'arty'>('all');
  const [playerKey, setPlayerKey] = useState<string | null>(null);
  const [playerType, setPlayerType] = useState<'all' | 'inf' | 'arty'>('all');
  const [scoreboardId, setScoreboardId] = useState<string | null>(null);
  // Regiments-tab focus navigation (from the Players-tab regiment link).
  const [focusRegiment, setFocusRegiment] = useState<string | null>(null);
  const [focusNonce, setFocusNonce] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  // Jump from a player's regiment to that regiment's panel in the Regiments tab.
  const goToRegiment = (label: string) => {
    setFocusRegiment(label);
    setFocusNonce((n) => n + 1);
    setTab('regiments');
  };

  // Open a player card, resetting its role filter to "all".
  const openPlayer = (key: string) => {
    setPlayerType('all');
    setPlayerKey(key);
  };

  const sbs = stats.scoreboards;
  // Registered event units act as the default match list (overrides win; the
  // name-tag heuristic is the fallback for anything unmatched).
  const opts = useMemo(
    () => ({ regimentList: parseRegimentList(registryUnits.join('\n')), aliasMap: stats.aliases }),
    [registryUnits, stats.aliases],
  );

  const players = useMemo(
    () => computePlayerLeaderboard(sbs, stats.assignments, { ...opts, type: typeFilter }),
    [sbs, stats.assignments, opts, typeFilter],
  );
  const regiments = useMemo(() => computeRegimentBreakdown(sbs, stats.assignments, opts), [sbs, stats.assignments, opts]);
  const combat = useMemo(() => computeCombatTotals(sbs), [sbs]);
  // Season regiment resolver shared with the round drawer's Players tab, so its
  // "unit" grouping matches the Regiments tab (assignments → list → name tag).
  const resolveRegiment = useMemo(
    () => (steamId: string | null, name: string) => {
      const r = resolveFor(steamId, name, stats.assignments, opts.regimentList, opts.aliasMap);
      return r === UNTAGGED ? null : r;
    },
    [stats.assignments, opts],
  );
  const rounds = useMemo(() => computeRounds(sbs), [sbs]);
  const overview = useMemo(() => computeOverview(sbs, stats.assignments, opts), [sbs, stats.assignments, opts]);
  const playerDetail = useMemo(
    () => (playerKey ? computePlayerDetail(sbs, playerKey, stats.assignments, { ...opts, type: playerType }) : null),
    [playerKey, playerType, sbs, stats.assignments, opts],
  );
  const selectedStored = useMemo(() => stats.stored.find((s) => s.id === scoreboardId) ?? null, [scoreboardId, stats.stored]);

  const openRound = (filename: string) => {
    const s = stats.stored.find((x) => x.scoreboard.sourceFilename === filename);
    if (s) setScoreboardId(s.id);
  };
  const applyRound = (weekId: string, round: 1 | 2, af: RoundAutofill) => {
    onApplyRound?.(weekId, roundFieldUpdates(round, af));
    if (selectedStored) void stats.bind(selectedStored.id, { weekId, round });
  };
  const onPickFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const res = await stats.importFiles(files);
    setImportMsg(`Imported ${res.imported} scoreboard${res.imported === 1 ? '' : 's'}${res.failed.length ? ` · ${res.failed.length} failed` : ''}`);
    if (res.imported > 0) setTab('overview');
  };

  const hasData = sbs.length > 0;
  // Shared/read-only views drop the Import tab — there's nothing to import into.
  const visibleTabs = readOnly ? TABS.filter((t) => t !== 'import') : TABS;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1 border border-[color:var(--color-border)] bg-[color:var(--color-bg-1)] p-1 font-mono text-[11px] uppercase tracking-wider">
        {visibleTabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 transition ${
              tab === t ? 'bg-[color:var(--color-accent)] text-[color:var(--color-bg-0)]' : 'text-[color:var(--color-text-2)] hover:text-[color:var(--color-text-0)]'
            }`}
          >
            {t}
          </button>
        ))}
        <span className="px-3 text-[color:var(--color-text-2)]">{eventName}</span>
      </div>

      {tab === 'overview' && (
        <div className="space-y-3">
          <OverviewTab o={overview} hasData={hasData} />
          <CombatTab combat={combat} hasData={hasData} />
        </div>
      )}

      {tab === 'players' && (
        <>
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider">
            <span className="text-[color:var(--color-text-2)]">Class</span>
            {(['all', 'inf', 'arty'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setTypeFilter(f)}
                className={`border border-[color:var(--color-border)] px-2 py-1 ${
                  typeFilter === f ? 'bg-[color:var(--color-bg-3)] text-[color:var(--color-text-0)]' : 'text-[color:var(--color-text-2)]'
                }`}
              >
                {f}
              </button>
            ))}
            <Pill tone={typeFilter === 'arty' ? 'warn' : typeFilter === 'inf' ? 'neutral' : 'accent'}>
              {typeFilter === 'all' ? 'All (combined)' : typeFilter === 'inf' ? 'Infantry' : 'Artillery'}
            </Pill>
          </div>
          <Panel title={`Player Leaderboard (${players.length})`}>
            {players.length === 0 ? (
              <EmptyHint>
                {typeFilter === 'all' ? 'Import a scoreboard to see player stats' : `No ${typeFilter} player-rounds`}
              </EmptyHint>
            ) : (
              <DataTable<PlayerStatRow>
                rows={players}
                getRowKey={(p) => p.key}
                initialSortKey="kills"
                searchValue={(p) => `${p.name} ${p.regiment}`}
                searchPlaceholder="Search players or regiments…"
                columns={playerColumns(goToRegiment, openPlayer)}
              />
            )}
          </Panel>
        </>
      )}

      {tab === 'regiments' && (
        <RegimentsTab
          regiments={regiments}
          stats={stats}
          openPlayer={openPlayer}
          openRound={openRound}
          focusRegiment={focusRegiment}
          focusNonce={focusNonce}
          readOnly={readOnly}
        />
      )}

      {tab === 'rounds' && <RoundsTab rounds={rounds} openRound={openRound} />}

      {tab === 'import' && !readOnly && (
        <ImportTab
          stats={stats}
          listText={listText}
          setListText={setListText}
          importMsg={importMsg}
          fileRef={fileRef}
          onPickFiles={onPickFiles}
          onOpenScoreboard={setScoreboardId}
        />
      )}

      <PlayerDrawer
        open={playerKey != null}
        onClose={() => setPlayerKey(null)}
        detail={playerDetail}
        onOpenRound={openRound}
        type={playerType}
        onType={setPlayerType}
      />
      <ScoreboardDrawer
        open={scoreboardId != null}
        onClose={() => setScoreboardId(null)}
        stored={selectedStored}
        onOpenPlayer={setPlayerKey}
        weeks={weeks}
        teamNames={teamNames}
        validMaps={validMaps}
        canBind={!readOnly && !!onApplyRound}
        buildAutofill={(sb, flipped) => buildRoundAutofill(sb, teamNames, validMaps, flipped)}
        onApply={applyRound}
        resolveRegiment={resolveRegiment}
      />
    </div>
  );
}

// ── Overview ─────────────────────────────────────────────────────────────────

function OverviewTab({ o, hasData }: { o: ReturnType<typeof computeOverview>; hasData: boolean }) {
  if (!hasData) {
    return (
      <Panel title="Overview">
        <EmptyHint>Import scoreboards to see event totals</EmptyHint>
      </Panel>
    );
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px">
      <Tile label="Rounds" value={o.totalRounds} />
      <Tile label="USA Wins" value={o.usaWins} />
      <Tile label="CSA Wins" value={o.csaWins} />
      <Tile label="Total Kills" value={o.totalKills.toLocaleString()} />
      <Tile label="USA Casualties" value={o.usaCasualties.toLocaleString()} />
      <Tile label="CSA Casualties" value={o.csaCasualties.toLocaleString()} />
      <Tile label="Players" value={o.distinctPlayers} hint="unique by steam id" />
      <Tile label="Regiments" value={o.distinctRegiments} />
      <Tile label="Avg Peak Pop" value={o.avgPeakPop ?? '—'} hint="avg across rounds" />
    </div>
  );
}

// ── Players (no Team column — event context) ────────────────────────────────

function playerColumns(goToRegiment: (label: string) => void, openPlayer: (key: string) => void): Column<PlayerStatRow>[] {
  return [
    {
      key: 'name',
      header: 'Player',
      sortable: true,
      sortValue: (p) => p.name.toLowerCase(),
      render: (p) => (
        <button onClick={() => openPlayer(p.key)} className="text-left hover:text-[color:var(--color-accent)]">
          {p.name}
        </button>
      ),
    },
    {
      key: 'regiment',
      header: 'Regiment',
      sortable: true,
      sortValue: (p) => p.regiment,
      render: (p) => (
        <button
          onClick={() => goToRegiment(p.regiment)}
          className="underline decoration-dotted underline-offset-2 hover:text-[color:var(--color-accent)]"
          title="Open this regiment in the Regiments tab"
        >
          {p.regiment}
        </button>
      ),
    },
    { key: 'rounds', header: 'R', align: 'right', sortable: true, sortValue: (p) => p.rounds, render: (p) => p.rounds },
    { key: 'kills', header: 'K', align: 'right', sortable: true, sortValue: (p) => p.kills, render: (p) => p.kills },
    { key: 'deaths', header: 'D', align: 'right', sortable: true, sortValue: (p) => p.deaths, render: (p) => p.deaths },
    { key: 'kd', header: 'K/D', align: 'right', sortable: true, sortValue: (p) => p.kd, render: (p) => p.kd.toFixed(2) },
    { key: 'avgTd', header: TdHead, align: 'right', sortable: true, sortValue: (p) => p.avgTd ?? -1, render: (p) => formatAvgT(p.avgTd) },
    { key: 'avgTk', header: TkHead, align: 'right', sortable: true, sortValue: (p) => p.avgTk ?? -1, render: (p) => formatAvgT(p.avgTk) },
  ];
}

// ── Regiments ────────────────────────────────────────────────────────────────

function Bars({ data, showPct = false }: { data: [string, number][]; showPct?: boolean }) {
  const max = data.reduce((m, [, v]) => Math.max(m, v), 0);
  const total = data.reduce((s, [, v]) => s + v, 0);
  if (data.length === 0 || max === 0) return <EmptyHint>No data</EmptyHint>;
  return (
    <div className="space-y-1 font-mono text-[11px]">
      {data.map(([label, count]) => (
        <div key={label} className="flex items-center gap-2">
          <span className="w-28 shrink-0 capitalize text-[color:var(--color-text-1)]">{label}</span>
          <div className="flex-1 bg-[color:var(--color-bg-2)] h-3">
            <div className="h-3 bg-[color:var(--color-accent)]/40" style={{ width: `${(count / max) * 100}%` }} />
          </div>
          <span className="w-10 text-right tabular-nums text-[color:var(--color-text-0)]">{count}</span>
          {showPct && (
            <span className="w-10 text-right tabular-nums text-[color:var(--color-text-2)]">
              {total ? `${Math.round((count / total) * 100)}%` : ''}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/** Two side-by-side breakdowns (by formation, by cause) under one heading,
 *  each shown with raw counts and percentages. Used for both the casualties a
 *  regiment suffered and the casualties it inflicted. */
function BreakdownGroup({
  heading,
  form,
  cause,
}: {
  heading: string;
  form: [string, number][];
  cause: [string, number][];
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-[color:var(--color-accent)] font-mono mb-1.5">{heading}</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[color:var(--color-text-2)] font-mono mb-1">By formation</div>
          <Bars data={form} showPct />
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[color:var(--color-text-2)] font-mono mb-1">By cause</div>
          {cause.length === 0 ? <EmptyHint>No killfeed data</EmptyHint> : <Bars data={cause} showPct />}
        </div>
      </div>
    </div>
  );
}

type RegSort = 'name' | 'players' | 'avgPlayers' | 'kills' | 'deaths' | 'kd' | 'avgTk' | 'avgTd';

const REG_SORTS: { key: RegSort; label: string }[] = [
  { key: 'name', label: 'name' },
  { key: 'players', label: 'players' },
  { key: 'avgPlayers', label: 'avg/rd' },
  { key: 'kills', label: 'kills' },
  { key: 'deaths', label: 'deaths' },
  { key: 'kd', label: 'k/d' },
  { key: 'avgTk', label: '×Tk' },
  { key: 'avgTd', label: '×Td' },
];

/** Sort key → comparable value. Null ticket averages sort last (as -1). */
function regSortValue(r: RegimentStatRow, k: RegSort): number | string {
  switch (k) {
    case 'name':
      return r.regiment;
    case 'players':
      return r.players;
    case 'avgPlayers':
      return r.avgPlayers;
    case 'kills':
      return r.kills;
    case 'deaths':
      return r.deaths;
    case 'kd':
      return r.kd;
    case 'avgTk':
      return r.avgTk ?? -1;
    case 'avgTd':
      return r.avgTd ?? -1;
  }
}

interface RegEdit {
  editMode: boolean;
  allRegiments: string[];
  pending: Record<string, string>;
  selected: Set<string>;
  stageMove: (steamId: string, target: string) => void;
  toggleSelect: (steamId: string) => void;
  rename: (from: string) => void;
  merge: (from: string, into: string) => void;
}

function RegimentsTab({
  regiments,
  stats,
  openPlayer,
  openRound,
  focusRegiment,
  focusNonce,
  readOnly = false,
}: {
  regiments: RegimentStatRow[];
  stats: ReturnType<typeof useStats>;
  openPlayer: (key: string) => void;
  openRound: (filename: string) => void;
  focusRegiment: string | null;
  focusNonce: number;
  readOnly?: boolean;
}) {
  const [editMode, setEditMode] = useState(false);
  const [pending, setPending] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [moveTarget, setMoveTarget] = useState('');

  const allRegiments = useMemo(
    () => regiments.map((r) => r.regiment).sort((a, b) => a.localeCompare(b)),
    [regiments],
  );

  const [sortKey, setSortKey] = useState<RegSort>('kills');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const onSort = (k: RegSort) => {
    if (k === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(k);
      // Names read best A→Z; every numeric column reads best high→low first.
      setSortDir(k === 'name' ? 'asc' : 'desc');
    }
  };
  const sortedRegiments = useMemo(() => {
    const arr = [...regiments];
    arr.sort((a, b) => {
      const av = regSortValue(a, sortKey);
      const bv = regSortValue(b, sortKey);
      const cmp =
        typeof av === 'string' || typeof bv === 'string'
          ? String(av).localeCompare(String(bv))
          : av - bv;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [regiments, sortKey, sortDir]);

  const pendingCount = Object.keys(pending).length;
  const aliasList = Object.entries(stats.aliases);

  const reset = () => {
    setPending({});
    setSelected(new Set());
    setMoveTarget('');
  };
  const exitEdit = () => {
    if (pendingCount > 0 && !window.confirm(`Discard ${pendingCount} unsaved assignment change(s)?`)) return;
    reset();
    setEditMode(false);
  };
  const stageMove = (steamId: string, target: string) => {
    setPending((p) => {
      const next = { ...p };
      next[steamId] = target;
      return next;
    });
  };
  const toggleSelect = (steamId: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(steamId)) next.delete(steamId);
      else next.add(steamId);
      return next;
    });
  };
  const moveSelectedTo = (target: string) => {
    if (!target || selected.size === 0) return;
    setPending((p) => {
      const next = { ...p };
      for (const id of selected) next[id] = target;
      return next;
    });
    setSelected(new Set());
    setMoveTarget('');
  };
  const save = async () => {
    await stats.bulkAssign(pending);
    reset();
  };
  const rename = (from: string) => {
    if (from === UNTAGGED) return;
    const raw = window.prompt(`Rename regiment "${from}" to:`, from);
    const to = raw?.trim();
    if (!to || to === from) return;
    if (allRegiments.includes(to) && !window.confirm(`"${to}" already exists — this will MERGE "${from}" into it. Continue?`)) return;
    void stats.setAlias(from, to);
  };
  const merge = (from: string, into: string) => {
    if (!into || into === from || from === UNTAGGED || into === UNTAGGED) return;
    if (!window.confirm(`Merge "${from}" into "${into}"? All of its players and stats will move. You can undo this later.`)) return;
    void stats.setAlias(from, into);
  };

  const edit: RegEdit = { editMode, allRegiments, pending, selected, stageMove, toggleSelect, rename, merge };

  if (regiments.length === 0) {
    return (
      <Panel title="Regiments">
        <EmptyHint>Import a scoreboard to see regiment breakdowns</EmptyHint>
      </Panel>
    );
  }

  return (
    <div className="space-y-3 pb-16">
      {/* Edit toolbar — hidden in read-only/shared views (no mutations). */}
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-wider">
          <button
            onClick={() => (editMode ? exitEdit() : setEditMode(true))}
            className={`flex items-center gap-1.5 border border-[color:var(--color-border)] px-2 py-1 ${
              editMode ? 'bg-[color:var(--color-accent)] text-[color:var(--color-bg-0)]' : 'text-[color:var(--color-text-1)] hover:bg-[color:var(--color-bg-3)]'
            }`}
          >
            <Pencil size={12} /> {editMode ? 'Done editing' : 'Edit assignments'}
          </button>
          {editMode && (
            <span className="text-[color:var(--color-text-2)] normal-case tracking-normal">
              Pick a regiment per player, or check several and move them together. Changes apply on Save. Rename/merge apply immediately.
            </span>
          )}
        </div>
      )}

      {/* Active renames/merges */}
      {editMode && aliasList.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 font-mono text-[10px]">
          <span className="uppercase tracking-wider text-[color:var(--color-text-2)]">Active renames / merges:</span>
          {aliasList.map(([from, to]) => (
            <span key={from} className="flex items-center gap-1 border border-[color:var(--color-border)] bg-[color:var(--color-bg-2)] px-1.5 py-0.5">
              <span className="text-[color:var(--color-text-1)]">{from} → {to}</span>
              <button onClick={() => void stats.removeAlias(from)} title="Undo" className="text-[color:var(--color-text-2)] hover:text-[color:var(--color-danger)]">
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Sort the regiment panels by any column. */}
      <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] uppercase tracking-wider">
        <span className="text-[color:var(--color-text-2)]">Sort</span>
        {REG_SORTS.map((s) => (
          <button
            key={s.key}
            onClick={() => onSort(s.key)}
            className={
              sortKey === s.key
                ? 'text-[color:var(--color-accent)]'
                : 'text-[color:var(--color-text-2)] hover:text-[color:var(--color-text-1)]'
            }
          >
            {s.label}
            {sortKey === s.key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
          </button>
        ))}
      </div>

      {sortedRegiments.map((r) => (
        <RegimentPanel
          key={r.regiment}
          reg={r}
          openPlayer={openPlayer}
          openRound={openRound}
          edit={edit}
          focusActive={focusRegiment === r.regiment}
          focusNonce={focusNonce}
        />
      ))}

      {/* Sticky action bar */}
      {editMode && (pendingCount > 0 || selected.size > 0) && (
        <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 border border-[color:var(--color-accent)] bg-[color:var(--color-bg-2)] px-3 py-2 font-mono text-[11px]">
          {selected.size > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[color:var(--color-text-1)]">{selected.size} selected →</span>
              <select
                value={moveTarget}
                onChange={(e) => setMoveTarget(e.target.value)}
                className="bg-[color:var(--color-bg-1)] border border-[color:var(--color-border)] px-1 py-0.5 text-[color:var(--color-text-0)]"
              >
                <option value="">move to…</option>
                {allRegiments.map((label) => (
                  <option key={label} value={label}>{label}</option>
                ))}
              </select>
              <button
                onClick={() => moveSelectedTo(moveTarget)}
                disabled={!moveTarget}
                className="border border-[color:var(--color-border)] px-2 py-0.5 uppercase tracking-wider text-[color:var(--color-text-1)] enabled:hover:bg-[color:var(--color-bg-3)] disabled:opacity-40"
              >
                Stage move
              </button>
            </div>
          )}
          <div className="flex-1" />
          <span className="text-[color:var(--color-text-2)] uppercase tracking-wider">{pendingCount} pending change{pendingCount === 1 ? '' : 's'}</span>
          <button onClick={reset} className="border border-[color:var(--color-border)] px-2 py-0.5 uppercase tracking-wider text-[color:var(--color-text-1)] hover:bg-[color:var(--color-bg-3)]">
            Discard
          </button>
          <button
            onClick={() => void save()}
            disabled={pendingCount === 0}
            className="border border-[color:var(--color-accent)] bg-[color:var(--color-accent)] px-3 py-0.5 uppercase tracking-wider text-[color:var(--color-bg-0)] disabled:opacity-40"
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}

function RegimentPanel({
  reg,
  openPlayer,
  openRound,
  edit,
  focusActive,
  focusNonce,
}: {
  reg: RegimentStatRow;
  openPlayer: (key: string) => void;
  openRound: (filename: string) => void;
  edit: RegEdit;
  focusActive: boolean;
  focusNonce: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focusActive && focusNonce > 0) wrapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [focusActive, focusNonce]);

  const formOf = (f: FormationCounts): [string, number][] => [
    [FORMATION_LABEL.in_form, f.in_form],
    [FORMATION_LABEL.skirm, f.skirm],
    [FORMATION_LABEL.oob, f.oob],
  ];
  const byCause = (m: Record<string, number>): [string, number][] =>
    Object.entries(m).sort((a, b) => b[1] - a[1]);
  const sufferedForm = formOf(reg.casualtiesByFormation);
  const sufferedCause = byCause(reg.casualtiesByCause);
  const inflictedForm = formOf(reg.killsByFormation);
  const inflictedCause = byCause(reg.killsByCause);
  const isUntagged = reg.regiment === UNTAGGED;
  const mergeTargets = edit.allRegiments.filter((l) => l !== reg.regiment && l !== UNTAGGED);

  return (
    <div ref={wrapRef}>
      <Panel
        title={reg.regiment}
        collapsible
        defaultOpen={false}
        storageKey={`reg-panel-${reg.regiment}`}
        openSignal={focusActive ? focusNonce : undefined}
        right={
          <>
            <span title="Total unique players · average players fielded per round">
              {`${reg.players}p · ${reg.avgPlayers.toFixed(1)}/rd`}
            </span>
            {` · ${reg.rounds}rd · ${reg.kills}K/${reg.deaths}D · ${reg.kd.toFixed(2)} · `}
            <span title={AVG_TD_LABEL}>×Td {formatAvgT(reg.avgTd)}</span>
            {' · '}
            <span title={AVG_TK_LABEL}>×Tk {formatAvgT(reg.avgTk)}</span>
          </>
        }
      >
      <div className="p-3 space-y-3">
        {edit.editMode && !isUntagged && (
          <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] border-b border-[color:var(--color-border)] pb-2">
            <button onClick={() => edit.rename(reg.regiment)} className="flex items-center gap-1 border border-[color:var(--color-border)] px-2 py-0.5 uppercase tracking-wider text-[color:var(--color-text-1)] hover:bg-[color:var(--color-bg-3)]">
              <Pencil size={11} /> Rename
            </button>
            <span className="flex items-center gap-1 text-[color:var(--color-text-2)]">
              <GitMerge size={12} />
              <select
                defaultValue=""
                onChange={(e) => { const v = e.target.value; e.currentTarget.selectedIndex = 0; edit.merge(reg.regiment, v); }}
                className="bg-[color:var(--color-bg-1)] border border-[color:var(--color-border)] px-1 py-0.5 text-[color:var(--color-text-0)]"
              >
                <option value="">Merge into…</option>
                {mergeTargets.map((label) => (
                  <option key={label} value={label}>{label}</option>
                ))}
              </select>
            </span>
          </div>
        )}

        <div className="space-y-3">
          <BreakdownGroup heading="Casualties suffered" form={sufferedForm} cause={sufferedCause} />
          <BreakdownGroup heading="Casualties inflicted" form={inflictedForm} cause={inflictedCause} />
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-wider text-[color:var(--color-text-2)] font-mono mb-1">Round-by-round</div>
          <table className="w-full font-mono text-[11px]">
            <thead>
              <tr className="border-b border-[color:var(--color-border)] bg-[color:var(--color-bg-2)] text-[10px] uppercase tracking-wider text-[color:var(--color-text-2)]">
                <th className="px-2 py-1 text-left">When</th>
                <th className="px-2 py-1 text-left">Map · Area</th>
                <th className="px-2 py-1 text-right">Plr</th>
                <th className="px-2 py-1 text-right">K</th>
                <th className="px-2 py-1 text-right">D</th>
                <th className="px-2 py-1 text-right">K/D</th>
                <th className="px-2 py-1 text-right">{TdHead}</th>
                <th className="px-2 py-1 text-right">{TkHead}</th>
              </tr>
            </thead>
            <tbody>
              {reg.perRound.map((rr) => (
                <tr
                  key={rr.sourceFilename}
                  onClick={() => openRound(rr.sourceFilename)}
                  className="border-b border-[color:var(--color-border)] cursor-pointer hover:bg-[color:var(--color-bg-3)]"
                >
                  <td className="px-2 py-1 text-[color:var(--color-text-2)] whitespace-nowrap">{whenOf(rr.recordedAt)}</td>
                  <td className="px-2 py-1 text-[color:var(--color-text-1)]">
                    {rr.map}
                    {rr.area ? ` · ${rr.area}` : ''}
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums text-[color:var(--color-text-2)]">{rr.players}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{rr.kills}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{rr.deaths}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{kdStr(rr.kills, rr.deaths)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{formatAvgT(rr.avgTd)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{formatAvgT(rr.avgTk)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-wider text-[color:var(--color-text-2)] font-mono mb-1">Players</div>
          {edit.editMode ? (
            <EditablePlayers reg={reg} openPlayer={openPlayer} edit={edit} />
          ) : (
            <DataTable<PlayerStatRow>
              rows={reg.topPlayers}
              getRowKey={(p) => p.key}
              initialSortKey="kills"
              columns={[
                {
                  key: 'name',
                  header: 'Player',
                  render: (p) => (
                    <button onClick={() => openPlayer(p.key)} className="text-left hover:text-[color:var(--color-accent)]">
                      {p.name}
                    </button>
                  ),
                },
                { key: 'kills', header: 'K', align: 'right', sortable: true, sortValue: (p) => p.kills, render: (p) => p.kills },
                { key: 'deaths', header: 'D', align: 'right', sortable: true, sortValue: (p) => p.deaths, render: (p) => p.deaths },
                { key: 'kd', header: 'K/D', align: 'right', sortable: true, sortValue: (p) => p.kd, render: (p) => p.kd.toFixed(2) },
                { key: 'avgTd', header: TdHead, align: 'right', sortable: true, sortValue: (p) => p.avgTd ?? -1, render: (p) => formatAvgT(p.avgTd) },
                { key: 'avgTk', header: TkHead, align: 'right', sortable: true, sortValue: (p) => p.avgTk ?? -1, render: (p) => formatAvgT(p.avgTk) },
              ]}
            />
          )}
        </div>
      </div>
      </Panel>
    </div>
  );
}

// Editable players list (shown only in edit mode): checkbox to multi-select +
// a per-player regiment dropdown that stages a move until Save.
function EditablePlayers({
  reg,
  openPlayer,
  edit,
}: {
  reg: RegimentStatRow;
  openPlayer: (key: string) => void;
  edit: RegEdit;
}) {
  return (
    <table className="w-full font-mono text-[11px]">
      <thead>
        <tr className="border-b border-[color:var(--color-border)] bg-[color:var(--color-bg-2)] text-[10px] uppercase tracking-wider text-[color:var(--color-text-2)]">
          <th className="px-2 py-1 w-6" />
          <th className="px-2 py-1 text-left">Player</th>
          <th className="px-2 py-1 text-left">Move to</th>
          <th className="px-2 py-1 text-right">K</th>
          <th className="px-2 py-1 text-right">D</th>
        </tr>
      </thead>
      <tbody>
        {reg.topPlayers.map((p) => {
          const pinnable = !!p.steamId;
          const staged = pinnable ? edit.pending[p.steamId!] : undefined;
          const value = staged ?? reg.regiment;
          const moved = staged != null && staged !== reg.regiment;
          return (
            <tr key={p.key} className={`border-b border-[color:var(--color-border)] ${moved ? 'bg-[color:var(--color-accent-soft)]' : ''}`}>
              <td className="px-2 py-1">
                <input
                  type="checkbox"
                  disabled={!pinnable}
                  checked={pinnable && edit.selected.has(p.steamId!)}
                  onChange={() => pinnable && edit.toggleSelect(p.steamId!)}
                />
              </td>
              <td className="px-2 py-1">
                <button onClick={() => openPlayer(p.key)} className="text-left hover:text-[color:var(--color-accent)]">
                  {p.name}
                </button>
                {moved && <span className="text-[color:var(--color-text-2)]"> → {staged}</span>}
              </td>
              <td className="px-2 py-1">
                {pinnable ? (
                  <select
                    value={value}
                    onChange={(e) => edit.stageMove(p.steamId!, e.target.value)}
                    className="bg-[color:var(--color-bg-1)] border border-[color:var(--color-border)] px-1 py-0.5 text-[color:var(--color-text-0)]"
                  >
                    {!edit.allRegiments.includes(value) && <option value={value}>{value}</option>}
                    {edit.allRegiments.map((label) => (
                      <option key={label} value={label}>{label}</option>
                    ))}
                  </select>
                ) : (
                  <span className="text-[color:var(--color-text-2)]" title="No steam id — cannot reassign individually">—</span>
                )}
              </td>
              <td className="px-2 py-1 text-right tabular-nums">{p.kills}</td>
              <td className="px-2 py-1 text-right tabular-nums">{p.deaths}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ── Rounds ───────────────────────────────────────────────────────────────────

function RoundsTab({ rounds, openRound }: { rounds: RoundSummary[]; openRound: (f: string) => void }) {
  if (rounds.length === 0) {
    return (
      <Panel title="Rounds">
        <EmptyHint>Import scoreboards to see rounds</EmptyHint>
      </Panel>
    );
  }
  const byDate = new Map<string, RoundSummary[]>();
  for (const r of rounds) {
    const d = dateOf(r.recordedAt);
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d)!.push(r);
  }
  return (
    <div className="space-y-3">
      {[...byDate.entries()].map(([date, list]) => (
        <Panel key={date} title={date} right={`${list.length} rounds`} collapsible defaultOpen storageKey={`rounds-${date}`}>
          <table className="w-full border-collapse font-mono text-[11px]">
            <thead>
              <tr className="border-b border-[color:var(--color-border)] bg-[color:var(--color-bg-2)] text-[10px] uppercase tracking-wider text-[color:var(--color-text-2)]">
                <th className="px-2 py-1 text-left">Time</th>
                <th className="px-2 py-1 text-left">Map</th>
                <th className="px-2 py-1 text-left">Mode</th>
                <th className="px-2 py-1 text-left">Area</th>
                <th className="px-2 py-1 text-left">Winner</th>
                <th className="px-2 py-1 text-right">Dur</th>
                <th className="px-2 py-1 text-right">Players</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr
                  key={r.sourceFilename}
                  onClick={() => openRound(r.sourceFilename)}
                  className="border-b border-[color:var(--color-border)] cursor-pointer hover:bg-[color:var(--color-bg-3)]"
                >
                  <td className="px-2 py-1 text-[color:var(--color-text-2)]">{timeOf(r.recordedAt)}</td>
                  <td className="px-2 py-1 text-[color:var(--color-text-0)]">{r.map}</td>
                  <td className="px-2 py-1 text-[color:var(--color-text-1)]">{r.mode}</td>
                  <td className="px-2 py-1 text-[color:var(--color-text-2)]">{r.area ?? '—'}</td>
                  <td className="px-2 py-1">{r.winner && <Pill tone={teamTone(r.winner)}>{r.winner}</Pill>}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{fmtDuration(r.durationSeconds)}</td>
                  <td className="px-2 py-1 text-right tabular-nums text-[color:var(--color-text-2)]">{r.players}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      ))}
    </div>
  );
}

// ── Combat ───────────────────────────────────────────────────────────────────

function CombatTab({ combat, hasData }: { combat: ReturnType<typeof computeCombatTotals>; hasData: boolean }) {
  if (!hasData) {
    return (
      <Panel title="Combat">
        <EmptyHint>Import a scoreboard to see weapon &amp; casualty breakdowns</EmptyHint>
      </Panel>
    );
  }
  const weaponsFor = (team: Team) =>
    Object.entries(combat.deathsByWeapon[team]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const stanceFor = (team: Team): [string, number][] => {
    const c = combat.casualties[team];
    return [
      [FORMATION_LABEL.in_form, c.inForm],
      [FORMATION_LABEL.skirm, c.skirm],
      [FORMATION_LABEL.oob, c.oob],
    ];
  };
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {(['USA', 'CSA'] as Team[]).map((team) => (
        <Panel key={`w-${team}`} title={`${team} — deaths by weapon`} right={`${combat.casualties[team].total} total`}>
          <div className="p-3">
            <Bars data={weaponsFor(team)} />
          </div>
        </Panel>
      ))}
      {(['USA', 'CSA'] as Team[]).map((team) => (
        <Panel key={`c-${team}`} title={`${team} — casualties by stance`}>
          <div className="p-3">
            <Bars data={stanceFor(team)} />
          </div>
        </Panel>
      ))}
    </div>
  );
}

// ── Import ───────────────────────────────────────────────────────────────────

function ImportTab({
  stats,
  listText,
  setListText,
  importMsg,
  fileRef,
  onPickFiles,
  onOpenScoreboard,
}: {
  stats: ReturnType<typeof useStats>;
  listText: string;
  setListText: (s: string) => void;
  importMsg: string | null;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onPickFiles: (files: FileList | null) => void;
  onOpenScoreboard: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <Panel title="Import Scoreboards">
        <div className="p-3 space-y-3">
          <input ref={fileRef} type="file" accept=".csv" multiple className="hidden" onChange={(e) => onPickFiles(e.target.files)} />
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 border border-[color:var(--color-accent)] text-[color:var(--color-accent)] px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider hover:bg-[color:var(--color-accent-soft)]"
          >
            <Upload size={13} /> Choose scoreboard CSV(s)
          </button>
          {importMsg && <div className="text-[11px] font-mono text-[color:var(--color-text-1)]">{importMsg}</div>}
          <div className="text-[10px] uppercase tracking-wider text-[color:var(--color-text-2)] font-mono pt-2">
            Regiment list (optional override)
          </div>
          <textarea
            value={listText}
            onChange={(e) => setListText(e.target.value)}
            placeholder={'One per line. e.g.\n51stNY\nII Corps = II-, II'}
            rows={6}
            className="w-full bg-[color:var(--color-bg-2)] border border-[color:var(--color-border)] p-2 font-mono text-[11px] text-[color:var(--color-text-0)] outline-none focus:border-[color:var(--color-accent)]"
          />
          <button
            onClick={() => void stats.applyRegimentList(listText)}
            className="border border-[color:var(--color-border)] px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider text-[color:var(--color-text-1)] hover:bg-[color:var(--color-bg-3)]"
          >
            Apply &amp; persist to all players
          </button>
        </div>
      </Panel>

      <Panel title={`Imported (${stats.stored.length})`}>
        {stats.stored.length === 0 ? (
          <EmptyHint>No scoreboards imported yet</EmptyHint>
        ) : (
          <div className="divide-y divide-[color:var(--color-border)]">
            {stats.stored
              .slice()
              .sort((a, b) => (b.scoreboard.recordedAt ?? '').localeCompare(a.scoreboard.recordedAt ?? ''))
              .map((s) => (
                <div key={s.id} className="flex items-center gap-2 px-3 py-1.5 font-mono text-[11px] hover:bg-[color:var(--color-bg-3)]">
                  <button onClick={() => onOpenScoreboard(s.id)} className="flex items-center gap-2 text-left flex-1 min-w-0" title="View full scoreboard">
                    <span className="text-[color:var(--color-text-2)] w-32 shrink-0">{s.scoreboard.recordedAt ?? s.scoreboard.sourceFilename}</span>
                    <span className="text-[color:var(--color-text-0)]">{s.scoreboard.meta.map}</span>
                    <span className="text-[color:var(--color-text-2)]">{s.scoreboard.meta.mode}</span>
                    {s.scoreboard.meta.winner && <Pill tone={s.scoreboard.meta.winner === 'USA' ? 'ok' : 'accent'}>{s.scoreboard.meta.winner}</Pill>}
                  </button>
                  <button onClick={() => void stats.remove(s.id)} className="text-[color:var(--color-text-2)] hover:text-[color:var(--color-danger)]" title="Delete">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
