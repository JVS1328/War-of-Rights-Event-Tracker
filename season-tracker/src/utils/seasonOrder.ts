/**
 * Season recency, in one place.
 *
 * Seasons sit in an event in the order they were created or imported, which is
 * not the order they were played — import Season 4's file after Season 5's and
 * the older one ends up last in the array. So everything that has to pick a
 * season on someone's behalf (which one opens, which one the stats view scopes
 * to, what the next one is called) reads the number out of the name, and
 * only falls back to array order when a name carries no number at all.
 */

/** The shape every caller has: seasons from the event, or from a stats bundle. */
export interface SeasonRef {
  id: string;
  name?: string;
}

/**
 * The number a season is known by — the first one in its name, so
 * "Season 3 — Casualty Save" is 3 and "2024 Fall Season" is 2024. `null` when
 * the name carries no number ("Preseason", "Grand Melee").
 */
export function seasonNumber(name: string | null | undefined): number | null {
  const match = /\d+/.exec(String(name ?? ''));
  return match ? Number(match[0]) : null;
}

/**
 * The same seasons, most recent first. Numbered seasons outrank unnumbered
 * ones; ties (and a set with no numbers anywhere) fall back to array order,
 * with the later entry treated as the more recent.
 */
export function byRecency<T extends SeasonRef>(seasons: readonly T[]): T[] {
  return (seasons ?? [])
    .map((season, index) => ({ season, index, n: seasonNumber(season?.name) }))
    .sort((a, b) => (b.n ?? -Infinity) - (a.n ?? -Infinity) || b.index - a.index)
    .map((entry) => entry.season);
}

/** The most recent season, or `null` for an event with none. */
export function latestSeason<T extends SeasonRef>(seasons: readonly T[]): T | null {
  return byRecency(seasons)[0] ?? null;
}

/**
 * What to call the next season: one past the highest number in use, so adding
 * to Seasons 2–4 offers "Season 5" rather than re-offering "Season 4". Counts
 * as a floor, so unnumbered seasons still advance the suggestion.
 */
export function nextSeasonName(seasons: readonly SeasonRef[]): string {
  const numbers = (seasons ?? []).map((s) => seasonNumber(s?.name) ?? 0);
  return `Season ${Math.max(seasons?.length ?? 0, ...numbers) + 1}`;
}
