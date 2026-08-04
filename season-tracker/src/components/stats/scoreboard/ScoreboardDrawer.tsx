// Round (scoreboard) drawer. A tabbed shell mirroring the PUBS dashboard's
// scoreboard drawer — Summary · Players · Killfeed — minus the officers tab,
// plus a dedicated Analytics tab for season-tracker's per-round insight.
import { useEffect, useState } from 'react';
import { Drawer, EmptyHint } from '../../ui';
import type { Scoreboard } from '../../../stats/types';
import type { StoredScoreboard } from '../../../stats/StatsRepository';
import type { RoundAutofill } from '../../../stats/eventBinding';
import type { RegimentResolver } from './playersModel';
import { SummaryTab } from './SummaryTab';
import { PlayersTab } from './PlayersTab';
import { KillfeedTab } from './KillfeedTab';
import { AnalyticsTab } from './AnalyticsTab';

interface WeekRef {
  id: string;
  name: string;
  round1Flipped?: boolean;
  round2Flipped?: boolean;
}

type Tab = 'summary' | 'players' | 'killfeed' | 'analytics';
const TABS: Tab[] = ['summary', 'players', 'killfeed', 'analytics'];

export function ScoreboardDrawer({
  open,
  onClose,
  stored,
  onOpenPlayer,
  weeks = [],
  canBind = false,
  buildAutofill,
  onApply,
  resolveRegiment,
}: {
  open: boolean;
  onClose: () => void;
  stored: StoredScoreboard | null;
  onOpenPlayer: (key: string) => void;
  weeks?: WeekRef[];
  teamNames?: { A: string; B: string };
  validMaps?: string[];
  canBind?: boolean;
  buildAutofill?: (sb: Scoreboard, flipped: boolean) => RoundAutofill;
  onApply?: (weekId: string, round: 1 | 2, af: RoundAutofill) => void;
  /** Season regiment resolver, so the Players tab "unit" grouping matches the Regiments tab. */
  resolveRegiment?: RegimentResolver;
}) {
  const [tab, setTab] = useState<Tab>('summary');
  // Reset to Summary whenever a different round is opened.
  useEffect(() => {
    setTab('summary');
  }, [stored?.id]);

  const sb = stored?.scoreboard;

  return (
    <Drawer
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={sb ? `${sb.meta.map} · ${sb.meta.mode}${sb.meta.area ? ` · ${sb.meta.area}` : ''}` : 'Scoreboard'}
      subtitle={
        sb
          ? sb.recordedAt
            ? `${sb.recordedAt.slice(0, 10)} @ ${sb.recordedAt.slice(11, 16)}`
            : sb.sourceFilename
          : undefined
      }
      width={660}
    >
      {!sb ? (
        <EmptyHint>No data</EmptyHint>
      ) : (
        <div className="text-base">
          <Tabs tab={tab} onChange={setTab} />
          {tab === 'summary' && (
            <SummaryTab
              sb={sb}
              stored={stored}
              canBind={canBind}
              weeks={weeks}
              buildAutofill={buildAutofill}
              onApply={onApply}
            />
          )}
          {tab === 'players' && (
            <PlayersTab sb={sb} onOpenPlayer={onOpenPlayer} resolveRegiment={resolveRegiment} />
          )}
          {tab === 'killfeed' && <KillfeedTab sb={sb} onOpenPlayer={onOpenPlayer} />}
          {tab === 'analytics' && <AnalyticsTab sb={sb} onOpenPlayer={onOpenPlayer} />}
        </div>
      )}
    </Drawer>
  );
}

function Tabs({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="ctl">
      <div className="seg">
        {TABS.map((t) => (
          <button key={t} onClick={() => onChange(t)} aria-pressed={tab === t}>{t}</button>
        ))}
      </div>
      <span className="rule" />
    </div>
  );
}
