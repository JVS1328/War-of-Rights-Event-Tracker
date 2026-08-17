// Players tab of the round drawer. Faithful port of the PUBS scoreboard
// drawer's player view: sort + search, USA/CSA team blocks, regiment→company
// unit grouping with per-unit k/d + ×Td/×Tk + formation deaths, stacked player
// cards with ★ officer markers. Falls back to a flat list when no roster.
import { useMemo, useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { Pill } from '../../ui';
import type { Scoreboard, ScoreboardPlayer, RosterEntry, Team } from '../../../stats/types';
import { ticketDamage } from '../../../stats/labels';
import { tagRegimentResolver } from '../../../stats/regimentMatcher';
import { UnitStatRow } from './UnitStatRow';
import { PlayerCardList, UnitCauseSummary, sortedCauses } from './PlayerCards';
import {
  type PlayerSort,
  type KillStance,
  type CauseIndex,
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
  rosterLookup,
  officerNameSet,
  playerMatches,
} from './playersModel';

const UNTAGGED_KEY = '__untagged__';
const groupKey = (team: Team, regiment: string | null) => `${team}::${regiment ?? UNTAGGED_KEY}`;

const teamTone = (t: Team) => (t === 'USA' ? 'usa' : 'csa');

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
        <UnitStatRow
          agg={agg}
          players={players.length}
          teamInflicted={teamInflicted}
          teamReceived={teamReceived}
          teamPlayers={teamPlayers}
          showStats={showStats}
        />
      </button>
      {open && (
        <>
          {showStats && (
            <UnitCauseSummary
              killedWith={unitKilledWith}
              diedTo={unitDiedTo}
              kills={agg.kills}
              deaths={agg.deaths}
            />
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
