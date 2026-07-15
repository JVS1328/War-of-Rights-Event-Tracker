import { useMemo } from 'react';
import LineChart from '../charts/LineChart';
import BarMeter from '../charts/BarMeter';
import { Card, StatTile } from './Card';
import { TEAM } from './teams';
import {
  presenceOverTime, peakPresence, roundTimes, casualtiesOverTime, casualtiesByCause,
} from '../../analytics/presence';

// Attrition timeline: the shape of the fight. Replay-derived "presence" (who's
// deployed) always renders; scoreboard-derived casualties overlay when present.
export default function AttritionTimeline({ replay, scoreboard }) {
  const kills = scoreboard?.kills || null;
  const data = useMemo(() => {
    const times = roundTimes(replay);
    const presence = presenceOverTime(replay);
    const casualties = casualtiesOverTime(replay, kills);
    return {
      times,
      presence,
      peak: peakPresence(presence),
      casualties,
      byCause: casualtiesByCause(kills),
    };
  }, [replay, kills]);

  const finalUsa = data.casualties.usa[data.casualties.usa.length - 1] || 0;
  const finalCsa = data.casualties.csa[data.casualties.csa.length - 1] || 0;

  return (
    <div className="space-y-3">
      <Card
        title="Players on the field"
        hint="Replay-derived presence — how many of each side were deployed. Because players respawn, this is a deployment signal, not deaths."
      >
        <div className="grid grid-cols-2 gap-2 mb-3 max-w-xs">
          <StatTile label="USA peak" value={data.peak.usa} color={TEAM.usa} />
          <StatTile label="CSA peak" value={data.peak.csa} color={TEAM.csa} />
        </div>
        <LineChart
          times={data.times}
          height={220}
          yFormat={(v) => `${Math.round(v)}`}
          series={[
            { key: 'usa', label: 'USA present', color: TEAM.usa, values: data.presence.usa },
            { key: 'csa', label: 'CSA present', color: TEAM.csa, values: data.presence.csa },
          ]}
        />
      </Card>

      {data.casualties.available ? (
        <Card title="Casualties over time" hint="From the attached scoreboard's kill log, aligned to replay time.">
          <div className="grid grid-cols-2 gap-2 mb-3 max-w-xs">
            <StatTile label="USA casualties" value={finalUsa} color={TEAM.usa} />
            <StatTile label="CSA casualties" value={finalCsa} color={TEAM.csa} />
          </div>
          <LineChart
            times={data.times}
            height={200}
            yFormat={(v) => `${Math.round(v)}`}
            series={[
              { key: 'usa', label: 'USA', color: TEAM.usa, values: data.casualties.usa },
              { key: 'csa', label: 'CSA', color: TEAM.csa, values: data.casualties.csa },
            ]}
          />
          {data.byCause.length > 0 && (
            <div className="mt-3">
              <div className="text-[11px] uppercase tracking-[0.06em] text-faint mb-1">By cause (USA / CSA)</div>
              <BarMeter
                split
                rows={data.byCause.map((c) => ({ key: c.cause, label: c.cause, usa: c.usa, csa: c.csa }))}
                valueFormat={(v) => `${v}`}
              />
            </div>
          )}
        </Card>
      ) : (
        <Card title="Casualties over time">
          <div className="text-xs text-faint py-2">
            Attach a scoreboard CSV to this round to overlay true casualties (killer → victim → cause) on the timeline.
          </div>
        </Card>
      )}
    </div>
  );
}
