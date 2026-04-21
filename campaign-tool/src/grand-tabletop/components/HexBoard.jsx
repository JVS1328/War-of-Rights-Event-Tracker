import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { HEX_SIZE, hexKey, hexToPixel, hexPolygonPoints, gridBounds, pixelToHex } from '../utils/hexMath';
import { TERRAIN, getCityByHex } from '../data/defaultBoard';

// Classic hex-wargame pastel palette (parchment feel).
const BOARD_BG = '#e8dfbe';
const HEX_STROKE = '#b89e6d';

const TERRAIN_FILL = {
  field:  '#ece2bb',
  forest: '#95a975',
  river:  '#a8c6d3',
  water:  '#8ca9b8'
};

// Thin owner-color border on city labels.
const OWNER_STROKE = {
  USA: '#1e3a8a',
  CSA: '#991b1b',
  NEUTRAL: '#57534e'
};

// Compact glyph shown to the left of each city label.
const KIND_ICON = {
  capital: '★',
  city:    '●',
  fort:    '▲',
  station: '■'
};

const STATE_LABEL_STYLE = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontWeight: 'bold',
  fill: '#7a5a2e',
  opacity: 0.28,
  letterSpacing: '0.3em',
  pointerEvents: 'none'
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

  // Parallel-line rail rendering: offset each line perpendicular to the rail axis.
  const renderRail = (rail, idx) => {
    const a = board.cities.find(c => c.id === rail.from);
    const b = board.cities.find(c => c.id === rail.to);
    if (!a || !b) return null;
    if (!visibleKeys.has(a.hexKey) && !visibleKeys.has(b.hexKey)) return null;
    const pa = hexToPixel(a.q, a.r);
    const pb = hexToPixel(b.q, b.r);
    const dx = pb.x - pa.x;
    const dy = pb.y - pa.y;
    const len = Math.hypot(dx, dy) || 1;
    const ox = (-dy / len) * 2.5;
    const oy = ( dx / len) * 2.5;
    return (
      <g key={`rail-${idx}`} pointerEvents="none">
        <line x1={pa.x + ox} y1={pa.y + oy} x2={pb.x + ox} y2={pb.y + oy} stroke="#2b1f12" strokeWidth={1.1} />
        <line x1={pa.x - ox} y1={pa.y - oy} x2={pb.x - ox} y2={pb.y - oy} stroke="#2b1f12" strokeWidth={1.1} />
      </g>
    );
  };

  const renderCity = (city) => {
    if (!visibleKeys.has(city.hexKey)) return null;
    const { x, y } = hexToPixel(city.q, city.r);
    const stroke = OWNER_STROKE[city.owner] || OWNER_STROKE.NEUTRAL;
    const icon = KIND_ICON[city.kind] || '●';
    const isCapital = city.kind === 'capital';

    const name = city.name;
    const approxW = Math.max(name.length * 5.4, 36) + 16;
    const boxW = approxW;
    const boxH = 16;

    return (
      <g key={city.id} transform={`translate(${x},${y})`} pointerEvents="none">
        {/* subtle halo so the box reads on dense terrain */}
        <rect x={-boxW / 2 - 1} y={HEX_SIZE * 0.15 - 1} width={boxW + 2} height={boxH + 2}
              rx={3} fill="#f7efd3" opacity={0.85} />
        {/* name box */}
        <rect x={-boxW / 2} y={HEX_SIZE * 0.15} width={boxW} height={boxH}
              rx={2} fill="#faf3d9" stroke={stroke} strokeWidth={isCapital ? 1.6 : 0.9} />
        <text x={-boxW / 2 + 5} y={HEX_SIZE * 0.15 + 12}
              style={{ fontSize: 10, fontWeight: 'bold', fontFamily: 'Georgia, serif' }}
              fill={stroke}>
          {icon}
        </text>
        <text x={-boxW / 2 + 16} y={HEX_SIZE * 0.15 + 12}
              style={{ fontSize: 10, fontWeight: 'bold', fontFamily: 'Georgia, serif', letterSpacing: '0.02em' }}
              fill="#2b1f12">
          {name}
        </text>
        {/* capital emphasis: dark outer ring around the hex center */}
        {isCapital && (
          <circle r={HEX_SIZE * 0.36} fill="none" stroke={stroke} strokeWidth={2.4} opacity={0.75} />
        )}
        {!isCapital && (
          <circle r={HEX_SIZE * 0.22} fill={stroke} opacity={0.22} />
        )}
        {city.garrison > 0 && (
          <text x={0} y={HEX_SIZE * 0.15 + boxH + 10}
                textAnchor="middle"
                style={{ fontSize: 9, fontWeight: 'bold' }}
                fill="#7a4a00">
            G:{city.garrison}
          </text>
        )}
      </g>
    );
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: BOARD_BG, userSelect: 'none' }}>
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
            const fill = TERRAIN_FILL[tile.terrain] || TERRAIN_FILL.field;
            const isSel = selectedHex === key;
            const isReach = reachableHexes && reachableHexes[key];
            const isHighlight = highlightHexes && highlightHexes.has(key);
            const isCursor = cursorHex === key;
            return (
              <polygon
                key={key}
                points={hexPolygonPoints(cx, cy)}
                fill={isReach ? '#f5c657' : fill}
                fillOpacity={isReach ? 0.7 : 1}
                stroke={isSel ? '#c2410c' : isHighlight ? '#0e7490' : isCursor ? '#b45309' : HEX_STROKE}
                strokeWidth={(isSel || isHighlight || isCursor) ? 2.2 : 0.4}
                strokeOpacity={(isSel || isHighlight || isCursor) ? 1 : 0.55}
                onClick={(e) => handleClick(e, key)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  onHexContextMenu?.(key, e);
                }}
                style={{ cursor: 'pointer' }}
              />
            );
          })}

          {/* State labels (big translucent caps, classic wargame look) */}
          {(board.stateLabels || []).map((lbl, i) => {
            const { x, y } = hexToPixel(lbl.q, lbl.r);
            return (
              <text
                key={`state-${i}`}
                x={x} y={y}
                textAnchor="middle"
                style={{ ...STATE_LABEL_STYLE, fontSize: lbl.fontSize || 42 }}
              >
                {lbl.name.toUpperCase()}
              </text>
            );
          })}

          {/* Rail lines */}
          {board.rails.map(renderRail)}

          {/* City/Fort/Station/Capital markers */}
          {board.cities.map(renderCity)}

          {/* Tokens */}
          {units.filter(u => u.hexKey && !u.wiped).map(u => {
            if (!visibleKeys.has(u.hexKey)) return null;
            const { x, y } = hexToPixel(...u.hexKey.split(',').map(Number));
            const color = u.faction === 'USA' ? '#1e3a8a' : '#991b1b';
            const sel = u.id === activeUnitId;
            return (
              <g
                key={u.id}
                transform={`translate(${x - HEX_SIZE * 0.55},${y - HEX_SIZE * 0.95})`}
                style={{ cursor: 'pointer' }}
                onClick={(e) => { e.stopPropagation(); onTokenClick?.(u.id, e); }}
              >
                <rect
                  width={HEX_SIZE * 1.1}
                  height={HEX_SIZE * 0.55}
                  rx={2}
                  fill={color}
                  stroke={sel ? '#ea580c' : u.lastStand ? '#f97316' : '#1c0f04'}
                  strokeWidth={sel ? 2.5 : u.lastStand ? 2 : 1}
                />
                <text
                  x={HEX_SIZE * 0.55} y={HEX_SIZE * 0.3}
                  textAnchor="middle"
                  style={{ fontSize: 10, fontWeight: 'bold', pointerEvents: 'none', fontFamily: 'Georgia, serif' }}
                  fill="#faf3d9"
                >
                  {u.name}
                </text>
                <text
                  x={HEX_SIZE * 0.55} y={HEX_SIZE * 0.5}
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

      <div style={{ position: 'absolute', bottom: 8, left: 8, fontSize: 11, color: '#3d2f14', background: 'rgba(247,239,211,0.9)', padding: '4px 8px', borderRadius: 4, border: '1px solid #b89e6d' }}>
        Shift+drag to pan · Scroll to zoom · Click hex
      </div>
    </div>
  );
};

export default HexBoard;
