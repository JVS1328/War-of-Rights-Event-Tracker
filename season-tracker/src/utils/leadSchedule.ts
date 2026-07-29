/**
 * Lead scheduling for the season simulator.
 *
 * A night is two rounds, and the lead mode decides who leads them:
 *   - 'fullWeeks': one unit per side leads both rounds  → 2 lead slots a night
 *   - 'rounds':    a different unit per side each round → 4 lead slots a night
 *
 * Either way the goals are the same: every token unit gets the same number of
 * lead nights, nobody leads twice on the same night, and a unit's leads sit as
 * far apart in the season as the numbers allow. Nights are filled one at a
 * time with the cheapest pair available, so PENALTY below *is* the priority
 * order — there is no second pass.
 *
 * The same file also describes a finished schedule (spacing stats) and turns
 * it into sheet-ready rows, so the tracker reads lead assignments in exactly
 * one place: weekLeadRounds().
 */

export type LeadMode = 'fullWeeks' | 'rounds';

/** Rounds played on a night. */
export const ROUNDS_PER_NIGHT = 2;

/** Lead slots a night consumes in each mode. */
export const LEADS_PER_NIGHT: Record<LeadMode, number> = { fullWeeks: 2, rounds: 4 };

/** Nights needed to give every unit `leadNightsPerUnit` lead nights. */
export const plannedNightCount = (unitCount: number, leadNightsPerUnit: number, mode: LeadMode): number =>
  Math.max(0, Math.floor((unitCount * leadNightsPerUnit) / LEADS_PER_NIGHT[mode]));

/**
 * What the scheduler is willing to trade away, worst first. Crowding — leading
 * again before a unit has had its ideal rest — is what we most want to avoid,
 * and it is charged on the square of how early the lead is: a slightly early
 * lead is cheaper than a rematch, a badly early one costs more than anything
 * else here. Below it sit an unmet division quota, a rematch, and two leads
 * sharing a side again.
 */
const PENALTY = {
  crowding: 100_000,
  divisionOwed: 20_000,
  rematch: 15_000,
  sameSide: 1_000,
};

/** Missing lead nights dominate any pick penalty when ranking attempts. */
const SHORTFALL = 1_000_000;

/** Random nudge, large enough only to split pairs that are otherwise equal. */
const TIE_BREAK = 0.5;

export interface LeadMatchup {
  leadA: string;
  leadB: string;
}

export interface LeadNight {
  /** One entry per separately-led round: 1 in 'fullWeeks', 2 in 'rounds'. */
  matchups: LeadMatchup[];
}

export interface LeadSchedule {
  nights: LeadNight[];
  leadCounts: Record<string, number>;
  divisionLeadCounts: Record<string, number>;
  /** Total penalty of the picks — lower is better spread and less repetitive. */
  cost: number;
}

export interface LeadScheduleOptions {
  /** Token units that take lead assignments. */
  units: string[];
  /** Nights each unit leads on. */
  leadNightsPerUnit: number;
  mode: LeadMode;
  /** Nights each unit should lead against its own division (0 = no requirement). */
  divisionNights?: number;
  unitToDivision?: Record<string, string | undefined>;
  /** Schedules to try; the cheapest one wins. */
  attempts?: number;
  random?: () => number;
}

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const bump = (counts: Map<string, number>, a: string, b: string) =>
  counts.set(pairKey(a, b), (counts.get(pairKey(a, b)) ?? 0) + 1);
const pairCount = (counts: Map<string, number>, a: string, b: string) => counts.get(pairKey(a, b)) ?? 0;

/** Build one candidate schedule. */
const buildOnce = (options: LeadScheduleOptions, random: () => number): LeadSchedule => {
  const { units, leadNightsPerUnit, mode, divisionNights = 0, unitToDivision = {} } = options;
  const matchupsPerNight = LEADS_PER_NIGHT[mode] / 2;
  const nightCount = plannedNightCount(units.length, leadNightsPerUnit, mode);
  /** Nights a unit should wait between its own leads. */
  const idealGap = nightCount / Math.max(1, leadNightsPerUnit) || 1;

  const leadCounts: Record<string, number> = {};
  const divisionLeadCounts: Record<string, number> = {};
  const lastLeadNight: Record<string, number> = {};
  units.forEach(unit => {
    leadCounts[unit] = 0;
    divisionLeadCounts[unit] = 0;
    // Start everyone exactly due, so night 0 is a clean slate.
    lastLeadNight[unit] = -idealGap;
  });

  /** Units per division that still have leads to give, refreshed each night. */
  const divisionsWithLeadsLeft = () => {
    const left: Record<string, number> = {};
    units.forEach(unit => {
      const division = unitToDivision[unit];
      if (division && leadCounts[unit] < leadNightsPerUnit) left[division] = (left[division] ?? 0) + 1;
    });
    return left;
  };
  let leadsLeftByDivision = divisionsWithLeadsLeft();

  const sameDivision = (a: string, b: string) => !!unitToDivision[a] && unitToDivision[a] === unitToDivision[b];
  // A quota only counts against a unit that still has a division mate to meet it
  // against — otherwise an unmeetable quota would price that unit out of leads.
  const owesDivision = (unit: string) => {
    const division = unitToDivision[unit];
    return divisionNights > 0 && !!division && leadsLeftByDivision[division] > 1
      && divisionLeadCounts[unit] < divisionNights;
  };

  const rematches = new Map<string, number>();
  const sameSide = new Map<string, number>();

  /** Rest a unit has had by this night, as a multiple of its ideal gap. 1 = due. */
  const rest = (unit: string, night: number) => (night - lastLeadNight[unit]) / idealGap;

  const pairCost = (a: string, b: string, night: number) => {
    const restA = rest(a, night);
    const restB = rest(b, night);
    const crowding = Math.max(0, 1 - restA) ** 2 + Math.max(0, 1 - restB) ** 2;
    const divisionMiss = sameDivision(a, b) ? 0 : Number(owesDivision(a)) + Number(owesDivision(b));
    return PENALTY.crowding * crowding
      + PENALTY.divisionOwed * divisionMiss
      + PENALTY.rematch * pairCount(rematches, a, b)
      - restA - restB; // among rested pairs, take the longest waiting
  };

  /** Cheapest pair of units still owed leads and not already leading tonight. */
  const pickPair = (night: number, taken: Set<string>) => {
    const pool = units.filter(unit => leadCounts[unit] < leadNightsPerUnit && !taken.has(unit));
    let best: LeadMatchup | null = null;
    let bestCost = Infinity;
    for (let i = 0; i < pool.length; i++) {
      for (let j = i + 1; j < pool.length; j++) {
        const cost = pairCost(pool[i], pool[j], night) + random() * TIE_BREAK;
        if (cost < bestCost) {
          bestCost = cost;
          best = { leadA: pool[i], leadB: pool[j] };
        }
      }
    }
    return best && { matchup: best, cost: bestCost };
  };

  const nights: LeadNight[] = [];
  let cost = 0;

  for (let night = 0; night < nightCount; night++) {
    leadsLeftByDivision = divisionsWithLeadsLeft();
    const taken = new Set<string>();
    const matchups: LeadMatchup[] = [];
    for (let slot = 0; slot < matchupsPerNight; slot++) {
      const picked = pickPair(night, taken);
      if (!picked) break;
      taken.add(picked.matchup.leadA);
      taken.add(picked.matchup.leadB);
      matchups.push(picked.matchup);
      cost += picked.cost;
    }
    // Not enough units left to fill the night — the season ends short.
    if (matchups.length < matchupsPerNight) break;

    if (matchups.length === 2) {
      // Round 2's sides are free: put the leads that have shared a team least often together.
      const [r1, r2] = matchups;
      const asIs = pairCount(sameSide, r1.leadA, r2.leadA) + pairCount(sameSide, r1.leadB, r2.leadB);
      const flipped = pairCount(sameSide, r1.leadA, r2.leadB) + pairCount(sameSide, r1.leadB, r2.leadA);
      if (flipped < asIs) matchups[1] = { leadA: r2.leadB, leadB: r2.leadA };
      cost += PENALTY.sameSide * Math.min(asIs, flipped);
      bump(sameSide, matchups[0].leadA, matchups[1].leadA);
      bump(sameSide, matchups[0].leadB, matchups[1].leadB);
    }

    matchups.forEach(({ leadA, leadB }) => {
      [leadA, leadB].forEach(unit => {
        leadCounts[unit] += 1;
        lastLeadNight[unit] = night;
      });
      bump(rematches, leadA, leadB);
      if (sameDivision(leadA, leadB)) {
        divisionLeadCounts[leadA] += 1;
        divisionLeadCounts[leadB] += 1;
      }
    });
    nights.push({ matchups });
  }

  return { nights, leadCounts, divisionLeadCounts, cost };
};

/** Lower is better: lead nights nobody got dominate the pick penalties. */
const scheduleScore = (schedule: LeadSchedule, { units, leadNightsPerUnit }: LeadScheduleOptions) =>
  units.reduce((short, unit) => short + Math.max(0, leadNightsPerUnit - schedule.leadCounts[unit]), 0) * SHORTFALL
  + schedule.cost;

/** Best of several attempts — they differ only in how ties were broken. */
export const buildLeadSchedule = (options: LeadScheduleOptions): LeadSchedule => {
  const random = options.random ?? Math.random;
  const attempts = Math.max(1, options.attempts ?? 24);
  let best = buildOnce(options, random);
  let bestScore = scheduleScore(best, options);
  for (let attempt = 1; attempt < attempts; attempt++) {
    const schedule = buildOnce(options, random);
    const score = scheduleScore(schedule, options);
    if (score < bestScore) {
      best = schedule;
      bestScore = score;
    }
  }
  return best;
};

/* --------------------------------- reading -------------------------------- */

/** The lead fields of a tracker week, in both lead shapes. */
export interface WeekLeads {
  name?: string;
  isSingleRoundLeads?: boolean;
  leadA?: string | null;
  leadB?: string | null;
  leadA_r1?: string | null;
  leadB_r1?: string | null;
  leadA_r2?: string | null;
  leadB_r2?: string | null;
  round1Map?: string | null;
  round2Map?: string | null;
}

export interface LeadRound {
  leadA: string | null;
  leadB: string | null;
}

/** A week's leads as one entry per round — the only place lead fields are read. */
export const weekLeadRounds = (week: WeekLeads): LeadRound[] => (
  week.isSingleRoundLeads
    ? [
        { leadA: week.leadA_r1 ?? null, leadB: week.leadB_r1 ?? null },
        { leadA: week.leadA_r2 ?? null, leadB: week.leadB_r2 ?? null },
      ]
    : Array.from({ length: ROUNDS_PER_NIGHT }, () => ({ leadA: week.leadA ?? null, leadB: week.leadB ?? null }))
);

export interface UnitLeadSpacing {
  unit: string;
  leadRounds: number;
  leadNights: number;
  /** Nights between consecutive lead nights. */
  gaps: number[];
  avgGap: number | null;
  minGap: number | null;
  maxGap: number | null;
}

export interface LeadSpacingSummary {
  nights: number;
  rounds: number;
  leadingUnits: number;
  avgLeadRounds: number;
  avgLeadNights: number;
  /** Nights a unit should wait between leads if they were perfectly spread. */
  idealGap: number | null;
  avgGap: number | null;
  minGap: number | null;
  maxGap: number | null;
  /** Leads on consecutive nights. */
  backToBack: number;
  /** A unit leading both rounds of a night that is meant to have separate leads. */
  doubleNights: number;
  perUnit: UnitLeadSpacing[];
}

const average = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

/** How evenly a set of weeks spreads its lead assignments. */
export const summarizeLeadSpacing = (weeks: WeekLeads[], units: string[]): LeadSpacingSummary => {
  const leadNights: Record<string, number[]> = {};
  const leadRounds: Record<string, number> = {};
  units.forEach(unit => { leadNights[unit] = []; leadRounds[unit] = 0; });
  let doubleNights = 0;

  weeks.forEach((week, night) => {
    const roundsLed: Record<string, number> = {};
    weekLeadRounds(week).forEach(({ leadA, leadB }) => {
      [leadA, leadB].forEach(unit => {
        if (!unit || !(unit in leadRounds)) return;
        leadRounds[unit] += 1;
        roundsLed[unit] = (roundsLed[unit] ?? 0) + 1;
      });
    });
    Object.entries(roundsLed).forEach(([unit, rounds]) => {
      leadNights[unit].push(night);
      if (week.isSingleRoundLeads && rounds > 1) doubleNights += 1;
    });
  });

  const perUnit: UnitLeadSpacing[] = units.map(unit => {
    const gaps = leadNights[unit].slice(1).map((night, i) => night - leadNights[unit][i]);
    return {
      unit,
      leadRounds: leadRounds[unit],
      leadNights: leadNights[unit].length,
      gaps,
      avgGap: average(gaps),
      minGap: gaps.length ? Math.min(...gaps) : null,
      maxGap: gaps.length ? Math.max(...gaps) : null,
    };
  });

  const leading = perUnit.filter(entry => entry.leadNights > 0);
  const allGaps = perUnit.flatMap(entry => entry.gaps);
  const avgLeadNights = average(leading.map(entry => entry.leadNights)) ?? 0;

  return {
    nights: weeks.length,
    rounds: weeks.length * ROUNDS_PER_NIGHT,
    leadingUnits: leading.length,
    avgLeadRounds: average(leading.map(entry => entry.leadRounds)) ?? 0,
    avgLeadNights,
    idealGap: avgLeadNights > 0 ? weeks.length / avgLeadNights : null,
    avgGap: average(allGaps),
    minGap: allGaps.length ? Math.min(...allGaps) : null,
    maxGap: allGaps.length ? Math.max(...allGaps) : null,
    backToBack: allGaps.filter(gap => gap === 1).length,
    doubleNights,
    perUnit,
  };
};

/* -------------------------------- exporting ------------------------------- */

export interface TeamNames {
  A: string;
  B: string;
}

/** Schedule as a header row plus one row per round, ready for a matchup sheet. */
export const scheduleExportRows = (
  weeks: WeekLeads[],
  teamNames: TeamNames = { A: 'Team A', B: 'Team B' },
): string[][] => {
  const hasMaps = weeks.some(week => week.round1Map || week.round2Map);
  const header = ['Week', 'Round', `${teamNames.A} Lead`, `${teamNames.B} Lead`, ...(hasMaps ? ['Map'] : [])];
  const rows = weeks.flatMap((week, index) => weekLeadRounds(week).map((round, roundIndex) => [
    week.name ?? `Week ${index + 1}`,
    `R${roundIndex + 1}`,
    round.leadA ?? '',
    round.leadB ?? '',
    ...(hasMaps ? [(roundIndex === 0 ? week.round1Map : week.round2Map) ?? ''] : []),
  ]));
  return [header, ...rows];
};

/** Tab-separated — what spreadsheets expect from a paste. */
export const toTsv = (rows: string[][]): string => rows.map(row => row.join('\t')).join('\n');

const csvCell = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

export const toCsv = (rows: string[][]): string => rows.map(row => row.map(csvCell).join(',')).join('\n');
