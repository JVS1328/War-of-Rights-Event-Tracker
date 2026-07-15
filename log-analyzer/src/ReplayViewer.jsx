import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, X, Crosshair, Search, ChevronDown, ChevronUp, Skull } from 'lucide-react';
import { MAPS, worldMetersToMapPx, headingToMapDelta } from './utils/mapCalibration.js';
import { LEADER_KIND } from './utils/replayParser.js';

// USA = team 1 = blue, CSA = team 2 = red. Hard-coded — replay is a god-view
// (not a player POV), so friend/foe inversion doesn't apply.
const TEAM_COLOR = {
  1: '#3b82f6',
  2: '#ef4444',
};
const TEAM_NAME  = { 1: 'USA', 2: 'CSA' };

const PLAYBACK_SPEEDS = [0.5, 1, 2, 4, 8];

// Pixel size of player icons at zoom = 1. Scaled visually with zoom but
// floored so they stay clickable when zoomed way out.
const ICON_RADIUS_PX = 5;
const HEADING_LEN_PX = 11;

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00';
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

// Binary-search the frameTimes array for the index at-or-before targetSec.
function frameIndexForTime(frameTimes, targetSec) {
  if (frameTimes.length === 0) return 0;
  let lo = 0, hi = frameTimes.length - 1;
  if (targetSec <= frameTimes[0]) return 0;
  if (targetSec >= frameTimes[hi]) return hi;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (frameTimes[mid] <= targetSec) lo = mid;
    else hi = mid;
  }
  return lo;
}

// Parse "HH:MM:SS" into seconds since midnight. Returns null on bad input.
function hmsToSec(s) {
  if (!s) return null;
  const m = String(s).match(/(\d{1,2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  return parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseInt(m[3], 10);
}

// Recover the round's t_s=0 wallclock from replay meta. The parser computes
// this directly from "first sample's hms minus its t_s" and stores it in
// meta.roundStartSec — that field is authoritative. The legacy fallback
// reads the recorder's `round_started_at` / `round_ended_at` header, which
// is reliable enough when no per-sample wallclock survived the round trip.
function roundStartSec(meta) {
  if (Number.isFinite(meta?.roundStartSec)) return meta.roundStartSec;
  return hmsToSec(meta?.startedAt);
}

// Map a scoreboard kill wallclock to replay-frame t_s. Handles a day rollover
// in the rare case of a round straddling midnight.
function killToReplayTs(killTime, startSec) {
  const k = hmsToSec(killTime);
  if (k == null || startSec == null) return null;
  let dt = k - startSec;
  if (dt < -3600) dt += 86400;
  return dt;
}

// Binary-search for the index of the last element with ts <= targetTs.
// Returns -1 when target is before the first element.
function lastIndexLE(sortedTs, targetTs) {
  if (sortedTs.length === 0 || targetTs < sortedTs[0]) return -1;
  let lo = 0, hi = sortedTs.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (sortedTs[mid] <= targetTs) lo = mid;
    else hi = mid;
  }
  return sortedTs[hi] <= targetTs ? hi : lo;
}

// Props:
//   replay          — parsed replay struct (required; the spine of the view)
//   kills           — optional array of scoreboard kill events (killer/victim/
//                     cause/time/…). When present, the live casualty panel +
//                     kill feed light up, aligned to replay t_s. Absent for a
//                     replay-only round.
//   finalCasualties — optional { usa, csa } round-final totals for the "X / Y".
export default function ReplayViewer({ replay, kills = null, finalCasualties = null }) {
  // --- core playback state ---
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [followIdx, setFollowIdx] = useState(-1);
  const [playerFilter, setPlayerFilter] = useState('');
  const [feedCollapsed, setFeedCollapsed] = useState(false);

  // --- canvas state ---
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [view, setView] = useState({ panX: 0, panY: 0, zoom: 1 });
  const viewInitialized = useRef(false);
  const draggingRef = useRef(null);   // { startX, startY, panX0, panY0 }
  const [hover, setHover] = useState(null); // { idx, x, y } in container-local px

  // --- map image loading ---
  const mapSlug = replay.meta.mapSlug;
  const mapInfo = mapSlug ? MAPS[mapSlug] : null;
  const [mapImg, setMapImg] = useState(null);
  useEffect(() => {
    if (!mapInfo) { setMapImg(null); return; }
    const img = new Image();
    img.onload  = () => setMapImg(img);
    img.onerror = () => setMapImg(null);
    img.src = `assets/maps/${mapInfo.file}`;
    return () => { img.onload = null; img.onerror = null; };
  }, [mapInfo?.file]);

  // --- canvas size to container ---
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 600 });
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const ent of entries) {
        const cr = ent.contentRect;
        setCanvasSize({ w: Math.max(200, Math.floor(cr.width)), h: Math.max(200, Math.floor(cr.height)) });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // --- initial view: fit map (or, if no map, frame all sampled positions) ---
  useEffect(() => {
    if (viewInitialized.current) return;
    if (mapImg) {
      const sx = canvasSize.w / mapImg.width;
      const sy = canvasSize.h / mapImg.height;
      const zoom = Math.min(sx, sy) * 0.95;
      setView({ panX: mapImg.width / 2, panY: mapImg.height / 2, zoom });
      viewInitialized.current = true;
    }
  }, [mapImg, canvasSize.w, canvasSize.h]);

  // --- timed kill index: scoreboard kills aligned to replay t_s ---
  // We only include kills that have a parseable time AND a usable round start
  // wallclock. Sorted by ts so live slicing is a single binary search.
  const timedKills = useMemo(() => {
    const startSec = roundStartSec(replay.meta);
    if (startSec == null || !kills) return { ts: new Float32Array(0), events: [] };
    const rows = [];
    for (const k of kills) {
      // killLog rows have `time`; non-killLog rounds carry empty objects.
      if (!k.time) continue;
      const ts = killToReplayTs(k.time, startSec);
      if (ts == null) continue;
      rows.push({ ts, ...k });
    }
    rows.sort((a, b) => a.ts - b.ts);
    return { ts: Float32Array.from(rows.map(r => r.ts)), events: rows };
  }, [replay.meta, kills]);

  // --- live counters at the current frame ---
  // Walks events up to current t_s, bucketing per team / cause / formation.
  // The kill feed is the trailing N events under current time.
  const FEED_DEPTH = 8;
  const liveStats = useMemo(() => {
    const curTs = replay.frameTimes[frame] || 0;
    const cut = lastIndexLE(timedKills.ts, curTs);
    const byTeam = { 1: 0, 2: 0 };
    const byCause = {};                         // cause → { 1: n, 2: n }
    const byFormation = {};                     // formation → { 1: n, 2: n }
    for (let i = 0; i <= cut; i++) {
      const ev = timedKills.events[i];
      const vt = ev.victimTeam;
      if (vt === 1 || vt === 2) byTeam[vt]++;
      if (ev.cause) {
        if (!byCause[ev.cause]) byCause[ev.cause] = { 1: 0, 2: 0 };
        if (vt === 1 || vt === 2) byCause[ev.cause][vt]++;
      }
      if (ev.victimFormation) {
        if (!byFormation[ev.victimFormation]) byFormation[ev.victimFormation] = { 1: 0, 2: 0 };
        if (vt === 1 || vt === 2) byFormation[ev.victimFormation][vt]++;
      }
    }
    const feed = [];
    for (let i = cut; i >= Math.max(0, cut - FEED_DEPTH + 1); i--) {
      feed.push(timedKills.events[i]);
    }
    return { byTeam, byCause, byFormation, feed, total: cut + 1 };
  }, [frame, replay.frameTimes, timedKills]);

  // Round-final totals from metadata for the "X / Y" display. Only used when
  // present (older rounds may not have a metadata block).
  const finalTotals = useMemo(() => {
    const usa = finalCasualties ? parseInt(finalCasualties.usa, 10) : NaN;
    const csa = finalCasualties ? parseInt(finalCasualties.csa, 10) : NaN;
    return {
      usa: Number.isFinite(usa) ? usa : null,
      csa: Number.isFinite(csa) ? csa : null,
    };
  }, [finalCasualties]);

  // --- precompute team buckets for the player list ---
  const teamBuckets = useMemo(() => {
    const usa = [], csa = [], other = [];
    replay.players.forEach((p, i) => {
      const entry = { ...p, index: i };
      if (p.team === 1)      usa.push(entry);
      else if (p.team === 2) csa.push(entry);
      else                   other.push(entry);
    });
    const byName = (a, b) => a.name.localeCompare(b.name);
    return { usa: usa.sort(byName), csa: csa.sort(byName), other: other.sort(byName) };
  }, [replay.players]);

  // --- animation loop ---
  // We don't tie playback to the renderer's RAF — playback time advances
  // monotonically by wallclock × speed, then we round to the nearest frame
  // index. That keeps scrub & play in sync without drifting.
  const playStateRef = useRef({ lastWall: 0, virtTimeSec: 0 });
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    playStateRef.current.lastWall = performance.now();
    playStateRef.current.virtTimeSec = replay.frameTimes[frame] || 0;
    const step = (now) => {
      const dtMs = now - playStateRef.current.lastWall;
      playStateRef.current.lastWall = now;
      playStateRef.current.virtTimeSec += (dtMs / 1000) * speed;
      const lastT = replay.frameTimes[replay.frameCount - 1] || 0;
      if (playStateRef.current.virtTimeSec >= lastT) {
        setFrame(replay.frameCount - 1);
        setPlaying(false);
        return;
      }
      setFrame(frameIndexForTime(replay.frameTimes, playStateRef.current.virtTimeSec));
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, replay.frameTimes, replay.frameCount]);

  // --- transform helpers ---
  const mapToScreen = useCallback((mx, my) => {
    return {
      x: (canvasSize.w / 2) + (mx - view.panX) * view.zoom,
      y: (canvasSize.h / 2) + (my - view.panY) * view.zoom,
    };
  }, [view, canvasSize.w, canvasSize.h]);

  const screenToMap = useCallback((sx, sy) => {
    return {
      x: (sx - canvasSize.w / 2) / view.zoom + view.panX,
      y: (sy - canvasSize.h / 2) / view.zoom + view.panY,
    };
  }, [view, canvasSize.w, canvasSize.h]);

  // --- follow camera: re-center every frame on the followed player ---
  useEffect(() => {
    if (followIdx < 0 || !mapSlug) return;
    const slot = frame * replay.playerCount + followIdx;
    const wx = replay.tracks.x[slot];
    if (Number.isNaN(wx)) return;
    const wy = replay.tracks.y[slot];
    const mp = worldMetersToMapPx(mapSlug, wx, wy);
    if (!mp) return;
    setView(v => ({ ...v, panX: mp.x, panY: mp.y }));
  }, [frame, followIdx, mapSlug, replay.playerCount, replay.tracks]);

  // --- draw ---
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, canvasSize.w, canvasSize.h);

    // background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvasSize.w, canvasSize.h);

    // map image
    if (mapImg) {
      const tl = mapToScreen(0, 0);
      ctx.drawImage(mapImg, tl.x, tl.y, mapImg.width * view.zoom, mapImg.height * view.zoom);
    } else if (mapSlug) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px system-ui, sans-serif';
      ctx.fillText(`Loading map ${mapSlug}…`, 20, 30);
    } else {
      ctx.fillStyle = '#fbbf24';
      ctx.font = '14px system-ui, sans-serif';
      ctx.fillText(`No calibration for map "${replay.meta.map}"`, 20, 30);
    }

    if (!mapSlug) return;

    // players
    const P = replay.playerCount;
    const base = frame * P;
    const { x: xs, y: ys, fx: fxs, fy: fys, lk: lks } = replay.tracks;
    for (let pi = 0; pi < P; pi++) {
      const wx = xs[base + pi];
      if (Number.isNaN(wx)) continue;
      const wy = ys[base + pi];
      const mp = worldMetersToMapPx(mapSlug, wx, wy);
      if (!mp) continue;
      const sp = mapToScreen(mp.x, mp.y);
      const team = replay.players[pi].team;
      const color = TEAM_COLOR[team] || '#a3a3a3';
      const kind = lks[base + pi];
      const isFollowed = pi === followIdx;

      const fx = fxs[base + pi];
      const fy = fys[base + pi];
      let headDx = 0, headDy = 0;
      if (Number.isFinite(fx) && Number.isFinite(fy)) {
        const hd = headingToMapDelta(mapSlug, fx, fy);
        if (hd) {
          const len = Math.hypot(hd.dx, hd.dy);
          if (len > 1e-4) {
            headDx = (hd.dx / len);
            headDy = (hd.dy / len);
          }
        }
      }

      if (kind === LEADER_KIND.OFFICER) {
        drawStar(ctx, sp.x, sp.y, ICON_RADIUS_PX + 2, color, isFollowed);
      } else if (kind === LEADER_KIND.FLAG) {
        drawFlag(ctx, sp.x, sp.y, ICON_RADIUS_PX + 2, color, isFollowed, headDx, headDy);
      } else {
        drawDot(ctx, sp.x, sp.y, ICON_RADIUS_PX, color, isFollowed, headDx, headDy);
      }
    }
  }, [frame, view, canvasSize.w, canvasSize.h, mapImg, mapSlug, followIdx,
      replay.playerCount, replay.tracks, replay.players, replay.meta.map]);

  // --- mouse handlers: pan + wheel zoom + click-to-follow ---
  const onMouseDown = (e) => {
    if (e.button !== 0) return;
    draggingRef.current = {
      startX: e.clientX, startY: e.clientY,
      panX0: view.panX, panY0: view.panY,
      moved: false,
    };
  };
  const onMouseMove = (e) => {
    const d = draggingRef.current;
    if (d) {
      const dxScreen = e.clientX - d.startX;
      const dyScreen = e.clientY - d.startY;
      if (Math.abs(dxScreen) + Math.abs(dyScreen) > 3) d.moved = true;
      if (d.moved) {
        // Pan: any pan disables follow (otherwise it'd snap back next frame).
        if (followIdx >= 0) setFollowIdx(-1);
        setView(v => ({
          ...v,
          panX: d.panX0 - dxScreen / v.zoom,
          panY: d.panY0 - dyScreen / v.zoom,
        }));
      }
      return;
    }
    // Idle: hit-test for a tooltip target.
    const rect = canvasRef.current.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const hit = hitTestPlayer(sx, sy);
    if (hit < 0) {
      if (hover) setHover(null);
    } else if (!hover || hover.idx !== hit || hover.x !== sx || hover.y !== sy) {
      setHover({ idx: hit, x: sx, y: sy });
    }
  };
  const onMouseUp = (e) => {
    const d = draggingRef.current;
    draggingRef.current = null;
    if (!d || d.moved) return;
    // Click without drag: try to hit-test a player.
    const rect = canvasRef.current.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const hit = hitTestPlayer(sx, sy);
    if (hit >= 0) setFollowIdx(hit === followIdx ? -1 : hit);
  };
  const hitTestPlayer = (sx, sy) => {
    if (!mapSlug) return -1;
    const P = replay.playerCount;
    const base = frame * P;
    const { x: xs, y: ys } = replay.tracks;
    let best = -1;
    let bestD2 = (ICON_RADIUS_PX + 4) * (ICON_RADIUS_PX + 4);
    for (let pi = 0; pi < P; pi++) {
      const wx = xs[base + pi];
      if (Number.isNaN(wx)) continue;
      const wy = ys[base + pi];
      const mp = worldMetersToMapPx(mapSlug, wx, wy);
      if (!mp) continue;
      const sp = mapToScreen(mp.x, mp.y);
      const ddx = sp.x - sx, ddy = sp.y - sy;
      const d2 = ddx * ddx + ddy * ddy;
      if (d2 < bestD2) { bestD2 = d2; best = pi; }
    }
    return best;
  };
  // React's synthetic onWheel handlers are passive — preventDefault() is
  // ignored, so the page scrolls underneath us. Wire the native event with
  // { passive: false } and own the zoom logic from there.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e) => {
      e.preventDefault();
      const canvasEl = canvasRef.current;
      if (!canvasEl) return;
      const rect = canvasEl.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const cx = canvasSize.w / 2, cy = canvasSize.h / 2;
      const factor = Math.exp(-e.deltaY * 0.0015);
      setView(v => {
        const zoom = Math.max(0.05, Math.min(8, v.zoom * factor));
        const beforeX = (sx - cx) / v.zoom + v.panX;
        const beforeY = (sy - cy) / v.zoom + v.panY;
        const panX = beforeX - (sx - cx) / zoom;
        const panY = beforeY - (sy - cy) / zoom;
        return { panX, panY, zoom };
      });
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [canvasSize.w, canvasSize.h]);

  // --- player list filtering ---
  const filterMatch = (p) => {
    if (!playerFilter) return true;
    return p.name.toLowerCase().includes(playerFilter.toLowerCase());
  };

  // --- jump helpers ---
  const goToFrame = (f) => {
    setFrame(Math.max(0, Math.min(replay.frameCount - 1, f)));
  };
  // Normalize the displayed clock against the first frame's t_s so a
  // mid-round-join replay still reads "0:00 / 6:06" instead of "1:04 /
  // 7:10". The underlying frameTimes stay in real round-time so kill
  // ts → frame mapping continues to line up exactly.
  const baseTime      = replay.frameTimes[0] || 0;
  const totalDuration = (replay.frameTimes[replay.frameCount - 1] || 0) - baseTime;
  const currentTime   = (replay.frameTimes[frame] || 0) - baseTime;

  const followedPlayer = followIdx >= 0 ? replay.players[followIdx] : null;
  const presentCount = useMemo(() => {
    const P = replay.playerCount;
    const base = frame * P;
    const xs = replay.tracks.x;
    let n = 0;
    for (let pi = 0; pi < P; pi++) if (!Number.isNaN(xs[base + pi])) n++;
    return n;
  }, [frame, replay.playerCount, replay.tracks.x]);

  return (
    <div className="bg-slate-700 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="text-sm font-semibold text-amber-400">
          Replay · {replay.meta.map || 'unknown map'}
          {replay.meta.area && ` · ${replay.meta.area}`}
        </div>
        <div className="text-xs text-slate-400">
          {replay.frameCount} frames @ {replay.meta.sampleRateHz} Hz · {replay.playerCount} players
        </div>
        {followedPlayer && (
          <button
            onClick={() => setFollowIdx(-1)}
            className="ml-auto flex items-center gap-1 px-2 py-1 bg-amber-700 hover:bg-amber-600 text-white text-xs rounded transition"
            title="Stop following"
          >
            <Crosshair className="w-3 h-3" /> Following: {followedPlayer.name}
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_240px] gap-3">
        {/* canvas */}
        <div
          ref={containerRef}
          className="relative bg-slate-900 rounded overflow-hidden"
          style={{ minHeight: '480px', height: '60vh', touchAction: 'none' }}
        >
          <canvas
            ref={canvasRef}
            width={canvasSize.w}
            height={canvasSize.h}
            className="block cursor-grab active:cursor-grabbing"
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={() => { draggingRef.current = null; setHover(null); }}
          />
          <div className="absolute top-2 right-2 bg-slate-800/80 text-xs text-slate-300 px-2 py-1 rounded">
            {presentCount}/{replay.playerCount} alive
          </div>

          {/* Live casualty panel + kill feed (top-left, collapsible) */}
          {timedKills.events.length > 0 && (
            <div className="absolute top-2 left-2 bg-slate-800/90 border border-slate-700 rounded shadow-lg text-xs text-slate-200 overflow-hidden max-w-[280px]">
              <button
                onClick={() => setFeedCollapsed(c => !c)}
                className="w-full px-2 py-1 flex items-center gap-1.5 hover:bg-slate-700/60 transition"
                title={feedCollapsed ? 'Expand' : 'Collapse'}
              >
                <Skull className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-semibold flex-1 text-left">Casualties · {liveStats.total}</span>
                {feedCollapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
              </button>
              {!feedCollapsed && (
                <div className="px-2 pb-2 space-y-2">
                  {/* Per-team totals */}
                  <div className="grid grid-cols-2 gap-1.5">
                    <TeamBox label="USA" color={TEAM_COLOR[1]} count={liveStats.byTeam[1]} final={finalTotals.usa} />
                    <TeamBox label="CSA" color={TEAM_COLOR[2]} count={liveStats.byTeam[2]} final={finalTotals.csa} />
                  </div>

                  {/* By cause */}
                  {Object.keys(liveStats.byCause).length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-0.5">By cause</div>
                      <div className="space-y-0.5">
                        {Object.entries(liveStats.byCause)
                          .sort((a, b) => (b[1][1] + b[1][2]) - (a[1][1] + a[1][2]))
                          .map(([cause, counts]) => (
                            <SplitRow key={cause} label={cause} usa={counts[1]} csa={counts[2]} />
                          ))}
                      </div>
                    </div>
                  )}

                  {/* By formation */}
                  {Object.keys(liveStats.byFormation).length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-0.5">By formation</div>
                      <div className="space-y-0.5">
                        {Object.entries(liveStats.byFormation)
                          .sort((a, b) => (b[1][1] + b[1][2]) - (a[1][1] + a[1][2]))
                          .map(([form, counts]) => (
                            <SplitRow key={form} label={form} usa={counts[1]} csa={counts[2]} />
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Recent kill feed */}
                  {liveStats.feed.length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-0.5">Recent kills</div>
                      <div className="space-y-0.5">
                        {liveStats.feed.map((ev, i) => (
                          <KillRow key={`${ev.ts}-${i}`} ev={ev} baseTime={baseTime} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {hover && (() => {
            const p = replay.players[hover.idx];
            const color = TEAM_COLOR[p.team] || '#a3a3a3';
            const kind = leaderKindForFrame(replay, frame, hover.idx);
            const role = kind === LEADER_KIND.OFFICER ? 'Officer'
                       : kind === LEADER_KIND.FLAG    ? 'Flag bearer'
                       :                                 null;
            // Clamp inside the container so the tooltip doesn't clip off-screen.
            const left = Math.min(hover.x + 12, canvasSize.w - 220);
            const top  = Math.min(hover.y + 12, canvasSize.h - 60);
            return (
              <div
                className="absolute pointer-events-none bg-slate-900/95 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 shadow-lg max-w-[220px]"
                style={{ left, top }}
              >
                <div className="flex items-center gap-1.5 font-semibold">
                  <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                  <span className="truncate">{p.name}</span>
                </div>
                <div className="text-slate-400 text-[10px]">
                  {TEAM_NAME[p.team] || `Team ${p.team}`}{role && ` · ${role}`}
                </div>
              </div>
            );
          })()}
        </div>

        {/* player list */}
        <div className="bg-slate-800 rounded p-2 flex flex-col" style={{ height: '60vh', minHeight: '480px' }}>
          <div className="relative mb-2">
            <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={playerFilter}
              onChange={e => setPlayerFilter(e.target.value)}
              placeholder="Filter…"
              className="w-full pl-7 pr-2 py-1 text-xs bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-amber-500"
            />
          </div>
          <div className="flex-1 overflow-y-auto space-y-2">
            <PlayerGroup
              label={`USA (${teamBuckets.usa.length})`}
              color={TEAM_COLOR[1]}
              players={teamBuckets.usa.filter(filterMatch)}
              followIdx={followIdx}
              onPick={setFollowIdx}
              frame={frame}
              replay={replay}
            />
            <PlayerGroup
              label={`CSA (${teamBuckets.csa.length})`}
              color={TEAM_COLOR[2]}
              players={teamBuckets.csa.filter(filterMatch)}
              followIdx={followIdx}
              onPick={setFollowIdx}
              frame={frame}
              replay={replay}
            />
            {teamBuckets.other.length > 0 && (
              <PlayerGroup
                label={`Other (${teamBuckets.other.length})`}
                color="#a3a3a3"
                players={teamBuckets.other.filter(filterMatch)}
                followIdx={followIdx}
                onPick={setFollowIdx}
                frame={frame}
                replay={replay}
              />
            )}
          </div>
        </div>
      </div>

      {/* timeline + transport */}
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => setPlaying(p => !p)}
          className="p-2 bg-amber-600 hover:bg-amber-500 text-white rounded transition"
          title={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
        <button
          onClick={() => goToFrame(frame - Math.round(replay.meta.sampleRateHz * 5))}
          className="p-2 bg-slate-600 hover:bg-slate-500 text-white rounded transition"
          title="Back 5s"
        >
          <SkipBack className="w-4 h-4" />
        </button>
        <button
          onClick={() => goToFrame(frame + Math.round(replay.meta.sampleRateHz * 5))}
          className="p-2 bg-slate-600 hover:bg-slate-500 text-white rounded transition"
          title="Forward 5s"
        >
          <SkipForward className="w-4 h-4" />
        </button>
        <input
          type="range"
          min={0}
          max={Math.max(0, replay.frameCount - 1)}
          step={1}
          value={frame}
          onChange={e => goToFrame(parseInt(e.target.value, 10))}
          className="flex-1 accent-amber-500"
        />
        <div className="text-xs text-slate-300 tabular-nums w-24 text-right">
          {formatTime(currentTime)} / {formatTime(totalDuration)}
        </div>
        <div className="flex gap-1">
          {PLAYBACK_SPEEDS.map(s => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`px-2 py-1 text-xs rounded transition ${
                speed === s
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-600 text-slate-200 hover:bg-slate-500'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function PlayerGroup({ label, color, players, followIdx, onPick, frame, replay }) {
  if (players.length === 0) return null;
  const P = replay.playerCount;
  const base = frame * P;
  const xs = replay.tracks.x;
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide mb-1 flex items-center gap-2" style={{ color }}>
        <span className="inline-block w-2 h-2 rounded-full" style={{ background: color }} />
        {label}
      </div>
      <div className="space-y-0.5">
        {players.map(p => {
          const alive = !Number.isNaN(xs[base + p.index]);
          const isFollowed = p.index === followIdx;
          return (
            <button
              key={p.index}
              onClick={() => onPick(isFollowed ? -1 : p.index)}
              className={`w-full text-left text-xs px-1.5 py-0.5 rounded flex items-center gap-1.5 transition ${
                isFollowed ? 'bg-amber-700 text-white' :
                alive       ? 'text-slate-200 hover:bg-slate-700' :
                              'text-slate-500 hover:bg-slate-700'
              }`}
              title={p.name}
            >
              <LeaderGlyph kind={leaderKindForFrame(replay, frame, p.index)} color={color} />
              <span className="truncate">{p.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TeamBox({ label, color, count, final }) {
  return (
    <div className="bg-slate-900/70 rounded px-1.5 py-1">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide" style={{ color }}>
        <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: color }} />
        {label}
      </div>
      <div className="font-bold text-sm tabular-nums" style={{ color }}>
        {count}
        {final != null && <span className="text-slate-500 text-[10px] font-normal"> / {final}</span>}
      </div>
    </div>
  );
}

function SplitRow({ label, usa, csa }) {
  return (
    <div className="flex items-center gap-1 text-[11px] tabular-nums">
      <span className="flex-1 truncate" title={label}>{label}</span>
      <span className="text-blue-400 w-5 text-right">{usa || ''}</span>
      <span className="text-slate-400">/</span>
      <span className="text-red-400 w-5 text-left">{csa || ''}</span>
    </div>
  );
}

function KillRow({ ev, baseTime = 0 }) {
  const killerColor = TEAM_COLOR[ev.killerTeam] || '#a3a3a3';
  const victimColor = TEAM_COLOR[ev.victimTeam] || '#a3a3a3';
  const killer = ev.killer || '(environment)';
  return (
    <div className="text-[11px] flex items-center gap-1 leading-tight">
      <span className="text-slate-500 tabular-nums shrink-0" title={ev.time || ''}>
        {formatRoundTime(ev.ts - baseTime)}
      </span>
      <span className="truncate" style={{ color: killerColor }} title={killer}>{killer}</span>
      <span className="text-slate-500 shrink-0">►</span>
      <span className="truncate" style={{ color: victimColor }} title={ev.victim}>{ev.victim}</span>
      {ev.cause && <span className="text-slate-500 text-[10px] shrink-0">·{ev.cause}</span>}
    </div>
  );
}

// Same M:SS format the main timeline uses. Negative ts (pre-recording kills)
// shouldn't happen in practice — the matcher slices to ts <= current frame —
// but we clamp anyway so a stray "−0:03" doesn't show up.
function formatRoundTime(ts) {
  if (!Number.isFinite(ts) || ts < 0) return '—:—';
  const s = Math.floor(ts);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function leaderKindForFrame(replay, frame, pi) {
  const base = frame * replay.playerCount;
  if (Number.isNaN(replay.tracks.x[base + pi])) return -1;
  return replay.tracks.lk[base + pi];
}

function LeaderGlyph({ kind, color }) {
  if (kind === LEADER_KIND.OFFICER) {
    return <span style={{ color }} className="text-sm leading-none">★</span>;
  }
  if (kind === LEADER_KIND.FLAG) {
    return <span style={{ color }} className="text-sm leading-none">⚑</span>;
  }
  return <span style={{ color }} className="text-sm leading-none">●</span>;
}

// --- icon renderers ---

function drawDot(ctx, x, y, radius, color, highlight, headDx, headDy) {
  // body
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = highlight ? 2 : 1;
  ctx.strokeStyle = highlight ? '#ffffff' : 'rgba(0,0,0,0.6)';
  ctx.stroke();
  // heading triangle pointing along (headDx, headDy)
  if (headDx !== 0 || headDy !== 0) {
    const tipLen = HEADING_LEN_PX;
    const px = -headDy, py = headDx; // perpendicular
    const tipX = x + headDx * tipLen;
    const tipY = y + headDy * tipLen;
    const blX  = x - headDx * (tipLen * 0.3) + px * (radius * 0.9);
    const blY  = y - headDy * (tipLen * 0.3) + py * (radius * 0.9);
    const brX  = x - headDx * (tipLen * 0.3) - px * (radius * 0.9);
    const brY  = y - headDy * (tipLen * 0.3) - py * (radius * 0.9);
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(blX, blY);
    ctx.lineTo(brX, brY);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 0.75;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.stroke();
  }
}

function drawStar(ctx, cx, cy, r, color, highlight) {
  // 5-point star
  const points = 5;
  const outer = r * 1.5;
  const inner = r * 0.6;
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = highlight ? 2 : 1;
  ctx.strokeStyle = highlight ? '#ffffff' : 'rgba(0,0,0,0.7)';
  ctx.stroke();
}

function drawFlag(ctx, cx, cy, r, color, highlight, headDx, headDy) {
  // Pennant: vertical staff with a triangular flag on top, leaning along
  // the heading vector if we have one.
  const staffLen = r * 2.2;
  const flagW    = r * 1.8;
  const flagH    = r * 1.4;
  // Tilt the staff slightly based on heading so it reads as motion.
  const tiltX = (headDx || 0) * 0.3;
  const tiltY = (headDy || 0) * 0.3;
  const topX = cx + tiltX * staffLen;
  const topY = cy - staffLen + tiltY * staffLen;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(topX, topY);
  ctx.lineWidth = highlight ? 2.5 : 1.5;
  ctx.strokeStyle = highlight ? '#ffffff' : 'rgba(0,0,0,0.8)';
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(topX, topY);
  ctx.lineTo(topX + flagW, topY + flagH * 0.4);
  ctx.lineTo(topX,         topY + flagH);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.stroke();
  // small base dot
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}
