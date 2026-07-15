// Event model + localStorage persistence for the Replay Suite.
//
// An EVENT is a night of rounds. Each ROUND *is* a replay (the spine), with an
// optional scoreboard attached for kill/casualty enrichment.
//
//   Event { id, name, createdAt, rounds: Round[] }
//   Round {
//     id,                 // == replayId (stable FNV hash of filename+counts); dedupes re-uploads
//     replayId,           // IndexedDB key for the full pose payload
//     filename,           // replay CSV filename
//     ts,                 // ms epoch parsed from filename (ordering + scoreboard matching) | null
//     meta,               // light copy of replay.meta + frame/player counts (for round cards)
//     scoreboard,         // parsed scoreboard object (kills/metadata/players) | null
//     scoreboardFilename, // attached scoreboard's filename | null
//   }
//
// The full replay payload lives in IndexedDB (utils/replayStore), NOT here, so
// localStorage stays small — rounds carry only `replayId`. Replays are
// rehydrated into an in-memory Map on load.

const STORAGE_KEY = 'WarOfRightsReplaySuite';

export function loadEvent() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const evt = JSON.parse(raw);
    if (!evt || !Array.isArray(evt.rounds)) return null;
    return evt;
  } catch {
    return null;
  }
}

export function saveEvent(event) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(event));
  } catch (err) {
    console.warn('Failed to persist event to localStorage', err);
  }
}

export function newEvent(name = 'Untitled Event') {
  return {
    id: `evt_${Date.now().toString(36)}`,
    name,
    createdAt: Date.now(),
    rounds: [],
  };
}

// Build a Round from a parsed replay + its filename + the stable replayId.
// `tsFromFilename` is injected (utils/replayParser.timestampFromFilename) to
// avoid a circular import and keep this module pure-ish.
export function makeRound(replayId, filename, parsedReplay, tsFromFilename) {
  const d = tsFromFilename ? tsFromFilename(filename) : null;
  return {
    id: replayId,
    replayId,
    filename,
    ts: d ? d.getTime() : null,
    meta: {
      ...parsedReplay.meta,
      frameCount: parsedReplay.frameCount,
      playerCount: parsedReplay.playerCount,
    },
    scoreboard: null,
    scoreboardFilename: null,
  };
}

// Insert or replace a round in the event, keeping rounds ordered by timestamp
// (rounds with no parseable timestamp sort to the end, in insertion order).
export function upsertRound(event, round) {
  const rounds = event.rounds.filter(r => r.id !== round.id);
  rounds.push(round);
  rounds.sort((a, b) => {
    if (a.ts == null && b.ts == null) return 0;
    if (a.ts == null) return 1;
    if (b.ts == null) return -1;
    return a.ts - b.ts;
  });
  return { ...event, rounds };
}

// Pick the round whose replay timestamp is nearest a scoreboard's timestamp,
// within `toleranceMs`. Returns the round id, or null. Used to auto-attach an
// uploaded scoreboard to the right replay round.
export function nearestRoundForTimestamp(event, ts, toleranceMs = 60 * 60 * 1000) {
  if (ts == null) return null;
  let best = null;
  let bestDelta = Infinity;
  for (const r of event.rounds) {
    if (r.ts == null) continue;
    const delta = Math.abs(r.ts - ts);
    if (delta < bestDelta && delta <= toleranceMs) { bestDelta = delta; best = r.id; }
  }
  return best;
}
