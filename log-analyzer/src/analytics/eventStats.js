// Event-level aggregation — unit & player performance across a night of rounds.
//
// Modeled on season-tracker's stats engine (PlayerStatRow / RegimentStatRow +
// the ×Td/×Tk ticket model), adapted to the Replay Suite's data model where the
// REPLAY provides the roster + movement for every round and an OPTIONAL attached
// scoreboard provides kills/deaths/formations. Both resolve to the same regiment
// label via the shared matcher, so a unit's movement and its combat line up.
//
// Rounds with no scoreboard still contribute participation ("rounds") and
// distance; their combat columns stay zero.

import { avgTicketCost } from '../stats/labels';
import { regimentLabel, UNTAGGED } from './regiments';
import { distancePerPlayer } from './movement';

const M_TO_YD = 1.0936;

function freshPlayer(name) {
  return {
    name,
    team: 0,
    roundIds: new Set(),
    kills: 0,
    deaths: 0,
    dForm: 0, dSkirm: 0, dOob: 0,
    kForm: 0, kSkirm: 0, kOob: 0,
    distYd: 0,
  };
}

function addCause(map, reg, cause) {
  let inner = map.get(reg);
  if (!inner) { inner = new Map(); map.set(reg, inner); }
  inner.set(cause, (inner.get(cause) || 0) + 1);
}

// rounds: Round[] (each with optional .scoreboard round-shape + .replayId)
// replays: Map<replayId, parsedReplay> (may be missing entries not yet loaded)
export function computeEventStats(rounds, replays) {
  const players = new Map();
  const getP = (name) => {
    let acc = players.get(name);
    if (!acc) { acc = freshPlayer(name); players.set(name, acc); }
    return acc;
  };
  const casualtyCause = new Map();   // regiment -> Map<cause, count> (suffered)
  let scoreboardRounds = 0;

  for (const round of rounds) {
    const rid = round.id;
    const sb = round.scoreboard;
    const replay = replays?.get(round.replayId);

    // Roster + movement from the replay (participation even without a scoreboard).
    if (replay) {
      const dist = distancePerPlayer(replay);
      replay.players.forEach((p, i) => {
        const acc = getP(p.name);
        acc.roundIds.add(rid);
        if (!acc.team) acc.team = p.team;
        acc.distYd += dist[i] * M_TO_YD;
      });
    }

    if (sb) {
      scoreboardRounds++;
      for (const p of sb.players) {
        const acc = getP(p.name);
        acc.roundIds.add(rid);
        acc.team = p.team;
        acc.kills += p.kills || 0;
        acc.deaths += p.deaths || 0;
        acc.dForm += p.deathsInForm || 0;
        acc.dSkirm += p.deathsSkirm || 0;
        acc.dOob += p.deathsOob || 0;
      }
      for (const k of sb.kills) {
        // Kill's ticket value is weighted by the victim's formation, credited
        // to the killer.
        if (k.killer && k.killer !== '(environment)') {
          const acc = getP(k.killer);
          if (k.victimFormation === 'skirm') acc.kSkirm++;
          else if (k.victimFormation === 'oob') acc.kOob++;
          else acc.kForm++;
        }
        const victim = k.victim || k.player;
        if (victim) addCause(casualtyCause, regimentLabel(victim), k.cause || 'Unknown');
      }
    }
  }

  const playerRows = [...players.values()].map((a) => ({
    key: a.name,
    name: a.name,
    regiment: regimentLabel(a.name),
    team: a.team,
    rounds: a.roundIds.size,
    roundIds: [...a.roundIds],
    kills: a.kills,
    deaths: a.deaths,
    kd: a.deaths > 0 ? a.kills / a.deaths : a.kills,
    deathsInForm: a.dForm,
    deathsSkirm: a.dSkirm,
    deathsOob: a.dOob,
    killsInForm: a.kForm,
    killsSkirm: a.kSkirm,
    killsOob: a.kOob,
    avgTd: avgTicketCost(a.dForm, a.dSkirm, a.dOob),
    avgTk: avgTicketCost(a.kForm, a.kSkirm, a.kOob),
    distanceYd: a.distYd,
  }));

  const units = computeUnits(playerRows, casualtyCause);
  const overview = {
    rounds: rounds.length,
    scoreboardRounds,
    players: playerRows.length,
    units: units.filter((u) => u.regiment !== UNTAGGED).length,
    kills: playerRows.reduce((s, p) => s + p.kills, 0),
    casualties: playerRows.reduce((s, p) => s + p.deaths, 0),
  };

  return { players: playerRows, units, overview };
}

function computeUnits(playerRows, casualtyCause) {
  const byReg = new Map();
  for (const p of playerRows) {
    let u = byReg.get(p.regiment);
    if (!u) {
      u = {
        regiment: p.regiment,
        teamVotes: { 1: 0, 2: 0 },
        players: [],
        roundIds: new Set(),
        kills: 0, deaths: 0,
        dForm: 0, dSkirm: 0, dOob: 0,
        kForm: 0, kSkirm: 0, kOob: 0,
      };
      byReg.set(p.regiment, u);
    }
    u.players.push(p);
    p.roundIds.forEach((r) => u.roundIds.add(r));
    if (p.team === 1 || p.team === 2) u.teamVotes[p.team]++;
    u.kills += p.kills;
    u.deaths += p.deaths;
    u.dForm += p.deathsInForm;
    u.dSkirm += p.deathsSkirm;
    u.dOob += p.deathsOob;
    u.kForm += p.killsInForm;
    u.kSkirm += p.killsSkirm;
    u.kOob += p.killsOob;
  }

  return [...byReg.values()].map((u) => {
    const causeMap = casualtyCause.get(u.regiment);
    const byCause = causeMap
      ? [...causeMap.entries()].map(([cause, count]) => ({ cause, count })).sort((a, b) => b.count - a.count)
      : [];
    return {
      key: u.regiment,
      regiment: u.regiment,
      team: u.teamVotes[1] >= u.teamVotes[2] ? 1 : 2,
      players: u.players.length,
      rounds: u.roundIds.size,
      kills: u.kills,
      deaths: u.deaths,
      kd: u.deaths > 0 ? u.kills / u.deaths : u.kills,
      avgTd: avgTicketCost(u.dForm, u.dSkirm, u.dOob),
      avgTk: avgTicketCost(u.kForm, u.kSkirm, u.kOob),
      casualtiesByFormation: { inForm: u.dForm, skirm: u.dSkirm, oob: u.dOob },
      casualtiesByCause: byCause,
      distanceYd: u.players.reduce((s, p) => s + p.distanceYd, 0),
      topPlayers: [...u.players].sort((a, b) => b.kills - a.kills).slice(0, 5),
    };
  }).sort((a, b) => b.kills - a.kills);
}
