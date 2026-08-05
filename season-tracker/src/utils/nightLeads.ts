/**
 * Which matchups a night actually ran.
 *
 * Most nights run one: two lead units, both rounds. Playoff and
 * single-round-lead nights can run a different pair in each round — 8th OH v
 * II Corps, then MSG v FSB — and a schedule that prints only the first hides
 * half the night. A round with no lead of its own falls back to the night's,
 * which is how the points table and the Elo replay read it too.
 */

export interface LeadPair {
  a: string | null;
  b: string | null;
}

export interface NightLeadsInput {
  leadA?: string | null;
  leadB?: string | null;
  leadA_r1?: string | null;
  leadB_r1?: string | null;
  leadA_r2?: string | null;
  leadB_r2?: string | null;
  isPlayoffs?: boolean;
  isSingleRoundLeads?: boolean;
}

export interface NightLeads {
  /** Round one's pair, or the night's single one. Null when no lead is set. */
  first: LeadPair | null;
  /** Round two's, only when it differs from the first. */
  second: LeadPair | null;
}

const pair = (a?: string | null, b?: string | null): LeadPair | null =>
  a || b ? { a: a || null, b: b || null } : null;

export function nightLeadPairs(w: NightLeadsInput): NightLeads {
  const split = !!(w.isPlayoffs || w.isSingleRoundLeads);
  const round = (r: 1 | 2) =>
    pair(r === 1 ? w.leadA_r1 || w.leadA : w.leadA_r2 || w.leadA,
         r === 1 ? w.leadB_r1 || w.leadB : w.leadB_r2 || w.leadB);

  const r1 = split ? round(1) : pair(w.leadA, w.leadB);
  const r2 = split ? round(2) : null;
  const same = !!r1 && !!r2 && r1.a === r2.a && r1.b === r2.b;
  return {
    // One round set is still one matchup, whichever round it was.
    first: r1 || r2,
    second: !r1 || same ? null : r2,
  };
}
