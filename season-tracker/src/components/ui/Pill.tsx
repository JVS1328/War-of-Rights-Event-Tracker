import type { ReactNode } from 'react';

/** `usa` / `csa` are faction identity; `accent` is the UI's own accent and must
 *  never stand in for a side, or a selected control reads as Confederate. */
export type PillTone = 'neutral' | 'accent' | 'danger' | 'ok' | 'warn' | 'usa' | 'csa';

/** Small badge. Faction tones fill; everything else is a hairline outline. */
export function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: PillTone }) {
  if (tone === 'usa' || tone === 'csa') return <span className={`tag ${tone}`}>{children}</span>;
  if (tone === 'neutral') return <span className="tag q">{children}</span>;
  const hue = {
    accent: 'var(--live)',
    danger: 'var(--color-danger)',
    ok: 'var(--union)',
    warn: 'var(--reb)',
  }[tone];
  return <span className="tag q" style={{ borderColor: hue, color: hue }}>{children}</span>;
}
