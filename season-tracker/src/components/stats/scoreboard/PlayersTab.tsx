// Players tab of the round drawer. Faithful port of the PUBS scoreboard
// drawer's player view: sort + search, USA/CSA team blocks, regiment→company
// unit grouping with per-unit k/d + ×Td/×Tk + formation deaths, stacked player
// cards with ★ officer markers. Falls back to a flat list when no roster.
import { useMemo, useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { Pill } from '../../ui';
import type { Scoreboard, ScoreboardPlayer, RosterEntry, Team } from '../../../stats/types';
import { avgTicketCost, AVG_TD_LABEL, AVG_TK_LABEL } from '../../../stats/labels';
import { extractRegimentTag, UNTAGGED } from '../../../stats/regimentMatcher';
import {
  type PlayerSort,
  type KillStance,
  type UnitAgg,
  type RegimentGroupModel,
  type RegimentResolver,
  buildRosterIndex,
  buildKillStanceIndex,
  killStanceOf,
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

const teamTone = (t: Team) => (t === 'USA' ? 'ok' : 'accent');

/** `×N.N` or `—` (no `×` prefix — the surrounding label supplies it). */
function formatTicket(avg: number | null): string {
  return avg == null ? '—' : avg.toFixed(1);
}

/** Name-tag fallback when no season resolver is supplied. */
const tagResolver: RegimentResolver = (_steamId, name) => {
  const t = extractRegimentTag(name);
  return t === UNTAGGED ? null : t;
};

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

  const officers = useMemo(() => officerNameSet(sb.officers), [sb.officers]);
  const isOfficer = (name: string) => officers.has(name.trim().toLowerCase());

  const rosterIndex = useMemo(() => buildRosterIndex(sb.roster), [sb.roster]);
  const lookup = (p: ScoreboardPlayer) => rosterLookup(rosterIndex, p);

  const resolve = resolveRegiment ?? tagResolver;

  const killIndex = useMemo(() => buildKillStanceIndex(sb.kills), [sb.kills]);
  const killStance = (p: ScoreboardPlayer): KillStance => killStanceOf(p, killIndex);

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
    <section className="p-2">
      <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-wider font-mono mb-2 px-2">
        <span className="text-[color:var(--color-text-2)]">sort</span>
        {(['unit', 'name', 'kills', 'deaths', 'kd'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSortBy(s)}
            className={
              sortBy === s
                ? 'text-[color:var(--color-accent)]'
                : 'text-[color:var(--color-text-2)] hover:text-[color:var(--color-text-1)]'
            }
          >
            {s}
          </button>
        ))}
        <input
          type="text"
          placeholder="search player…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-3 bg-[color:var(--color-bg-1)] border border-[color:var(--color-border)] px-1.5 py-0.5 text-sm font-mono text-[color:var(--color-text-0)] focus:outline-none focus:border-[color:var(--color-accent)] normal-case tracking-normal w-32"
        />
        <span className="text-[color:var(--color-text-2)] ml-auto">★ = officer</span>
      </div>
      {allEmpty && searchTrimmed ? (
        <div className="px-3 py-6 text-center text-xs text-[color:var(--color-text-2)] font-mono uppercase tracking-wider">
          no players match "{searchTrimmed}"
        </div>
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
              sortBy={sortBy}
              showUnitGroups={showUnitGroups}
              search={search}
              openGroups={openGroups}
              onToggleGroup={toggleGroup}
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
  sortBy,
  showUnitGroups,
  search,
  openGroups,
  onToggleGroup,
  onOpenPlayer,
}: {
  team: Team;
  rows: ScoreboardPlayer[];
  isOfficer: (name: string) => boolean;
  lookup: (p: ScoreboardPlayer) => RosterEntry | undefined;
  resolve: RegimentResolver;
  killStance: (p: ScoreboardPlayer) => KillStance;
  sortBy: PlayerSort;
  showUnitGroups: boolean;
  search: string;
  openGroups: Set<string>;
  onToggleGroup: (key: string) => void;
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
  if (rows.length === 0) return null;
  if (searching && visible.length === 0) return null;

  const totals = visible.reduce(
    (acc, p) => ({ kills: acc.kills + p.kills, deaths: acc.deaths + p.deaths }),
    { kills: 0, deaths: 0 },
  );

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between px-2 py-1 bg-[color:var(--color-bg-2)] border-y border-[color:var(--color-border)]">
        <span className="flex items-center gap-2">
          <Pill tone={teamTone(team)}>{team}</Pill>
          <span className="text-xs text-[color:var(--color-text-2)] font-mono uppercase tracking-wider">
            {visible.length} player{visible.length === 1 ? '' : 's'}
          </span>
        </span>
        <span className="text-xs font-mono tabular-nums text-[color:var(--color-text-2)] uppercase tracking-wider">
          team total · {totals.kills} kills · {totals.deaths} deaths
        </span>
      </div>
      {showUnitGroups ? (
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
          onOpenPlayer={onOpenPlayer}
        />
      )}
    </div>
  );
}

/** ×Td / ×Tk on company + regiment headers. */
function AvgT({ agg }: { agg: UnitAgg }) {
  const td = avgTicketCost(agg.inForm, agg.skirm, agg.oob);
  const tk = avgTicketCost(agg.killInForm, agg.killSkirm, agg.killOob);
  return (
    <>
      <span title={AVG_TD_LABEL} className="cursor-help">
        <span className="text-[color:var(--color-text-2)]">×Td </span>
        <span className="text-[color:var(--color-text-0)]">{formatTicket(td)}</span>
      </span>
      <span title={AVG_TK_LABEL} className="cursor-help ml-2">
        <span className="text-[color:var(--color-text-2)]">×Tk </span>
        <span className="text-[color:var(--color-text-0)]">{formatTicket(tk)}</span>
      </span>
    </>
  );
}

/** `form / skirm / ool` death breakdown for company + regiment headers. */
function FormationDeaths({ agg }: { agg: UnitAgg }) {
  return (
    <span title="deaths: in formation · skirmish · out of line">
      <span className="text-[color:var(--color-text-2)]">d </span>
      <span className="text-[color:var(--color-text-1)]">{agg.inForm}</span>
      <span className="text-[color:var(--color-text-2)]"> / </span>
      <span className="text-[color:var(--color-text-1)]">{agg.skirm}</span>
      <span className="text-[color:var(--color-text-2)]"> / </span>
      <span className="text-[color:var(--color-text-1)]">{agg.oob}</span>
    </span>
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
  onOpenPlayer: (key: string) => void;
}) {
  const { regiment, players } = group;
  // Stats always roll up the whole regiment, even when search narrows the list.
  const agg = sumKD(players, killStance);
  // Untagged players aren't a real unit — skip the k/d rollup.
  const showStats = regiment != null;
  const Chevron = open ? ChevronDown : ChevronRight;
  return (
    <div className="border-t border-[color:var(--color-border)]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full px-3 py-1 bg-[color:var(--color-bg-1)] text-xs uppercase tracking-wider font-mono flex justify-between items-center gap-3 flex-wrap text-left hover:bg-[color:var(--color-bg-2)]"
      >
        <span className="flex items-center gap-1 text-[color:var(--color-text-0)]">
          <Chevron size={11} className="shrink-0 text-[color:var(--color-text-2)]" />
          {regiment ?? 'Untagged'}
        </span>
        <span className="flex items-center gap-3 text-[color:var(--color-text-2)] tabular-nums">
          {showStats && (
            <>
              <span>
                <span className="text-[color:var(--color-text-2)]">k </span>
                <span className="text-[color:var(--color-text-1)]">{agg.kills}</span>
              </span>
              <span>
                <span className="text-[color:var(--color-text-2)]">d </span>
                <span className="text-[color:var(--color-text-1)]">{agg.deaths}</span>
              </span>
              <FormationDeaths agg={agg} />
              <span>
                <span className="text-[color:var(--color-text-2)]">k/d </span>
                <span className="text-[color:var(--color-text-0)]">{fmtKd(agg.kills, agg.deaths)}</span>
              </span>
              <AvgT agg={agg} />
            </>
          )}
          <span>{players.length}</span>
        </span>
      </button>
      {open && (
        <PlayerCardList
          rows={visiblePlayers.slice().sort((a, b) => a.name.localeCompare(b.name))}
          isOfficer={isOfficer}
          lookup={lookup}
          killStance={killStance}
          onOpenPlayer={onOpenPlayer}
        />
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
  onOpenPlayer,
  indent = false,
}: {
  rows: ScoreboardPlayer[];
  isOfficer: (name: string) => boolean;
  lookup: (p: ScoreboardPlayer) => RosterEntry | undefined;
  killStance: (p: ScoreboardPlayer) => KillStance;
  onOpenPlayer: (key: string) => void;
  indent?: boolean;
}) {
  return (
    <ul>
      {rows.map((p) => {
        const r = lookup(p);
        const role = [r?.rank, r?.className].filter(Boolean).join(' ').trim();
        const ks = killStance(p);
        return (
          <li
            key={playerKey(p)}
            className={`border-t border-[color:var(--color-border)] py-2 ${indent ? 'pl-6 pr-3' : 'px-3'}`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="flex items-center gap-1 min-w-0">
                {isOfficer(p.name) && (
                  <span className="text-[color:var(--color-warn)] text-xs shrink-0" title="officer">
                    ★
                  </span>
                )}
                <button
                  onClick={() => onOpenPlayer(playerKey(p))}
                  className="truncate text-left text-[color:var(--color-text-0)] hover:text-[color:var(--color-accent)]"
                >
                  {p.name}
                </button>
              </span>
              <span className="font-mono tabular-nums text-xs uppercase tracking-wider text-[color:var(--color-text-2)] shrink-0 flex gap-2">
                <span>
                  <span>K/D </span>
                  <span className="text-[color:var(--color-text-0)]">{p.kd.toFixed(2)}</span>
                </span>
                <span title={AVG_TD_LABEL} className="cursor-help">
                  <span>×Td </span>
                  <span className="text-[color:var(--color-text-0)]">
                    {formatTicket(avgTicketCost(p.deathsInForm, p.deathsSkirm, p.deathsOob))}
                  </span>
                </span>
                <span title={AVG_TK_LABEL} className="cursor-help">
                  <span>×Tk </span>
                  <span className="text-[color:var(--color-text-0)]">
                    {formatTicket(avgTicketCost(ks.inForm, ks.skirm, ks.oob))}
                  </span>
                </span>
              </span>
            </div>
            {role && <div className="text-xs font-mono text-[color:var(--color-text-2)] mt-0.5">{role}</div>}
            <div className="text-sm font-mono tabular-nums text-[color:var(--color-text-1)] mt-0.5">
              {p.kills} kills · {p.deaths} deaths
            </div>
            <div className="text-xs font-mono tabular-nums text-[color:var(--color-text-2)] mt-0.5">
              <span>d: </span>
              <span className="text-[color:var(--color-text-1)]">{p.deathsInForm}</span>
              <span> form · </span>
              <span className="text-[color:var(--color-text-1)]">{p.deathsSkirm}</span>
              <span> skirm · </span>
              <span className="text-[color:var(--color-text-1)]">{p.deathsOob}</span>
              <span> ool</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
