import { useMemo, useState } from 'react';
import { BarChart3, ExternalLink } from 'lucide-react';
import { StatsPanel } from './StatsArea';
import { readOnlyStatsFromBundle } from './useStats';
import { ThemeControls } from '../ThemeControls';
import { OVERALL_SCOPE } from '../../stats/statsBundle';
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

  // Season/Overall filter state. Bundles shared before seasons were carried
  // simply lack them, so the panel keeps the row hidden and stays on Overall.
  const seasons = bundle.seasons ?? [];
  const [seasonScope, setSeasonScope] = useState(OVERALL_SCOPE);

  // Extract the tracker map stats slice that matches the active season filter.
  const trackerMapStats = useMemo(() => {
    if (!bundle.mapStats) return undefined;
    return seasonScope === OVERALL_SCOPE
      ? bundle.mapStats.overall
      : bundle.mapStats.bySeason?.[seasonScope] ?? bundle.mapStats.overall;
  }, [bundle.mapStats, seasonScope]);

  return (
    <div className="min-h-screen bg-bg-page text-text-primary p-2 sm:p-4 lg:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 border border-border-default bg-bg-card p-4 rounded-lg">
          <div className="flex items-center gap-3 min-w-0">
            <BarChart3 className="w-6 h-6 c-accent shrink-0" />
            <div className="min-w-0">
              <h1 className="text-lg font-semibold truncate">{title}</h1>
              <p className="text-xs text-text-secondary mt-0.5">
                Player Stats · {count} scoreboard{count === 1 ? '' : 's'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ThemeControls />
            <span className="px-2.5 py-1 text-xs rounded-md border border-border-default text-text-secondary">
              Read-Only View
            </span>
            <a
              href={window.location.origin + window.location.pathname}
              className="gh live"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="hidden sm:inline">Open Season Tracker</span>
            </a>
          </div>
        </div>

        <StatsPanel
          stats={stats}
          readOnly
          eventId="shared"
          eventName={title}
          registryUnits={bundle.registryUnits ?? []}
          seasons={seasons}
          seasonScope={seasonScope}
          onSeasonScope={setSeasonScope}
          trackerMapStats={trackerMapStats}
        />
      </div>
    </div>
  );
}
