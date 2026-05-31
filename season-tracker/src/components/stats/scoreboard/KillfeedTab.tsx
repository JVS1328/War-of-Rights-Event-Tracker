// Killfeed tab of the round drawer. Ported from the PUBS scoreboard drawer:
// team + weapon filters over the round's kills, newest event first.
import { useMemo, useState } from 'react';
import { Pill } from '../../ui';
import type { Scoreboard, Team } from '../../../stats/types';

const teamTextColor = (t: Team | null): string =>
  t === 'USA'
    ? 'text-[color:var(--color-ok)]'
    : t === 'CSA'
      ? 'text-[color:var(--color-accent)]'
      : 'text-[color:var(--color-text-2)]';

const teamTone = (t: Team | null) => (t === 'USA' ? 'ok' : t === 'CSA' ? 'accent' : 'neutral');

export function KillfeedTab({
  sb,
  onOpenPlayer,
}: {
  sb: Scoreboard;
  onOpenPlayer: (key: string) => void;
}) {
  const [team, setTeam] = useState<'all' | Team>('all');
  const [weapon, setWeapon] = useState('');

  const weapons = useMemo(() => [...new Set(sb.kills.map((k) => k.cause))].sort(), [sb.kills]);

  // Newest first: kills arrive chronologically, so reverse for a feed.
  const filtered = useMemo(
    () =>
      [...sb.kills].reverse().filter((k) => {
        if (team !== 'all' && k.killerTeam !== team && k.victimTeam !== team) return false;
        if (weapon && k.cause !== weapon) return false;
        return true;
      }),
    [sb.kills, team, weapon],
  );

  return (
    <section className="p-2">
      <div className="flex flex-wrap items-center gap-3 px-2 mb-2 text-[10px] uppercase tracking-wider font-mono">
        <span className="text-[color:var(--color-text-2)]">team</span>
        {(['all', 'USA', 'CSA'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTeam(t)}
            className={
              team === t
                ? 'text-[color:var(--color-accent)]'
                : 'text-[color:var(--color-text-2)] hover:text-[color:var(--color-text-1)]'
            }
          >
            {t}
          </button>
        ))}
        <span className="text-[color:var(--color-text-2)] ml-3">weapon</span>
        <select
          value={weapon}
          onChange={(e) => setWeapon(e.target.value)}
          className="bg-[color:var(--color-bg-1)] border border-[color:var(--color-border)] px-1 py-0.5 text-[11px] font-mono text-[color:var(--color-text-0)] focus:outline-none focus:border-[color:var(--color-accent)]"
        >
          <option value="">all</option>
          {weapons.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
        <span className="text-[color:var(--color-text-2)] ml-auto">{filtered.length} events</span>
      </div>
      <div className="px-3 pb-2 text-[10px] font-mono text-[color:var(--color-text-2)] italic">
        timestamps are in-round time as written by the game.
      </div>
      {filtered.length === 0 ? (
        <div className="px-3 py-6 text-center text-[10px] text-[color:var(--color-text-2)] font-mono uppercase tracking-wider">
          no killfeed events
        </div>
      ) : (
        <ul className="divide-y divide-[color:var(--color-border)]">
          {filtered.map((k, i) => (
            <li key={`${k.tsInRound}-${i}`} className="py-1 flex items-start gap-2 font-mono px-3">
              <span className="text-[10px] text-[color:var(--color-text-2)] tabular-nums w-16 shrink-0">{k.tsInRound}</span>
              <Pill tone={teamTone(k.killerTeam)}>{k.cause}</Pill>
              <span className="text-[color:var(--color-text-1)] break-words flex-1">
                {k.killer ? (
                  <button
                    onClick={() => onOpenPlayer(k.killerSteamId ?? k.killer!)}
                    className={`${teamTextColor(k.killerTeam)} hover:underline`}
                  >
                    {k.killer}
                  </button>
                ) : (
                  <span className="text-[color:var(--color-text-2)]">(environment)</span>
                )}
                <span className="text-[color:var(--color-text-2)] mx-1">→</span>
                <button
                  onClick={() => onOpenPlayer(k.victimSteamId ?? k.victim)}
                  className={`${teamTextColor(k.victimTeam)} hover:underline`}
                >
                  {k.victim}
                </button>
                {k.victimFormation && (
                  <span className="text-[color:var(--color-text-2)] ml-2 text-[10px]">· {k.victimFormation}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
