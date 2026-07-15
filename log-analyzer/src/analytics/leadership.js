// Leadership & officers over time.
//
// The replay's per-sample leader_kind (NONE / OFFICER / FLAG) lets us track who
// anchored the line and when leaders fell off the field, per team, cheaply and
// reliably (no scoreboard needed).

import { LEADER_KIND } from '../utils/replayParser';

// Officers / flag-bearers present per frame, per team.
// Returns { usaOfficers, usaFlags, csaOfficers, csaFlags } number[].
export function leadershipOverTime(replay) {
  const { frameCount: F, playerCount: P } = replay;
  const { x, lk } = replay.tracks;
  const teams = replay.players.map((p) => p.team);
  const usaOfficers = new Array(F).fill(0);
  const usaFlags = new Array(F).fill(0);
  const csaOfficers = new Array(F).fill(0);
  const csaFlags = new Array(F).fill(0);
  for (let f = 0; f < F; f++) {
    const base = f * P;
    for (let p = 0; p < P; p++) {
      if (Number.isNaN(x[base + p])) continue;
      const kind = lk[base + p];
      const t = teams[p];
      if (kind === LEADER_KIND.OFFICER) {
        if (t === 1) usaOfficers[f]++;
        else if (t === 2) csaOfficers[f]++;
      } else if (kind === LEADER_KIND.FLAG) {
        if (t === 1) usaFlags[f]++;
        else if (t === 2) csaFlags[f]++;
      }
    }
  }
  return { usaOfficers, usaFlags, csaOfficers, csaFlags };
}

// Per-player leadership spans: the frames a player spent as officer/flag. Used
// to list "who led, and for how long." Returns [{ name, team, kind, frames,
// seconds }] sorted by seconds desc, one row per (player, kind) that ever led.
export function leaderSpans(replay) {
  const { frameCount: F, playerCount: P } = replay;
  const { x, lk } = replay.tracks;
  const dt = 1 / (replay.meta.sampleRateHz || 2);
  const rows = [];
  for (let p = 0; p < P; p++) {
    let officerFrames = 0;
    let flagFrames = 0;
    for (let f = 0; f < F; f++) {
      if (Number.isNaN(x[f * P + p])) continue;
      const kind = lk[f * P + p];
      if (kind === LEADER_KIND.OFFICER) officerFrames++;
      else if (kind === LEADER_KIND.FLAG) flagFrames++;
    }
    const meta = replay.players[p];
    if (officerFrames > 0) {
      rows.push({ name: meta.name, team: meta.team, kind: 'officer', frames: officerFrames, seconds: officerFrames * dt });
    }
    if (flagFrames > 0) {
      rows.push({ name: meta.name, team: meta.team, kind: 'flag', frames: flagFrames, seconds: flagFrames * dt });
    }
  }
  return rows.sort((a, b) => b.seconds - a.seconds);
}
