/**
 * The metric strip that sits in a unit's header row — kills and deaths with
 * their formation splits, k/d, kill and loss rate, ×Td / ×Tk, the unit's share
 * of its team's ticket damage, and its strength.
 *
 * Shared by the Players tab's regiment groups and the In-game units tab's
 * regiment and company rows, so a unit reads the same wherever it appears.
 */
import type { ReactNode } from 'react';
import { TicketPct } from '../drawerPrimitives';
import type { UnitAgg } from './playersModel';
import { fmtKd } from './playersModel';
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

/** `N.N` or `—` (no `×` prefix — the surrounding label supplies it). */
export function formatTicket(avg: number | null): string {
  return avg == null ? '—' : avg.toFixed(1);
}

/**
 * One metric in a unit header, stacked: label on top, value below. Keeps every
 * column in the summary aligned the same way (metric above, value below) so the
 * header reads as a clean grid instead of wrapping mid-value.
 */
export function HeaderStat({ label, value, title }: { label: string; value: ReactNode; title?: string }) {
  return (
    <span className={`flex flex-col items-start leading-tight ${title ? 'cursor-help' : ''}`} title={title}>
      <span className="text-[color:var(--color-text-2)]">{label}</span>
      <span className="tabular-nums">{value}</span>
    </span>
  );
}

/** ×Td / ×Tk on company + regiment headers, stacked (label above value). */
export function AvgT({ agg }: { agg: UnitAgg }) {
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

/** `total [in formation / skirmish / out of line]`. */
function Split({ total, inForm, skirm, oob }: { total: number; inForm: number; skirm: number; oob: number }) {
  return (
    <>
      <span className="text-[color:var(--color-text-1)]">{total}</span>
      <span className="text-[color:var(--color-text-2)]"> [</span>
      <span className="text-[color:var(--color-text-1)]">{inForm}</span>
      <span className="text-[color:var(--color-text-2)]"> / </span>
      <span className="text-[color:var(--color-text-1)]">{skirm}</span>
      <span className="text-[color:var(--color-text-2)]"> / </span>
      <span className="text-[color:var(--color-text-1)]">{oob}</span>
      <span className="text-[color:var(--color-text-2)]">]</span>
    </>
  );
}

export function UnitStatRow({
  agg,
  players,
  teamInflicted,
  teamReceived,
  teamPlayers,
  showStats = true,
  strengthOf,
}: {
  /** The whole unit's figures — never a search-narrowed subset. */
  agg: UnitAgg;
  /** Men the unit fielded, the denominator for the rates. */
  players: number;
  /** Team-wide ticket damage inflicted / received — the share denominators. */
  teamInflicted: number;
  teamReceived: number;
  /** Men the whole side fielded this round, so a unit can be sized against it. */
  teamPlayers: number;
  /** False for a bucket that isn't a real unit (untagged / unrostered men). */
  showStats?: boolean;
  /** Overrides the "of the N men this side fielded" hover — for company rows,
   *  which are sized against their regiment rather than the whole side. */
  strengthOf?: string;
}) {
  const killRate = perPlayerRate(agg.kills, players);
  const lossRate = perPlayerRate(agg.deaths, players);
  const unitInflicted = ticketDamage(agg.killInForm, agg.killSkirm, agg.killOob);
  const unitReceived = ticketDamage(agg.inForm, agg.skirm, agg.oob);
  const pctInflicted = teamInflicted > 0 ? unitInflicted / teamInflicted : null;
  const pctReceived = teamReceived > 0 ? unitReceived / teamReceived : null;
  return (
    <span className="meta" style={{ display: 'flex', gap: 13, flexWrap: 'wrap', whiteSpace: 'normal' }}>
      {showStats && (
        <>
          <HeaderStat
            label="Kills"
            title="kills: total [in formation / skirmish / out of line]"
            value={<Split total={agg.kills} inForm={agg.killInForm} skirm={agg.killSkirm} oob={agg.killOob} />}
          />
          <HeaderStat
            label="Deaths"
            title="deaths: total [in formation / skirmish / out of line]"
            value={<Split total={agg.deaths} inForm={agg.inForm} skirm={agg.skirm} oob={agg.oob} />}
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
            <span style={{ color: 'var(--ink-2)' }}>{players}</span>
            {teamPlayers > 0 && (
              <span style={{ color: 'var(--ink-3)' }}>
                {' '}({Math.round((players / teamPlayers) * 100)}%)
              </span>
            )}
          </>
        }
        title={teamPlayers > 0
          ? `${players} of the ${teamPlayers} men ${strengthOf ?? 'this side fielded'}`
          : undefined}
      />
    </span>
  );
}
