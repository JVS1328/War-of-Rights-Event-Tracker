import { useMemo } from 'react';
import LineChart from '../charts/LineChart';
import BarMeter from '../charts/BarMeter';
import { Card } from './Card';
import { TEAM } from './teams';
import { roundTimes } from '../../analytics/presence';
import {
  centroidsOverTime, centroidSeparation, distancePerPlayer, frontlineOverTime, spreadOverTime,
} from '../../analytics/movement';

const M_TO_YD = 1.0936;
const yd = (m) => (m == null ? null : m * M_TO_YD);

export default function MovementFrontline({ replay }) {
  const d = useMemo(() => {
    const times = roundTimes(replay);
    const centroids = centroidsOverTime(replay);
    const sep = centroidSeparation(replay, centroids).map(yd);
    const front = frontlineOverTime(replay, centroids);
    const spread = spreadOverTime(replay, centroids);
    const dist = distancePerPlayer(replay);
    const movers = replay.players
      .map((p, i) => ({ key: String(i), label: p.name, team: p.team, value: dist[i] * M_TO_YD }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
    return {
      times,
      sep,
      front: front.ok
        ? { usa: front.usa.map(yd), csa: front.csa.map(yd), span: front.span * M_TO_YD }
        : null,
      spread: { usa: spread.usa.map(yd), csa: spread.csa.map(yd) },
      movers,
    };
  }, [replay]);

  return (
    <div className="space-y-3">
      <Card
        title="Frontline — advance & retreat"
        hint="Each side's leading edge projected onto the attack axis (USA start → CSA start). The lines converging means the front is collapsing toward contact."
      >
        {d.front ? (
          <LineChart
            times={d.times}
            height={230}
            yFormat={(v) => `${Math.round(v)}yd`}
            series={[
              { key: 'usa', label: 'USA front', color: TEAM.usa, values: d.front.usa },
              { key: 'csa', label: 'CSA front', color: TEAM.csa, values: d.front.csa },
            ]}
          />
        ) : (
          <div className="text-xs text-slate-500 py-2">Not enough two-sided data to anchor an attack axis.</div>
        )}
      </Card>

      <Card title="Distance between the lines" hint="Team-centroid separation. A falling line = closing to contact; rising = disengaging.">
        <LineChart
          times={d.times}
          height={180}
          yFormat={(v) => `${Math.round(v)}yd`}
          series={[{ key: 'sep', label: 'Centroid separation', color: '#f59e0b', values: d.sep }]}
        />
      </Card>

      <Card title="Formation cohesion" hint="Average spread of each side around its own centroid. Lower = tighter formation; a spike = a unit breaking off or routing.">
        <LineChart
          times={d.times}
          height={180}
          yFormat={(v) => `${Math.round(v)}yd`}
          series={[
            { key: 'usa', label: 'USA spread', color: TEAM.usa, values: d.spread.usa },
            { key: 'csa', label: 'CSA spread', color: TEAM.csa, values: d.spread.csa },
          ]}
        />
      </Card>

      <Card title="Most ground covered" hint="Total distance traveled per player.">
        <BarMeter
          rows={d.movers.map((m) => ({ key: m.key, label: m.label, value: m.value, color: TEAM[m.team === 1 ? 'usa' : 'csa'] }))}
          valueFormat={(v) => `${Math.round(v)}yd`}
        />
      </Card>
    </div>
  );
}
