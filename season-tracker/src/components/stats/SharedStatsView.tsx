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
    // `solo` because there is no rail here — see .app.solo in ledger.css.
    <div className="app solo">
      <div className="main">
        <div className="crumb">
          <BarChart3 className="w-4 h-4" />
          <span className="wor-name">{title}</span>
          <span className="cap">
            player stats · {count} scoreboard{count === 1 ? '' : 's'}
          </span>
          <span className="rule" />
          <ThemeControls />
          <span className="tag q">read only</span>
          <a href={window.location.origin + window.location.pathname} className="gh live">
            <ExternalLink className="w-3 h-3" /> Open the tracker
          </a>
        </div>
        <div className="body">

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
    </div>
  );
}
