import { useMemo, useState } from 'react';
import DataTable from './DataTable';
import BarMeter from '../charts/BarMeter';
import { StatTile } from '../afteraction/Card';
import { TEAM } from '../afteraction/teams';
import { computeEventStats } from '../../analytics/eventStats';
import { formatAvgT, FORMATION_SHORT } from '../../stats/labels';
import { UNTAGGED } from '../../analytics/regiments';

const SUBTABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'players', label: 'Players' },
  { key: 'units', label: 'Units' },
];

const teamColor = (t) => (t === 1 ? TEAM.usa : t === 2 ? TEAM.csa : '#a3a3a3');
const kd = (v) => (Number.isFinite(v) ? v.toFixed(2) : '—');
const yd = (v) => `${Math.round(v || 0)}`;

function TeamDot({ team }) {
  return <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: teamColor(team) }} />;
}

export default function EventStats({ event, replays }) {
  const [sub, setSub] = useState('overview');
  const stats = useMemo(() => computeEventStats(event.rounds, replays), [event.rounds, replays]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1 flex-wrap">
        {SUBTABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setSub(t.key)}
            className={`px-3 py-1.5 text-xs rounded transition ${sub === t.key ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {sub === 'overview' && <Overview stats={stats} />}
      {sub === 'players' && <PlayersTable rows={stats.players} />}
      {sub === 'units' && <UnitsTable rows={stats.units} />}
    </div>
  );
}

function Overview({ stats }) {
  const o = stats.overview;
  const topUnits = stats.units.filter((u) => u.regiment !== UNTAGGED).slice(0, 8);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        <StatTile label="Rounds" value={o.rounds} />
        <StatTile label="With scoreboard" value={o.scoreboardRounds} />
        <StatTile label="Players" value={o.players} />
        <StatTile label="Units" value={o.units} />
        <StatTile label="Kills" value={o.kills} />
        <StatTile label="Casualties" value={o.casualties} />
      </div>
      {o.scoreboardRounds === 0 && (
        <div className="text-xs text-slate-500 bg-slate-800 rounded-lg p-3">
          No scoreboards attached yet — combat columns are zero. Attach scoreboard CSVs to rounds to see kills,
          casualties and ticket value. Roster, rounds played and distance come from the replays alone.
        </div>
      )}
      {topUnits.length > 0 && (
        <div className="bg-slate-800 rounded-lg p-3">
          <div className="text-sm font-semibold text-slate-200 mb-2">Top units by kills</div>
          <BarMeter
            rows={topUnits.map((u) => ({ key: u.regiment, label: u.regiment, value: u.kills, color: teamColor(u.team) }))}
            valueFormat={(v) => `${v}`}
          />
        </div>
      )}
    </div>
  );
}

function PlayersTable({ rows }) {
  const columns = useMemo(() => [
    { key: 'name', header: 'Player', sortable: true, sortValue: (r) => r.name,
      render: (r) => <span className="flex items-center gap-1.5"><TeamDot team={r.team} /><span className="truncate max-w-[220px]">{r.name}</span></span> },
    { key: 'regiment', header: 'Unit', sortable: true, sortValue: (r) => r.regiment,
      render: (r) => <span className="text-slate-400">{r.regiment === UNTAGGED ? '—' : r.regiment}</span> },
    { key: 'rounds', header: 'R', align: 'right', sortable: true, sortValue: (r) => r.rounds, render: (r) => r.rounds },
    { key: 'kills', header: 'K', align: 'right', sortable: true, sortValue: (r) => r.kills, render: (r) => r.kills },
    { key: 'deaths', header: 'D', align: 'right', sortable: true, sortValue: (r) => r.deaths, render: (r) => r.deaths },
    { key: 'kd', header: 'K/D', align: 'right', sortable: true, sortValue: (r) => r.kd, render: (r) => kd(r.kd) },
    { key: 'td', header: '×Td', align: 'right', sortable: true, sortValue: (r) => r.avgTd ?? -1, render: (r) => formatAvgT(r.avgTd) },
    { key: 'tk', header: '×Tk', align: 'right', sortable: true, sortValue: (r) => r.avgTk ?? -1, render: (r) => formatAvgT(r.avgTk) },
    { key: 'dist', header: 'Dist(yd)', align: 'right', sortable: true, sortValue: (r) => r.distanceYd, render: (r) => yd(r.distanceYd) },
  ], []);

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowKey={(r) => r.key}
      initialSortKey="kills"
      searchValue={(r) => `${r.name} ${r.regiment}`}
      searchPlaceholder="Filter players…"
      emptyHint="No players yet — add replays."
    />
  );
}

function UnitsTable({ rows }) {
  const columns = useMemo(() => [
    { key: 'regiment', header: 'Unit', sortable: true, sortValue: (r) => r.regiment,
      render: (r) => <span className="flex items-center gap-1.5 font-medium"><TeamDot team={r.team} />{r.regiment === UNTAGGED ? 'Untagged' : r.regiment}</span> },
    { key: 'players', header: 'Players', align: 'right', sortable: true, sortValue: (r) => r.players, render: (r) => r.players },
    { key: 'rounds', header: 'Rnds', align: 'right', sortable: true, sortValue: (r) => r.rounds, render: (r) => r.rounds },
    { key: 'kills', header: 'K', align: 'right', sortable: true, sortValue: (r) => r.kills, render: (r) => r.kills },
    { key: 'deaths', header: 'D', align: 'right', sortable: true, sortValue: (r) => r.deaths, render: (r) => r.deaths },
    { key: 'kd', header: 'K/D', align: 'right', sortable: true, sortValue: (r) => r.kd, render: (r) => kd(r.kd) },
    { key: 'td', header: '×Td', align: 'right', sortable: true, sortValue: (r) => r.avgTd ?? -1, render: (r) => formatAvgT(r.avgTd) },
    { key: 'tk', header: '×Tk', align: 'right', sortable: true, sortValue: (r) => r.avgTk ?? -1, render: (r) => formatAvgT(r.avgTk) },
    { key: 'dist', header: 'Dist(yd)', align: 'right', sortable: true, sortValue: (r) => r.distanceYd, render: (r) => yd(r.distanceYd) },
  ], []);

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowKey={(r) => r.key}
      initialSortKey="kills"
      searchValue={(r) => r.regiment}
      searchPlaceholder="Filter units…"
      emptyHint="No units yet — add replays."
      renderExpanded={(u) => <UnitDetail unit={u} />}
    />
  );
}

function UnitDetail({ unit }) {
  const cas = unit.casualtiesByFormation;
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <div>
        <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">Casualties by stance</div>
        <div className="space-y-0.5 text-[12px]">
          <StanceRow label={FORMATION_SHORT.in_form} value={cas.inForm} />
          <StanceRow label={FORMATION_SHORT.skirm} value={cas.skirm} />
          <StanceRow label={FORMATION_SHORT.oob} value={cas.oob} />
        </div>
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">Casualties by cause</div>
        {unit.casualtiesByCause.length ? (
          <BarMeter rows={unit.casualtiesByCause.map((c) => ({ key: c.cause, label: c.cause, value: c.count }))} />
        ) : <div className="text-xs text-slate-500">No scoreboard data.</div>}
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">Top players</div>
        <div className="space-y-0.5 text-[12px]">
          {unit.topPlayers.map((p) => (
            <div key={p.key} className="flex items-center gap-2">
              <span className="truncate flex-1 text-slate-300" title={p.name}>{p.name}</span>
              <span className="tabular-nums text-slate-400">{p.kills}/{p.deaths}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StanceRow({ label, value }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex-1 text-slate-400">{label}</span>
      <span className="tabular-nums text-slate-200">{value}</span>
    </div>
  );
}
