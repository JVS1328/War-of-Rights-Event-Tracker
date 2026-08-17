/**
 * In-game units tab of the round screen: the round's order of battle, as War of
 * Rights recorded it — Team → regiment → company → the men.
 *
 * The Players tab answers "how did each competing unit do?"; this one answers
 * "how did each in-game formation do?". A regiment row carries that regiment's
 * cumulative figures for the round, a company row its own, and every level
 * collapses. Everything but the team blocks starts closed, so a round opens as a
 * one-line-per-regiment order of battle you can drill into.
 *
 * A company is everyone who served in it during the round, not whoever happened
 * to be standing in it at the end, so a man who moved company appears under both
 * — see `inGameUnitsModel` for how his figures are divided between them.
 */
import { useMemo, useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { Pill } from '../../ui';
import type { Scoreboard, ScoreboardPlayer, RosterEntry, Team } from '../../../stats/types';
import { fmtDuration } from '../drawerPrimitives';
import { UnitStatRow, HeaderStat, AvgT } from './UnitStatRow';
import { PlayerCardList, UnitCauseSummary, sortedCauses, type PlayerCardSlice } from './PlayerCards';
import {
  type KillStance,
  type CauseIndex,
  buildRosterIndex,
  buildKillStanceIndex,
  buildCauseIndex,
  killStanceOf,
  killedWithOf,
  diedToOf,
  sumCauses,
  rosterLookup,
  officerNameSet,
  fmtKd,
} from './playersModel';
import {
  type InGameTeamNode,
  type InGameRegimentNode,
  type CompanyNode,
  type UnitMember,
  buildInGameUnits,
  filterInGameUnits,
  allUnitKeys,
  distinctMen,
  regimentNodeKey,
  companyNodeKey,
} from './inGameUnitsModel';

const teamTone = (t: Team) => (t === 'USA' ? 'usa' : 'csa');

const byName = (a: UnitMember, b: UnitMember) => a.player.name.localeCompare(b.player.name);

/** Rounds to one decimal, dropping a trailing ".0" — 28.4, but 21 not 21.0. */
const trim1 = (n: number) => (Math.round(n * 10) / 10).toString();

/** How the rate denominators are explained wherever they aren't a head count. */
const MAN_ROUNDS_NOTE =
  'here the denominator is man-rounds, not heads: a man who served a third of the round counts a third, so a unit that cycled men through is not read as a weak one';

export function UnitsTab({
  sb,
  onOpenPlayer,
}: {
  sb: Scoreboard;
  onOpenPlayer: (key: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [collapsedTeams, setCollapsedTeams] = useState<Set<Team>>(new Set());
  // Open regiments / companies. Empty = everything closed, so the tab opens on
  // the order of battle rather than on every man in the round.
  const [openRegs, setOpenRegs] = useState<Set<string>>(new Set());
  const [openCos, setOpenCos] = useState<Set<string>>(new Set());

  const officers = useMemo(() => officerNameSet(sb.officers), [sb.officers]);
  const isOfficer = (name: string) => officers.has(name.trim().toLowerCase());

  const rosterIndex = useMemo(() => buildRosterIndex(sb.roster), [sb.roster]);
  const lookup = (p: ScoreboardPlayer) => rosterLookup(rosterIndex, p);

  const killIndex = useMemo(() => buildKillStanceIndex(sb.kills), [sb.kills]);
  const killStance = (p: ScoreboardPlayer): KillStance => killStanceOf(p, killIndex);
  const causeIndex = useMemo(() => buildCauseIndex(sb.kills), [sb.kills]);

  // Built off the kill-stance index rather than the `killStance` closure, which
  // is new every render and would rebuild the whole tree with it.
  const oob = useMemo(
    () => buildInGameUnits(
      sb.players,
      sb.roster,
      sb.service ?? [],
      sb.officers,
      (p) => killStanceOf(p, killIndex),
      sb.meta.roundDurationS,
    ),
    [sb.players, sb.roster, sb.service, sb.officers, killIndex, sb.meta.roundDurationS],
  );
  const searching = search.trim().length > 0;
  const shown = useMemo(() => filterInGameUnits(oob.teams, search), [oob.teams, search]);

  const toggle = (set: Set<string>, key: string) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  };
  const toggleTeam = (team: Team) =>
    setCollapsedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(team)) next.delete(team);
      else next.add(team);
      return next;
    });
  const expandAll = () => {
    const keys = allUnitKeys(oob.teams);
    setOpenRegs(new Set(keys.regiments));
    setOpenCos(new Set(keys.companies));
    setCollapsedTeams(new Set());
  };
  const collapseAll = () => {
    setOpenRegs(new Set());
    setOpenCos(new Set());
  };

  return (
    <section>
      <div className="ctl">
        <input
          type="search"
          placeholder="regiment, company, name or steam id"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="gh" onClick={expandAll}>expand all</button>
        <button className="gh" onClick={collapseAll}>collapse all</button>
        <span className="rule" />
        <span className="meta">
          {oob.source === 'service'
            ? 'the game\'s own units · everyone who served, not just who finished'
            : 'the game\'s own units · unit as of round end'}
          {' · ★ = officer'}
        </span>
      </div>
      {oob.source === 'roster' && (
        <p className="note" style={{ padding: '7px 13px' }}>
          This scoreboard predates the overlay's service log, so a man shows only under the unit
          he ended the round in. Rounds imported since carry every posting a man held.
        </p>
      )}
      {oob.source === 'service' && oob.splitMen > 0 && (
        <p className="note" style={{ padding: '7px 13px' }}>
          {oob.splitMen} {oob.splitMen === 1 ? 'man' : 'men'} served in more than one unit this
          round and {oob.splitMen === 1 ? 'appears' : 'appear'} under each. The scoreboard records
          kills and deaths for the round, never for the company a man held at the time, so
          {oob.splitMen === 1 ? ' his' : ' their'} figures are divided between postings in
          proportion to the time served in each — an apportionment, not a record.
        </p>
      )}
      {oob.source === 'none' ? (
        <p className="note" style={{ padding: 13 }}>
          This scoreboard carries no roster or service log, so the game's units are unknown. The
          Players tab still groups the round by competing unit.
        </p>
      ) : shown.length === 0 ? (
        <p className="note" style={{ padding: 13 }}>No units or men match "{search.trim()}".</p>
      ) : (
        shown.map((team) => (
          <TeamBlock
            key={team.team}
            node={team}
            collapsed={collapsedTeams.has(team.team)}
            onToggleTeam={() => toggleTeam(team.team)}
            searching={searching}
            openRegs={openRegs}
            openCos={openCos}
            onToggleReg={(k) => setOpenRegs((prev) => toggle(prev, k))}
            onToggleCo={(k) => setOpenCos((prev) => toggle(prev, k))}
            isOfficer={isOfficer}
            lookup={lookup}
            killStance={killStance}
            causeIndex={causeIndex}
            onOpenPlayer={onOpenPlayer}
          />
        ))
      )}
    </section>
  );
}

interface RowProps {
  searching: boolean;
  openRegs: Set<string>;
  openCos: Set<string>;
  onToggleReg: (key: string) => void;
  onToggleCo: (key: string) => void;
  isOfficer: (name: string) => boolean;
  lookup: (p: ScoreboardPlayer) => RosterEntry | undefined;
  killStance: (p: ScoreboardPlayer) => KillStance;
  causeIndex: CauseIndex;
  onOpenPlayer: (key: string) => void;
}

function TeamBlock({
  node,
  collapsed,
  onToggleTeam,
  ...rest
}: RowProps & {
  node: InGameTeamNode;
  /** Whole faction hidden — only its header row (strength + totals) renders. */
  collapsed: boolean;
  onToggleTeam: () => void;
}) {
  const { team, agg, regiments } = node;
  // Real formations only — the Unenlisted pool and the unrostered aren't units.
  const unitCount = regiments.filter((r) => !r.flat).length;
  // A search narrows what is listed, so the line says how much of the side that
  // is. The figures beside it stay the side's own either way — they are what
  // every unit's share is measured against.
  const regLine = `${unitCount} regiment${unitCount === 1 ? '' : 's'}${rest.searching ? ' matched' : ''}`;
  const strength = rest.searching
    ? `${regLine} · ${distinctMen(node.visible)} of ${node.served} men`
    : `${regLine} · ${node.served} men`;
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
        <span className="meta" title={`${node.served} men served this side · ${node.atEnd} were still on it at the end`}>
          {strength}
        </span>
        <span className="rule" />
        <span
          className="meta"
          style={{ display: 'flex', gap: 13, flexWrap: 'wrap', whiteSpace: 'normal' }}
          title="the side's own figures for the round"
        >
          <HeaderStat label="Kills" value={<span className="text-[color:var(--color-text-0)]">{agg.kills}</span>} />
          <HeaderStat label="Deaths" value={<span className="text-[color:var(--color-text-0)]">{agg.deaths}</span>} />
          <HeaderStat
            label="k/d"
            value={<span className="text-[color:var(--color-text-0)]">{fmtKd(agg.kills, agg.deaths)}</span>}
          />
          <AvgT agg={agg} />
        </span>
      </button>
      {!collapsed && regiments.map((reg) => (
        <RegimentRow key={reg.key} team={node} reg={reg} {...rest} />
      ))}
    </div>
  );
}

function RegimentRow({
  team,
  reg,
  ...rest
}: RowProps & { team: InGameTeamNode; reg: InGameRegimentNode }) {
  const { searching, openRegs, onToggleReg, causeIndex } = rest;
  const key = regimentNodeKey(team.team, reg);
  const open = searching || openRegs.has(key);
  // A bucket that isn't a real formation — the unrostered — gets no rollup.
  const showStats = reg.regiment != null;
  const killedWith = sortedCauses(sumCauses(reg.members.map((m) => killedWithOf(m.player, causeIndex))));
  const diedTo = sortedCauses(sumCauses(reg.members.map((m) => diedToOf(m.player, causeIndex))));
  const Chevron = open ? ChevronDown : ChevronRight;
  return (
    <div style={{ borderTop: '1px solid var(--line)' }}>
      <button
        type="button"
        onClick={() => onToggleReg(key)}
        aria-expanded={open}
        className="ph area-h"
        style={{ width: '100%', textAlign: 'left', background: 'var(--surface)' }}
      >
        <Chevron size={11} style={{ flex: 'none', color: 'var(--ink-3)' }} />
        <span className="wor-name">{reg.label}</span>
        {showStats && !reg.flat && (
          <>
            <Pill>{reg.branch}</Pill>
            {/* A search leaves only the companies it matched, which is not the
                regiment's own strength — so the count sits out until it is. */}
            {!searching && (
              <span className="meta">
                {reg.companies.length} co{reg.companies.length === 1 ? '' : 's'}
              </span>
            )}
          </>
        )}
        <span className="rule" />
        <UnitStatRow
          agg={reg.agg}
          players={reg.served}
          teamInflicted={team.ticketInflicted}
          teamReceived={team.ticketReceived}
          teamPlayers={team.served}
          showStats={showStats}
          rateDenominator={reg.strength}
          rateNote={MAN_ROUNDS_NOTE}
          playersTitle={strengthTitle(reg, `${team.served} men served this side`)}
        />
      </button>
      {open && (
        <>
          {showStats && (
            <UnitCauseSummary
              killedWith={killedWith}
              diedTo={diedTo}
              kills={reg.agg.kills}
              deaths={reg.agg.deaths}
            />
          )}
          {reg.flat ? (
            <MemberList members={reg.visible} {...rest} />
          ) : (
            reg.companies.map((co) => (
              <CompanyRow key={co.key} team={team} reg={reg} co={co} {...rest} />
            ))
          )}
        </>
      )}
    </div>
  );
}

function CompanyRow({
  team,
  reg,
  co,
  ...rest
}: RowProps & { team: InGameTeamNode; reg: InGameRegimentNode; co: CompanyNode }) {
  const { searching, openCos, onToggleCo, causeIndex } = rest;
  const key = companyNodeKey(team.team, co);
  const open = searching || openCos.has(key);
  const killedWith = sortedCauses(sumCauses(co.members.map((m) => killedWithOf(m.player, causeIndex))));
  const diedTo = sortedCauses(sumCauses(co.members.map((m) => diedToOf(m.player, causeIndex))));
  const Chevron = open ? ChevronDown : ChevronRight;
  return (
    <div style={{ borderTop: '1px solid var(--line)' }}>
      <button
        type="button"
        onClick={() => onToggleCo(key)}
        aria-expanded={open}
        className="ph area-h"
        style={{ width: '100%', textAlign: 'left', paddingLeft: 26 }}
      >
        <Chevron size={10} style={{ flex: 'none', color: 'var(--ink-3)' }} />
        <span className="wor-name">{co.label}</span>
        {co.officers.length > 0 && (
          <span className="meta" title="held this company's officer slot">
            ★{' '}
            {co.officers.map((o, i) => (
              <span key={o.name}>
                {i > 0 && ' · '}
                {o.rank ? `${o.rank} ` : ''}
                {/* Names opt out of the button rule's uppercasing. */}
                <span className="wor-name">{o.name}</span>
              </span>
            ))}
          </span>
        )}
        <span className="rule" />
        {/* Ticket shares stay against the TEAM — a company's contribution to the
            side's damage is the comparable figure — while strength is read
            against its own regiment. */}
        <UnitStatRow
          agg={co.agg}
          players={co.served}
          teamInflicted={team.ticketInflicted}
          teamReceived={team.ticketReceived}
          teamPlayers={reg.served}
          rateDenominator={co.strength}
          rateNote={MAN_ROUNDS_NOTE}
          playersTitle={strengthTitle(co, `${reg.served} served the ${reg.label}`)}
        />
      </button>
      {open && (
        <>
          <UnitCauseSummary
            killedWith={killedWith}
            diedTo={diedTo}
            kills={co.agg.kills}
            deaths={co.agg.deaths}
            indent
          />
          <MemberList members={co.visible} indent {...rest} />
        </>
      )}
    </div>
  );
}

/**
 * How a unit's strength reads on hover: who passed through, who was left at the
 * end, and the man-rounds behind the rates. The three differ exactly when men
 * came and went, which is the thing worth seeing.
 */
function strengthTitle(
  unit: { served: number; atEnd: number; strength: number },
  within: string,
): string {
  return [
    `${unit.served} men served here`,
    `${unit.atEnd} were still here at the end`,
    `${trim1(unit.strength)} man-rounds of strength`,
    within,
  ].join(' · ');
}

/** A unit's men, each read as that unit knew him rather than as the round did. */
function MemberList({
  members,
  indent = false,
  isOfficer,
  lookup,
  killStance,
  causeIndex,
  onOpenPlayer,
}: Omit<RowProps, 'searching' | 'openRegs' | 'openCos' | 'onToggleReg' | 'onToggleCo'> & {
  members: UnitMember[];
  indent?: boolean;
}) {
  const rows = members.slice().sort(byName);
  const slices = new Map<ScoreboardPlayer, PlayerCardSlice>();
  for (const m of rows) slices.set(m.player, sliceOfMember(m));
  return (
    <PlayerCardList
      rows={rows.map((m) => m.player)}
      isOfficer={isOfficer}
      lookup={lookup}
      killStance={killStance}
      causeIndex={causeIndex}
      onOpenPlayer={onOpenPlayer}
      indent={indent}
      sliceOf={(p) => slices.get(p)}
    />
  );
}

/** One man's card in one unit: the posting's identity, time and figures. */
function sliceOfMember(m: UnitMember): PlayerCardSlice {
  const { posting } = m;
  const time: string[] = [];
  if (posting.durationS != null) time.push(fmtDuration(posting.durationS));
  if (posting.roundShare != null) time.push(`${Math.round(posting.roundShare * 100)}% of the round`);
  if (posting.stints > 1) time.push(`${posting.stints} stints`);
  if (m.split) {
    time.push(`${m.agg.kills} of his ${m.roundKills} kills and ${m.agg.deaths} of his ${m.roundDeaths} deaths`);
  }
  return {
    agg: m.agg,
    entry: {
      team: posting.team,
      regiment: posting.regiment,
      company: posting.company,
      name: m.player.name,
      className: posting.className,
      rank: posting.rank,
      steamId: m.player.steamId,
    },
    note: time.length ? time.join(' · ') : null,
    split: m.split,
  };
}
