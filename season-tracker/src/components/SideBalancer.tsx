import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Scale, Trash2 } from 'lucide-react';
import { balanceTeams, describeFailure, sitOuts } from '../utils/balanceTeams';
import type { BalanceOption, BalanceResult, UnitCount } from '../utils/balanceTeams';
import { parseRosterPaste } from '../utils/companySplit';

const STORAGE_KEY = 'WarOfRightsSideBalancer';
const PLACEHOLDER = '7th SC\t8\t11\n1stLAR\t7\t10\nSB Arty\t4\t5\nPB\t22\t26';

type Side = 'A' | 'B' | null;

const SIDE_NAME: Record<'A' | 'B', string> = { A: 'USA', B: 'CSA' };

/**
 * With no season behind it there is no teammate history, no divisions and no
 * Elo — so the only things worth scoring are how even the head counts are, how
 * evenly the units are spread, and how alike the two sides' min–max spreads
 * look. The other three weights are zero, which takes their metrics out of the
 * scoring entirely.
 */
const WEIGHTS = {
  teammate: 0,
  avgDiff: 1,
  regimentCount: 0.75,
  rangeSimilarity: 0.5,
  divisionOpposition: 0,
  postSeasonSkill: 0,
};

interface SavedState {
  text?: string;
  pins?: Record<string, 'A' | 'B'>;
  maxPlayerDiff?: number;
  optionCount?: number;
}

const loadSaved = (): SavedState => {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}') as SavedState;
  } catch {
    return {};
  }
};

const optionToText = (option: BalanceOption): string =>
  [
    `${SIDE_NAME.A} (${Math.round(option.avgA)} men, ${option.teamA.length} units)`,
    ...option.teamA,
    '',
    `${SIDE_NAME.B} (${Math.round(option.avgB)} men, ${option.teamB.length} units)`,
    ...option.teamB,
  ].join('\n');

/**
 * Standalone side balancer: paste the coord sheet, pin the units that have
 * already been promised a side, get an even USA/CSA split. It runs the same
 * engine the season tracker's balancer does, minus everything that needs a
 * season behind it — so anyone can open the site on a Sunday afternoon and
 * split a pickup night without an event existing at all.
 */
export function SideBalancer() {
  const saved = loadSaved();
  const [text, setText] = useState(() => saved.text ?? '');
  const [pins, setPins] = useState<Record<string, 'A' | 'B'>>(() => saved.pins ?? {});
  const [maxPlayerDiff, setMaxPlayerDiff] = useState(() => saved.maxPlayerDiff ?? 10);
  const [optionCount, setOptionCount] = useState(() => saved.optionCount ?? 3);
  const [result, setResult] = useState<BalanceResult | null>(null);
  const [copied, setCopied] = useState<number | null>(null);

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ text, pins, maxPlayerDiff, optionCount }),
    );
  }, [text, pins, maxPlayerDiff, optionCount]);

  const roster = useMemo(() => parseRosterPaste(text), [text]);

  /**
   * Counts keyed by unit. A name pasted twice is summed rather than overwritten
   * — a sheet that lists a regiment's companies on separate lines still adds up
   * to one unit fielding all of them.
   */
  const counts = useMemo(() => {
    const out: Record<string, UnitCount> = {};
    for (const entry of roster) {
      const current = out[entry.unit];
      out[entry.unit] = current
        ? { min: current.min + entry.min, max: current.max + entry.max }
        : { min: entry.min, max: entry.max };
    }
    return out;
  }, [roster]);

  const units = useMemo(() => Object.keys(counts).sort(), [counts]);
  // Who is fielding nobody, so the roster can grey them out before you balance
  // rather than only explaining it in the result.
  const idle = useMemo(() => new Set(sitOuts(units, counts)), [units, counts]);
  const playing = units.filter((u) => !idle.has(u));
  const pinnedCount = playing.filter((u) => pins[u]).length;
  const totalMen = playing.reduce((sum, u) => sum + (counts[u].min + counts[u].max) / 2, 0);

  // Results describe the roster they were built from, so any edit to it
  // invalidates them rather than leaving a stale split on screen.
  useEffect(() => setResult(null), [text, pins, maxPlayerDiff, optionCount]);

  const cyclePin = (unit: string) => {
    setPins((prev) => {
      const next = { ...prev };
      if (!prev[unit]) next[unit] = 'A';
      else if (prev[unit] === 'A') next[unit] = 'B';
      else delete next[unit];
      return next;
    });
  };

  const balance = () => {
    setResult(
      // The engine sits out a unit fielding nobody itself, so the whole roster
      // goes in and comes back with `satOut` saying who was left behind.
      balanceTeams({
        available: units,
        lockedA: units.filter((u) => pins[u] === 'A'),
        lockedB: units.filter((u) => pins[u] === 'B'),
        counts,
        opposingPairs: [],
        maxPlayerDiff,
        teammateHistory: {},
        weights: WEIGHTS,
        optionCount,
      }),
    );
  };

  const copyOption = async (option: BalanceOption, index: number) => {
    await navigator.clipboard.writeText(optionToText(option));
    setCopied(index);
    window.setTimeout(() => setCopied(null), 1500);
  };

  const options = result?.ok ? result.options : [];
  const failure = result && !result.ok ? result.failure : null;
  // A near-miss still has a split worth showing — it just breaks the tolerance.
  const closest = failure?.kind === 'no-valid' ? failure.best : null;

  return (
    <div className="panel">
      <header className="ph">
        <h2>Side balancer</h2>
        <span className="rule" />
        <span className="meta">
          {playing.length} unit{playing.length === 1 ? '' : 's'} · {Math.round(totalMen)} men
          {pinnedCount ? ` · ${pinnedCount} pinned` : ''}
        </span>
      </header>
      <div className="pb flush">
        <div className="cols">
          <div className="col">
            <div className="cap">Who is coming</div>
            <p className="note" style={{ margin: '5px 0 7px' }}>
              One unit a line: name, min, max — tab-separated straight from the sheet, or spaced. A
              unit listed twice has its numbers added together. 0–0 men is a night off.
            </p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={PLACEHOLDER}
              rows={12}
            />
            {text.trim() && (
              <button className="gh" style={{ marginTop: 7 }} onClick={() => setText('')}>
                <Trash2 className="w-3 h-3" /> Clear
              </button>
            )}

            {units.length > 0 && (
              <>
                <div className="cap" style={{ marginTop: 11, marginBottom: 5 }}>
                  Pinned sides — click a unit to promise it {SIDE_NAME.A}, again for {SIDE_NAME.B}, again to free it
                </div>
                <div className="tgs">
                  {units.map((unit) => {
                    const side: Side = pins[unit] ?? null;
                    const sitting = idle.has(unit);
                    return (
                      <button
                        key={unit}
                        className={`tg${side ? ' on' : ''}${sitting ? ' zero' : ''}`}
                        aria-pressed={!!side}
                        disabled={sitting}
                        onClick={() => cyclePin(unit)}
                        title={
                          sitting
                            ? `${unit} is fielding nobody, so it is out of the split`
                            : side
                              ? `${unit} is held on ${SIDE_NAME[side]} — the rest is packed around it`
                              : `Click to hold ${unit} on ${SIDE_NAME.A}`
                        }
                      >
                        {unit}
                        <span className="n">
                          {sitting ? '0' : side ? `${SIDE_NAME[side]} · ~${Math.round((counts[unit].min + counts[unit].max) / 2)}` : `~${Math.round((counts[unit].min + counts[unit].max) / 2)}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {idle.size > 0 && (
                  <div className="note" style={{ marginTop: 7 }}>
                    {idle.size} unit{idle.size === 1 ? '' : 's'} at 0–0 men — sitting out, not balanced around.
                  </div>
                )}
              </>
            )}
          </div>

          <div className="col">
            <div className="cap">Split</div>
            <div className="grid-f" style={{ marginTop: 7 }}>
              <div className="fld">
                <label className="cap">Max player difference</label>
                <input
                  type="number"
                  min={0}
                  value={maxPlayerDiff}
                  onChange={(e) => setMaxPlayerDiff(Math.max(0, Number(e.target.value) || 0))}
                />
              </div>
              <div className="fld">
                <label className="cap">Options to show</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={optionCount}
                  onChange={(e) => setOptionCount(Math.min(10, Math.max(1, Number(e.target.value) || 1)))}
                />
              </div>
            </div>

            <button
              className="gh live"
              style={{ marginTop: 11 }}
              onClick={balance}
              disabled={playing.length < 2}
            >
              <Scale className="w-3 h-3" /> Balance
            </button>

            {playing.length < 2 && (
              <p className="note" style={{ marginTop: 7 }}>
                Paste at least two units fielding men to split them.
              </p>
            )}

            {failure && (
              <p className="note" style={{ marginTop: 11 }}>
                {describeFailure(failure, maxPlayerDiff)}
              </p>
            )}

            {closest && <SplitCard option={closest} label="Closest split" onCopy={() => copyOption(closest, -1)} copied={copied === -1} />}

            {options.map((option, i) => (
              <SplitCard
                key={i}
                option={option}
                label={options.length > 1 ? `Option ${i + 1}` : 'Split'}
                onCopy={() => copyOption(option, i)}
                copied={copied === i}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** One proposed split: both sides, their numbers, and a copy button. */
function SplitCard({
  option,
  label,
  onCopy,
  copied,
}: {
  option: BalanceOption;
  label: string;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div className="panel pb" style={{ marginTop: 11 }}>
      <div className="cap" style={{ marginBottom: 7 }}>
        {label} — {option.avgDiff.toFixed(0)} apart
      </div>
      <div className="cols">
        {(['A', 'B'] as const).map((side) => {
          const team = side === 'A' ? option.teamA : option.teamB;
          const avg = side === 'A' ? option.avgA : option.avgB;
          const min = side === 'A' ? option.minA : option.minB;
          const max = side === 'A' ? option.maxA : option.maxB;
          return (
            <div className="col" key={side}>
              <div className={`wor-name ${side === 'A' ? 'f-usa' : 'f-csa'}`}>{SIDE_NAME[side]}</div>
              <div className="note" style={{ marginBottom: 5 }}>
                ~{Math.round(avg)} men ({min}–{max}) · {team.length} unit{team.length === 1 ? '' : 's'}
              </div>
              <div className="tgs">
                {team.map((unit) => (
                  <span className="tg" key={unit}>{unit}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <button className="gh" style={{ marginTop: 9 }} onClick={onCopy}>
        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
        {copied ? 'Copied' : 'Copy split'}
      </button>
    </div>
  );
}
