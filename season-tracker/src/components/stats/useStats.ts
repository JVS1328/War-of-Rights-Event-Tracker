import { useCallback, useEffect, useState } from 'react';
import { statsRepo as repo } from '../../stats/repo';
import type { RegimentAssignmentMap, ScoreboardBinding, StoredScoreboard } from '../../stats/StatsRepository';
import { parseScoreboard } from '../../stats/parseScoreboard';
import type { Scoreboard } from '../../stats/types';
import { resolveRegiment } from '../../stats/regimentMatcher';

export interface UseStats {
  loading: boolean;
  stored: StoredScoreboard[];
  /** Scoreboards sorted oldest→newest (so the freshest name wins in aggregates). */
  scoreboards: Scoreboard[];
  assignments: RegimentAssignmentMap;
  importFiles: (files: FileList | File[]) => Promise<{ imported: number; failed: string[] }>;
  remove: (id: string) => Promise<void>;
  bind: (id: string, binding: ScoreboardBinding) => Promise<void>;
  applyRegimentList: (text: string) => Promise<void>;
  setAssignment: (steamId: string, regiment: string) => Promise<void>;
  reload: () => Promise<void>;
}

export function useStats(eventId: string): UseStats {
  const [stored, setStored] = useState<StoredScoreboard[]>([]);
  const [assignments, setAssignments] = useState<RegimentAssignmentMap>({});
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const summaries = await repo.listScoreboards({ eventId });
    const full = await Promise.all(summaries.map((s) => repo.getScoreboard(s.id)));
    setStored(full.filter((s): s is StoredScoreboard => s != null));
    setAssignments(await repo.getRegimentAssignments(eventId));
    setLoading(false);
  }, [eventId]);

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
    [eventId, reload],
  );

  const remove = useCallback(
    async (id: string) => {
      await repo.deleteScoreboard(id);
      await reload();
    },
    [reload],
  );

  const bind = useCallback(
    async (id: string, binding: ScoreboardBinding) => {
      const s = stored.find((x) => x.id === id);
      if (!s) return;
      await repo.saveScoreboard(eventId, s.scoreboard, binding);
      await reload();
    },
    [eventId, stored, reload],
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
    [eventId, stored, reload],
  );

  const setAssignment = useCallback(
    async (steamId: string, regiment: string) => {
      await repo.setRegimentAssignment(eventId, steamId, regiment);
      await reload();
    },
    [eventId, reload],
  );

  const scoreboards = [...stored]
    .map((s) => s.scoreboard)
    .sort((a, b) => (a.recordedAt ?? '').localeCompare(b.recordedAt ?? ''));

  return {
    loading,
    stored,
    scoreboards,
    assignments,
    importFiles,
    remove,
    bind,
    applyRegimentList,
    setAssignment,
    reload,
  };
}
