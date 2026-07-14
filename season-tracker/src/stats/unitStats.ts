import type { FormationCounts, ContextStatSlice, RegimentContextStats } from './statsEngine';
import { avgTicketCost } from './labels';
import { OVERALL_SCOPE } from './statsBundle';

/** token → the scoreboard regiment labels that played as it. */
export type TokenRegiments = Record<string, string[]>;
/**
 * Token→regiments keyed by scope (OVERALL_SCOPE or a season id). A season's own
 * entry for a token replaces the Overall entry entirely (a unit's roster that
 * changes in one season doesn't disturb the others); tokens a season leaves
 * unset inherit the Overall assignment.
 */
export type ScopedTokenRegiments = Record<string, TokenRegiments>;

/** Coerce a legacy flat map ({token: string[]}) or scoped map into scoped shape. */
export function normalizeScopedTokenRegiments(
  x: ScopedTokenRegiments | TokenRegiments | undefined | null,
): ScopedTokenRegiments {
  if (!x || typeof x !== 'object') return {};
  const clean = (m: TokenRegiments): TokenRegiments => {
    const out: TokenRegiments = {};
    for (const [t, regs] of Object.entries(m || {})) if (Array.isArray(regs) && regs.length) out[t] = [...regs];
    return out;
  };
  // Flat map: values are arrays of labels. Scoped: values are objects.
  const isFlat = Object.values(x).some((v) => Array.isArray(v));
  if (isFlat) {
    const cleaned = clean(x as TokenRegiments);
    return Object.keys(cleaned).length ? { [OVERALL_SCOPE]: cleaned } : {};
  }
  const out: ScopedTokenRegiments = {};
  for (const [scope, map] of Object.entries(x as ScopedTokenRegiments)) {
    const cleaned = clean(map);
    if (Object.keys(cleaned).length) out[scope] = cleaned;
  }
  return out;
}

/**
 * The token→regiments map in effect for a scope: Overall assignments with the
 * season's own per-token entries layered on top (season replaces the whole list
 * for a token). For OVERALL_SCOPE this is just the Overall assignments.
 */
export function effectiveTokenRegiments(
  scoped: ScopedTokenRegiments,
  scope: string,
): TokenRegiments {
  const overall = scoped[OVERALL_SCOPE] ?? {};
  if (scope === OVERALL_SCOPE) return { ...overall };
  return { ...overall, ...(scoped[scope] ?? {}) };
}

/**
 * Every regiment a token has been assigned across all scopes, de-duplicated —
 * the token's full roster over the event. Used for cross-season ("event totals")
 * unique-player and context tallies, where any scope's regiment can contribute.
 */
export function unionTokenRegiments(scoped: ScopedTokenRegiments): TokenRegiments {
  const out: Record<string, Set<string>> = {};
  for (const map of Object.values(scoped)) {
    for (const [token, regs] of Object.entries(map)) {
      (out[token] ??= new Set<string>());
      for (const r of regs) out[token].add(r);
    }
  }
  const result: TokenRegiments = {};
  for (const [token, set] of Object.entries(out)) result[token] = [...set];
  return result;
}

/**
 * Per-token stat snapshot — the summable components needed to show K/D, the
 * formation makeup of deaths/kills, and ×Td/×Tk at any aggregation scope.
 * Kept summable (counts, not averages) so rounds roll into weeks/seasons/events.
 */
export interface UnitSnap {
  kills: number;
  deaths: number;
  /** Deaths bucketed by the stance the player died in (drives ×Td). */
  deathsForm: FormationCounts;
  /** Kills bucketed by the victim's stance (drives ×Tk). */
  killsForm: FormationCounts;
}

/** Minimal regiment shape consumed from the stats engine's breakdown. */
export interface RegimentLike {
  regiment: string;
  kills: number;
  deaths: number;
  casualtiesByFormation: FormationCounts;
  killsByFormation: FormationCounts;
}

export function emptyUnitSnap(): UnitSnap {
  return {
    kills: 0,
    deaths: 0,
    deathsForm: { in_form: 0, skirm: 0, oob: 0 },
    killsForm: { in_form: 0, skirm: 0, oob: 0 },
  };
}

const addForm = (a: FormationCounts, b: FormationCounts): FormationCounts => ({
  in_form: a.in_form + b.in_form,
  skirm: a.skirm + b.skirm,
  oob: a.oob + b.oob,
});

export function addUnitSnap(a: UnitSnap, b: UnitSnap): UnitSnap {
  return {
    kills: a.kills + b.kills,
    deaths: a.deaths + b.deaths,
    deathsForm: addForm(a.deathsForm, b.deathsForm),
    killsForm: addForm(a.killsForm, b.killsForm),
  };
}

/**
 * For each token, sum the stats of the scoreboard regiments it has claimed in
 * one regiment breakdown. Regiments absent from the breakdown contribute zero.
 */
export function deriveTokenSnaps(
  breakdown: RegimentLike[],
  tokenRegiments: Record<string, string[]>,
): Record<string, UnitSnap> {
  const byReg = new Map(breakdown.map((r) => [r.regiment, r]));
  const out: Record<string, UnitSnap> = {};
  for (const [token, regs] of Object.entries(tokenRegiments)) {
    let snap = emptyUnitSnap();
    for (const reg of regs) {
      const r = byReg.get(reg);
      if (r) {
        snap = addUnitSnap(snap, {
          kills: r.kills,
          deaths: r.deaths,
          deathsForm: r.casualtiesByFormation,
          killsForm: r.killsByFormation,
        });
      }
    }
    out[token] = snap;
  }
  return out;
}

/**
 * Accumulate per-token snapshots across several regiment breakdowns (e.g. one
 * per scoreboard/round). The caller decides which breakdowns to include
 * (all = event totals; bound to weeks ≤ N = "as of week N").
 */
export function accumulateTokenSnaps(
  breakdowns: RegimentLike[][],
  tokenRegiments: Record<string, string[]>,
): Record<string, UnitSnap> {
  const out: Record<string, UnitSnap> = {};
  for (const token of Object.keys(tokenRegiments)) out[token] = emptyUnitSnap();
  for (const breakdown of breakdowns) {
    const snaps = deriveTokenSnaps(breakdown, tokenRegiments);
    for (const [token, snap] of Object.entries(snaps)) out[token] = addUnitSnap(out[token], snap);
  }
  return out;
}

/**
 * Like {@link accumulateTokenSnaps} but each breakdown carries its own token
 * mapping — used for the season-scoped Overall (event-totals) view, where a
 * scoreboard from one season must roll up under that season's token→regiments
 * assignment, not a single global one.
 */
export function accumulateTokenSnapsScoped(
  items: { breakdown: RegimentLike[]; mapping: TokenRegiments }[],
): Record<string, UnitSnap> {
  const out: Record<string, UnitSnap> = {};
  for (const { breakdown, mapping } of items) {
    const snaps = deriveTokenSnaps(breakdown, mapping);
    for (const [token, snap] of Object.entries(snaps)) {
      out[token] = addUnitSnap(out[token] ?? emptyUnitSnap(), snap);
    }
  }
  return out;
}

export function unitSnapAvgTd(snap: UnitSnap): number | null {
  return avgTicketCost(snap.deathsForm.in_form, snap.deathsForm.skirm, snap.deathsForm.oob);
}

export function unitSnapAvgTk(snap: UnitSnap): number | null {
  return avgTicketCost(snap.killsForm.in_form, snap.killsForm.skirm, snap.killsForm.oob);
}

/**
 * Derive unique-player and average-players-per-round counts for each token
 * directly from a regiment breakdown. The breakdown must come from a single
 * `computeRegimentBreakdown` call covering the desired scope so that
 * `players` reflects true unique counts.
 */
export function deriveTokenPlayerCounts(
  breakdown: readonly { regiment: string; players: number; avgPlayers: number }[],
  tokenRegiments: Record<string, string[]>,
): Record<string, { uniquePlayers: number; avgPlayers: number }> {
  const byReg = new Map(breakdown.map((r) => [r.regiment, r]));
  const out: Record<string, { uniquePlayers: number; avgPlayers: number }> = {};
  for (const [token, regs] of Object.entries(tokenRegiments)) {
    let uniquePlayers = 0;
    let avgPlayers = 0;
    for (const reg of regs) {
      const r = byReg.get(reg);
      if (r) {
        uniquePlayers += r.players;
        avgPlayers += r.avgPlayers;
      }
    }
    out[token] = { uniquePlayers, avgPlayers };
  }
  return out;
}

// ── Context-aware token snaps (faction & role breakdowns) ───────────────────

export interface UnitContextSnaps {
  asUSA: UnitSnap;
  asCSA: UnitSnap;
  asAttacker: UnitSnap;
  asDefender: UnitSnap;
}

function sliceToSnap(s: ContextStatSlice): UnitSnap {
  return {
    kills: s.kills,
    deaths: s.deaths,
    deathsForm: { ...s.casualtiesByFormation },
    killsForm: { ...s.killsByFormation },
  };
}

/**
 * Derive per-token context snaps (USA/CSA/Attacker/Defender) from the
 * per-regiment context stats produced by `computeRegimentContextStats`.
 */
export function deriveTokenContextSnaps(
  contextStats: Record<string, RegimentContextStats>,
  tokenRegiments: Record<string, string[]>,
): Record<string, UnitContextSnaps> {
  const out: Record<string, UnitContextSnaps> = {};
  for (const [token, regs] of Object.entries(tokenRegiments)) {
    let usa = emptyUnitSnap();
    let csa = emptyUnitSnap();
    let atk = emptyUnitSnap();
    let def = emptyUnitSnap();
    for (const reg of regs) {
      const ctx = contextStats[reg];
      if (!ctx) continue;
      usa = addUnitSnap(usa, sliceToSnap(ctx.asUSA));
      csa = addUnitSnap(csa, sliceToSnap(ctx.asCSA));
      atk = addUnitSnap(atk, sliceToSnap(ctx.asAttacker));
      def = addUnitSnap(def, sliceToSnap(ctx.asDefender));
    }
    out[token] = { asUSA: usa, asCSA: csa, asAttacker: atk, asDefender: def };
  }
  return out;
}
