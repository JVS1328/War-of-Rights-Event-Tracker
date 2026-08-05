// Killfeed tab of the round drawer. Ported from the PUBS scoreboard drawer:
// team + weapon filters over the round's kills, newest event first.
import { useEffect, useMemo, useState } from 'react';
import { Pill } from '../../ui';
import type { Scoreboard, Team } from '../../../stats/types';

const teamTextColor = (t: Team | null): string =>
  t === 'USA'
    ? 'text-[color:var(--color-ok)]'
    : t === 'CSA'
      ? 'text-[color:var(--color-accent)]'
      : 'text-[color:var(--color-text-2)]';

const teamTone = (t: Team | null) => (t === 'USA' ? 'usa' : t === 'CSA' ? 'csa' : 'neutral');

/** Events a page. Enough to read a stretch of the round without scrolling far. */
const PAGE = 60;

export function KillfeedTab({
  sb,
  onOpenPlayer,
}: {
  sb: Scoreboard;
  onOpenPlayer: (key: string) => void;
}) {
  const [team, setTeam] = useState<'all' | Team>('all');
  const [weapon, setWeapon] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);

  const weapons = useMemo(() => [...new Set(sb.kills.map((k) => k.cause))].sort(), [sb.kills]);

  // Newest first: kills arrive chronologically, so reverse for a feed.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...sb.kills].reverse().filter((k) => {
      if (team !== 'all' && k.killerTeam !== team && k.victimTeam !== team) return false;
      if (weapon && k.cause !== weapon) return false;
      if (q && !(k.killer ?? '').toLowerCase().includes(q) && !k.victim.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [sb.kills, team, weapon, query]);

  // A busy round is a couple of thousand events; rendering them all is slow to
  // paint and impossible to read. Any filter change starts again from the top,
  // since page 7 of the old result set means nothing in the new one.
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE));
  const current = Math.min(page, pageCount - 1);
  const offset = current * PAGE;
  const shown = filtered.slice(offset, offset + PAGE);
  useEffect(() => { setPage(0); }, [team, weapon, query]);

  return (
    <section>
      <div className="ctl">
        <span className="cap">Team</span>
        <div className="seg">
          {(['all', 'USA', 'CSA'] as const).map((t) => (
            <button key={t} onClick={() => setTeam(t)} aria-pressed={team === t}>{t}</button>
          ))}
        </div>
        <span className="cap">Weapon</span>
        <select value={weapon} onChange={(e) => setWeapon(e.target.value)}>
          <option value="">all</option>
          {weapons.map((w) => (
            <option key={w} value={w}>{w}</option>
          ))}
        </select>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="killer or victim"
        />
        <span className="rule" />
        <span className="meta">{filtered.length} events</span>
      </div>
      <p className="note" style={{ padding: '9px 13px 0' }}>
        Timestamps are in-round time, as the game wrote them.
      </p>
      {filtered.length === 0 ? (
        <p className="note" style={{ padding: 13 }}>No killfeed events.</p>
      ) : (
        <>
        <ul className="divide-y divide-[color:var(--color-border)]">
          {shown.map((k, i) => (
            <li key={`${k.tsInRound}-${offset + i}`} className="kf">
              <span className="text-xs text-[color:var(--color-text-2)] tabular-nums w-16 shrink-0">{k.tsInRound}</span>
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
                  <span className="text-[color:var(--color-text-2)] ml-2 text-xs">· {k.victimFormation}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
        {pageCount > 1 && (
          <div className="pager" style={{ margin: '0 13px 13px' }}>
            <span>{offset + 1}–{offset + shown.length} of {filtered.length}</span>
            <span className="pg">
              <button onClick={() => setPage(0)} disabled={current === 0} aria-label="First page">«</button>
              <button onClick={() => setPage(current - 1)} disabled={current === 0} aria-label="Previous page">‹</button>
              <span>{current + 1}/{pageCount}</span>
              <button
                onClick={() => setPage(current + 1)}
                disabled={current >= pageCount - 1}
                aria-label="Next page"
              >
                ›
              </button>
              <button
                onClick={() => setPage(pageCount - 1)}
                disabled={current >= pageCount - 1}
                aria-label="Last page"
              >
                »
              </button>
            </span>
          </div>
        )}
        </>
      )}
    </section>
  );
}
