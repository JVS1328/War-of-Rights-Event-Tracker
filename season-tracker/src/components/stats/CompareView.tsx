import { useMemo, useState } from 'react';
import { Panel, Pill, EmptyHint } from '../ui';
import { Spine } from '../ui/Spine';
import { Scoreline } from '../ui/Scoreline';
import { comparePlayers, compareRegiments, compareVerdict } from '../../stats/compare';
import type { PlayerStatRow, RegimentStatRow } from '../../stats/statsEngine';

type Mode = 'players' | 'units';

/**
 * Two things, side by side. Same mirrored spine the round matchup uses, so a
 * reader who has learned to read one has learned to read the other.
 *
 * Both sides render in the neutral ink rather than the faction hues: this is a
 * comparison of two players or two units, not of two sides, and a green bar
 * must not have to mean "Union" here and "player A" there.
 */
export function CompareView({
  players,
  regiments,
  initialPlayerKey,
  initialUnit,
}: {
  players: PlayerStatRow[];
  regiments: RegimentStatRow[];
  /** Open on this player, when arriving from a player card. */
  initialPlayerKey?: string | null;
  initialUnit?: string | null;
}) {
  const [mode, setMode] = useState<Mode>(initialUnit ? 'units' : 'players');
  const [aKey, setAKey] = useState<string | null>(initialPlayerKey ?? null);
  const [bKey, setBKey] = useState<string | null>(null);
  const [aUnit, setAUnit] = useState<string | null>(initialUnit ?? null);
  const [bUnit, setBUnit] = useState<string | null>(null);

  // Fall back to the top two, so the view is never empty on arrival.
  const pA = players.find((p) => p.key === aKey) ?? players[0] ?? null;
  const pB = players.find((p) => p.key === bKey) ?? players.find((p) => p.key !== pA?.key) ?? null;
  const uA = regiments.find((r) => r.regiment === aUnit) ?? regiments[0] ?? null;
  const uB = regiments.find((r) => r.regiment === bUnit) ?? regiments.find((r) => r.regiment !== uA?.regiment) ?? null;

  const ready = mode === 'players' ? pA && pB : uA && uB;

  const { rows, verdict, aName, bName } = useMemo(() => {
    if (mode === 'players' && pA && pB) {
      const r = comparePlayers(pA, pB);
      return { rows: r, verdict: compareVerdict(r, pA.name, pB.name), aName: pA.name, bName: pB.name };
    }
    if (mode === 'units' && uA && uB) {
      const r = compareRegiments(uA, uB);
      return {
        rows: r,
        verdict: compareVerdict(r, uA.regiment, uB.regiment),
        aName: uA.regiment,
        bName: uB.regiment,
      };
    }
    return { rows: [], verdict: null, aName: '', bName: '' };
  }, [mode, pA, pB, uA, uB]);

  const swap = () => {
    if (mode === 'players') {
      setAKey(pB?.key ?? null);
      setBKey(pA?.key ?? null);
    } else {
      setAUnit(uB?.regiment ?? null);
      setBUnit(uA?.regiment ?? null);
    }
  };

  const selectCls =
    'min-w-0 max-w-[240px] flex-1 border border-[color:var(--color-border)] bg-[color:var(--color-bg-1)] px-2 py-1 font-mono text-sm text-[color:var(--color-text-0)]';

  const kdOf = (v: number) => v.toFixed(2);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 border border-[color:var(--color-border)] bg-[color:var(--color-bg-1)] p-2">
        <span className="text-xs uppercase tracking-wider text-[color:var(--color-text-2)]">Compare</span>
        <div className="flex border border-[color:var(--color-border)]">
          {(['players', 'units'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`px-3 py-1 text-xs uppercase tracking-wider ${
                mode === m
                  ? 'bg-[color:var(--color-accent)] text-[color:var(--color-bg-0)]'
                  : 'text-[color:var(--color-text-2)] hover:text-[color:var(--color-text-0)]'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {mode === 'players' ? (
          <>
            <select className={selectCls} value={pA?.key ?? ''} onChange={(e) => setAKey(e.target.value)} aria-label="First player">
              {players.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.name} — {p.regiment}
                </option>
              ))}
            </select>
            <span className="text-xs uppercase tracking-wider text-[color:var(--color-text-2)]">versus</span>
            <select className={selectCls} value={pB?.key ?? ''} onChange={(e) => setBKey(e.target.value)} aria-label="Second player">
              {players.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.name} — {p.regiment}
                </option>
              ))}
            </select>
          </>
        ) : (
          <>
            <select className={selectCls} value={uA?.regiment ?? ''} onChange={(e) => setAUnit(e.target.value)} aria-label="First unit">
              {regiments.map((r) => (
                <option key={r.regiment} value={r.regiment}>
                  {r.regiment}
                </option>
              ))}
            </select>
            <span className="text-xs uppercase tracking-wider text-[color:var(--color-text-2)]">versus</span>
            <select className={selectCls} value={uB?.regiment ?? ''} onChange={(e) => setBUnit(e.target.value)} aria-label="Second unit">
              {regiments.map((r) => (
                <option key={r.regiment} value={r.regiment}>
                  {r.regiment}
                </option>
              ))}
            </select>
          </>
        )}
        <button
          onClick={swap}
          className="border border-[color:var(--color-border)] px-2 py-1 text-xs uppercase tracking-wider text-[color:var(--color-text-2)] hover:text-[color:var(--color-text-0)]"
        >
          Swap
        </button>
      </div>

      {!ready ? (
        <Panel title="Compare">
          <EmptyHint>
            {mode === 'players'
              ? 'Import scoreboards for at least two players'
              : 'Import scoreboards for at least two units'}
          </EmptyHint>
        </Panel>
      ) : (
        <>
          <div className="border border-[color:var(--color-border)] bg-[color:var(--color-bg-1)]">
            <Scoreline
              label="K/D"
              winner={
                mode === 'players'
                  ? pA!.kd === pB!.kd
                    ? null
                    : pA!.kd > pB!.kd
                      ? 'a'
                      : 'b'
                  : uA!.kd === uB!.kd
                    ? null
                    : uA!.kd > uB!.kd
                      ? 'a'
                      : 'b'
              }
              a={{
                chip: <Pill tone="neutral">{mode === 'players' ? pA!.regiment : `${uA!.players} men`}</Pill>,
                name: aName,
                value: kdOf(mode === 'players' ? pA!.kd : uA!.kd),
                sub: `${mode === 'players' ? pA!.rounds : uA!.rounds} rounds`,
                hue: 'var(--color-text-0)',
              }}
              b={{
                chip: <Pill tone="neutral">{mode === 'players' ? pB!.regiment : `${uB!.players} men`}</Pill>,
                name: bName,
                value: kdOf(mode === 'players' ? pB!.kd : uB!.kd),
                sub: `${mode === 'players' ? pB!.rounds : uB!.rounds} rounds`,
                hue: 'var(--color-text-0)',
              }}
            />
          </div>

          <Panel
            title="Head to head"
            right={verdict ? `${verdict.aWins}–${verdict.bWins}${verdict.tied ? ` · ${verdict.tied} tied` : ''}` : undefined}
          >
            {rows.length === 0 ? (
              <EmptyHint>Not enough shared data to compare these two</EmptyHint>
            ) : (
              <Spine rows={rows} aSide="neutral" bSide="neutral" />
            )}
          </Panel>

          {verdict && (
            <Panel title="Read">
              <p className="wor-name p-3 text-sm leading-relaxed text-[color:var(--color-text-1)]">{verdict.summary}</p>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
