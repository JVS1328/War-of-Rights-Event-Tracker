import { useMemo } from 'react';
import { Star, Flag } from 'lucide-react';
import LineChart from '../charts/LineChart';
import { Card } from './Card';
import { TEAM } from './teams';
import { roundTimes } from '../../analytics/presence';
import { leadershipOverTime, leaderSpans } from '../../analytics/leadership';

function fmtDur(s) {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.round(s % 60)).padStart(2, '0')}`;
}

export default function Leadership({ replay }) {
  const d = useMemo(() => ({
    times: roundTimes(replay),
    lead: leadershipOverTime(replay),
    spans: leaderSpans(replay),
  }), [replay]);

  const usaSpans = d.spans.filter((s) => s.team === 1).slice(0, 10);
  const csaSpans = d.spans.filter((s) => s.team === 2).slice(0, 10);

  return (
    <div className="space-y-3">
      <Card
        title="Leadership on the field"
        hint="Officers (★) and flag-bearers (⚑) present over time, per side, from the replay's leader roles. Dips mark leaders falling or rotating out."
      >
        <LineChart
          times={d.times}
          height={220}
          yFormat={(v) => `${Math.round(v)}`}
          series={[
            { key: 'uo', label: 'USA officers', color: TEAM.usa, values: d.lead.usaOfficers },
            { key: 'uf', label: 'USA flags', color: TEAM.usa, values: d.lead.usaFlags, dashed: true },
            { key: 'co', label: 'CSA officers', color: TEAM.csa, values: d.lead.csaOfficers },
            { key: 'cf', label: 'CSA flags', color: TEAM.csa, values: d.lead.csaFlags, dashed: true },
          ]}
        />
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <LeaderList title="USA leaders" color={TEAM.usa} spans={usaSpans} fmtDur={fmtDur} />
        <LeaderList title="CSA leaders" color={TEAM.csa} spans={csaSpans} fmtDur={fmtDur} />
      </div>
    </div>
  );
}

function LeaderList({ title, color, spans, fmtDur }) {
  return (
    <Card title={title} hint="Time spent leading (officer or flag).">
      {spans.length === 0 ? (
        <div className="text-xs text-faint py-2">No leaders recorded.</div>
      ) : (
        <div className="space-y-1">
          {spans.map((s, i) => (
            <div key={`${s.name}-${s.kind}-${i}`} className="flex items-center gap-2 text-[12px]">
              {s.kind === 'officer'
                ? <Star className="w-3.5 h-3.5 shrink-0" style={{ color }} />
                : <Flag className="w-3.5 h-3.5 shrink-0" style={{ color }} />}
              <span className="truncate flex-1 text-text" title={s.name}>{s.name}</span>
              <span className="tabular-nums text-muted">{fmtDur(s.seconds)}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
