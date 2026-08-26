import type { Scoreboard } from './types';
import type {
  ListQuery,
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
    if (eventId) this.cache.delete(eventId);
    else this.cache.clear();
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
    const cached = this.cache.get(eventId)?.find((r) => r.id === id);
    if (cached) return cached;
    const body = await apiGet<{ scoreboard: StoredScoreboard }>(
      `${ApiStatsRepository.base(eventId)}/scoreboard${qs({ id })}`,
    );
    return body.scoreboard ?? null;
  }

  async listScoreboards(query: ListQuery): Promise<ScoreboardSummary[]> {
    const cached = this.cache.get(query.eventId);
    const summaries = cached
      ? cached.map(ApiStatsRepository.summaryOf)
      : (await apiGet<{ scoreboards: ScoreboardSummary[] }>(
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
   * Every round in the event, walked page by page. The server cuts each page at
   * a byte budget and hands back the id to resume from, so a season with a
   * hundred killfeeds arrives in a few large responses rather than a hundred
   * small ones.
   */
  async readAllScoreboards(eventId: string): Promise<StoredScoreboard[]> {
    const cached = this.cache.get(eventId);
    if (cached) return cached;

    const all: StoredScoreboard[] = [];
    let after: string | undefined;
    // Bounded so a server that kept handing back the same cursor could not spin
    // the browser forever.
    for (let page = 0; page < 500; page += 1) {
      const body = await apiGet<{ items: StoredScoreboard[]; next: string | null }>(
        `${ApiStatsRepository.base(eventId)}/scoreboards${qs({ full: '1', after })}`,
      );
      all.push(...(body.items ?? []));
      if (!body.next || body.next === after) break;
      after = body.next;
    }
    this.cache.set(eventId, all);
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
    const records = await this.readAllScoreboards(eventId);
    const scopedAsg = await this.getRegimentAssignmentsScoped(eventId);
    const scoped = await this.getRegimentAliasesScoped(eventId);
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
