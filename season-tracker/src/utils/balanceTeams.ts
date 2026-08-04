/**
 * Splitting the night's units into two sides.
 *
 * Every partition of the available units is scored on six metrics, each
 * normalised across all partitions so the weights mean something relative to
 * one another rather than to whatever scale a metric happens to use. The best
 * few partitions that also satisfy the hard constraint — sides within
 * `maxPlayerDiff` players of each other — come back as options to choose from.
 *
 * Pure, and it reports its problems as data. The version this replaces raised
 * alert() from inside the scoring loop, which made it untestable and put a
 * modal in front of the user mid-calculation.
 */

export interface UnitCount {
  min: number;
  max: number;
}

export interface BalanceWeights {
  /** How often these units have already been on the same side. */
  teammate: number;
  /** Difference in expected head count. */
  avgDiff: number;
  /** Difference in number of units. */
  regimentCount: number;
  /** How alike the two sides' min→max spreads are. */
  rangeSimilarity: number;
  /** Rewards putting division rivals opposite each other. */
  divisionOpposition: number;
  /** Evens playoff-pedigree units across the sides. */
  postSeasonSkill: number;
}

export interface BalanceInput {
  /** Units to split. Anything fielding nobody is sat out first — see satOut. */
  available: string[];
  counts: Record<string, UnitCount>;
  /** Pairs forced onto opposite sides: [side A unit, side B unit]. */
  opposingPairs: [string, string][];
  maxPlayerDiff: number;
  /** unit → unit → nights already spent on the same side. */
  teammateHistory: Record<string, Record<string, number>>;
  divisions?: { name: string; units: string[] }[];
  /** Units with playoff pedigree, to even out; null outside the post-season. */
  postSeasonSkillUnits?: Set<string> | null;
  weights: BalanceWeights;
  optionCount: number;
  /** Unit → Elo, so an option can report how the sides compare on rating. */
  elo?: Record<string, number>;
  /** Override the enumeration ceiling. Defaults to {@link MAX_FREE_UNITS}. */
  maxFreeUnits?: number;
}

export interface BalanceOption {
  teamA: string[];
  teamB: string[];
  minA: number;
  maxA: number;
  minB: number;
  maxB: number;
  avgA: number;
  avgB: number;
  /** |avgA − avgB| — the headline "how even is this" figure. */
  avgDiff: number;
  /** The weighted score the option was chosen on; lower is better. */
  compositeScore: number;
  /** Shared-side history inside each team, summed. Lower means more variety. */
  teammateScore: number;
  /** Units from the same division facing each other. */
  divisionMatchups: { unitA: string; unitB: string; division: string }[];
  avgEloA: number | null;
  avgEloB: number | null;
}

export type BalanceFailure =
  | { kind: 'conflict'; units: string[] }
  | { kind: 'nothing-to-balance' }
  | { kind: 'too-many-units'; count: number; limit: number }
  /** A best-effort partition exists but breaks the max-difference constraint. */
  | { kind: 'no-valid'; best: BalanceOption; gap: number };

export type BalanceResult =
  | { ok: true; options: BalanceOption[]; satOut: string[] }
  | { ok: false; failure: BalanceFailure; satOut: string[] };

/**
 * Every partition is enumerated, so the cost doubles with each unit left free.
 * Measured at roughly three microseconds a partition across two passes: 18
 * units is under two seconds, 20 is about six, 22 is nearly half a minute. The
 * ceiling sits at 20 — past that the tab would look hung, so it is refused
 * with an explanation instead.
 */
export const MAX_FREE_UNITS = 20;

const METRICS = [
  'teammateScore',
  'avgDiff',
  'regimentCountDiff',
  'rangeSimilarity',
  'divisionOppositionScore',
  'postSeasonSkillDiff',
] as const;
type Metric = (typeof METRICS)[number];

const WEIGHT_OF: Record<Metric, keyof BalanceWeights> = {
  teammateScore: 'teammate',
  avgDiff: 'avgDiff',
  regimentCountDiff: 'regimentCount',
  rangeSimilarity: 'rangeSimilarity',
  divisionOppositionScore: 'divisionOpposition',
  postSeasonSkillDiff: 'postSeasonSkill',
};

/** Being on the same side more often than average is penalised this much harder. */
const OVER_TEAMING_PENALTY = 10;

/**
 * Units that field nobody this night. A unit with no recorded count at all is
 * treated the same as one recorded at 0 — neither can put men on the field, so
 * neither belongs in a partition.
 */
export function sitOuts(available: string[], counts: Record<string, UnitCount>): string[] {
  return available.filter((u) => {
    const c = counts[u];
    return !c || ((Number(c.min) || 0) === 0 && (Number(c.max) || 0) === 0);
  });
}

/** Mean teammate count across every distinct pair with any history. */
export function averageTeammateCount(history: Record<string, Record<string, number>>): number {
  const seen = new Set<string>();
  let total = 0;
  let n = 0;
  for (const [a, others] of Object.entries(history)) {
    for (const [b, count] of Object.entries(others)) {
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      if (seen.has(key)) continue;
      seen.add(key);
      total += count;
      n += 1;
    }
  }
  return n > 0 ? total / n : 0;
}

const mean = (xs: number[]): number | null => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

export function balanceTeams(input: BalanceInput): BalanceResult {
  const { available, counts, opposingPairs, maxPlayerDiff, teammateHistory, weights } = input;
  const satOut = sitOuts(available, counts);
  const satOutSet = new Set(satOut);
  const playing = available.filter((u) => !satOutSet.has(u)).sort();

  const forcedA = [...new Set(opposingPairs.map((p) => p[0]).filter(Boolean))];
  const forcedB = [...new Set(opposingPairs.map((p) => p[1]).filter(Boolean))];
  const conflict = forcedA.filter((u) => forcedB.includes(u));
  if (conflict.length) return { ok: false, failure: { kind: 'conflict', units: conflict }, satOut };

  // A forced unit that is sitting out cannot be placed, so it drops with the rest.
  const keepForced = (xs: string[]) => xs.filter((u) => !satOutSet.has(u));
  const fixedA = keepForced(forcedA);
  const fixedB = keepForced(forcedB);
  const forcedSet = new Set([...fixedA, ...fixedB]);
  const free = playing.filter((u) => !forcedSet.has(u));

  if (playing.length === 0) return { ok: false, failure: { kind: 'nothing-to-balance' }, satOut };
  const ceiling = input.maxFreeUnits ?? MAX_FREE_UNITS;
  if (free.length > ceiling) {
    return { ok: false, failure: { kind: 'too-many-units', count: free.length, limit: ceiling }, satOut };
  }

  const unitDivision: Record<string, string> = {};
  const useDivisions = weights.divisionOpposition > 0 && (input.divisions?.length ?? 0) > 0;
  if (useDivisions) {
    for (const div of input.divisions!) for (const u of div.units) unitDivision[u] = div.name;
  }

  const avgTeammates = averageTeammateCount(teammateHistory);
  const overTeamingThreshold = Math.round(avgTeammates);
  const skill = input.postSeasonSkillUnits ?? null;

  const num = (v: unknown) => Number(v) || 0;
  const minOf = (u: string) => num(counts[u]?.min);
  const maxOf = (u: string) => num(counts[u]?.max);

  const n = free.length;
  const total = 1 << n;

  interface Raw extends Record<Metric, number> {}
  interface Eval {
    raw: Raw;
    minA: number;
    maxA: number;
    minB: number;
    maxB: number;
    valid: boolean;
    gap: number;
  }

  const sideOfMask = (mask: number): [string[], string[]] => {
    const a = [...fixedA];
    const b = [...fixedB];
    for (let i = 0; i < n; i++) (mask & (1 << i) ? a : b).push(free[i]);
    return [a, b];
  };

  const evaluate = (mask: number): Eval => {
    const [a, b] = sideOfMask(mask);
    let minA = 0;
    let maxA = 0;
    let minB = 0;
    let maxB = 0;
    for (const u of a) {
      minA += minOf(u);
      maxA += maxOf(u);
    }
    for (const u of b) {
      minB += minOf(u);
      maxB += maxOf(u);
    }
    const avgA = a.length ? (minA + maxA) / 2 : 0;
    const avgB = b.length ? (minB + maxB) / 2 : 0;

    let teammateScore = 0;
    const scoreSide = (side: string[]) => {
      for (let i = 0; i < side.length; i++) {
        for (let j = i + 1; j < side.length; j++) {
          const c = teammateHistory[side[i]]?.[side[j]] ?? 0;
          teammateScore += avgTeammates > 0 && c > overTeamingThreshold ? c * OVER_TEAMING_PENALTY : c;
        }
      }
    };
    scoreSide(a);
    scoreSide(b);

    let divisionOppositionScore = 0;
    if (useDivisions) {
      for (const uA of a) {
        const d = unitDivision[uA];
        if (!d) continue;
        for (const uB of b) if (unitDivision[uB] === d) divisionOppositionScore -= 1;
      }
    }

    let postSeasonSkillDiff = 0;
    if (skill) {
      let qA = 0;
      let qB = 0;
      for (const u of a) if (skill.has(u)) qA += 1;
      for (const u of b) if (skill.has(u)) qB += 1;
      postSeasonSkillDiff = Math.abs(qA - qB);
    }

    // The two sides only truly clash when their possible head counts don't
    // overlap at all — that gap, not the raw min/max difference, is the one
    // that cannot be papered over on the night.
    let gap = 0;
    if (maxA < minB) gap = minB - maxA;
    else if (maxB < minA) gap = minA - maxB;
    const avgDiff = Math.abs(avgA - avgB);

    return {
      raw: {
        teammateScore,
        avgDiff,
        regimentCountDiff: Math.abs(a.length - b.length),
        rangeSimilarity: Math.abs(maxA - minA - (maxB - minB)),
        divisionOppositionScore,
        postSeasonSkillDiff,
      },
      minA,
      maxA,
      minB,
      maxB,
      valid: gap <= maxPlayerDiff && avgDiff <= maxPlayerDiff,
      gap,
    };
  };

  // Pass 1: the range of every metric across all partitions, so pass 2 can
  // normalise. Without it a metric that happens to run 0–400 would swamp one
  // that runs 0–3 regardless of the weights.
  const lo: Record<string, number> = {};
  const hi: Record<string, number> = {};
  for (const k of METRICS) {
    lo[k] = Infinity;
    hi[k] = -Infinity;
  }
  for (let mask = 0; mask < total; mask++) {
    const { raw } = evaluate(mask);
    for (const k of METRICS) {
      if (raw[k] < lo[k]) lo[k] = raw[k];
      if (raw[k] > hi[k]) hi[k] = raw[k];
    }
  }

  const scoreOf = (raw: Raw): number => {
    let score = 0;
    for (const k of METRICS) {
      const span = hi[k] - lo[k];
      const normalized = span === 0 ? 0 : (raw[k] - lo[k]) / span;
      score += normalized * (weights[WEIGHT_OF[k]] ?? 0);
    }
    return score;
  };

  const topN = Math.max(1, input.optionCount || 1);
  const best: { mask: number; score: number; ev: Eval }[] = [];
  let overall: { mask: number; score: number; ev: Eval } | null = null;

  for (let mask = 0; mask < total; mask++) {
    const ev = evaluate(mask);
    const score = scoreOf(ev.raw);
    if (ev.valid) {
      let at = best.length;
      for (let i = 0; i < best.length; i++) {
        if (score < best[i].score) {
          at = i;
          break;
        }
      }
      if (at < topN) {
        best.splice(at, 0, { mask, score, ev });
        if (best.length > topN) best.pop();
      }
    }
    if (!overall || score < overall.score) overall = { mask, score, ev };
  }

  const toOption = (entry: { mask: number; score: number; ev: Eval }): BalanceOption => {
    const [teamA, teamB] = sideOfMask(entry.mask);
    const { minA, maxA, minB, maxB } = entry.ev;
    const avgA = teamA.length ? (minA + maxA) / 2 : 0;
    const avgB = teamB.length ? (minB + maxB) / 2 : 0;
    const matchups: BalanceOption['divisionMatchups'] = [];
    if (useDivisions) {
      for (const uA of teamA) {
        const d = unitDivision[uA];
        if (!d) continue;
        for (const uB of teamB) if (unitDivision[uB] === d) matchups.push({ unitA: uA, unitB: uB, division: d });
      }
    }
    const eloOf = (side: string[]) =>
      input.elo ? mean(side.map((u) => input.elo![u]).filter((v): v is number => typeof v === 'number')) : null;
    return {
      teamA: [...teamA].sort(),
      teamB: [...teamB].sort(),
      minA,
      maxA,
      minB,
      maxB,
      avgA,
      avgB,
      avgDiff: Math.abs(avgA - avgB),
      compositeScore: entry.score,
      teammateScore: entry.ev.raw.teammateScore,
      divisionMatchups: matchups,
      avgEloA: eloOf(teamA),
      avgEloB: eloOf(teamB),
    };
  };

  if (best.length > 0) return { ok: true, options: best.map(toOption), satOut };
  // No partition satisfies the constraint; hand back the closest one so the UI
  // can say by how much it missed rather than just "failed".
  const fallback = toOption(overall!);
  return { ok: false, failure: { kind: 'no-valid', best: fallback, gap: overall!.ev.gap }, satOut };
}

/** One line explaining a failure, for the status row. */
export function describeFailure(f: BalanceFailure, maxPlayerDiff: number): string {
  switch (f.kind) {
    case 'conflict':
      return `${f.units.join(', ')} ${f.units.length === 1 ? 'is' : 'are'} forced onto both sides — remove one of the pairs.`;
    case 'nothing-to-balance':
      return 'Every available unit is fielding nobody. Set player counts before balancing.';
    case 'too-many-units':
      return `${f.count} units is past the ${f.limit} this can split — every partition is checked, and the count doubles each unit. Assign some to a side first.`;
    case 'no-valid': {
      const bits: string[] = [];
      if (f.gap > maxPlayerDiff) bits.push(`a head-count gap of ${f.gap}`);
      if (f.best.avgDiff > maxPlayerDiff) bits.push(`an average difference of ${f.best.avgDiff.toFixed(0)}`);
      const tolerance = `${maxPlayerDiff} player${maxPlayerDiff === 1 ? '' : 's'}`;
      return `No split stays within ${tolerance}. The closest has ${bits.join(' and ') || 'no room left'}.`;
    }
  }
}
