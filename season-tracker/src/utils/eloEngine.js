// Chronological Elo replay for an event. One pass over every round in
// (season, week, round) order produces:
//   - unit Elo ratings
//   - rounds-played counts (for provisional K-factor)
//   - map-side history (USA/CSA wins, casualties, by-unit) up to and after each round
//   - per-unit per-map-side history
//   - a per-round snapshot containing the pre-round state used to compute expected
//
// Map-side and unit-on-map-side history feed the expected-win-probability via
// Bayesian-shrunk Elo-equivalent adjustments controlled by event.eloConfig.

import { DEFAULT_ELO_CONFIG, DEFAULT_ELO_SYSTEM } from './eventStore';

// Maps where USA is the in-game attacker. Used to derive attacker/defender
// from in-game side, which is reported only as informational metadata.
export const USA_ATTACK_MAPS = new Set([
  "East Woods Skirmish", "Nicodemus Hill", "Hooker's Push", "Bloody Lane",
  "Pry Ford", "Smith Field", "Alexander Farm", "Crossroads",
  "Wagon Road", "Hagertown Turnpike", "Pry Grist Mill", "Otto & Sherrick Farm",
  "Piper Farm", "West Woods", "Dunker Church", "Burnside Bridge",
  "Garland's Stand", "Cox's Push", "Hatch's Attack", "Colquitt's Defense",
  "Flemming's Meadow", "Crossley Creek", "Confederate Encampment",
]);

// Convert a win rate into an Elo-equivalent advantage. 50% → 0; 60% ≈ +70;
// 75% ≈ +191. The clamp keeps log finite for degenerate samples.
const eloEquivOf = (rate) => {
  const r = Math.max(0.01, Math.min(0.99, rate));
  return -400 * Math.log10(1 / r - 1);
};

// Bayesian-shrunk Elo equivalent: returns 0 at zero samples and approaches
// the raw equivalent as `total` grows large vs `priorRounds`.
const shrunkEloEquiv = (wins, total, priorRounds) => {
  if (total <= 0) return 0;
  return eloEquivOf(wins / total) * (total / (total + priorRounds));
};

// Resolve a unit's player count for weighting Elo/team averages. Falls back
// through season-week override → season default → 25.
const resolvePlayerCount = (unit, week, season) => {
  const weekCounts = week?.unitPlayerCounts?.[unit];
  const seasonCounts = season?.unitPlayerCounts?.[unit];
  const counts = weekCounts || seasonCounts;
  if (!counts) return 25;
  const min = parseInt(counts.min) || 0;
  const max = parseInt(counts.max) || 0;
  const avg = (min + max) / 2;
  return avg || 25;
};

// Per-round snapshot. Resolves the active roster (incl. swaps), in-game side,
// leads, and casualties without referencing config fields the caller might
// edit later. Pure derivation; no side effects.
const snapshotRound = (week, roundNum, season) => {
  const winner = week[`round${roundNum}Winner`];
  const mapName = week[`round${roundNum}Map`] || null;
  const flipped = week[`round${roundNum}Flipped`] || false;

  // Effective rosters after per-round swaps.
  const baseTeamA = week.teamA || [];
  const baseTeamB = week.teamB || [];
  const swaps = new Set(week.roundSwaps?.[`r${roundNum}`] || []);
  const teamA = swaps.size === 0 ? baseTeamA :
    baseTeamA.filter(u => !swaps.has(u)).concat(baseTeamB.filter(u => swaps.has(u)));
  const teamB = swaps.size === 0 ? baseTeamB :
    baseTeamB.filter(u => !swaps.has(u)).concat(baseTeamA.filter(u => swaps.has(u)));

  // Leads — playoffs/single-round-leads use per-round leads; otherwise week-wide.
  const isPlayoffs = !!week.isPlayoffs;
  const isSingleRoundLeads = !!week.isSingleRoundLeads;
  const usePerRound = isPlayoffs || isSingleRoundLeads;
  const leadA = usePerRound ? week[`leadA_r${roundNum}`] : week.leadA;
  const leadB = usePerRound ? week[`leadB_r${roundNum}`] : week.leadB;

  // In-game sides: flipped means roster Team A plays as CSA, Team B as USA.
  const usaTeamKey = flipped ? 'B' : 'A';
  const csaTeamKey = flipped ? 'A' : 'B';
  const usaUnits = usaTeamKey === 'A' ? teamA : teamB;
  const csaUnits = csaTeamKey === 'A' ? teamA : teamB;
  const usaLead = usaTeamKey === 'A' ? leadA : leadB;
  const csaLead = csaTeamKey === 'A' ? leadA : leadB;
  const winnerSide = winner ? (winner === usaTeamKey ? 'USA' : 'CSA') : null;

  // Casualties: stored as r{N}CasualtiesA/B keyed to roster team — bucket
  // them onto the in-game side via the flip resolution.
  const casA = week[`r${roundNum}CasualtiesA`] || 0;
  const casB = week[`r${roundNum}CasualtiesB`] || 0;
  const usaCasualtiesTaken = usaTeamKey === 'A' ? casA : casB;
  const csaCasualtiesTaken = csaTeamKey === 'A' ? casA : casB;

  return {
    season,
    week,
    roundNum,
    winner,        // 'A' | 'B' | null
    mapName,
    flipped,
    teamA,
    teamB,
    leadA,
    leadB,
    sides: {
      USA: { units: usaUnits, lead: usaLead, casualtiesTaken: usaCasualtiesTaken },
      CSA: { units: csaUnits, lead: csaLead, casualtiesTaken: csaCasualtiesTaken },
    },
    winnerSide,    // 'USA' | 'CSA' | null
    isPlayoffs,
  };
};

// Empty side bucket for mapHistory.
const emptySideBucket = () => ({ wins: 0, losses: 0, casualtiesTaken: 0, casualtiesInflicted: 0 });
const emptyMapEntry = () => ({ USA: emptySideBucket(), CSA: emptySideBucket(), plays: 0 });
const emptyUnitMapEntry = () => ({ USA: { wins: 0, losses: 0 }, CSA: { wins: 0, losses: 0 } });

// Compute adjusted expected-A probability for a matchup using current state.
// Pure: takes pre-round state and round metadata, returns expected probability
// for whichever roster side wins. Caller decides how to interpret.
//
// state: { unitElo, mapHistory, unitOnMapSide }
// matchup: { teamA, teamB, mapName, flipped, playerCountFor(unit) }
// cfg: event eloConfig
// initialElo: from eloSystem
export const computeExpectedA = (state, matchup, cfg, initialElo) => {
  const { unitElo, mapHistory, unitOnMapSide } = state;
  const { teamA, teamB, mapName, flipped, playerCountFor } = matchup;

  // Player-count-weighted Elo averages.
  const weightedAvgElo = (team) => {
    const totalP = team.reduce((s, u) => s + playerCountFor(u), 0);
    if (totalP <= 0) return initialElo;
    return team.reduce((s, u) => s + (unitElo[u] ?? initialElo) * playerCountFor(u), 0) / totalP;
  };
  const avgEloA = weightedAvgElo(teamA);
  const avgEloB = weightedAvgElo(teamB);

  // Map-side and unit-on-map-side adjustments: convert each historical signal
  // to an Elo-equivalent bump (Bayesian-shrunk), add to roster-side ratings.
  let mapAdjA = 0, mapAdjB = 0;
  let unitAdjA = 0, unitAdjB = 0;
  const usaTeamKey = flipped ? 'B' : 'A';

  if (mapName) {
    const mapEntry = mapHistory[mapName];
    if (mapEntry) {
      const usaTotal = mapEntry.USA.wins + mapEntry.USA.losses;
      const csaTotal = mapEntry.CSA.wins + mapEntry.CSA.losses;
      const usaBump = cfg.mapWeight * shrunkEloEquiv(mapEntry.USA.wins, usaTotal, cfg.priorRounds);
      const csaBump = cfg.mapWeight * shrunkEloEquiv(mapEntry.CSA.wins, csaTotal, cfg.priorRounds);
      if (usaTeamKey === 'A') { mapAdjA = usaBump; mapAdjB = csaBump; }
      else                    { mapAdjA = csaBump; mapAdjB = usaBump; }
    }

    const teamSideBump = (team, sideLabel) => {
      if (team.length === 0) return 0;
      const sum = team.reduce((acc, u) => {
        const rec = unitOnMapSide[u]?.[mapName]?.[sideLabel];
        if (!rec) return acc;
        const total = rec.wins + rec.losses;
        return acc + shrunkEloEquiv(rec.wins, total, cfg.priorRounds);
      }, 0);
      return cfg.unitWeight * (sum / team.length);
    };
    unitAdjA = usaTeamKey === 'A' ? teamSideBump(teamA, 'USA') : teamSideBump(teamA, 'CSA');
    unitAdjB = usaTeamKey === 'B' ? teamSideBump(teamB, 'USA') : teamSideBump(teamB, 'CSA');
  }

  const adjA = mapAdjA + unitAdjA;
  const adjB = mapAdjB + unitAdjB;
  const probFromDelta = (delta) => 1 / (1 + Math.pow(10, -delta / 400));
  const expectedA = probFromDelta((avgEloA + adjA) - (avgEloB + adjB));

  return {
    expectedA, avgEloA, avgEloB,
    adjA, adjB, mapAdjA, mapAdjB, unitAdjA, unitAdjB,
    // Cumulative-factor probabilities for UI breakdown:
    eloOnlyProbA:    probFromDelta(avgEloA - avgEloB),
    eloPlusMapProbA: probFromDelta((avgEloA + mapAdjA) - (avgEloB + mapAdjB)),
  };
};

// Walk an event chronologically and produce final state + per-round snapshots.
// `untilOrderKey` (optional) stops the replay after the given (sIdx, wIdx, rIdx)
// is processed; useful for "state at end of week N" queries.
export const replayEvent = (event, { untilOrderKey } = {}) => {
  const cfg = { ...DEFAULT_ELO_CONFIG, ...(event?.eloConfig || {}) };
  const sys = { ...DEFAULT_ELO_SYSTEM, ...(event?.eloSystem || {}) };
  const seasons = event?.seasons || [];

  const unitElo = {};
  const roundsPlayed = {};
  const mapHistory = {};                  // [mapName] → { USA, CSA, plays }
  const unitOnMapSide = {};               // [unit][mapName][USA|CSA] → { wins, losses }
  const perRound = [];                    // snapshots of pre-round state + outcome

  // Seed every unit ever seen in the event with the initial Elo.
  const seedUnit = (u) => {
    if (!(u in unitElo)) {
      unitElo[u] = sys.initialElo;
      roundsPlayed[u] = 0;
    }
  };
  for (const season of seasons) {
    (season.units || []).forEach(seedUnit);
    (season.weeks || []).forEach(week => {
      (week.teamA || []).forEach(seedUnit);
      (week.teamB || []).forEach(seedUnit);
    });
  }

  const orderLte = (a, b) =>
    a[0] !== b[0] ? a[0] < b[0] : a[1] !== b[1] ? a[1] < b[1] : a[2] <= b[2];

  for (let sIdx = 0; sIdx < seasons.length; sIdx++) {
    const season = seasons[sIdx];
    const weeks = season.weeks || [];

    for (let wIdx = 0; wIdx < weeks.length; wIdx++) {
      const week = weeks[wIdx];
      if ((week.teamA || []).length === 0 || (week.teamB || []).length === 0) continue;

      const r1Winner = week.round1Winner;
      const r2Winner = week.round2Winner;
      const isPlayoffs = !!week.isPlayoffs;
      const sweepBonusA = (r1Winner === 'A' && r2Winner === 'A') ? sys.sweepBonusMultiplier : 1.0;
      const sweepBonusB = (r1Winner === 'B' && r2Winner === 'B') ? sys.sweepBonusMultiplier : 1.0;

      for (const roundNum of [1, 2]) {
        if (untilOrderKey && !orderLte([sIdx, wIdx, roundNum], untilOrderKey)) break;

        const snap = snapshotRound(week, roundNum, season);
        if (!snap.winner) continue;

        const teamAUnits = snap.teamA;
        const teamBUnits = snap.teamB;
        const playerCountFor = (u) => resolvePlayerCount(u, week, season);

        // Pre-round expected probability using current state.
        const exp = computeExpectedA(
          { unitElo, mapHistory, unitOnMapSide },
          { teamA: teamAUnits, teamB: teamBUnits, mapName: snap.mapName, flipped: snap.flipped, playerCountFor },
          cfg,
          sys.initialElo,
        );

        const baseChange = (snap.winner === 'A' ? 1 : 0) - exp.expectedA;

        // Player-count-weighted Elo deltas, with lead multiplier and a
        // size-influence-curved log weight per unit. Mirrors the legacy
        // formulation so phase 1 → phase 2 numbers only differ via the new
        // map/unit adjustments (which default to zero weight).
        const applyDeltas = (teamUnits, leadUnit, sign, sweepBonus) => {
          const totalP = teamUnits.reduce((s, u) => s + playerCountFor(u), 0);
          if (totalP <= 0) return;

          const teamAvg = teamUnits.reduce((s, u) => s + unitElo[u], 0) / teamUnits.length;
          const weights = {};
          let totalWeight = 0;
          for (const u of teamUnits) {
            const pc = playerCountFor(u);
            const w = Math.pow(Math.log(1 + pc), sys.sizeInfluence)
                    * (u === leadUnit ? sys.leadMultiplier : 1);
            weights[u] = w;
            totalWeight += w;
          }
          for (const u of teamUnits) weights[u] /= totalWeight;

          for (const u of teamUnits) {
            const k = roundsPlayed[u] < sys.provisionalRounds ? sys.kFactorProvisional : sys.kFactorStandard;
            const roundMultiplier = isPlayoffs ? sys.playoffMultiplier : 1.0;
            const relativeFactor = Math.max(0.8, Math.min(1.2, Math.pow(teamAvg / unitElo[u], 0.5)));
            unitElo[u] += k * baseChange * weights[u] * sign * roundMultiplier * sweepBonus * relativeFactor;
          }
        };

        applyDeltas(teamAUnits, snap.leadA, +1, sweepBonusA);
        applyDeltas(teamBUnits, snap.leadB, -1, sweepBonusB);
        teamAUnits.forEach(u => { roundsPlayed[u] += 1; });
        teamBUnits.forEach(u => { roundsPlayed[u] += 1; });

        // Fold this round's outcome into history state.
        if (snap.mapName) {
          const entry = mapHistory[snap.mapName] ||= emptyMapEntry();
          entry.plays += 1;
          const winSide = snap.winnerSide;
          const loseSide = winSide === 'USA' ? 'CSA' : 'USA';
          entry[winSide].wins += 1;
          entry[loseSide].losses += 1;
          entry.USA.casualtiesTaken += snap.sides.USA.casualtiesTaken;
          entry.CSA.casualtiesTaken += snap.sides.CSA.casualtiesTaken;
          entry.USA.casualtiesInflicted += snap.sides.CSA.casualtiesTaken;
          entry.CSA.casualtiesInflicted += snap.sides.USA.casualtiesTaken;

          // Per-unit-on-side records.
          for (const u of snap.sides.USA.units) {
            const m = (unitOnMapSide[u] ||= {});
            const e = (m[snap.mapName] ||= emptyUnitMapEntry());
            e.USA[winSide === 'USA' ? 'wins' : 'losses'] += 1;
          }
          for (const u of snap.sides.CSA.units) {
            const m = (unitOnMapSide[u] ||= {});
            const e = (m[snap.mapName] ||= emptyUnitMapEntry());
            e.CSA[winSide === 'CSA' ? 'wins' : 'losses'] += 1;
          }
        }

        perRound.push({
          orderKey: [sIdx, wIdx, roundNum],
          season, week, roundNum,
          mapName: snap.mapName, winnerSide: snap.winnerSide,
          expectedA: exp.expectedA, adjA: exp.adjA, adjB: exp.adjB,
        });
      }
    }
  }

  return { unitElo, roundsPlayed, mapHistory, unitOnMapSide, perRound, eloSystem: sys, eloConfig: cfg };
};

// Convenience: replay only up to (and including) `maxWeekIndex` of the active
// season, mirroring the legacy `calculateEloRatings(maxWeekIndex)` signature.
// Used by win-prob queries that want "state as of end-of-week-N" inside the
// active season. Falls back to a full event replay when no cap is given.
export const replayActiveSeasonUpToWeek = (event, activeSeason, maxWeekIndex) => {
  if (!event || !activeSeason) {
    return { unitElo: {}, roundsPlayed: {}, mapHistory: {}, unitOnMapSide: {}, perRound: [], eloSystem: { ...DEFAULT_ELO_SYSTEM }, eloConfig: { ...DEFAULT_ELO_CONFIG } };
  }
  const sIdx = event.seasons.findIndex(s => s.id === activeSeason.id);
  if (sIdx < 0) return replayEvent(event);
  if (maxWeekIndex == null) return replayEvent(event);
  return replayEvent(event, { untilOrderKey: [sIdx, maxWeekIndex, 2] });
};
