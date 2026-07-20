import { ExternalLink } from 'lucide-react';
import { Drawer, EmptyHint, Pill } from '../ui';
import type { PlayerDetail, PlayerRoundRow } from '../../stats/statsEngine';
import { Cell, CauseTable, kdStr, whenOf, teamTone } from './drawerPrimitives';
import { formatAvgT, FORMATION_LABEL, FORMATION_SHORT, AVG_TD_LABEL, AVG_TK_LABEL } from '../../stats/labels';

/** Compose an in-game identity/role line for a round: unit · rank · class. */
function roundRoleLine(r: PlayerRoundRow): string {
  const parts: string[] = [];
  if (r.regiment) parts.push(r.company ? `${r.regiment} · Co. ${r.company}` : r.regiment);
  if (r.rank) parts.push(r.rank);
  if (r.className) parts.push(r.className);
  if (r.battery) parts.push('Artillery');
  return parts.join(' · ');
}

/** Rich per-round card: in-game role + the player's full stats for that round. */
function RecentRoundCard({ r, onOpen }: { r: PlayerRoundRow; onOpen: () => void }) {
  const role = roundRoleLine(r);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left border border-[color:var(--color-border)] bg-[color:var(--color-bg-1)] p-2 hover:bg-[color:var(--color-bg-3)] focus:outline-none focus:border-[color:var(--color-accent)]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm text-[color:var(--color-text-0)]">
            {r.map}
            {r.area ? <span className="text-[color:var(--color-text-2)]"> · {r.area}</span> : ''}
          </div>
          <div className="text-2xs uppercase tracking-wider text-[color:var(--color-text-2)]">{whenOf(r.recordedAt)}</div>
        </div>
        <Pill tone={teamTone(r.team)}>{r.team}</Pill>
      </div>
      <div className="mt-1 text-xs text-[color:var(--color-text-1)]">
        {role || <span className="text-[color:var(--color-text-2)]">no roster info</span>}
      </div>
      <div className="mt-2 grid grid-cols-3 sm:grid-cols-5 gap-px">
        <Cell label="Kills" value={r.kills} />
        <Cell label="Deaths" value={r.deaths} />
        <Cell label="K/D" value={kdStr(r.kills, r.deaths)} />
        <Cell label="×Td" value={formatAvgT(r.avgTd)} title={AVG_TD_LABEL} />
        <Cell label="×Tk" value={formatAvgT(r.avgTk)} title={AVG_TK_LABEL} />
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-2 text-xs font-mono tabular-nums text-[color:var(--color-text-2)]">
        <div>
          <span className="uppercase tracking-wider">deaths </span>
          <span className="text-[color:var(--color-text-1)]">{r.deathsInForm}</span> {FORMATION_SHORT.in_form} ·{' '}
          <span className="text-[color:var(--color-text-1)]">{r.deathsSkirm}</span> {FORMATION_SHORT.skirm} ·{' '}
          <span className="text-[color:var(--color-text-1)]">{r.deathsOob}</span> {FORMATION_SHORT.oob}
        </div>
        <div>
          <span className="uppercase tracking-wider">kills </span>
          <span className="text-[color:var(--color-text-1)]">{r.killsInForm}</span> {FORMATION_SHORT.in_form} ·{' '}
          <span className="text-[color:var(--color-text-1)]">{r.killsSkirm}</span> {FORMATION_SHORT.skirm} ·{' '}
          <span className="text-[color:var(--color-text-1)]">{r.killsOob}</span> {FORMATION_SHORT.oob}
        </div>
      </div>
    </button>
  );
}

// The round (scoreboard) drawer now lives in its own tabbed module; re-exported
// here so existing imports (`./StatsDrawers`) keep working.
export { ScoreboardDrawer } from './scoreboard/ScoreboardDrawer';

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
    <div className="flex items-center gap-1 px-3 pt-3 font-mono text-xs uppercase tracking-wider">
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
              className="inline-flex items-center gap-1 text-sm text-[color:var(--color-text-2)] hover:text-[color:var(--color-accent)]"
              title="Open Steam profile in a new tab"
            >
              <ExternalLink size={11} /> Steam profile
            </a>
          )}

          {detail.aliases.length > 0 && (
            <div className="text-xs text-[color:var(--color-text-2)]">
              also known as: {detail.aliases.slice(0, 4).join(', ')}
              {detail.aliases.length > 4 && ' …'}
            </div>
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
            <div className="mb-1 text-xs uppercase tracking-wider text-[color:var(--color-text-2)]">Deaths by stance</div>
            <div className="grid grid-cols-3 gap-px">
              <Cell label={FORMATION_LABEL.in_form} value={detail.deathsInForm} />
              <Cell label={FORMATION_LABEL.skirm} value={detail.deathsSkirm} />
              <Cell label={FORMATION_LABEL.oob} value={detail.deathsOob} />
            </div>
          </div>

          <div>
            <div
              className="mb-1 text-xs uppercase tracking-wider text-[color:var(--color-text-2)] cursor-help"
              title="Kills bucketed by the formation each victim died in"
            >
              Kills by stance
            </div>
            <div className="grid grid-cols-3 gap-px">
              <Cell label={FORMATION_LABEL.in_form} value={detail.killsInForm} />
              <Cell label={FORMATION_LABEL.skirm} value={detail.killsSkirm} />
              <Cell label={FORMATION_LABEL.oob} value={detail.killsOob} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <CauseTable title="Killed with" data={detail.killsByCause} />
            <CauseTable title="Died to" data={detail.deathsByCause} />
          </div>

          {detail.perRound.length > 0 && (
            <div>
              <div className="mb-1 text-xs uppercase tracking-wider text-[color:var(--color-text-2)]">Most recent rounds</div>
              <div className="space-y-2">
                {[...detail.perRound]
                  .sort((a, b) => (b.recordedAt ?? '').localeCompare(a.recordedAt ?? ''))
                  .slice(0, 2)
                  .map((r) => (
                    <RecentRoundCard key={r.sourceFilename} r={r} onOpen={() => onOpenRound(r.sourceFilename)} />
                  ))}
              </div>
            </div>
          )}

          <div>
            <div className="mb-1 text-xs uppercase tracking-wider text-[color:var(--color-text-2)]">Per round</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[color:var(--color-border)] text-2xs uppercase tracking-wider text-[color:var(--color-text-2)]">
                  <th className="px-2 py-0.5 text-left">When</th>
                  <th className="px-2 py-0.5 text-left">Map · Area</th>
                  <th className="px-2 py-0.5 text-right">K</th>
                  <th className="px-2 py-0.5 text-right">D</th>
                  <th className="px-2 py-0.5 text-right">K/D</th>
                  <th className="px-2 py-0.5 text-right" title="In Formation / Skirmish / Out of Line deaths">
                    {FORMATION_SHORT.in_form}/{FORMATION_SHORT.skirm}/{FORMATION_SHORT.oob}
                  </th>
                  <th className="px-2 py-0.5 text-right" title={AVG_TD_LABEL}>×Td</th>
                  <th className="px-2 py-0.5 text-right" title={AVG_TK_LABEL}>×Tk</th>
                </tr>
              </thead>
              <tbody>
                {[...detail.perRound].sort((a, b) => (b.recordedAt ?? '').localeCompare(a.recordedAt ?? '')).map((r, i) => (
                  <tr
                    key={i}
                    onClick={() => onOpenRound(r.sourceFilename)}
                    className="border-b border-[color:var(--color-border)] cursor-pointer hover:bg-[color:var(--color-bg-3)]"
                  >
                    <td className="px-2 py-0.5 text-[color:var(--color-text-2)] whitespace-nowrap">{whenOf(r.recordedAt)}</td>
                    <td className="px-2 py-0.5 text-[color:var(--color-text-1)]">
                      {r.map}
                      {r.area ? ` · ${r.area}` : ''}
                    </td>
                    <td className="px-2 py-0.5 text-right tabular-nums">{r.kills}</td>
                    <td className="px-2 py-0.5 text-right tabular-nums text-[color:var(--color-text-2)]">{r.deaths}</td>
                    <td className="px-2 py-0.5 text-right tabular-nums">{kdStr(r.kills, r.deaths)}</td>
                    <td className="px-2 py-0.5 text-right tabular-nums text-[color:var(--color-text-2)]">
                      {r.deathsInForm}/{r.deathsSkirm}/{r.deathsOob}
                    </td>
                    <td className="px-2 py-0.5 text-right tabular-nums">{formatAvgT(r.avgTd)}</td>
                    <td className="px-2 py-0.5 text-right tabular-nums">{formatAvgT(r.avgTk)}</td>
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
