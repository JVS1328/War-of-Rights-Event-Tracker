import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { HEX_SIZE, hexKey, hexToPixel, hexPolygonPoints, gridBounds, pixelToHex } from '../utils/hexMath';
import { TERRAIN, getCityByHex } from '../data/defaultBoard';

const TERRAIN_FILL = {
  field:  '#dfe6b3',
  forest: '#3c7a3a',
  river:  '#3a6fae',
  water:  '#1f4f6e'
};

const OWNER_STROKE = {
  USA: '#3b82f6',
  CSA: '#ef4444',
  NEUTRAL: '#71717a'
};

const KIND_ICON = {
  capital: '★',
  city:    '●',
  fort:    '▲',
  station: '■'
};

const KIND_FILL = {
  capital: '#facc15',
  city:    '#f4f4f5',
  fort:    '#f4f4f5',
  station: '#d4d4d8'
};

const HexBoard = ({
  board,
  units = [],
  tokensBySide = null,
  activeUnitId = null,
  reachableHexes = null,       // Object: { hexKey: { mpUsed } }
  highlightHexes = null,       // Set<hexKey>
  selectedHex = null,
  onHexClick,
  onHexContextMenu,
  onTokenClick,
  editorMode = false,
  disableHover = false,
  cursorHex = null,
  extraOverlays = null
}) => {
  const svgRef = useRef(null);
  const [viewTransform, setViewTransform] = useState({ x: 0, y: 0, scale: 0.7 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [viewport, setViewport] = useState({ width: 1000, height: 700 });

  useEffect(() => {
    const update = () => {
      if (svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect();
        setViewport({ width: rect.width, height: rect.height });
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const bounds = useMemo(() => {
    const allHexes = Object.keys(board.hexes || {}).map(k => {
      const [q, r] = k.split(',').map(Number);
      return { q, r };
    });
    return gridBounds(allHexes);
  }, [board]);

  // Fit to screen when board changes
  useEffect(() => {
    const sx = viewport.width / bounds.width;
    const sy = viewport.height / bounds.height;
    const scale = Math.min(sx, sy) * 0.95;
    setViewTransform({
      x: (viewport.width - bounds.width * scale) / 2 - bounds.minX * scale,
      y: (viewport.height - bounds.height * scale) / 2 - bounds.minY * scale,
      scale
    });
  }, [bounds.minX, bounds.minY, bounds.width, bounds.height, viewport.width, viewport.height]);

  // Viewport-cull: only render hexes whose pixel coords intersect the visible rect
  const visibleKeys = useMemo(() => {
    const out = new Set();
    const invScale = 1 / viewTransform.scale;
    const vx0 = -viewTransform.x * invScale - HEX_SIZE * 2;
    const vy0 = -viewTransform.y * invScale - HEX_SIZE * 2;
    const vx1 = (-viewTransform.x + viewport.width) * invScale + HEX_SIZE * 2;
    const vy1 = (-viewTransform.y + viewport.height) * invScale + HEX_SIZE * 2;

    for (const key of Object.keys(board.hexes)) {
      const [q, r] = key.split(',').map(Number);
      const { x, y } = hexToPixel(q, r);
      if (x >= vx0 && x <= vx1 && y >= vy0 && y <= vy1) out.add(key);
    }
    return out;
  }, [board, viewTransform, viewport]);

  const handleMouseDown = (e) => {
    if (e.button !== 0 && e.button !== 1) return;
    if (e.button === 0 && !e.shiftKey) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - viewTransform.x, y: e.clientY - viewTransform.y });
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setViewTransform(prev => ({ ...prev, x: e.clientX - dragStart.x, y: e.clientY - dragStart.y }));
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    const newScale = Math.min(3, Math.max(0.2, viewTransform.scale * (1 + delta)));
    const rect = svgRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const worldX = (mx - viewTransform.x) / viewTransform.scale;
    const worldY = (my - viewTransform.y) / viewTransform.scale;
    setViewTransform({
      x: mx - worldX * newScale,
      y: my - worldY * newScale,
      scale: newScale
    });
  };

  const pxToWorld = (cx, cy) => {
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: (cx - rect.left - viewTransform.x) / viewTransform.scale,
      y: (cy - rect.top - viewTransform.y) / viewTransform.scale
    };
  };

  const handleClick = useCallback((e, hexK) => {
    if (isDragging) return;
    onHexClick?.(hexK, e);
  }, [isDragging, onHexClick]);

  const cityByHex = useMemo(() => {
    const map = {};
    for (const c of board.cities) map[c.hexKey] = c;
    return map;
  }, [board]);

  const unitByHex = useMemo(() => {
    const map = {};
    for (const u of units) {
      if (u.hexKey && !u.wiped) map[u.hexKey] = u;
    }
    return map;
  }, [units]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: '#0f172a', userSelect: 'none' }}>
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{ cursor: isDragging ? 'grabbing' : 'default', display: 'block' }}
      >
        <g transform={`translate(${viewTransform.x},${viewTransform.y}) scale(${viewTransform.scale})`}>
          {/* Hexes */}
          {Array.from(visibleKeys).map((key) => {
            const [q, r] = key.split(',').map(Number);
            const { x: cx, y: cy } = hexToPixel(q, r);
            const tile = board.hexes[key];
            const fill = TERRAIN_FILL[tile.terrain] || '#444';
            const isSel = selectedHex === key;
            const isReach = reachableHexes && reachableHexes[key];
            const isHighlight = highlightHexes && highlightHexes.has(key);
            const isCursor = cursorHex === key;
            return (
              <polygon
                key={key}
                points={hexPolygonPoints(cx, cy)}
                fill={isReach ? '#fbbf24' : fill}
                fillOpacity={isReach ? 0.55 : 1}
                stroke={isSel ? '#fbbf24' : isHighlight ? '#22d3ee' : isCursor ? '#fde68a' : '#0f172a'}
                strokeWidth={(isSel || isHighlight || isCursor) ? 2.5 : 0.5}
                onClick={(e) => handleClick(e, key)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  onHexContextMenu?.(key, e);
                }}
                style={{ cursor: 'pointer' }}
              />
            );
          })}

          {/* Rail lines */}
          {board.rails.map((rail, idx) => {
            const a = board.cities.find(c => c.id === rail.from);
            const b = board.cities.find(c => c.id === rail.to);
            if (!a || !b) return null;
            const pa = hexToPixel(a.q, a.r);
            const pb = hexToPixel(b.q, b.r);
            if (!visibleKeys.has(a.hexKey) && !visibleKeys.has(b.hexKey)) return null;
            return (
              <line
                key={`rail-${idx}`}
                x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
                stroke="#78350f"
                strokeWidth={3}
                strokeDasharray="6,4"
                opacity={0.85}
              />
            );
          })}

          {/* City/Fort/Station/Capital markers */}
          {board.cities.map((city) => {
            if (!visibleKeys.has(city.hexKey)) return null;
            const { x, y } = hexToPixel(city.q, city.r);
            const icon = KIND_ICON[city.kind] || '●';
            const fill = KIND_FILL[city.kind] || '#fff';
            const stroke = OWNER_STROKE[city.owner] || OWNER_STROKE.NEUTRAL;
            return (
              <g key={city.id} transform={`translate(${x},${y})`}>
                <circle r={HEX_SIZE * 0.55} fill={fill} stroke={stroke} strokeWidth={3} />
                <text
                  x={0} y={4}
                  textAnchor="middle"
                  style={{ fontSize: HEX_SIZE * 0.7, fontWeight: 'bold', pointerEvents: 'none' }}
                  fill={stroke}
                >
                  {icon}
                </text>
                <text
                  x={0} y={HEX_SIZE + 6}
                  textAnchor="middle"
                  style={{ fontSize: 11, fontWeight: 'bold', pointerEvents: 'none' }}
                  fill="#f8fafc"
                  stroke="#0f172a"
                  strokeWidth={0.4}
                >
                  {city.name}
                </text>
                {city.garrison > 0 && (
                  <text
                    x={0} y={HEX_SIZE + 18}
                    textAnchor="middle"
                    style={{ fontSize: 9, pointerEvents: 'none' }}
                    fill="#fcd34d"
                  >
                    G: {city.garrison}
                  </text>
                )}
              </g>
            );
          })}

          {/* Tokens */}
          {units.filter(u => u.hexKey && !u.wiped).map(u => {
            if (!visibleKeys.has(u.hexKey)) return null;
            const { x, y } = hexToPixel(...u.hexKey.split(',').map(Number));
            const color = u.faction === 'USA' ? '#1d4ed8' : '#991b1b';
            const sel = u.id === activeUnitId;
            return (
              <g
                key={u.id}
                transform={`translate(${x - HEX_SIZE * 0.55},${y - HEX_SIZE * 0.9})`}
                style={{ cursor: 'pointer' }}
                onClick={(e) => { e.stopPropagation(); onTokenClick?.(u.id, e); }}
              >
                <rect
                  width={HEX_SIZE * 1.1}
                  height={HEX_SIZE * 0.55}
                  rx={4}
                  fill={color}
                  stroke={sel ? '#fbbf24' : u.lastStand ? '#f97316' : '#0f172a'}
                  strokeWidth={sel ? 3 : u.lastStand ? 2 : 1}
                />
                <text
                  x={HEX_SIZE * 0.55} y={HEX_SIZE * 0.35}
                  textAnchor="middle"
                  style={{ fontSize: 10, fontWeight: 'bold', pointerEvents: 'none' }}
                  fill="#f8fafc"
                >
                  {u.name}
                </text>
                <text
                  x={HEX_SIZE * 0.55} y={HEX_SIZE * 0.55}
                  textAnchor="middle"
                  style={{ fontSize: 8, pointerEvents: 'none' }}
                  fill="#fcd34d"
                >
                  {u.manpower}
                  {u.fatigue > 0 ? ` F${u.fatigue}` : ''}
                </text>
              </g>
            );
          })}

          {extraOverlays}
        </g>
      </svg>

      {/* Controls hint */}
      <div style={{ position: 'absolute', bottom: 8, left: 8, fontSize: 11, color: '#94a3b8', background: 'rgba(15,23,42,0.8)', padding: '4px 8px', borderRadius: 4 }}>
        Shift+drag to pan · Scroll to zoom · Click hex
      </div>
    </div>
  );
};

export default HexBoard;
