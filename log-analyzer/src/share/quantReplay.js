// Quantized replay serialization — for SHARE payloads only.
//
// The IndexedDB codec (utils/replayCodec) keeps every float bit-for-bit, which
// is right for local fidelity but far too heavy for a URL/Redis share once an
// event carries several rounds of dense position traces. For sharing we trade
// imperceptible precision for a much smaller payload:
//
//   x, y   world meters   → int16 across the replay's own bounds (~5 cm on a
//                           3 km map — well under a pixel on the after-action)
//   fx, fy heading vector  → int8 unit direction. The viewer renormalizes the
//                           heading, so only its direction matters, and that is
//                           all int8 needs to preserve.
//   z      vertical        → DROPPED. Nothing in the after-action or the viewer
//                           reads it; rebuilt as zeros on decode.
//   lk     leader kind     → kept (1 byte).
//
// That is ~7 bytes/player-frame vs 21, and the smoother integer streams also
// deflate better. Decoding rebuilds the exact { tracks: {x,y,z,fx,fy,lk} } shape
// the viewer/analytics expect, with x=NaN marking unsampled frames like the
// parser does.

const FMT = 1;
const SENTINEL = -32768;          // int16 x value meaning "not sampled"
const RANGE = 65534;              // int16 data span (-32767 … 32767)
const enc = new TextEncoder();
const dec = new TextDecoder('utf-8');

// `stride` keeps every stride-th frame (1 = all). Downsampling in time is the
// last lever for events whose full traces overflow the share store — the
// analytics aggregate over frames so they stay meaningful, and playback just
// gets coarser.
export function encodeQuantReplay(replay, stride = 1) {
  const s = Math.max(1, Math.floor(stride) || 1);
  const Fsrc = replay.frameCount;
  const P = replay.playerCount;
  const F = Math.ceil(Fsrc / s);     // shared (possibly downsampled) frame count
  const N = F * P;
  const { x, y, fx, fy, lk } = replay.tracks;

  // Bounds over sampled positions in the kept frames only (unsampled x is NaN).
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let j = 0; j < F; j++) {
    const base = (j * s) * P;
    for (let p = 0; p < P; p++) {
      const i = base + p;
      if (Number.isNaN(x[i])) continue;
      if (x[i] < minX) minX = x[i];
      if (x[i] > maxX) maxX = x[i];
      if (y[i] < minY) minY = y[i];
      if (y[i] > maxY) maxY = y[i];
    }
  }
  if (!Number.isFinite(minX)) { minX = 0; maxX = 0; minY = 0; maxY = 0; }
  const spanX = maxX - minX;
  const spanY = maxY - minY;

  const qx = new Int16Array(N);
  const qy = new Int16Array(N);
  const qfx = new Int8Array(N);
  const qfy = new Int8Array(N);
  const qlk = new Uint8Array(N);
  const ft = new Float32Array(F);
  const srcFt = replay.frameTimes;
  const qpos = (v, min, span) => {
    if (span <= 0) return 0;
    let q = Math.round(((v - min) / span) * RANGE) - 32767;
    if (q < -32767) q = -32767; else if (q > 32767) q = 32767;
    return q;
  };
  for (let j = 0; j < F; j++) {
    const sf = j * s;
    ft[j] = srcFt[sf];
    const sBase = sf * P;
    const dBase = j * P;
    for (let p = 0; p < P; p++) {
      const si = sBase + p;
      const di = dBase + p;
      if (Number.isNaN(x[si])) { qx[di] = SENTINEL; continue; } // rest stay 0
      qx[di] = qpos(x[si], minX, spanX);
      qy[di] = qpos(y[si], minY, spanY);
      const len = Math.hypot(fx[si], fy[si]);
      if (len > 1e-6) {
        qfx[di] = Math.max(-127, Math.min(127, Math.round((fx[si] / len) * 127)));
        qfy[di] = Math.max(-127, Math.min(127, Math.round((fy[si] / len) * 127)));
      }
      qlk[di] = lk[si];
    }
  }

  const metaBytes = enc.encode(JSON.stringify(replay.meta));
  const playersBytes = enc.encode(JSON.stringify(replay.players));

  const HEAD = 28; // fmt+flags+pad(4) F(4) P(4) minX,spanX,minY,spanY(16)
  const total = HEAD
    + 4 + metaBytes.byteLength
    + 4 + playersBytes.byteLength
    + F * 4 + N * 2 + N * 2 + N + N + N;

  const ab = new ArrayBuffer(total);
  const dv = new DataView(ab);
  const u8 = new Uint8Array(ab);
  let off = 0;
  dv.setUint8(off, FMT); dv.setUint8(off + 1, 0); off += 4;
  dv.setUint32(off, F, true); off += 4;
  dv.setUint32(off, P, true); off += 4;
  dv.setFloat32(off, minX, true); off += 4;
  dv.setFloat32(off, spanX, true); off += 4;
  dv.setFloat32(off, minY, true); off += 4;
  dv.setFloat32(off, spanY, true); off += 4;

  const writeChunk = (bytes) => {
    dv.setUint32(off, bytes.byteLength, true); off += 4;
    u8.set(bytes, off); off += bytes.byteLength;
  };
  writeChunk(metaBytes);
  writeChunk(playersBytes);

  const writeBytes = (ta) => {
    u8.set(new Uint8Array(ta.buffer, ta.byteOffset, ta.byteLength), off);
    off += ta.byteLength;
  };
  writeBytes(ft);
  writeBytes(qx); writeBytes(qy); writeBytes(qfx); writeBytes(qfy); writeBytes(qlk);

  return ab;
}

export function decodeQuantReplay(ab) {
  const dv = new DataView(ab);
  const u8 = new Uint8Array(ab);
  let off = 0;
  const fmt = dv.getUint8(off); off += 4;
  if (fmt !== FMT) throw new Error(`Unsupported quant replay fmt ${fmt}`);
  const F = dv.getUint32(off, true); off += 4;
  const P = dv.getUint32(off, true); off += 4;
  const minX = dv.getFloat32(off, true); off += 4;
  const spanX = dv.getFloat32(off, true); off += 4;
  const minY = dv.getFloat32(off, true); off += 4;
  const spanY = dv.getFloat32(off, true); off += 4;
  const N = F * P;

  const readChunk = () => {
    const len = dv.getUint32(off, true); off += 4;
    const obj = JSON.parse(dec.decode(u8.subarray(off, off + len)));
    off += len;
    return obj;
  };
  const meta = readChunk();
  const players = readChunk();

  // Slice each stream into its own 0-based buffer so the typed-array views are
  // valid regardless of this offset's alignment.
  const readTA = (Ctor, count, bytesPer) => {
    const byteLen = count * bytesPer;
    const ta = new Ctor(ab.slice(off, off + byteLen));
    off += byteLen;
    return ta;
  };
  const frameTimes = readTA(Float32Array, F, 4);
  const qx = readTA(Int16Array, N, 2);
  const qy = readTA(Int16Array, N, 2);
  const qfx = readTA(Int8Array, N, 1);
  const qfy = readTA(Int8Array, N, 1);
  const qlk = readTA(Uint8Array, N, 1);

  const x = new Float32Array(N);
  const y = new Float32Array(N);
  const z = new Float32Array(N);      // dropped in the share → zeros
  const fx = new Float32Array(N);
  const fy = new Float32Array(N);
  const lk = new Uint8Array(N);
  const invX = spanX > 0 ? spanX / RANGE : 0;
  const invY = spanY > 0 ? spanY / RANGE : 0;
  for (let i = 0; i < N; i++) {
    if (qx[i] === SENTINEL) { x[i] = NaN; continue; } // rest stay 0
    x[i] = minX + (qx[i] + 32767) * invX;
    y[i] = minY + (qy[i] + 32767) * invY;
    fx[i] = qfx[i] / 127;
    fy[i] = qfy[i] / 127;
    lk[i] = qlk[i];
  }

  return {
    meta,
    players,
    frameTimes,
    tracks: { x, y, z, fx, fy, lk },
    frameCount: F,
    playerCount: P,
  };
}
