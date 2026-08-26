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
import { buildStatsBundle, normalizeScopedAliases, normalizeScopedMap, OVERALL_SCOPE } from './statsBundle';
import type { BundleOptions, ScopedAliases, StatsBundle, StatsBundleSeason } from './statsBundle';

const SCOREBOARDS = 'scoreboards';
const ASSIGNMENTS = 'assignments';
const ALIASES = 'aliases';
const DB_VERSION = 2;

interface AssignmentRecord {
  // Overall pins keep the legacy key `${eventId}::${steamId}` (back-compat);
  // season pins use `${eventId}::${scope}::${steamId}`.
  key: string;
  eventId: string;
  steamId: string;
  regiment: string;
  /** OVERALL_SCOPE or a season id; absent on legacy records → read as Overall. */
  scope?: string;
}

interface AliasRecord {
  eventId: string;
  /** Legacy flat map (pre-season-scoping); read for back-compat, migrated on next write. */
  map?: Record<string, string>;
  /** Season-scoped rename/merge maps (scope → sourceLabel → targetLabel). */
  scoped?: ScopedAliases;
}

/** Promise wrapper around an IDBRequest. */
function reqAsPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** IndexedDB-backed StatsRepository (client-side; backend-swappable). */
export class LocalStatsRepository implements StatsRepository {
  private dbName: string;
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor(dbName = 'wor-stats') {
    this.dbName = dbName;
  }

  private openDb(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve, reject) => {
      const open = indexedDB.open(this.dbName, DB_VERSION);
      open.onupgradeneeded = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains(SCOREBOARDS)) {
          const store = db.createObjectStore(SCOREBOARDS, { keyPath: 'id' });
          store.createIndex('eventId', 'eventId', { unique: false });
        }
        if (!db.objectStoreNames.contains(ASSIGNMENTS)) {
          const store = db.createObjectStore(ASSIGNMENTS, { keyPath: 'key' });
          store.createIndex('eventId', 'eventId', { unique: false });
        }
        if (!db.objectStoreNames.contains(ALIASES)) {
          db.createObjectStore(ALIASES, { keyPath: 'eventId' });
        }
      };
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    return this.dbPromise;
  }

  private async tx<T>(
    store: string,
    mode: IDBTransactionMode,
    fn: (s: IDBObjectStore) => Promise<T> | T,
  ): Promise<T> {
    const db = await this.openDb();
    return new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(store, mode);
      const objectStore = transaction.objectStore(store);
      let result: T;
      Promise.resolve(fn(objectStore)).then(
        (r) => {
          result = r;
        },
        (err) => reject(err),
      );
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }

  private static idFor(eventId: string, sourceFilename: string): string {
    return `${eventId}::${sourceFilename}`;
  }

  async saveScoreboard(
    eventId: string,
    scoreboard: Scoreboard,
    binding?: ScoreboardBinding,
  ): Promise<string> {
    const id = LocalStatsRepository.idFor(eventId, scoreboard.sourceFilename);
    const record: StoredScoreboard = { id, eventId, scoreboard, ...(binding ? { binding } : {}) };
    await this.tx(SCOREBOARDS, 'readwrite', (s) => reqAsPromise(s.put(record)));
    return id;
  }

  async getScoreboard(id: string): Promise<StoredScoreboard | null> {
    const rec = await this.tx(SCOREBOARDS, 'readonly', (s) =>
      reqAsPromise<StoredScoreboard | undefined>(s.get(id)),
    );
    return rec ?? null;
  }

  async listScoreboards(query: ListQuery): Promise<ScoreboardSummary[]> {
    const records = await this.tx(SCOREBOARDS, 'readonly', (s) =>
      reqAsPromise<StoredScoreboard[]>(s.index('eventId').getAll(query.eventId)),
    );
    return records
      .map(
        (r): ScoreboardSummary => ({
          id: r.id,
          eventId: r.eventId,
          ...(r.binding ? { binding: r.binding } : {}),
          sourceFilename: r.scoreboard.sourceFilename,
          recordedAt: r.scoreboard.recordedAt,
          map: r.scoreboard.meta.map,
          mode: r.scoreboard.meta.mode,
          area: r.scoreboard.meta.area,
          winner: r.scoreboard.meta.winner,
        }),
      )
      .sort((a, b) => (b.recordedAt ?? '').localeCompare(a.recordedAt ?? ''));
  }

  async deleteScoreboard(id: string): Promise<void> {
    await this.tx(SCOREBOARDS, 'readwrite', (s) => reqAsPromise(s.delete(id)));
  }

  // The read options are a remote repository's concern — nothing is saved by
  // narrowing a read of the browser's own database, and the screens filter what
  // they are given anyway.
  async readAllScoreboards(eventId: string): Promise<StoredScoreboard[]> {
    return this.tx(SCOREBOARDS, 'readonly', (s) =>
      reqAsPromise<StoredScoreboard[]>(s.index('eventId').getAll(eventId)),
    );
  }

  // Overall pins keep the legacy per-steam-id key so existing data and the flat
  // API are unaffected; season pins get a scope segment.
  private static asgKey(eventId: string, scope: string, steamId: string): string {
    return scope === OVERALL_SCOPE ? `${eventId}::${steamId}` : `${eventId}::${scope}::${steamId}`;
  }

  async getRegimentAssignmentsScoped(eventId: string): Promise<ScopedAssignments> {
    const records = await this.tx(ASSIGNMENTS, 'readonly', (s) =>
      reqAsPromise<AssignmentRecord[]>(s.index('eventId').getAll(eventId)),
    );
    const out: ScopedAssignments = {};
    for (const r of records) {
      const scope = r.scope ?? OVERALL_SCOPE; // legacy records → Overall
      (out[scope] ??= {})[r.steamId] = r.regiment;
    }
    return out;
  }

  async setRegimentAssignmentScoped(
    eventId: string,
    scope: string,
    steamId: string,
    regiment: string,
  ): Promise<void> {
    const record: AssignmentRecord = {
      key: LocalStatsRepository.asgKey(eventId, scope, steamId),
      eventId,
      steamId,
      regiment,
      scope,
    };
    await this.tx(ASSIGNMENTS, 'readwrite', (s) => reqAsPromise(s.put(record)));
  }

  async setRegimentAssignmentsScoped(
    eventId: string,
    scope: string,
    assignments: RegimentAssignmentMap,
  ): Promise<void> {
    await this.tx(ASSIGNMENTS, 'readwrite', (s) => {
      for (const [steamId, regiment] of Object.entries(assignments)) {
        s.put({ key: LocalStatsRepository.asgKey(eventId, scope, steamId), eventId, steamId, regiment, scope });
      }
    });
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
    const rec = await this.tx(ALIASES, 'readonly', (s) =>
      reqAsPromise<AliasRecord | undefined>(s.get(eventId)),
    );
    if (!rec) return {};
    // Prefer the scoped field; fall back to (and migrate-on-read) the legacy map.
    return normalizeScopedAliases(rec.scoped ?? rec.map);
  }

  async setRegimentAliasesScoped(eventId: string, scoped: ScopedAliases): Promise<void> {
    const normalized = normalizeScopedAliases(scoped);
    // Persist only the scoped shape; the legacy `map` field is dropped on write.
    const record: AliasRecord = { eventId, scoped: normalized };
    await this.tx(ALIASES, 'readwrite', (s) => reqAsPromise(s.put(record)));
  }

  async getRegimentAliases(eventId: string): Promise<Record<string, string>> {
    const scoped = await this.getRegimentAliasesScoped(eventId);
    return scoped[OVERALL_SCOPE] ?? {};
  }

  async setRegimentAliases(eventId: string, map: Record<string, string>): Promise<void> {
    // Flat set replaces the Overall scope, preserving any season-specific scopes.
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

  async importEventStats(eventId: string, bundle: StatsBundle): Promise<number> {
    for (const entry of bundle.scoreboards ?? []) {
      await this.saveScoreboard(eventId, entry.scoreboard, entry.binding);
    }
    // Prefer the scoped fields; older bundles carry only the flat Overall maps.
    const incomingAsg = normalizeScopedMap(bundle.assignmentsScoped ?? bundle.assignments);
    for (const [scope, map] of Object.entries(incomingAsg)) {
      if (Object.keys(map).length) await this.setRegimentAssignmentsScoped(eventId, scope, map);
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
    return bundle.scoreboards?.length ?? 0;
  }
}
