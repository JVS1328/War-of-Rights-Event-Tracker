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
      <div className="score">
        <Side side={a} lost={winner === 'b'} />
        <div className="mid-col">
          <span className="v" />
          <span className="cap">{label}</span>
          <span className="v" />
        </div>
        <Side side={b} lost={winner === 'a'} align="r" />
      </div>
      {/* The stripe shows how the total splits between two differently-coloured
          sides. In a neutral comparison both hues are the same ink, so it would
          read as one flat bar — drop it rather than draw a meaningless one. */}
      {a.hue !== b.hue && (
        <div className="stripebar">
          <i style={{ width: `${split}%`, background: a.hue }} />
          <i style={{ flex: 1, background: b.hue }} />
        </div>
      )}
    </div>
  );
}

function Side({ side, lost, align }: { side: ScorelineSide; lost: boolean; align?: 'r' }) {
  return (
    <div className={`sd${align === 'r' ? ' r' : ''}${lost ? ' lose' : ''}`}>
      {side.chip}
      <span className="who wor-name">{side.name}</span>
      <span className="big" style={{ color: lost ? 'var(--ink-3)' : side.hue }}>{side.value}</span>
      <span className="sub">{side.sub}</span>
    </div>
  );
}
