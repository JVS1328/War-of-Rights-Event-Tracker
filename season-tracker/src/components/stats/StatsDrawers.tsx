import { useEffect, useMemo, useState } from 'react';
import { Search, ExternalLink } from 'lucide-react';
import { Drawer, Pill, EmptyHint } from '../ui';
import type { PlayerDetail } from '../../stats/statsEngine';
import { roundDurationSeconds } from '../../stats/statsEngine';
import type { StoredScoreboard } from '../../stats/StatsRepository';
import type { Scoreboard, Team } from '../../stats/types';
import type { RoundAutofill } from '../../stats/eventBinding';

interface WeekRef {
  id: string;
  name: string;
  round1Flipped?: boolean;
  round2Flipped?: boolean;
}
import { formatAvgT, FORMATION_LABEL, FORMATION_SHORT, AVG_TD_LABEL, AVG_TK_LABEL } from '../../stats/labels';
import {
  topLossRates,
  topKillRates,
  topIndividualKills,
  topIndividualDeaths,
  firstAndLastDeath,
  computeNemeses,
} from '../../stats/roundAnalytics';
import type {
  UnitRateRow,
  IndividualStatRow,
  DeathEventRow,
  NemesisRow,
} from '../../stats/roundAnalytics';

const kdStr = (k: number, d: number) => (d > 0 ? k / d : k).toFixed(2);
const whenOf = (r: string | null) => (r ? `${r.slice(0, 10)} ${r.slice(11, 16)}` : '—');

const teamTone = (t: Team) => (t === 'USA' ? 'ok' : 'accent');

function fmtDuration(sec: number | null): string {
  if (sec == null) return '—';
  return `${Math.floor(sec / 60)}m ${String(sec % 60).padStart(2, '0')}s`;
}

function Cell({ label, value, title }: { label: string; value: React.ReactNode; title?: string }) {
  return (
    <div className={`border border-[color:var(--color-border)] bg-[color:var(--color-bg-1)] px-2 py-1.5 ${title ? 'cursor-help' : ''}`} title={title}>
      <div className="text-[9px] uppercase tracking-wider text-[color:var(--color-text-2)]">{label}</div>
      <div className="text-[13px] tabular-nums text-[color:var(--color-text-0)]">{value}</div>
    </div>
  );
}

function CauseTable({ title, data }: { title: string; data: Record<string, number> }) {
  const rows = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((s, [, v]) => s + v, 0);
  return (
    <div>
      <div className="mb-1 text-[10px] uppercase tracking-wider text-[color:var(--color-text-2)]">{title}</div>
      {rows.length === 0 ? (
        <div className="text-[10px] text-[color:var(--color-text-2)] py-2">No killfeed data</div>
      ) : (
        <table className="w-full text-[11px]">
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

const SECTION_HEAD = 'mb-1 text-[10px] uppercase tracking-wider text-[color:var(--color-text-2)]';

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
      <table className="w-full text-[11px]">
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={`${r.key}-${i}`}
              onClick={() => onOpenPlayer(r.key)}
              className="cursor-pointer border-b border-[color:var(--color-border)] hover:bg-[color:var(--color-bg-3)]"
            >
              <td className="w-5 py-0.5 text-right tabular-nums text-[color:var(--color-text-2)]">{i + 1}</td>
              <td className="py-0.5">
                <div className="truncate text-[color:var(--color-text-0)]">{r.name}</div>
                {r.regiment && <div className="text-[9px] text-[color:var(--color-text-2)]">{r.regiment}</div>}
              </td>
              <td className="py-0.5 text-right font-semibold tabular-nums" style={{ color }}>
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
            <div key={`${r.regiment}-${r.team}-${i}`} className="text-[11px]">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[color:var(--color-text-0)]">
                  <span className="text-[color:var(--color-text-2)]">{i + 1}.</span> {r.regiment}
                </span>
                <span className="shrink-0 font-semibold tabular-nums" style={{ color }}>
                  {rate.toFixed(2)}
                </span>
              </div>
              <div className="relative mt-0.5 h-1.5 bg-[color:var(--color-bg-2)]">
                <div
                  className="absolute left-0 top-0 h-full"
                  style={{ width: `${(rate / max) * 100}%`, backgroundColor: color }}
                />
              </div>
              <div className="text-[9px] text-[color:var(--color-text-2)]">{detail}</div>
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
      <div className="text-[10px] uppercase tracking-wider" style={{ color }}>
        {title}
      </div>
      <button
        onClick={() => onOpenPlayer(row.victimKey)}
        className="mt-0.5 block max-w-full truncate text-left text-[12px] text-[color:var(--color-text-0)] hover:text-[color:var(--color-accent)]"
      >
        {row.victim}
      </button>
      <div className="text-[9px] text-[color:var(--color-text-2)]">
        {row.regiment ? `${row.regiment} · ` : ''}
        {row.ts || '—'}
      </div>
      {row.killer && (
        <div className="mt-0.5 truncate text-[10px] text-[color:var(--color-text-1)]">
          by{' '}
          <button
            onClick={() => row.killerKey && onOpenPlayer(row.killerKey)}
            className="hover:text-[color:var(--color-accent)]"
          >
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
      <div className="space-y-0.5 text-[11px]">
        {rows.map((r, i) => (
          <div key={`${r.killerKey}-${r.victimKey}-${i}`} className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1">
              <span className="w-4 shrink-0 text-right text-[color:var(--color-text-2)]">{i + 1}</span>
              <button
                onClick={() => onOpenPlayer(r.killerKey)}
                className="truncate hover:underline"
                style={{ color: 'var(--color-ok)' }}
              >
                {r.killer}
              </button>
              <span className="shrink-0 text-[color:var(--color-text-2)]">→</span>
              <button
                onClick={() => onOpenPlayer(r.victimKey)}
                className="truncate hover:underline"
                style={{ color: 'var(--color-danger)' }}
              >
                {r.victim}
              </button>
            </div>
            <span className="shrink-0 tabular-nums text-[color:var(--color-text-0)]">
              <span className="font-semibold">{r.count}</span>{' '}
              <span className="text-[9px] text-[color:var(--color-text-2)]">{r.count === 1 ? 'kill' : 'kills'}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PlayerDrawer({
  open,
  onClose,
  detail,
  onOpenRound,
  type,
  onType,
}: {
  open: boolean;
  onClose: () => void;
  detail: PlayerDetail | null;
  onOpenRound: (filename: string) => void;
  type: 'all' | 'inf' | 'arty';
  onType: (t: 'all' | 'inf' | 'arty') => void;
}) {
  const toggle = (
    <div className="flex items-center gap-1 px-3 pt-3 font-mono text-[10px] uppercase tracking-wider">
      <span className="text-[color:var(--color-text-2)]">Class</span>
      {(['all', 'inf', 'arty'] as const).map((t) => (
        <button
          key={t}
          onClick={() => onType(t)}
          className={`border border-[color:var(--color-border)] px-2 py-0.5 ${
            type === t ? 'bg-[color:var(--color-bg-3)] text-[color:var(--color-text-0)]' : 'text-[color:var(--color-text-2)]'
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
  return (
    <Drawer
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={detail?.name ?? 'Player'}
      subtitle={detail ? `${detail.regiment} · ${detail.isArtillery ? 'Artillery' : 'Infantry'} · ${detail.steamId ?? 'no steam id'}` : undefined}
      width={560}
    >
      {toggle}
      {!detail ? (
        <EmptyHint>{type === 'all' ? 'No data' : `No ${type === 'inf' ? 'infantry' : 'artillery'} rounds for this player`}</EmptyHint>
      ) : (
        <div className="space-y-3 p-3 font-mono">
          {detail.steamId && (
            <a
              href={`https://steamcommunity.com/profiles/${detail.steamId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-[color:var(--color-text-2)] hover:text-[color:var(--color-accent)]"
              title="Open Steam profile in a new tab"
            >
              <ExternalLink size={11} /> Steam profile
            </a>
          )}

          <div className="grid grid-cols-3 gap-px">
            <Cell label="Rounds" value={detail.rounds} />
            <Cell label="Kills" value={detail.kills} />
            <Cell label="Deaths" value={detail.deaths} />
            <Cell label="K/D" value={detail.kd.toFixed(2)} />
            <Cell label="×Td" value={formatAvgT(detail.avgTd)} title={AVG_TD_LABEL} />
            <Cell label="×Tk" value={formatAvgT(detail.avgTk)} title={AVG_TK_LABEL} />
          </div>

          <div>
            <div className="mb-1 text-[10px] uppercase tracking-wider text-[color:var(--color-text-2)]">Deaths by stance</div>
            <div className="grid grid-cols-3 gap-px">
              <Cell label={FORMATION_LABEL.in_form} value={detail.deathsInForm} />
              <Cell label={FORMATION_LABEL.skirm} value={detail.deathsSkirm} />
              <Cell label={FORMATION_LABEL.oob} value={detail.deathsOob} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <CauseTable title="Killed with" data={detail.killsByCause} />
            <CauseTable title="Died to" data={detail.deathsByCause} />
          </div>

          <div>
            <div className="mb-1 text-[10px] uppercase tracking-wider text-[color:var(--color-text-2)]">Per round</div>
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-[color:var(--color-border)] text-[9px] uppercase tracking-wider text-[color:var(--color-text-2)]">
                  <th className="py-0.5 text-left">When</th>
                  <th className="py-0.5 text-left">Map · Area</th>
                  <th className="py-0.5 text-right">K</th>
                  <th className="py-0.5 text-right">D</th>
                  <th className="py-0.5 text-right">K/D</th>
                  <th className="py-0.5 text-right" title="In Formation / Skirmish / Out of Line deaths">
                    {FORMATION_SHORT.in_form}/{FORMATION_SHORT.skirm}/{FORMATION_SHORT.oob}
                  </th>
                  <th className="py-0.5 text-right" title={AVG_TD_LABEL}>×Td</th>
                  <th className="py-0.5 text-right" title={AVG_TK_LABEL}>×Tk</th>
                </tr>
              </thead>
              <tbody>
                {detail.perRound.map((r, i) => (
                  <tr
                    key={i}
                    onClick={() => onOpenRound(r.sourceFilename)}
                    className="border-b border-[color:var(--color-border)] cursor-pointer hover:bg-[color:var(--color-bg-3)]"
                  >
                    <td className="py-0.5 text-[color:var(--color-text-2)] whitespace-nowrap">{whenOf(r.recordedAt)}</td>
                    <td className="py-0.5 text-[color:var(--color-text-1)]">
                      {r.map}
                      {r.area ? ` · ${r.area}` : ''}
                    </td>
                    <td className="py-0.5 text-right tabular-nums">{r.kills}</td>
                    <td className="py-0.5 text-right tabular-nums text-[color:var(--color-text-2)]">{r.deaths}</td>
                    <td className="py-0.5 text-right tabular-nums">{kdStr(r.kills, r.deaths)}</td>
                    <td className="py-0.5 text-right tabular-nums text-[color:var(--color-text-2)]">
                      {r.deathsInForm}/{r.deathsSkirm}/{r.deathsOob}
                    </td>
                    <td className="py-0.5 text-right tabular-nums">{formatAvgT(r.avgTd)}</td>
                    <td className="py-0.5 text-right tabular-nums">{formatAvgT(r.avgTk)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Drawer>
  );
}

export function ScoreboardDrawer({
  open,
  onClose,
  stored,
  onOpenPlayer,
  weeks = [],
  canBind = false,
  buildAutofill,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  stored: StoredScoreboard | null;
  onOpenPlayer: (key: string) => void;
  weeks?: WeekRef[];
  teamNames?: { A: string; B: string };
  validMaps?: string[];
  canBind?: boolean;
  buildAutofill?: (sb: Scoreboard, flipped: boolean) => RoundAutofill;
  onApply?: (weekId: string, round: 1 | 2, af: RoundAutofill) => void;
}) {
  const [q, setQ] = useState('');
  const [weekId, setWeekId] = useState('');
  const [round, setRound] = useState<1 | 2>(1);
  useEffect(() => {
    setWeekId(stored?.binding?.weekId ?? '');
    setRound(stored?.binding?.round ?? 1);
    setQ('');
  }, [stored?.id, stored?.binding?.weekId, stored?.binding?.round]);

  const sb = stored?.scoreboard;
  const query = q.trim().toLowerCase();
  const lineup = (team: Team) =>
    (sb?.players ?? [])
      .filter((p) => p.team === team && (!query || p.name.toLowerCase().includes(query)))
      .sort((a, b) => b.kills - a.kills);

  const analytics = useMemo(() => {
    if (!sb) {
      return {
        lossRates: [] as UnitRateRow[],
        killRates: [] as UnitRateRow[],
        topKills: [] as IndividualStatRow[],
        topDeaths: [] as IndividualStatRow[],
        nemeses: [] as NemesisRow[],
        firstDeath: null as DeathEventRow | null,
        lastDeath: null as DeathEventRow | null,
      };
    }
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

  return (
    <Drawer
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={sb ? `${sb.meta.map} · ${sb.meta.mode}` : 'Scoreboard'}
      subtitle={sb ? `${sb.recordedAt ?? sb.sourceFilename}` : undefined}
      width={660}
    >
      {!sb ? (
        <EmptyHint>No data</EmptyHint>
      ) : (
        <div className="space-y-3 p-3 font-mono">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px">
            <Cell label="Winner" value={sb.meta.winner ?? 'Draw'} />
            <Cell label="Duration" value={fmtDuration(roundDurationSeconds(sb))} />
            <Cell label="Area" value={sb.meta.area ?? '—'} />
            <Cell label="Peak Pop" value={sb.meta.popRoundPeak ?? sb.meta.popRoundMax ?? '—'} />
          </div>

          {canBind && buildAutofill && weeks.length > 0 && (() => {
            const selWeek = weeks.find((w) => w.id === weekId);
            const flipped = !!(round === 1 ? selWeek?.round1Flipped : selWeek?.round2Flipped);
            const af = buildAutofill(sb, flipped);
            const selectCls =
              'bg-[color:var(--color-bg-1)] border border-[color:var(--color-border)] px-1 py-0.5 text-[color:var(--color-text-0)]';
            return (
              <div className="border border-[color:var(--color-border)] bg-[color:var(--color-bg-2)] p-2 space-y-2">
                <div className="text-[10px] uppercase tracking-wider text-[color:var(--color-text-2)]">
                  Bind to event round → auto-fill standings
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <select value={weekId} onChange={(e) => setWeekId(e.target.value)} className={selectCls}>
                    <option value="">Select week…</option>
                    {weeks.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                  <select value={round} onChange={(e) => setRound(Number(e.target.value) === 2 ? 2 : 1)} className={selectCls}>
                    <option value={1}>Round 1</option>
                    <option value={2}>Round 2</option>
                  </select>
                  <button
                    disabled={!weekId}
                    onClick={() => weekId && onApply?.(weekId, round, af)}
                    className="border border-[color:var(--color-accent)] text-[color:var(--color-accent)] px-2 py-0.5 hover:bg-[color:var(--color-accent-soft)] disabled:opacity-40"
                  >
                    Apply auto-fill
                  </button>
                </div>
                <div className="text-[10px] text-[color:var(--color-text-1)] space-y-0.5">
                  <div>
                    Map:{' '}
                    {af.validMap ? (
                      af.area
                    ) : (
                      <span className="text-[color:var(--color-warn)]">{af.areaRaw ?? '—'} — unknown area, set manually</span>
                    )}
                  </div>
                  <div>
                    Sides: A = {af.sideAFaction} · B = {af.sideBFaction}
                    {af.flipped && <span className="text-[color:var(--color-warn)]"> (round flipped)</span>}
                  </div>
                  <div>
                    Winner: {af.winner ?? 'Draw'} {af.winnerSide ? `→ side ${af.winnerSide}` : ''}
                  </div>
                  <div>
                    Casualties: side A {af.casualtiesA} · side B {af.casualtiesB}
                  </div>
                </div>
                {stored?.binding && (
                  <div className="text-[10px] text-[color:var(--color-ok)]">
                    Currently bound to {weeks.find((w) => w.id === stored.binding!.weekId)?.name ?? 'a week'} · Round{' '}
                    {stored.binding.round}
                  </div>
                )}
              </div>
            );
          })()}

          <div className="flex items-center gap-2 border border-[color:var(--color-border)] bg-[color:var(--color-bg-2)] px-2 py-1">
            <Search size={12} className="text-[color:var(--color-text-2)]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search players…"
              className="w-full bg-transparent text-[11px] text-[color:var(--color-text-0)] placeholder:text-[color:var(--color-text-2)] outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(['USA', 'CSA'] as Team[]).map((team) => {
              const cas = sb.meta.casualties[team];
              return (
                <div key={team}>
                  <div className="mb-1 flex items-center justify-between">
                    <Pill tone={teamTone(team)}>{team}</Pill>
                    <span className="text-[10px] text-[color:var(--color-text-2)]" title="Casualties: In Formation / Skirmish / Out of Line">
                      {cas.total} cas · {cas.inForm}/{cas.skirm}/{cas.oob} {FORMATION_SHORT.in_form}/{FORMATION_SHORT.skirm}/{FORMATION_SHORT.oob}
                    </span>
                  </div>
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="border-b border-[color:var(--color-border)] text-[9px] uppercase tracking-wider text-[color:var(--color-text-2)]">
                        <th className="py-0.5 text-left">Player</th>
                        <th className="py-0.5 text-right">K</th>
                        <th className="py-0.5 text-right">D</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineup(team).map((p, i) => (
                        <tr key={`${p.steamId ?? p.name}-${i}`} className="border-b border-[color:var(--color-border)]">
                          <td className="py-0.5">
                            <button
                              onClick={() => onOpenPlayer(p.steamId ?? p.name)}
                              className="text-left text-[color:var(--color-text-0)] hover:text-[color:var(--color-accent)]"
                            >
                              {p.name}
                            </button>
                          </td>
                          <td className="py-0.5 text-right tabular-nums">{p.kills}</td>
                          <td className="py-0.5 text-right tabular-nums text-[color:var(--color-text-2)]">{p.deaths}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>

          {(analytics.topKills.length > 0 ||
            analytics.lossRates.length > 0 ||
            analytics.nemeses.length > 0 ||
            analytics.firstDeath) && (
            <div className="space-y-3 border-t border-[color:var(--color-border)] pt-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-1)]">
                Round analytics
              </div>

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
          )}
        </div>
      )}
    </Drawer>
  );
}
