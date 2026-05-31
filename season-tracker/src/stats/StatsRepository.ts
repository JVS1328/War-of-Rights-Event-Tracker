import type { Scoreboard, Team } from './types';
import type { StatsBundle } from './statsBundle';

/** Optional link from a scoreboard to a specific Week/Round in the tracker. */
export interface ScoreboardBinding {
  weekId: string;
  round: 1 | 2;
}

export interface StoredScoreboard {
  id: string;
  eventId: string;
  binding?: ScoreboardBinding;
  scoreboard: Scoreboard;
}

/** Lightweight row for lists, without the heavy player/killfeed arrays. */
export interface ScoreboardSummary {
  id: string;
  eventId: string;
  binding?: ScoreboardBinding;
  sourceFilename: string;
  recordedAt: string | null;
  map: string;
  mode: string;
  area: string | null;
  winner: Team | null;
}

export interface ListQuery {
  eventId: string;
}

/** steam id → regiment label. */
export type RegimentAssignmentMap = Record<string, string>;

/**
 * Storage-agnostic stats persistence. The client uses LocalStatsRepository
 * (IndexedDB); a future ApiStatsRepository (backend) can implement the same
 * interface without any UI changes.
 */
export interface StatsRepository {
  saveScoreboard(eventId: string, scoreboard: Scoreboard, binding?: ScoreboardBinding): Promise<string>;
  getScoreboard(id: string): Promise<StoredScoreboard | null>;
  listScoreboards(query: ListQuery): Promise<ScoreboardSummary[]>;
  deleteScoreboard(id: string): Promise<void>;

  getRegimentAssignments(eventId: string): Promise<RegimentAssignmentMap>;
  setRegimentAssignment(eventId: string, steamId: string, regiment: string): Promise<void>;
  setRegimentAssignments(eventId: string, assignments: RegimentAssignmentMap): Promise<void>;

  /** Regiment rename/merge map (sourceLabel → targetLabel) for the event. */
  getRegimentAliases(eventId: string): Promise<Record<string, string>>;
  setRegimentAliases(eventId: string, map: Record<string, string>): Promise<void>;

  /**
   * Pack all of an event's scoreboards + assignments into a portable bundle.
   * `registryUnits` (the event's unit-registry names) is carried so a read-only
   * shared view resolves regiments the same way the live editor does.
   */
  exportEventStats(eventId: string, registryUnits?: string[]): Promise<StatsBundle>;
  /** Restore a bundle under the target event; returns the scoreboard count. */
  importEventStats(eventId: string, bundle: StatsBundle): Promise<number>;
}
