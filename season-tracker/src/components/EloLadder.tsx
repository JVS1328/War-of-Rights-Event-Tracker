/**
 * The Elo ladder screen, as the prototype has it: a KPI strip, the ratings
 * table, and the two units the ladder and the points table most disagree
 * about.
 *
 * Movement is not coloured green and red. The faction hues are spoken for and
 * a rating going up is not "good" the way a win is — a rise is set in ink and
 * everything else in the muted tone, which is how the prototype reads it.
 */
import { sparklinePoints, type EloLadderRow } from '../utils/eloLadder';

const SPARK_W = 104;
const SPARK_H = 22;

const ord = (n: number): string => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
};

/** A rating line with a dot on today. Ink-3 for the line, ink for the dot. */
function Spark({ series }: { series: number[] }) {
  if (series.length < 2) return null;
  const pts = sparklinePoints(series, SPARK_W, SPARK_H, 2);
  const last = pts.split(' ').pop()!.split(',');
  return (
    <svg className="spark" viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} width={SPARK_W} height={SPARK_H} aria-hidden>
      <polyline points={pts} fill="none" stroke="var(--ink-3)" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="2.4" fill="var(--ink)" />
    </svg>
  );
}

/** Signed bar around a centre rule. Polarity by direction, not by a second hue. */
function Signed({ value, max, width = 76 }: { value: number; max: number; width?: number }) {
  const mag = Math.min(Math.abs(value) / (max || 1), 1) * (width / 2);
  return (
    <span className="sgn" style={{ width }}>
      <i className="ax" />
      {value !== 0 && (
        <i className="bar" style={value < 0 ? { right: '50%', width: mag } : { left: '50%', width: mag }} />
      )}
    </span>
  );
}

export function EloLadder({
  rows,
  settings,
  nights,
  onOpenUnit,
}: {
  rows: EloLadderRow[];
  settings: { initialElo: number; kFactorStandard: number; kFactorProvisional: number; provisionalRounds: number; leadMultiplier: number };
  nights: number;
  onOpenUnit?: (unit: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="panel">
        <header className="ph"><h2>Ladder</h2><span className="rule" /></header>
        <div className="pb"><p className="note">No units to rank yet.</p></div>
      </div>
    );
  }

  const hi = Math.max(...rows.map((r) => r.elo));
  const lo = Math.min(...rows.map((r) => r.elo));
  const withGap = rows.filter((r) => r.gap != null);
  const maxGap = Math.max(1, ...withGap.map((r) => Math.abs(r.gap!)));
  const over = withGap.length ? [...withGap].sort((a, b) => b.gap! - a.gap!)[0] : null;
  const under = withGap.length ? [...withGap].sort((a, b) => a.gap! - b.gap!)[0] : null;

  return (
    <>
      <div className="panel">
        <header className="ph">
          <h2>Ladder</h2>
          <span className="rule" />
          <span className="meta">after {nights} night{nights === 1 ? '' : 's'} · start {settings.initialElo}</span>
        </header>
        <div className="pb flush">
          <div className="kpis">
            <div className="kpi">
              <div className="cap">Top rating</div>
              <div className="v">{Math.round(hi)}</div>
              <div className="h wor-name">{rows[0].unit}</div>
            </div>
            <div className="kpi">
              <div className="cap">Spread</div>
              <div className="v">{Math.round(hi - lo)}</div>
              <div className="h">top to bottom</div>
            </div>
            <div className="kpi">
              <div className="cap">K factor</div>
              <div className="v">{settings.kFactorStandard}</div>
              <div className="h">
                {settings.kFactorProvisional} for the first {settings.provisionalRounds} rounds
              </div>
            </div>
            <div className="kpi">
              <div className="cap">Lead weight</div>
              <div className="v">{settings.leadMultiplier}×</div>
              <div className="h">a lead carries this much of the result</div>
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <header className="ph">
          <h2>Ratings</h2>
          <span className="rule" />
          <span className="meta">trend = every night this season · gap = points rank − Elo rank</span>
        </header>
        <div className="pb flush scroll-x">
          <table>
            <thead>
              <tr>
                <th />
                <th>Unit</th>
                <th>Div</th>
                <th className="num">Elo</th>
                <th className="num">Last night</th>
                <th>Trend</th>
                <th className="num">Rounds</th>
                <th className="num">Pts rank</th>
                <th className="num">Gap</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.unit} className={onOpenUnit ? 'click' : undefined} onClick={() => onOpenUnit?.(r.unit)}>
                  <td>
                    <span className={`pos${r.rank <= 3 ? ' q' : ''}`}>{r.rank}</span>
                  </td>
                  <td className="wor-name">
                    {r.unit}
                    {r.provisional && (
                      <span className="tag q" style={{ opacity: 0.6, marginLeft: 6 }} title={`${r.rounds} rounds played`}>
                        prov
                      </span>
                    )}
                  </td>
                  <td>{r.division && <span className="tag q">{r.division}</span>}</td>
                  <td className="num" style={{ fontWeight: 600 }}>{Math.round(r.elo)}</td>
                  <td className="num" style={{ color: r.lastNight > 0 ? 'var(--ink)' : 'var(--ink-3)' }}>
                    {r.lastNight > 0 ? '+' : ''}{Math.round(r.lastNight)}
                  </td>
                  <td><Spark series={r.series} /></td>
                  <td className="num" style={{ color: 'var(--ink-2)' }}>{r.rounds}</td>
                  <td className="num" style={{ color: 'var(--ink-2)' }}>{r.pointsRank ?? '—'}</td>
                  <td className="num">
                    {r.gap != null && (
                      <>
                        <Signed value={r.gap} max={maxGap} />
                        <span style={{ marginLeft: 7 }}>{r.gap > 0 ? '+' : ''}{r.gap}</span>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={9}>
                  Elo never touches the standings — it exists so the balancer can weigh sides. A positive gap means
                  the ladder rates a unit higher than its points do.
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {over && under && over.unit !== under.unit && (
        <div className="panel">
          <header className="ph"><h2>Where the ladder and the table disagree</h2><span className="rule" /></header>
          <div className="pb flush">
            <div className="cols">
              <div className="col">
                <div className="cap">Rated above its record</div>
                <div className="mid wor-name" style={{ marginTop: 5 }}>{over.unit}</div>
                <div className="note" style={{ marginTop: 4 }}>
                  <b>{Math.round(over.elo)}</b> Elo — <b>{ord(over.rank)}</b> on the ladder,{' '}
                  <b>{ord(over.pointsRank!)}</b> on points. It loses close rounds to strong sides and beats weak
                  ones, which points do not reward but Elo does.
                </div>
              </div>
              <div className="col">
                <div className="cap">Rated below its record</div>
                <div className="mid wor-name" style={{ marginTop: 5 }}>{under.unit}</div>
                <div className="note" style={{ marginTop: 4 }}>
                  <b>{Math.round(under.elo)}</b> Elo — <b>{ord(under.rank)}</b> on the ladder,{' '}
                  <b>{ord(under.pointsRank!)}</b> on points. Assist points accrue whoever you beat; the ladder
                  discounts wins over weak sides.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
