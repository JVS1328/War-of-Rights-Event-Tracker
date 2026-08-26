import type { Scoreboard } from './types';
import type {
  ListQuery,
  ReadOptions,
  RegimentAssignmentMap,
  ScopedAssignments,
  ScoreboardBinding,
  ScoreboardSummary,
  StatsRepository,
  StoredScoreboard,
} from './StatsRepository';
import { apiDelete, apiGet, apiPut, qs } from '../cloud/api';
import { buildStatsBundle, normalizeScopedAliases, normalizeScopedMap, OVERALL_SCOPE } from './statsBundle';
import type { BundleOptions, ScopedAliases, StatsBundle, StatsBundleSeason } from './statsBundle';

/**
 * The database-backed StatsRepository: the same contract LocalStatsRepository
 * fulfils out of IndexedDB, fulfilled instead out of /api/db. Reads work for
 * anyone — that is what makes a public stats page possible — while writes carry
 * the admin pass and fail with a 401 for everyone else.
 *
 * `eventId` here is the event's public slug, which is also the prefix of every
 * scoreboard id, so an id alone says which event to ask about.
 */
export class ApiStatsRepository implements StatsRepository {
  /**
   * Scoreboards for the event currently on screen. The stats screens reload
   * everything after each edit (a pin, an alias); without this, renaming one
   * regiment would re-download every round in the season.
   */
  private cache = new Map<string, StoredScoreboard[]>();

  private static idFor(eventId: string, sourceFilename: string): string {
    return `${eventId}::${sourceFilename}`;
  }

  /** The slug an id belongs to — everything before the first '::'. */
  private static eventOf(id: string): string {
    const at = id.indexOf('::');
    return at > 0 ? id.slice(0, at) : id;
  }

  private static base(eventId: string): string {
    return `/events/${encodeURIComponent(eventId)}`;
  }

  private static summaryOf(record: StoredScoreboard): ScoreboardSummary {
    return {
      id: record.id,
      eventId: record.eventId,
      ...(record.binding ? { binding: record.binding } : {}),
      sourceFilename: record.scoreboard.sourceFilename,
      recordedAt: record.scoreboard.recordedAt,
      map: record.scoreboard.meta.map,
      mode: record.scoreboard.meta.mode,
      area: record.scoreboard.meta.area,
      winner: record.scoreboard.meta.winner,
    };
  }

  /** Forget an event's cached rounds — call after anything that changes them. */
  invalidate(eventId?: string): void {
    if (!eventId) return this.cache.clear();
    // One event has a cache entry per scope, so drop them all.
    for (const key of [...this.cache.keys()]) {
      if (key.startsWith(`${eventId}::`)) this.cache.delete(key);
    }
  }

  async saveScoreboard(
    eventId: string,
    scoreboard: Scoreboard,
    binding?: ScoreboardBinding,
  ): Promise<string> {
    const id = ApiStatsRepository.idFor(eventId, scoreboard.sourceFilename);
    const record: StoredScoreboard = { id, eventId, scoreboard, ...(binding ? { binding } : {}) };
    await apiPut(`${ApiStatsRepository.base(eventId)}/scoreboard${qs({ id })}`, {
      record,
      summary: ApiStatsRepository.summaryOf(record),
    });
    this.invalidate(eventId);
    return id;
  }

  async getScoreboard(id: string): Promise<StoredScoreboard | null> {
    const eventId = ApiStatsRepository.eventOf(id);
    for (const rounds of this.cache.values()) {
      const hit = rounds.find((r) => r.id === id);
      if (hit) return hit;
    }
    const body = await apiGet<{ scoreboard: StoredScoreboard }>(
      `${ApiStatsRepository.base(eventId)}/scoreboard${qs({ id })}`,
    );
    return body.scoreboard ?? null;
  }

  async listScoreboards(query: ListQuery): Promise<ScoreboardSummary[]> {
    // The summary list is small and covers every round, so it is asked for
    // directly rather than derived from whichever scope happens to be cached.
    const summaries = (await apiGet<{ scoreboards: ScoreboardSummary[] }>(
      `${ApiStatsRepository.base(query.eventId)}/scoreboards`,
    )).scoreboards ?? [];
    return [...summaries].sort((a, b) => (b.recordedAt ?? '').localeCompare(a.recordedAt ?? ''));
  }

  async deleteScoreboard(id: string): Promise<void> {
    const eventId = ApiStatsRepository.eventOf(id);
    await apiDelete(`${ApiStatsRepository.base(eventId)}/scoreboard${qs({ id })}`);
    this.invalidate(eventId);
  }

  /**
   * Every round in the event.
   *
   * The server cuts pages on a byte budget at boundaries that depend only on
   * the payload sizes, so page 0 also says how many pages there are — and the
   * rest are fetched together rather than one round trip after another. A
   * season of scoreboards is the one request a visitor waits on, and walking a
   * cursor through it spent most of that wait doing nothing.
   */
  async readAllScoreboards(
    eventId: string,
    { withJoinLog = false, weekIds = null }: ReadOptions = {},
  ): Promise<StoredScoreboard[]> {
    // Cached per scope, since a season's rounds and the whole event's are
    // different reads. Switching to Overall fetches the rest once.
    const key = `${eventId}::${withJoinLog ? 'log' : 'lean'}::${weekIds ? [...weekIds].sort().join(',') : 'all'}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const url = (page: number) =>
      `${ApiStatsRepository.base(eventId)}/scoreboards${qs({
        full: '1',
        page: String(page),
        ...(withJoinLog ? { log: '1' } : {}),
        ...(weekIds?.length ? { weeks: [...weekIds].sort().join(',') } : {}),
      })}`;

    type Page = { items: StoredScoreboard[]; page: number; pages: number };
    const first = await apiGet<Page>(url(0));
    const rest = await Promise.all(
      Array.from({ length: Math.max(0, (first.pages ?? 1) - 1) }, (_, i) => apiGet<Page>(url(i + 1))),
    );

    const all = [first, ...rest].flatMap((p) => p.items ?? []);
    this.cache.set(key, all);
    return all;
  }

  async getRegimentAssignmentsScoped(eventId: string): Promise<ScopedAssignments> {
    const body = await apiGet<{ assignments: ScopedAssignments }>(
      `${ApiStatsRepository.base(eventId)}/assignments`,
    );
    return normalizeScopedMap(body.assignments);
  }

  /**
   * Pins are stored as one document, so a single-player edit is a read-modify-
   * write. That is safe here because there is one owner making one edit at a
   * time, and it keeps the wire format identical to what the screens hold.
   */
  async setRegimentAssignmentScoped(
    eventId: string,
    scope: string,
    steamId: string,
    regiment: string,
  ): Promise<void> {
    await this.setRegimentAssignmentsScoped(eventId, scope, { [steamId]: regiment });
  }

  async setRegimentAssignmentsScoped(
    eventId: string,
    scope: string,
    assignments: RegimentAssignmentMap,
  ): Promise<void> {
    const scoped = await this.getRegimentAssignmentsScoped(eventId);
    scoped[scope] = { ...(scoped[scope] ?? {}), ...assignments };
    await apiPut(`${ApiStatsRepository.base(eventId)}/assignments`, { assignments: scoped });
  }

  async getRegimentAssignments(eventId: string): Promise<RegimentAssignmentMap> {
    return (await this.getRegimentAssignmentsScoped(eventId))[OVERALL_SCOPE] ?? {};
  }

  async setRegimentAssignment(eventId: string, steamId: string, regiment: string): Promise<void> {
    await this.setRegimentAssignmentScoped(eventId, OVERALL_SCOPE, steamId, regiment);
  }

  async setRegimentAssignments(eventId: string, assignments: RegimentAssignmentMap): Promise<void> {
    await this.setRegimentAssignmentsScoped(eventId, OVERALL_SCOPE, assignments);
  }

  async getRegimentAliasesScoped(eventId: string): Promise<ScopedAliases> {
    const body = await apiGet<{ aliases: ScopedAliases }>(`${ApiStatsRepository.base(eventId)}/aliases`);
    return normalizeScopedAliases(body.aliases);
  }

  async setRegimentAliasesScoped(eventId: string, scoped: ScopedAliases): Promise<void> {
    await apiPut(`${ApiStatsRepository.base(eventId)}/aliases`, {
      aliases: normalizeScopedAliases(scoped),
    });
  }

  async getRegimentAliases(eventId: string): Promise<Record<string, string>> {
    return (await this.getRegimentAliasesScoped(eventId))[OVERALL_SCOPE] ?? {};
  }

  async setRegimentAliases(eventId: string, map: Record<string, string>): Promise<void> {
    // A flat set replaces the Overall scope, preserving any season-specific ones.
    const scoped = await this.getRegimentAliasesScoped(eventId);
    if (Object.keys(map).length) scoped[OVERALL_SCOPE] = { ...map };
    else delete scoped[OVERALL_SCOPE];
    await this.setRegimentAliasesScoped(eventId, scoped);
  }

  async exportEventStats(
    eventId: string,
    registryUnits: string[] = [],
    seasons: StatsBundleSeason[] = [],
    options: BundleOptions = {},
  ): Promise<StatsBundle> {
    // A full export is a backup, so it takes the join/leave log the screens skip.
    const [records, scopedAsg, scoped] = await Promise.all([
      this.readAllScoreboards(eventId, { withJoinLog: !!options.full }),
      this.getRegimentAssignmentsScoped(eventId),
      this.getRegimentAliasesScoped(eventId),
    ]);
    return buildStatsBundle(
      records,
      scopedAsg[OVERALL_SCOPE] ?? {},
      scoped[OVERALL_SCOPE] ?? {},
      registryUnits,
      seasons,
      scoped,
      scopedAsg,
      options,
    );
  }

  /**
   * Restore a bundle into the database — the path that carries a season out of
   * a browser and onto the site. Rounds go up one at a time, which is also what
   * keeps each request inside the platform's body limit.
   */
  async importEventStats(eventId: string, bundle: StatsBundle): Promise<number> {
    for (const entry of bundle.scoreboards ?? []) {
      await this.saveScoreboard(eventId, entry.scoreboard, entry.binding);
    }
    const incomingAsg = normalizeScopedMap(bundle.assignmentsScoped ?? bundle.assignments);
    if (Object.keys(incomingAsg).length) {
      const existing = await this.getRegimentAssignmentsScoped(eventId);
      const merged: ScopedAssignments = { ...existing };
      for (const [scope, map] of Object.entries(incomingAsg)) {
        merged[scope] = { ...(existing[scope] ?? {}), ...map };
      }
      await apiPut(`${ApiStatsRepository.base(eventId)}/assignments`, { assignments: merged });
    }
    const incoming = normalizeScopedAliases(bundle.aliasesScoped ?? bundle.aliases);
    if (Object.keys(incoming).length) {
      const existing = await this.getRegimentAliasesScoped(eventId);
      const merged: ScopedAliases = { ...existing };
      for (const [scope, map] of Object.entries(incoming)) {
        merged[scope] = { ...(existing[scope] ?? {}), ...map };
      }
      await this.setRegimentAliasesScoped(eventId, merged);
    }
    this.invalidate(eventId);
    return bundle.scoreboards?.length ?? 0;
  }
}
