import { useMemo, useRef, useState, useEffect } from 'react';
import { Card } from './Card';
import { TEAM } from './teams';
import { MAPS } from '../../utils/mapCalibration';
import { presencePoints, casualtyPoints } from '../../analytics/heatmap';

const CELL = 26;              // map-pixel grid cell for density binning
const TEAM_FILTERS = [
  { key: 'both', label: 'Both' },
  { key: 'usa', label: 'USA' },
  { key: 'csa', label: 'CSA' },
];

function filterFor(key) {
  if (key === 'usa') return (p) => p.team === 1;
  if (key === 'csa') return (p) => p.team === 2;
  return null;
}

export default function Heatmap({ replay, scoreboard }) {
  const slug = replay.meta.mapSlug;
  const mapInfo = slug ? MAPS[slug] : null;
  const kills = scoreboard?.kills || null;

  const [teamKey, setTeamKey] = useState('both');
  const [showCasualties, setShowCasualties] = useState(!!kills);
  const [mapImg, setMapImg] = useState(null);
  const [w, setW] = useState(720);
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!mapInfo) { setMapImg(null); return; }
    const img = new Image();
    img.onload = () => setMapImg(img);
    img.onerror = () => setMapImg(null);
    img.src = `assets/maps/${mapInfo.file}`;
    return () => { img.onload = null; img.onerror = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapInfo?.file]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setW(Math.max(320, Math.floor(e.contentRect.width)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const points = useMemo(
    () => (slug ? presencePoints(replay, slug, filterFor(teamKey)) : new Float32Array(0)),
    [replay, slug, teamKey],
  );
  const casualties = useMemo(
    () => (slug && kills ? casualtyPoints(replay, kills, slug) : []),
    [replay, slug, kills],
  );

  // Bin the points into a density grid (map-pixel space).
  const grid = useMemo(() => {
    if (!mapImg) return null;
    const cols = Math.ceil(mapImg.width / CELL);
    const rows = Math.ceil(mapImg.height / CELL);
    const cells = new Float32Array(cols * rows);
    let max = 0;
    for (let i = 0; i < points.length; i += 2) {
      const c = Math.floor(points[i] / CELL);
      const r = Math.floor(points[i + 1] / CELL);
      if (c < 0 || r < 0 || c >= cols || r >= rows) continue;
      const v = ++cells[r * cols + c];
      if (v > max) max = v;
    }
    return { cells, cols, rows, max };
  }, [points, mapImg]);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !mapImg) return;
    const scale = w / mapImg.width;
    const h = Math.round(mapImg.height * scale);
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(mapImg, 0, 0, w, h);

    // density cells
    if (grid && grid.max > 0) {
      const denom = Math.sqrt(grid.max);
      for (let r = 0; r < grid.rows; r++) {
        for (let c = 0; c < grid.cols; c++) {
          const v = grid.cells[r * grid.cols + c];
          if (!v) continue;
          const a = Math.min(0.82, (Math.sqrt(v) / denom) * 0.82);
          ctx.fillStyle = `rgba(245, 158, 11, ${a})`;
          ctx.fillRect(c * CELL * scale, r * CELL * scale, CELL * scale + 1, CELL * scale + 1);
        }
      }
    }

    // casualty markers
    if (showCasualties && casualties.length) {
      for (const k of casualties) {
        ctx.beginPath();
        ctx.arc(k.x * scale, k.y * scale, 3, 0, Math.PI * 2);
        ctx.fillStyle = k.victimTeam === 1 ? TEAM.usa : TEAM.csa;
        ctx.globalAlpha = 0.9;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.lineWidth = 0.75;
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.stroke();
      }
    }
  }, [mapImg, grid, w, showCasualties, casualties]);

  if (!slug) {
    return (
      <Card title="Heatmap">
        <div className="text-xs text-amber-400 py-2">No map calibration for &quot;{replay.meta.map}&quot; — can&apos;t project positions.</div>
      </Card>
    );
  }

  return (
    <Card
      title="Position heatmap"
      hint="Where the fighting concentrated over the whole round. Brighter = more time spent there."
      right={(
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {TEAM_FILTERS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTeamKey(t.key)}
                className={`px-2 py-0.5 text-[11px] rounded transition ${teamKey === t.key ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {kills && (
            <button
              onClick={() => setShowCasualties((s) => !s)}
              className={`px-2 py-0.5 text-[11px] rounded transition ${showCasualties ? 'bg-slate-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
              title="Toggle casualty locations from the scoreboard"
            >
              Casualties
            </button>
          )}
        </div>
      )}
    >
      <div ref={wrapRef} className="w-full bg-slate-900 rounded overflow-hidden">
        {mapImg ? (
          <canvas ref={canvasRef} className="block w-full" />
        ) : (
          <div className="p-12 text-center text-slate-500 text-sm">Loading map…</div>
        )}
      </div>
      {showCasualties && casualties.length > 0 && (
        <div className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-3">
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full" style={{ background: TEAM.usa }} /> USA fell</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full" style={{ background: TEAM.csa }} /> CSA fell</span>
          <span>· {casualties.length} casualties located</span>
        </div>
      )}
    </Card>
  );
}
