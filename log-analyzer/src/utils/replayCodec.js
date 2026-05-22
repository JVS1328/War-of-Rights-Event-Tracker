// Serialize / deserialize a parsed replay for transport.
//
// Used in two places:
//   - IndexedDB persistence (stores the encoded ArrayBuffer directly).
//   - Share-link payload (base64url-wrapped so it survives JSON.stringify).
//
// Format: a binary blob laid out as
//   [u32 magic 'WRPL'] [u16 version] [u16 flags] [u32 frameCount] [u32 playerCount]
//   [u32 metaJsonLen] [metaJsonLen bytes utf-8]
//   [u32 playersJsonLen] [playersJsonLen bytes utf-8]
//   [frameTimes Float32 * frameCount]
//   [tracks.x Float32 * F * P]
//   [tracks.y Float32 * F * P]
//   [tracks.z Float32 * F * P]
//   [tracks.fx Float32 * F * P]
//   [tracks.fy Float32 * F * P]
//   [tracks.lk Uint8   * F * P]
//
// No quantization — floats are preserved bit-for-bit. The codec pairs with
// pako (caller compresses on the way out / decompresses on the way in).

const MAGIC = 0x4C505257; // 'WRPL' little-endian
const VERSION = 1;

const enc = new TextEncoder();
const dec = new TextDecoder('utf-8');

// Round up to next multiple of 4 — typed-array views require 4-byte
// alignment relative to the underlying buffer, so JSON chunks are
// padded to keep the cursor aligned for the Float32Array reads that
// follow.
const align4 = (n) => (n + 3) & ~3;

function jsonChunkSize(obj) {
  return 4 + align4(enc.encode(JSON.stringify(obj)).byteLength);
}

function writeJsonChunk(view, offset, obj) {
  const bytes = enc.encode(JSON.stringify(obj));
  view.setUint32(offset, bytes.byteLength, true);
  new Uint8Array(view.buffer, view.byteOffset + offset + 4, bytes.byteLength).set(bytes);
  return offset + 4 + align4(bytes.byteLength);
}

function readJsonChunk(view, offset) {
  const len = view.getUint32(offset, true);
  const bytes = new Uint8Array(view.buffer, view.byteOffset + offset + 4, len);
  return { obj: JSON.parse(dec.decode(bytes)), end: offset + 4 + align4(len) };
}

export function encodeReplay(replay) {
  const F = replay.frameCount;
  const P = replay.playerCount;

  const fixedHeader = 4 + 2 + 2 + 4 + 4;  // magic, ver, flags, F, P (all 4-aligned end)
  const metaChunk    = jsonChunkSize(replay.meta);
  const playersChunk = jsonChunkSize(replay.players);
  const total =
    fixedHeader +
    metaChunk +
    playersChunk +
    F * 4 +              // frameTimes
    F * P * 4 * 5 +      // x, y, z, fx, fy
    F * P;               // lk

  const ab = new ArrayBuffer(total);
  const dv = new DataView(ab);
  let off = 0;
  dv.setUint32(off, MAGIC, true);            off += 4;
  dv.setUint16(off, VERSION, true);          off += 2;
  dv.setUint16(off, 0, true);                off += 2;
  dv.setUint32(off, F, true);                off += 4;
  dv.setUint32(off, P, true);                off += 4;
  off = writeJsonChunk(dv, off, replay.meta);
  off = writeJsonChunk(dv, off, replay.players);

  const u8 = new Uint8Array(ab);
  const writeF32 = (src) => {
    const bytes = new Uint8Array(src.buffer, src.byteOffset, src.byteLength);
    u8.set(bytes, off);
    off += bytes.byteLength;
  };
  writeF32(replay.frameTimes);
  writeF32(replay.tracks.x);
  writeF32(replay.tracks.y);
  writeF32(replay.tracks.z);
  writeF32(replay.tracks.fx);
  writeF32(replay.tracks.fy);
  u8.set(replay.tracks.lk, off); off += replay.tracks.lk.byteLength;

  return ab;
}

export function decodeReplay(arrayBuffer) {
  const dv = new DataView(arrayBuffer);
  let off = 0;
  const magic = dv.getUint32(off, true);     off += 4;
  if (magic !== MAGIC) throw new Error('Bad replay magic');
  const version = dv.getUint16(off, true);   off += 2;
  if (version !== VERSION) throw new Error(`Unsupported replay version ${version}`);
  /* flags */                                off += 2;
  const F = dv.getUint32(off, true);         off += 4;
  const P = dv.getUint32(off, true);         off += 4;

  const metaRead    = readJsonChunk(dv, off); off = metaRead.end;
  const playersRead = readJsonChunk(dv, off); off = playersRead.end;

  // Copy typed-array slices instead of aliasing the source buffer — IDB
  // hands us back a brand new ArrayBuffer per fetch, but slicing keeps
  // the codec consumer free to detach the buffer.
  const sliceF32 = (n) => {
    const out = new Float32Array(n);
    out.set(new Float32Array(arrayBuffer, off, n));
    off += n * 4;
    return out;
  };
  const sliceU8 = (n) => {
    const out = new Uint8Array(n);
    out.set(new Uint8Array(arrayBuffer, off, n));
    off += n;
    return out;
  };

  const frameTimes = sliceF32(F);
  const x  = sliceF32(F * P);
  const y  = sliceF32(F * P);
  const z  = sliceF32(F * P);
  const fx = sliceF32(F * P);
  const fy = sliceF32(F * P);
  const lk = sliceU8(F * P);

  return {
    meta:        metaRead.obj,
    players:     playersRead.obj,
    frameTimes,
    tracks:      { x, y, z, fx, fy, lk },
    frameCount:  F,
    playerCount: P,
  };
}

// --- base64url helpers for share payload ---

export function bufferToBase64Url(ab) {
  const bytes = new Uint8Array(ab);
  // Stream-build the binary string in chunks to avoid blowing the call
  // stack on large replays (apply(null, hugeArray) hits arg-count limits).
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlToBuffer(s) {
  const pad = (4 - (s.length % 4)) % 4;
  const b64 = (s + '='.repeat(pad)).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}
