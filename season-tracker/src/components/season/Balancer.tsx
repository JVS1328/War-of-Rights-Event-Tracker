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
  /** Every unit on the night. */
  roster: string[];
  /** Units held out of tonight's pool. */
  sittingOut: string[];
  headcount: Record<string, number>;
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
  onPair: (i: number, slot: 0 | 1, unit: string) => void;
  onAddPair: () => void;
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
  const { roster, sittingOut, headcount, counts, pairs, maxDiff, options } = view;
  const out = new Set(sittingOut);
  const pool = roster.filter((u) => !out.has(u));
  const poolMen = pool.reduce((s, u) => s + (headcount[u] ?? 0), 0);
  const forcedA = new Set(pairs.map((p) => p[0]).filter(Boolean));
  const forcedB = new Set(pairs.map((p) => p[1]).filter(Boolean));
  const missing = roster.filter((u) => !(counts[u]?.max)).length;

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
        <div className="rl" style={{ marginTop: 8 }}>
          {o.teamA.map((u) => (
            <span key={u} className="tag q" style={forcedA.has(u) ? { borderColor: 'var(--ink)', color: 'var(--ink)' } : undefined}>
              {u}{forcedA.has(u) ? ' ⚑' : ''}
            </span>
          ))}
        </div>
        <div className="rl" style={{ marginTop: 4, opacity: 0.75 }}>
          {o.teamB.map((u) => (
            <span key={u} className="tag q" style={forcedB.has(u) ? { borderColor: 'var(--ink)', color: 'var(--ink)', opacity: 1 } : undefined}>
              {u}{forcedB.has(u) ? ' ⚑' : ''}
            </span>
          ))}
        </div>
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
          </span>
        </div>
      </div>

      <Panel
        title="Available units"
        meta="click to sit a unit out — held-out units are excluded, not balanced around"
      >
        <div className="tgs">
          {roster.map((u) => {
            const zero = !(counts[u]?.min) && !(counts[u]?.max);
            return (
              <button
                key={u}
                className={`tg${out.has(u) ? '' : ' on'}${zero ? ' zero' : ''}`}
                aria-pressed={!out.has(u)}
                onClick={() => onToggleUnit(u)}
                title={zero ? `${u} is fielding nobody` : undefined}
              >
                {u}<span className="n">~{(headcount[u] ?? 0).toFixed(0)}</span>
              </button>
            );
          })}
          {roster.length === 0 && <span className="note">No units on this night yet.</span>}
        </div>
        <div className="note" style={{ marginTop: 9 }}>
          {out.size
            ? `${out.size} sitting out: ${[...out].join(', ')}`
            : 'Every unit on the night is in the pool.'}
        </div>
      </Panel>

      <Panel title="Forced opposing pairs" meta="seeded on opposite sides before anything else is packed">
        {pairs.length === 0 ? (
          <div className="note">No forced pairs — the balancer is free to place every unit.</div>
        ) : (
          pairs.map((p, i) => (
            <div className="pair-row" key={i}>
              <select value={p[0]} onChange={(e) => onPair(i, 0, e.target.value)}>
                {roster.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
              <span className="cap">opposite</span>
              <select value={p[1]} onChange={(e) => onPair(i, 1, e.target.value)}>
                {roster.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
              <button className="gh" onClick={() => onRemovePair(i)}>Remove</button>
            </div>
          ))
        )}
        <div style={{ display: 'flex', gap: 6, marginTop: 9, flexWrap: 'wrap' }}>
          <button className="gh" onClick={onAddPair} disabled={roster.length < 2}>Add a pair</button>
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
            {missing ? `${missing} unit(s) have no count — they balance as 0` : 'every unit has a count'}
          </span>
        </header>
        <div className="ctl">
          <button className="gh" onClick={onPasteCounts}>Paste from coord sheet</button>
          <button className="gh" onClick={onPullCounts}>Pull last night's counts</button>
          <span className="rule" />
          <span className="meta">min and max men expected, per unit</span>
        </div>
        <div className="pb flush scroll-x">
          <table>
            <thead>
              <tr><th>Unit</th><th className="num">Min</th><th className="num">Max</th><th className="num">Avg</th><th /></tr>
            </thead>
            <tbody>
              {roster.map((u) => {
                const c = counts[u];
                return (
                  <tr key={u}>
                    <td className="wor-name">{u}</td>
                    <td className="num">
                      <input
                        type="number" value={c?.min ?? 0} style={{ width: 56, textAlign: 'right' }}
                        onChange={(e) => onCount(u, 'min', Number(e.target.value) || 0)}
                      />
                    </td>
                    <td className="num">
                      <input
                        type="number" value={c?.max ?? 0} style={{ width: 56, textAlign: 'right' }}
                        onChange={(e) => onCount(u, 'max', Number(e.target.value) || 0)}
                      />
                    </td>
                    <td className="num" style={{ color: 'var(--ink-2)' }}>{avg(c).toFixed(1)}</td>
                    <td>
                      {!c?.max && (
                        <span className="tag q" style={{ borderColor: 'var(--live)', color: 'var(--live)' }}>not set</span>
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
