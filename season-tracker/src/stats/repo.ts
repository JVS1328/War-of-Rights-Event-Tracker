import { LocalStatsRepository } from './LocalStatsRepository';
import { ApiStatsRepository } from './ApiStatsRepository';

/**
 * The two places an event's player stats can live.
 *
 * `statsRepo` is this browser: one IndexedDB connection shared across the app,
 * which is where the admin tracker works while a season is being run.
 * `cloudStatsRepo` is the database behind /api/db, which is what the public
 * site reads and what the admin tracker publishes to. Both satisfy
 * StatsRepository, so the stats screens are written once and handed whichever
 * one the page needs.
 */
export const statsRepo = new LocalStatsRepository();
export const cloudStatsRepo = new ApiStatsRepository();
