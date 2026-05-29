import { useMemo, useRef, useState } from 'react';
import { Upload, Trash2 } from 'lucide-react';
import { Panel, Tile, Pill, DataTable, EmptyHint } from '../ui';
import type { Column } from '../ui';
import { useStats } from './useStats';
import {
  computePlayerLeaderboard,
  computeRegimentBreakdown,
  computeCombatTotals,
  computeRounds,
  computeOverview,
  computePlayerDetail,
} from '../../stats/statsEngine';
import type { PlayerStatRow, RegimentStatRow, RoundSummary } from '../../stats/statsEngine';
import type { Team } from '../../stats/types';
import { formatAvgT, FORMATION_LABEL, AVG_TD_LABEL, AVG_TK_LABEL } from '../../stats/labels';
import { parseRegimentList } from '../../stats/regimentMatcher';
import { buildRoundAutofill, roundFieldUpdates } from '../../stats/eventBinding';
import type { TeamNames, RoundAutofill } from '../../stats/eventBinding';
import { PlayerDrawer, ScoreboardDrawer } from './StatsDrawers';

export interface WeekRef {
  id: string;
  name: string;
  round1Flipped?: boolean;
  round2Flipped?: boolean;
}

type SubTab = 'overview' | 'players' | 'regiments' | 'rounds' | 'combat' | 'import';
const TABS: SubTab[] = ['overview', 'players', 'regiments', 'rounds', 'combat', 'import'];

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

export default function StatsArea({
  eventId,
  eventName,
  registryUnits = [],
  weeks = [],
  teamNames = { A: 'USA', B: 'CSA' },
  validMaps = [],
  onApplyRound,
}: {
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
}) {
  const stats = useStats(eventId);
  const [tab, setTab] = useState<SubTab>('overview');
  const [listText, setListText] = useState(() => registryUnits.join('\n'));
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<'all' | 'inf' | 'arty'>('all');
  const [playerKey, setPlayerKey] = useState<string | null>(null);
  const [playerType, setPlayerType] = useState<'all' | 'inf' | 'arty'>('all');
  const [scoreboardId, setScoreboardId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Open a player card, resetting its role filter to "all".
  const openPlayer = (key: string) => {
    setPlayerType('all');
    setPlayerKey(key);
  };

  const sbs = stats.scoreboards;
  // Registered event units act as the default match list (overrides win; the
  // name-tag heuristic is the fallback for anything unmatched).
  const opts = useMemo(() => ({ regimentList: parseRegimentList(registryUnits.join('\n')) }), [registryUnits]);

  const players = useMemo(
    () => computePlayerLeaderboard(sbs, stats.assignments, { ...opts, type: typeFilter }),
    [sbs, stats.assignments, opts, typeFilter],
  );
  const regiments = useMemo(() => computeRegimentBreakdown(sbs, stats.assignments, opts), [sbs, stats.assignments, opts]);
  const combat = useMemo(() => computeCombatTotals(sbs), [sbs]);
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
  const editRegiment = (p: PlayerStatRow) => {
    if (!p.steamId) return;
    const next = window.prompt(`Regiment for ${p.name}`, p.regiment);
    if (next != null) void stats.setAssignment(p.steamId, next.trim() || p.regiment);
  };

  const onPickFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const res = await stats.importFiles(files);
    setImportMsg(`Imported ${res.imported} scoreboard${res.imported === 1 ? '' : 's'}${res.failed.length ? ` · ${res.failed.length} failed` : ''}`);
    if (res.imported > 0) setTab('overview');
  };

  const hasData = sbs.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1 border border-[color:var(--color-border)] bg-[color:var(--color-bg-1)] p-1 font-mono text-[11px] uppercase tracking-wider">
        {TABS.map((t) => (
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

      {tab === 'overview' && <OverviewTab o={overview} hasData={hasData} />}

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
                columns={playerColumns(editRegiment, openPlayer)}
              />
            )}
          </Panel>
        </>
      )}

      {tab === 'regiments' && (
        <div className="space-y-3">
          {regiments.length === 0 ? (
            <Panel title="Regiments">
              <EmptyHint>Import a scoreboard to see regiment breakdowns</EmptyHint>
            </Panel>
          ) : (
            regiments.map((r) => <RegimentPanel key={r.regiment} reg={r} openPlayer={openPlayer} openRound={openRound} />)
          )}
        </div>
      )}

      {tab === 'rounds' && <RoundsTab rounds={rounds} openRound={openRound} />}
      {tab === 'combat' && <CombatTab combat={combat} hasData={hasData} />}

      {tab === 'import' && (
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
        canBind={!!onApplyRound}
        buildAutofill={(sb, flipped) => buildRoundAutofill(sb, teamNames, validMaps, flipped)}
        onApply={applyRound}
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

function playerColumns(editRegiment: (p: PlayerStatRow) => void, openPlayer: (key: string) => void): Column<PlayerStatRow>[] {
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
          onClick={() => editRegiment(p)}
          className="underline decoration-dotted underline-offset-2 hover:text-[color:var(--color-accent)] disabled:no-underline"
          disabled={!p.steamId}
          title={p.steamId ? 'Click to edit assignment' : 'No steam id — cannot override'}
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

function Bars({ data }: { data: [string, number][] }) {
  const max = data.reduce((m, [, v]) => Math.max(m, v), 0);
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
        </div>
      ))}
    </div>
  );
}

function RegimentPanel({
  reg,
  openPlayer,
  openRound,
}: {
  reg: RegimentStatRow;
  openPlayer: (key: string) => void;
  openRound: (filename: string) => void;
}) {
  const causes = Object.entries(reg.casualtiesByCause).sort((a, b) => b[1] - a[1]);
  const formations: [string, number][] = [
    [FORMATION_LABEL.in_form, reg.casualtiesByFormation.in_form],
    [FORMATION_LABEL.skirm, reg.casualtiesByFormation.skirm],
    [FORMATION_LABEL.oob, reg.casualtiesByFormation.oob],
  ];
  return (
    <Panel
      title={reg.regiment}
      collapsible
      defaultOpen={false}
      storageKey={`reg-panel-${reg.regiment}`}
      right={`${reg.players}p · ${reg.rounds}rd · ${reg.kills}K/${reg.deaths}D · ${reg.kd.toFixed(2)} · ×Td ${formatAvgT(reg.avgTd)} · ×Tk ${formatAvgT(reg.avgTk)}`}
    >
      <div className="p-3 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[color:var(--color-text-2)] font-mono mb-1">Casualties by formation</div>
            <Bars data={formations} />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[color:var(--color-text-2)] font-mono mb-1">Casualties by cause</div>
            {causes.length === 0 ? <EmptyHint>No killfeed data</EmptyHint> : <Bars data={causes} />}
          </div>
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
        </div>
      </div>
    </Panel>
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
            Regiment list (pre-filled from event registry)
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
