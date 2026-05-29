import { useMemo } from 'react';
import { BarChart3, ExternalLink } from 'lucide-react';
import { StatsPanel } from './StatsArea';
import { readOnlyStatsFromBundle } from './useStats';
import type { StatsBundle } from '../../stats/statsBundle';

/**
 * Read-only, player-stats-only page rendered when someone opens a "share player
 * stats" link. Mirrors the campaign tracker's SharedMapView: no tracker chrome,
 * no IndexedDB writes — just the stats panel (every sub-tab except Import),
 * driven entirely by the bundle carried in the URL.
 */
export default function SharedStatsView({
  bundle,
  eventName,
}: {
  bundle: StatsBundle;
  eventName?: string;
}) {
  // Bundle → inert, read-only stats object. Memoized so the panel's derived
  // leaderboards aren't recomputed on every render.
  const stats = useMemo(() => readOnlyStatsFromBundle(bundle), [bundle]);
  const count = stats.scoreboards.length;
  const title = eventName?.trim() || 'Player Stats';

  return (
    <div className="min-h-screen bg-bg-page text-text-primary p-2 sm:p-4 lg:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 border border-border-default bg-bg-card p-4 rounded-lg">
          <div className="flex items-center gap-3 min-w-0">
            <BarChart3 className="w-6 h-6 text-indigo-500 shrink-0" />
            <div className="min-w-0">
              <h1 className="text-lg font-semibold truncate">{title}</h1>
              <p className="text-xs text-text-secondary mt-0.5">
                Player Stats · {count} scoreboard{count === 1 ? '' : 's'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="px-2.5 py-1 text-xs rounded-md border border-border-default text-text-secondary">
              Read-Only View
            </span>
            <a
              href={window.location.origin + window.location.pathname}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-md transition"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="hidden sm:inline">Open Season Tracker</span>
            </a>
          </div>
        </div>

        <StatsPanel stats={stats} readOnly eventId="shared" eventName={title} />
      </div>
    </div>
  );
}
