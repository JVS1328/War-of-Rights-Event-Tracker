import { useMemo, useState } from 'react';
import LineChart from '../charts/LineChart';
import { Card, StatTile } from './Card';
import { roundTimes } from '../../analytics/presence';
import { engagementOverTime, peakContactFrame } from '../../analytics/engagement';

const THRESHOLDS = [20, 40, 80]; // meters — musket bands

function fmtClock(s) {
  if (!Number.isFinite(s)) return '—';
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

export default function Engagement({ replay }) {
  const [threshold, setThreshold] = useState(40);
  const times = useMemo(() => roundTimes(replay), [replay]);
  const eng = useMemo(() => engagementOverTime(replay, threshold), [replay, threshold]);
  const peak = useMemo(() => peakContactFrame(eng), [eng]);

  const closest = useMemo(() => {
    let md = Infinity;
    let mf = -1;
    eng.minDist.forEach((v, f) => { if (v != null && v < md) { md = v; mf = f; } });
    return mf < 0 ? null : { dist: md, frame: mf };
  }, [eng]);

  const t0 = replay.frameTimes[0] || 0;

  return (
    <div className="space-y-3">
      <Card
        title="Engagement — where the lines met"
        hint="Opposing players within musket range each frame. The rise marks the clash; the trough in closest-approach marks the moment lines met."
        right={(
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-slate-500 mr-1">Range</span>
            {THRESHOLDS.map((t) => (
              <button
                key={t}
                onClick={() => setThreshold(t)}
                className={`px-2 py-0.5 text-[11px] rounded transition ${threshold === t ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
              >
                {t}m
              </button>
            ))}
          </div>
        )}
      >
        <div className="grid grid-cols-3 gap-2 mb-3 max-w-md">
          <StatTile label="Peak contacts" value={peak ? peak.contacts : 0} />
          <StatTile label="Peak at" value={peak ? fmtClock((replay.frameTimes[peak.frame] || 0) - t0) : '—'} />
          <StatTile label="Closest" value={closest ? `${Math.round(closest.dist * 1.0936)}yd` : '—'} />
        </div>
        <LineChart
          times={times}
          height={200}
          yFormat={(v) => `${Math.round(v)}`}
          yLabel={`pairs within ${threshold}m`}
          markers={peak ? [{ t: times[peak.frame], label: 'peak', color: '#f59e0b' }] : []}
          series={[{ key: 'contacts', label: 'Opposing pairs in range', color: '#f59e0b', values: eng.contacts }]}
        />
      </Card>

      <Card title="Closest approach" hint="Minimum distance between any two opposing players. The trough is the decisive contact.">
        <LineChart
          times={times}
          height={180}
          yFormat={(v) => `${Math.round(v)}yd`}
          series={[{ key: 'min', label: 'Closest opposing distance', color: '#22d3ee', values: eng.minDist.map((v) => (v == null ? null : v * 1.0936)) }]}
        />
      </Card>
    </div>
  );
}
