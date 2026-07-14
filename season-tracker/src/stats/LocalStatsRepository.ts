import type { Scoreboard } from './types';
import type {
  ListQuery,
  RegimentAssignmentMap,
  ScoreboardBinding,
  ScoreboardSummary,
  StatsRepository,
  StoredScoreboard,
} from './StatsRepository';
import { buildStatsBundle, normalizeScopedAliases, OVERALL_SCOPE } from './statsBundle';
import type { ScopedAliases, StatsBundle, StatsBundleSeason } from './statsBundle';

const SCOREBOARDS = 'scoreboards';
const ASSIGNMENTS = 'assignments';
const ALIASES = 'aliases';
const DB_VERSION = 2;

interface AssignmentRecord {
  key: string; // `${eventId}::${steamId}`
  eventId: string;
  steamId: string;
  regiment: string;
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

  async getRegimentAssignments(eventId: string): Promise<RegimentAssignmentMap> {
    const records = await this.tx(ASSIGNMENTS, 'readonly', (s) =>
      reqAsPromise<AssignmentRecord[]>(s.index('eventId').getAll(eventId)),
    );
    const map: RegimentAssignmentMap = {};
    for (const r of records) map[r.steamId] = r.regiment;
    return map;
  }

  async setRegimentAssignment(eventId: string, steamId: string, regiment: string): Promise<void> {
    const record: AssignmentRecord = {
      key: `${eventId}::${steamId}`,
      eventId,
      steamId,
      regiment,
    };
    await this.tx(ASSIGNMENTS, 'readwrite', (s) => reqAsPromise(s.put(record)));
  }

  async setRegimentAssignments(eventId: string, assignments: RegimentAssignmentMap): Promise<void> {
    await this.tx(ASSIGNMENTS, 'readwrite', (s) => {
      for (const [steamId, regiment] of Object.entries(assignments)) {
        s.put({ key: `${eventId}::${steamId}`, eventId, steamId, regiment });
      }
    });
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
  ): Promise<StatsBundle> {
    const records = await this.tx(SCOREBOARDS, 'readonly', (s) =>
      reqAsPromise<StoredScoreboard[]>(s.index('eventId').getAll(eventId)),
    );
    const assignments = await this.getRegimentAssignments(eventId);
    const scoped = await this.getRegimentAliasesScoped(eventId);
    return buildStatsBundle(records, assignments, scoped[OVERALL_SCOPE] ?? {}, registryUnits, seasons, scoped);
  }

  async importEventStats(eventId: string, bundle: StatsBundle): Promise<number> {
    for (const entry of bundle.scoreboards ?? []) {
      await this.saveScoreboard(eventId, entry.scoreboard, entry.binding);
    }
    if (bundle.assignments && Object.keys(bundle.assignments).length) {
      await this.setRegimentAssignments(eventId, bundle.assignments);
    }
    // Prefer the scoped field; older bundles carry only the flat Overall map.
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
