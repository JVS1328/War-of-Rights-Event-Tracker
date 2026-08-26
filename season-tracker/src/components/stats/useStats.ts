import { useCallback, useEffect, useState } from 'react';
import { statsRepo } from '../../stats/repo';
import type {
  RegimentAssignmentMap,
  ScopedAssignments,
  ScoreboardBinding,
  StatsRepository,
  StoredScoreboard,
} from '../../stats/StatsRepository';
import { parseScoreboard } from '../../stats/parseScoreboard';
import type { Scoreboard } from '../../stats/types';
import { resolveRegiment } from '../../stats/regimentMatcher';
import { storedFromBundle, normalizeScopedAliases, normalizeScopedMap, OVERALL_SCOPE } from '../../stats/statsBundle';
import type { ScopedAliases, StatsBundle } from '../../stats/statsBundle';

export interface UseStats {
  loading: boolean;
  /** Why the last load failed, when it did — otherwise null. */
  error?: string | null;
  stored: StoredScoreboard[];
  /** Scoreboards sorted oldest→newest (so the freshest name wins in aggregates). */
  scoreboards: Scoreboard[];
  /** Steam-id pins keyed by scope (OVERALL_SCOPE or a season id). */
  assignments: ScopedAssignments;
  /**
   * Season-scoped regiment rename/merge maps (scope → sourceLabel → targetLabel),
   * where a scope key is `OVERALL_SCOPE` or a season id.
   */
  aliases: ScopedAliases;
  importFiles: (files: FileList | File[]) => Promise<{ imported: number; failed: string[] }>;
  remove: (id: string) => Promise<void>;
  bind: (id: string, binding: ScoreboardBinding) => Promise<void>;
  applyRegimentList: (text: string) => Promise<void>;
  /** Pin one player within a scope (OVERALL_SCOPE default, or a season id). */
  setAssignment: (steamId: string, regiment: string, scope?: string) => Promise<void>;
  /** Persist many per-player pins at once within a scope (the staged-edit Save). */
  bulkAssign: (entries: RegimentAssignmentMap, scope?: string) => Promise<void>;
  /**
   * Rename or merge within a scope: map a regiment label onto another
   * (transitive). `scope` is `OVERALL_SCOPE` (default) for an event-wide rename,
   * or a season id to confine it to that season.
   */
  setAlias: (from: string, to: string, scope?: string) => Promise<void>;
  /** Undo a rename/merge for one source label within a scope. */
  removeAlias: (from: string, scope?: string) => Promise<void>;
  reload: () => Promise<void>;
}

/**
 * An event's player stats, wherever they live. `repo` defaults to this
 * browser's IndexedDB — what the admin tracker uses — and the public site hands
 * in the database-backed one instead. Nothing else about the screens changes.
 */
export function useStats(eventId: string, repo: StatsRepository = statsRepo): UseStats {
  const [stored, setStored] = useState<StoredScoreboard[]>([]);
  const [assignments, setAssignments] = useState<ScopedAssignments>({});
  const [aliases, setAliasesState] = useState<ScopedAliases>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setStored(await repo.readAllScoreboards(eventId));
      setAssignments(await repo.getRegimentAssignmentsScoped(eventId));
      setAliasesState(await repo.getRegimentAliasesScoped(eventId));
      setError(null);
    } catch (err) {
      // A local repository fails only if the browser broke; a remote one fails
      // whenever the network does, and the screens need to say so rather than
      // draw an empty season as though it were a real one.
      setStored([]);
      setAssignments({});
      setAliasesState({});
      setError(err instanceof Error ? err.message : 'Could not load player stats.');
    }
    setLoading(false);
  }, [eventId, repo]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const importFiles = useCallback(
    async (files: FileList | File[]) => {
      const failed: string[] = [];
      let imported = 0;
      for (const file of Array.from(files)) {
        try {
          const text = await file.text();
          const sb = parseScoreboard(text, file.name);
          await repo.saveScoreboard(eventId, sb);
          imported += 1;
        } catch {
          failed.push(file.name);
        }
      }
      await reload();
      return { imported, failed };
    },
    [eventId, repo, reload],
  );

  const remove = useCallback(
    async (id: string) => {
      await repo.deleteScoreboard(id);
      await reload();
    },
    [repo, reload],
  );

  const bind = useCallback(
    async (id: string, binding: ScoreboardBinding) => {
      const s = stored.find((x) => x.id === id);
      if (!s) return;
      await repo.saveScoreboard(eventId, s.scoreboard, binding);
      await reload();
    },
    [eventId, repo, stored, reload],
  );

  /** Re-resolve every known player against a pasted regiment list and persist. */
  const applyRegimentList = useCallback(
    async (text: string) => {
      const { parseRegimentList } = await import('../../stats/regimentMatcher');
      const list = parseRegimentList(text);
      const map: RegimentAssignmentMap = {};
      for (const s of stored) {
        for (const p of s.scoreboard.players) {
          if (p.steamId) map[p.steamId] = resolveRegiment(p.name, list);
        }
      }
      await repo.setRegimentAssignments(eventId, map);
      await reload();
    },
    [eventId, repo, stored, reload],
  );

  const setAssignment = useCallback(
    async (steamId: string, regiment: string, scope: string = OVERALL_SCOPE) => {
      await repo.setRegimentAssignmentScoped(eventId, scope, steamId, regiment);
      await reload();
    },
    [eventId, repo, reload],
  );

  const bulkAssign = useCallback(
    async (entries: RegimentAssignmentMap, scope: string = OVERALL_SCOPE) => {
      if (Object.keys(entries).length) await repo.setRegimentAssignmentsScoped(eventId, scope, entries);
      await reload();
    },
    [eventId, repo, reload],
  );

  const setAlias = useCallback(
    async (from: string, to: string, scope: string = OVERALL_SCOPE) => {
      const next: ScopedAliases = { ...aliases };
      const scopeMap = { ...(next[scope] ?? {}) };
      if (!to || from === to) delete scopeMap[from];
      else scopeMap[from] = to;
      if (Object.keys(scopeMap).length) next[scope] = scopeMap;
      else delete next[scope];
      await repo.setRegimentAliasesScoped(eventId, next);
      await reload();
    },
    [eventId, repo, aliases, reload],
  );

  const removeAlias = useCallback(
    async (from: string, scope: string = OVERALL_SCOPE) => {
      const next: ScopedAliases = { ...aliases };
      const scopeMap = { ...(next[scope] ?? {}) };
      delete scopeMap[from];
      if (Object.keys(scopeMap).length) next[scope] = scopeMap;
      else delete next[scope];
      await repo.setRegimentAliasesScoped(eventId, next);
      await reload();
    },
    [eventId, repo, aliases, reload],
  );

  const scoreboards = [...stored]
    .map((s) => s.scoreboard)
    .sort((a, b) => (a.recordedAt ?? '').localeCompare(b.recordedAt ?? ''));

  return {
    loading,
    error,
    stored,
    scoreboards,
    assignments,
    aliases,
    importFiles,
    remove,
    bind,
    applyRegimentList,
    setAssignment,
    bulkAssign,
    setAlias,
    removeAlias,
    reload,
  };
}

/**
 * Build a read-only {@link UseStats} from a portable bundle — no IndexedDB, no
 * mutations. Powers the shared-link stats view, which renders the same panel as
 * the live tracker but from data carried in the URL. Mutators are inert no-ops.
 */
export function readOnlyStatsFromBundle(bundle: StatsBundle): UseStats {
  const stored = storedFromBundle(bundle);
  const scoreboards = [...stored]
    .map((s) => s.scoreboard)
    .sort((a, b) => (a.recordedAt ?? '').localeCompare(b.recordedAt ?? ''));
  const noop = async () => {};
  return {
    loading: false,
    error: null,
    stored,
    scoreboards,
    assignments: normalizeScopedMap(bundle.assignmentsScoped ?? bundle.assignments),
    aliases: normalizeScopedAliases(bundle.aliasesScoped ?? bundle.aliases),
    importFiles: async () => ({ imported: 0, failed: [] }),
    remove: noop,
    bind: noop,
    applyRegimentList: noop,
    setAssignment: noop,
    bulkAssign: noop,
    setAlias: noop,
    removeAlias: noop,
    reload: noop,
  };
}
