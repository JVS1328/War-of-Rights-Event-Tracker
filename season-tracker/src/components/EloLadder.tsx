/**
 * The season's Elo ladder, with each unit's rating drawn across the season.
 *
 * The standings show a rating and this week's change; this shows the shape —
 * a unit that climbed steadily and one that spiked and gave it back have the
 * same final number and very different seasons.
 */
import { sparklinePoints, formatChange, type EloLadderRow } from '../utils/eloLadder';

const SPARK_W = 96;
const SPARK_H = 22;

export function EloLadder({ rows, weeksLabel }: { rows: EloLadderRow[]; weeksLabel?: string }) {
  if (rows.length === 0) {
    return <p className="text-sm text-text-secondary">No units to rank yet.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-text-secondary">
            <th className="text-left py-1 pr-2 w-8">#</th>
            <th className="text-left py-1">Unit</th>
            <th className="text-right py-1 px-2">Elo</th>
            <th className="text-right py-1 px-2" title="Change from the starting rating">Season</th>
            <th className="text-right py-1 px-2" title="Highest and lowest the rating has been">Peak / Low</th>
            <th className="text-right py-1 px-2">Rounds</th>
            <th className="text-right py-1 pl-2">{weeksLabel ?? 'Across the season'}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const up = r.change > 0;
            const flat = r.change === 0;
            const stroke = flat ? 'var(--color-text-2, #888)' : up ? '#22c55e' : '#ef4444';
            return (
              <tr key={r.unit} className="border-t border-border-default">
                <td className="py-1 pr-2 text-text-secondary tabular-nums">{r.rank}</td>
                <td className="py-1">
                  <span className="text-text-primary">{r.unit}</span>
                  {r.provisional && (
                    <span
                      className="ml-1.5 text-[10px] uppercase tracking-wider text-text-secondary"
                      title={`Still provisional — ${r.rounds} rounds played`}
                    >
                      prov
                    </span>
                  )}
                  {r.rankChange !== null && r.rankChange !== 0 && (
                    <span
                      className={`ml-1.5 text-[10px] tabular-nums ${r.rankChange > 0 ? 'text-green-500' : 'text-red-500'}`}
                      title={`${Math.abs(r.rankChange)} place${Math.abs(r.rankChange) === 1 ? '' : 's'} ${r.rankChange > 0 ? 'gained' : 'lost'} since last week`}
                    >
                      {r.rankChange > 0 ? '▲' : '▼'}
                      {Math.abs(r.rankChange)}
                    </span>
                  )}
                </td>
                <td className="py-1 px-2 text-right tabular-nums text-text-primary">{Math.round(r.elo)}</td>
                <td
                  className={`py-1 px-2 text-right tabular-nums ${flat ? 'text-text-secondary' : up ? 'text-green-500' : 'text-red-500'}`}
                >
                  {formatChange(r.change)}
                </td>
                <td className="py-1 px-2 text-right tabular-nums text-text-secondary">
                  {Math.round(r.peak)} / {Math.round(r.trough)}
                </td>
                <td className="py-1 px-2 text-right tabular-nums text-text-secondary">{r.rounds}</td>
                <td className="py-1 pl-2 text-right">
                  <svg
                    width={SPARK_W}
                    height={SPARK_H}
                    viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
                    role="img"
                    aria-label={`${r.unit} rating from ${Math.round(r.start)} to ${Math.round(r.elo)}`}
                    className="inline-block align-middle"
                  >
                    <polyline
                      points={sparklinePoints(r.series, SPARK_W, SPARK_H, 2)}
                      fill="none"
                      stroke={stroke}
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  </svg>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-xs text-text-secondary mt-2">
        The line starts at everyone's initial rating and has one point per week. Green climbed over the season, red
        fell.
      </p>
    </div>
  );
}
