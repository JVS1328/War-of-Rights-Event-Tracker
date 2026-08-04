/**
 * Pairings — the matrix, as the prototype has it (V.heat).
 *
 * One question, asked two ways: how much of the time two units spend on the
 * field together are they on the same side, and how much of it facing each
 * other. Both read as a share of the rounds BOTH were fielded, so a unit that
 * missed half the season isn't punished for it, and the two modes add to 100%.
 *
 * The ramp is a single perceptual sweep — light to dark — so a darker cell
 * always means more. Faction hues are deliberately absent: a pairing has no
 * side.
 */
import {
  averagePct,
  findPair,
  heatColor,
  heatInk,
  pairPct,
  rankPairs,
  type PairHeatmap,
  type PairMode,
  type RankedPair,
} from '../../utils/pairHeatmap';

const STOPS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

const VERB: Record<PairMode, string> = {
  together: 'together',
  against: 'against each other',
};

const TITLE: Record<PairMode, string> = {
  together: 'Teammate composition',
  against: 'Opponent exposure',
};

const TAIL: Record<PairMode, string> = {
  together:
    "The balancer's teammate-history weight reads exactly this matrix — a hot cell is a pairing it will try to break up.",
  against: 'A pair that never meets is as much an imbalance as one that always does.',
};

function PairTable({ pairs, mode }: { pairs: RankedPair[]; mode: PairMode }) {
  return (
    <div className="scroll-x">
      <table>
        <thead>
          <tr>
            <th />
            <th>Pair</th>
            <th className="num">Share</th>
            <th className="num">Rounds</th>
          </tr>
        </thead>
        <tbody>
          {pairs.map((p, i) => (
            <tr key={`${p.unit1}|${p.unit2}`}>
              <td><span className={`pos${i === 0 ? ' q' : ''}`}>{i + 1}</span></td>
              <td className="wor-name">{p.unit1} + {p.unit2}</td>
              <td className="num" style={{ fontWeight: 600 }}>{p.pct}%</td>
              <td className="num" style={{ color: 'var(--ink-2)' }}>
                {p.n} of {p.bothActive} rounds
              </td>
            </tr>
          ))}
          {pairs.length === 0 && (
            <tr>
              <td colSpan={4} style={{ color: 'var(--ink-3)' }}>
                No pair has shared a round yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <p className="note" style={{ marginTop: 9 }}>
        {mode === 'together'
          ? 'Read down: these are the units the schedule keeps handing the same side to.'
          : 'Read down: these are the matchups the schedule keeps returning to.'}
      </p>
    </div>
  );
}

export function PairingsScreen({
  map,
  mode,
  onMode,
  scope,
  onScope,
  seasonName,
  seasonCount,
}: {
  map: PairHeatmap;
  mode: PairMode;
  onMode: (m: PairMode) => void;
  /** Whether the grid covers this season or every season in the event. */
  scope: 'season' | 'event';
  onScope: (s: 'season' | 'event') => void;
  seasonName: string;
  seasonCount: number;
}) {
  const units = map.units;
  const avg = averagePct(map, mode);
  const ranked = rankPairs(map, mode);
  const top = ranked.slice(0, 8);
  const low = ranked.slice(-8).reverse();
  const never = map.units.length > 0
    ? units.flatMap((a, i) => units.slice(i + 1).filter((b) => !findPair(map, a, b))).length
    : 0;

  const ctl = (
    <div className="panel">
      <div className="ctl">
        <span className="cap">Matrix</span>
        <div className="seg">
          <button aria-pressed={mode === 'together'} onClick={() => onMode('together')}>
            Same side
          </button>
          <button aria-pressed={mode === 'against'} onClick={() => onMode('against')}>
            Opposite sides
          </button>
        </div>
        <span className="cap" style={{ marginLeft: 6 }}>Scope</span>
        <div className="seg">
          <button aria-pressed={scope === 'season'} onClick={() => onScope('season')}>
            {seasonName}
          </button>
          <button aria-pressed={scope === 'event'} onClick={() => onScope('event')}>
            All {seasonCount} season{seasonCount === 1 ? '' : 's'}
          </button>
        </div>
        <span className="rule" />
        <span className="meta">
          {units.length} unit{units.length === 1 ? '' : 's'} · average {avg}% · {map.rounds} rounds
        </span>
      </div>
    </div>
  );

  if (units.length === 0) {
    return (
      <>
        {ctl}
        <div className="panel">
          <header className="ph"><h2>{TITLE[mode]}</h2><span className="rule" /></header>
          <div className="pb">
            <p className="note">
              Nothing to plot yet — a night has to have units on both sides before a pairing exists.
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {ctl}

      <div className="panel">
        <header className="ph">
          <h2>{TITLE[mode]}</h2>
          <span className="rule" />
          <span className="meta">% of shared rounds spent {VERB[mode]}</span>
        </header>
        <div className="pb scroll-x">
          <div className="hm-legend">
            <span className="cap">0%</span>
            <span className="hm-ramp">
              {STOPS.map((p) => <i key={p} style={{ background: heatColor(p) }} />)}
            </span>
            <span className="cap">100%</span>
            <span className="note" style={{ marginLeft: 'auto' }}>
              share of the rounds both units were on the field
            </span>
          </div>
          <table className="hm">
            <thead>
              <tr>
                <th className="hm-corner" />
                {units.map((u) => (
                  <th className="hm-col" key={u}><span>{u}</span></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {units.map((a) => (
                <tr key={a}>
                  <th scope="row" className="hm-row">{a}</th>
                  {units.map((b) => {
                    if (a === b) return <td className="hm-c hm-x" key={b} aria-hidden />;
                    const cell = findPair(map, a, b);
                    const pct = pairPct(cell, mode);
                    // Never overlapped is not 0% — it is a pair with no share
                    // at all, so it sits out of the ramp entirely.
                    if (pct === null) {
                      return (
                        <td
                          className="hm-c hm-x"
                          key={b}
                          title={`${a} + ${b} — never both on the field`}
                        />
                      );
                    }
                    return (
                      <td
                        className="hm-c"
                        key={b}
                        tabIndex={0}
                        style={{ background: heatColor(pct), color: heatInk(pct) }}
                        title={`${a} + ${b} — ${cell![mode]} of ${cell!.bothActive} shared rounds ${VERB[mode]} (${pct}%)`}
                        aria-label={`${a} and ${b}, ${pct} percent`}
                      >
                        {pct}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="note" style={{ padding: '0 13px 13px' }}>
          Counted per round, not per night, so a unit swapped across at half time counts on both
          sides. {TAIL[mode]}
          {never > 0 && ` ${never} pair${never === 1 ? ' has' : 's have'} never been on the field in the same round — those cells are left blank.`}
        </p>
      </div>

      <div className="panel">
        <header className="ph">
          <h2>{mode === 'together' ? 'Most locked-together' : 'Most frequent opponents'}</h2>
          <span className="rule" />
          <span className="meta">the table view of the matrix above</span>
        </header>
        <div className="pb"><PairTable pairs={top} mode={mode} /></div>
      </div>

      <div className="panel">
        <header className="ph">
          <h2>{mode === 'together' ? 'Least locked-together' : 'Rarest opponents'}</h2>
          <span className="rule" />
        </header>
        <div className="pb"><PairTable pairs={low} mode={mode} /></div>
      </div>
    </>
  );
}
