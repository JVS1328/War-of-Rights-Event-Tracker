import { useMemo } from 'react';
import { Star, Flag } from 'lucide-react';
import LineChart from '../charts/LineChart';
import { Card } from './Card';
import { TEAM } from './teams';
import { roundTimes } from '../../analytics/presence';
import { leadershipOverTime, leaderSpans, flagBearers } from '../../analytics/leadership';

function fmtDur(s) {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.round(s % 60)).padStart(2, '0')}`;
}

const teamColor = (t) => (t === 1 ? TEAM.usa : t === 2 ? TEAM.csa : '#a3a3a3');

export default function Leadership({ replay }) {
  const d = useMemo(() => ({
    times: roundTimes(replay),
    lead: leadershipOverTime(replay),
    spans: leaderSpans(replay),
    flags: flagBearers(replay),
  }), [replay]);

  const usaSpans = d.spans.filter((s) => s.team === 1).slice(0, 10);
  const csaSpans = d.spans.filter((s) => s.team === 2).slice(0, 10);

  return (
    <div className="space-y-3">
      <Card
        title="Flags & officers on the field"
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

      <FlagBearers rows={d.flags} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <LeaderList title="USA leaders" color={TEAM.usa} spans={usaSpans} fmtDur={fmtDur} />
        <LeaderList title="CSA leaders" color={TEAM.csa} spans={csaSpans} fmtDur={fmtDur} />
      </div>
    </div>
  );
}

// All flag-bearers of the round, ranked by their best single-life carry.
function FlagBearers({ rows }) {
  const max = rows.length ? (rows[0].bestLifeSeconds || 1) : 1;
  return (
    <Card
      title="Flag bearers"
      hint="Everyone who carried the colors this round, ranked by the longest they stayed alive holding the flag in a single life. Total time on the colors and pick-ups are at right."
    >
      {rows.length === 0 ? (
        <div className="text-xs text-faint py-2">No flag-bearers recorded this round.</div>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r, i) => (
            <div key={`${r.name}-${i}`} className="flex items-center gap-2.5 text-[12px]">
              <span className="w-5 shrink-0 text-right text-faint tabular-nums">{i + 1}</span>
              <Flag className="w-3.5 h-3.5 shrink-0" style={{ color: teamColor(r.team) }} />
              <span className="truncate flex-1 text-text" title={r.name}>{r.name}</span>
              <div className="h-1.5 w-24 bg-elevated rounded-full overflow-hidden hidden sm:block shrink-0">
                <div className="h-full rounded-full" style={{ width: `${(r.bestLifeSeconds / max) * 100}%`, background: teamColor(r.team) }} />
              </div>
              <span className="w-12 shrink-0 text-right tabular-nums text-text" title="Longest time alive holding the flag in one life">
                {fmtDur(r.bestLifeSeconds)}
              </span>
              <span className="w-20 shrink-0 text-right tabular-nums text-faint hidden md:inline" title="Total time carrying · times picked up">
                {fmtDur(r.totalSeconds)} · ×{r.pickups}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
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
