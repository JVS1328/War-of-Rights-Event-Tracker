// Regiment grouping for replay data.
//
// Replays carry each player's in-game name; we resolve a normalized regiment
// label from the name tag using the SAME matcher season-tracker uses (lifted
// into stats/regimentMatcher), so a unit's replay-derived movement/presence and
// its scoreboard-derived kills/deaths resolve under one label.

import { extractRegimentTag, normalizeRegimentTag, UNTAGGED } from '../stats/regimentMatcher';

// Resolve one player name → normalized regiment label (e.g. "1STTX").
export function regimentLabel(name) {
  return normalizeRegimentTag(extractRegimentTag(name || ''));
}

// Group replay player indices by regiment label. Returns Map<label, number[]>.
export function groupPlayersByRegiment(replay) {
  const groups = new Map();
  replay.players.forEach((p, i) => {
    const label = regimentLabel(p.name);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(i);
  });
  return groups;
}

// The distinct regiment labels present on a team (1 = USA, 2 = CSA), sorted.
export function regimentsForTeam(replay, team) {
  const set = new Set();
  replay.players.forEach((p) => {
    if (p.team === team) set.add(regimentLabel(p.name));
  });
  set.delete(UNTAGGED);
  return [...set].sort();
}

export { UNTAGGED };
