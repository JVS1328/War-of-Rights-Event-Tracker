import type { ReactNode } from 'react';

export type PillTone = 'neutral' | 'accent' | 'danger' | 'ok' | 'warn';

const TONE_VAR: Record<PillTone, string> = {
  neutral: 'var(--color-text-1)',
  accent: 'var(--color-accent)',
  danger: 'var(--color-danger)',
  ok: 'var(--color-ok)',
  warn: 'var(--color-warn)',
};

/** Small outlined badge, color-toned by semantic meaning. */
export function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: PillTone }) {
  const colorVar = TONE_VAR[tone];
  return (
    <span
      className="inline-flex items-center gap-1 border px-1.5 py-0.5 text-xs uppercase tracking-wider font-mono"
      style={{ borderColor: colorVar, color: colorVar }}
    >
      {children}
    </span>
  );
}
