/**
 * The round matchup screen: Summary · Players · Killfeed · Analytics for one
 * imported scoreboard.
 *
 * A screen rather than a drawer, as the prototype has it (V.round). The round
 * is picked at the top so you can walk the season without going back to a
 * list, and the tables get the full column width — the players tab alone
 * carries eleven columns and never fitted a docked panel.
 */
import { useEffect, useState } from 'react';
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

/** How a round reads in the picker: when it was, where, and who took it. */
const roundLabel = (r: StoredScoreboard): string => {
  const m = r.scoreboard.meta;
  const when = r.scoreboard.recordedAt
    ? `${r.scoreboard.recordedAt.slice(0, 10)} ${r.scoreboard.recordedAt.slice(11, 16)}`
    : r.scoreboard.sourceFilename;
  return `${when} · ${m.map}${m.area ? ` · ${m.area}` : ''}${m.winner ? ` · ${m.winner}` : ''}`;
};

export function RoundScreen({
  stored,
  rounds = [],
  onPickRound,
  onOpenPlayer,
  weeks = [],
  canBind = false,
  buildAutofill,
  onApply,
  resolveRegiment,
}: {
  stored: StoredScoreboard | null;
  /** Every round in scope, newest first, for the picker. */
  rounds?: StoredScoreboard[];
  onPickRound?: (id: string) => void;
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
  // Back to Summary whenever a different round is picked.
  useEffect(() => {
    setTab('summary');
  }, [stored?.id]);

  const sb = stored?.scoreboard;
  const at = stored ? rounds.findIndex((r) => r.id === stored.id) : -1;
  const step = (by: number) => {
    const next = rounds[at + by];
    if (next) onPickRound?.(next.id);
  };

  return (
    <>
      <div className="panel">
        <div className="ctl">
          <span className="cap">Round</span>
          <select
            value={stored?.id ?? ''}
            onChange={(e) => onPickRound?.(e.target.value)}
            aria-label="Round"
            style={{ maxWidth: 380 }}
          >
            {rounds.length === 0 && <option value="">No rounds imported</option>}
            {rounds.map((r) => (
              <option key={r.id} value={r.id}>{roundLabel(r)}</option>
            ))}
          </select>
          <button className="gh" onClick={() => step(-1)} disabled={at <= 0} aria-label="Newer round">‹</button>
          <button
            className="gh" onClick={() => step(1)}
            disabled={at < 0 || at >= rounds.length - 1} aria-label="Older round"
          >
            ›
          </button>
          <span className="rule" />
          <span className="meta">
            {at >= 0 ? `${at + 1} of ${rounds.length}` : `${rounds.length} imported`}
          </span>
        </div>
      </div>

      {!sb ? (
        <div className="panel">
          <header className="ph"><h2>Round matchup</h2><span className="rule" /></header>
          <div className="pb">
            <p className="note">
              Nothing to show. Import a scoreboard, or pick a round above.
            </p>
          </div>
        </div>
      ) : (
        <div className="panel">
          <header className="ph">
            <h2 className="wor-name">
              {sb.meta.map}{sb.meta.area ? ` · ${sb.meta.area}` : ''}
            </h2>
            <span className="rule" />
            <span className="meta">
              {sb.meta.mode}
              {sb.recordedAt ? ` · ${sb.recordedAt.slice(0, 10)} ${sb.recordedAt.slice(11, 16)}` : ''}
            </span>
          </header>
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
    </>
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
