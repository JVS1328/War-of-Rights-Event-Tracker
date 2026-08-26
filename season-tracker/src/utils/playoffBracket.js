/**
 * The playoff bracket a season's standings project: who qualifies, how they are
 * seeded, and which matchups that produces down to the final.
 *
 * This used to live inside SeasonTracker, reading the component's bound state.
 * It was lifted out so the public site can draw the same bracket the owner
 * sees — a projection is most of what a visitor wants out of a playoff page,
 * and two implementations of a seeding rule would not stay in step.
 *
 * Pure: everything it reads is passed in.
 */

import { seasonPoints } from './seasonView';
import { replayActiveSeasonUpToWeekFromAppState } from './eloEngine';
import {
  MAX_KNOCKOUT_FIELD,
  MIN_FIELD as MIN_PLAYOFF_FIELD,
  knockoutRoundName,
  knockoutSeedOrder,
  knockoutStageKey,
  nextPowerOfTwo,
} from './playoffPlanner';

/**
 * @param appState        The v2 app state, for the Elo replay.
 * @param event           The event the season belongs to (for its Elo settings).
 * @param season          The season to seed from.
 * @param weekIndex       Stand at this week; null means the end of the season.
 * @param selectedWeekId  Fallback for weekIndex — the night open in the tracker.
 * @returns The bracket, or null when playoffs are switched off for the season.
 */
export function generatePlayoffBracket({
  appState,
  event,
  season,
  weekIndex = null,
  selectedWeekId = null,
}) {
  const playoffConfig = season?.playoffConfig ?? {};
  const weeks = season?.weeks ?? [];
  const divisions = season?.divisions ?? [];
  const nonTokenUnits = season?.nonTokenUnits ?? [];
  const eloSystem = event?.eloSystem ?? {};
  const selectedWeek = selectedWeekId == null
    ? null
    : weeks.find(w => w.id === selectedWeekId) ?? null;

  // The two figures the seeding reads, as of whichever week we are standing at.
  const calculatePointsUpToWeek = (idx) => seasonPoints(season, idx);
  const calculateEloRatings = (idx) => {
    const replay = replayActiveSeasonUpToWeekFromAppState(appState, event.id, season.id, idx);
    return { eloRatings: replay.unitElo, roundsPlayed: replay.roundsPlayed };
  };

  if (!playoffConfig.enabled) return null;
  
  const currentWeekIdx = weekIndex !== null ? weekIndex : (selectedWeek ? weeks.findIndex(w => w.id === selectedWeek.id) : weeks.length - 1);
  
  // Get standings up to the specified week
  const currentStats = calculatePointsUpToWeek(currentWeekIdx);
  const { eloRatings, roundsPlayed } = calculateEloRatings(currentWeekIdx);
  
  const standings = Object.entries(currentStats)
    .map(([unit, data]) => ({
      unit,
      ...data,
      elo: eloRatings[unit] || eloSystem.initialElo,
      rounds: roundsPlayed[unit] || 0
    }))
    .sort((a, b) => b.points - a.points);
  
  // Filter to only token units
  const tokenStandings = standings.filter(s => !nonTokenUnits.includes(s.unit));

  // A matchup is only credited when BOTH teams' units were the per-round
  // leads of opposing sides — being a supporting unit on the winning roster
  // doesn't count as a playoff win.
  const playoffWeeks = weeks.filter(w => w.isPlayoffs);

  const roundLeads = (week, r) => ({
    leadA: week[`leadA_r${r}`] || week.leadA || null,
    leadB: week[`leadB_r${r}`] || week.leadB || null,
  });

  const resolveMatch = (team1, team2, roundsPerMatch) => {
    if (!team1 || !team2) return null;
    let t1Wins = 0;
    let t2Wins = 0;
    for (const w of playoffWeeks) {
      for (const r of [1, 2]) {
        const winner = w[`round${r}Winner`];
        if (!winner) continue;
        const { leadA, leadB } = roundLeads(w, r);
        if (!leadA || !leadB) continue;
        const winningLead = winner === 'A' ? leadA : leadB;
        const losingLead = winner === 'A' ? leadB : leadA;
        // Only count this round if it pits team1's lead against team2's lead.
        const isMatch =
          (winningLead === team1.unit && losingLead === team2.unit) ||
          (winningLead === team2.unit && losingLead === team1.unit);
        if (!isMatch) continue;
        if (winningLead === team1.unit) t1Wins++;
        else if (winningLead === team2.unit) t2Wins++;
      }
    }
    const needed = Math.floor((roundsPerMatch || 1) / 2) + 1;
    if (t1Wins >= needed && t1Wins > t2Wins) return team1;
    if (t2Wins >= needed && t2Wins > t1Wins) return team2;
    return null;
  };

  // Seeded knockout: one flat field, whatever the groups behind it look like.
  // Groups send their top N, wildcards go to the best of everyone left over
  // regardless of group, and the field is reseeded 1..N on total points
  // before being paired 1-vs-N down the bracket.
  if ((playoffConfig.bracketStyle || 'conference') === 'knockout') {
    let qualifiers = [];

    if (playoffConfig.useDivisions && divisions.length > 0) {
      divisions.forEach(division => {
        const divUnits = new Set(division.units);
        tokenStandings
          .filter(s => divUnits.has(s.unit))
          .slice(0, playoffConfig.teamsPerDivision)
          .forEach(team => qualifiers.push({ ...team, division: division.name }));
      });

      const claimed = new Set(qualifiers.map(t => t.unit));
      const inAGroup = new Set(divisions.flatMap(d => d.units));
      tokenStandings
        .filter(s => inAGroup.has(s.unit) && !claimed.has(s.unit))
        .slice(0, playoffConfig.wildcardTeams)
        .forEach(team => qualifiers.push({
          ...team,
          division: divisions.find(d => d.units.includes(team.unit))?.name,
          isWildcard: true,
        }));
    } else {
      qualifiers = tokenStandings
        .slice(0, playoffConfig.wildcardTeams || 4)
        .map(team => ({ ...team }));
    }

    // Group seat or wildcard, everyone is reseeded on total points.
    qualifiers.sort((a, b) => b.points - a.points);
    qualifiers.forEach((team, idx) => { team.seed = idx + 1; });

    const knockout = { teams: qualifiers, rounds: [], conferenceNames: [] };
    if (qualifiers.length < MIN_PLAYOFF_FIELD || qualifiers.length > MAX_KNOCKOUT_FIELD) {
      return knockout;
    }

    const slots = nextPowerOfTwo(qualifiers.length);
    const roundCount = Math.round(Math.log2(slots));
    // Indexed by seed, not a Map — `Map` is the lucide icon in this file.
    const bySeed = [];
    qualifiers.forEach(team => { bySeed[team.seed] = team; });
    // Seeds beyond the field are empty slots, which become byes for the
    // top seeds they would have faced.
    let slotTeams = knockoutSeedOrder(slots).map(seed => bySeed[seed] || null);
    // A slot the previous round has not settled yet carries a label instead
    // of a team, so the whole bracket is visible before anything is played.
    let slotLabels = slotTeams.map(() => null);

    for (let round = 0; round < roundCount; round++) {
      const entering = slotTeams.length;
      const roundName = knockoutRoundName(entering);
      const roundsPerMatch = playoffConfig.roundFormats[knockoutStageKey(roundCount, round)] || 1;
      const matchups = [];
      const advancing = [];
      const advancingLabels = [];

      for (let pair = 0; pair * 2 < slotTeams.length; pair++) {
        const team1 = slotTeams[pair * 2];
        const team2 = slotTeams[pair * 2 + 1];
        const label1 = slotLabels[pair * 2];
        const label2 = slotLabels[pair * 2 + 1];

        // Called after the matchup is pushed, so matchups.length numbers it.
        const pending = () => {
          advancing.push(null);
          advancingLabels.push(`Winner of ${roundName} ${matchups.length}`);
        };

        if (team1 && team2) {
          const matchup = { seed1: team1.seed, seed2: team2.seed, team1, team2 };
          const winner = resolveMatch(team1, team2, roundsPerMatch);
          if (winner) {
            matchup.winner = winner;
            matchup.loser = winner === team1 ? team2 : team1;
          }
          matchups.push(matchup);
          advancing.push(winner || null);
          advancingLabels.push(winner ? null : `Winner of #${team1.seed} vs #${team2.seed}`);
        } else if (team1 || team2) {
          const solo = team1 || team2;
          const otherLabel = team1 ? label2 : label1;
          if (otherLabel) {
            // One side is in, the other is still coming out of the last round.
            matchups.push({
              seed1: solo.seed, team1: solo, seed2: null, team2: null, slot2Label: otherLabel,
            });
            pending();
          } else {
            // Nobody to play: an unfilled slot is a bye for the seed beside it.
            matchups.push({ seed1: solo.seed, seed2: null, team1: solo, team2: null, bye: true });
            advancing.push(solo);
            advancingLabels.push(null);
          }
        } else if (label1 || label2) {
          matchups.push({
            seed1: null, seed2: null, team1: null, team2: null,
            slot1Label: label1 || 'To be decided',
            slot2Label: label2 || 'To be decided',
          });
          pending();
        } else {
          advancing.push(null);
          advancingLabels.push(null);
        }
      }

      knockout.rounds.push({ name: roundName, roundsPerMatch, matchups });
      slotTeams = advancing;
      slotLabels = advancingLabels;
    }

    return knockout;
  }

  let playoffTeams = [];
  let conferenceNames = [];

  if (playoffConfig.useDivisions && divisions.length > 0) {
    // Helper: Extract conference name from division name
    const getConferenceName = (divisionName) => {
      // Find common word in division names (e.g., "Smoke" from "Smoke North" and "Smoke South")
      const words = divisionName.split(/\s+/);
      // Return first word as conference identifier
      return words[0] || divisionName;
    };
    
    // Group divisions into conferences
    const conferences = {};
    divisions.forEach(division => {
      const confName = getConferenceName(division.name);
      if (!conferences[confName]) {
        conferences[confName] = [];
      }
      conferences[confName].push(division);
    });
    
    // Store conference names for later use
    conferenceNames = Object.keys(conferences);
    
    // Build conference standings
    const conferenceTeams = {};
    Object.entries(conferences).forEach(([confName, confDivisions]) => {
      conferenceTeams[confName] = [];
      
      // Get division winners from this conference
      confDivisions.forEach(division => {
        const divUnits = new Set(division.units);
        const divisionStandings = tokenStandings
          .filter(s => divUnits.has(s.unit))
          .slice(0, playoffConfig.teamsPerDivision);
        
        divisionStandings.forEach(team => {
          conferenceTeams[confName].push({ ...team, division: division.name });
        });
      });
      
      // Sort conference teams by points
      conferenceTeams[confName].sort((a, b) => b.points - a.points);
      
      // Add wildcards for this conference
      if (playoffConfig.wildcardTeams > 0) {
        const divisionQualifiers = new Set(conferenceTeams[confName].map(t => t.unit));
        
        // Get all units in this conference's divisions
        const confUnits = new Set(confDivisions.flatMap(d => d.units));
        
        // Find wildcards from this conference only
        const confWildcards = tokenStandings
          .filter(s => confUnits.has(s.unit) && !divisionQualifiers.has(s.unit))
          .slice(0, playoffConfig.wildcardTeams);
        
        confWildcards.forEach(team => {
          // Find which division this unit belongs to
          const unitDivision = confDivisions.find(d => d.units.includes(team.unit));
          conferenceTeams[confName].push({ ...team, division: unitDivision?.name, isWildcard: true });
        });
      }
      
      // Re-sort after adding wildcards and assign conference seeds
      conferenceTeams[confName].sort((a, b) => b.points - a.points);
      conferenceTeams[confName].forEach((team, idx) => {
        team.conferenceSeed = idx + 1;
        team.conference = confName;
      });
    });
    
    // Combine all conference teams
    Object.values(conferenceTeams).forEach(confTeams => {
      playoffTeams.push(...confTeams);
    });
    
    // Assign global seeds (for display purposes)
    playoffTeams.sort((a, b) => b.points - a.points);
    playoffTeams.forEach((team, idx) => {
      team.seed = idx + 1;
    });
  } else {
    // Simple top-N playoffs
    const totalTeams = playoffConfig.wildcardTeams || 4;
    playoffTeams = tokenStandings.slice(0, totalTeams);
    
    // Seed teams by rank
    playoffTeams.forEach((team, idx) => {
      team.seed = idx + 1;
    });
  }
  
  // Generate bracket matchups
  const bracket = {
    teams: playoffTeams,
    rounds: [],
    conferenceNames
  };
  
  // Determine bracket structure
  const teamCount = playoffTeams.length;
  const hasConferences = playoffConfig.useDivisions && conferenceNames.length > 0;
  
  if (teamCount >= 8 && hasConferences) {
    // Conference-based playoffs with 8+ teams
    // Separate teams by conference
    const confTeamsByConf = {};
    conferenceNames.forEach(conf => {
      confTeamsByConf[conf] = playoffTeams.filter(t => t.conference === conf);
    });
    
    // Wildcard round - within each conference (lower seeds play, top seeds get bye)
    const wildcardMatchups = [];
    conferenceNames.forEach(confName => {
      const confTeams = confTeamsByConf[confName];
      if (confTeams.length >= 6) {
        // 6+ teams: #1 and #2 get byes, #3 vs #6, #4 vs #5
        wildcardMatchups.push(
          { seed1: confTeams[2].conferenceSeed, seed2: confTeams[5].conferenceSeed, team1: confTeams[2], team2: confTeams[5], conference: confName },
          { seed1: confTeams[3].conferenceSeed, seed2: confTeams[4].conferenceSeed, team1: confTeams[3], team2: confTeams[4], conference: confName }
        );
      } else if (confTeams.length === 5) {
        // 5 teams: #1 gets bye, #2 vs #5, #3 vs #4
        wildcardMatchups.push(
          { seed1: confTeams[1].conferenceSeed, seed2: confTeams[4].conferenceSeed, team1: confTeams[1], team2: confTeams[4], conference: confName },
          { seed1: confTeams[2].conferenceSeed, seed2: confTeams[3].conferenceSeed, team1: confTeams[2], team2: confTeams[3], conference: confName }
        );
      }
      // With exactly 4 teams, no wildcard round needed (go straight to divisional)
    });
    
    if (wildcardMatchups.length > 0) {
      bracket.rounds.push({
        name: 'Wildcard',
        roundsPerMatch: playoffConfig.roundFormats.wildcard,
        matchups: wildcardMatchups
      });
    }
    
    // Divisional round - within each conference
    const divisionalMatchups = [];
    conferenceNames.forEach(confName => {
      const confTeams = confTeamsByConf[confName];
      if (confTeams.length >= 6) {
        // 6+ teams with wildcards: #1 vs lower wildcard winner, #2 vs higher wildcard winner
        divisionalMatchups.push(
          { seed1: 1, seed2: 'WC2', team1: confTeams[0], label: `Winner of #${confTeams[2].conferenceSeed} vs #${confTeams[5].conferenceSeed}`, conference: confName },
          { seed1: 2, seed2: 'WC1', team1: confTeams[1], label: `Winner of #${confTeams[3].conferenceSeed} vs #${confTeams[4].conferenceSeed}`, conference: confName }
        );
      } else if (confTeams.length === 5) {
        // 5 teams: #1 (bye) vs winner of (#2 vs #5), winner of (#3 vs #4) advances
        divisionalMatchups.push(
          { seed1: 1, seed2: 'WC1', team1: confTeams[0], label: `Winner of #${confTeams[1].conferenceSeed} vs #${confTeams[4].conferenceSeed}`, conference: confName },
          { seed1: 'WC2', seed2: 'WC2', label: `Winner of #${confTeams[2].conferenceSeed} vs #${confTeams[3].conferenceSeed}`, conference: confName }
        );
      } else if (confTeams.length >= 4) {
        // 4 teams without wildcards: #1 vs #4, #2 vs #3
        divisionalMatchups.push(
          { seed1: confTeams[0].conferenceSeed, seed2: confTeams[3].conferenceSeed, team1: confTeams[0], team2: confTeams[3], conference: confName },
          { seed1: confTeams[1].conferenceSeed, seed2: confTeams[2].conferenceSeed, team1: confTeams[1], team2: confTeams[2], conference: confName }
        );
      }
    });
    
    if (divisionalMatchups.length > 0) {
      bracket.rounds.push({
        name: 'Divisional',
        roundsPerMatch: playoffConfig.roundFormats.divisional,
        matchups: divisionalMatchups
      });
    }
    
    // Conference Finals - within each conference
    const conferenceMatchups = [];
    conferenceNames.forEach(confName => {
      conferenceMatchups.push({
        seed1: 'W1',
        seed2: 'W2',
        label: `${confName} Conference Final`,
        conference: confName
      });
    });
    
    bracket.rounds.push({
      name: 'Conference Finals',
      roundsPerMatch: playoffConfig.roundFormats.conference,
      matchups: conferenceMatchups
    });
    
    // Championship - winners from each conference
    if (conferenceNames.length >= 2) {
      bracket.rounds.push({
        name: 'Championship',
        roundsPerMatch: playoffConfig.roundFormats.finals,
        matchups: [
          {
            seed1: 'W1',
            seed2: 'W2',
            label: `Winner of ${conferenceNames[0]} vs Winner of ${conferenceNames[1]}`,
            conference: 'Championship'
          }
        ]
      });
    }
  } else if (teamCount >= 8) {
    // Non-conference 8+ team playoffs
    // Wildcard round: #3 vs #6, #4 vs #5 (#1 and #2 get byes)
    bracket.rounds.push({
      name: 'Wildcard',
      roundsPerMatch: playoffConfig.roundFormats.wildcard,
      matchups: [
        { seed1: 3, seed2: 6, team1: playoffTeams[2], team2: playoffTeams[5] },
        { seed1: 4, seed2: 5, team1: playoffTeams[3], team2: playoffTeams[4] }
      ]
    });
    
    // Divisional round: #1 vs lower wildcard winner, #2 vs higher wildcard winner
    bracket.rounds.push({
      name: 'Divisional',
      roundsPerMatch: playoffConfig.roundFormats.divisional,
      matchups: [
        { seed1: 1, seed2: 'WC2', team1: playoffTeams[0], label: 'Winner of #3 vs #6' },
        { seed1: 2, seed2: 'WC1', team1: playoffTeams[1], label: 'Winner of #4 vs #5' }
      ]
    });
    
    bracket.rounds.push({
      name: 'Conference Finals',
      roundsPerMatch: playoffConfig.roundFormats.conference,
      matchups: [
        { seed1: 'W1', seed2: 'W2', label: 'Winner of Divisional Games' }
      ]
    });
    
    bracket.rounds.push({
      name: 'Championship',
      roundsPerMatch: playoffConfig.roundFormats.finals,
      matchups: [
        { seed1: 'W1', seed2: 'W2', label: 'Conference Winners' }
      ]
    });
  } else if (teamCount >= 4) {
    // 4-team playoffs
    bracket.rounds.push({
      name: 'Semifinals',
      roundsPerMatch: playoffConfig.roundFormats.conference,
      matchups: [
        { seed1: 1, seed2: 4, team1: playoffTeams[0], team2: playoffTeams[3] },
        { seed1: 2, seed2: 3, team1: playoffTeams[1], team2: playoffTeams[2] }
      ]
    });
    
    bracket.rounds.push({
      name: 'Finals',
      roundsPerMatch: playoffConfig.roundFormats.finals,
      matchups: [
        { seed1: 'W1', seed2: 'W2', label: 'Winner 1 vs Winner 2' }
      ]
    });
  }

  const seedLabel = (team) => team?.conferenceSeed ?? team?.seed;

  // Resolve winners of already-played playoff matchups and propagate them
  // forward into the next round's matchups.
  for (let rIdx = 0; rIdx < bracket.rounds.length; rIdx++) {
    const round = bracket.rounds[rIdx];

    // Resolve winners for any matchup with both teams known.
    round.matchups.forEach(m => {
      if (m.team1 && m.team2 && !m.winner) {
        const winner = resolveMatch(m.team1, m.team2, round.roundsPerMatch);
        if (winner) {
          m.winner = winner;
          m.loser = winner === m.team1 ? m.team2 : m.team1;
        }
      }
    });

    // Propagate winners into next round.
    const next = bracket.rounds[rIdx + 1];
    if (!next) continue;

    if (round.name === 'Wildcard') {
      if (conferenceNames.length > 0) {
        conferenceNames.forEach(confName => {
          const wc = round.matchups.filter(m => m.conference === confName);
          const div = next.matchups.filter(m => m.conference === confName);
          // wc[0] = #3 vs #6 (or #2 vs #5 for 5-team) → fills team2 of div[0] (the #1 seed slot)
          // wc[1] = #4 vs #5 (or #3 vs #4 for 5-team) → fills team2 of div[1] (the #2 seed slot)
          if (wc[0]?.winner && div[0] && !div[0].team2) {
            div[0].team2 = wc[0].winner;
            div[0].seed2 = seedLabel(wc[0].winner);
          }
          if (wc[1]?.winner && div[1] && !div[1].team2) {
            div[1].team2 = wc[1].winner;
            div[1].seed2 = seedLabel(wc[1].winner);
          }
        });
      } else {
        if (round.matchups[0]?.winner && next.matchups[0] && !next.matchups[0].team2) {
          next.matchups[0].team2 = round.matchups[0].winner;
          next.matchups[0].seed2 = seedLabel(round.matchups[0].winner);
        }
        if (round.matchups[1]?.winner && next.matchups[1] && !next.matchups[1].team2) {
          next.matchups[1].team2 = round.matchups[1].winner;
          next.matchups[1].seed2 = seedLabel(round.matchups[1].winner);
        }
      }
    } else if (round.name === 'Divisional' || round.name === 'Semifinals') {
      if (conferenceNames.length > 0 && next.name === 'Conference Finals') {
        conferenceNames.forEach(confName => {
          const div = round.matchups.filter(m => m.conference === confName);
          const cf = next.matchups.find(m => m.conference === confName);
          if (cf && div[0]?.winner && div[1]?.winner) {
            cf.team1 = div[0].winner;
            cf.team2 = div[1].winner;
            cf.seed1 = seedLabel(div[0].winner);
            cf.seed2 = seedLabel(div[1].winner);
          }
        });
      } else if (next.matchups.length === 1 && round.matchups.length >= 2) {
        if (round.matchups[0]?.winner && round.matchups[1]?.winner) {
          next.matchups[0].team1 = round.matchups[0].winner;
          next.matchups[0].team2 = round.matchups[1].winner;
          next.matchups[0].seed1 = seedLabel(round.matchups[0].winner);
          next.matchups[0].seed2 = seedLabel(round.matchups[1].winner);
        }
      }
    } else if (round.name === 'Conference Finals') {
      const cfWinners = round.matchups.filter(m => m.winner).map(m => m.winner);
      const champ = next.matchups[0];
      if (champ && cfWinners.length >= 2) {
        champ.team1 = cfWinners[0];
        champ.team2 = cfWinners[1];
        champ.seed1 = seedLabel(cfWinners[0]);
        champ.seed2 = seedLabel(cfWinners[1]);
      }
    }
  }

  return bracket;
}

/**
 * The bracket as the Playoffs screen draws it: one row per matchup, carrying
 * the two units, the night it lands on and how its rounds fell. A matchup the
 * seeding has not resolved yet reads "TBD", which is the honest answer before
 * the qualifying is done.
 */
export function bracketSlots({ appState, event, season, weekIndex = null, selectedWeekId = null }) {
  const bracket = generatePlayoffBracket({ appState, event, season, weekIndex, selectedWeekId });
  if (!bracket || !Array.isArray(bracket.rounds)) return [];

  const playoffWeeks = (season?.weeks ?? []).filter(w => w.isPlayoffs);
  const out = [];
  bracket.rounds.forEach((rd, ri) => {
    (rd.matchups || []).forEach(m => {
      if (!m.team1 && !m.team2) return;
      const wk = playoffWeeks[ri];
      const rounds = (side) => {
        if (!wk) return 0;
        return (wk.round1Winner === side ? 1 : 0) + (wk.round2Winner === side ? 1 : 0);
      };
      out.push({
        stage: rd.name || (ri === bracket.rounds.length - 1 ? 'Final' : `Round ${ri + 1}`),
        night: wk?.name ?? 'unscheduled',
        a: m.team1?.unit ?? m.slot1Label ?? 'TBD',
        b: m.team2?.unit ?? m.slot2Label ?? (m.bye ? 'Bye' : 'TBD'),
        roundsA: rounds('A'),
        roundsB: rounds('B'),
        map1: wk?.round1Map ?? null,
        map2: wk?.round2Map ?? null,
      });
    });
  });
  return out;
}
