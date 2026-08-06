// Players tab of the round drawer. Faithful port of the PUBS scoreboard
// drawer's player view: sort + search, USA/CSA team blocks, regiment→company
// unit grouping with per-unit k/d + ×Td/×Tk + formation deaths, stacked player
// cards with ★ officer markers. Falls back to a flat list when no roster.
import { useMemo, useState, type ReactNode } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { Pill } from '../../ui';
import { TicketPct, roleLine } from '../drawerPrimitives';
import type { Scoreboard, ScoreboardPlayer, RosterEntry, Team } from '../../../stats/types';
import {
  avgTicketCost,
  ticketDamage,
  perPlayerRate,
  formatRate,
  AVG_TD_LABEL,
  AVG_TK_LABEL,
  KILL_RATE_LABEL,
  LOSS_RATE_LABEL,
  TICKET_INFLICTED_LABEL,
  TICKET_RECEIVED_LABEL,
} from '../../../stats/labels';
import { tagRegimentResolver } from '../../../stats/regimentMatcher';
import {
  type PlayerSort,
  type KillStance,
  type CauseIndex,
  type CauseCounts,
  type UnitAgg,
  type RegimentGroupModel,
  type RegimentResolver,
  buildRosterIndex,
  buildKillStanceIndex,
  buildCauseIndex,
  killStanceOf,
  killedWithOf,
  diedToOf,
  sumCauses,
  comparePlayers,
  groupByRegiment,
  sumKD,
  fmtKd,
  rosterLookup,
  officerNameSet,
  playerKey,
  playerMatches,
} from './playersModel';

const UNTAGGED_KEY = '__untagged__';
const groupKey = (team: Team, regiment: string | null) => `${team}::${regiment ?? UNTAGGED_KEY}`;

const teamTone = (t: Team) => (t === 'USA' ? 'usa' : 'csa');

/** `×N.N` or `—` (no `×` prefix — the surrounding label supplies it). */
function formatTicket(avg: number | null): string {
  return avg == null ? '—' : avg.toFixed(1);
}

/** Name-tag fallback when no season resolver is supplied — the same one the
 *  Analytics tab falls back to, so the two never disagree by default. */
const tagResolver = tagRegimentResolver;

export function PlayersTab({
  sb,
  onOpenPlayer,
  resolveRegiment,
}: {
  sb: Scoreboard;
  onOpenPlayer: (key: string) => void;
  /** Season regiment resolver (steamId, name) → label. Falls back to the
   *  name-tag heuristic when the host doesn't supply one. */
  resolveRegiment?: RegimentResolver;
}) {
  const [sortBy, setSortBy] = useState<PlayerSort>('unit');
  const [search, setSearch] = useState('');
  // Open regiment groups, keyed `${team}::${regiment}`. Empty = all collapsed,
  // so groups start closed. Ignored while searching (matches force-expand).
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const toggleGroup = (key: string) =>
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  // Collapsed team blocks. Both teams start open; collapsing one leaves the
  // other's list to itself, so a long flat sort can be read one faction at a
  // time. Honored while searching too — the header keeps showing the match count.
  const [collapsedTeams, setCollapsedTeams] = useState<Set<Team>>(new Set());
  const toggleTeam = (team: Team) =>
    setCollapsedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(team)) next.delete(team);
      else next.add(team);
      return next;
    });

  const officers = useMemo(() => officerNameSet(sb.officers), [sb.officers]);
  const isOfficer = (name: string) => officers.has(name.trim().toLowerCase());

  const rosterIndex = useMemo(() => buildRosterIndex(sb.roster), [sb.roster]);
  const lookup = (p: ScoreboardPlayer) => rosterLookup(rosterIndex, p);

  const resolve = resolveRegiment ?? tagResolver;

  const killIndex = useMemo(() => buildKillStanceIndex(sb.kills), [sb.kills]);
  const killStance = (p: ScoreboardPlayer): KillStance => killStanceOf(p, killIndex);

  // Per-player "killed with" / "died to" cause breakdowns for this round.
  const causeIndex = useMemo(() => buildCauseIndex(sb.kills), [sb.kills]);

  const searchTrimmed = search.trim().toLowerCase();
  // Full teams — search now filters per-group (keeping the unit layout) rather
  // than flattening, so the regiment stat headers survive a search.
  const { usa, csa } = useMemo(() => {
    const u: ScoreboardPlayer[] = [];
    const c: ScoreboardPlayer[] = [];
    for (const p of sb.players) {
      if (p.team === 'USA') u.push(p);
      else c.push(p);
    }
    return { usa: u, csa: c };
  }, [sb.players]);

  // Keep the unit grouping even while searching — a regiment-name query should
  // surface that regiment's group with its round stats, like plain unit sort.
  const showUnitGroups = sortBy === 'unit';
  const anyMatch = useMemo(
    () => sb.players.some((p) => playerMatches(p, search, resolve)),
    [sb.players, search, resolve],
  );
  const allEmpty = !anyMatch;

  return (
    <section>
      <div className="ctl">
        <span className="cap">Sort</span>
        <div className="seg">
          {(['unit', 'name', 'kills', 'deaths', 'kd'] as const).map((s) => (
            <button key={s} onClick={() => setSortBy(s)} aria-pressed={sortBy === s}>{s}</button>
          ))}
        </div>
        <input
          type="search"
          placeholder="name, steam id or unit"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="rule" />
        <span className="meta">★ = officer · click a faction to hide it</span>
      </div>
      {allEmpty && searchTrimmed ? (
        <p className="note" style={{ padding: 13 }}>No players match "{searchTrimmed}".</p>
      ) : (
        (['USA', 'CSA'] as Team[]).map((team) => {
          const rows = team === 'USA' ? usa : csa;
          return (
            <TeamBlock
              key={team}
              team={team}
              rows={rows}
              isOfficer={isOfficer}
              lookup={lookup}
              resolve={resolve}
              killStance={killStance}
              causeIndex={causeIndex}
              sortBy={sortBy}
              showUnitGroups={showUnitGroups}
              search={search}
              openGroups={openGroups}
              onToggleGroup={toggleGroup}
              collapsed={collapsedTeams.has(team)}
              onToggleTeam={() => toggleTeam(team)}
              onOpenPlayer={onOpenPlayer}
            />
          );
        })
      )}
    </section>
  );
}

function TeamBlock({
  team,
  rows,
  isOfficer,
  lookup,
  resolve,
  killStance,
  causeIndex,
  sortBy,
  showUnitGroups,
  search,
  openGroups,
  onToggleGroup,
  collapsed,
  onToggleTeam,
  onOpenPlayer,
}: {
  team: Team;
  rows: ScoreboardPlayer[];
  isOfficer: (name: string) => boolean;
  lookup: (p: ScoreboardPlayer) => RosterEntry | undefined;
  resolve: RegimentResolver;
  killStance: (p: ScoreboardPlayer) => KillStance;
  causeIndex: CauseIndex;
  sortBy: PlayerSort;
  showUnitGroups: boolean;
  search: string;
  openGroups: Set<string>;
  onToggleGroup: (key: string) => void;
  /** Whole faction hidden — only its header row (counts + totals) renders. */
  collapsed: boolean;
  onToggleTeam: () => void;
  onOpenPlayer: (key: string) => void;
}) {
  const grouped = useMemo(() => groupByRegiment(rows, resolve), [rows, resolve]);
  // Players visible under the current search — drives the flat list, team-header
  // counts, and which groups render. A blank search matches everyone.
  const visible = useMemo(
    () => rows.filter((p) => playerMatches(p, search, resolve)),
    [rows, search, resolve],
  );
  const searching = search.trim().length > 0;
  // Team-wide ticket damage (whole team, unaffected by search) — the denominator
  // for each unit's share of the team's ticket damage inflicted / received.
  const teamAgg = useMemo(() => sumKD(rows, killStance), [rows, killStance]);
  const teamInflicted = ticketDamage(teamAgg.killInForm, teamAgg.killSkirm, teamAgg.killOob);
  const teamReceived = ticketDamage(teamAgg.inForm, teamAgg.skirm, teamAgg.oob);
  if (rows.length === 0) return null;
  if (searching && visible.length === 0) return null;

  const totals = visible.reduce(
    (acc, p) => ({ kills: acc.kills + p.kills, deaths: acc.deaths + p.deaths }),
    { kills: 0, deaths: 0 },
  );

  const TeamChevron = collapsed ? ChevronRight : ChevronDown;
  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={onToggleTeam}
        aria-expanded={!collapsed}
        title={collapsed ? `Show ${team}` : `Hide ${team}`}
        className="ph area-h"
        style={{ width: '100%', textAlign: 'left' }}
      >
        <TeamChevron size={12} style={{ flex: 'none', color: 'var(--ink-3)' }} />
        <Pill tone={teamTone(team)}>{team}</Pill>
        <span className="meta">{visible.length} player{visible.length === 1 ? '' : 's'}</span>
        <span className="rule" />
        <span className="meta">team total · {totals.kills} kills · {totals.deaths} deaths</span>
      </button>
      {collapsed ? null : showUnitGroups ? (
        <div>
          {grouped.map((reg) => {
            const players = searching
              ? reg.players.filter((p) => playerMatches(p, search, resolve))
              : reg.players;
            if (players.length === 0) return null;
            const key = groupKey(team, reg.regiment);
            return (
              <RegimentGroup
                key={key}
                group={reg}
                visiblePlayers={players}
                open={searching || openGroups.has(key)}
                onToggle={() => onToggleGroup(key)}
                isOfficer={isOfficer}
                lookup={lookup}
                killStance={killStance}
                causeIndex={causeIndex}
                teamInflicted={teamInflicted}
                teamReceived={teamReceived}
                teamPlayers={rows.length}
                onOpenPlayer={onOpenPlayer}
              />
            );
          })}
        </div>
      ) : (
        <PlayerCardList
          rows={[...visible].sort((a, b) => comparePlayers(a, b, sortBy))}
          isOfficer={isOfficer}
          lookup={lookup}
          killStance={killStance}
          causeIndex={causeIndex}
          onOpenPlayer={onOpenPlayer}
        />
      )}
    </div>
  );
}

/**
 * One metric in a unit header, stacked: label on top, value below. Keeps every
 * column in the summary aligned the same way (metric above, value below) so the
 * header reads as a clean grid instead of wrapping mid-value.
 */
function HeaderStat({ label, value, title }: { label: string; value: ReactNode; title?: string }) {
  return (
    <span className={`flex flex-col items-start leading-tight ${title ? 'cursor-help' : ''}`} title={title}>
      <span className="text-[color:var(--color-text-2)]">{label}</span>
      <span className="tabular-nums">{value}</span>
    </span>
  );
}

/** ×Td / ×Tk on company + regiment headers, stacked (label above value). */
function AvgT({ agg }: { agg: UnitAgg }) {
  const td = avgTicketCost(agg.inForm, agg.skirm, agg.oob);
  const tk = avgTicketCost(agg.killInForm, agg.killSkirm, agg.killOob);
  return (
    <>
      <HeaderStat
        label="×Td"
        title={AVG_TD_LABEL}
        value={<span className="text-[color:var(--color-text-0)]">{formatTicket(td)}</span>}
      />
      <HeaderStat
        label="×Tk"
        title={AVG_TK_LABEL}
        value={<span className="text-[color:var(--color-text-0)]">{formatTicket(tk)}</span>}
      />
    </>
  );
}

function RegimentGroup({
  group,
  visiblePlayers,
  open,
  onToggle,
  isOfficer,
  lookup,
  killStance,
  causeIndex,
  teamInflicted,
  teamReceived,
  teamPlayers,
  onOpenPlayer,
}: {
  group: RegimentGroupModel;
  /** Players to list when expanded — narrowed to search matches when searching. */
  visiblePlayers: ScoreboardPlayer[];
  open: boolean;
  onToggle: () => void;
  isOfficer: (name: string) => boolean;
  lookup: (p: ScoreboardPlayer) => RosterEntry | undefined;
  killStance: (p: ScoreboardPlayer) => KillStance;
  causeIndex: CauseIndex;
  /** Team-wide ticket damage inflicted/received — the share denominators. */
  teamInflicted: number;
  teamReceived: number;
  /** Men the whole side fielded this round, so a unit can be sized against it. */
  teamPlayers: number;
  onOpenPlayer: (key: string) => void;
}) {
  const { regiment, players } = group;
  // Stats always roll up the whole regiment, even when search narrows the list.
  const agg = sumKD(players, killStance);
  // Size-normalized rates for this unit's round: kills / casualties per player.
  const killRate = perPlayerRate(agg.kills, players.length);
  const lossRate = perPlayerRate(agg.deaths, players.length);
  // This unit's share of the team's ticket damage this round.
  const unitInflicted = ticketDamage(agg.killInForm, agg.killSkirm, agg.killOob);
  const unitReceived = ticketDamage(agg.inForm, agg.skirm, agg.oob);
  const pctInflicted = teamInflicted > 0 ? unitInflicted / teamInflicted : null;
  const pctReceived = teamReceived > 0 ? unitReceived / teamReceived : null;
  // Unit-level "killed with" / "died to" — every member's killfeed rolled up.
  const unitKilledWith = sortedCauses(sumCauses(players.map((p) => killedWithOf(p, causeIndex))));
  const unitDiedTo = sortedCauses(sumCauses(players.map((p) => diedToOf(p, causeIndex))));
  // Untagged players aren't a real unit — skip the k/d rollup.
  const showStats = regiment != null;
  const Chevron = open ? ChevronDown : ChevronRight;
  return (
    <div style={{ borderTop: '1px solid var(--line)' }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="ph area-h"
        style={{ width: '100%', textAlign: 'left', background: 'var(--surface)' }}
      >
        <Chevron size={11} style={{ flex: 'none', color: 'var(--ink-3)' }} />
        <span className="wor-name">{regiment ?? 'Untagged'}</span>
        <span className="rule" />
        <span className="meta" style={{ display: 'flex', gap: 13, flexWrap: 'wrap', whiteSpace: 'normal' }}>
          {showStats && (
            <>
              <HeaderStat
                label="Kills"
                title="kills: total [in formation / skirmish / out of line]"
                value={
                  <>
                    <span className="text-[color:var(--color-text-1)]">{agg.kills}</span>
                    <span className="text-[color:var(--color-text-2)]"> [</span>
                    <span className="text-[color:var(--color-text-1)]">{agg.killInForm}</span>
                    <span className="text-[color:var(--color-text-2)]"> / </span>
                    <span className="text-[color:var(--color-text-1)]">{agg.killSkirm}</span>
                    <span className="text-[color:var(--color-text-2)]"> / </span>
                    <span className="text-[color:var(--color-text-1)]">{agg.killOob}</span>
                    <span className="text-[color:var(--color-text-2)]">]</span>
                  </>
                }
              />
              <HeaderStat
                label="Deaths"
                title="deaths: total [in formation / skirmish / out of line]"
                value={
                  <>
                    <span className="text-[color:var(--color-text-1)]">{agg.deaths}</span>
                    <span className="text-[color:var(--color-text-2)]"> [</span>
                    <span className="text-[color:var(--color-text-1)]">{agg.inForm}</span>
                    <span className="text-[color:var(--color-text-2)]"> / </span>
                    <span className="text-[color:var(--color-text-1)]">{agg.skirm}</span>
                    <span className="text-[color:var(--color-text-2)]"> / </span>
                    <span className="text-[color:var(--color-text-1)]">{agg.oob}</span>
                    <span className="text-[color:var(--color-text-2)]">]</span>
                  </>
                }
              />
              <HeaderStat
                label="k/d"
                value={<span className="text-[color:var(--color-text-0)]">{fmtKd(agg.kills, agg.deaths)}</span>}
              />
              <HeaderStat
                label="kr"
                title={KILL_RATE_LABEL}
                value={<span className="text-[color:var(--color-text-0)]">{formatRate(killRate)}</span>}
              />
              <HeaderStat
                label="lr"
                title={LOSS_RATE_LABEL}
                value={<span className="text-[color:var(--color-text-0)]">{formatRate(lossRate)}</span>}
              />
              <AvgT agg={agg} />
              <HeaderStat
                label="TDI"
                title={TICKET_INFLICTED_LABEL}
                value={
                  <span className="text-[color:var(--color-text-0)]">
                    <TicketPct share={pctInflicted} shareTitle={TICKET_INFLICTED_LABEL} />
                  </span>
                }
              />
              <HeaderStat
                label="TDR"
                title={TICKET_RECEIVED_LABEL}
                value={
                  <span className="text-[color:var(--color-text-0)]">
                    <TicketPct share={pctReceived} shareTitle={TICKET_RECEIVED_LABEL} />
                  </span>
                }
              />
            </>
          )}
          <HeaderStat
            label="Players"
            value={
              <>
                <span style={{ color: 'var(--ink-2)' }}>{players.length}</span>
                {teamPlayers > 0 && (
                  <span style={{ color: 'var(--ink-3)' }}>
                    {' '}({Math.round((players.length / teamPlayers) * 100)}%)
                  </span>
                )}
              </>
            }
            title={teamPlayers > 0
              ? `${players.length} of the ${teamPlayers} men this side fielded`
              : undefined}
          />
        </span>
      </button>
      {open && (
        <>
          {showStats && (unitKilledWith.length > 0 || unitDiedTo.length > 0) && (
            <div className="note" style={{ borderTop: '1px solid var(--line)', background: 'var(--surface)', padding: '7px 13px' }}>
              <div>
                <span className="cap">unit killed with </span>
                {unitKilledWith.length > 0
                  ? <CauseInline data={unitKilledWith} recorded={agg.kills} />
                  : <span>—</span>}
              </div>
              <div>
                <span className="cap">unit died to </span>
                {unitDiedTo.length > 0
                  ? <CauseInline data={unitDiedTo} recorded={agg.deaths} />
                  : <span>—</span>}
              </div>
            </div>
          )}
          <PlayerCardList
            rows={visiblePlayers.slice().sort((a, b) => a.name.localeCompare(b.name))}
            isOfficer={isOfficer}
            lookup={lookup}
            killStance={killStance}
            causeIndex={causeIndex}
            onOpenPlayer={onOpenPlayer}
          />
        </>
      )}
    </div>
  );
}

/** Stacked-card list of players — the drawer is too narrow for a wide table. */
function PlayerCardList({
  rows,
  isOfficer,
  lookup,
  killStance,
  causeIndex,
  onOpenPlayer,
  indent = false,
}: {
  rows: ScoreboardPlayer[];
  isOfficer: (name: string) => boolean;
  lookup: (p: ScoreboardPlayer) => RosterEntry | undefined;
  killStance: (p: ScoreboardPlayer) => KillStance;
  causeIndex: CauseIndex;
  onOpenPlayer: (key: string) => void;
  indent?: boolean;
}) {
  return (
    <ul>
      {rows.map((p) => {
        const r = lookup(p);
        // Full in-game identity (Regiment · Co. X · Rank · Class), matching the
        // player profile's round cards.
        const role = roleLine({
          regiment: r?.regiment,
          company: r?.company,
          rank: r?.rank,
          className: r?.className,
          battery: r ? /batter/i.test(r.regiment ?? '') : false,
        });
        const ks = killStance(p);
        const killedWith = sortedCauses(killedWithOf(p, causeIndex));
        const diedTo = sortedCauses(diedToOf(p, causeIndex));
        return (
          <li
            key={playerKey(p)}
            style={{
              borderTop: '1px solid var(--line)',
              padding: indent ? '7px 13px 7px 26px' : '7px 13px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              {isOfficer(p.name) && (
                <span style={{ color: 'var(--live)', flex: 'none' }} title="officer">★</span>
              )}
              <button onClick={() => onOpenPlayer(playerKey(p))} className="wor-name" style={{ textAlign: 'left' }}>
                {p.name}
              </button>
              <span className="rule" />
              <span className="meta" style={{ display: 'flex', gap: 10, flex: 'none' }}>
                <span>K/D <b style={{ color: 'var(--ink)', fontWeight: 400 }}>{p.kd.toFixed(2)}</b></span>
                <span title={AVG_TD_LABEL} style={{ cursor: 'help' }}>
                  ×Td <b style={{ color: 'var(--ink)', fontWeight: 400 }}>
                    {formatTicket(avgTicketCost(p.deathsInForm, p.deathsSkirm, p.deathsOob))}
                  </b>
                </span>
                <span title={AVG_TK_LABEL} style={{ cursor: 'help' }}>
                  ×Tk <b style={{ color: 'var(--ink)', fontWeight: 400 }}>
                    {formatTicket(avgTicketCost(ks.inForm, ks.skirm, ks.oob))}
                  </b>
                </span>
              </span>
            </div>
            {role && <div className="note" style={{ marginTop: 3 }}>{role}</div>}
            <div style={{ marginTop: 3, color: 'var(--ink-2)' }}>
              {p.kills} kills · {p.deaths} deaths
            </div>
            <div className="note" style={{ marginTop: 3 }}>
              d: <b style={{ color: 'var(--ink-2)', fontWeight: 400 }}>{p.deathsInForm}</b> form ·{' '}
              <b style={{ color: 'var(--ink-2)', fontWeight: 400 }}>{p.deathsSkirm}</b> skirm ·{' '}
              <b style={{ color: 'var(--ink-2)', fontWeight: 400 }}>{p.deathsOob}</b> ool
            </div>
            <div className="note" style={{ marginTop: 3 }}>
              k: <b style={{ color: 'var(--ink-2)', fontWeight: 400 }}>{ks.inForm}</b> form ·{' '}
              <b style={{ color: 'var(--ink-2)', fontWeight: 400 }}>{ks.skirm}</b> skirm ·{' '}
              <b style={{ color: 'var(--ink-2)', fontWeight: 400 }}>{ks.oob}</b> ool
            </div>
            {killedWith.length > 0 && (
              <div className="note" style={{ marginTop: 3 }}>
                <span className="cap">killed with </span>
                <CauseInline data={killedWith} />
              </div>
            )}
            {diedTo.length > 0 && (
              <div className="note" style={{ marginTop: 3 }}>
                <span className="cap">died to </span>
                <CauseInline data={diedTo} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** cause → count entries, most common first. */
function sortedCauses(counts: CauseCounts): [string, number][] {
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

/** Compact inline "Rifle ×3 · Bayonet" cause list for a player card. */
/**
 * A cause breakdown with each weapon's share.
 *
 * The share is of the killfeed's own total, never of the scoreboard's kill or
 * death column. They are different sources and they do not always agree — the
 * feed can carry victims the column does not — and dividing one by the other
 * produced shares summing to 245%. `recorded` is the column's figure, shown
 * alongside only when it disagrees, so the gap is visible instead of silently
 * distorting every percentage.
 */
function CauseInline({ data, recorded }: { data: [string, number][]; recorded?: number }) {
  const denom = data.reduce((s, [, n]) => s + n, 0);
  return (
    <span>
      {data.map(([cause, n], i) => (
        <span key={cause}>
          {i > 0 && ' · '}
          <span style={{ textTransform: 'capitalize', color: 'var(--ink-2)' }}>{cause}</span>
          {n > 1 && <span style={{ color: 'var(--ink-3)' }}> ×{n}</span>}
          {denom > 0 && (
            <span style={{ color: 'var(--ink-3)' }}> {Math.round((n / denom) * 100)}%</span>
          )}
        </span>
      ))}
      {recorded != null && recorded !== denom && (
        <span
          style={{ color: 'var(--ink-3)' }}
          title={`The killfeed has ${denom}; the scoreboard column records ${recorded}. Shares are of the ${denom} the feed accounts for.`}
        >
          {' '}· {denom} of {recorded} in the feed
        </span>
      )}
    </span>
  );
}
