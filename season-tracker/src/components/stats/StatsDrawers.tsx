import { ExternalLink } from 'lucide-react';
import { Drawer, EmptyHint } from '../ui';
import type { PlayerDetail } from '../../stats/statsEngine';
import { Cell, CauseTable, kdStr, whenOf } from './drawerPrimitives';
import { formatAvgT, FORMATION_LABEL, FORMATION_SHORT, AVG_TD_LABEL, AVG_TK_LABEL } from '../../stats/labels';

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
                {detail.perRound.map((r, i) => (
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
