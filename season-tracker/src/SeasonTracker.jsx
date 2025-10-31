import React, { useState, useEffect } from 'react';
import {
  Users, Trophy, Calendar, Plus, Trash2, Edit2, Save, X,
  BarChart3, TrendingUp, Award, Download, Upload, Settings,
  ChevronDown, ChevronRight, Star, Target, Map, Flame, Shield, Swords, Maximize2
} from 'lucide-react';

const STORAGE_KEY = 'WarOfRightsSeasonTracker';

// Map data from maps.py
const MAPS = {
  antietam: [
    "East Woods Skirmish", "Hooker's Push", "Hagerstown Turnpike",
    "Miller's Cornfield", "East Woods", "Nicodemus Hill",
    "Bloody Lane", "Pry Ford", "Pry Grist Mill", "Pry House",
    "West Woods", "Dunker Church", "Burnside's Bridge",
    "Cooke's Countercharge", "Otto and Sherrick Farms",
    "Roulette Lane", "Piper Farm", "Hill's Counterattack"
  ],
  harpers_ferry: [
    "Maryland Heights", "River Crossing", "Downtown",
    "School House Ridge", "Bolivar Heights Camp", "High Street",
    "Shenandoah Street", "Harpers Ferry Graveyard", "Washington Street",
    "Bolivar Heights Redoubt"
  ],
  south_mountain: [
    "Garland's Stand", "Cox's Push", "Hatch's Attack",
    "Anderson's Counterattack", "Reno's Fall", "Colquitt's Defense"
  ],
  drill_camp: [
    "Alexander Farm", "Crossroads", "Smith Field",
    "Crecy's Cornfield", "Crossley Creek", "Larsen Homestead",
    "South Woodlot", "Flemming's Meadow", "Wagon Road",
    "Union Camp", "Pat's Turnpike", "Stefan's Lot",
    "Confederate Encampment"
  ]
};

const ALL_MAPS = Object.values(MAPS).flat().sort();

// Default map bias values (from tracker.py lines 2933-2954)
const getDefaultMapBiases = () => ({
  // ANTIETAM
  "East Woods Skirmish": 2, "Hooker's Push": 2.5, "Hagerstown Turnpike": 1,
  "Miller's Cornfield": 1.5, "East Woods": 2.5, "Nicodemus Hill": 2.5,
  "Bloody Lane": 1.5, "Pry Ford": 2, "Pry Grist Mill": 1, "Pry House": 1.5,
  "West Woods": 1.5, "Dunker Church": 1.5, "Burnside's Bridge": 2.5,
  "Cooke's Countercharge": 1.5, "Otto and Sherrick Farms": 1,
  "Roulette Lane": 1.5, "Piper Farm": 2, "Hill's Counterattack": 1,
  // HARPERS FERRY
  "Maryland Heights": 1.5, "River Crossing": 2.5, "Downtown": 1,
  "School House Ridge": 1, "Bolivar Heights Camp": 1.5, "High Street": 1,
  "Shenandoah Street": 1.5, "Harpers Ferry Graveyard": 1, "Washington Street": 1,
  "Bolivar Heights Redoubt": 2,
  // SOUTH MOUNTAIN
  "Garland's Stand": 2.5, "Cox's Push": 2.5, "Hatch's Attack": 2,
  "Anderson's Counterattack": 1, "Reno's Fall": 1.5, "Colquitt's Defense": 2,
  // DRILL CAMP
  "Alexander Farm": 2, "Crossroads": 0, "Smith Field": 1,
  "Crecy's Cornfield": 1.5, "Crossley Creek": 1, "Larsen Homestead": 1.5,
  "South Woodlot": 1.5, "Flemming's Meadow": 2, "Wagon Road": 2,
  "Union Camp": 1.5, "Pat's Turnpike": 1.5, "Stefan's Lot": 1,
  "Confederate Encampment": 2
});

const SeasonTracker = () => {
  // Load initial state from localStorage
  const loadFromStorage = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error('Error loading from localStorage:', error);
    }
    return null;
  };

  const savedState = loadFromStorage();

  // State management
  const [units, setUnits] = useState(savedState?.units || []);
  const [nonTokenUnits, setNonTokenUnits] = useState(savedState?.nonTokenUnits || []);
  const [weeks, setWeeks] = useState(savedState?.weeks || []);
  const [selectedWeek, setSelectedWeek] = useState(savedState?.selectedWeek || null);
  const [teamNames, setTeamNames] = useState(savedState?.teamNames || { A: 'USA', B: 'CSA' });
  const [pointSystem, setPointSystem] = useState(savedState?.pointSystem || {
    winLead: 4,
    winAssist: 2,
    lossLead: 0,
    lossAssist: 1,
    bonus2_0Lead: 0,
    bonus2_0Assist: 1
  });
  const [eloSystem, setEloSystem] = useState(savedState?.eloSystem || {
    initialElo: 1500,
    kFactorStandard: 96,
    kFactorProvisional: 128,
    provisionalRounds: 10,
    sweepBonusMultiplier: 1.25,
    leadMultiplier: 2.0,
    sizeInfluence: 1.0,
    playoffMultiplier: 1.25
  });
  const [eloBiasPercentages, setEloBiasPercentages] = useState(savedState?.eloBiasPercentages || {
    lightAttacker: 15,
    heavyAttacker: 30,
    lightDefender: 15,
    heavyDefender: 30
  });
  const [unitPlayerCounts, setUnitPlayerCounts] = useState(savedState?.unitPlayerCounts || {});
  const [manualAdjustments, setManualAdjustments] = useState(savedState?.manualAdjustments || {});
  const [divisions, setDivisions] = useState(savedState?.divisions || []);
  const [mapBiases, setMapBiases] = useState(savedState?.mapBiases || getDefaultMapBiases());
  const [showSettings, setShowSettings] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showBalancerModal, setShowBalancerModal] = useState(false);
  const [showCasualtyModal, setShowCasualtyModal] = useState(false);
  const [showDivisionModal, setShowDivisionModal] = useState(false);
  const [showMapBiasModal, setShowMapBiasModal] = useState(false);
  const [showHeatmapModal, setShowHeatmapModal] = useState(false);
  const [showGroupedStandings, setShowGroupedStandings] = useState(false);
  const [showNonTokenElo, setShowNonTokenElo] = useState(true);
  const [rankByElo, setRankByElo] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');
  const [editingWeek, setEditingWeek] = useState(null);
  const [expandedSections, setExpandedSections] = useState({});
  const [enlargedSection, setEnlargedSection] = useState(null);
  
  // Casualty input state
  const [casualtyInputData, setCasualtyInputData] = useState({});
  
  // Balancer state
  const [balancerMaxDiff, setBalancerMaxDiff] = useState(1);
  const [balancerUnitCounts, setBalancerUnitCounts] = useState({});
  const [balancerOpposingPairs, setBalancerOpposingPairs] = useState([]);
  const [balancerResults, setBalancerResults] = useState(null);
  const [balancerStatus, setBalancerStatus] = useState('');
  const [draggedUnit, setDraggedUnit] = useState(null);
  const [previewTeams, setPreviewTeams] = useState(null);
  const [draggedMainUnit, setDraggedMainUnit] = useState(null);

  // Save state to localStorage whenever relevant state changes
  useEffect(() => {
    const stateToSave = {
      units,
      nonTokenUnits,
      weeks,
      selectedWeek,
      teamNames,
      pointSystem,
      manualAdjustments,
      eloSystem,
      eloBiasPercentages,
      unitPlayerCounts,
      divisions,
      mapBiases
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }, [units, nonTokenUnits, weeks, selectedWeek, teamNames, pointSystem, manualAdjustments, eloSystem, eloBiasPercentages, unitPlayerCounts, divisions, mapBiases]);

  // Unit Management
  const addUnit = () => {
    if (!newUnitName.trim()) return;
    if (units.includes(newUnitName.trim())) {
      alert('Unit already exists!');
      return;
    }
    setUnits([...units, newUnitName.trim()].sort());
    setNewUnitName('');
  };

  const removeUnit = (unitName) => {
    if (!confirm(`Remove ${unitName}? This will remove it from all weeks.`)) return;
    
    setUnits(units.filter(u => u !== unitName));
    setNonTokenUnits(nonTokenUnits.filter(u => u !== unitName));
    setWeeks(weeks.map(week => ({
      ...week,
      teamA: week.teamA.filter(u => u !== unitName),
      teamB: week.teamB.filter(u => u !== unitName)
    })));
  };

  // Toggle non-token status for a unit
  const toggleNonTokenStatus = (unitName) => {
    if (nonTokenUnits.includes(unitName)) {
      setNonTokenUnits(nonTokenUnits.filter(u => u !== unitName));
    } else {
      setNonTokenUnits([...nonTokenUnits, unitName]);
    }
  };

  // Week Management
  const addWeek = () => {
    // Get unitPlayerCounts from the most recent week, or use global defaults
    let inheritedUnitPlayerCounts = {};
    if (weeks.length > 0) {
      const lastWeek = weeks[weeks.length - 1];
      if (lastWeek.unitPlayerCounts && Object.keys(lastWeek.unitPlayerCounts).length > 0) {
        inheritedUnitPlayerCounts = { ...lastWeek.unitPlayerCounts };
      } else {
        inheritedUnitPlayerCounts = { ...unitPlayerCounts };
      }
    } else {
      inheritedUnitPlayerCounts = { ...unitPlayerCounts };
    }

    const newWeek = {
      id: Date.now(),
      name: `Week ${weeks.length + 1}`,
      teamA: [],
      teamB: [],
      round1Winner: null,
      round2Winner: null,
      round1Map: null,
      round2Map: null,
      round1Flipped: false,
      round2Flipped: false,
      leadA: null,
      leadB: null,
      isPlayoffs: false,
      leadA_r1: null,
      leadB_r1: null,
      leadA_r2: null,
      leadB_r2: null,
      r1CasualtiesA: 0,
      r1CasualtiesB: 0,
      r2CasualtiesA: 0,
      r2CasualtiesB: 0,
      unitPlayerCounts: inheritedUnitPlayerCounts,
      weeklyCasualties: {
        [teamNames.A]: { r1: {}, r2: {} },
        [teamNames.B]: { r1: {}, r2: {} }
      }
    };
    setWeeks([...weeks, newWeek]);
  };

  const removeWeek = (weekId) => {
    if (!confirm('Remove this week?')) return;
    setWeeks(weeks.filter(w => w.id !== weekId));
    if (selectedWeek?.id === weekId) {
      setSelectedWeek(null);
    }
  };

  const updateWeek = (weekId, updates) => {
    setWeeks(weeks.map(w => w.id === weekId ? { ...w, ...updates } : w));
    if (selectedWeek?.id === weekId) {
      setSelectedWeek({ ...selectedWeek, ...updates });
    }
  };

  const renameWeek = (weekId, newName) => {
    updateWeek(weekId, { name: newName });
    setEditingWeek(null);
  };

  // Team Management
  const moveUnitToTeam = (unit, team) => {
    if (!selectedWeek) return;
    
    const otherTeam = team === 'A' ? 'B' : 'A';
    const updates = {
      [`team${team}`]: [...selectedWeek[`team${team}`].filter(u => u !== unit), unit],
      [`team${otherTeam}`]: selectedWeek[`team${otherTeam}`].filter(u => u !== unit)
    };
    
    updateWeek(selectedWeek.id, updates);
  };

  const removeUnitFromTeam = (unit, team) => {
    if (!selectedWeek) return;
    
    const updates = {
      [`team${team}`]: selectedWeek[`team${team}`].filter(u => u !== unit)
    };
    
    updateWeek(selectedWeek.id, updates);
  };

  // Calculate Points up to a specific week
  const calculatePointsUpToWeek = (maxWeekIdx = null) => {
    const stats = {};
    
    units.forEach(unit => {
      // Skip non-token units in point calculations
      if (nonTokenUnits.includes(unit)) return;
      
      stats[unit] = {
        points: 0,
        leadWins: 0,
        leadLosses: 0,
        assistWins: 0,
        assistLosses: 0
      };
    });

    const weeksToProcess = maxWeekIdx !== null ? weeks.slice(0, maxWeekIdx + 1) : weeks;

    weeksToProcess.forEach(week => {
      if (!week.round1Winner && !week.round2Winner) return;
      
      const isPlayoffs = week.isPlayoffs || false;

      // Process each round
      [1, 2].forEach(roundNum => {
        const winner = week[`round${roundNum}Winner`];
        if (!winner) return;

        const winningTeam = week[`team${winner}`];
        const losingTeam = week[`team${winner === 'A' ? 'B' : 'A'}`];
        
        // Get leads based on playoffs mode
        let leadWinner, leadLoser;
        if (isPlayoffs) {
          leadWinner = week[`lead${winner}_r${roundNum}`];
          leadLoser = week[`lead${winner === 'A' ? 'B' : 'A'}_r${roundNum}`];
        } else {
          leadWinner = week[`lead${winner}`];
          leadLoser = week[`lead${winner === 'A' ? 'B' : 'A'}`];
        }

        // Award points to winning team (skip in playoffs)
        if (!isPlayoffs) {
          winningTeam.forEach(unit => {
            // Skip non-token units
            if (!stats[unit]) return;
            
            if (unit === leadWinner) {
              stats[unit].points += pointSystem.winLead;
              stats[unit].leadWins++;
            } else {
              stats[unit].points += pointSystem.winAssist;
              stats[unit].assistWins++;
            }
          });

          // Award points to losing team
          losingTeam.forEach(unit => {
            // Skip non-token units
            if (!stats[unit]) return;
            
            if (unit === leadLoser) {
              stats[unit].points += pointSystem.lossLead;
              stats[unit].leadLosses++;
            } else {
              stats[unit].points += pointSystem.lossAssist;
              stats[unit].assistLosses++;
            }
          });
        } else {
          // In playoffs, still track wins/losses but no points
          winningTeam.forEach(unit => {
            // Skip non-token units
            if (!stats[unit]) return;
            
            if (unit === leadWinner) {
              stats[unit].leadWins++;
            } else {
              stats[unit].assistWins++;
            }
          });
          
          losingTeam.forEach(unit => {
            // Skip non-token units
            if (!stats[unit]) return;
            
            if (unit === leadLoser) {
              stats[unit].leadLosses++;
            } else {
              stats[unit].assistLosses++;
            }
          });
        }
      });

      // 2-0 Sweep Bonus (skip in playoffs)
      if (!isPlayoffs && week.round1Winner && week.round1Winner === week.round2Winner) {
        const sweepTeam = week[`team${week.round1Winner}`];
        const sweepLead = week[`lead${week.round1Winner}`];
        
        sweepTeam.forEach(unit => {
          // Skip non-token units
          if (!stats[unit]) return;
          
          if (unit === sweepLead) {
            stats[unit].points += pointSystem.bonus2_0Lead;
          } else {
            stats[unit].points += pointSystem.bonus2_0Assist;
          }
        });
      }
    });

    // Apply manual adjustments
    Object.entries(manualAdjustments).forEach(([unit, adjustment]) => {
      if (stats[unit]) {
        stats[unit].points += adjustment;
      }
    });

    return stats;
  };

  // Calculate Points (for entire season)
  const calculatePoints = () => {
    return calculatePointsUpToWeek(null);
  };

  // Get standings with Elo
  const getStandings = () => {
    const stats = calculatePoints();
    const { eloRatings, roundsPlayed } = calculateEloRatings();
    
    return Object.entries(stats)
      .map(([unit, data]) => ({
        unit,
        ...data,
        elo: eloRatings[unit] || eloSystem.initialElo,
        rounds: roundsPlayed[unit] || 0
      }))
      .sort((a, b) => b.points - a.points);
  };

  // Get standings with week-over-week changes
  const getStandingsWithChanges = () => {
    const currentWeekIdx = selectedWeek ? weeks.findIndex(w => w.id === selectedWeek.id) : weeks.length - 1;
    const previousWeekIdx = currentWeekIdx - 1;

    // Current week stats - calculate up to current week only
    const currentStats = calculatePointsUpToWeek(currentWeekIdx);
    const { eloRatings: currentElo, roundsPlayed } = calculateEloRatings(currentWeekIdx);
    
    // Previous week stats (if exists)
    let previousStats = {};
    let previousElo = {};
    let previousEloRanks = {};
    if (previousWeekIdx >= 0) {
      // Simplified: just get previous week's calculated points
      const prevWeeks = weeks.slice(0, previousWeekIdx + 1);
      const tempStats = {};
      
      units.forEach(unit => {
        tempStats[unit] = { points: 0 };
      });

      prevWeeks.forEach(week => {
        if (!week.round1Winner && !week.round2Winner) return;
        const isPlayoffs = week.isPlayoffs || false;

        [1, 2].forEach(roundNum => {
          const winner = week[`round${roundNum}Winner`];
          if (!winner) return;

          const winningTeam = week[`team${winner}`];
          const losingTeam = week[`team${winner === 'A' ? 'B' : 'A'}`];
          
          let leadWinner, leadLoser;
          if (isPlayoffs) {
            leadWinner = week[`lead${winner}_r${roundNum}`];
            leadLoser = week[`lead${winner === 'A' ? 'B' : 'A'}_r${roundNum}`];
          } else {
            leadWinner = week[`lead${winner}`];
            leadLoser = week[`lead${winner === 'A' ? 'B' : 'A'}`];
          }

          if (!isPlayoffs) {
            winningTeam.forEach(unit => {
              if (unit === leadWinner) {
                tempStats[unit].points += pointSystem.winLead;
              } else {
                tempStats[unit].points += pointSystem.winAssist;
              }
            });

            losingTeam.forEach(unit => {
              if (unit === leadLoser) {
                tempStats[unit].points += pointSystem.lossLead;
              } else {
                tempStats[unit].points += pointSystem.lossAssist;
              }
            });
          }
        });

        if (!isPlayoffs && week.round1Winner && week.round1Winner === week.round2Winner) {
          const sweepTeam = week[`team${week.round1Winner}`];
          const sweepLead = week[`lead${week.round1Winner}`];
          
          sweepTeam.forEach(unit => {
            if (unit === sweepLead) {
              tempStats[unit].points += pointSystem.bonus2_0Lead;
            } else {
              tempStats[unit].points += pointSystem.bonus2_0Assist;
            }
          });
        }
      });

      Object.entries(manualAdjustments).forEach(([unit, adjustment]) => {
        if (tempStats[unit]) {
          tempStats[unit].points += adjustment;
        }
      });

      previousStats = tempStats;
      const prevEloData = calculateEloRatings(previousWeekIdx);
      previousElo = prevEloData.eloRatings;
      
      // Calculate previous Elo ranks
      const prevEloStandings = Object.entries(previousElo)
        .map(([unit, elo]) => ({ unit, elo }))
        .sort((a, b) => b.elo - a.elo);
      
      prevEloStandings.forEach((stat, index) => {
        previousEloRanks[stat.unit] = index + 1;
      });
    }

    // Calculate previous ranks (by points)
    const previousRanks = {};
    if (previousWeekIdx >= 0) {
      const prevStandings = Object.entries(previousStats)
        .map(([unit, data]) => ({ unit, points: data.points }))
        .sort((a, b) => b.points - a.points);
      
      prevStandings.forEach((stat, index) => {
        previousRanks[stat.unit] = index + 1;
      });
    }

    // Build current standings with changes
    const standings = Object.entries(currentStats)
      .map(([unit, data]) => {
        const currentEloValue = currentElo[unit] || eloSystem.initialElo;
        const previousEloValue = previousElo[unit] || eloSystem.initialElo;
        const eloDelta = currentEloValue - previousEloValue;
        
        const previousRank = previousRanks[unit] || null;
        const previousEloRank = previousEloRanks[unit] || null;

        return {
          unit,
          ...data,
          elo: currentEloValue,
          eloDelta,
          previousRank,
          previousEloRank,
          rounds: roundsPlayed[unit] || 0
        };
      })
      .sort((a, b) => rankByElo ? b.elo - a.elo : b.points - a.points);

    standings.forEach((stat, index) => {
      stat.currentRank = index + 1;
      
      // Check if current week is a playoff week
      const currentWeek = currentWeekIdx >= 0 ? weeks[currentWeekIdx] : null;
      const isCurrentWeekPlayoff = currentWeek?.isPlayoffs || false;
      
      // If ranking by points and current week is playoffs, don't show rank delta
      // (because points don't change during playoffs)
      if (!rankByElo && isCurrentWeekPlayoff) {
        stat.rankDelta = null;
      } else {
        stat.rankDelta = rankByElo
          ? (stat.previousEloRank ? stat.previousEloRank - stat.currentRank : null)
          : (stat.previousRank ? stat.previousRank - stat.currentRank : null);
      }
    });

    return standings;
  };

  // Get grouped standings by division
  const getGroupedStandings = () => {
    const allStandings = getStandingsWithChanges();
    
    if (!divisions || divisions.length === 0) {
      return [{ name: 'All Units', units: allStandings }];
    }

    const grouped = divisions.map(division => {
      const divisionUnits = new Set(division.units);
      const divisionStandings = allStandings
        .filter(stat => divisionUnits.has(stat.unit))
        .map((stat, index) => ({ ...stat, divisionRank: index + 1 }));
      
      return {
        name: division.name,
        units: divisionStandings
      };
    });

    const assignedUnits = new Set(divisions.flatMap(d => d.units));
    const unassignedStandings = allStandings
      .filter(stat => !assignedUnits.has(stat.unit))
      .map((stat, index) => ({ ...stat, divisionRank: index + 1 }));
    
    if (unassignedStandings.length > 0) {
      grouped.push({
        name: 'Unassigned',
        units: unassignedStandings
      });
    }

    return grouped;
  };

  // Calculate Map Statistics
  const calculateMapStats = () => {
    const mapStats = {};
    
    weeks.forEach(week => {
      [1, 2].forEach(roundNum => {
        const mapName = week[`round${roundNum}Map`];
        const winner = week[`round${roundNum}Winner`];
        const flipped = week[`round${roundNum}Flipped`];
        
        if (!mapName || !winner) return;
        
        if (!mapStats[mapName]) {
          mapStats[mapName] = {
            plays: 0,
            usaWins: 0,
            csaWins: 0
          };
        }
        
        mapStats[mapName].plays++;
        
        // Determine USA/CSA sides based on flipped state
        const usaSide = flipped ? 'B' : 'A';
        
        if (winner === usaSide) {
          mapStats[mapName].usaWins++;
        } else {
          mapStats[mapName].csaWins++;
        }
      });
    });
    
    return mapStats;
  };

  // Helper function to get unit player count
  const getUnitPlayerCount = (unitName, weekIndex = null) => {
    // If weekIndex is provided and week has specific player counts, use those
    if (weekIndex !== null && weeks[weekIndex]?.unitPlayerCounts?.[unitName]) {
      const counts = weeks[weekIndex].unitPlayerCounts[unitName];
      const min = parseInt(counts.min) || 0;
      const max = parseInt(counts.max) || 0;
      return (min + max) / 2;
    }
    
    // Otherwise use global player counts
    if (unitPlayerCounts[unitName]) {
      const counts = unitPlayerCounts[unitName];
      const min = parseInt(counts.min) || 0;
      const max = parseInt(counts.max) || 0;
      return (min + max) / 2;
    }
    
    // Default to 25 if no data
    return 25;
  };

  // Helper to get average player count across weeks a unit participated
  const getUnitAveragePlayerCount = (unitName, maxWeekIndex = null) => {
    const weeksToProcess = maxWeekIndex !== null ? weeks.slice(0, maxWeekIndex + 1) : weeks;
    const weeklyAverages = [];

    weeksToProcess.forEach((week, idx) => {
      const teamA = week.teamA || [];
      const teamB = week.teamB || [];
      
      if (teamA.includes(unitName) || teamB.includes(unitName)) {
        const playerCount = getUnitPlayerCount(unitName, idx);
        if (playerCount > 0) {
          weeklyAverages.push(playerCount);
        }
      }
    });

    if (weeklyAverages.length === 0) return 0;
    return weeklyAverages.reduce((sum, val) => sum + val, 0) / weeklyAverages.length;
  };

  // Calculate Teammate Impact Index (TII)
  const calculateTeammateImpact = (maxWeekIndex = null) => {
    const weeksToProcess = maxWeekIndex !== null ? weeks.slice(0, maxWeekIndex + 1) : weeks;
    
    // Part 1: Collect global loss data
    const totalLossesRecords = [];
    const unitPerformances = {};

    weeksToProcess.forEach(week => {
      const isPlayoffs = week.isPlayoffs || false;
      
      [1, 2].forEach(roundNum => {
        const winner = week[`round${roundNum}Winner`];
        if (!winner) return;

        const teamA = week.teamA || [];
        const teamB = week.teamB || [];
        const winningTeam = winner === 'A' ? teamA : teamB;
        const losingTeam = winner === 'A' ? teamB : teamA;

        // Collect global loss data
        winningTeam.forEach(() => totalLossesRecords.push(0));
        losingTeam.forEach(() => totalLossesRecords.push(1));

        // Get leads for this round
        let leadA, leadB;
        if (isPlayoffs) {
          leadA = week[`leadA_r${roundNum}`];
          leadB = week[`leadB_r${roundNum}`];
        } else {
          leadA = week.leadA;
          leadB = week.leadB;
        }

        const winningLead = winner === 'A' ? leadA : leadB;
        const losingLead = winner === 'A' ? leadB : leadA;

        // Track unit performances
        winningTeam.forEach(unit => {
          if (!unitPerformances[unit]) unitPerformances[unit] = [];
          unitPerformances[unit].push([0, unit === winningLead]); // [isLoss, isLead]
        });

        losingTeam.forEach(unit => {
          if (!unitPerformances[unit]) unitPerformances[unit] = [];
          unitPerformances[unit].push([1, unit === losingLead]);
        });
      });
    });

    const globalAvgLossRate = totalLossesRecords.length > 0
      ? totalLossesRecords.reduce((sum, val) => sum + val, 0) / totalLossesRecords.length
      : 0;

    // Part 2: Calculate TII for each unit
    const impactStats = {};
    const participatingUnits = Object.keys(unitPerformances).filter(u => unitPerformances[u].length > 0);
    
    // Calculate league average player count
    const allUnitAvgPlayers = participatingUnits.map(u => getUnitAveragePlayerCount(u, maxWeekIndex));
    const leagueAvgPlayers = allUnitAvgPlayers.length > 0
      ? allUnitAvgPlayers.reduce((sum, val) => sum + val, 0) / allUnitAvgPlayers.length
      : 0;

    units.forEach(unitU => {
      // Calculate teammate loss rates when this unit is present
      const teammateLossRates = [];
      
      weeksToProcess.forEach(week => {
        [1, 2].forEach(roundNum => {
          const winner = week[`round${roundNum}Winner`];
          if (!winner) return;

          const teamA = week.teamA || [];
          const teamB = week.teamB || [];

          if (teamA.includes(unitU)) {
            const teammates = teamA.filter(u => u !== unitU);
            const isLoss = winner === 'B';
            teammates.forEach(() => teammateLossRates.push(isLoss ? 1 : 0));
          } else if (teamB.includes(unitU)) {
            const teammates = teamB.filter(u => u !== unitU);
            const isLoss = winner === 'A';
            teammates.forEach(() => teammateLossRates.push(isLoss ? 1 : 0));
          }
        });
      });

      const avgTeammateLossRate = teammateLossRates.length > 0
        ? teammateLossRates.reduce((sum, val) => sum + val, 0) / teammateLossRates.length
        : 0;
      
      const originalTiiScore = 1 - avgTeammateLossRate;

      // Calculate lead/assist impact
      const performances = unitPerformances[unitU] || [];
      const leadPerformances = performances.filter(p => p[1]).map(p => p[0]);
      const assistPerformances = performances.filter(p => !p[1]).map(p => p[0]);

      const leadImpact = leadPerformances.length > 0
        ? 1 - (leadPerformances.reduce((sum, val) => sum + val, 0) / leadPerformances.length)
        : 0;
      
      const assistImpact = assistPerformances.length > 0
        ? 1 - (assistPerformances.reduce((sum, val) => sum + val, 0) / assistPerformances.length)
        : 0;

      // Player count modifier
      const unitAvgPlayers = getUnitAveragePlayerCount(unitU, maxWeekIndex);
      const playerModifier = leagueAvgPlayers > 0 ? unitAvgPlayers / leagueAvgPlayers : 1.0;

      // Adjusted TII calculation
      const deltaFromAvg = globalAvgLossRate - avgTeammateLossRate;
      const modifiedDelta = deltaFromAvg * playerModifier;
      const modifiedAvgTeammateLossRate = globalAvgLossRate - modifiedDelta;
      const adjustedTiiScore = 1 - modifiedAvgTeammateLossRate;

      impactStats[unitU] = {
        impactScore: originalTiiScore,
        adjustedTiiScore: adjustedTiiScore,
        avgTeammateLossRateWith: avgTeammateLossRate,
        leadImpact: leadImpact,
        assistImpact: assistImpact,
        leadGames: leadPerformances.length,
        assistGames: assistPerformances.length,
        avgPlayers: unitAvgPlayers
      };
    });

    return { impactStats, globalAvgLossRate };
  };

  // USA Attack Maps (from tracker.py)
  const USA_ATTACK_MAPS = new Set([
    "East Woods Skirmish", "Nicodemus Hill", "Hooker's Push", "Bloody Lane",
    "Pry Ford", "Smith Field", "Alexander Farm", "Crossroads",
    "Wagon Road", "Hagertown Turnpike", "Pry Grist Mill", "Otto & Sherrick Farm",
    "Piper Farm", "West Woods", "Dunker Church", "Burnside Bridge",
    "Garland's Stand", "Cox's Push", "Hatch's Attack", "Colquitt's Defense",
    "Flemming's Meadow", "Crossley Creek", "Confederate Encampment"
  ]);

  // Calculate Elo Ratings
  const calculateEloRatings = (maxWeekIndex = null) => {
    const {
      initialElo,
      kFactorStandard,
      kFactorProvisional,
      provisionalRounds,
      sweepBonusMultiplier,
      leadMultiplier,
      sizeInfluence,
      playoffMultiplier
    } = eloSystem;

    const eloRatings = {};
    const roundsPlayed = {};
    
    // Initialize all units
    units.forEach(unit => {
      eloRatings[unit] = initialElo;
      roundsPlayed[unit] = 0;
    });

    const weeksToProcess = maxWeekIndex !== null
      ? weeks.slice(0, maxWeekIndex + 1)
      : weeks;

    weeksToProcess.forEach((week, weekIdx) => {
      const teamAUnits = week.teamA || [];
      const teamBUnits = week.teamB || [];
      
      if (teamAUnits.length === 0 || teamBUnits.length === 0) return;

      const isPlayoffs = week.isPlayoffs || false;
      const round1Winner = week.round1Winner;
      const round2Winner = week.round2Winner;

      // Determine sweep bonuses
      const sweepBonusA = (round1Winner === 'A' && round2Winner === 'A') ? sweepBonusMultiplier : 1.0;
      const sweepBonusB = (round1Winner === 'B' && round2Winner === 'B') ? sweepBonusMultiplier : 1.0;

      // Process each round
      [1, 2].forEach(roundNum => {
        const winner = week[`round${roundNum}Winner`];
        if (!winner) return;

        // Calculate team Elo averages with player count weighting
        const totalPlayersA = teamAUnits.reduce((sum, u) => sum + getUnitPlayerCount(u, weekIdx), 0);
        const totalPlayersB = teamBUnits.reduce((sum, u) => sum + getUnitPlayerCount(u, weekIdx), 0);

        const avgEloA = totalPlayersA > 0
          ? teamAUnits.reduce((sum, u) => sum + eloRatings[u] * getUnitPlayerCount(u, weekIdx), 0) / totalPlayersA
          : initialElo;
        const avgEloB = totalPlayersB > 0
          ? teamBUnits.reduce((sum, u) => sum + eloRatings[u] * getUnitPlayerCount(u, weekIdx), 0) / totalPlayersB
          : initialElo;

        // Get leads for this round
        let leadA, leadB;
        if (isPlayoffs) {
          leadA = week[`leadA_r${roundNum}`];
          leadB = week[`leadB_r${roundNum}`];
        } else {
          leadA = week.leadA;
          leadB = week.leadB;
        }

        // Calculate expected outcome
        let expectedA = 1 / (1 + Math.pow(10, (avgEloB - avgEloA) / 400));

        // Apply map bias if map is selected
        const mapName = week[`round${roundNum}Map`];
        if (mapName) {
          const mapBiasLevel = mapBiases[mapName] ?? 0;
          
          // Build bias multiplier map from percentages
          const biasPercentMap = {
            0: 1.00,
            1: 1.0 + (eloBiasPercentages.lightAttacker / 100.0),
            1.5: 1.0 + (eloBiasPercentages.heavyAttacker / 100.0),
            2: 1.0 - (eloBiasPercentages.lightDefender / 100.0),
            2.5: 1.0 - (eloBiasPercentages.heavyDefender / 100.0)
          };
          const biasMultiplier = biasPercentMap[mapBiasLevel] ?? 1.0;

          const isUsaAttack = USA_ATTACK_MAPS.has(mapName);
          const flipped = week[`round${roundNum}Flipped`] || false;
          const usaSide = flipped ? 'B' : 'A';
          const attackerSide = isUsaAttack ? usaSide : (usaSide === 'A' ? 'B' : 'A');
          
          if (attackerSide === 'A') {
            expectedA *= biasMultiplier;
          } else {
            expectedA /= biasMultiplier;
          }

          expectedA = Math.max(0.05, Math.min(0.95, expectedA));
        }

        const scoreA = winner === 'A' ? 1 : 0;
        const baseChange = scoreA - expectedA;

        // Apply Elo changes to teams
        const applyEloChanges = (teamUnits, totalPlayers, leadUnit, sign, sweepBonus) => {
          if (totalPlayers <= 0) return;

          // Log-scaled + normalized weights
          const weights = {};
          let totalWeight = 0;
          
          teamUnits.forEach(unit => {
            const playerCount = getUnitPlayerCount(unit, weekIdx);
            const weight = Math.pow(Math.log(1 + playerCount), sizeInfluence)
              * (unit === leadUnit ? leadMultiplier : 1);
            weights[unit] = weight;
            totalWeight += weight;
          });

          // Normalize weights
          Object.keys(weights).forEach(unit => {
            weights[unit] /= totalWeight;
          });

          // Calculate team average Elo for proportional distribution
          const teamAvgElo = teamUnits.reduce((sum, u) => sum + eloRatings[u], 0) / teamUnits.length;

          // Apply changes
          teamUnits.forEach(unit => {
            const k = roundsPlayed[unit] < provisionalRounds ? kFactorProvisional : kFactorStandard;
            const roundMultiplier = isPlayoffs ? playoffMultiplier : 1.0;
            
            // Relative factor for proportional distribution
            const relativeFactor = Math.max(0.8, Math.min(1.2, Math.pow(teamAvgElo / eloRatings[unit], 0.5)));
            
            const delta = k * baseChange * weights[unit] * sign * roundMultiplier * sweepBonus * relativeFactor;
            eloRatings[unit] += delta;
          });
        };

        applyEloChanges(teamAUnits, totalPlayersA, leadA, 1, sweepBonusA);
        applyEloChanges(teamBUnits, totalPlayersB, leadB, -1, sweepBonusB);

        // Increment rounds played
        teamAUnits.forEach(unit => roundsPlayed[unit]++);
        teamBUnits.forEach(unit => roundsPlayed[unit]++);
      });
    });

    return { eloRatings, roundsPlayed };
  };

  // Balancer Functions
  const openBalancerModal = () => {
    if (!selectedWeek) {
      alert('Please select a week first');
      return;
    }

    // Initialize balancer unit counts from week-specific or global data
    const weekIdx = weeks.findIndex(w => w.id === selectedWeek.id);
    let countsToUse = {};
    
    if (selectedWeek.unitPlayerCounts && Object.keys(selectedWeek.unitPlayerCounts).length > 0) {
      countsToUse = selectedWeek.unitPlayerCounts;
    } else if (weekIdx > 0 && weeks[weekIdx - 1]?.unitPlayerCounts) {
      countsToUse = weeks[weekIdx - 1].unitPlayerCounts;
    } else {
      countsToUse = unitPlayerCounts;
    }

    // Initialize balancer unit counts for all units
    const initialCounts = {};
    units.forEach(unit => {
      if (countsToUse[unit]) {
        initialCounts[unit] = { ...countsToUse[unit] };
      } else {
        initialCounts[unit] = { min: 0, max: 100 };
      }
    });

    setBalancerUnitCounts(initialCounts);
    setBalancerOpposingPairs([]);
    setBalancerResults(null);
    setBalancerStatus('');
    setShowBalancerModal(true);
  };

  const runBalancer = () => {
    if (!selectedWeek) return;

    setBalancerStatus('Balancing...');
    
    // Get available units (not assigned to teams in current week)
    const assignedUnits = new Set([...selectedWeek.teamA, ...selectedWeek.teamB]);
    const available = units.filter(u => !assignedUnits.has(u));

    // Validate inputs
    try {
      const maxDiff = parseInt(balancerMaxDiff);
      if (isNaN(maxDiff) || maxDiff < 0) {
        alert('Max player difference must be a valid number');
        setBalancerStatus('Error!');
        return;
      }

      // Get teammate history
      const { teammate } = computeStats();

      // Run the balancing algorithm
      const result = balanceTeams(
        available,
        balancerUnitCounts,
        balancerOpposingPairs,
        maxDiff,
        teammate
      );

      if (result) {
        const { teamA, teamB, score, minA, maxA, minB, maxB } = result;
        const stats = calculatePreviewStats(teamA, teamB);
        setBalancerResults({
          teamA,
          teamB,
          score,
          minA,
          maxA,
          minB,
          maxB,
          avgHistoryA: stats.avgHistoryA,
          avgHistoryB: stats.avgHistoryB,
          combinedAvgHistory: stats.combinedAvgHistory
        });
        setBalancerStatus(`Best solution found! Avg. Diff: ${score.toFixed(1)}`);
      } else {
        setBalancerStatus('Failed to find a valid balance.');
      }
    } catch (error) {
      alert('Error during balancing: ' + error.message);
      setBalancerStatus('Error!');
    }
  };

  const balanceTeams = (available, unitCounts, opposingPairs, maxPlayerDiff, teammateHistory) => {
    // Validate and prepare unit data
    const unitData = {};
    try {
      Object.entries(unitCounts).forEach(([unit, counts]) => {
        unitData[unit] = {
          min: parseInt(counts.min) || 0,
          max: parseInt(counts.max) || 0
        };
      });
    } catch (error) {
      alert('Min/Max values for all units must be valid integers.');
      return null;
    }

    // Filter out units with 0 min and 0 max
    const presentUnits = new Set(
      Object.entries(unitData)
        .filter(([unit, data]) => !(data.min === 0 && data.max === 0))
        .map(([unit]) => unit)
    );

    const players = available.filter(u => presentUnits.has(u)).sort();

    // Build opposing map
    const opposingMap = {};
    opposingPairs.forEach(([p1, p2]) => {
      if (!opposingMap[p1]) opposingMap[p1] = new Set();
      if (!opposingMap[p2]) opposingMap[p2] = new Set();
      opposingMap[p1].add(p2);
      opposingMap[p2].add(p1);
    });

    let bestSolution = {
      score: [Infinity, Infinity, Infinity, Infinity],
      teams: null,
      stats: null
    };

    // Calculate average teammate count for penalty
    const allCounts = [];
    const countedPairs = new Set();
    Object.entries(teammateHistory).forEach(([u1, others]) => {
      Object.entries(others).forEach(([u2, count]) => {
        const pair = [u1, u2].sort().join('|');
        if (!countedPairs.has(pair)) {
          allCounts.push(count);
          countedPairs.add(pair);
        }
      });
    });

    const averageTeammateCount = allCounts.length > 0
      ? allCounts.reduce((sum, val) => sum + val, 0) / allCounts.length
      : 0;
    const overTeamingThreshold = Math.round(averageTeammateCount);
    const overTeamingPenaltyMultiplier = 10;

    // Handle forced teams from opposing pairs
    const forcedA = new Set(opposingPairs.map(p => p[0]).filter(Boolean));
    const forcedB = new Set(opposingPairs.map(p => p[1]).filter(Boolean));

    // Check for contradictions
    const conflict = [...forcedA].filter(u => forcedB.has(u));
    if (conflict.length > 0) {
      alert(`Units cannot be in both opposing teams: ${conflict.join(', ')}`);
      return null;
    }

    // Players to assign
    const playersToAssign = players.filter(p => !forcedA.has(p) && !forcedB.has(p)).sort();

    // Generate all possible team combinations
    const generateCombinations = (arr, size) => {
      if (size === 0) return [[]];
      if (arr.length === 0) return [];
      
      const [first, ...rest] = arr;
      const withFirst = generateCombinations(rest, size - 1).map(combo => [first, ...combo]);
      const withoutFirst = generateCombinations(rest, size);
      
      return [...withFirst, ...withoutFirst];
    };

    // Try all possible team sizes
    for (let sizeAAdditional = 0; sizeAAdditional <= playersToAssign.length; sizeAAdditional++) {
      const combinations = generateCombinations(playersToAssign, sizeAAdditional);
      
      for (const teamAAdditional of combinations) {
        const teamA = new Set([...forcedA, ...teamAAdditional]);
        const teamB = new Set([...forcedB, ...playersToAssign.filter(p => !teamAAdditional.includes(p))]);

        // Calculate player ranges
        const minA = [...teamA].reduce((sum, p) => sum + (unitData[p]?.min || 0), 0);
        const maxA = [...teamA].reduce((sum, p) => sum + (unitData[p]?.max || 0), 0);
        const minB = [...teamB].reduce((sum, p) => sum + (unitData[p]?.min || 0), 0);
        const maxB = [...teamB].reduce((sum, p) => sum + (unitData[p]?.max || 0), 0);

        // Calculate gap
        let gap = 0;
        if (maxA < minB) {
          gap = minB - maxA;
        } else if (maxB < minA) {
          gap = minA - maxB;
        }

        const minDiff = Math.abs(minA - minB);
        const avgA = teamA.size > 0 ? (minA + maxA) / 2 : 0;
        const avgB = teamB.size > 0 ? (minB + maxB) / 2 : 0;
        const avgDiff = Math.abs(avgA - avgB);

        // Calculate teammate heat score
        let teammateScore = 0;
        
        const calculatePairScore = (team) => {
          const teamArray = [...team];
          for (let i = 0; i < teamArray.length; i++) {
            for (let j = i + 1; j < teamArray.length; j++) {
              const u1 = teamArray[i];
              const u2 = teamArray[j];
              const count = teammateHistory[u1]?.[u2] || 0;
              teammateScore += count;
              
              // Add penalty for over-teaming
              if (averageTeammateCount > 0 && count > overTeamingThreshold) {
                teammateScore += (count - overTeamingThreshold) * overTeamingPenaltyMultiplier;
              }
            }
          }
        };

        calculatePairScore(teamA);
        calculatePairScore(teamB);

        const currentScore = [gap, minDiff, teammateScore, avgDiff];

        // Compare scores (lexicographic comparison)
        let isBetter = false;
        for (let i = 0; i < currentScore.length; i++) {
          if (currentScore[i] < bestSolution.score[i]) {
            isBetter = true;
            break;
          } else if (currentScore[i] > bestSolution.score[i]) {
            break;
          }
        }

        if (isBetter) {
          bestSolution = {
            score: currentScore,
            teams: [[...teamA], [...teamB]],
            stats: [minA, maxA, minB, maxB]
          };
        }
      }
    }

    // Check if solution is valid
    if (bestSolution.teams) {
      const [gap, minDiff, teammateScore, avgDiff] = bestSolution.score;
      if (gap <= maxPlayerDiff && minDiff <= maxPlayerDiff) {
        const [teamA, teamB] = bestSolution.teams;
        const [minA, maxA, minB, maxB] = bestSolution.stats;
        return { teamA, teamB, score: avgDiff, minA, maxA, minB, maxB };
      } else {
        let msg = `Could not find a balance within the max player difference of ${maxPlayerDiff}.\n`;
        if (gap > maxPlayerDiff) {
          msg += `The best possible balance has a range gap of ${gap.toFixed(0)} players.\n`;
        }
        if (minDiff > maxPlayerDiff) {
          msg += `The best possible balance has a minimums difference of ${minDiff.toFixed(0)} players.\n`;
        }
        alert(msg.trim());
        return null;
      }
    } else {
      alert('No valid team composition could be found with the given constraints.');
      return null;
    }
  };

  const applyBalancerResults = () => {
    if (!balancerResults || !selectedWeek) return;

    const { teamA, teamB } = balancerResults;

    // Save unit counts to the week
    const updatedWeek = {
      ...selectedWeek,
      teamA: teamA,
      teamB: teamB,
      unitPlayerCounts: { ...balancerUnitCounts }
    };

    updateWeek(selectedWeek.id, updatedWeek);
    
    // Also update global unit player counts
    setUnitPlayerCounts(prev => ({
      ...prev,
      ...balancerUnitCounts
    }));

    setShowBalancerModal(false);
    setBalancerResults(null);
  };

  // New Season function
  const newSeason = () => {
    if (!confirm('Start a new season? This will clear all current data (units, weeks, standings, etc.). Make sure to export your current season first!')) {
      return;
    }

    // Reset all state to defaults
    setUnits([]);
    setNonTokenUnits([]);
    setWeeks([]);
    setSelectedWeek(null);
    setTeamNames({ A: 'USA', B: 'CSA' });
    setPointSystem({
      winLead: 4,
      winAssist: 2,
      lossLead: 0,
      lossAssist: 1,
      bonus2_0Lead: 0,
      bonus2_0Assist: 1
    });
    setEloSystem({
      initialElo: 1500,
      kFactorStandard: 96,
      kFactorProvisional: 128,
      provisionalRounds: 10,
      sweepBonusMultiplier: 1.25,
      leadMultiplier: 2.0,
      sizeInfluence: 1.0,
      playoffMultiplier: 1.25
    });
    setEloBiasPercentages({
      lightAttacker: 15,
      heavyAttacker: 30,
      lightDefender: 15,
      heavyDefender: 30
    });
    setUnitPlayerCounts({});
    setManualAdjustments({});
    setDivisions([]);
    setMapBiases(getDefaultMapBiases());
    
    alert('New season started! All data has been cleared.');
  };

  // Export/Import
  const exportData = () => {
    const data = {
      units,
      nonTokenUnits,
      weeks,
      teamNames,
      pointSystem,
      manualAdjustments,
      eloSystem,
      eloBiasPercentages,
      unitPlayerCounts,
      divisions,
      mapBiases,
      exportDate: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `season-tracker-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };
  
  const exportToCSV = () => {
    const stats = calculatePoints();
    const standings = Object.entries(stats)
      .map(([unit, data]) => ({ unit, ...data }))
      .sort((a, b) => b.points - a.points);
    
    let csv = 'Rank,Unit,Points,Lead Wins,Lead Losses,Assist Wins,Assist Losses\n';
    standings.forEach((stat, index) => {
      csv += `${index + 1},${stat.unit},${stat.points},${stat.leadWins},${stat.leadLosses},${stat.assistWins},${stat.assistLosses}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `standings-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importData = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        
        // Handle different JSON formats
        let importedWeeks = data.weeks || data.season || [];
        
        // Transform season data to weeks format if needed
        if (data.season && Array.isArray(data.season)) {
          importedWeeks = data.season.map((week, index) => {
            // Convert string player counts to numbers
            const convertedPlayerCounts = {};
            if (week.unit_player_counts) {
              Object.entries(week.unit_player_counts).forEach(([unit, counts]) => {
                convertedPlayerCounts[unit] = {
                  min: parseInt(counts.min) || 0,
                  max: parseInt(counts.max) || 0
                };
              });
            }

            return {
              id: Date.now() + index,
              name: week.name || `Week ${index + 1}`,
              teamA: week.A || [],
              teamB: week.B || [],
              round1Winner: week.round1_winner || null,
              round2Winner: week.round2_winner || null,
              round1Map: week.round1_map || null,
              round2Map: week.round2_map || null,
              round1Flipped: week.round1_flipped || false,
              round2Flipped: week.round2_flipped || false,
              leadA: week.lead_A || null,
              leadB: week.lead_B || null,
              isPlayoffs: week.playoffs || false,
              leadA_r1: week.lead_A_r1 || null,
              leadB_r1: week.lead_B_r1 || null,
              leadA_r2: week.lead_A_r2 || null,
              leadB_r2: week.lead_B_r2 || null,
              r1CasualtiesA: week.r1_casualties_A || 0,
              r1CasualtiesB: week.r1_casualties_B || 0,
              r2CasualtiesA: week.r2_casualties_A || 0,
              r2CasualtiesB: week.r2_casualties_B || 0,
              unitPlayerCounts: convertedPlayerCounts,
              weeklyCasualties: week.weekly_casualties || {
                USA: { r1: {}, r2: {} },
                CSA: { r1: {}, r2: {} }
              }
            };
          });
        }
        
        // Handle team names
        let importedTeamNames = data.teamNames || { A: 'USA', B: 'CSA' };
        if (data.team_names) {
          importedTeamNames = {
            A: data.team_names.A || 'Team A',
            B: data.team_names.B || 'Team B'
          };
        }
        
        // Handle point system
        let importedPointSystem = data.pointSystem || pointSystem;
        if (data.point_system_values) {
          importedPointSystem = {
            winLead: parseInt(data.point_system_values.win_lead) || 4,
            winAssist: parseInt(data.point_system_values.win_assist) || 2,
            lossLead: parseInt(data.point_system_values.loss_lead) || 0,
            lossAssist: parseInt(data.point_system_values.loss_assist) || 1,
            bonus2_0Lead: parseInt(data.point_system_values.bonus_2_0_lead) || 0,
            bonus2_0Assist: parseInt(data.point_system_values.bonus_2_0_assist) || 1
          };
        }
        
        // Handle manual adjustments
        let importedManualAdjustments = data.manualAdjustments || data.manual_point_adjustments || {};
        
        // Handle Elo system
        let importedEloSystem = data.eloSystem || eloSystem;
        if (data.elo_system_values) {
          importedEloSystem = {
            initialElo: parseInt(data.elo_system_values.initial_elo) || 1500,
            kFactorStandard: parseInt(data.elo_system_values.k_factor_standard) || 96,
            kFactorProvisional: parseInt(data.elo_system_values.k_factor_provisional) || 128,
            provisionalRounds: parseInt(data.elo_system_values.provisional_rounds) || 10,
            sweepBonusMultiplier: parseFloat(data.elo_system_values.sweep_bonus_multiplier) || 1.25,
            leadMultiplier: parseFloat(data.elo_system_values.lead_multiplier) || 2.0,
            sizeInfluence: parseFloat(data.elo_system_values.size_influence) || 1.0,
            playoffMultiplier: parseFloat(data.elo_system_values.playoff_multiplier) || 1.25
          };
        }
        
        // Handle Elo bias percentages
        let importedEloBiasPercentages = data.eloBiasPercentages || eloBiasPercentages;
        if (data.elo_bias_percentages) {
          importedEloBiasPercentages = {
            lightAttacker: parseInt(data.elo_bias_percentages.light_attacker) || 15,
            heavyAttacker: parseInt(data.elo_bias_percentages.heavy_attacker) || 30,
            lightDefender: parseInt(data.elo_bias_percentages.light_defender) || 15,
            heavyDefender: parseInt(data.elo_bias_percentages.heavy_defender) || 30
          };
        }
        
        // Handle unit player counts - convert string values to numbers
        let importedUnitPlayerCounts = {};
        const rawPlayerCounts = data.unitPlayerCounts || data.unit_player_counts || {};
        Object.entries(rawPlayerCounts).forEach(([unit, counts]) => {
          importedUnitPlayerCounts[unit] = {
            min: parseInt(counts.min) || 0,
            max: parseInt(counts.max) || 0
          };
        });
        
        setUnits(data.units || []);
        setNonTokenUnits(data.nonTokenUnits || data.non_token_units || []);
        setWeeks(importedWeeks);
        setTeamNames(importedTeamNames);
        setPointSystem(importedPointSystem);
        setManualAdjustments(importedManualAdjustments);
        setEloSystem(importedEloSystem);
        setEloBiasPercentages(importedEloBiasPercentages);
        setUnitPlayerCounts(importedUnitPlayerCounts);
        
        // Handle divisions
        const importedDivisions = data.divisions || [];
        setDivisions(importedDivisions);
        
        // Handle map biases - convert string values to numbers
        let importedMapBiases = getDefaultMapBiases();
        const rawMapBiases = data.mapBiases || data.map_biases || {};
        Object.entries(rawMapBiases).forEach(([mapName, biasValue]) => {
          importedMapBiases[mapName] = parseFloat(biasValue) || 0;
        });
        setMapBiases(importedMapBiases);
        
        setSelectedWeek(null);
        alert('Data imported successfully!');
      } catch (error) {
        alert('Error importing data: ' + error.message);
      }
    };
    reader.readAsText(file);
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const toggleEnlarge = (section) => {
    setEnlargedSection(enlargedSection === section ? null : section);
  };

  // Compute teammate and opponent stats
  const computeStats = () => {
    const teammate = {};
    const opponent = {};

    weeks.forEach(week => {
      const teamA = week.teamA || [];
      const teamB = week.teamB || [];

      // Teammates in Team A
      teamA.forEach(unit1 => {
        if (!teammate[unit1]) teammate[unit1] = {};
        teamA.forEach(unit2 => {
          if (unit1 !== unit2) {
            teammate[unit1][unit2] = (teammate[unit1][unit2] || 0) + 1;
          }
        });
      });

      // Teammates in Team B
      teamB.forEach(unit1 => {
        if (!teammate[unit1]) teammate[unit1] = {};
        teamB.forEach(unit2 => {
          if (unit1 !== unit2) {
            teammate[unit1][unit2] = (teammate[unit1][unit2] || 0) + 1;
          }
        });
      });

      // Opponents (Team A vs Team B)
      teamA.forEach(unitA => {
        if (!opponent[unitA]) opponent[unitA] = {};
        teamB.forEach(unitB => {
          opponent[unitA][unitB] = (opponent[unitA][unitB] || 0) + 1;
        });
      });

      teamB.forEach(unitB => {
        if (!opponent[unitB]) opponent[unitB] = {};
        teamA.forEach(unitA => {
          opponent[unitB][unitA] = (opponent[unitB][unitA] || 0) + 1;
        });
      });
    });

    return { teammate, opponent };
  };

  // Get detailed interactions with week numbers
  const getDetailedInteractions = () => {
    const interactions = {};

    weeks.forEach((week, weekIdx) => {
      const weekNum = weekIdx + 1;
      const teamA = week.teamA || [];
      const teamB = week.teamB || [];

      // Teammates in Team A
      for (let i = 0; i < teamA.length; i++) {
        for (let j = i + 1; j < teamA.length; j++) {
          const u1 = teamA[i];
          const u2 = teamA[j];
          if (!interactions[u1]) interactions[u1] = {};
          if (!interactions[u1][u2]) interactions[u1][u2] = { teammateWeeks: [], opponentWeeks: [] };
          interactions[u1][u2].teammateWeeks.push(weekNum);

          if (!interactions[u2]) interactions[u2] = {};
          if (!interactions[u2][u1]) interactions[u2][u1] = { teammateWeeks: [], opponentWeeks: [] };
          interactions[u2][u1].teammateWeeks.push(weekNum);
        }
      }

      // Teammates in Team B
      for (let i = 0; i < teamB.length; i++) {
        for (let j = i + 1; j < teamB.length; j++) {
          const u1 = teamB[i];
          const u2 = teamB[j];
          if (!interactions[u1]) interactions[u1] = {};
          if (!interactions[u1][u2]) interactions[u1][u2] = { teammateWeeks: [], opponentWeeks: [] };
          interactions[u1][u2].teammateWeeks.push(weekNum);

          if (!interactions[u2]) interactions[u2] = {};
          if (!interactions[u2][u1]) interactions[u2][u1] = { teammateWeeks: [], opponentWeeks: [] };
          interactions[u2][u1].teammateWeeks.push(weekNum);
        }
      }

      // Opponents (Team A vs Team B)
      teamA.forEach(unitA => {
        teamB.forEach(unitB => {
          if (!interactions[unitA]) interactions[unitA] = {};
          if (!interactions[unitA][unitB]) interactions[unitA][unitB] = { teammateWeeks: [], opponentWeeks: [] };
          interactions[unitA][unitB].opponentWeeks.push(weekNum);

          if (!interactions[unitB]) interactions[unitB] = {};
          if (!interactions[unitB][unitA]) interactions[unitB][unitA] = { teammateWeeks: [], opponentWeeks: [] };
          interactions[unitB][unitA].opponentWeeks.push(weekNum);
        });
      });
    });

    return interactions;
  };

  // Calculate Casualties (inflicted and lost)
  const calculateCasualties = (maxWeekIndex = null) => {
    const inflicted = {};
    const lost = {};
    const c = 5; // Constant for weight calculation

    const weeksToProcess = maxWeekIndex !== null ? weeks.slice(0, maxWeekIndex + 1) : weeks;

    // First pass: aggregate all deaths for each unit
    weeksToProcess.forEach(week => {
      const weeklyCas = week.weeklyCasualties || {};
      const teamAName = teamNames.A;
      const teamBName = teamNames.B;

      [teamAName, teamBName].forEach(teamName => {
        ['r1', 'r2'].forEach(roundKey => {
          const casData = weeklyCas[teamName]?.[roundKey] || {};
          Object.entries(casData).forEach(([unit, deaths]) => {
            if (deaths >= 0) {
              lost[unit] = (lost[unit] || 0) + deaths;
            }
          });
        });
      });
    });

    // Second pass: distribute kills based on weighted formula
    weeksToProcess.forEach((week, weekIdx) => {
      const weeklyCas = week.weeklyCasualties || {};
      if (!weeklyCas || Object.keys(weeklyCas).length === 0) return;

      const teamAName = teamNames.A;
      const teamBName = teamNames.B;

      const distributeKills = (totalDeathsInflicted, friendlyUnitsData, currentWeekIdx) => {
        if (!friendlyUnitsData || Object.keys(friendlyUnitsData).length === 0) return;

        const regiments = Object.entries(friendlyUnitsData).map(([unit, deaths]) => ({
          name: unit,
          men: getUnitAveragePlayerCount(unit, currentWeekIdx),
          deaths: lost[unit] || 0
        }));

        // Compute participation weights
        regiments.forEach(r => {
          const totalUnitDeaths = r.deaths;
          r.weight = r.men * (totalUnitDeaths / (totalUnitDeaths + c));
        });

        // Normalize weights
        const totalWeight = regiments.reduce((sum, r) => sum + (r.weight || 0), 0);
        
        if (totalWeight === 0) {
          // Fallback to even distribution
          if (regiments.length > 0) {
            const killsPerUnit = totalDeathsInflicted / regiments.length;
            regiments.forEach(r => {
              inflicted[r.name] = (inflicted[r.name] || 0) + killsPerUnit;
            });
          }
          return;
        }

        // Assign kills
        regiments.forEach(r => {
          const estKills = totalDeathsInflicted * (r.weight / totalWeight);
          inflicted[r.name] = (inflicted[r.name] || 0) + estKills;
        });
      };

      // Process Round 1
      const usaCasR1 = Object.entries(weeklyCas[teamAName]?.r1 || {}).filter(([, d]) => d >= 0);
      const csaCasR1 = Object.entries(weeklyCas[teamBName]?.r1 || {}).filter(([, d]) => d >= 0);
      const totalUsaDeathsR1 = usaCasR1.reduce((sum, [, d]) => sum + d, 0);
      const totalCsaDeathsR1 = csaCasR1.reduce((sum, [, d]) => sum + d, 0);

      distributeKills(totalUsaDeathsR1, Object.fromEntries(csaCasR1), weekIdx);
      distributeKills(totalCsaDeathsR1, Object.fromEntries(usaCasR1), weekIdx);

      // Process Round 2
      const usaCasR2 = Object.entries(weeklyCas[teamAName]?.r2 || {}).filter(([, d]) => d >= 0);
      const csaCasR2 = Object.entries(weeklyCas[teamBName]?.r2 || {}).filter(([, d]) => d >= 0);
      const totalUsaDeathsR2 = usaCasR2.reduce((sum, [, d]) => sum + d, 0);
      const totalCsaDeathsR2 = csaCasR2.reduce((sum, [, d]) => sum + d, 0);

      distributeKills(totalUsaDeathsR2, Object.fromEntries(csaCasR2), weekIdx);
      distributeKills(totalCsaDeathsR2, Object.fromEntries(usaCasR2), weekIdx);
    });

    return { inflicted, lost };
  };

  // Open Casualty Input Modal
  const openCasualtyModal = () => {
    if (!selectedWeek) {
      alert('Please select a week first');
      return;
    }

    // Initialize casualty input data from existing week data
    const weekIdx = weeks.findIndex(w => w.id === selectedWeek.id);
    const week = weeks[weekIdx];
    const teamAName = teamNames.A;
    const teamBName = teamNames.B;

    const initialData = {
      [teamAName]: { casualties: { r1: {}, r2: {} } },
      [teamBName]: { casualties: { r1: {}, r2: {} } }
    };

    // Populate with existing data
    const existingCasualties = week.weeklyCasualties || {};
    
    // Team A units
    week.teamA.forEach(unit => {
      initialData[teamAName].casualties.r1[unit] = existingCasualties[teamAName]?.r1?.[unit] || 0;
      initialData[teamAName].casualties.r2[unit] = existingCasualties[teamAName]?.r2?.[unit] || 0;
    });

    // Team B units
    week.teamB.forEach(unit => {
      initialData[teamBName].casualties.r1[unit] = existingCasualties[teamBName]?.r1?.[unit] || 0;
      initialData[teamBName].casualties.r2[unit] = existingCasualties[teamBName]?.r2?.[unit] || 0;
    });

    setCasualtyInputData(initialData);
    setShowCasualtyModal(true);
  };

  // Save Casualty Data
  const saveCasualtyData = () => {
    if (!selectedWeek) return;

    const teamAName = teamNames.A;
    const teamBName = teamNames.B;

    // Build weekly casualties structure
    const weeklyCasualties = {
      [teamAName]: {
        r1: casualtyInputData[teamAName]?.casualties?.r1 || {},
        r2: casualtyInputData[teamAName]?.casualties?.r2 || {}
      },
      [teamBName]: {
        r1: casualtyInputData[teamBName]?.casualties?.r1 || {},
        r2: casualtyInputData[teamBName]?.casualties?.r2 || {}
      }
    };

    // Calculate totals
    const r1CasualtiesA = Object.values(weeklyCasualties[teamAName].r1).reduce((sum, val) => sum + (parseInt(val) || 0), 0);
    const r1CasualtiesB = Object.values(weeklyCasualties[teamBName].r1).reduce((sum, val) => sum + (parseInt(val) || 0), 0);
    const r2CasualtiesA = Object.values(weeklyCasualties[teamAName].r2).reduce((sum, val) => sum + (parseInt(val) || 0), 0);
    const r2CasualtiesB = Object.values(weeklyCasualties[teamBName].r2).reduce((sum, val) => sum + (parseInt(val) || 0), 0);

    updateWeek(selectedWeek.id, {
      weeklyCasualties,
      r1CasualtiesA,
      r1CasualtiesB,
      r2CasualtiesA,
      r2CasualtiesB
    });

    setShowCasualtyModal(false);
  };

  // Load Casualties from CSV
  const loadCasualtiesFromCSV = (teamName, roundKey, event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const lines = text.split('\n');
        
        // Skip header row
        const dataLines = lines.slice(1);
        
        // Normalize name for fuzzy matching
        const normalizeName = (name) => {
          return name.replace(/\s/g, '').replace(/-/g, '').toLowerCase();
        };

        // Build normalized lookup map
        const availableUnits = Object.keys(casualtyInputData[teamName]?.casualties?.[roundKey] || {});
        const normalizedMap = {};
        availableUnits.forEach(unit => {
          normalizedMap[normalizeName(unit)] = unit;
        });

        let casualtiesLoaded = 0;
        let playerCountsLoaded = 0;
        const unmatched = [];

        dataLines.forEach(line => {
          const parts = line.split(',').map(p => p.trim());
          if (parts.length < 2) return;

          const csvRegimentName = parts[0];
          if (!csvRegimentName) return;

          const casualties = parseInt(parts[1]);
          if (isNaN(casualties)) return;

          const playerCount = parts.length >= 3 ? parseInt(parts[2]) : null;

          // Try exact match first
          let matchedUnit = null;
          if (availableUnits.includes(csvRegimentName)) {
            matchedUnit = csvRegimentName;
          } else {
            // Try normalized fuzzy match
            const normalizedCsv = normalizeName(csvRegimentName);
            if (normalizedMap[normalizedCsv]) {
              matchedUnit = normalizedMap[normalizedCsv];
            } else {
              unmatched.push(csvRegimentName);
              return;
            }
          }

          // Update casualties
          if (matchedUnit) {
            setCasualtyInputData(prev => ({
              ...prev,
              [teamName]: {
                ...prev[teamName],
                casualties: {
                  ...prev[teamName].casualties,
                  [roundKey]: {
                    ...prev[teamName].casualties[roundKey],
                    [matchedUnit]: casualties
                  }
                }
              }
            }));
            casualtiesLoaded++;

            // Update player counts if available
            if (playerCount !== null && !isNaN(playerCount) && selectedWeek) {
              const weekIdx = weeks.findIndex(w => w.id === selectedWeek.id);
              if (weekIdx !== -1) {
                const updatedWeek = { ...weeks[weekIdx] };
                if (!updatedWeek.unitPlayerCounts) {
                  updatedWeek.unitPlayerCounts = {};
                }
                if (!updatedWeek.unitPlayerCounts[matchedUnit]) {
                  updatedWeek.unitPlayerCounts[matchedUnit] = { min: 0, max: 100 };
                }

                // R1 updates max, R2 updates min
                if (roundKey === 'r1') {
                  updatedWeek.unitPlayerCounts[matchedUnit].max = playerCount;
                } else if (roundKey === 'r2') {
                  updatedWeek.unitPlayerCounts[matchedUnit].min = playerCount;
                }

                // Swap if min > max
                const minVal = parseInt(updatedWeek.unitPlayerCounts[matchedUnit].min);
                const maxVal = parseInt(updatedWeek.unitPlayerCounts[matchedUnit].max);
                if (minVal > maxVal) {
                  updatedWeek.unitPlayerCounts[matchedUnit].min = maxVal;
                  updatedWeek.unitPlayerCounts[matchedUnit].max = minVal;
                }

                setWeeks(weeks.map((w, idx) => idx === weekIdx ? updatedWeek : w));
                playerCountsLoaded++;
              }
            }
          }
        });

        let msg = `Loaded casualties for ${casualtiesLoaded} regiment(s).`;
        if (playerCountsLoaded > 0) {
          msg += `\nLoaded player counts for ${playerCountsLoaded} regiment(s).`;
        }
        if (unmatched.length > 0) {
          msg += `\n\nUnmatched regiments (${unmatched.length}):\n${unmatched.slice(0, 10).join('\n')}`;
          if (unmatched.length > 10) {
            msg += `\n... and ${unmatched.length - 10} more`;
          }
        }

        alert(msg);
      } catch (error) {
        alert('Error loading CSV: ' + error.message);
      }
    };
    reader.readAsText(file);
  };

  // Division Management Functions
  const addDivision = () => {
    const name = prompt('Enter division name:');
    if (!name || !name.trim()) return;
    if (divisions.some(d => d.name === name.trim())) {
      alert('A division with this name already exists!');
      return;
    }
    setDivisions([...divisions, { name: name.trim(), units: [] }]);
  };

  const renameDivision = (oldName, newName) => {
    if (!newName || !newName.trim()) return;
    if (divisions.some(d => d.name === newName.trim() && d.name !== oldName)) {
      alert('A division with this name already exists!');
      return;
    }
    setDivisions(divisions.map(d =>
      d.name === oldName ? { ...d, name: newName.trim() } : d
    ));
  };

  const deleteDivision = (divisionName) => {
    if (!confirm(`Delete division "${divisionName}"?`)) return;
    setDivisions(divisions.filter(d => d.name !== divisionName));
  };

  const addUnitToDivision = (divisionName, unitName) => {
    setDivisions(divisions.map(d => {
      if (d.name === divisionName) {
        if (!d.units.includes(unitName)) {
          return { ...d, units: [...d.units, unitName] };
        }
        return d;
      }
      // Remove from other divisions
      return { ...d, units: d.units.filter(u => u !== unitName) };
    }));
  };

  const removeUnitFromDivision = (divisionName, unitName) => {
    setDivisions(divisions.map(d =>
      d.name === divisionName
        ? { ...d, units: d.units.filter(u => u !== unitName) }
        : d
    ));
  };

  // Get units not assigned to any division
  const getUnassignedUnits = () => {
    const assignedUnits = new Set(divisions.flatMap(d => d.units));
    return units.filter(u => !assignedUnits.has(u));
  };

  // Calculate teammate composition heatmap
  const calculateTeammateHeatmap = () => {
    const { teammate } = computeStats();
    const heatmapData = [];
    
    // Get all units that have played
    const activeUnits = units.filter(unit => {
      return weeks.some(week => 
        week.teamA.includes(unit) || week.teamB.includes(unit)
      );
    }).sort();

    // Build heatmap matrix
    activeUnits.forEach(unit1 => {
      activeUnits.forEach(unit2 => {
        if (unit1 !== unit2) {
          const count = teammate[unit1]?.[unit2] || 0;
          if (count > 0) {
            heatmapData.push({ unit1, unit2, count });
          }
        }
      });
    });

    return { heatmapData, activeUnits };
  };

  // Calculate live preview stats for balancer
  const calculatePreviewStats = (teamA, teamB) => {
    const minA = teamA.reduce((sum, u) => sum + (balancerUnitCounts[u]?.min || 0), 0);
    const maxA = teamA.reduce((sum, u) => sum + (balancerUnitCounts[u]?.max || 0), 0);
    const minB = teamB.reduce((sum, u) => sum + (balancerUnitCounts[u]?.min || 0), 0);
    const maxB = teamB.reduce((sum, u) => sum + (balancerUnitCounts[u]?.max || 0), 0);
    
    const avgA = (minA + maxA) / 2;
    const avgB = (minB + maxB) / 2;
    const avgDiff = Math.abs(avgA - avgB);
    const minDiff = Math.abs(minA - minB);
    
    // Calculate average teammate history for each team
    const { teammate } = computeStats();
    
    const calculateTeamAvgHistory = (team) => {
      if (team.length < 2) return 0;
      
      let totalHistory = 0;
      let pairCount = 0;
      
      for (let i = 0; i < team.length; i++) {
        for (let j = i + 1; j < team.length; j++) {
          const u1 = team[i];
          const u2 = team[j];
          const count = teammate[u1]?.[u2] || 0;
          totalHistory += count;
          pairCount++;
        }
      }
      
      return pairCount > 0 ? totalHistory / pairCount : 0;
    };
    
    const avgHistoryA = calculateTeamAvgHistory(teamA);
    const avgHistoryB = calculateTeamAvgHistory(teamB);
    const combinedAvgHistory = (avgHistoryA + avgHistoryB) / 2;
    
    return { minA, maxA, minB, maxB, avgDiff, minDiff, avgHistoryA, avgHistoryB, combinedAvgHistory };
  };

  // Drag and drop handlers for balancer
  const handleDragStart = (unit, sourceTeam) => {
    setDraggedUnit({ unit, sourceTeam });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (targetTeam) => {
    if (!draggedUnit || !balancerResults) return;
    
    const { unit, sourceTeam } = draggedUnit;
    
    // Don't do anything if dropping on same team
    if (sourceTeam === targetTeam) {
      setDraggedUnit(null);
      return;
    }

    // Create new team arrays
    const newTeamA = sourceTeam === 'A' 
      ? balancerResults.teamA.filter(u => u !== unit)
      : [...balancerResults.teamA, unit];
    
    const newTeamB = sourceTeam === 'B'
      ? balancerResults.teamB.filter(u => u !== unit)
      : [...balancerResults.teamB, unit];

    // Calculate new stats
    const newStats = calculatePreviewStats(newTeamA, newTeamB);
    
    // Update balancer results with new teams and stats
    setBalancerResults({
      teamA: newTeamA,
      teamB: newTeamB,
      score: newStats.avgDiff,
      minA: newStats.minA,
      maxA: newStats.maxA,
      minB: newStats.minB,
      maxB: newStats.maxB,
      avgHistoryA: newStats.avgHistoryA,
      avgHistoryB: newStats.avgHistoryB,
      combinedAvgHistory: newStats.combinedAvgHistory
    });

    setDraggedUnit(null);
  };

  // Main drag and drop handlers for Units list and team rosters
  const handleMainDragStart = (unit, sourceTeam) => {
    setDraggedMainUnit({ unit, sourceTeam });
  };

  const handleMainDragOver = (e) => {
    e.preventDefault();
  };

  const handleMainDrop = (targetTeam) => {
    if (!draggedMainUnit || !selectedWeek) {
      setDraggedMainUnit(null);
      return;
    }
    
    const { unit, sourceTeam } = draggedMainUnit;
    
    // If dropping on the same team, do nothing
    if (sourceTeam === targetTeam) {
      setDraggedMainUnit(null);
      return;
    }
    
    // Move unit to target team
    if (targetTeam === 'A' || targetTeam === 'B') {
      moveUnitToTeam(unit, targetTeam);
    }
    
    setDraggedMainUnit(null);
  };

  const handleMainDropToUnassigned = () => {
    if (!draggedMainUnit || !selectedWeek) {
      setDraggedMainUnit(null);
      return;
    }
    
    const { unit, sourceTeam } = draggedMainUnit;
    
    // Remove from team if it was in one
    if (sourceTeam === 'A' || sourceTeam === 'B') {
      removeUnitFromTeam(unit, sourceTeam);
    }
    
    setDraggedMainUnit(null);
  };

  // Get units available for the selected week (not assigned to either team)
  const getAvailableUnitsForWeek = () => {
    if (!selectedWeek) return units;
    
    const assignedUnits = new Set([...selectedWeek.teamA, ...selectedWeek.teamB]);
    return units.filter(u => !assignedUnits.has(u));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-slate-800 rounded-lg shadow-2xl border border-slate-700 p-8">
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-4xl font-bold text-amber-400 mb-2 flex items-center gap-3">
                <Trophy className="w-10 h-10" />
                War of Rights Season Tracker
              </h1>
              <p className="text-slate-400">Track regiment performance across the season</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={newSeason}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition"
                title="Start New Season"
              >
                <Plus className="w-4 h-4" />
                New Season
              </button>
              <button
                onClick={exportData}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition"
                title="Export JSON"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
              <button
                onClick={exportToCSV}
                className="flex items-center gap-2 px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg transition"
                title="Export CSV"
              >
                <Download className="w-4 h-4" />
                CSV
              </button>
              <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition cursor-pointer">
                <Upload className="w-4 h-4" />
                Import
                <input
                  type="file"
                  accept=".json"
                  onChange={importData}
                  className="hidden"
                />
              </label>
              <button
                onClick={() => setShowStatsModal(!showStatsModal)}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition"
              >
                <BarChart3 className="w-4 h-4" />
                Stats
              </button>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition"
              >
                <Settings className="w-4 h-4" />
                Settings
              </button>
            </div>
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <div className="bg-slate-700 rounded-lg p-6 mb-6">
              <h2 className="text-2xl font-bold text-amber-400 mb-4">System Settings</h2>
              
              {/* Point System Section */}
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-amber-300 mb-3">Point System</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Win Lead Points</label>
                  <input
                    type="number"
                    value={pointSystem.winLead}
                    onChange={(e) => setPointSystem({ ...pointSystem, winLead: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-800 text-white rounded border border-slate-600 focus:border-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Win Assist Points</label>
                  <input
                    type="number"
                    value={pointSystem.winAssist}
                    onChange={(e) => setPointSystem({ ...pointSystem, winAssist: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-800 text-white rounded border border-slate-600 focus:border-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Loss Lead Points</label>
                  <input
                    type="number"
                    value={pointSystem.lossLead}
                    onChange={(e) => setPointSystem({ ...pointSystem, lossLead: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-800 text-white rounded border border-slate-600 focus:border-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Loss Assist Points</label>
                  <input
                    type="number"
                    value={pointSystem.lossAssist}
                    onChange={(e) => setPointSystem({ ...pointSystem, lossAssist: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-800 text-white rounded border border-slate-600 focus:border-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">2-0 Bonus Lead</label>
                  <input
                    type="number"
                    value={pointSystem.bonus2_0Lead}
                    onChange={(e) => setPointSystem({ ...pointSystem, bonus2_0Lead: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-800 text-white rounded border border-slate-600 focus:border-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">2-0 Bonus Assist</label>
                  <input
                    type="number"
                    value={pointSystem.bonus2_0Assist}
                    onChange={(e) => setPointSystem({ ...pointSystem, bonus2_0Assist: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-800 text-white rounded border border-slate-600 focus:border-amber-500 outline-none"
                  />
                </div>
                </div>
              </div>

              {/* Elo System Section */}
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-amber-300 mb-3 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Elo Rating System
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-slate-300 mb-1">Initial Elo</label>
                    <input
                      type="number"
                      value={eloSystem.initialElo}
                      onChange={(e) => setEloSystem({ ...eloSystem, initialElo: parseInt(e.target.value) || 1500 })}
                      className="w-full px-3 py-2 bg-slate-800 text-white rounded border border-slate-600 focus:border-amber-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-300 mb-1">Standard K-Factor</label>
                    <input
                      type="number"
                      value={eloSystem.kFactorStandard}
                      onChange={(e) => setEloSystem({ ...eloSystem, kFactorStandard: parseInt(e.target.value) || 96 })}
                      className="w-full px-3 py-2 bg-slate-800 text-white rounded border border-slate-600 focus:border-amber-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-300 mb-1">Provisional K-Factor</label>
                    <input
                      type="number"
                      value={eloSystem.kFactorProvisional}
                      onChange={(e) => setEloSystem({ ...eloSystem, kFactorProvisional: parseInt(e.target.value) || 128 })}
                      className="w-full px-3 py-2 bg-slate-800 text-white rounded border border-slate-600 focus:border-amber-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-300 mb-1">Provisional Rounds</label>
                    <input
                      type="number"
                      value={eloSystem.provisionalRounds}
                      onChange={(e) => setEloSystem({ ...eloSystem, provisionalRounds: parseInt(e.target.value) || 10 })}
                      className="w-full px-3 py-2 bg-slate-800 text-white rounded border border-slate-600 focus:border-amber-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-300 mb-1">Sweep Bonus (×)</label>
                    <input
                      type="number"
                      step="0.05"
                      value={eloSystem.sweepBonusMultiplier}
                      onChange={(e) => setEloSystem({ ...eloSystem, sweepBonusMultiplier: parseFloat(e.target.value) || 1.25 })}
                      className="w-full px-3 py-2 bg-slate-800 text-white rounded border border-slate-600 focus:border-amber-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-300 mb-1">Lead Multiplier (×)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={eloSystem.leadMultiplier}
                      onChange={(e) => setEloSystem({ ...eloSystem, leadMultiplier: parseFloat(e.target.value) || 2.0 })}
                      className="w-full px-3 py-2 bg-slate-800 text-white rounded border border-slate-600 focus:border-amber-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-300 mb-1">Size Influence</label>
                    <input
                      type="number"
                      step="0.1"
                      value={eloSystem.sizeInfluence}
                      onChange={(e) => setEloSystem({ ...eloSystem, sizeInfluence: parseFloat(e.target.value) || 1.0 })}
                      className="w-full px-3 py-2 bg-slate-800 text-white rounded border border-slate-600 focus:border-amber-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-300 mb-1">Playoff Multiplier (×)</label>
                    <input
                      type="number"
                      step="0.05"
                      value={eloSystem.playoffMultiplier}
                      onChange={(e) => setEloSystem({ ...eloSystem, playoffMultiplier: parseFloat(e.target.value) || 1.25 })}
                      className="w-full px-3 py-2 bg-slate-800 text-white rounded border border-slate-600 focus:border-amber-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Elo Bias Percentages */}
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-amber-300 mb-3">Map Bias Elo Multipliers (%)</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm text-slate-300 mb-1">Light Attacker %</label>
                    <input
                      type="number"
                      value={eloBiasPercentages.lightAttacker}
                      onChange={(e) => setEloBiasPercentages({ ...eloBiasPercentages, lightAttacker: parseInt(e.target.value) || 15 })}
                      className="w-full px-3 py-2 bg-slate-800 text-white rounded border border-slate-600 focus:border-amber-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-300 mb-1">Heavy Attacker %</label>
                    <input
                      type="number"
                      value={eloBiasPercentages.heavyAttacker}
                      onChange={(e) => setEloBiasPercentages({ ...eloBiasPercentages, heavyAttacker: parseInt(e.target.value) || 30 })}
                      className="w-full px-3 py-2 bg-slate-800 text-white rounded border border-slate-600 focus:border-amber-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-300 mb-1">Light Defender %</label>
                    <input
                      type="number"
                      value={eloBiasPercentages.lightDefender}
                      onChange={(e) => setEloBiasPercentages({ ...eloBiasPercentages, lightDefender: parseInt(e.target.value) || 15 })}
                      className="w-full px-3 py-2 bg-slate-800 text-white rounded border border-slate-600 focus:border-amber-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-300 mb-1">Heavy Defender %</label>
                    <input
                      type="number"
                      value={eloBiasPercentages.heavyDefender}
                      onChange={(e) => setEloBiasPercentages({ ...eloBiasPercentages, heavyDefender: parseInt(e.target.value) || 30 })}
                      className="w-full px-3 py-2 bg-slate-800 text-white rounded border border-slate-600 focus:border-amber-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Division and Map Bias Management Buttons */}
              <div className="mt-6 flex gap-4">
                <button
                  onClick={() => setShowDivisionModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition"
                >
                  <Users className="w-4 h-4" />
                  Manage Divisions
                </button>
                <button
                  onClick={() => setShowMapBiasModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition"
                >
                  <Map className="w-4 h-4" />
                  Configure Map Biases
                </button>
              </div>
            </div>
          )}

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Weeks */}
            <div className="bg-slate-700 rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
                  <Calendar className="w-6 h-6" />
                  Weeks ({weeks.length})
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleEnlarge('weeks')}
                    className="p-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition"
                    title="Enlarge View"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={addWeek}
                    className="p-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition"
                    title="Add Week"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {weeks.map((week) => (
                  <div
                    key={week.id}
                    className={`p-4 rounded-lg transition cursor-pointer ${
                      selectedWeek?.id === week.id
                        ? 'bg-amber-600 text-white'
                        : 'bg-slate-600 text-slate-200 hover:bg-slate-500'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      {editingWeek === week.id ? (
                        <input
                          type="text"
                          defaultValue={week.name}
                          onBlur={(e) => renameWeek(week.id, e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              renameWeek(week.id, e.target.value);
                            }
                          }}
                          className="flex-1 px-2 py-1 bg-slate-800 text-white rounded border border-slate-500 outline-none"
                          autoFocus
                        />
                      ) : (
                        <div
                          onClick={() => setSelectedWeek(week)}
                          className="flex-1"
                        >
                          <div className="font-semibold">{week.name}</div>
                          <div className="text-sm opacity-75">
                            {week.teamA.length + week.teamB.length} units assigned
                          </div>
                        </div>
                      )}
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingWeek(week.id);
                          }}
                          className="p-1 hover:bg-slate-700 rounded transition"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeWeek(week.id);
                          }}
                          className="p-1 hover:bg-red-600 rounded transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Middle Column - Units */}
            <div
              className="bg-slate-700 rounded-lg p-6"
              onDragOver={handleMainDragOver}
              onDrop={handleMainDropToUnassigned}
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
                  <Users className="w-6 h-6" />
                  {selectedWeek ? `Available Units (${getAvailableUnitsForWeek().length})` : `Units (${units.length})`}
                </h2>
                <button
                  onClick={() => toggleEnlarge('units')}
                  className="p-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition"
                  title="Enlarge View"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>
              <div className="mb-4 flex gap-2">
                <input
                  type="text"
                  value={newUnitName}
                  onChange={(e) => setNewUnitName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addUnit()}
                  placeholder="Unit name..."
                  className="flex-1 px-3 py-2 bg-slate-800 text-white rounded border border-slate-600 focus:border-amber-500 outline-none"
                />
                <button
                  onClick={addUnit}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {selectedWeek && getAvailableUnitsForWeek().length > 0 && (
                <div className="mb-2 text-xs text-slate-400 bg-slate-600 rounded p-2">
                  💡 Drag units to teams or use A/B buttons
                </div>
              )}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {(selectedWeek ? getAvailableUnitsForWeek() : units).map((unit) => {
                  const isNonToken = nonTokenUnits.includes(unit);
                  return (
                    <div
                      key={unit}
                      draggable={selectedWeek ? true : false}
                      onDragStart={() => selectedWeek && handleMainDragStart(unit, null)}
                      className={`flex justify-between items-center p-3 bg-slate-600 rounded-lg ${
                        selectedWeek ? 'cursor-move hover:bg-slate-500' : ''
                      } transition`}
                    >
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleNonTokenStatus(unit)}
                          className={`px-2 py-1 rounded text-xs font-bold transition ${
                            isNonToken
                              ? 'bg-amber-600 hover:bg-amber-700 text-white'
                              : 'bg-slate-700 hover:bg-slate-600 text-slate-400'
                          }`}
                          title={isNonToken ? "Non-token unit (click to toggle)" : "Token unit (click to toggle)"}
                        >
                          {isNonToken ? '*' : '○'}
                        </button>
                        <span className={`font-medium ${isNonToken ? 'text-amber-400' : 'text-white'}`}>
                          {unit}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        {selectedWeek && (
                          <>
                            <button
                              onClick={() => moveUnitToTeam(unit, 'A')}
                              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition"
                              title={`Add to ${teamNames.A}`}
                            >
                              → A
                            </button>
                            <button
                              onClick={() => moveUnitToTeam(unit, 'B')}
                              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition"
                              title={`Add to ${teamNames.B}`}
                            >
                              → B
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => removeUnit(unit)}
                          className="p-1 hover:bg-red-600 rounded transition"
                        >
                          <Trash2 className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    </div>
                  );
                })}
             </div>
            </div>

            {/* Right Column - Standings */}
            <div className="bg-slate-700 rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
                  <Award className="w-6 h-6" />
                  Standings
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleEnlarge('standings')}
                    className="p-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition"
                    title="Enlarge View"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setRankByElo(!rankByElo)}
                    className="px-3 py-1 bg-cyan-600 hover:bg-cyan-700 text-white rounded text-sm transition flex items-center gap-1"
                    title={rankByElo ? "Rank by Points" : "Rank by Elo"}
                  >
                    <TrendingUp className="w-3 h-3" />
                    {rankByElo ? "Elo" : "Points"}
                  </button>
                  {divisions && divisions.length > 0 && (
                    <button
                      onClick={() => setShowGroupedStandings(!showGroupedStandings)}
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm transition flex items-center gap-1"
                      title={showGroupedStandings ? "Show All" : "Group by Division"}
                    >
                      {showGroupedStandings ? <Users className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                      {showGroupedStandings ? "Grouped" : "All"}
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {showGroupedStandings && divisions && divisions.length > 0 ? (
                  // Grouped view by division
                  getGroupedStandings().map((group) => (
                    <div key={group.name} className="mb-4">
                      <h3 className="text-sm font-bold text-amber-300 mb-2 px-2 flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        {group.name}
                      </h3>
                      <div className="space-y-2">
                        {group.units.map((stat) => {
                          const isNonToken = nonTokenUnits.includes(stat.unit);
                          return (
                            <div
                              key={stat.unit}
                              className="bg-slate-600 rounded-lg p-3"
                            >
                              <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-amber-400 font-bold text-lg">
                                    #{stat.divisionRank || stat.currentRank}
                                  </span>
                                {stat.rankDelta !== null && stat.rankDelta !== undefined && (
                                  <span className={`text-xs font-semibold ${
                                    stat.rankDelta > 0 ? 'text-green-400' :
                                    stat.rankDelta < 0 ? 'text-red-400' :
                                    'text-slate-400'
                                  }`}>
                                    {stat.rankDelta > 0 ? `↑${stat.rankDelta}` :
                                     stat.rankDelta < 0 ? `↓${Math.abs(stat.rankDelta)}` :
                                     '−'}
                                  </span>
                                )}
                                <span className={`font-semibold ${isNonToken ? 'text-amber-400' : 'text-white'}`}>
                                  {isNonToken ? '*' : ''}{stat.unit}
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1 text-xs">
                                  {stat.eloDelta > 0 ? (
                                    <TrendingUp className="w-3 h-3 text-blue-400" />
                                  ) : stat.eloDelta < 0 ? (
                                    <TrendingUp className="w-3 h-3 text-red-400 transform rotate-180" />
                                  ) : (
                                    <span className="w-3 h-3 text-yellow-400 flex items-center justify-center text-lg leading-none">−</span>
                                  )}
                                  <span className="text-cyan-400 font-semibold">
                                    {Math.round(stat.elo)}
                                  </span>
                                  {stat.eloDelta !== undefined && stat.eloDelta !== 0 && (
                                    <span className={`ml-1 ${
                                      stat.eloDelta > 0 ? 'text-green-400' : 'text-red-400'
                                    }`}>
                                      ({stat.eloDelta > 0 ? '+' : ''}{Math.round(stat.eloDelta)})
                                    </span>
                                  )}
                                </div>
                                <button
                                  onClick={() => {
                                    const current = manualAdjustments[stat.unit] || 0;
                                    const adjustment = prompt(`Manual adjustment for ${stat.unit}:`, current);
                                    if (adjustment !== null) {
                                      const newAdj = parseInt(adjustment) || 0;
                                      setManualAdjustments({
                                        ...manualAdjustments,
                                        [stat.unit]: newAdj
                                      });
                                    }
                                  }}
                                  className="p-1 hover:bg-slate-700 rounded transition"
                                  title="Adjust points"
                                >
                                  <Edit2 className="w-3 h-3 text-slate-400" />
                                </button>
                                <span className="text-green-400 font-bold text-xl">
                                  {stat.points}
                                </span>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                              <div>L-Wins: {stat.leadWins}</div>
                              <div>L-Loss: {stat.leadLosses}</div>
                              <div>A-Wins: {stat.assistWins}</div>
                              <div>A-Loss: {stat.assistLosses}</div>
                              <div className="col-span-2 text-cyan-300">
                                Elo: {Math.round(stat.elo)} ({stat.rounds} rounds)
                              </div>
                            </div>
                            {manualAdjustments[stat.unit] && (
                              <div className="mt-1 text-xs text-amber-400">
                                Manual: {manualAdjustments[stat.unit] > 0 ? '+' : ''}{manualAdjustments[stat.unit]}
                              </div>
                            )}
                          </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                ) : (
                  // Ungrouped view - all units with delta indicators
                  getStandingsWithChanges().map((stat, index) => {
                    const isNonToken = nonTokenUnits.includes(stat.unit);
                    return (
                      <div
                        key={stat.unit}
                        className="bg-slate-600 rounded-lg p-3"
                      >
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-amber-400 font-bold text-lg">
                              #{index + 1}
                            </span>
                          {stat.rankDelta !== null && stat.rankDelta !== undefined && (
                            <span className={`text-xs font-semibold ${
                              stat.rankDelta > 0 ? 'text-green-400' :
                              stat.rankDelta < 0 ? 'text-red-400' :
                              'text-slate-400'
                            }`}>
                              {stat.rankDelta > 0 ? `↑${stat.rankDelta}` :
                               stat.rankDelta < 0 ? `↓${Math.abs(stat.rankDelta)}` :
                               '−'}
                            </span>
                          )}
                          <span className={`font-semibold ${isNonToken ? 'text-amber-400' : 'text-white'}`}>
                            {isNonToken ? '*' : ''}{stat.unit}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1 text-xs">
                            {stat.eloDelta > 0 ? (
                              <TrendingUp className="w-3 h-3 text-blue-400" />
                            ) : stat.eloDelta < 0 ? (
                              <TrendingUp className="w-3 h-3 text-red-400 transform rotate-180" />
                            ) : (
                              <span className="w-3 h-3 text-yellow-400 flex items-center justify-center text-lg leading-none">−</span>
                            )}
                            <span className="text-cyan-400 font-semibold">
                              {Math.round(stat.elo)}
                            </span>
                            {stat.eloDelta !== undefined && stat.eloDelta !== 0 && (
                              <span className={`ml-1 ${
                                stat.eloDelta > 0 ? 'text-green-400' : 'text-red-400'
                              }`}>
                                ({stat.eloDelta > 0 ? '+' : ''}{Math.round(stat.eloDelta)})
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              const current = manualAdjustments[stat.unit] || 0;
                              const adjustment = prompt(`Manual adjustment for ${stat.unit}:`, current);
                              if (adjustment !== null) {
                                const newAdj = parseInt(adjustment) || 0;
                                setManualAdjustments({
                                  ...manualAdjustments,
                                  [stat.unit]: newAdj
                                });
                              }
                            }}
                            className="p-1 hover:bg-slate-700 rounded transition"
                            title="Adjust points"
                          >
                            <Edit2 className="w-3 h-3 text-slate-400" />
                          </button>
                          <span className="text-green-400 font-bold text-xl">
                            {stat.points}
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                        <div>L-Wins: {stat.leadWins}</div>
                        <div>L-Loss: {stat.leadLosses}</div>
                        <div>A-Wins: {stat.assistWins}</div>
                        <div>A-Loss: {stat.assistLosses}</div>
                        <div className="col-span-2 text-cyan-300">
                          Elo: {Math.round(stat.elo)} ({stat.rounds} rounds)
                        </div>
                      </div>
                      {manualAdjustments[stat.unit] && (
                        <div className="mt-1 text-xs text-amber-400">
                          Manual: {manualAdjustments[stat.unit] > 0 ? '+' : ''}{manualAdjustments[stat.unit]}
                        </div>
                      )}
                    </div>
                    );
                  })
               )}
             </div>
            </div>
          </div>

          {/* Week Details */}
          {selectedWeek && (
            <div className="mt-6 bg-slate-700 rounded-lg p-6">
              <h2 className="text-2xl font-bold text-amber-400 mb-4">
                {selectedWeek.name} - Team Rosters
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Team A */}
                <div
                  className="bg-slate-600 rounded-lg p-4 min-h-[200px]"
                  onDragOver={handleMainDragOver}
                  onDrop={() => handleMainDrop('A')}
                >
                  <div className="mb-3">
                    <input
                      type="text"
                      value={teamNames.A}
                      onChange={(e) => setTeamNames({ ...teamNames, A: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-800 text-white text-center font-bold text-lg rounded border border-slate-500 focus:border-amber-500 outline-none"
                    />
                  </div>
                  {selectedWeek.teamA.length === 0 && (
                    <div className="text-center text-slate-400 py-8 border-2 border-dashed border-slate-500 rounded">
                      Drop units here or use → A button
                    </div>
                  )}
                  <div className="space-y-2">
                    {selectedWeek.teamA.map((unit) => {
                      // Calculate Elo and TII up to the week BEFORE this one
                      const currentWeekIdx = weeks.findIndex(w => w.id === selectedWeek.id);
                      const previousWeekIdx = currentWeekIdx - 1;
                      
                      // Get Elo from previous week (or initial if first week)
                      const { eloRatings } = previousWeekIdx >= 0
                        ? calculateEloRatings(previousWeekIdx)
                        : { eloRatings: {} };
                      const unitElo = eloRatings[unit] || eloSystem.initialElo;
                      
                      // Get TII from previous week (or 0 if first week)
                      const { impactStats } = previousWeekIdx >= 0
                        ? calculateTeammateImpact(previousWeekIdx)
                        : { impactStats: {} };
                      const unitTii = impactStats[unit]?.adjustedTiiScore || 0;
                      
                      return (
                        <div
                          key={unit}
                          draggable
                          onDragStart={() => handleMainDragStart(unit, 'A')}
                          className="flex justify-between items-center p-2 bg-slate-700 rounded cursor-move hover:bg-slate-600 transition"
                        >
                          <div className="flex flex-col">
                            <span className="text-white font-medium">{unit}</span>
                            <span className="text-xs text-slate-400">
                              Elo: {Math.round(unitElo)} | TII: {unitTii.toFixed(3)}
                            </span>
                          </div>
                          <button
                            onClick={() => removeUnitFromTeam(unit, 'A')}
                            className="p-1 hover:bg-red-600 rounded transition"
                          >
                            <X className="w-4 h-4 text-white" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {!selectedWeek.isPlayoffs && (
                    <div className="mt-3">
                      <label className="block text-sm text-slate-300 mb-1">Lead Unit</label>
                      <select
                        value={selectedWeek.leadA || ''}
                        onChange={(e) => updateWeek(selectedWeek.id, { leadA: e.target.value || null })}
                        className="w-full px-3 py-2 bg-slate-800 text-white rounded border border-slate-500 focus:border-amber-500 outline-none"
                      >
                        <option value="">Select lead...</option>
                        {selectedWeek.teamA.map((unit) => (
                          <option key={unit} value={unit}>{unit}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Team B */}
                <div
                  className="bg-slate-600 rounded-lg p-4 min-h-[200px]"
                  onDragOver={handleMainDragOver}
                  onDrop={() => handleMainDrop('B')}
                >
                  <div className="mb-3">
                    <input
                      type="text"
                      value={teamNames.B}
                      onChange={(e) => setTeamNames({ ...teamNames, B: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-800 text-white text-center font-bold text-lg rounded border border-slate-500 focus:border-amber-500 outline-none"
                    />
                  </div>
                  {selectedWeek.teamB.length === 0 && (
                    <div className="text-center text-slate-400 py-8 border-2 border-dashed border-slate-500 rounded">
                      Drop units here or use → B button
                    </div>
                  )}
                  <div className="space-y-2">
                    {selectedWeek.teamB.map((unit) => {
                      // Calculate Elo and TII up to the week BEFORE this one
                      const currentWeekIdx = weeks.findIndex(w => w.id === selectedWeek.id);
                      const previousWeekIdx = currentWeekIdx - 1;
                      
                      // Get Elo from previous week (or initial if first week)
                      const { eloRatings } = previousWeekIdx >= 0
                        ? calculateEloRatings(previousWeekIdx)
                        : { eloRatings: {} };
                      const unitElo = eloRatings[unit] || eloSystem.initialElo;
                      
                      // Get TII from previous week (or 0 if first week)
                      const { impactStats } = previousWeekIdx >= 0
                        ? calculateTeammateImpact(previousWeekIdx)
                        : { impactStats: {} };
                      const unitTii = impactStats[unit]?.adjustedTiiScore || 0;
                      
                      return (
                        <div
                          key={unit}
                          draggable
                          onDragStart={() => handleMainDragStart(unit, 'B')}
                          className="flex justify-between items-center p-2 bg-slate-700 rounded cursor-move hover:bg-slate-600 transition"
                        >
                          <div className="flex flex-col">
                            <span className="text-white font-medium">{unit}</span>
                            <span className="text-xs text-slate-400">
                              Elo: {Math.round(unitElo)} | TII: {unitTii.toFixed(3)}
                            </span>
                          </div>
                          <button
                            onClick={() => removeUnitFromTeam(unit, 'B')}
                            className="p-1 hover:bg-red-600 rounded transition"
                          >
                            <X className="w-4 h-4 text-white" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {!selectedWeek.isPlayoffs && (
                    <div className="mt-3">
                      <label className="block text-sm text-slate-300 mb-1">Lead Unit</label>
                      <select
                        value={selectedWeek.leadB || ''}
                        onChange={(e) => updateWeek(selectedWeek.id, { leadB: e.target.value || null })}
                        className="w-full px-3 py-2 bg-slate-800 text-white rounded border border-slate-500 focus:border-amber-500 outline-none"
                      >
                        <option value="">Select lead...</option>
                        {selectedWeek.teamB.map((unit) => (
                          <option key={unit} value={unit}>{unit}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Playoffs Toggle */}
              <div className="mb-4">
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedWeek.isPlayoffs || false}
                    onChange={(e) => updateWeek(selectedWeek.id, { isPlayoffs: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-500 bg-slate-800 text-amber-500 focus:ring-amber-500"
                  />
                  <Star className="w-4 h-4" />
                  <span className="font-semibold">Playoffs Week</span>
                </label>
              </div>

              {/* Playoffs Lead Selection */}
              {selectedWeek.isPlayoffs && (
                <div className="mb-6 bg-slate-600 rounded-lg p-4">
                  <h3 className="text-lg font-bold text-amber-400 mb-3">Playoff Round Leads</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-slate-300 mb-1">R1 Lead {teamNames.A}</label>
                      <select
                        value={selectedWeek.leadA_r1 || ''}
                        onChange={(e) => updateWeek(selectedWeek.id, { leadA_r1: e.target.value || null })}
                        className="w-full px-3 py-2 bg-slate-800 text-white rounded border border-slate-500 focus:border-amber-500 outline-none text-sm"
                      >
                        <option value="">Select...</option>
                        {selectedWeek.teamA.map((unit) => (
                          <option key={unit} value={unit}>{unit}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-slate-300 mb-1">R1 Lead {teamNames.B}</label>
                      <select
                        value={selectedWeek.leadB_r1 || ''}
                        onChange={(e) => updateWeek(selectedWeek.id, { leadB_r1: e.target.value || null })}
                        className="w-full px-3 py-2 bg-slate-800 text-white rounded border border-slate-500 focus:border-amber-500 outline-none text-sm"
                      >
                        <option value="">Select...</option>
                        {selectedWeek.teamB.map((unit) => (
                          <option key={unit} value={unit}>{unit}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-slate-300 mb-1">R2 Lead {teamNames.A}</label>
                      <select
                        value={selectedWeek.leadA_r2 || ''}
                        onChange={(e) => updateWeek(selectedWeek.id, { leadA_r2: e.target.value || null })}
                        className="w-full px-3 py-2 bg-slate-800 text-white rounded border border-slate-500 focus:border-amber-500 outline-none text-sm"
                      >
                        <option value="">Select...</option>
                        {selectedWeek.teamA.map((unit) => (
                          <option key={unit} value={unit}>{unit}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-slate-300 mb-1">R2 Lead {teamNames.B}</label>
                      <select
                        value={selectedWeek.leadB_r2 || ''}
                        onChange={(e) => updateWeek(selectedWeek.id, { leadB_r2: e.target.value || null })}
                        className="w-full px-3 py-2 bg-slate-800 text-white rounded border border-slate-500 focus:border-amber-500 outline-none text-sm"
                      >
                        <option value="">Select...</option>
                        {selectedWeek.teamB.map((unit) => (
                          <option key={unit} value={unit}>{unit}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Round Results with Maps */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {/* Round 1 */}
                <div className="bg-slate-600 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-amber-400 mb-3 flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    Round 1
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm text-slate-300 mb-1">Map</label>
                      <select
                        value={selectedWeek.round1Map || ''}
                        onChange={(e) => updateWeek(selectedWeek.id, { round1Map: e.target.value || null })}
                        className="w-full px-3 py-2 bg-slate-800 text-white rounded border border-slate-500 focus:border-amber-500 outline-none text-sm"
                      >
                        <option value="">Select map...</option>
                        {ALL_MAPS.map((map) => (
                          <option key={map} value={map}>{map}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedWeek.round1Flipped || false}
                          onChange={(e) => updateWeek(selectedWeek.id, { round1Flipped: e.target.checked })}
                          className="w-4 h-4 rounded border-slate-500 bg-slate-800"
                        />
                        <span className="text-sm">Flipped</span>
                      </label>
                    </div>
                    <div>
                      <label className="block text-sm text-slate-300 mb-1">Winner</label>
                      <select
                        value={selectedWeek.round1Winner || ''}
                        onChange={(e) => updateWeek(selectedWeek.id, { round1Winner: e.target.value || null })}
                        className="w-full px-3 py-2 bg-slate-800 text-white rounded border border-slate-500 focus:border-amber-500 outline-none"
                      >
                        <option value="">No winner</option>
                        <option value="A">{teamNames.A}</option>
                        <option value="B">{teamNames.B}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-slate-300 mb-1">Casualties {teamNames.A}</label>
                      <input
                        type="number"
                        value={selectedWeek.r1CasualtiesA || 0}
                        onChange={(e) => updateWeek(selectedWeek.id, { r1CasualtiesA: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 bg-slate-800 text-white rounded border border-slate-500 focus:border-amber-500 outline-none text-sm"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-300 mb-1">Casualties {teamNames.B}</label>
                      <input
                        type="number"
                        value={selectedWeek.r1CasualtiesB || 0}
                        onChange={(e) => updateWeek(selectedWeek.id, { r1CasualtiesB: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 bg-slate-800 text-white rounded border border-slate-500 focus:border-amber-500 outline-none text-sm"
                        min="0"
                      />
                    </div>
                  </div>
                </div>

                {/* Round 2 */}
                <div className="bg-slate-600 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-amber-400 mb-3 flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    Round 2
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm text-slate-300 mb-1">Map</label>
                      <select
                        value={selectedWeek.round2Map || ''}
                        onChange={(e) => updateWeek(selectedWeek.id, { round2Map: e.target.value || null })}
                        className="w-full px-3 py-2 bg-slate-800 text-white rounded border border-slate-500 focus:border-amber-500 outline-none text-sm"
                      >
                        <option value="">Select map...</option>
                        {ALL_MAPS.map((map) => (
                          <option key={map} value={map}>{map}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedWeek.round2Flipped || false}
                          onChange={(e) => updateWeek(selectedWeek.id, { round2Flipped: e.target.checked })}
                          className="w-4 h-4 rounded border-slate-500 bg-slate-800"
                        />
                        <span className="text-sm">Flipped</span>
                      </label>
                    </div>
                    <div>
                      <label className="block text-sm text-slate-300 mb-1">Winner</label>
                      <select
                        value={selectedWeek.round2Winner || ''}
                        onChange={(e) => updateWeek(selectedWeek.id, { round2Winner: e.target.value || null })}
                        className="w-full px-3 py-2 bg-slate-800 text-white rounded border border-slate-500 focus:border-amber-500 outline-none"
                      >
                        <option value="">No winner</option>
                        <option value="A">{teamNames.A}</option>
                        <option value="B">{teamNames.B}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-slate-300 mb-1">Casualties {teamNames.A}</label>
                      <input
                        type="number"
                        value={selectedWeek.r2CasualtiesA || 0}
                        onChange={(e) => updateWeek(selectedWeek.id, { r2CasualtiesA: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 bg-slate-800 text-white rounded border border-slate-500 focus:border-amber-500 outline-none text-sm"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-300 mb-1">Casualties {teamNames.B}</label>
                      <input
                        type="number"
                        value={selectedWeek.r2CasualtiesB || 0}
                        onChange={(e) => updateWeek(selectedWeek.id, { r2CasualtiesB: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 bg-slate-800 text-white rounded border border-slate-500 focus:border-amber-500 outline-none text-sm"
                        min="0"
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="mt-4 space-y-2">
                <button
                  onClick={openBalancerModal}
                  disabled={!selectedWeek}
                  className={`w-full px-4 py-3 rounded-lg transition flex items-center justify-center gap-2 ${
                    selectedWeek
                      ? 'bg-purple-600 hover:bg-purple-700 text-white'
                      : 'bg-slate-600 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Target className="w-5 h-5" />
                  <span className="font-semibold">Team Balancer</span>
                </button>
                <button
                  onClick={openCasualtyModal}
                  disabled={!selectedWeek}
                  className={`w-full px-4 py-3 rounded-lg transition flex items-center justify-center gap-2 ${
                    selectedWeek
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-slate-600 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Flame className="w-5 h-5" />
                  <span className="font-semibold">Input Casualties</span>
                </button>
              </div>
            </div>
          )}

          {/* Balancer Modal */}
          {showBalancerModal && selectedWeek && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-slate-800 rounded-lg shadow-2xl border border-slate-700 max-w-6xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
                      <Target className="w-6 h-6" />
                      Team Balancer - {selectedWeek.name}
                    </h2>
                    <button
                      onClick={() => {
                        setShowBalancerModal(false);
                        setBalancerResults(null);
                      }}
                      className="p-2 hover:bg-slate-700 rounded-lg transition"
                    >
                      <X className="w-5 h-5 text-slate-400" />
                    </button>
                  </div>

                  {!balancerResults ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Left: Available Units */}
                      <div className="bg-slate-700 rounded-lg p-4">
                        <h3 className="text-lg font-semibold text-amber-400 mb-3">Available Units Pool</h3>
                        <div className="bg-slate-600 rounded p-3 max-h-64 overflow-y-auto">
                          {(() => {
                            const assignedUnits = new Set([...selectedWeek.teamA, ...selectedWeek.teamB]);
                            const available = units.filter(u => !assignedUnits.has(u));
                            return available.length > 0 ? (
                              <div className="space-y-1">
                                {available.map(unit => (
                                  <div key={unit} className="text-white text-sm py-1">
                                    {unit}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-slate-400 text-sm">All units assigned</p>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Right: Constraints */}
                      <div className="space-y-4">
                        {/* Max Player Difference */}
                        <div className="bg-slate-700 rounded-lg p-4">
                          <label className="block text-sm text-slate-300 mb-2">Max Player Difference</label>
                          <input
                            type="number"
                            value={balancerMaxDiff}
                            onChange={(e) => setBalancerMaxDiff(parseInt(e.target.value) || 1)}
                            min="0"
                            max="100"
                            className="w-full px-3 py-2 bg-slate-800 text-white rounded border border-slate-600 focus:border-amber-500 outline-none"
                          />
                        </div>

                        {/* Unit Player Counts */}
                        <div className="bg-slate-700 rounded-lg p-4">
                          <h3 className="text-lg font-semibold text-amber-400 mb-3">Unit Player Counts</h3>
                          <div className="max-h-48 overflow-y-auto space-y-2">
                            {units.map(unit => (
                              <div key={unit} className="grid grid-cols-3 gap-2 items-center">
                                <span className="text-white text-sm truncate" title={unit}>{unit}</span>
                                <input
                                  type="number"
                                  placeholder="Min"
                                  value={balancerUnitCounts[unit]?.min ?? 0}
                                  onChange={(e) => setBalancerUnitCounts({
                                    ...balancerUnitCounts,
                                    [unit]: {
                                      ...balancerUnitCounts[unit],
                                      min: parseInt(e.target.value) || 0
                                    }
                                  })}
                                  className="px-2 py-1 bg-slate-800 text-white text-sm rounded border border-slate-600 focus:border-amber-500 outline-none"
                                />
                                <input
                                  type="number"
                                  placeholder="Max"
                                  value={balancerUnitCounts[unit]?.max ?? 0}
                                  onChange={(e) => setBalancerUnitCounts({
                                    ...balancerUnitCounts,
                                    [unit]: {
                                      ...balancerUnitCounts[unit],
                                      max: parseInt(e.target.value) || 0
                                    }
                                  })}
                                  className="px-2 py-1 bg-slate-800 text-white text-sm rounded border border-slate-600 focus:border-amber-500 outline-none"
                                />
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Opposing Units */}
                        <div className="bg-slate-700 rounded-lg p-4">
                          <h3 className="text-lg font-semibold text-amber-400 mb-3">Opposing Units</h3>
                          <div className="space-y-2 mb-3 max-h-32 overflow-y-auto">
                            {balancerOpposingPairs.map((pair, idx) => (
                              <div key={idx} className="flex justify-between items-center bg-slate-600 rounded p-2">
                                <span className="text-white text-sm">{pair[0]} vs {pair[1]}</span>
                                <button
                                  onClick={() => setBalancerOpposingPairs(balancerOpposingPairs.filter((_, i) => i !== idx))}
                                  className="p-1 hover:bg-red-600 rounded transition"
                                >
                                  <X className="w-3 h-3 text-white" />
                                </button>
                              </div>
                            ))}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <select
                              id="opposing-unit-1"
                              className="px-2 py-1 bg-slate-800 text-white text-sm rounded border border-slate-600 focus:border-amber-500 outline-none"
                            >
                              <option value="">Select first unit...</option>
                              {units.map(unit => (
                                <option key={unit} value={unit}>{unit}</option>
                              ))}
                            </select>
                            <select
                              id="opposing-unit-2"
                              className="px-2 py-1 bg-slate-800 text-white text-sm rounded border border-slate-600 focus:border-amber-500 outline-none"
                            >
                              <option value="">Select second unit...</option>
                              {units.map(unit => (
                                <option key={unit} value={unit}>{unit}</option>
                              ))}
                            </select>
                          </div>
                          <button
                            onClick={() => {
                              const select1 = document.getElementById('opposing-unit-1');
                              const select2 = document.getElementById('opposing-unit-2');
                              const unit1 = select1.value;
                              const unit2 = select2.value;
                              
                              if (!unit1 || !unit2) {
                                alert('Please select both units');
                                return;
                              }
                              if (unit1 === unit2) {
                                alert('Please select different units');
                                return;
                              }
                              
                              setBalancerOpposingPairs([...balancerOpposingPairs, [unit1, unit2]]);
                              select1.value = '';
                              select2.value = '';
                            }}
                            className="w-full mt-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm transition"
                          >
                            Add Opposing Pair
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Balance Results */
                    <div>
                      <div className="text-center mb-6">
                        <h3 className="text-xl font-bold text-green-400 mb-2">
                          Best Balance Found!
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 max-w-4xl mx-auto">
                          <div className="bg-slate-700 rounded p-3">
                            <div className="text-xs text-slate-400 mb-1">Avg Difference</div>
                            <div className="text-lg font-bold text-amber-400">
                              {balancerResults.score.toFixed(1)}
                            </div>
                          </div>
                          <div className="bg-slate-700 rounded p-3">
                            <div className="text-xs text-slate-400 mb-1">Min Difference</div>
                            <div className="text-lg font-bold text-cyan-400">
                              {Math.abs(balancerResults.minA - balancerResults.minB).toFixed(0)}
                            </div>
                          </div>
                          <div className="bg-slate-700 rounded p-3">
                            <div className="text-xs text-slate-400 mb-1">Max Difference</div>
                            <div className="text-lg font-bold text-purple-400">
                              {Math.abs(balancerResults.maxA - balancerResults.maxB).toFixed(0)}
                            </div>
                          </div>
                          <div className="bg-slate-700 rounded p-3">
                            <div className="text-xs text-slate-400 mb-1">Avg Teammate History</div>
                            <div className="text-lg font-bold text-green-400">
                              {balancerResults.combinedAvgHistory?.toFixed(2) || '0.00'}
                            </div>
                          </div>
                        </div>
                        <p className="text-slate-400 text-sm mt-3">
                          💡 Drag units between teams to adjust balance • Lower teammate history = better variety
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        {/* Team A Results */}
                        <div
                          className="bg-slate-700 rounded-lg p-4"
                          onDragOver={handleDragOver}
                          onDrop={() => handleDrop('A')}
                        >
                          <h4 className="text-lg font-semibold text-blue-400 mb-3">
                            Team A ({balancerResults.teamA.length} units)
                          </h4>
                          <div className="text-slate-300 text-sm mb-3 space-y-1">
                            <p>Players: {balancerResults.minA}-{balancerResults.maxA} (avg: {((balancerResults.minA + balancerResults.maxA) / 2).toFixed(1)})</p>
                            <p className="text-xs">
                              Avg Teammate History: <span className="text-cyan-400 font-semibold">{balancerResults.avgHistoryA?.toFixed(2) || '0.00'}</span>
                            </p>
                          </div>
                          <div className="bg-slate-600 rounded p-3 max-h-64 overflow-y-auto">
                            <div className="space-y-1">
                              {balancerResults.teamA.sort().map(unit => (
                                <div
                                  key={unit}
                                  draggable
                                  onDragStart={() => handleDragStart(unit, 'A')}
                                  className="text-white text-sm py-2 px-3 bg-slate-700 rounded cursor-move hover:bg-slate-600 transition flex items-center gap-2"
                                >
                                  <Swords className="w-3 h-3 text-slate-400" />
                                  {unit}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Team B Results */}
                        <div
                          className="bg-slate-700 rounded-lg p-4"
                          onDragOver={handleDragOver}
                          onDrop={() => handleDrop('B')}
                        >
                          <h4 className="text-lg font-semibold text-red-400 mb-3">
                            Team B ({balancerResults.teamB.length} units)
                          </h4>
                          <div className="text-slate-300 text-sm mb-3 space-y-1">
                            <p>Players: {balancerResults.minB}-{balancerResults.maxB} (avg: {((balancerResults.minB + balancerResults.maxB) / 2).toFixed(1)})</p>
                            <p className="text-xs">
                              Avg Teammate History: <span className="text-cyan-400 font-semibold">{balancerResults.avgHistoryB?.toFixed(2) || '0.00'}</span>
                            </p>
                          </div>
                          <div className="bg-slate-600 rounded p-3 max-h-64 overflow-y-auto">
                            <div className="space-y-1">
                              {balancerResults.teamB.sort().map(unit => (
                                <div
                                  key={unit}
                                  draggable
                                  onDragStart={() => handleDragStart(unit, 'B')}
                                  className="text-white text-sm py-2 px-3 bg-slate-700 rounded cursor-move hover:bg-slate-600 transition flex items-center gap-2"
                                >
                                  <Swords className="w-3 h-3 text-slate-400" />
                                  {unit}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Bottom Buttons */}
                  <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-600">
                    <div className="text-slate-300 text-sm">
                      {balancerStatus}
                    </div>
                    <div className="flex gap-2">
                      {!balancerResults ? (
                        <>
                          <button
                            onClick={() => setShowBalancerModal(false)}
                            className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition"
                          >
                            Close
                          </button>
                          <button
                            onClick={runBalancer}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition flex items-center gap-2"
                          >
                            <Target className="w-4 h-4" />
                            Balance!
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => setBalancerResults(null)}
                            className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition"
                          >
                            Back
                          </button>
                          <button
                            onClick={applyBalancerResults}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition flex items-center gap-2"
                          >
                            <Save className="w-4 h-4" />
                            Apply to Week
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Casualty Input Modal */}
          {showCasualtyModal && selectedWeek && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-slate-800 rounded-lg shadow-2xl border border-slate-700 max-w-6xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
                      <Flame className="w-6 h-6" />
                      Input Casualties - {selectedWeek.name}
                    </h2>
                    <button
                      onClick={() => setShowCasualtyModal(false)}
                      className="p-2 hover:bg-slate-700 rounded-lg transition"
                    >
                      <X className="w-5 h-5 text-slate-400" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Team A and B Casualties */}
                    {[teamNames.A, teamNames.B].map((teamName, teamIdx) => {
                      const teamId = teamIdx === 0 ? 'A' : 'B';
                      const rosterUnits = selectedWeek[`team${teamId}`] || [];

                      return (
                        <div key={teamName} className="bg-slate-700 rounded-lg p-4">
                          <h3 className="text-lg font-semibold text-amber-400 mb-4">{teamName} Units</h3>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Round 1 */}
                            <div className="bg-slate-600 rounded-lg p-3">
                              <div className="flex justify-between items-center mb-3">
                                <h4 className="font-semibold text-white">Round 1 Casualties</h4>
                                <label className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs cursor-pointer transition">
                                  Load CSV
                                  <input
                                    type="file"
                                    accept=".csv"
                                    onChange={(e) => loadCasualtiesFromCSV(teamName, 'r1', e)}
                                    className="hidden"
                                  />
                                </label>
                              </div>
                              <div className="space-y-2 max-h-64 overflow-y-auto">
                                {rosterUnits.map(unit => (
                                  <div key={unit} className="flex justify-between items-center">
                                    <label className="text-white text-sm truncate flex-1" title={unit}>
                                      {unit}:
                                    </label>
                                    <input
                                      type="number"
                                      min="0"
                                      value={casualtyInputData[teamName]?.casualties?.r1?.[unit] || 0}
                                      onChange={(e) => {
                                        const value = parseInt(e.target.value) || 0;
                                        setCasualtyInputData(prev => ({
                                          ...prev,
                                          [teamName]: {
                                            ...prev[teamName],
                                            casualties: {
                                              ...prev[teamName]?.casualties,
                                              r1: {
                                                ...prev[teamName]?.casualties?.r1,
                                                [unit]: value
                                              }
                                            }
                                          }
                                        }));
                                      }}
                                      className="w-16 px-2 py-1 bg-slate-800 text-white text-sm rounded border border-slate-500 focus:border-amber-500 outline-none ml-2"
                                    />
                                  </div>
                                ))}
                                {rosterUnits.length === 0 && (
                                  <p className="text-slate-400 text-xs text-center py-2">No units assigned</p>
                                )}
                              </div>
                            </div>

                            {/* Round 2 */}
                            <div className="bg-slate-600 rounded-lg p-3">
                              <div className="flex justify-between items-center mb-3">
                                <h4 className="font-semibold text-white">Round 2 Casualties</h4>
                                <label className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs cursor-pointer transition">
                                  Load CSV
                                  <input
                                    type="file"
                                    accept=".csv"
                                    onChange={(e) => loadCasualtiesFromCSV(teamName, 'r2', e)}
                                    className="hidden"
                                  />
                                </label>
                              </div>
                              <div className="space-y-2 max-h-64 overflow-y-auto">
                                {rosterUnits.map(unit => (
                                  <div key={unit} className="flex justify-between items-center">
                                    <label className="text-white text-sm truncate flex-1" title={unit}>
                                      {unit}:
                                    </label>
                                    <input
                                      type="number"
                                      min="0"
                                      value={casualtyInputData[teamName]?.casualties?.r2?.[unit] || 0}
                                      onChange={(e) => {
                                        const value = parseInt(e.target.value) || 0;
                                        setCasualtyInputData(prev => ({
                                          ...prev,
                                          [teamName]: {
                                            ...prev[teamName],
                                            casualties: {
                                              ...prev[teamName]?.casualties,
                                              r2: {
                                                ...prev[teamName]?.casualties?.r2,
                                                [unit]: value
                                              }
                                            }
                                          }
                                        }));
                                      }}
                                      className="w-16 px-2 py-1 bg-slate-800 text-white text-sm rounded border border-slate-500 focus:border-amber-500 outline-none ml-2"
                                    />
                                  </div>
                                ))}
                                {rosterUnits.length === 0 && (
                                  <p className="text-slate-400 text-xs text-center py-2">No units assigned</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Bottom Buttons */}
                  <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-600">
                    <button
                      onClick={() => setShowCasualtyModal(false)}
                      className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveCasualtyData}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition flex items-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      Save
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Statistics Modal */}
          {showStatsModal && (
            <div
              className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => setShowStatsModal(false)}
            >
              <div
                className="bg-slate-800 rounded-lg shadow-2xl border border-slate-700 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
                      <BarChart3 className="w-6 h-6" />
                      Season Statistics
                    </h2>
                    <button
                      onClick={() => setShowStatsModal(false)}
                      className="p-2 hover:bg-slate-700 rounded-lg transition"
                    >
                      <X className="w-5 h-5 text-slate-400" />
                    </button>
                  </div>

                  {/* Map Statistics */}
                  <div className="bg-slate-700 rounded-lg p-4 mb-4">
                    <h3 className="text-xl font-bold text-amber-400 mb-3 flex items-center gap-2">
                      <Map className="w-5 h-5" />
                      Map Statistics
                    </h3>
                    <div className="space-y-2">
                      {Object.entries(calculateMapStats())
                        .sort(([, a], [, b]) => b.plays - a.plays)
                        .map(([mapName, stats]) => (
                          <div key={mapName} className="bg-slate-600 rounded p-3">
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-semibold text-white">{mapName}</span>
                              <span className="text-slate-300 text-sm">{stats.plays} plays</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                              <div>USA Wins: {stats.usaWins} ({stats.plays > 0 ? ((stats.usaWins / stats.plays) * 100).toFixed(1) : 0}%)</div>
                              <div>CSA Wins: {stats.csaWins} ({stats.plays > 0 ? ((stats.csaWins / stats.plays) * 100).toFixed(1) : 0}%)</div>
                            </div>
                          </div>
                        ))}
                      {Object.keys(calculateMapStats()).length === 0 && (
                        <p className="text-slate-400 text-center py-4">No map data available</p>
                      )}
                    </div>
                  </div>

                  {/* Casualties Summary */}
                  <div className="bg-slate-700 rounded-lg p-4 mb-4">
                    <h3 className="text-xl font-bold text-amber-400 mb-3 flex items-center gap-2">
                      <Flame className="w-5 h-5" />
                      Total Casualties
                    </h3>
                    {(() => {
                      // Calculate USA/CSA casualties based on map sides
                      let usaCasualties = 0;
                      let csaCasualties = 0;
                      
                      weeks.forEach(week => {
                        [1, 2].forEach(roundNum => {
                          const mapName = week[`round${roundNum}Map`];
                          const flipped = week[`round${roundNum}Flipped`] || false;
                          const casualtiesA = week[`r${roundNum}CasualtiesA`] || 0;
                          const casualtiesB = week[`r${roundNum}CasualtiesB`] || 0;
                          
                          // Determine which side is USA based on map and flipped state
                          // If not flipped: Team A = USA, Team B = CSA
                          // If flipped: Team A = CSA, Team B = USA
                          const usaSide = flipped ? 'B' : 'A';
                          
                          if (usaSide === 'A') {
                            usaCasualties += casualtiesA;
                            csaCasualties += casualtiesB;
                          } else {
                            usaCasualties += casualtiesB;
                            csaCasualties += casualtiesA;
                          }
                        });
                      });
                      
                      const totalCasualties = usaCasualties + csaCasualties;
                      
                      return (
                        <div className="grid grid-cols-3 gap-4">
                          <div className="bg-slate-600 rounded p-3">
                            <div className="text-sm text-slate-300 mb-1">USA Casualties</div>
                            <div className="text-2xl font-bold text-blue-400">
                              {usaCasualties}
                            </div>
                          </div>
                          <div className="bg-slate-600 rounded p-3">
                            <div className="text-sm text-slate-300 mb-1">CSA Casualties</div>
                            <div className="text-2xl font-bold text-red-400">
                              {csaCasualties}
                            </div>
                          </div>
                          <div className="bg-slate-600 rounded p-3">
                            <div className="text-sm text-slate-300 mb-1">Combined Casualties</div>
                            <div className="text-2xl font-bold text-amber-400">
                              {totalCasualties}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Per-Unit Casualty Table */}
                    {(() => {
                      const { inflicted, lost } = calculateCasualties();
                      const allInvolvedUnits = new Set([...Object.keys(inflicted), ...Object.keys(lost)]);
                      
                      if (allInvolvedUnits.size === 0) {
                        return null;
                      }

                      // Count games attended for each unit
                      const gamesAttended = {};
                      weeks.forEach(week => {
                        const weeklyCas = week.weeklyCasualties || {};
                        const teamAName = teamNames.A;
                        const teamBName = teamNames.B;
                        
                        ['r1', 'r2'].forEach(roundKey => {
                          const roundUnits = new Set([
                            ...Object.keys(weeklyCas[teamAName]?.[roundKey] || {}),
                            ...Object.keys(weeklyCas[teamBName]?.[roundKey] || {})
                          ]);
                          roundUnits.forEach(unit => {
                            gamesAttended[unit] = (gamesAttended[unit] || 0) + 1;
                          });
                        });
                      });

                      const tableData = Array.from(allInvolvedUnits).map(unit => {
                        const inflictedCount = inflicted[unit] || 0;
                        const lostCount = lost[unit] || 0;
                        const games = gamesAttended[unit] || 0;
                        const kdRatio = lostCount > 0 ? inflictedCount / lostCount : Infinity;
                        
                        return {
                          unit,
                          inflicted: Math.round(inflictedCount),
                          lost: lostCount,
                          kd: kdRatio,
                          inflictedPerGame: games > 0 ? inflictedCount / games : 0,
                          lostPerGame: games > 0 ? lostCount / games : 0
                        };
                      }).sort((a, b) => b.kd - a.kd);

                      return (
                        <div className="bg-slate-600 rounded p-3 mt-4">
                          <h4 className="font-semibold text-white mb-3">Per-Unit Casualty Report</h4>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-slate-300 border-b border-slate-500">
                                  <th className="text-left py-2 px-2">Unit</th>
                                  <th className="text-center py-2 px-2">Inflicted</th>
                                  <th className="text-center py-2 px-2">Lost</th>
                                  <th className="text-center py-2 px-2">K/D</th>
                                  <th className="text-center py-2 px-2">Inf/Game</th>
                                  <th className="text-center py-2 px-2">Lost/Game</th>
                                </tr>
                              </thead>
                              <tbody>
                                {tableData.map((row, idx) => (
                                  <tr key={row.unit} className={`${idx % 2 === 0 ? 'bg-slate-700' : 'bg-slate-600'}`}>
                                    <td className="text-white py-2 px-2">{row.unit}</td>
                                    <td className="text-green-400 text-center py-2 px-2">{row.inflicted}</td>
                                    <td className="text-red-400 text-center py-2 px-2">{row.lost}</td>
                                    <td className="text-amber-400 text-center py-2 px-2">
                                      {row.kd === Infinity ? '∞' : row.kd.toFixed(2)}
                                    </td>
                                    <td className="text-slate-300 text-center py-2 px-2">{row.inflictedPerGame.toFixed(2)}</td>
                                    <td className="text-slate-300 text-center py-2 px-2">{row.lostPerGame.toFixed(2)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Teammate Impact Index (TII) */}
                  <div className="bg-slate-700 rounded-lg p-4 mb-4">
                    <h3 className="text-xl font-bold text-amber-400 mb-3 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5" />
                      Teammate Impact Index (TII)
                    </h3>
                    {(() => {
                      const currentWeekIdx = selectedWeek ? weeks.findIndex(w => w.id === selectedWeek.id) : weeks.length - 1;
                      const { impactStats, globalAvgLossRate } = calculateTeammateImpact(currentWeekIdx);
                      
                      // Filter to only units that have played
                      const tableData = Object.entries(impactStats)
                        .map(([unit, data]) => ({
                          unit,
                          ...data,
                          totalGames: data.leadGames + data.assistGames
                        }))
                        .filter(row => row.totalGames > 0)
                        .sort((a, b) => b.adjustedTiiScore - a.adjustedTiiScore);
                      
                      if (tableData.length === 0) {
                        return <p className="text-slate-400 text-center py-4">No TII data available yet</p>;
                      }
                      
                      return (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-slate-300 border-b border-slate-500">
                                <th className="text-left py-2 px-2">Unit (Avg Players)</th>
                                <th className="text-center py-2 px-2" title="Adjusted TII - Primary ranking metric">Adj. TII</th>
                                <th className="text-center py-2 px-2" title="Original TII - Based purely on teammate win/loss">Orig. TII</th>
                                <th className="text-center py-2 px-2" title="Win rate when leading">Lead Impact</th>
                                <th className="text-center py-2 px-2" title="Win rate when assisting">Assist Impact</th>
                                <th className="text-center py-2 px-2" title="Difference from league average">Δ vs Avg</th>
                              </tr>
                            </thead>
                            <tbody>
                              {tableData.map((row, idx) => {
                                const delta = row.avgTeammateLossRateWith - globalAvgLossRate;
                                return (
                                  <tr key={row.unit} className={`${idx % 2 === 0 ? 'bg-slate-600' : 'bg-slate-700'}`}>
                                    <td className="text-white py-2 px-2">
                                      {row.unit} ({row.avgPlayers.toFixed(1)})
                                    </td>
                                    <td className="text-amber-400 text-center py-2 px-2 font-semibold">
                                      {row.adjustedTiiScore.toFixed(3)}
                                    </td>
                                    <td className="text-cyan-400 text-center py-2 px-2">
                                      {row.impactScore.toFixed(3)}
                                    </td>
                                    <td className="text-green-400 text-center py-2 px-2">
                                      {(row.leadImpact * 100).toFixed(1)}% ({row.leadGames})
                                    </td>
                                    <td className="text-blue-400 text-center py-2 px-2">
                                      {(row.assistImpact * 100).toFixed(1)}% ({row.assistGames})
                                    </td>
                                    <td className={`text-center py-2 px-2 ${delta < 0 ? 'text-green-400' : 'text-red-400'}`}>
                                      {(delta * 100).toFixed(1)}%
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                          <div className="mt-3 text-xs text-slate-400 bg-slate-600 rounded p-3">
                            <p className="font-semibold text-amber-300 mb-2">📊 Metric Explanations:</p>
                            <ul className="space-y-1 ml-4">
                              <li><strong>Adj. TII:</strong> Primary metric - Original TII adjusted by player count impact</li>
                              <li><strong>Orig. TII:</strong> 1 - (Avg teammate loss rate when this unit plays)</li>
                              <li><strong>Lead Impact:</strong> Win rate when designated as lead unit</li>
                              <li><strong>Assist Impact:</strong> Win rate when not the lead unit</li>
                              <li><strong>Δ vs Avg:</strong> Negative is GOOD - teammates lose less than average</li>
                            </ul>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Unit Interactions */}
                  <div className="bg-slate-700 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-xl font-bold text-amber-400 flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        Unit Interactions
                      </h3>
                      <button
                        onClick={() => setShowHeatmapModal(true)}
                        className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm transition flex items-center gap-1"
                        title="View Teammate Composition Heatmap"
                      >
                        <Swords className="w-4 h-4" />
                        Heatmap
                      </button>
                    </div>
                    <div className="space-y-3">
                      {(() => {
                        const { teammate, opponent } = computeStats();
                        const interactions = getDetailedInteractions();
                        
                        // Get top teammate pairs
                        const teammatePairs = [];
                        Object.entries(teammate).forEach(([unit1, partners]) => {
                          Object.entries(partners).forEach(([unit2, count]) => {
                            if (unit1 < unit2) { // Avoid duplicates
                              const details = interactions[unit1]?.[unit2];
                              teammatePairs.push({
                                unit1,
                                unit2,
                                count,
                                weeks: details?.teammateWeeks || []
                              });
                            }
                          });
                        });
                        teammatePairs.sort((a, b) => b.count - a.count);
                        
                        // Get top opponent pairs
                        const opponentPairs = [];
                        Object.entries(opponent).forEach(([unit1, opponents]) => {
                          Object.entries(opponents).forEach(([unit2, count]) => {
                            if (unit1 < unit2) { // Avoid duplicates
                              const details = interactions[unit1]?.[unit2];
                              opponentPairs.push({
                                unit1,
                                unit2,
                                count,
                                weeks: details?.opponentWeeks || []
                              });
                            }
                          });
                        });
                        opponentPairs.sort((a, b) => b.count - a.count);
                        
                        return (
                          <>
                            <div className="bg-slate-600 rounded p-3">
                              <h4 className="font-semibold text-white mb-2">Most Frequent Teammates</h4>
                              <div className="space-y-1">
                                {teammatePairs.slice(0, 5).map((pair, idx) => (
                                  <div key={idx} className="text-xs text-slate-300 flex justify-between">
                                    <span>{pair.unit1} & {pair.unit2}</span>
                                    <span className="text-amber-400">{pair.count} weeks</span>
                                  </div>
                                ))}
                                {teammatePairs.length === 0 && (
                                  <p className="text-xs text-slate-400">No teammate data yet</p>
                                )}
                              </div>
                            </div>
                            
                            <div className="bg-slate-600 rounded p-3">
                              <h4 className="font-semibold text-white mb-2">Most Frequent Opponents</h4>
                              <div className="space-y-1">
                                {opponentPairs.slice(0, 5).map((pair, idx) => (
                                  <div key={idx} className="text-xs text-slate-300 flex justify-between">
                                    <span>{pair.unit1} vs {pair.unit2}</span>
                                    <span className="text-red-400">{pair.count} weeks</span>
                                  </div>
                                ))}
                                {opponentPairs.length === 0 && (
                                  <p className="text-xs text-slate-400">No opponent data yet</p>
                                )}
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Division Management Modal */}
          {showDivisionModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-slate-800 rounded-lg shadow-2xl border border-slate-700 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
                      <Users className="w-6 h-6" />
                      Division Management
                    </h2>
                    <button
                      onClick={() => setShowDivisionModal(false)}
                      className="p-2 hover:bg-slate-700 rounded-lg transition"
                    >
                      <X className="w-5 h-5 text-slate-400" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left: Unassigned Units */}
                    <div className="bg-slate-700 rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-amber-400 mb-3">Unassigned Units</h3>
                      <div className="bg-slate-600 rounded p-3 max-h-96 overflow-y-auto">
                        {getUnassignedUnits().length > 0 ? (
                          <div className="space-y-1">
                            {getUnassignedUnits().map(unit => (
                              <div key={unit} className="text-white text-sm py-1">
                                {unit}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-slate-400 text-sm">All units assigned to divisions</p>
                        )}
                      </div>
                    </div>

                    {/* Right: Divisions */}
                    <div className="bg-slate-700 rounded-lg p-4">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-lg font-semibold text-amber-400">Divisions</h3>
                        <button
                          onClick={addDivision}
                          className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm transition"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {divisions.map((division) => (
                          <div key={division.name} className="bg-slate-600 rounded-lg p-3">
                            <div className="flex justify-between items-center mb-2">
                              <input
                                type="text"
                                value={division.name}
                                onChange={(e) => renameDivision(division.name, e.target.value)}
                                className="flex-1 px-2 py-1 bg-slate-800 text-white rounded border border-slate-500 focus:border-amber-500 outline-none text-sm font-semibold"
                              />
                              <button
                                onClick={() => deleteDivision(division.name)}
                                className="ml-2 p-1 hover:bg-red-600 rounded transition"
                              >
                                <Trash2 className="w-4 h-4 text-white" />
                              </button>
                            </div>
                            <div className="space-y-1">
                              {division.units.map(unit => (
                                <div key={unit} className="flex justify-between items-center text-xs">
                                  <span className="text-white">{unit}</span>
                                  <button
                                    onClick={() => removeUnitFromDivision(division.name, unit)}
                                    className="p-1 hover:bg-red-600 rounded transition"
                                  >
                                    <X className="w-3 h-3 text-white" />
                                  </button>
                                </div>
                              ))}
                              {division.units.length === 0 && (
                                <p className="text-slate-400 text-xs">No units in this division</p>
                              )}
                            </div>
                            <select
                              onChange={(e) => {
                                if (e.target.value) {
                                  addUnitToDivision(division.name, e.target.value);
                                  e.target.value = '';
                                }
                              }}
                              className="w-full mt-2 px-2 py-1 bg-slate-800 text-white rounded border border-slate-500 focus:border-amber-500 outline-none text-xs"
                            >
                              <option value="">Add unit...</option>
                              {getUnassignedUnits().map(unit => (
                                <option key={unit} value={unit}>{unit}</option>
                              ))}
                            </select>
                          </div>
                        ))}
                        {divisions.length === 0 && (
                          <p className="text-slate-400 text-sm text-center py-4">No divisions created yet</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Bottom Buttons */}
                  <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-600">
                    <button
                      onClick={() => setShowDivisionModal(false)}
                      className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Map Bias Configuration Modal */}
          {showMapBiasModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-slate-800 rounded-lg shadow-2xl border border-slate-700 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
                      <Map className="w-6 h-6" />
                      Configure Map Biases
                    </h2>
                    <button
                      onClick={() => setShowMapBiasModal(false)}
                      className="p-2 hover:bg-slate-700 rounded-lg transition"
                    >
                      <X className="w-5 h-5 text-slate-400" />
                    </button>
                  </div>

                  <div className="mb-4 bg-slate-700 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-amber-300 mb-2">Bias Scale:</h3>
                    <div className="text-xs text-slate-300 space-y-1">
                      <div><strong>0</strong> = Balanced</div>
                      <div><strong>1</strong> = Light Attacker Bias</div>
                      <div><strong>1.5</strong> = Heavy Attacker Bias</div>
                      <div><strong>2</strong> = Light Defender Bias</div>
                      <div><strong>2.5</strong> = Heavy Defender Bias</div>
                    </div>
                  </div>

                  {/* Map Bias Inputs by Category */}
                  {Object.entries(MAPS).map(([category, mapList]) => (
                    <div key={category} className="mb-4">
                      <button
                        onClick={() => toggleSection(category)}
                        className="w-full flex items-center justify-between bg-slate-700 rounded-lg p-3 hover:bg-slate-600 transition"
                      >
                        <h3 className="text-lg font-semibold text-amber-400">
                          {category.replace(/_/g, ' ').toUpperCase()}
                        </h3>
                        {expandedSections[category] ? (
                          <ChevronDown className="w-5 h-5 text-slate-400" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-slate-400" />
                        )}
                      </button>
                      
                      {expandedSections[category] && (
                        <div className="mt-2 bg-slate-700 rounded-lg p-4 space-y-3">
                          {mapList.map(mapName => (
                            <div key={mapName} className="grid grid-cols-2 gap-4 items-center">
                              <label className="text-white text-sm">{mapName}</label>
                              <select
                                value={mapBiases[mapName] || 0}
                                onChange={(e) => setMapBiases({
                                  ...mapBiases,
                                  [mapName]: parseFloat(e.target.value)
                                })}
                                className="px-3 py-2 bg-slate-800 text-white rounded border border-slate-600 focus:border-amber-500 outline-none text-sm"
                              >
                                <option value="0">Balanced</option>
                                <option value="1">Light Attacker</option>
                                <option value="1.5">Heavy Attacker</option>
                                <option value="2">Light Defender</option>
                                <option value="2.5">Heavy Defender</option>
                              </select>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Bottom Buttons */}
                  <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-600">
                    <button
                      onClick={() => setShowMapBiasModal(false)}
                      className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Teammate Composition Heatmap Modal */}
          {showHeatmapModal && (
            <div
              className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => setShowHeatmapModal(false)}
            >
              <div
                className="bg-slate-800 rounded-lg shadow-2xl border border-slate-700 max-w-6xl w-full max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
                      <Swords className="w-6 h-6" />
                      Teammate Composition Heatmap
                    </h2>
                    <button
                      onClick={() => setShowHeatmapModal(false)}
                      className="p-2 hover:bg-slate-700 rounded-lg transition"
                    >
                      <X className="w-5 h-5 text-slate-400" />
                    </button>
                  </div>

                  <div className="mb-4 bg-slate-700 rounded-lg p-4">
                    <p className="text-sm text-slate-300">
                      This heatmap shows how often units have played together as teammates as a percentage of the maximum pairing frequency.
                      100% (bright red) represents the most frequent pairing, helping normalize new additions into the data.
                    </p>
                  </div>

                  {(() => {
                    const { heatmapData, activeUnits } = calculateTeammateHeatmap();
                    
                    if (activeUnits.length === 0) {
                      return (
                        <div className="text-center text-slate-400 py-12">
                          <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                          <p>No teammate data available yet</p>
                        </div>
                      );
                    }

                    // Find max count for percentage-based color scaling
                    const maxCount = Math.max(...heatmapData.map(d => d.count), 1);

                    // Helper to get color intensity based on percentage of max
                    const getHeatColor = (count) => {
                      if (count === 0) return 'bg-slate-700';
                      const percentage = (count / maxCount) * 100;
                      if (percentage < 20) return 'bg-blue-900';
                      if (percentage < 40) return 'bg-blue-700';
                      if (percentage < 60) return 'bg-purple-700';
                      if (percentage < 80) return 'bg-orange-600';
                      return 'bg-red-600';
                    };

                    // Helper to get percentage display
                    const getPercentage = (count) => {
                      if (count === 0) return '';
                      return Math.round((count / maxCount) * 100);
                    };

                    // Calculate dynamic cell size based on number of units
                    const unitCount = activeUnits.length;
                    const cellSize = Math.max(24, Math.min(48, Math.floor(800 / unitCount)));
                    const fontSize = cellSize < 32 ? 'text-[8px]' : cellSize < 40 ? 'text-[10px]' : 'text-xs';
                    
                    return (
                      <div className="bg-slate-700 rounded-lg p-4">
                        <div className="w-full">
                          <table className="w-full border-collapse table-fixed">
                            <thead>
                              <tr style={{ height: '80px' }}>
                                <th className="p-1 text-xs font-semibold text-slate-400 bg-slate-700 z-10" style={{ width: '120px' }}></th>
                                {activeUnits.map(unit => (
                                  <th key={unit} className={`p-0.5 ${fontSize} font-semibold text-slate-300 relative`} style={{ height: '80px' }}>
                                    <div className="absolute bottom-2 left-1/2 transform -translate-x-1/6 -rotate-45 origin-bottom-left whitespace-nowrap" style={{ maxWidth: `${cellSize * 2}px` }} title={unit}>
                                      <span className="truncate block">{unit}</span>
                                    </div>
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {activeUnits.map(unit1 => (
                                <tr key={unit1}>
                                  <td className={`p-1 ${fontSize} font-semibold text-slate-300 bg-slate-700 z-10 truncate`} style={{ maxWidth: '120px' }} title={unit1}>
                                    {unit1}
                                  </td>
                                  {activeUnits.map(unit2 => {
                                    if (unit1 === unit2) {
                                      return (
                                        <td key={unit2} className="p-0.5">
                                          <div className="w-full bg-slate-800 rounded flex items-center justify-center" style={{ height: `${cellSize}px` }}>
                                            <span className={`${fontSize} text-slate-600`}>-</span>
                                          </div>
                                        </td>
                                      );
                                    }
                                    
                                    const data = heatmapData.find(d =>
                                      (d.unit1 === unit1 && d.unit2 === unit2) ||
                                      (d.unit1 === unit2 && d.unit2 === unit1)
                                    );
                                    const count = data?.count || 0;
                                    const percentage = getPercentage(count);
                                    
                                    return (
                                      <td key={unit2} className="p-0.5">
                                        <div
                                          className={`w-full ${getHeatColor(count)} rounded flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-amber-400 transition`}
                                          style={{ height: `${cellSize}px` }}
                                          title={`${unit1} & ${unit2}: ${count} weeks together (${percentage}% of max)`}
                                        >
                                          <span className={`${fontSize} font-semibold text-white`}>
                                            {count > 0 ? `${percentage}%` : ''}
                                          </span>
                                        </div>
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Legend */}
                        <div className="mt-6 flex items-center justify-center gap-4 flex-wrap">
                          <span className="text-sm text-slate-300">Percentage of Max Pairing:</span>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-4 bg-slate-700 rounded"></div>
                            <span className="text-xs text-slate-400">0%</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-4 bg-blue-900 rounded"></div>
                            <span className="text-xs text-slate-400">1-20%</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-4 bg-blue-700 rounded"></div>
                            <span className="text-xs text-slate-400">21-40%</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-4 bg-purple-700 rounded"></div>
                            <span className="text-xs text-slate-400">41-60%</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-4 bg-orange-600 rounded"></div>
                            <span className="text-xs text-slate-400">61-80%</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-4 bg-red-600 rounded"></div>
                            <span className="text-xs text-slate-400">81-100%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Bottom Buttons */}
                  <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-600">
                    <button
                      onClick={() => setShowHeatmapModal(false)}
                      className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Enlarged Section Modal */}
          {enlargedSection && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-slate-800 rounded-lg shadow-2xl border border-slate-700 w-full max-w-6xl max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
                      {enlargedSection === 'weeks' && (
                        <>
                          <Calendar className="w-6 h-6" />
                          Weeks ({weeks.length})
                        </>
                      )}
                      {enlargedSection === 'units' && (
                        <>
                          <Users className="w-6 h-6" />
                          Units ({units.length})
                        </>
                      )}
                      {enlargedSection === 'standings' && (
                        <>
                          <Award className="w-6 h-6" />
                          Standings
                        </>
                      )}
                    </h2>
                    <button
                      onClick={() => setEnlargedSection(null)}
                      className="p-2 hover:bg-slate-700 rounded-lg transition"
                    >
                      <X className="w-5 h-5 text-slate-400" />
                    </button>
                  </div>

                  {/* Weeks Enlarged View */}
                  {enlargedSection === 'weeks' && (
                    <div>
                      <div className="mb-4 flex justify-end">
                        <button
                          onClick={addWeek}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition flex items-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          Add Week
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {weeks.map((week) => (
                          <div
                            key={week.id}
                            className={`p-4 rounded-lg transition cursor-pointer ${
                              selectedWeek?.id === week.id
                                ? 'bg-amber-600 text-white'
                                : 'bg-slate-600 text-slate-200 hover:bg-slate-500'
                            }`}
                          >
                            <div className="flex justify-between items-center">
                              {editingWeek === week.id ? (
                                <input
                                  type="text"
                                  defaultValue={week.name}
                                  onBlur={(e) => renameWeek(week.id, e.target.value)}
                                  onKeyPress={(e) => {
                                    if (e.key === 'Enter') {
                                      renameWeek(week.id, e.target.value);
                                    }
                                  }}
                                  className="flex-1 px-2 py-1 bg-slate-800 text-white rounded border border-slate-500 outline-none"
                                  autoFocus
                                />
                              ) : (
                                <div
                                  onClick={() => setSelectedWeek(week)}
                                  className="flex-1"
                                >
                                  <div className="font-semibold">{week.name}</div>
                                  <div className="text-sm opacity-75">
                                    {week.teamA.length + week.teamB.length} units assigned
                                  </div>
                                </div>
                              )}
                              <div className="flex gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingWeek(week.id);
                                  }}
                                  className="p-1 hover:bg-slate-700 rounded transition"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeWeek(week.id);
                                  }}
                                  className="p-1 hover:bg-red-600 rounded transition"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Units Enlarged View */}
                  {enlargedSection === 'units' && (
                    <div>
                      <div className="mb-4 flex gap-2">
                        <input
                          type="text"
                          value={newUnitName}
                          onChange={(e) => setNewUnitName(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && addUnit()}
                          placeholder="Unit name..."
                          className="flex-1 px-3 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:border-amber-500 outline-none"
                        />
                        <button
                          onClick={addUnit}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition flex items-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          Add Unit
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {units.map((unit) => {
                          const isNonToken = nonTokenUnits.includes(unit);
                          return (
                            <div
                              key={unit}
                              className="flex justify-between items-center p-3 bg-slate-600 rounded-lg"
                            >
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => toggleNonTokenStatus(unit)}
                                  className={`px-2 py-1 rounded text-xs font-bold transition ${
                                    isNonToken
                                      ? 'bg-amber-600 hover:bg-amber-700 text-white'
                                      : 'bg-slate-700 hover:bg-slate-600 text-slate-400'
                                  }`}
                                  title={isNonToken ? "Non-token unit (click to toggle)" : "Token unit (click to toggle)"}
                                >
                                  {isNonToken ? '*' : '○'}
                                </button>
                                <span className={`font-medium ${isNonToken ? 'text-amber-400' : 'text-white'}`}>
                                  {unit}
                                </span>
                              </div>
                              <div className="flex gap-2">
                                {selectedWeek && (
                                  <>
                                    <button
                                      onClick={() => moveUnitToTeam(unit, 'A')}
                                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition"
                                      title={`Add to ${teamNames.A}`}
                                    >
                                      → A
                                    </button>
                                    <button
                                      onClick={() => moveUnitToTeam(unit, 'B')}
                                      className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition"
                                      title={`Add to ${teamNames.B}`}
                                    >
                                      → B
                                    </button>
                                  </>
                                )}
                                <button
                                  onClick={() => removeUnit(unit)}
                                  className="p-1 hover:bg-red-600 rounded transition"
                                >
                                  <Trash2 className="w-4 h-4 text-white" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Standings Enlarged View */}
                  {enlargedSection === 'standings' && (
                    <div>
                      <div className="mb-4 flex gap-2 justify-end">
                        <button
                          onClick={() => setRankByElo(!rankByElo)}
                          className="px-3 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition flex items-center gap-1"
                          title={rankByElo ? "Rank by Points" : "Rank by Elo"}
                        >
                          <TrendingUp className="w-4 h-4" />
                          {rankByElo ? "Elo" : "Points"}
                        </button>
                        {divisions && divisions.length > 0 && (
                          <button
                            onClick={() => setShowGroupedStandings(!showGroupedStandings)}
                            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition flex items-center gap-1"
                            title={showGroupedStandings ? "Show All" : "Group by Division"}
                          >
                            {showGroupedStandings ? <Users className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                            {showGroupedStandings ? "Grouped" : "All"}
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {showGroupedStandings && divisions && divisions.length > 0 ? (
                          getGroupedStandings().map((group) => (
                            <div key={group.name} className="bg-slate-700 rounded-lg p-4">
                              <h3 className="text-sm font-bold text-amber-300 mb-3 px-2 flex items-center gap-2">
                                <Shield className="w-4 h-4" />
                                {group.name}
                              </h3>
                              <div className="space-y-2">
                                {group.units.map((stat) => {
                                  const isNonToken = nonTokenUnits.includes(stat.unit);
                                  return (
                                    <div
                                      key={stat.unit}
                                      className="bg-slate-600 rounded-lg p-3"
                                    >
                                      <div className="flex justify-between items-center mb-2">
                                        <div className="flex items-center gap-2">
                                          <span className="text-amber-400 font-bold text-lg">
                                            #{stat.divisionRank || stat.currentRank}
                                          </span>
                                          {stat.rankDelta !== null && stat.rankDelta !== undefined && (
                                            <span className={`text-xs font-semibold ${
                                              stat.rankDelta > 0 ? 'text-green-400' :
                                              stat.rankDelta < 0 ? 'text-red-400' :
                                              'text-slate-400'
                                            }`}>
                                              {stat.rankDelta > 0 ? `↑${stat.rankDelta}` :
                                               stat.rankDelta < 0 ? `↓${Math.abs(stat.rankDelta)}` :
                                               '−'}
                                            </span>
                                          )}
                                          <span className={`font-semibold ${isNonToken ? 'text-amber-400' : 'text-white'}`}>
                                            {isNonToken ? '*' : ''}{stat.unit}
                                          </span>
                                        </div>
                                        <span className="text-green-400 font-bold text-xl">
                                          {stat.points}
                                        </span>
                                      </div>
                                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                                        <div>L-Wins: {stat.leadWins}</div>
                                        <div>L-Loss: {stat.leadLosses}</div>
                                        <div>A-Wins: {stat.assistWins}</div>
                                        <div>A-Loss: {stat.assistLosses}</div>
                                        <div className="col-span-2 text-cyan-300">
                                          Elo: {Math.round(stat.elo)} ({stat.rounds} rounds)
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))
                        ) : (
                          getStandingsWithChanges().map((stat, index) => {
                            const isNonToken = nonTokenUnits.includes(stat.unit);
                            return (
                              <div
                                key={stat.unit}
                                className="bg-slate-600 rounded-lg p-3"
                              >
                                <div className="flex justify-between items-center mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-amber-400 font-bold text-lg">
                                      #{index + 1}
                                    </span>
                                    {stat.rankDelta !== null && stat.rankDelta !== undefined && (
                                      <span className={`text-xs font-semibold ${
                                        stat.rankDelta > 0 ? 'text-green-400' :
                                        stat.rankDelta < 0 ? 'text-red-400' :
                                        'text-slate-400'
                                      }`}>
                                        {stat.rankDelta > 0 ? `↑${stat.rankDelta}` :
                                         stat.rankDelta < 0 ? `↓${Math.abs(stat.rankDelta)}` :
                                         '−'}
                                      </span>
                                    )}
                                    <span className={`font-semibold ${isNonToken ? 'text-amber-400' : 'text-white'}`}>
                                      {isNonToken ? '*' : ''}{stat.unit}
                                    </span>
                                  </div>
                                  <span className="text-green-400 font-bold text-xl">
                                    {stat.points}
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                                  <div>L-Wins: {stat.leadWins}</div>
                                  <div>L-Loss: {stat.leadLosses}</div>
                                  <div>A-Wins: {stat.assistWins}</div>
                                  <div>A-Loss: {stat.assistLosses}</div>
                                  <div className="col-span-2 text-cyan-300">
                                    Elo: {Math.round(stat.elo)} ({stat.rounds} rounds)
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Empty State */}
          {weeks.length === 0 && (
            <div className="text-center text-slate-400 py-12 mt-6">
              <Calendar className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">Add a week to get started</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SeasonTracker;