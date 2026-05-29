import { LocalStatsRepository } from './LocalStatsRepository';

// One IndexedDB connection shared across the whole app (the stats hook and the
// tracker's export/import/share paths all read and write through this).
export const statsRepo = new LocalStatsRepository();
