import type { ReactNode } from 'react';

export interface ScorelineSide {
  chip: ReactNode;
  /** The side's name — data, so it keeps its casing. */
  name: string;
  value: ReactNode;
  /** What the number is, in words. */
  sub: string;
  hue: string;
}

/**
 * The result, first. Two sides, the winner at full strength and the loser
 * greyed, with a hairline stripe underneath showing the split.
 *
 * The value shown is deliberately "casualties inflicted" rather than "taken":
 * in a ticket mode putting the other side down is the objective, so it reads
 * like a score.
 */
export function Scoreline({
  a,
  b,
  winner,
  label = 'Final',
}: {
  a: ScorelineSide;
  b: ScorelineSide;
  /** 'a' | 'b' | null — null greys neither, for a draw. */
  winner: 'a' | 'b' | null;
  label?: string;
}) {
  const aTotal = Number(a.value) || 0;
  const bTotal = Number(b.value) || 0;
  const split = aTotal + bTotal > 0 ? (aTotal / (aTotal + bTotal)) * 100 : 50;
  return (
    <div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 py-6">
        <Side side={a} lost={winner === 'b'} align="start" />
        <div className="flex flex-col items-center gap-1.5 text-[color:var(--color-text-2)]">
          <span className="h-5 w-px bg-[color:var(--color-border-strong)]" />
          <span className="text-2xs uppercase tracking-widest">{label}</span>
          <span className="h-5 w-px bg-[color:var(--color-border-strong)]" />
        </div>
        <Side side={b} lost={winner === 'a'} align="end" />
      </div>
      {/* The stripe shows how the total splits between two differently-coloured
          sides. In a neutral comparison both hues are the same ink, so it would
          read as one flat bar — drop it rather than draw a meaningless one. */}
      {a.hue !== b.hue && (
        <div className="flex h-1">
          <span style={{ width: `${split}%`, background: a.hue }} />
          <span className="flex-1" style={{ background: b.hue }} />
        </div>
      )}
    </div>
  );
}

function Side({ side, lost, align }: { side: ScorelineSide; lost: boolean; align: 'start' | 'end' }) {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${align === 'end' ? 'items-end text-right' : 'items-start'}`}>
      {side.chip}
      <span
        className={`wor-name truncate font-mono text-base ${
          lost ? 'text-[color:var(--color-text-2)]' : 'text-[color:var(--color-text-0)]'
        }`}
      >
        {side.name}
      </span>
      <span
        className="font-mono text-5xl leading-none tabular-nums"
        style={{ color: lost ? 'var(--color-text-2)' : side.hue, letterSpacing: '-0.04em' }}
      >
        {side.value}
      </span>
      <span className="text-2xs uppercase tracking-wider text-[color:var(--color-text-2)]">{side.sub}</span>
    </div>
  );
}
