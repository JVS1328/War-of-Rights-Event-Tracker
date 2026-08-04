/**
 * Which units were moved across to even a round out.
 *
 * A chip per unit, toned by the side it actually plays that round: click to
 * send it across, click again to send it back. The chip row shows every unit
 * at once, so the two sides can be read off it — the scrolling checkbox list
 * this replaces showed about five at a time and duplicated itself for round 2.
 */
import { useMemo } from 'react';

export type Side = 'A' | 'B';

export function BalanceSwaps({
  teamA,
  teamB,
  swapped,
  onToggle,
  teamNames,
}: {
  teamA: string[];
  teamB: string[];
  /** Units currently swapped for this round. */
  swapped: string[];
  onToggle: (unit: string, next: string[]) => void;
  teamNames: { A: string; B: string };
}) {
  const swaps = useMemo(() => new Set(swapped), [swapped]);
  const units = useMemo(
    () =>
      [
        ...teamA.map((unit) => ({ unit, home: 'A' as Side })),
        ...teamB.map((unit) => ({ unit, home: 'B' as Side })),
      ].sort((a, b) => a.unit.localeCompare(b.unit)),
    [teamA, teamB],
  );

  if (units.length === 0) return null;

  const toggle = (unit: string) => {
    const next = swaps.has(unit) ? swapped.filter((u) => u !== unit) : [...swapped, unit];
    onToggle(unit, next);
  };

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <label className="block text-sm text-text-secondary">Balance Swaps</label>
        <span className="text-xs text-text-secondary">
          {swaps.size === 0 ? 'nobody swapped' : `${swaps.size} swapped`}
        </span>
      </div>
      <div className="tgs">
        {units.map(({ unit, home }) => {
          const isSwapped = swaps.has(unit);
          const side: Side = isSwapped ? (home === 'A' ? 'B' : 'A') : home;
          return (
            <button
              key={unit}
              onClick={() => toggle(unit)}
              aria-pressed={isSwapped}
              title={
                isSwapped
                  ? `${unit} moved from ${home === 'A' ? teamNames.A : teamNames.B} to ${side === 'A' ? teamNames.A : teamNames.B} for this round — click to move it back`
                  : `${unit} plays for ${side === 'A' ? teamNames.A : teamNames.B} — click to swap it across`
              }
              className={`tg${isSwapped ? ' on' : ''}`}
              style={{
                borderColor: side === 'A' ? 'var(--union)' : 'var(--reb)',
                color: isSwapped ? undefined : side === 'A' ? 'var(--union)' : 'var(--reb)',
              }}
            >
              {isSwapped && <span>⇄</span>}
              {unit}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-text-secondary mt-1">
        Chip colour is the side the unit plays this round; ⇄ marks one that was moved across.
      </p>
    </div>
  );
}
