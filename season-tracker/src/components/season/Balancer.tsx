/**
 * Season → Balancer, to the prototype's V.balancer.
 *
 * The order is the order you work in: which units are even in tonight's pool,
 * what has to be kept apart, the options that come out, then the knobs that
 * produced them and the counts they were computed from.
 */
import { Field } from './NightBuilder';
import type { BalanceOption, BalanceWeights, UnitCount } from '../../utils/balanceTeams';

const Panel = ({
  title, meta, flush = false, ctl, children,
}: {
  title: string; meta?: string; flush?: boolean;
  ctl?: React.ReactNode; children: React.ReactNode;
}) => (
  <div className="panel">
    <header className="ph"><h2>{title}</h2><span className="rule" />{meta && <span className="meta">{meta}</span>}</header>
    {ctl}
    <div className={flush ? 'pb flush' : 'pb'}>{children}</div>
  </div>
);

export interface BalancerView {
  weekName: string;
  /** Every registered unit — the pool comes from the season, not the night. */
  roster: string[];
  /** Units already on a side tonight; held there unless released. */
  assignedA: string[];
  assignedB: string[];
  /** Assigned units thrown back into the pool, so this run may move them. */
  released: string[];
  /** Units held out of tonight's pool by hand. */
  sittingOut: string[];
  counts: Record<string, UnitCount>;
  pairs: [string, string][];
  maxDiff: number;
  optionCount: number;
  weights: BalanceWeights;
  options: BalanceOption[];
  /** Set when the run could not produce any option. */
  status: string;
}

const avg = (c: UnitCount | undefined) => ((c?.min ?? 0) + (c?.max ?? 0)) / 2;

export function Balancer({
  view,
  onBack,
  onToggleUnit,
  onToggleRelease,
  onReleaseAll,
  onHoldAll,
  onPair,
  onAddPair,
  onRemovePair,
  onMaxDiff,
  onOptionCount,
  onWeight,
  onResetWeights,
  onCount,
  onRun,
  onApply,
  onPasteCounts,
  onPullCounts,
  onSplitter,
}: {
  view: BalancerView;
  onBack: () => void;
  onToggleUnit: (unit: string) => void;
  onToggleRelease: (unit: string) => void;
  onReleaseAll: () => void;
  onHoldAll: () => void;
  onPair: (i: number, slot: 0 | 1, unit: string) => void;
  onAddPair: (a: string, b: string) => void;
  onRemovePair: (i: number) => void;
  onMaxDiff: (n: number) => void;
  onOptionCount: (n: number) => void;
  onWeight: (key: keyof BalanceWeights, n: number) => void;
  onResetWeights: () => void;
  onCount: (unit: string, which: 'min' | 'max', n: number) => void;
  onRun: () => void;
  onApply: (option: BalanceOption) => void;
  onPasteCounts: () => void;
  onPullCounts: () => void;
  onSplitter: () => void;
}) {
  const { roster, assignedA, assignedB, released, sittingOut, counts, pairs, maxDiff, options } = view;
  const out = new Set(sittingOut);
  const loose = new Set(released);
  const onSideA = new Set(assignedA);
  const onSideB = new Set(assignedB);

  /** 0–0 men is a night off: the unit is out of the split and off the night. */
  const fields = (u: string) => (counts[u]?.min ?? 0) > 0 || (counts[u]?.max ?? 0) > 0;
  const sideOf = (u: string): 'A' | 'B' | null => (onSideA.has(u) ? 'A' : onSideB.has(u) ? 'B' : null);
  /** On a side, fielding somebody, and not released — so it stays put. */
  const held = (u: string) => sideOf(u) !== null && !loose.has(u) && !out.has(u) && fields(u);

  const pool = roster.filter((u) => fields(u) && !out.has(u));
  const poolMen = pool.reduce((s, u) => s + avg(counts[u]), 0);
  const heldUnits = pool.filter(held);
  const toPlace = pool.filter((u) => !held(u));
  const benched = roster.filter((u) => out.has(u));
  const idle = roster.filter((u) => !fields(u) && !out.has(u));
  // Standing on a side with nobody to field: applying an option takes them off
  // the night, so it is said plainly rather than discovered afterwards.
  const idleOnSide = idle.filter((u) => sideOf(u) !== null);

  const forcedA = new Set(pairs.map((p) => p[0]).filter(Boolean));
  const forcedB = new Set(pairs.map((p) => p[1]).filter(Boolean));

  /** Pairs pick from the pool, plus whatever the row already holds — a unit
   *  that has since dropped out still has to show, or the row reads as another
   *  unit entirely. */
  const pairOptions = (picked: string) =>
    (pool.includes(picked) || !picked ? pool : [picked, ...pool]).map((u) => (
      <option key={u} value={u}>{u}{fields(u) ? '' : ' — fielding nobody'}</option>
    ));

  const card = (o: BalanceOption, i: number) => {
    const big = Math.max(o.avgA, o.avgB) || 1;
    return (
      <div className={`col${i === 0 ? ' stripe-usa' : ''}`} key={i}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="cap">Option {i + 1}</span>
          <span className="rule" />
          {i === 0 && <span className="tag usa">Best</span>}
          {o.avgDiff > maxDiff && (
            <span className="tag q" style={{ borderColor: 'var(--live)', color: 'var(--live)' }}>over max diff</span>
          )}
          <span className="meta">score {o.compositeScore.toFixed(2)}</span>
        </div>
        <div className="hb" style={{ marginTop: 9 }}>
          <span>Team A</span>
          <span className="t"><i style={{ width: `${(o.avgA / big) * 100}%`, background: 'var(--union)' }} /></span>
          <span className="n">~{o.avgA.toFixed(0)}</span>
        </div>
        <div className="hb">
          <span>Team B</span>
          <span className="t"><i style={{ width: `${(o.avgB / big) * 100}%`, background: 'var(--reb)' }} /></span>
          <span className="n">~{o.avgB.toFixed(0)}</span>
        </div>
        <div className="note" style={{ marginTop: 8 }}>
          {o.avgDiff.toFixed(0)}-man gap (max {maxDiff}) · {o.teamA.length}v{o.teamB.length} units ·{' '}
          {o.teammateScore} repeat pairings
          {o.avgEloA != null && o.avgEloB != null &&
            ` · Elo ${Math.round(o.avgEloA)} vs ${Math.round(o.avgEloB)}`}
        </div>
        {[o.teamA, o.teamB].map((side, s) => {
          const forced = s === 0 ? forcedA : forcedB;
          return (
            <div className="rl" key={s} style={{ marginTop: s === 0 ? 8 : 4, opacity: s === 0 ? 1 : 0.75 }}>
              {side.map((u) => {
                const pinned = forced.has(u) || held(u);
                return (
                  <span
                    key={u}
                    className="tag q"
                    style={pinned ? { borderColor: 'var(--ink)', color: 'var(--ink)', opacity: 1 } : undefined}
                    title={held(u) ? `${u} was already on this side — held there` : undefined}
                  >
                    {u}{forced.has(u) ? ' ⚑' : ''}
                    {held(u) && <i style={{ fontStyle: 'normal', opacity: 0.55 }}>{' · held'}</i>}
                  </span>
                );
              })}
            </div>
          );
        })}
        <div style={{ marginTop: 9 }}>
          <button className="gh" aria-pressed={i === 0} onClick={() => onApply(o)}>
            Apply to {view.weekName}
          </button>
        </div>
      </div>
    );
  };

  const weightFields: [keyof BalanceWeights, string, string][] = [
    ['teammate', 'Teammate history', 'penalises units that keep landing together'],
    ['avgDiff', 'Average difference', 'head-count gap between the sides'],
    ['regimentCount', 'Unit count', 'keeps the number of units even'],
    ['rangeSimilarity', 'Range similarity', 'matches min-max spread, not just the average'],
    ['divisionOpposition', 'Division opposition', '0 = ignore divisions when splitting'],
    ['postSeasonSkill', 'Post-season skill', 'spreads playoff pedigree; 0 off outside playoffs'],
  ];

  return (
    <>
      <div className="panel">
        <div className="ctl">
          <span className="cap">Balancing</span>
          <span className="wor-name">{view.weekName}</span>
          <button className="gh" onClick={onBack}>Back to the night</button>
          <span className="rule" />
          <span className="meta">
            {pool.length} of {roster.length} units in · ~{poolMen.toFixed(0)} men
            {heldUnits.length > 0 && ` · ${heldUnits.length} held`}
          </span>
        </div>
      </div>

      <Panel
        title="Tonight's pool"
        meta="every unit with men to field — nobody has to be on a side first"
        ctl={
          (heldUnits.length > 0 || loose.size > 0) ? (
            <div className="ctl">
              <span className="cap">Already placed</span>
              <button className="gh" onClick={onReleaseAll} disabled={heldUnits.length === 0}>
                Release all {heldUnits.length || ''}
              </button>
              <button className="gh" onClick={onHoldAll} disabled={loose.size === 0}>
                Hold them again
              </button>
              <span className="rule" />
              <span className="meta">released units go back in with the rest</span>
            </div>
          ) : undefined
        }
      >
        {heldUnits.length > 0 && (
          <>
            <div className="cap" style={{ marginBottom: 5 }}>On a side already — kept there</div>
            <div className="tgs">
              {heldUnits.map((u) => (
                <button
                  key={u}
                  className="tg on"
                  aria-pressed
                  onClick={() => onToggleRelease(u)}
                  title={`${u} is on Team ${sideOf(u)} and stays there — click to release it into the pool`}
                >
                  {u}<span className="n">{sideOf(u)} · ~{avg(counts[u]).toFixed(0)}</span>
                </button>
              ))}
            </div>
          </>
        )}

        <div className="cap" style={{ marginTop: heldUnits.length ? 11 : 0, marginBottom: 5 }}>
          To place{toPlace.length ? ` — ${toPlace.length}` : ''}
        </div>
        <div className="tgs">
          {toPlace.map((u) => (
            <button
              key={u}
              className="tg on"
              aria-pressed
              onClick={() => onToggleUnit(u)}
              title={loose.has(u) ? `${u} was released from Team ${sideOf(u)} — click to sit it out` : `Click to sit ${u} out`}
            >
              {u}<span className="n">{loose.has(u) ? 'freed · ' : ''}~{avg(counts[u]).toFixed(0)}</span>
            </button>
          ))}
          {toPlace.length === 0 && (
            <span className="note">
              {pool.length ? 'Nothing left to place — every unit in the pool is already on a side.' : 'Nobody is fielding men yet. Paste the coord sheet, or set counts below.'}
            </span>
          )}
        </div>

        {(benched.length > 0 || idle.length > 0) && (
          <>
            <div className="cap" style={{ marginTop: 11, marginBottom: 5 }}>Out tonight</div>
            <div className="tgs">
              {benched.map((u) => (
                <button key={u} className="tg" aria-pressed={false} onClick={() => onToggleUnit(u)} title={`Click to bring ${u} back into the pool`}>
                  {u}<span className="n">sat out</span>
                </button>
              ))}
              {idle.map((u) => (
                <span key={u} className="tg zero" title={`${u} is set to 0–0 men — give it a count below to bring it in`}>
                  {u}<span className="n">{sideOf(u) ? `${sideOf(u)} · 0` : '0'}</span>
                </span>
              ))}
            </div>
          </>
        )}

        <div className="note" style={{ marginTop: 9 }}>
          {idle.length
            ? `${idle.length} at 0–0 men — sitting the night out, not balanced around.`
            : 'Every registered unit is fielding somebody.'}
          {idleOnSide.length > 0 && (
            <>
              {' '}
              <strong>{idleOnSide.join(', ')}</strong> {idleOnSide.length === 1 ? 'is' : 'are'} still on a side
              with nobody to field — applying an option takes {idleOnSide.length === 1 ? 'it' : 'them'} off the night.
            </>
          )}
        </div>
      </Panel>

      <Panel title="Forced opposing pairs" meta="seeded on opposite sides before anything else is packed">
        {pairs.length === 0 ? (
          <div className="note">No forced pairs — the balancer is free to place every unit.</div>
        ) : (
          pairs.map((p, i) => (
            <div className="pair-row" key={i}>
              <select value={p[0]} onChange={(e) => onPair(i, 0, e.target.value)}>{pairOptions(p[0])}</select>
              <span className="cap">opposite</span>
              <select value={p[1]} onChange={(e) => onPair(i, 1, e.target.value)}>{pairOptions(p[1])}</select>
              <button className="gh" onClick={() => onRemovePair(i)}>Remove</button>
            </div>
          ))
        )}
        <div style={{ display: 'flex', gap: 6, marginTop: 9, flexWrap: 'wrap' }}>
          <button className="gh" onClick={() => onAddPair(pool[0], pool[1])} disabled={pool.length < 2}>Add a pair</button>
          <span className="rule" />
          <span className="meta">⚑ marks a forced unit in the options below</span>
        </div>
      </Panel>

      <div className="panel">
        <header className="ph">
          <h2>Options</h2>
          <span className="rule" />
          <span className="meta">
            {options.length ? `showing ${options.length} · max ${maxDiff}-man difference` : 'none yet'}
          </span>
        </header>
        <div className="ctl">
          <button className="gh live" onClick={onRun}>Balance</button>
          <span className="rule" />
          <span className="meta">{view.status}</span>
        </div>
        {options.length > 0 && <div className="pb flush"><div className="cols">{options.map(card)}</div></div>}
      </div>

      <Panel title="Run settings" meta="apply to this run only">
        <div className="grid-f">
          <Field label="Max player difference" note="options over this are flagged, not hidden">
            <input type="number" min="0" value={maxDiff} onChange={(e) => onMaxDiff(Number(e.target.value) || 0)} />
          </Field>
          <Field label="Balance options to show">
            <input type="number" min="1" max="10" value={view.optionCount} onChange={(e) => onOptionCount(Number(e.target.value) || 1)} />
          </Field>
        </div>
      </Panel>

      <Panel title="Weights" meta="what the score is made of — stored per season">
        <div className="grid-f">
          {weightFields.map(([key, label, note]) => (
            <Field label={label} note={note} key={key}>
              <input
                type="number"
                step="0.05"
                value={view.weights[key]}
                onChange={(e) => onWeight(key, Number(e.target.value) || 0)}
              />
            </Field>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 11 }}>
          <button className="gh" onClick={onResetWeights}>Reset to defaults</button>
        </div>
      </Panel>

      <div className="panel">
        <header className="ph">
          <h2>Unit player counts</h2>
          <span className="rule" />
          <span className="meta">
            every registered unit · {pool.length} in tonight, {roster.length - pool.length} out
          </span>
        </header>
        <div className="ctl">
          <button className="gh" onClick={onPasteCounts}>Paste from coord sheet</button>
          <button className="gh" onClick={onPullCounts}>Pull last night's counts</button>
          <span className="rule" />
          <span className="meta">min and max men expected — 0 and 0 means they are out tonight</span>
        </div>
        <div className="pb flush scroll-x">
          <table>
            <thead>
              <tr><th>Unit</th><th className="num">Min</th><th className="num">Max</th><th className="num">Avg</th><th>Tonight</th></tr>
            </thead>
            <tbody>
              {roster.map((u) => {
                const c = counts[u];
                const side = sideOf(u);
                return (
                  <tr key={u} style={fields(u) && !out.has(u) ? undefined : { opacity: 0.55 }}>
                    <td className="wor-name">{u}</td>
                    <td className="num">
                      <input
                        type="number" min="0" value={c?.min ?? 0} style={{ width: 56, textAlign: 'right' }}
                        onChange={(e) => onCount(u, 'min', Number(e.target.value) || 0)}
                      />
                    </td>
                    <td className="num">
                      <input
                        type="number" min="0" value={c?.max ?? 0} style={{ width: 56, textAlign: 'right' }}
                        onChange={(e) => onCount(u, 'max', Number(e.target.value) || 0)}
                      />
                    </td>
                    <td className="num" style={{ color: 'var(--ink-2)' }}>{avg(c).toFixed(1)}</td>
                    <td>
                      {!fields(u) ? (
                        <span className="tag q" style={{ borderColor: 'var(--live)', color: 'var(--live)' }}>
                          out{side ? ` — comes off Team ${side}` : ''}
                        </span>
                      ) : out.has(u) ? (
                        <span className="tag q">sat out by hand</span>
                      ) : held(u) ? (
                        <span className="tag q" style={{ borderColor: 'var(--ink)', color: 'var(--ink)' }}>held on Team {side}</span>
                      ) : (
                        <span className="tag q">to place{side ? ' — released' : ''}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Panel title="Company balancer" meta="split a side into companies — same packing as the standalone splitter">
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="gh" onClick={onSplitter}>Open the company splitter</button>
          <span className="rule" />
          <span className="meta">company kinds and caps live there</span>
        </div>
      </Panel>
    </>
  );
}
