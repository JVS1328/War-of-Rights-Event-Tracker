/**
 * War of Rights per-side morale ("formation state"), as reported by the
 * scoreboard CSV (morale_usa / morale_csa) or entered manually. Listed in
 * severity order (best → worst) so averaging maps to a sensible middle state.
 */
export const MORALE_STATES = [
  'Battle Ready',
  'Engaged',
  'Taking Losses',
  'Breaking',
  'Final Push',
  'Last Stand',
] as const;

export type Morale = (typeof MORALE_STATES)[number];

const canonicalByKey: Record<string, Morale> = Object.fromEntries(
  MORALE_STATES.map((s) => [s.toLowerCase().replace(/[^a-z]/g, ''), s]),
);

/** Map a CSV/free-form morale value to a canonical state, or null. */
export function normalizeMorale(raw: string | null | undefined): Morale | null {
  if (!raw) return null;
  const key = raw.toLowerCase().replace(/[^a-z]/g, '');
  return canonicalByKey[key] ?? null;
}

/** Severity-weighted average of morale states → nearest canonical state, or null. */
export function averageMorale(states: Array<string | null | undefined>): Morale | null {
  const ordinals = states
    .map((s) => MORALE_STATES.indexOf(normalizeMorale(s) as Morale))
    .filter((i) => i >= 0);
  if (ordinals.length === 0) return null;
  const mean = ordinals.reduce((a, b) => a + b, 0) / ordinals.length;
  return MORALE_STATES[Math.round(mean)];
}
