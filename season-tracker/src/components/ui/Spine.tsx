import type { ReactNode } from 'react';
import { spineRow, isTextRow, type SpineRow, type SpineTextRow } from './spineModel';

export type SpineSide = 'usa' | 'csa' | 'neutral';

const HUE: Record<SpineSide, string> = {
  usa: 'var(--color-usa)',
  csa: 'var(--color-csa)',
  neutral: 'var(--color-text-0)',
};

/**
 * Mirrored comparison: two values either side of a centre rule, one line per
 * metric, the winning side at full strength and the other muted. Reads a round,
 * a night, two players or two units — only the values and the side colours change.
 *
 * Use `neutral` for both sides when the comparison is not between factions, so
 * a faction hue never stands in for "player A".
 */
export function Spine({
  rows,
  aSide = 'usa',
  bSide = 'csa',
}: {
  rows: (SpineRow | SpineTextRow)[];
  aSide?: SpineSide;
  bSide?: SpineSide;
}) {
  return (
    <div className="border-t border-[color:var(--color-border)]">
      {rows.map((row) => {
        if (isTextRow(row)) {
          return (
            <Row key={row.label} label={row.label} sub={row.sub}>
              <div className="text-right text-xs text-[color:var(--color-text-1)]">{row.aText}</div>
              <div />
              <div className="text-left text-xs text-[color:var(--color-text-1)]">{row.bText}</div>
            </Row>
          );
        }
        const v = spineRow(row);
        const aOn = v.winner !== 'b';
        const bOn = v.winner !== 'a';
        return (
          <Row key={row.label} label={v.label} sub={v.sub}>
            <Value text={v.aText} on={aOn} align="right" />
            <Track width={v.aWidth} hue={HUE[aSide]} on={aOn} side="left" />
            <Track width={v.bWidth} hue={HUE[bSide]} on={bOn} side="right" />
            <Value text={v.bText} on={bOn} align="left" />
          </Row>
        );
      })}
    </div>
  );
}

/** Grid shell: value · track · label · track · value, with a centre hairline. */
function Row({ label, sub, children }: { label: string; sub?: string; children: ReactNode }) {
  const kids = Array.isArray(children) ? children : [children];
  const [a, aTrack, bTrack, b] = kids.length === 4 ? kids : [kids[0], null, kids[2], null];
  return (
    <div className="relative grid grid-cols-[56px_1fr_auto_1fr_56px] items-center gap-2 border-b border-[color:var(--color-border)] px-3 py-1.5 hover:bg-[color:var(--color-bg-2)]">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[color:var(--color-border)]"
      />
      <div className="text-right font-mono text-sm tabular-nums">{a}</div>
      <div className="flex justify-end">{aTrack}</div>
      <div className="z-10 w-[150px] text-center">
        <div className="text-xs uppercase tracking-wider text-[color:var(--color-text-1)]">{label}</div>
        {sub && <div className="text-2xs text-[color:var(--color-text-2)]">{sub}</div>}
      </div>
      <div className="flex justify-start">{bTrack}</div>
      <div className="text-left font-mono text-sm tabular-nums">{b}</div>
    </div>
  );
}

function Value({ text, on, align }: { text: string; on: boolean; align: 'left' | 'right' }) {
  return (
    <span
      className={`block ${align === 'right' ? 'text-right' : 'text-left'} ${
        on ? 'font-semibold text-[color:var(--color-text-0)]' : 'text-[color:var(--color-text-2)]'
      }`}
    >
      {text}
    </span>
  );
}

function Track({
  width,
  hue,
  on,
  side,
}: {
  width: number;
  hue: string;
  on: boolean;
  side: 'left' | 'right';
}) {
  return (
    <span
      className={`flex h-2 w-full bg-[color:var(--color-bg-2)] ${side === 'left' ? 'justify-end' : 'justify-start'}`}
    >
      <span style={{ width: `${width}%`, background: hue, opacity: on ? 1 : 0.28 }} />
    </span>
  );
}
