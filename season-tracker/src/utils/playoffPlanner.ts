/**
 * Playoff format planner.
 *
 * Turning playoffs on leaves five numbers to guess — how many units qualify,
 * whether divisions gate entry, and how long each series runs — and the bracket
 * only draws cleanly for a handful of the combinations. This module works out
 * what a playoff config actually produces: who qualifies, what the bracket
 * generator does with them, how many nights it eats, and where the shape falls
 * apart. It then searches the config space and ranks the formats that fit both
 * the league and the calendar.
 *
 * The projection mirrors generatePlayoffBracket() in SeasonTracker.jsx — it has
 * to, or the planner would recommend settings the bracket cannot draw. Every
 * decision that generator makes off team counts is re-derived here from counts
 * alone, so the planner needs no standings and works on a season that has not
 * been played yet.
 *
 * Two behaviours of the bracket are worth stating up front, because most of the
 * advice below falls out of them:
 *
 *   - A round hosts exactly one matchup (one lead per side), so a two-round
 *     night fits two matchups. Nights, not stages, are the scarce resource.
 *   - `roundsPerMatch` is really "first to floor(n/2)+1 wins", so 2 and 3 are
 *     the same series — both need two wins and both can run to three rounds.
 */

import { ROUNDS_PER_NIGHT } from './leadSchedule';

/** Stages the bracket knows about, in the order they are played. */
export const STAGE_KEYS = ['wildcard', 'divisional', 'conference', 'finals'] as const;
export type StageKey = (typeof STAGE_KEYS)[number];

export type RoundFormats = Record<StageKey, number>;

/**
 * How the qualifiers are drawn against each other.
 *
 *   - 'conference' splits the field in two by conference and crowns each side
 *     before a championship. It needs exactly two conferences of the right size.
 *   - 'knockout' seeds the whole field 1..N on points and pairs 1-vs-N down the
 *     bracket, so it works with any number of groups — or none.
 */
export type BracketStyle = 'conference' | 'knockout';

export const BRACKET_STYLES: BracketStyle[] = ['knockout', 'conference'];

export interface PlayoffConfig {
  enabled: boolean;
  bracketStyle: BracketStyle;
  useDivisions: boolean;
  teamsPerDivision: number;
  wildcardTeams: number;
  roundFormats: RoundFormats;
}

/** Bounds the settings UI enforces; the search stays inside them. */
export const LIMITS = {
  teamsPerDivision: { min: 1, max: 4 },
  wildcardTeams: { min: 0, max: 16 },
  roundsPerMatch: { min: 1, max: 3 },
};

/** Smallest field the bracket generator will draw anything for. */
export const MIN_FIELD = 4;

/** Largest knockout the four configurable stages can cover. */
export const MAX_KNOCKOUT_FIELD = 16;

/**
 * Knockout stages take their series length from the four settings counting back
 * from the final, so a three-round bracket is quarters/semis/final and a
 * two-round one is semis/final — the same slots the 4-team bracket already used.
 */
const KNOCKOUT_ROUND_NAMES: Record<number, string> = {
  16: 'Round of 16',
  8: 'Quarterfinals',
  4: 'Semifinals',
  2: 'Finals',
};

/** What the bracket calls the round that `entering` teams start. */
export const knockoutRoundName = (entering: number): string =>
  KNOCKOUT_ROUND_NAMES[entering] ?? `Round of ${entering}`;

/**
 * Which roundFormats entry drives round `index` of a `roundCount`-round
 * knockout — counted back from the final, so the planner and the bracket
 * generator cannot drift on which setting governs which round.
 */
export const knockoutStageKey = (roundCount: number, index: number): StageKey =>
  STAGE_KEYS[STAGE_KEYS.length - roundCount + index];

/** Smallest power of two that seats `n`. */
export const nextPowerOfTwo = (n: number): number => {
  let slots = 1;
  while (slots < n) slots *= 2;
  return slots;
};

/**
 * Seed order for a knockout of `slots`: read in pairs, it is the standard
 * bracket where the top two seeds can only meet in the final. Eight slots give
 * 1v8, 4v5, 2v7, 3v6.
 */
export const knockoutSeedOrder = (slots: number): number[] => {
  let order = [1];
  while (order.length < slots) {
    const size = order.length * 2;
    const next: number[] = [];
    order.forEach(seed => next.push(seed, size + 1 - seed));
    order = next;
  }
  return order;
};

/**
 * Byes in a knockout, which always fall to the top seeds: a 6-team field sits
 * in an 8-slot bracket, so seeds 1 and 2 sit out the opening round.
 */
export const knockoutByes = (fieldSize: number): number =>
  Math.max(0, nextPowerOfTwo(fieldSize) - fieldSize);

/** Opening-round matchups with two real teams; the rest of the slots are byes. */
export const knockoutOpeningMatchups = (fieldSize: number): number => {
  const order = knockoutSeedOrder(nextPowerOfTwo(fieldSize));
  let real = 0;
  for (let i = 0; i < order.length; i += 2) {
    if (order[i] <= fieldSize && order[i + 1] <= fieldSize) real++;
  }
  return real;
};

/** Share of the league we want to reach the post-season. */
const TARGET_QUALIFY_RATE = 0.45;

/** How far from the target a field can drift before it stops scoring. */
const QUALIFY_TOLERANCE = 0.3;

export interface DivisionShape {
  name: string;
  /** Token units assigned to the division. */
  unitCount: number;
}

export interface LeagueShape {
  /** Token units in the season — everyone with a shot at the post-season. */
  unitCount: number;
  divisions: DivisionShape[];
  /** Nights the calendar can spare; each is ROUNDS_PER_NIGHT rounds. */
  nightsAvailable: number;
}

export type DefectSeverity = 'blocker' | 'warning';

export interface FormatDefect {
  severity: DefectSeverity;
  message: string;
}

/**
 * Conference a division belongs to. The bracket splits on the division name's
 * first word, so "Smoke North" and "Smoke South" are one conference — this has
 * to agree with generatePlayoffBracket() exactly.
 */
export const conferenceOf = (divisionName: string): string => {
  const name = String(divisionName ?? '').trim();
  return name.split(/\s+/)[0] || name;
};

export interface ConferenceField {
  name: string;
  /** Seats won by finishing top-N inside a division. */
  divisionSeats: number;
  /** Seats handed to the best units who missed a division seat. */
  wildcardSeats: number;
  size: number;
  /** Divisions here that sent nobody, because they hold no units. */
  shutOutDivisions: string[];
}

export interface PlayoffField {
  size: number;
  /** Per-conference split; empty for a knockout, which does not divide the field. */
  conferences: ConferenceField[];
  /** Seats won by finishing top-N in a group. */
  groupSeats: number;
  /** Seats won by the best units who missed a group seat. */
  wildcardSeats: number;
  /** Units with no route into the bracket at all under this config. */
  lockedOut: number;
}

/** Rounds a side must win to take a series. */
export const winsNeeded = (roundsPerMatch: number): number =>
  Math.floor(Math.max(1, roundsPerMatch) / 2) + 1;

/** Longest a first-to-N series can run: everyone trades until the decider. */
const longestSeries = (roundsPerMatch: number): number => winsNeeded(roundsPerMatch) * 2 - 1;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const clamp01 = (value: number) => clamp(value, 0, 1);

/**
 * Who qualifies under a config, without needing standings — only the counts
 * matter, because the bracket takes a fixed number of units off the top of each
 * division and conference.
 */
export const projectField = (config: PlayoffConfig, league: LeagueShape): PlayoffField => {
  const divisions = league.divisions ?? [];
  const unitCount = Math.max(0, league.unitCount);

  if (!config.useDivisions || divisions.length === 0) {
    // Simple top-N: wildcardTeams doubles as the field size, and 0 means 4.
    const asked = config.wildcardTeams || MIN_FIELD;
    const size = Math.min(asked, unitCount);
    return { size, conferences: [], groupSeats: 0, wildcardSeats: 0, lockedOut: 0 };
  }

  const perDivision = Math.max(1, config.teamsPerDivision);
  const assigned = divisions.reduce((sum, d) => sum + d.unitCount, 0);
  // Group play locks the bracket to units that sit in a group.
  const lockedOut = Math.max(0, unitCount - assigned);

  if (config.bracketStyle === 'knockout') {
    // One flat field: every group sends its top N, then the wildcard seats go
    // to the best of everyone left over, whichever group they came from.
    let groupSeats = 0;
    let pool = 0;
    divisions.forEach(division => {
      const seats = Math.min(division.unitCount, perDivision);
      groupSeats += seats;
      pool += division.unitCount - seats;
    });
    const wildcardSeats = Math.min(Math.max(0, config.wildcardTeams), pool);
    return { size: groupSeats + wildcardSeats, conferences: [], groupSeats, wildcardSeats, lockedOut };
  }

  const grouped = new Map<string, DivisionShape[]>();
  divisions.forEach(division => {
    const conf = conferenceOf(division.name);
    const bucket = grouped.get(conf);
    if (bucket) bucket.push(division);
    else grouped.set(conf, [division]);
  });

  const conferences: ConferenceField[] = [];
  grouped.forEach((confDivisions, name) => {
    let divisionSeats = 0;
    let pool = 0;
    const shutOutDivisions: string[] = [];
    confDivisions.forEach(division => {
      const seats = Math.min(division.unitCount, perDivision);
      divisionSeats += seats;
      pool += division.unitCount - seats;
      if (seats === 0) shutOutDivisions.push(division.name);
    });
    const wildcardSeats = Math.min(Math.max(0, config.wildcardTeams), pool);
    conferences.push({
      name,
      divisionSeats,
      wildcardSeats,
      size: divisionSeats + wildcardSeats,
      shutOutDivisions,
    });
  });

  return {
    size: conferences.reduce((sum, c) => sum + c.size, 0),
    conferences,
    groupSeats: conferences.reduce((sum, c) => sum + c.divisionSeats, 0),
    wildcardSeats: conferences.reduce((sum, c) => sum + c.wildcardSeats, 0),
    lockedOut,
  };
};

export interface StagePlan {
  /** Stage name as the bracket labels it. */
  name: string;
  /** Which roundFormats entry sets this stage's series length. */
  key: StageKey;
  /** Series that need rounds played. */
  matchups: number;
  roundsPerMatch: number;
  /** Rounds if every series is settled as early as it can be. */
  minRounds: number;
  /** Rounds if every series runs to a decider. */
  maxRounds: number;
}

interface Shape {
  stages: StagePlan[];
  /** Qualifiers the bracket actually seats in a matchup. */
  placed: number;
  /** Qualifiers that skip the opening round because the draw is not full. */
  byes: number;
  defects: FormatDefect[];
}

const makeStage = (name: string, key: StageKey, matchups: number, formats: RoundFormats): StagePlan => {
  const roundsPerMatch = clamp(
    formats[key] || 1,
    LIMITS.roundsPerMatch.min,
    LIMITS.roundsPerMatch.max,
  );
  return {
    name,
    key,
    matchups,
    roundsPerMatch,
    minRounds: matchups * winsNeeded(roundsPerMatch),
    maxRounds: matchups * longestSeries(roundsPerMatch),
  };
};

/**
 * A seeded knockout: everyone who qualifies is drawn, 1-vs-N down the bracket,
 * with byes to the top seeds when the field is not a power of two. Any field
 * from 4 to 16 comes out whole, whatever the groups behind it look like.
 */
const planKnockout = (field: PlayoffField, formats: RoundFormats): Shape => {
  const size = field.size;
  const defects: FormatDefect[] = [];

  if (size < MIN_FIELD) {
    defects.push({
      severity: 'blocker',
      message: `Only ${size} unit${size === 1 ? '' : 's'} qualify — a bracket needs ${MIN_FIELD}.`,
    });
    return { stages: [], placed: 0, byes: 0, defects };
  }
  if (size > MAX_KNOCKOUT_FIELD) {
    defects.push({
      severity: 'blocker',
      message: `${size} qualifiers is more than the ${MAX_KNOCKOUT_FIELD}-team bracket the four stage settings cover.`,
    });
    return { stages: [], placed: 0, byes: 0, defects };
  }

  const slots = nextPowerOfTwo(size);
  const roundCount = Math.round(Math.log2(slots));
  const stages: StagePlan[] = [];

  for (let round = 0; round < roundCount; round++) {
    const entering = slots >> round;
    const matchups = round === 0 ? knockoutOpeningMatchups(size) : entering / 2;
    const key = knockoutStageKey(roundCount, round);
    stages.push(makeStage(knockoutRoundName(entering), key, matchups, formats));
  }

  return { stages, placed: size, byes: knockoutByes(size), defects };
};

/**
 * The bracket the generator would build for this field, stage by stage.
 *
 * The conference bracket comes out whole in only two shapes — exactly 4 or at
 * least 6 qualifiers per conference, across exactly two conferences. The rest
 * are recorded as defects rather than quietly smoothed over: an organiser needs
 * to know that seeds 7 and 8 never take the field.
 */
const planConferenceShape = (field: PlayoffField, formats: RoundFormats): Shape => {
  const { size, conferences } = field;
  const defects: FormatDefect[] = [];
  const stages: StagePlan[] = [];
  let placed = 0;
  let byes = 0;

  if (size >= 8 && conferences.length > 0) {
    let wildcardMatchups = 0;
    let divisionalMatchups = 0;
    let liveConferences = 0;

    conferences.forEach(conf => {
      if (conf.size >= 6) {
        // Top two get byes, #3–#6 play in; seeds past #6 are never drawn.
        wildcardMatchups += 2;
        divisionalMatchups += 2;
        placed += 6;
        byes += 2; // the conference's top two skip the wildcard round
        liveConferences++;
      } else if (conf.size === 5) {
        wildcardMatchups += 2;
        divisionalMatchups += 1;
        placed += 5;
        byes += 1;
        liveConferences++;
        defects.push({
          severity: 'blocker',
          message: `${conf.name} has 5 qualifiers — the bracket leaves one divisional slot empty, so that conference final never fills.`,
        });
      } else if (conf.size === 4) {
        divisionalMatchups += 2;
        placed += 4;
        liveConferences++;
      } else {
        defects.push({
          severity: 'blocker',
          message: `${conf.name} has only ${conf.size} qualifier${conf.size === 1 ? '' : 's'} — it needs 4 to be drawn, so nobody from it plays.`,
        });
      }
    });

    if (wildcardMatchups > 0) stages.push(makeStage('Wildcard', 'wildcard', wildcardMatchups, formats));
    if (divisionalMatchups > 0) stages.push(makeStage('Divisional', 'divisional', divisionalMatchups, formats));
    if (liveConferences > 0) stages.push(makeStage('Conference Finals', 'conference', liveConferences, formats));
    if (conferences.length >= 2) stages.push(makeStage('Championship', 'finals', 1, formats));

    if (conferences.length > 2) {
      defects.push({
        severity: 'blocker',
        message: `The championship only pairs the first two conferences, so ${conferences.length - 2} conference winner${conferences.length - 2 === 1 ? '' : 's'} would have nowhere to play.`,
      });
    }
    if (conferences.length === 1) {
      defects.push({
        severity: 'warning',
        message: 'One conference means no championship round — the conference final is the title game.',
      });
    }
  } else if (size >= 8) {
    // Seeded top-6 shape: #1/#2 bye, #3–#6 play in. It draws a Championship
    // after the (single) "Conference Finals", but only one winner ever reaches
    // it, so that last card cannot resolve.
    stages.push(
      makeStage('Wildcard', 'wildcard', 2, formats),
      makeStage('Divisional', 'divisional', 2, formats),
      makeStage('Conference Finals', 'conference', 1, formats),
      makeStage('Championship', 'finals', 1, formats),
    );
    placed = 6;
    byes = 2;
    defects.push({
      severity: 'blocker',
      message: 'Without conferences the bracket draws a Championship that only ever receives one team — the title is really decided in the round before it.',
    });
  } else if (size >= MIN_FIELD) {
    stages.push(
      makeStage('Semifinals', 'conference', 2, formats),
      makeStage('Finals', 'finals', 1, formats),
    );
    placed = 4;
  } else {
    defects.push({
      severity: 'blocker',
      message: `Only ${size} unit${size === 1 ? '' : 's'} qualify — the bracket needs ${MIN_FIELD} before it draws anything.`,
    });
  }

  return { stages, placed, byes, defects };
};

const planShape = (field: PlayoffField, formats: RoundFormats, style: BracketStyle): Shape =>
  (style === 'knockout' ? planKnockout : planConferenceShape)(field, formats);

export interface FormatPlan {
  config: PlayoffConfig;
  field: PlayoffField;
  stages: StagePlan[];
  /** Qualifiers the bracket seats. */
  placed: number;
  /** Qualifiers it leaves out. */
  unplaced: number;
  /** Qualifiers handed a free pass through the opening round. */
  byes: number;
  minRounds: number;
  maxRounds: number;
  minNights: number;
  maxNights: number;
  /** Share of the league that reaches the post-season. */
  qualifyRate: number;
  fitsCalendar: boolean;
  defects: FormatDefect[];
  /** Things worth saying about a format that are not problems. */
  notes: string[];
  /** Short name, e.g. "8-team · 2 conferences". */
  label: string;
  /** One line covering entry, size and length. */
  summary: string;
  score: number;
}

const nightsFor = (rounds: number) => Math.ceil(rounds / ROUNDS_PER_NIGHT);

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** "3 nights" or "3–4 nights", whichever the series lengths allow. */
export const formatNights = (minNights: number, maxNights: number): string =>
  minNights === maxNights ? plural(minNights, 'night') : `${minNights}–${maxNights} nights`;

const buildLabel = (config: PlayoffConfig, field: PlayoffField): string => {
  if (config.bracketStyle === 'knockout') return `${field.size}-team seeded knockout`;
  if (field.conferences.length === 0) return `${field.size}-team · open seeding`;
  return `${field.size}-team · ${plural(field.conferences.length, 'conference')}`;
};

const buildSummary = (
  config: PlayoffConfig,
  plan: Omit<FormatPlan, 'summary' | 'score'>,
  league: LeagueShape,
): string => {
  const grouped = config.useDivisions && (plan.field.conferences.length > 0 || plan.field.groupSeats > 0);
  let entry: string;
  if (!grouped) {
    entry = `Top ${plan.field.size} in the standings`;
  } else if (config.bracketStyle === 'knockout') {
    const groups = league.divisions.length;
    entry = `Top ${config.teamsPerDivision} from each of ${plural(groups, 'group')}`
      + (plan.field.wildcardSeats > 0
        ? ` plus ${plural(plan.field.wildcardSeats, 'wildcard')}, seeded on total points`
        : ', seeded on total points');
  } else {
    entry = `Top ${config.teamsPerDivision} per division`
      + (config.wildcardTeams > 0 ? ` plus ${plural(config.wildcardTeams, 'wildcard')} per conference` : ', no wildcards');
  }
  const share = league.unitCount > 0 ? ` (${Math.round(plan.qualifyRate * 100)}% of the league)` : '';
  return `${entry} — ${plural(plan.field.size, 'unit')}${share}, ${formatNights(plan.minNights, plan.maxNights)}.`;
};

/**
 * How good a format is, on the things a league actually cares about: the
 * bracket has to be drawable, it has to fit the nights left, enough of the
 * league has to have something to play for, the series have to get longer
 * (not shorter) as the stakes rise, and every division should have a route in.
 */
const scorePlan = (plan: Omit<FormatPlan, 'score'>, league: LeagueShape): number => {
  const hasBlocker = plan.defects.some(d => d.severity === 'blocker');
  if (hasBlocker) return 0;

  const warnings = plan.defects.filter(d => d.severity === 'warning').length;

  // Calendar. Running past the nights available is close to disqualifying;
  // needing a decider or two beyond them is merely a risk.
  const fit = plan.minNights > league.nightsAvailable
    ? 0
    : plan.maxNights <= league.nightsAvailable ? 1 : 0.6;

  // Field size. Too small and the season stops mattering to most of the
  // league; too large and the regular season stops mattering at all.
  const access = clamp01(1 - Math.abs(plan.qualifyRate - TARGET_QUALIFY_RATE) / QUALIFY_TOLERANCE);

  // Everyone who qualifies should get a game, and nothing odd should be left
  // dangling in the draw.
  const unplacedShare = plan.field.size > 0 ? plan.unplaced / plan.field.size : 0;
  const integrity = clamp01(1 - unplacedShare - 0.2 * warnings);

  // Series that say what they mean: an even roundsPerMatch is really a
  // first-to-N that can run a round longer than its own label.
  const honest = plan.stages.filter(s => s.roundsPerMatch % 2 === 1).length;
  const labelling = plan.stages.length > 0 ? honest / plan.stages.length : 1;

  // Stakes. A title decided by one round is a coin flip on a map draw, so the
  // final earns a series first; after that, series should lengthen (or at least
  // hold) as the bracket narrows, and the spare nights should go into rounds
  // played rather than sit unused.
  const wins = plan.stages.map(s => winsNeeded(s.roundsPerMatch));
  const finalIsSeries = wins.length > 0 && wins[wins.length - 1] >= 2 ? 1 : 0;

  let escalates = 0;
  let comparisons = 0;
  for (let i = 1; i < wins.length; i++) {
    comparisons++;
    if (wins[i] >= wins[i - 1]) escalates++;
  }
  const monotone = comparisons > 0 ? escalates / comparisons : 1;

  const depth = wins.length > 0
    ? clamp01(wins.reduce((sum, w) => sum + w, 0) / wins.length - 1)
    : 0;

  const stakes = 0.5 * finalIsSeries + 0.25 * monotone + 0.25 * depth;

  // Groups only earn their keep if each one is a route into the bracket, and
  // winning your group should be the front door — wildcards are the back one.
  const divisionCount = league.divisions.length;
  let divisionFit = 1;
  if (divisionCount > 0) {
    if (!plan.config.useDivisions) divisionFit = 0.5;
    else {
      const shutOut = plan.field.conferences.reduce((n, c) => n + c.shutOutDivisions.length, 0);
      const seats = plan.field.groupSeats + plan.field.wildcardSeats;
      const throughGroup = seats > 0 ? plan.field.groupSeats / seats : 1;
      divisionFit = clamp01(1 - shutOut / divisionCount - (plan.field.lockedOut > 0 ? 0.25 : 0))
        * (0.75 + 0.25 * throughGroup);
    }
  }

  // A draw that fills every slot beats one that hands out byes. A bye is a free
  // pass to the next round, so a full bracket is worth a lot more than a
  // slightly better qualification rate — hence the cliff rather than a slope.
  const shape = plan.byes === 0
    ? 1
    : clamp01(0.6 - plan.byes / Math.max(1, plan.field.size));

  return (
    3.0 * fit +
    3.0 * integrity +
    2.0 * access +
    1.5 * stakes +
    1.25 * labelling +
    1.0 * divisionFit +
    1.5 * shape
  );
};

const normalizeConfig = (config: PlayoffConfig): PlayoffConfig => ({
  enabled: true,
  // Seasons saved before the knockout existed carry the conference bracket.
  bracketStyle: config.bracketStyle === 'knockout' ? 'knockout' : 'conference',
  useDivisions: !!config.useDivisions,
  teamsPerDivision: clamp(
    config.teamsPerDivision || 1,
    LIMITS.teamsPerDivision.min,
    LIMITS.teamsPerDivision.max,
  ),
  wildcardTeams: clamp(config.wildcardTeams || 0, LIMITS.wildcardTeams.min, LIMITS.wildcardTeams.max),
  roundFormats: STAGE_KEYS.reduce((acc, key) => {
    acc[key] = clamp(
      config.roundFormats?.[key] || 1,
      LIMITS.roundsPerMatch.min,
      LIMITS.roundsPerMatch.max,
    );
    return acc;
  }, {} as RoundFormats),
});

/** What a playoff config actually produces, scored against the league. */
export const evaluateFormat = (rawConfig: PlayoffConfig, league: LeagueShape): FormatPlan => {
  const config = normalizeConfig(rawConfig);
  const field = projectField(config, league);
  const { stages, placed, byes, defects } = planShape(field, config.roundFormats, config.bracketStyle);

  const minRounds = stages.reduce((sum, s) => sum + s.minRounds, 0);
  const maxRounds = stages.reduce((sum, s) => sum + s.maxRounds, 0);
  const minNights = nightsFor(minRounds);
  const maxNights = nightsFor(maxRounds);
  const unplaced = Math.max(0, field.size - placed);

  const allDefects = [...defects];
  if (unplaced > 0) {
    allDefects.push({
      severity: 'warning',
      message: `${plural(unplaced, 'qualifier')} would be seeded but never drawn into a matchup.`,
    });
  }
  if (field.lockedOut > 0) {
    allDefects.push({
      severity: 'warning',
      message: `${plural(field.lockedOut, 'unit')} sit in no group and cannot qualify while group play is on.`,
    });
  }
  if (minNights > league.nightsAvailable) {
    allDefects.push({
      severity: 'warning',
      message: `Needs ${formatNights(minNights, maxNights)} but only ${plural(league.nightsAvailable, 'night')} ${league.nightsAvailable === 1 ? 'is' : 'are'} set aside.`,
    });
  } else if (maxNights > league.nightsAvailable) {
    allDefects.push({
      severity: 'warning',
      message: `Fits in ${plural(league.nightsAvailable, 'night')} only if the series do not run to deciders (worst case ${plural(maxNights, 'night')}).`,
    });
  }

  const notes: string[] = [];
  const evenStages = stages.filter(s => s.roundsPerMatch % 2 === 0);
  if (evenStages.length > 0) {
    notes.push(
      `${evenStages.map(s => s.name).join(', ')} set to ${evenStages[0].roundsPerMatch} rounds resolve as first-to-${winsNeeded(evenStages[0].roundsPerMatch)}, so a level series goes to another round — setting ${winsNeeded(evenStages[0].roundsPerMatch) * 2 - 1} labels the same series honestly.`,
    );
  }
  if (stages.some(s => s.roundsPerMatch === 1)) {
    const single = stages.filter(s => s.roundsPerMatch === 1).map(s => s.name).join(', ');
    notes.push(`${single} decided by a single round — quickest, but a coin-flip map can end a run.`);
  }
  if (field.conferences.length > 0) {
    notes.push(
      field.conferences.map(c => `${c.name}: ${c.divisionSeats} division${c.wildcardSeats > 0 ? ` + ${c.wildcardSeats} wildcard` : ''} = ${c.size}`).join(' · '),
    );
  }
  if (config.bracketStyle === 'knockout') {
    if (byes > 0 && stages.length > 0) {
      notes.push(
        `${field.size} in a ${nextPowerOfTwo(field.size)}-slot bracket, so ${byes === 1 ? 'the top seed sits' : `seeds 1–${byes} sit`} out the opening round.`,
      );
    }
    if (field.groupSeats > 0) {
      notes.push(
        `${plural(field.groupSeats, 'seat')} won inside a group, ${field.wildcardSeats} on wildcards — all reseeded 1–${field.size} on total points.`,
      );
    }
  }

  const partial: Omit<FormatPlan, 'summary' | 'score'> = {
    config,
    field,
    stages,
    placed,
    unplaced,
    byes,
    minRounds,
    maxRounds,
    minNights,
    maxNights,
    qualifyRate: league.unitCount > 0 ? field.size / league.unitCount : 0,
    fitsCalendar: maxNights <= league.nightsAvailable,
    defects: allDefects,
    notes,
    label: buildLabel(config, field),
  };

  const summary = buildSummary(config, partial, league);
  const withSummary = { ...partial, summary };
  return { ...withSummary, score: scorePlan(withSummary, league) };
};

export interface SuggestOptions {
  /** How many formats to hand back. */
  limit?: number;
  /** Series lengths to try per stage. */
  roundChoices?: number[];
}

/**
 * Search the config space and return the best formats, one per distinct shape.
 *
 * Candidates are grouped by entry rule and field size before ranking, so the
 * shortlist offers real alternatives — a tight 4-team knockout next to a wider
 * conference bracket — rather than three spellings of the same bracket.
 */
export const suggestFormats = (league: LeagueShape, options: SuggestOptions = {}): FormatPlan[] => {
  const limit = options.limit ?? 3;
  const roundChoices = options.roundChoices ?? [1, 2, 3];
  const hasDivisions = league.divisions.length > 0;

  const structures: PlayoffConfig[] = [];
  const pushStructure = (
    bracketStyle: BracketStyle,
    useDivisions: boolean,
    teamsPerDivision: number,
    wildcardTeams: number,
  ) => {
    structures.push({
      enabled: true,
      bracketStyle,
      useDivisions,
      teamsPerDivision,
      wildcardTeams,
      roundFormats: { wildcard: 1, divisional: 1, conference: 1, finals: 1 },
    });
  };

  BRACKET_STYLES.forEach(style => {
    for (let field = MIN_FIELD; field <= LIMITS.wildcardTeams.max; field++) {
      pushStructure(style, false, 1, field);
    }
    if (hasDivisions) {
      for (let perDiv = LIMITS.teamsPerDivision.min; perDiv <= LIMITS.teamsPerDivision.max; perDiv++) {
        for (let wc = LIMITS.wildcardTeams.min; wc <= LIMITS.wildcardTeams.max; wc++) {
          pushStructure(style, true, perDiv, wc);
        }
      }
    }
  });

  const candidates: FormatPlan[] = [];

  structures.forEach(structure => {
    // Only stages this shape actually draws are worth varying; the rest keep a
    // default so the recommendation stays a minimal change to the settings.
    const probe = evaluateFormat(structure, league);
    const usedKeys = [...new Set(probe.stages.map(s => s.key))];
    if (usedKeys.length === 0) return;

    const combos: RoundFormats[] = [{ wildcard: 1, divisional: 1, conference: 2, finals: 2 }];
    usedKeys.forEach(key => {
      const expanded: RoundFormats[] = [];
      combos.forEach(base => {
        roundChoices.forEach(rounds => expanded.push({ ...base, [key]: rounds }));
      });
      combos.length = 0;
      combos.push(...expanded);
    });

    combos.forEach(roundFormats => {
      const plan = evaluateFormat({ ...structure, roundFormats }, league);
      if (plan.score <= 0) return;
      // Never recommend a field the bracket only half-draws: a seed the draw
      // skips is a spot the standings promised and the post-season never pays.
      if (plan.unplaced > 0) return;
      candidates.push(plan);
    });
  });

  /** Collapse to one format per distinct shape: same draw, entry rule and field. */
  const perShape = (list: FormatPlan[], better: (a: FormatPlan, b: FormatPlan) => boolean) => {
    const best = new Map<string, FormatPlan>();
    list.forEach(plan => {
      const key = `${plan.config.bracketStyle}:${plan.config.useDivisions ? 'div' : 'open'}:${plan.field.size}`;
      const held = best.get(key);
      if (!held || better(plan, held)) best.set(key, plan);
    });
    return [...best.values()];
  };

  // The calendar is a wall, not a preference: a bracket that cannot be finished
  // in the nights available is not a recommendation.
  const affordable = candidates.filter(plan => plan.minNights <= league.nightsAvailable);
  if (affordable.length > 0) {
    return perShape(affordable, (a, b) => a.score > b.score)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  // Nothing fits. Answer "here is what it would take" rather than nothing at
  // all, shortest first — each already carries the over-budget warning.
  const byLength = (a: FormatPlan, b: FormatPlan) => a.minNights - b.minNights || b.score - a.score;
  return perShape(candidates, (a, b) => byLength(a, b) < 0)
    .sort(byLength)
    .slice(0, limit);
};

/**
 * League-level notes that no single format can fix — the shape of the divisions
 * themselves, or a season too short to hold a bracket.
 */
export const leagueAdvice = (league: LeagueShape): string[] => {
  const advice: string[] = [];
  const conferences = new Set(league.divisions.map(d => conferenceOf(d.name)));

  if (league.unitCount < MIN_FIELD) {
    advice.push(`Only ${plural(league.unitCount, 'token unit')} in the season — a bracket needs at least ${MIN_FIELD}.`);
  }
  if (league.divisions.length > 0 && conferences.size !== 2) {
    advice.push(
      `Your ${plural(league.divisions.length, 'group')} fall into ${plural(conferences.size, 'conference')} `
      + `(divisions are grouped by the first word of their name). The conference bracket needs exactly two; `
      + `the seeded knockout takes any number of groups, so use that one.`,
    );
  }
  if (league.nightsAvailable < 2) {
    advice.push('At least two playoff nights are needed for a semi-final and a final.');
  }

  const assigned = league.divisions.reduce((sum, d) => sum + d.unitCount, 0);
  if (league.divisions.length > 0 && assigned < league.unitCount) {
    advice.push(
      `${plural(league.unitCount - assigned, 'unit')} are in no group — they can only qualify with group play switched off.`,
    );
  }

  return advice;
};
