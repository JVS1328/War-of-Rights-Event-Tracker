import React, { useState, useEffect } from 'react';
import {
  Users, Trophy, Calendar, Plus, Trash2, Edit2, Save, X,
  BarChart3, TrendingUp, Award, Download, Upload, Settings,
  ChevronDown, ChevronRight, Star, Target, Map, Flame, Shield, Swords, Maximize2, Zap,
  CheckCircle2, FileText
} from 'lucide-react';

const STORAGE_KEY = 'WarOfRightsSeasonTracker';

// Default playoff configuration factory
const getDefaultPlayoffConfig = () => ({
  enabled: false,
  useDivisions: false,
  teamsPerDivision: 2,
  wildcardTeams: 0,
  roundFormats: {
    wildcard: 1,
    divisional: 1,
    conference: 2,
    finals: 2
  }
});

// Default balancer settings
const getDefaultBalancerSettings = () => ({
  teammateWeight: 1.0,
  avgDiffWeight: 1.0,
  gapWeight: 0.75,
  minDiffWeight: 0.50,
  divisionOppositionWeight: 0
});

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

// Ensure all weeks have bias snapshots, stamping with fallback values where missing
const stampWeekBiases = (weeksList, fallbackMapBiases, fallbackEloBiasPercentages) =>
  weeksList.map(week => (week.mapBiases && week.eloBiasPercentages) ? week : {
    ...week,
    mapBiases: week.mapBiases || { ...fallbackMapBiases },
    eloBiasPercentages: week.eloBiasPercentages || { ...fallbackEloBiasPercentages },
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

  // Resolve initial bias values (used for both state init and stamping old weeks)
  const initialMapBiases = savedState?.mapBiases || getDefaultMapBiases();
  const initialEloBiasPercentages = savedState?.eloBiasPercentages || {
    lightAttacker: 15, heavyAttacker: 30, lightDefender: 15, heavyDefender: 30
  };

  // State management
  const [units, setUnits] = useState(savedState?.units || []);
  const [nonTokenUnits, setNonTokenUnits] = useState(savedState?.nonTokenUnits || []);
  const [weeks, setWeeks] = useState(() =>
    stampWeekBiases(savedState?.weeks || [], initialMapBiases, initialEloBiasPercentages)
  );
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
  const [eloBiasPercentages, setEloBiasPercentages] = useState(initialEloBiasPercentages);
  const [unitPlayerCounts, setUnitPlayerCounts] = useState(savedState?.unitPlayerCounts || {});
  const [manualAdjustments, setManualAdjustments] = useState(savedState?.manualAdjustments || {});
  const [divisions, setDivisions] = useState(savedState?.divisions || []);
  const [mapBiases, setMapBiases] = useState(initialMapBiases);
  const [showSettings, setShowSettings] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showBalancerModal, setShowBalancerModal] = useState(false);
  const [showCasualtyModal, setShowCasualtyModal] = useState(false);
  const [showDivisionModal, setShowDivisionModal] = useState(false);
  const [showMapBiasModal, setShowMapBiasModal] = useState(false);
  const [showHeatmapModal, setShowHeatmapModal] = useState(false);
  const [showSimulateModal, setShowSimulateModal] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [simulationAnalytics, setSimulationAnalytics] = useState(null);
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
  
  // Simulation state
  const [simLeadNightsPerUnit, setSimLeadNightsPerUnit] = useState(2);
  const [simLeadNightsInDivision, setSimLeadNightsInDivision] = useState(0);
  const [simScheduleOnly, setSimScheduleOnly] = useState(false);
  const [simLeadMode, setSimLeadMode] = useState('fullWeeks'); // 'fullWeeks' or 'rounds'
  
  // Playoff configuration state
  const [playoffConfig, setPlayoffConfig] = useState(savedState?.playoffConfig || getDefaultPlayoffConfig());
  
  // Balancer settings state
  const [balancerSettings, setBalancerSettings] = useState(savedState?.balancerSettings || getDefaultBalancerSettings());

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
      mapBiases,
      playoffConfig,
      balancerSettings
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }, [units, nonTokenUnits, weeks, selectedWeek, teamNames, pointSystem, manualAdjustments, eloSystem, eloBiasPercentages, unitPlayerCounts, divisions, mapBiases, playoffConfig, balancerSettings]);

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
      isSingleRoundLeads: false,
      leadA_r1: null,
      leadB_r1: null,
      leadA_r2: null,
      leadB_r2: null,
      r1CasualtiesA: 0,
      r1CasualtiesB: 0,
      r2CasualtiesA: 0,
      r2CasualtiesB: 0,
      unitPlayerCounts: inheritedUnitPlayerCounts,
      mapBiases: { ...mapBiases },
      eloBiasPercentages: { ...eloBiasPercentages },
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
      const isSingleRoundLeads = week.isSingleRoundLeads || false;

      // Process each round
      [1, 2].forEach(roundNum => {
        const winner = week[`round${roundNum}Winner`];
        if (!winner) return;

        const winningTeam = week[`team${winner}`];
        const losingTeam = week[`team${winner === 'A' ? 'B' : 'A'}`];

        // Get leads based on playoffs or single round leads mode
        let leadWinner, leadLoser;
        if (isPlayoffs || isSingleRoundLeads) {
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

        if (isSingleRoundLeads) {
          // For single round leads, both round leads get the lead bonus
          const r1Lead = week[`lead${week.round1Winner}_r1`];
          const r2Lead = week[`lead${week.round1Winner}_r2`];
          const sweepLeads = new Set([r1Lead, r2Lead].filter(Boolean));

          sweepTeam.forEach(unit => {
            // Skip non-token units
            if (!stats[unit]) return;

            if (sweepLeads.has(unit)) {
              stats[unit].points += pointSystem.bonus2_0Lead;
            } else {
              stats[unit].points += pointSystem.bonus2_0Assist;
            }
          });
        } else {
          // Regular week: use week-level lead
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
        if (nonTokenUnits.includes(unit)) return;
        tempStats[unit] = { points: 0 };
      });

      prevWeeks.forEach(week => {
        if (!week.round1Winner && !week.round2Winner) return;
        const isPlayoffs = week.isPlayoffs || false;
        const isSingleRoundLeads = week.isSingleRoundLeads || false;

        [1, 2].forEach(roundNum => {
          const winner = week[`round${roundNum}Winner`];
          if (!winner) return;

          const winningTeam = week[`team${winner}`];
          const losingTeam = week[`team${winner === 'A' ? 'B' : 'A'}`];

          let leadWinner, leadLoser;
          if (isPlayoffs || isSingleRoundLeads) {
            leadWinner = week[`lead${winner}_r${roundNum}`];
            leadLoser = week[`lead${winner === 'A' ? 'B' : 'A'}_r${roundNum}`];
          } else {
            leadWinner = week[`lead${winner}`];
            leadLoser = week[`lead${winner === 'A' ? 'B' : 'A'}`];
          }

          if (!isPlayoffs) {
            winningTeam.forEach(unit => {
              if (!tempStats[unit]) return;
              if (unit === leadWinner) {
                tempStats[unit].points += pointSystem.winLead;
              } else {
                tempStats[unit].points += pointSystem.winAssist;
              }
            });

            losingTeam.forEach(unit => {
              if (!tempStats[unit]) return;
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

          if (isSingleRoundLeads) {
            // For single round leads, both round leads get the lead bonus
            const r1Lead = week[`lead${week.round1Winner}_r1`];
            const r2Lead = week[`lead${week.round1Winner}_r2`];
            const sweepLeads = new Set([r1Lead, r2Lead].filter(Boolean));

            sweepTeam.forEach(unit => {
              if (!tempStats[unit]) return;
              if (sweepLeads.has(unit)) {
                tempStats[unit].points += pointSystem.bonus2_0Lead;
              } else {
                tempStats[unit].points += pointSystem.bonus2_0Assist;
              }
            });
          } else {
            // Regular week: use week-level lead
            const sweepLead = week[`lead${week.round1Winner}`];

            sweepTeam.forEach(unit => {
              if (!tempStats[unit]) return;
              if (unit === sweepLead) {
                tempStats[unit].points += pointSystem.bonus2_0Lead;
              } else {
                tempStats[unit].points += pointSystem.bonus2_0Assist;
              }
            });
          }
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
      
      // Calculate previous Elo ranks (exclude non-token units)
      const prevEloStandings = Object.entries(previousElo)
        .filter(([unit]) => !nonTokenUnits.includes(unit))
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
    const currentWeekIdx = selectedWeek ? weeks.findIndex(w => w.id === selectedWeek.id) : weeks.length - 1;
    const previousWeekIdx = currentWeekIdx - 1;
    
    const allStandings = getStandingsWithChanges();
    
    if (!divisions || divisions.length === 0) {
      return [{ name: 'All Units', units: allStandings }];
    }

    // Calculate previous week's group rankings for delta calculation
    let previousGroupRanks = {};
    if (previousWeekIdx >= 0) {
      const prevStats = calculatePointsUpToWeek(previousWeekIdx);
      const { eloRatings: prevElo } = calculateEloRatings(previousWeekIdx);
      
      const prevStandings = Object.entries(prevStats)
        .map(([unit, data]) => ({
          unit,
          ...data,
          elo: prevElo[unit] || eloSystem.initialElo
        }))
        .sort((a, b) => rankByElo ? b.elo - a.elo : b.points - a.points);
      
      // Calculate previous ranks within each division
      divisions.forEach(division => {
        const divisionUnits = new Set(division.units);
        const prevDivStandings = prevStandings
          .filter(stat => divisionUnits.has(stat.unit));
        
        prevDivStandings.forEach((stat, index) => {
          previousGroupRanks[`${division.name}:${stat.unit}`] = index + 1;
        });
      });
      
      // Handle unassigned units
      const assignedUnits = new Set(divisions.flatMap(d => d.units));
      const prevUnassigned = prevStandings
        .filter(stat => !assignedUnits.has(stat.unit));
      
      prevUnassigned.forEach((stat, index) => {
        previousGroupRanks[`Unassigned:${stat.unit}`] = index + 1;
      });
    }

    const grouped = divisions.map(division => {
      const divisionUnits = new Set(division.units);
      const divisionStandings = allStandings
        .filter(stat => divisionUnits.has(stat.unit))
        .map((stat, index) => {
          const currentRank = index + 1;
          const prevRank = previousGroupRanks[`${division.name}:${stat.unit}`] || null;
          
          // Check if current week is a playoff week
          const currentWeek = currentWeekIdx >= 0 ? weeks[currentWeekIdx] : null;
          const isCurrentWeekPlayoff = currentWeek?.isPlayoffs || false;
          
          // Calculate group-specific rank delta
          let groupRankDelta = null;
          if (!rankByElo && isCurrentWeekPlayoff) {
            groupRankDelta = null; // Don't show delta in playoffs when ranking by points
          } else if (prevRank !== null) {
            groupRankDelta = prevRank - currentRank;
          }
          
          return {
            ...stat,
            divisionRank: currentRank,
            rankDelta: groupRankDelta // Override with group-specific delta
          };
        });
      
      return {
        name: division.name,
        units: divisionStandings
      };
    });

    const assignedUnits = new Set(divisions.flatMap(d => d.units));
    const unassignedStandings = allStandings
      .filter(stat => !assignedUnits.has(stat.unit))
      .map((stat, index) => {
        const currentRank = index + 1;
        const prevRank = previousGroupRanks[`Unassigned:${stat.unit}`] || null;
        
        // Check if current week is a playoff week
        const currentWeek = currentWeekIdx >= 0 ? weeks[currentWeekIdx] : null;
        const isCurrentWeekPlayoff = currentWeek?.isPlayoffs || false;
        
        // Calculate group-specific rank delta
        let groupRankDelta = null;
        if (!rankByElo && isCurrentWeekPlayoff) {
          groupRankDelta = null;
        } else if (prevRank !== null) {
          groupRankDelta = prevRank - currentRank;
        }
        
        return {
          ...stat,
          divisionRank: currentRank,
          rankDelta: groupRankDelta // Override with group-specific delta
        };
      });
    
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
    // USA Attack Maps (same as used in Elo calculation)
    const usaAttackMaps = new Set([
      "East Woods Skirmish", "Nicodemus Hill", "Hooker's Push", "Bloody Lane",
      "Pry Ford", "Smith Field", "Alexander Farm", "Crossroads",
      "Wagon Road", "Hagertown Turnpike", "Pry Grist Mill", "Otto & Sherrick Farm",
      "Piper Farm", "West Woods", "Dunker Church", "Burnside Bridge",
      "Garland's Stand", "Cox's Push", "Hatch's Attack", "Colquitt's Defense",
      "Flemming's Meadow", "Crossley Creek", "Confederate Encampment"
    ]);

    const byMap = {};
    const overall = {
      totalRounds: 0,
      usaWins: 0, csaWins: 0,
      attackerWins: 0, defenderWins: 0,
      usaAttackWins: 0, usaAttackRounds: 0,
      usaDefenseWins: 0, usaDefenseRounds: 0,
      csaAttackWins: 0, csaAttackRounds: 0,
      csaDefenseWins: 0, csaDefenseRounds: 0
    };

    weeks.forEach(week => {
      [1, 2].forEach(roundNum => {
        const mapName = week[`round${roundNum}Map`];
        const winner = week[`round${roundNum}Winner`];
        const flipped = week[`round${roundNum}Flipped`] || false;
        const casualtiesA = week[`r${roundNum}CasualtiesA`] || 0;
        const casualtiesB = week[`r${roundNum}CasualtiesB`] || 0;

        if (!mapName || !winner) return;

        if (!byMap[mapName]) {
          byMap[mapName] = {
            plays: 0, usaWins: 0, csaWins: 0,
            attackerWins: 0, defenderWins: 0,
            totalCasualties: 0
          };
        }

        byMap[mapName].plays++;
        byMap[mapName].totalCasualties += casualtiesA + casualtiesB;
        overall.totalRounds++;

        // Determine USA/CSA sides based on flipped state
        const usaSide = flipped ? 'B' : 'A';
        const isUsaAttack = usaAttackMaps.has(mapName);
        const usaWon = winner === usaSide;
        const attackerWon = isUsaAttack ? usaWon : !usaWon;

        // USA/CSA wins
        if (usaWon) {
          byMap[mapName].usaWins++;
          overall.usaWins++;
        } else {
          byMap[mapName].csaWins++;
          overall.csaWins++;
        }

        // Attacker/Defender wins
        if (attackerWon) {
          byMap[mapName].attackerWins++;
          overall.attackerWins++;
        } else {
          byMap[mapName].defenderWins++;
          overall.defenderWins++;
        }

        // USA/CSA Attack/Defense breakdown
        if (isUsaAttack) {
          overall.usaAttackRounds++;
          overall.csaDefenseRounds++;
          if (usaWon) {
            overall.usaAttackWins++;
          } else {
            overall.csaDefenseWins++;
          }
        } else {
          overall.csaAttackRounds++;
          overall.usaDefenseRounds++;
          if (usaWon) {
            overall.usaDefenseWins++;
          } else {
            overall.csaAttackWins++;
          }
        }
      });
    });

    return { overall, byMap };
  };

  // Calculate per-unit per-map win/loss records from historical weeks
  const calculateUnitMapStats = (maxWeekIndex = null) => {
    const unitMapRecords = {}; // { unitName: { mapName: { wins, losses } } }

    const weeksToProcess = maxWeekIndex !== null
      ? weeks.slice(0, maxWeekIndex + 1)
      : weeks;

    weeksToProcess.forEach(week => {
      const teamAUnits = week.teamA || [];
      const teamBUnits = week.teamB || [];
      if (teamAUnits.length === 0 || teamBUnits.length === 0) return;

      [1, 2].forEach(roundNum => {
        const mapName = week[`round${roundNum}Map`];
        const winner = week[`round${roundNum}Winner`];
        if (!mapName || !winner) return;

        const winningUnits = winner === 'A' ? teamAUnits : teamBUnits;
        const losingUnits = winner === 'A' ? teamBUnits : teamAUnits;

        winningUnits.forEach(unit => {
          if (!unitMapRecords[unit]) unitMapRecords[unit] = {};
          if (!unitMapRecords[unit][mapName]) unitMapRecords[unit][mapName] = { wins: 0, losses: 0 };
          unitMapRecords[unit][mapName].wins++;
        });

        losingUnits.forEach(unit => {
          if (!unitMapRecords[unit]) unitMapRecords[unit] = {};
          if (!unitMapRecords[unit][mapName]) unitMapRecords[unit][mapName] = { wins: 0, losses: 0 };
          unitMapRecords[unit][mapName].losses++;
        });
      });
    });

    return unitMapRecords;
  };

  // Calculate win probability for a round combining Elo, global map history, and unit map history
  // Returns { teamAProb, teamBProb } as percentages (0-100)
  const calculateWinProbability = (teamA, teamB, mapName, flipped, weekIndex) => {
    if (teamA.length === 0 || teamB.length === 0) return null;

    const previousWeekIdx = weekIndex != null ? weekIndex - 1 : weeks.length - 1;

    // --- Factor 1: Elo-based expected outcome ---
    const { eloRatings } = previousWeekIdx >= 0
      ? calculateEloRatings(previousWeekIdx)
      : { eloRatings: {} };

    const getPlayerCt = (unit) => {
      const counts = weekIndex != null && weeks[weekIndex]?.unitPlayerCounts?.[unit]
        ? weeks[weekIndex].unitPlayerCounts[unit]
        : unitPlayerCounts[unit];
      if (!counts) return 25;
      const min = parseInt(counts.min) || 0;
      const max = parseInt(counts.max) || 0;
      return (min + max) / 2 || 25;
    };

    const totalPlayersA = teamA.reduce((sum, u) => sum + getPlayerCt(u), 0);
    const totalPlayersB = teamB.reduce((sum, u) => sum + getPlayerCt(u), 0);

    const avgEloA = totalPlayersA > 0
      ? teamA.reduce((sum, u) => sum + (eloRatings[u] || eloSystem.initialElo) * getPlayerCt(u), 0) / totalPlayersA
      : eloSystem.initialElo;
    const avgEloB = totalPlayersB > 0
      ? teamB.reduce((sum, u) => sum + (eloRatings[u] || eloSystem.initialElo) * getPlayerCt(u), 0) / totalPlayersB
      : eloSystem.initialElo;

    let eloProbA = 1 / (1 + Math.pow(10, (avgEloB - avgEloA) / 400));

    // Apply map bias to Elo probability (same logic as Elo calculation)
    if (mapName) {
      const week = weekIndex != null ? weeks[weekIndex] : null;
      const weekMapBiases = week?.mapBiases || mapBiases;
      const weekEloBiasPercentages = week?.eloBiasPercentages || eloBiasPercentages;
      const mapBiasLevel = weekMapBiases[mapName] ?? 0;

      const biasPercentMap = {
        0: 1.00,
        1: 1.0 + (weekEloBiasPercentages.lightAttacker / 100.0),
        1.5: 1.0 + (weekEloBiasPercentages.heavyAttacker / 100.0),
        2: 1.0 - (weekEloBiasPercentages.lightDefender / 100.0),
        2.5: 1.0 - (weekEloBiasPercentages.heavyDefender / 100.0)
      };
      const biasMultiplier = biasPercentMap[mapBiasLevel] ?? 1.0;

      const isUsaAttack = USA_ATTACK_MAPS.has(mapName);
      const usaSide = flipped ? 'B' : 'A';
      const attackerSide = isUsaAttack ? usaSide : (usaSide === 'A' ? 'B' : 'A');

      if (attackerSide === 'A') {
        eloProbA *= biasMultiplier;
      } else {
        eloProbA /= biasMultiplier;
      }
      eloProbA = Math.max(0.05, Math.min(0.95, eloProbA));
    }

    // --- Factor 2: Global map win rate (USA/CSA side history) ---
    let globalMapProbA = 0.5; // neutral if no map or no data
    if (mapName) {
      const { byMap } = calculateMapStats();
      const mapData = byMap[mapName];
      if (mapData && mapData.plays >= 2) {
        const usaSide = flipped ? 'B' : 'A';
        const usaWinRate = mapData.plays > 0 ? mapData.usaWins / mapData.plays : 0.5;
        // If team A is USA side, their global map probability is the USA win rate
        globalMapProbA = usaSide === 'A' ? usaWinRate : (1 - usaWinRate);
        // Regress toward 0.5 for small sample sizes (Bayesian shrinkage)
        const confidence = Math.min(1, mapData.plays / 10);
        globalMapProbA = 0.5 + (globalMapProbA - 0.5) * confidence;
      }
    }

    // --- Factor 3: Unit-specific map history ---
    let unitMapProbA = 0.5; // neutral if no data
    if (mapName) {
      const unitMapStats = calculateUnitMapStats(previousWeekIdx >= 0 ? previousWeekIdx : null);

      const getTeamMapWinRate = (team) => {
        let totalWins = 0;
        let totalGames = 0;
        team.forEach(unit => {
          const record = unitMapStats[unit]?.[mapName];
          if (record) {
            totalWins += record.wins;
            totalGames += record.wins + record.losses;
          }
        });
        if (totalGames === 0) return null;
        const raw = totalWins / totalGames;
        // Regress toward 0.5 for small samples
        const confidence = Math.min(1, totalGames / (team.length * 3));
        return 0.5 + (raw - 0.5) * confidence;
      };

      const teamAMapRate = getTeamMapWinRate(teamA);
      const teamBMapRate = getTeamMapWinRate(teamB);

      if (teamAMapRate !== null && teamBMapRate !== null) {
        // Both teams have data - combine their perspectives
        unitMapProbA = (teamAMapRate + (1 - teamBMapRate)) / 2;
      } else if (teamAMapRate !== null) {
        unitMapProbA = teamAMapRate;
      } else if (teamBMapRate !== null) {
        unitMapProbA = 1 - teamBMapRate;
      }
      // else stays 0.5
    }

    // --- Combine factors using log-odds (Bayesian-style) ---
    // Weights: Elo is primary, global map and unit map history are secondary signals
    const toLogOdds = (p) => Math.log(Math.max(0.01, Math.min(0.99, p)) / (1 - Math.max(0.01, Math.min(0.99, p))));
    const fromLogOdds = (lo) => 1 / (1 + Math.exp(-lo));

    const eloWeight = 1.0;
    const globalMapWeight = mapName ? 0.4 : 0;
    const unitMapWeight = mapName ? 0.35 : 0;
    const totalWeight = eloWeight + globalMapWeight + unitMapWeight;

    const combinedLogOdds = (
      toLogOdds(eloProbA) * eloWeight +
      toLogOdds(globalMapProbA) * globalMapWeight +
      toLogOdds(unitMapProbA) * unitMapWeight
    ) / totalWeight;

    let combinedProbA = fromLogOdds(combinedLogOdds);
    combinedProbA = Math.max(0.05, Math.min(0.95, combinedProbA));

    return {
      teamAProb: Math.round(combinedProbA * 1000) / 10,
      teamBProb: Math.round((1 - combinedProbA) * 1000) / 10,
      factors: {
        elo: { probA: Math.round(eloProbA * 1000) / 10 },
        globalMap: mapName ? { probA: Math.round(globalMapProbA * 1000) / 10 } : null,
        unitMap: mapName ? { probA: Math.round(unitMapProbA * 1000) / 10 } : null
      }
    };
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
      const isSingleRoundLeads = week.isSingleRoundLeads || false;

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
        if (isPlayoffs || isSingleRoundLeads) {
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
        // Use per-week snapshots if available, fall back to global state for backward compatibility
        const mapName = week[`round${roundNum}Map`];
        if (mapName) {
          const weekMapBiases = week.mapBiases || mapBiases;
          const weekEloBiasPercentages = week.eloBiasPercentages || eloBiasPercentages;
          const mapBiasLevel = weekMapBiases[mapName] ?? 0;

          // Build bias multiplier map from percentages
          const biasPercentMap = {
            0: 1.00,
            1: 1.0 + (weekEloBiasPercentages.lightAttacker / 100.0),
            1.5: 1.0 + (weekEloBiasPercentages.heavyAttacker / 100.0),
            2: 1.0 - (weekEloBiasPercentages.lightDefender / 100.0),
            2.5: 1.0 - (weekEloBiasPercentages.heavyDefender / 100.0)
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

  const closeBalancerModal = () => {
    if (selectedWeek && Object.keys(balancerUnitCounts).length > 0) {
      updateWeek(selectedWeek.id, {
        ...selectedWeek,
        unitPlayerCounts: { ...balancerUnitCounts }
      });
      setUnitPlayerCounts(prev => ({
        ...prev,
        ...balancerUnitCounts
      }));
    }
    setShowBalancerModal(false);
    setBalancerResults(null);
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
        teammate,
        divisions
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
          combinedAvgHistory: stats.combinedAvgHistory,
          round1Probability: stats.round1Probability,
          round2Probability: stats.round2Probability
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

  const balanceTeams = (available, unitCounts, opposingPairs, maxPlayerDiff, teammateHistory, divisionsList = []) => {
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

    // Build unit-to-division lookup for division opposition scoring
    const unitDivision = {};
    if (balancerSettings.divisionOppositionWeight > 0 && divisionsList.length > 0) {
      divisionsList.forEach(div => {
        div.units.forEach(unit => { unitDivision[unit] = div.name; });
      });
    }

    let bestSolution = {
      score: Infinity,
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
              
              // Apply penalty multiplier for over-teaming, otherwise use base count
              if (averageTeammateCount > 0 && count > overTeamingThreshold) {
                teammateScore += count * overTeamingPenaltyMultiplier;
              } else {
                teammateScore += count;
              }
            }
          }
        };

        calculatePairScore(teamA);
        calculatePairScore(teamB);

        // Calculate division opposition score (negative = more same-division pairs opposing, which is good)
        let divisionOppositionScore = 0;
        if (balancerSettings.divisionOppositionWeight > 0 && Object.keys(unitDivision).length > 0) {
          const teamAArray = [...teamA];
          const teamBArray = [...teamB];
          for (const uA of teamAArray) {
            const divA = unitDivision[uA];
            if (!divA) continue;
            for (const uB of teamBArray) {
              if (unitDivision[uB] === divA) divisionOppositionScore--;
            }
          }
        }

        // Calculate composite score accounting for all metrics together
        const currentScore = (teammateScore * balancerSettings.teammateWeight) +
                            (avgDiff * balancerSettings.avgDiffWeight) +
                            (gap * balancerSettings.gapWeight) +
                            (minDiff * balancerSettings.minDiffWeight) +
                            (divisionOppositionScore * balancerSettings.divisionOppositionWeight);

        if (currentScore < bestSolution.score) {
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
      const [teamA, teamB] = bestSolution.teams;
      const [minA, maxA, minB, maxB] = bestSolution.stats;
      
      // Calculate individual metrics for validation
      let gap = 0;
      if (maxA < minB) {
        gap = minB - maxA;
      } else if (maxB < minA) {
        gap = minA - maxB;
      }
      const minDiff = Math.abs(minA - minB);
      const avgA = (minA + maxA) / 2;
      const avgB = (minB + maxB) / 2;
      const avgDiff = Math.abs(avgA - avgB);
      
      if (gap <= maxPlayerDiff && minDiff <= maxPlayerDiff) {
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
    setPlayoffConfig(getDefaultPlayoffConfig());
    setBalancerSettings(getDefaultBalancerSettings());
    
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
      playoffConfig,
      balancerSettings,
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
              isSingleRoundLeads: week.single_round_leads || false,
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
        
        // Handle map biases - convert string values to numbers
        let importedMapBiases = getDefaultMapBiases();
        const rawMapBiases = data.mapBiases || data.map_biases || {};
        Object.entries(rawMapBiases).forEach(([mapName, biasValue]) => {
          importedMapBiases[mapName] = parseFloat(biasValue) || 0;
        });

        setUnits(data.units || []);
        setNonTokenUnits(data.nonTokenUnits || data.non_token_units || []);
        setWeeks(stampWeekBiases(importedWeeks, importedMapBiases, importedEloBiasPercentages));
        setTeamNames(importedTeamNames);
        setPointSystem(importedPointSystem);
        setManualAdjustments(importedManualAdjustments);
        setEloSystem(importedEloSystem);
        setEloBiasPercentages(importedEloBiasPercentages);
        setUnitPlayerCounts(importedUnitPlayerCounts);

        // Handle divisions
        const importedDivisions = data.divisions || [];
        setDivisions(importedDivisions);

        setMapBiases(importedMapBiases);
        
        // Handle playoff configuration - always use default if not present
        const importedPlayoffConfig = data.playoffConfig || getDefaultPlayoffConfig();
        setPlayoffConfig(importedPlayoffConfig);
        
        // Handle balancer settings - use default if not present (backwards compatibility)
        const importedBalancerSettings = data.balancerSettings || getDefaultBalancerSettings();
        setBalancerSettings(importedBalancerSettings);
        
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

    // Calculate weeks where each unit was active
    const unitActiveWeeks = {};
    activeUnits.forEach(unit => {
      unitActiveWeeks[unit] = weeks.filter(week =>
        week.teamA.includes(unit) || week.teamB.includes(unit)
      ).length;
    });

    // Build heatmap matrix with relative percentages
    activeUnits.forEach(unit1 => {
      activeUnits.forEach(unit2 => {
        if (unit1 !== unit2) {
          const count = teammate[unit1]?.[unit2] || 0;
          // Calculate the minimum weeks both units were active
          const bothActiveWeeks = Math.min(unitActiveWeeks[unit1] || 0, unitActiveWeeks[unit2] || 0);
          
          if (count > 0 || bothActiveWeeks > 0) {
            heatmapData.push({
              unit1,
              unit2,
              count,
              bothActiveWeeks
            });
          }
        }
      });
    });

    return { heatmapData, activeUnits, unitActiveWeeks };
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

    // Calculate win probabilities for each round if week is selected
    let round1Probability = null;
    let round2Probability = null;
    if (selectedWeek && teamA.length > 0 && teamB.length > 0) {
      const weekIdx = weeks.findIndex(w => w.id === selectedWeek.id);
      const round1Map = selectedWeek.round1Map;
      const round1Flipped = selectedWeek.round1Flipped || false;
      const round2Map = selectedWeek.round2Map;
      const round2Flipped = selectedWeek.round2Flipped || false;
      round1Probability = calculateWinProbability(teamA, teamB, round1Map, round1Flipped, weekIdx);
      round2Probability = calculateWinProbability(teamA, teamB, round2Map, round2Flipped, weekIdx);
    }

    return { minA, maxA, minB, maxB, avgDiff, minDiff, avgHistoryA, avgHistoryB, combinedAvgHistory, round1Probability, round2Probability };
  };

  // Calculate team balance stats for current week assignments
  // Get division matchups between two teams (same-division units on opposing teams)
  const getDivisionMatchups = (teamA, teamB) => {
    if (divisions.length === 0) return [];
    const unitDiv = {};
    divisions.forEach(div => {
      div.units.forEach(unit => { unitDiv[unit] = div.name; });
    });
    const matchups = [];
    for (const uA of teamA) {
      const divA = unitDiv[uA];
      if (!divA) continue;
      for (const uB of teamB) {
        if (unitDiv[uB] === divA) {
          matchups.push({ unitA: uA, unitB: uB, division: divA });
        }
      }
    }
    return matchups;
  };

  const calculateWeekTeamStats = () => {
    if (!selectedWeek) return null;
    
    const weekIdx = weeks.findIndex(w => w.id === selectedWeek.id);
    const teamA = selectedWeek.teamA || [];
    const teamB = selectedWeek.teamB || [];
    
    if (teamA.length === 0 && teamB.length === 0) return null;
    
    // Get unit player counts for this week
    const getPlayerCount = (unit) => {
      const counts = selectedWeek.unitPlayerCounts?.[unit] || unitPlayerCounts[unit];
      if (!counts) return 0;
      const min = parseInt(counts.min) || 0;
      const max = parseInt(counts.max) || 0;
      return (min + max) / 2;
    };
    
    const minA = teamA.reduce((sum, u) => sum + (selectedWeek.unitPlayerCounts?.[u]?.min || unitPlayerCounts[u]?.min || 0), 0);
    const maxA = teamA.reduce((sum, u) => sum + (selectedWeek.unitPlayerCounts?.[u]?.max || unitPlayerCounts[u]?.max || 0), 0);
    const minB = teamB.reduce((sum, u) => sum + (selectedWeek.unitPlayerCounts?.[u]?.min || unitPlayerCounts[u]?.min || 0), 0);
    const maxB = teamB.reduce((sum, u) => sum + (selectedWeek.unitPlayerCounts?.[u]?.max || unitPlayerCounts[u]?.max || 0), 0);
    
    const avgA = (minA + maxA) / 2;
    const avgB = (minB + maxB) / 2;
    const avgDiff = Math.abs(avgA - avgB);
    const minDiff = Math.abs(minA - minB);
    const maxDiff = Math.abs(maxA - maxB);
    const totalMin = minA + minB;
    const totalMax = maxA + maxB;
    const totalAvg = avgA + avgB;
    
    // Calculate average teammate history for each team
    // Only count weeks BEFORE the current week (same as balancer)
    const teammate = {};
    
    weeks.forEach((week, idx) => {
      // Skip current week and all weeks after it
      if (idx >= weekIdx) return;
      
      const wTeamA = week.teamA || [];
      const wTeamB = week.teamB || [];

      // Teammates in Team A
      wTeamA.forEach(unit1 => {
        if (!teammate[unit1]) teammate[unit1] = {};
        wTeamA.forEach(unit2 => {
          if (unit1 !== unit2) {
            teammate[unit1][unit2] = (teammate[unit1][unit2] || 0) + 1;
          }
        });
      });

      // Teammates in Team B
      wTeamB.forEach(unit1 => {
        if (!teammate[unit1]) teammate[unit1] = {};
        wTeamB.forEach(unit2 => {
          if (unit1 !== unit2) {
            teammate[unit1][unit2] = (teammate[unit1][unit2] || 0) + 1;
          }
        });
      });
    });
    
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

    // Calculate win probabilities for each round
    const round1Map = selectedWeek.round1Map;
    const round1Flipped = selectedWeek.round1Flipped || false;
    const round2Map = selectedWeek.round2Map;
    const round2Flipped = selectedWeek.round2Flipped || false;

    const round1Probability = (teamA.length > 0 && teamB.length > 0)
      ? calculateWinProbability(teamA, teamB, round1Map, round1Flipped, weekIdx)
      : null;
    const round2Probability = (teamA.length > 0 && teamB.length > 0)
      ? calculateWinProbability(teamA, teamB, round2Map, round2Flipped, weekIdx)
      : null;

    return {
      teamA,
      teamB,
      minA,
      maxA,
      minB,
      maxB,
      avgA,
      avgB,
      avgDiff,
      minDiff,
      maxDiff,
      totalMin,
      totalMax,
      totalAvg,
      avgHistoryA,
      avgHistoryB,
      combinedAvgHistory,
      round1Probability,
      round2Probability
    };
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
      combinedAvgHistory: newStats.combinedAvgHistory,
      round1Probability: newStats.round1Probability,
      round2Probability: newStats.round2Probability
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

  // Simulation Functions
  const calculatePointAnalytics = (simulatedWeeks) => {
    const tokenUnits = units.filter(u => !nonTokenUnits.includes(u));
    if (tokenUnits.length === 0) return null;

    // Track points per unit (simulated)
    const unitStats = {};
    tokenUnits.forEach(unit => {
      unitStats[unit] = { leadPoints: 0, assistPoints: 0 };
    });

    let totalRounds = 0;

    // Calculate actual points from simulated weeks
    simulatedWeeks.forEach(week => {
      if (week.round1Winner && week.round2Winner) {
        totalRounds += 2;

        // Process each round
        [1, 2].forEach(roundNum => {
          const winner = roundNum === 1 ? week.round1Winner : week.round2Winner;
          const winningTeam = winner === 'A' ? week.teamA : week.teamB;
          const losingTeam = winner === 'A' ? week.teamB : week.teamA;

          // Determine leads for this round
          let leadWinner, leadLoser;
          if (week.isSingleRoundLeads) {
            leadWinner = week[`lead${winner}_r${roundNum}`];
            leadLoser = week[`lead${winner === 'A' ? 'B' : 'A'}_r${roundNum}`];
          } else {
            leadWinner = week[`lead${winner}`];
            leadLoser = week[`lead${winner === 'A' ? 'B' : 'A'}`];
          }

          // Award win points
          winningTeam.forEach(unit => {
            if (!unitStats[unit]) return;
            if (unit === leadWinner) {
              unitStats[unit].leadPoints += pointSystem.winLead;
            } else {
              unitStats[unit].assistPoints += pointSystem.winAssist;
            }
          });

          // Award loss points
          losingTeam.forEach(unit => {
            if (!unitStats[unit]) return;
            if (unit === leadLoser) {
              unitStats[unit].leadPoints += pointSystem.lossLead;
            } else {
              unitStats[unit].assistPoints += pointSystem.lossAssist;
            }
          });
        });

        // Check for sweep bonus
        if (week.round1Winner === week.round2Winner) {
          const sweepTeam = week.round1Winner === 'A' ? week.teamA : week.teamB;

          if (week.isSingleRoundLeads) {
            const sweepLeads = new Set([
              week[`lead${week.round1Winner}_r1`],
              week[`lead${week.round1Winner}_r2`]
            ].filter(Boolean));

            sweepTeam.forEach(unit => {
              if (!unitStats[unit]) return;
              if (sweepLeads.has(unit)) {
                unitStats[unit].leadPoints += pointSystem.bonus2_0Lead;
              } else {
                unitStats[unit].assistPoints += pointSystem.bonus2_0Assist;
              }
            });
          } else {
            const sweepLead = week[`lead${week.round1Winner}`];
            sweepTeam.forEach(unit => {
              if (!unitStats[unit]) return;
              if (unit === sweepLead) {
                unitStats[unit].leadPoints += pointSystem.bonus2_0Lead;
              } else {
                unitStats[unit].assistPoints += pointSystem.bonus2_0Assist;
              }
            });
          }
        }
      }
    });

    // Calculate average per token unit
    let totalLeadPoints = 0;
    let totalAssistPoints = 0;
    tokenUnits.forEach(unit => {
      totalLeadPoints += unitStats[unit].leadPoints;
      totalAssistPoints += unitStats[unit].assistPoints;
    });

    const avgLeadPoints = totalLeadPoints / tokenUnits.length;
    const avgAssistPoints = totalAssistPoints / tokenUnits.length;
    const avgTotalPoints = avgLeadPoints + avgAssistPoints;
    const avgLeadPercentage = avgTotalPoints > 0 ? (avgLeadPoints / avgTotalPoints * 100) : 0;
    const avgAssistPercentage = avgTotalPoints > 0 ? (avgAssistPoints / avgTotalPoints * 100) : 0;

    // Calculate theoretical per token unit - MAX POSSIBLE POINTS
    // Determine lead rounds per unit based on mode
    const leadRoundsPerUnit = simLeadMode === 'rounds'
      ? simLeadNightsPerUnit  // In rounds mode: each night = 1 round as lead
      : simLeadNightsPerUnit * 2;  // In fullWeeks mode: each night = 2 rounds as lead

    const assistRoundsPerUnit = totalRounds - leadRoundsPerUnit;

    // Determine weeks as lead vs assist
    const totalWeeks = simulatedWeeks.length;
    const weeksAsLead = simLeadMode === 'rounds'
      ? simLeadNightsPerUnit * 2  // In rounds mode: lead 1 round per week for 2x weeks
      : simLeadNightsPerUnit;  // In fullWeeks mode: lead both rounds for X weeks

    const weeksAsAssist = totalWeeks - weeksAsLead;

    // Max possible points (win every round, win every sweep)
    const maxLeadPointsFromRounds = leadRoundsPerUnit * pointSystem.winLead;
    const maxAssistPointsFromRounds = assistRoundsPerUnit * pointSystem.winAssist;
    const maxLeadSweepBonus = weeksAsLead * pointSystem.bonus2_0Lead;
    const maxAssistSweepBonus = weeksAsAssist * pointSystem.bonus2_0Assist;

    // Total max theoretical points per unit
    const theoreticalLeadPoints = maxLeadPointsFromRounds + maxLeadSweepBonus;
    const theoreticalAssistPoints = maxAssistPointsFromRounds + maxAssistSweepBonus;
    const theoreticalTotalPoints = theoreticalLeadPoints + theoreticalAssistPoints;

    const theoreticalLeadPercentage = theoreticalTotalPoints > 0 ? (theoreticalLeadPoints / theoreticalTotalPoints * 100) : 0;
    const theoreticalAssistPercentage = theoreticalTotalPoints > 0 ? (theoreticalAssistPoints / theoreticalTotalPoints * 100) : 0;

    return {
      simulated: {
        leadPoints: avgLeadPoints,
        assistPoints: avgAssistPoints,
        totalPoints: avgTotalPoints,
        leadPercentage: avgLeadPercentage,
        assistPercentage: avgAssistPercentage,
        totalLeadPoints,
        totalAssistPoints,
        totalTotalPoints: totalLeadPoints + totalAssistPoints
      },
      theoretical: {
        leadPoints: theoreticalLeadPoints,
        assistPoints: theoreticalAssistPoints,
        totalPoints: theoreticalTotalPoints,
        leadPercentage: theoreticalLeadPercentage,
        assistPercentage: theoreticalAssistPercentage
      },
      totalRounds,
      totalWeeks
    };
  };

  const simulateSeason = () => {
    if (units.length === 0) {
      alert('Please add units before simulating a season.');
      return;
    }

    const tokenUnits = units.filter(u => !nonTokenUnits.includes(u));
    if (tokenUnits.length === 0) {
      alert('Please add at least one token unit before simulating.');
      return;
    }

    if (simLeadNightsPerUnit <= 0) {
      alert('Invalid simulation settings. Lead nights per unit must be greater than 0.');
      return;
    }

    // Get division mapping
    const unitToDivision = {};
    divisions.forEach(division => {
      division.units.forEach(unit => {
        unitToDivision[unit] = division.name;
      });
    });

    // Try multiple simulation attempts to find the best valid schedule
    const MAX_ATTEMPTS = 100;
    let bestSchedule = null;
    let bestScore = -1;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const schedule = tryGenerateSchedule(tokenUnits, unitToDivision);
      
      if (schedule) {
        // Score based on how many units got their full allocation
        const unitsWithFullAllocation = tokenUnits.filter(u => schedule.unitLeadCounts[u] === simLeadNightsPerUnit).length;
        const score = unitsWithFullAllocation;
        
        if (score > bestScore) {
          bestScore = score;
          bestSchedule = schedule;
        }
        
        // If we found a perfect schedule, use it
        if (score === tokenUnits.length) {
          break;
        }
      }
    }

    if (!bestSchedule || bestSchedule.weeks.length === 0) {
      alert('Could not generate a valid schedule. Try adjusting your settings (fewer lead nights per unit or division requirements).');
      return;
    }

    // Check if any units didn't get their full allocation
    const unitsShort = tokenUnits.filter(u => bestSchedule.unitLeadCounts[u] < simLeadNightsPerUnit);
    if (unitsShort.length > 0) {
      const shortList = unitsShort.map(u => `${u} (${bestSchedule.unitLeadCounts[u]}/${simLeadNightsPerUnit})`).join(', ');
      if (!confirm(`Warning: Some units didn't get their full lead night allocation:\n${shortList}\n\nDo you want to use this schedule anyway?`)) {
        return;
      }
    }

    // Convert schedule to weeks
    const simulatedWeeks = bestSchedule.weeks.map((weekData, i) => {
      // Inherit unit player counts from last week or use global defaults
      let inheritedUnitPlayerCounts = {};
      if (weeks.length > 0) {
        const lastWeek = weeks[weeks.length - 1];
        inheritedUnitPlayerCounts = lastWeek.unitPlayerCounts ? { ...lastWeek.unitPlayerCounts } : { ...unitPlayerCounts };
      } else {
        inheritedUnitPlayerCounts = { ...unitPlayerCounts };
      }

      // Handle schedule-only mode
      let teamA, teamB;
      if (simScheduleOnly) {
        // In schedule-only mode, only show the lead units
        if (weekData.isSingleRoundLeads) {
          teamA = [weekData.leadA_r1, weekData.leadA_r2].filter(Boolean);
          teamB = [weekData.leadB_r1, weekData.leadB_r2].filter(Boolean);
        } else {
          teamA = [weekData.leadA];
          teamB = [weekData.leadB];
        }
      } else {
        // In simulation mode, use full balanced teams
        teamA = weekData.teamA;
        teamB = weekData.teamB;
      }

      return {
        id: Date.now() + i,
        name: `Week ${weeks.length + 1 + i}`,
        teamA,
        teamB,
        round1Winner: simScheduleOnly ? null : weekData.round1Winner,
        round2Winner: simScheduleOnly ? null : weekData.round2Winner,
        round1Map: simScheduleOnly ? null : weekData.round1Map,
        round2Map: simScheduleOnly ? null : weekData.round2Map,
        round1Flipped: simScheduleOnly ? false : weekData.round1Flipped,
        round2Flipped: simScheduleOnly ? false : weekData.round2Flipped,
        leadA: weekData.leadA || null,
        leadB: weekData.leadB || null,
        isPlayoffs: false,
        isSingleRoundLeads: weekData.isSingleRoundLeads || false,
        leadA_r1: weekData.leadA_r1 || null,
        leadB_r1: weekData.leadB_r1 || null,
        leadA_r2: weekData.leadA_r2 || null,
        leadB_r2: weekData.leadB_r2 || null,
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
    });

    // Add simulated weeks to existing weeks
    setWeeks([...weeks, ...simulatedWeeks]);
    setShowSimulateModal(false);

    // Calculate and show analytics (only if not schedule-only mode)
    if (!simScheduleOnly) {
      const analytics = calculatePointAnalytics(simulatedWeeks);
      setSimulationAnalytics(analytics);
      setShowAnalyticsModal(true);
    } else {
      alert(`Successfully simulated ${simulatedWeeks.length} weeks!`);
    }
  };

  // Helper function to try generating a valid schedule
  const tryGenerateSchedule = (tokenUnits, unitToDivision) => {
    const leadMatchups = new Set();
    const unitLeadCounts = {};
    const unitDivisionLeadCounts = {};
    const teammatePairings = {}; // Track how many times units have been on same team

    tokenUnits.forEach(unit => {
      unitLeadCounts[unit] = 0;
      unitDivisionLeadCounts[unit] = 0;
      teammatePairings[unit] = {};
    });

    const generatedWeeks = [];
    // In 'rounds' mode, we need 2x matchups since each unit leads individual rounds, not full weeks
    const matchupsPerWeek = simLeadMode === 'rounds' ? 2 : 1;
    const maxWeeks = simLeadMode === 'rounds'
      ? tokenUnits.length * simLeadNightsPerUnit // Each unit leads X rounds, 2 matchups per week
      : tokenUnits.length * simLeadNightsPerUnit; // Each unit leads X full weeks
    
    // Try to generate weeks until we can't find valid matchups
    for (let i = 0; i < maxWeeks * 2; i++) { // Allow extra iterations to find matchups
      // Find units that still need lead nights (respecting hard limit)
      const unitsNeedingLeads = tokenUnits.filter(u => unitLeadCounts[u] < simLeadNightsPerUnit);
      
      if (unitsNeedingLeads.length === 0) break;
      if (unitsNeedingLeads.length === 1) {
        // Can't make a matchup with only one unit
        break;
      }

      // Prioritize units with fewer lead nights
      unitsNeedingLeads.sort((a, b) => unitLeadCounts[a] - unitLeadCounts[b]);
      
      // Try to find a valid matchup
      let leadA = null;
      let leadB = null;
      let foundMatch = false;

      // Try different lead A candidates
      for (let aIdx = 0; aIdx < Math.min(unitsNeedingLeads.length, 5); aIdx++) {
        const candidateA = unitsNeedingLeads[aIdx];
        
        // Find valid opponents for this candidate
        const validOpponents = unitsNeedingLeads.filter(u => {
          if (u === candidateA) return false;
          
          // Check if matchup already exists
          const matchup1 = `${candidateA}-vs-${u}`;
          const matchup2 = `${u}-vs-${candidateA}`;
          if (leadMatchups.has(matchup1) || leadMatchups.has(matchup2)) return false;
          
          // Check division requirements
          if (simLeadNightsInDivision > 0) {
            const aDivision = unitToDivision[candidateA];
            const uDivision = unitToDivision[u];
            
            // If both units have divisions and they're the same
            if (aDivision && uDivision && aDivision === uDivision) {
              // Prioritize division matchups if either unit needs them
              if (unitDivisionLeadCounts[candidateA] < simLeadNightsInDivision ||
                  unitDivisionLeadCounts[u] < simLeadNightsInDivision) {
                return true;
              }
            }
            
            // If we need division matchups but this isn't one, only allow if both quotas are met
            if (aDivision && uDivision && aDivision !== uDivision) {
              return unitDivisionLeadCounts[candidateA] >= simLeadNightsInDivision &&
                     unitDivisionLeadCounts[u] >= simLeadNightsInDivision;
            }
          }
          
          return true;
        });

        if (validOpponents.length > 0) {
          leadA = candidateA;
          // Prefer opponents who also need more lead nights
          validOpponents.sort((a, b) => unitLeadCounts[a] - unitLeadCounts[b]);
          leadB = validOpponents[0];
          foundMatch = true;
          break;
        }
      }

      if (!foundMatch) {
        // Try allowing repeat matchups if we're stuck
        for (let aIdx = 0; aIdx < Math.min(unitsNeedingLeads.length, 5); aIdx++) {
          const candidateA = unitsNeedingLeads[aIdx];
          
          const validOpponents = unitsNeedingLeads.filter(u => {
            if (u === candidateA) return false;
            
            // Check division requirements (still enforce these)
            if (simLeadNightsInDivision > 0) {
              const aDivision = unitToDivision[candidateA];
              const uDivision = unitToDivision[u];
              
              if (aDivision && uDivision && aDivision === uDivision) {
                if (unitDivisionLeadCounts[candidateA] < simLeadNightsInDivision ||
                    unitDivisionLeadCounts[u] < simLeadNightsInDivision) {
                  return true;
                }
              }
              
              if (aDivision && uDivision && aDivision !== uDivision) {
                return unitDivisionLeadCounts[candidateA] >= simLeadNightsInDivision &&
                       unitDivisionLeadCounts[u] >= simLeadNightsInDivision;
              }
            }
            
            return true;
          });

          if (validOpponents.length > 0) {
            leadA = candidateA;
            validOpponents.sort((a, b) => unitLeadCounts[a] - unitLeadCounts[b]);
            leadB = validOpponents[0];
            foundMatch = true;
            break;
          }
        }
      }

      if (!foundMatch) {
        // Can't find any valid matchup, stop here
        break;
      }

      // Record the matchup
      leadMatchups.add(`${leadA}-vs-${leadB}`);
      unitLeadCounts[leadA]++;
      unitLeadCounts[leadB]++;
      
      // Track division matchups
      const leadADivision = unitToDivision[leadA];
      const leadBDivision = unitToDivision[leadB];
      if (leadADivision && leadBDivision && leadADivision === leadBDivision) {
        unitDivisionLeadCounts[leadA]++;
        unitDivisionLeadCounts[leadB]++;
      }

      // Store the matchup (we'll convert to weeks later)
      generatedWeeks.push({
        leadA,
        leadB
      });
    }

    // Helper: Record that two units were on the same team
    const recordPairing = (unit1, unit2) => {
      if (unit1 === unit2) return;
      const [u1, u2] = [unit1, unit2].sort(); // Ensure consistent ordering
      if (!teammatePairings[u1]) teammatePairings[u1] = {};
      if (!teammatePairings[u2]) teammatePairings[u2] = {};
      teammatePairings[u1][u2] = (teammatePairings[u1][u2] || 0) + 1;
      teammatePairings[u2][u1] = (teammatePairings[u2][u1] || 0) + 1;
    };

    // Helper: Get pairing count between two units
    const getPairingCount = (unit1, unit2) => {
      if (unit1 === unit2) return 0;
      return teammatePairings[unit1]?.[unit2] || 0;
    };

    // Helper: Calculate total pairing score for a unit with a team
    // Lower score = less over-teaming = better variety
    const calculateTeamScore = (unit, team) => {
      return team.reduce((sum, teammate) => sum + getPairingCount(unit, teammate), 0);
    };

    // Helper: Distribute remaining units across teams with balancing
    const distributeUnitsBalanced = (remainingUnits, teamA, teamB) => {
      // Sort units by their total pairing history (least paired first)
      const unitsByPairings = remainingUnits.map(u => ({
        unit: u,
        totalPairings: Object.values(teammatePairings[u] || {}).reduce((sum, count) => sum + count, 0)
      })).sort((a, b) => a.totalPairings - b.totalPairings);

      // Assign each unit to the team with lower pairing score
      unitsByPairings.forEach(({ unit }) => {
        const scoreA = calculateTeamScore(unit, teamA);
        const scoreB = calculateTeamScore(unit, teamB);

        if (scoreA <= scoreB) {
          teamA.push(unit);
        } else {
          teamB.push(unit);
        }
      });

      // Record all pairings for both teams
      for (let i = 0; i < teamA.length; i++) {
        for (let j = i + 1; j < teamA.length; j++) {
          recordPairing(teamA[i], teamA[j]);
        }
      }
      for (let i = 0; i < teamB.length; i++) {
        for (let j = i + 1; j < teamB.length; j++) {
          recordPairing(teamB[i], teamB[j]);
        }
      }
    };

    // Convert matchups to week structures based on mode
    const finalWeeks = [];

    if (simLeadMode === 'rounds') {
      // In rounds mode, pair up matchups into weeks with balanced lead pairings
      const availableMatchups = [...generatedWeeks];
      const leadPairings = {}; // Track how often leads are teammates

      // Initialize lead pairings tracker
      tokenUnits.forEach(unit => {
        leadPairings[unit] = {};
      });

      // Helper: Get pairing count between two lead units
      const getLeadPairingCount = (lead1, lead2) => {
        if (lead1 === lead2) return 0;
        return leadPairings[lead1]?.[lead2] || 0;
      };

      // Helper: Record lead pairing
      const recordLeadPairing = (lead1, lead2) => {
        if (lead1 === lead2) return;
        if (!leadPairings[lead1]) leadPairings[lead1] = {};
        if (!leadPairings[lead2]) leadPairings[lead2] = {};
        leadPairings[lead1][lead2] = (leadPairings[lead1][lead2] || 0) + 1;
        leadPairings[lead2][lead1] = (leadPairings[lead2][lead1] || 0) + 1;
      };

      // Helper: Calculate pairing score for combining two matchups
      // Returns [sameTeamScore, opponentScore] - lower is better
      const calculateMatchupPairingScore = (m1, m2) => {
        // Score for leads being on same team
        const sameTeamScoreA = getLeadPairingCount(m1.leadA, m2.leadA) + getLeadPairingCount(m1.leadB, m2.leadB);
        const sameTeamScoreB = getLeadPairingCount(m1.leadA, m2.leadB) + getLeadPairingCount(m1.leadB, m2.leadA);

        // Also consider if leads have faced each other as opponents
        const opponentScoreA = getLeadPairingCount(m1.leadA, m2.leadB) + getLeadPairingCount(m1.leadB, m2.leadA);
        const opponentScoreB = getLeadPairingCount(m1.leadA, m2.leadA) + getLeadPairingCount(m1.leadB, m2.leadB);

        // Return best orientation (A=normal, B=flipped)
        const scoreA = { same: sameTeamScoreA, opponent: opponentScoreA, flip: false };
        const scoreB = { same: sameTeamScoreB, opponent: opponentScoreB, flip: true };

        // Prefer lower same-team score (primary), then higher opponent variety (secondary)
        if (scoreA.same !== scoreB.same) {
          return scoreA.same < scoreB.same ? scoreA : scoreB;
        }
        return scoreA.opponent > scoreB.opponent ? scoreA : scoreB;
      };

      // Greedily pair matchups to minimize lead repetition
      while (availableMatchups.length >= 2) {
        const matchup1 = availableMatchups.shift();

        // Find best partner for matchup1
        let bestIdx = 0;
        let bestScore = null;

        for (let i = 0; i < availableMatchups.length; i++) {
          const score = calculateMatchupPairingScore(matchup1, availableMatchups[i]);

          if (!bestScore ||
              score.same < bestScore.same ||
              (score.same === bestScore.same && score.opponent > bestScore.opponent)) {
            bestScore = score;
            bestIdx = i;
          }
        }

        const matchup2 = availableMatchups.splice(bestIdx, 1)[0];
        const shouldFlip = bestScore.flip;

        // Assign leads based on best orientation
        const teamA_lead1 = matchup1.leadA;
        const teamB_lead1 = matchup1.leadB;
        const teamA_lead2 = shouldFlip ? matchup2.leadB : matchup2.leadA;
        const teamB_lead2 = shouldFlip ? matchup2.leadA : matchup2.leadB;

        // Record lead pairings
        recordLeadPairing(teamA_lead1, teamA_lead2);
        recordLeadPairing(teamB_lead1, teamB_lead2);

        // Create teams by combining all units from both matchups
        const allLeads = [teamA_lead1, teamB_lead1, teamA_lead2, teamB_lead2];
        const remainingUnits = units.filter(u => !allLeads.includes(u));

        const teamA = [teamA_lead1, teamA_lead2];
        const teamB = [teamB_lead1, teamB_lead2];

        // Use balanced distribution instead of random shuffle
        distributeUnitsBalanced(remainingUnits, teamA, teamB);

        // Randomly select maps
        const round1Map = ALL_MAPS[Math.floor(Math.random() * ALL_MAPS.length)];
        const round2Map = ALL_MAPS[Math.floor(Math.random() * ALL_MAPS.length)];

        // Randomly determine flipped state
        const round1Flipped = Math.random() < 0.5;
        const round2Flipped = Math.random() < 0.5;

        // Simulate round results (50/50 chance for each team)
        const round1Winner = Math.random() < 0.5 ? 'A' : 'B';
        const round2Winner = Math.random() < 0.5 ? 'A' : 'B';

        finalWeeks.push({
          teamA,
          teamB,
          round1Winner,
          round2Winner,
          round1Map,
          round2Map,
          round1Flipped,
          round2Flipped,
          leadA: null, // Not used in single round leads mode
          leadB: null, // Not used in single round leads mode
          leadA_r1: teamA_lead1,
          leadB_r1: teamB_lead1,
          leadA_r2: teamA_lead2,
          leadB_r2: teamB_lead2,
          isSingleRoundLeads: true
        });
      }
    } else {
      // In fullWeeks mode, each matchup becomes a full week
      for (const matchup of generatedWeeks) {
        // Assign remaining units to teams with balancing
        const remainingUnits = units.filter(u => u !== matchup.leadA && u !== matchup.leadB);

        const teamA = [matchup.leadA];
        const teamB = [matchup.leadB];

        // Use balanced distribution instead of random shuffle
        distributeUnitsBalanced(remainingUnits, teamA, teamB);

        // Randomly select maps
        const round1Map = ALL_MAPS[Math.floor(Math.random() * ALL_MAPS.length)];
        const round2Map = ALL_MAPS[Math.floor(Math.random() * ALL_MAPS.length)];

        // Randomly determine flipped state
        const round1Flipped = Math.random() < 0.5;
        const round2Flipped = Math.random() < 0.5;

        // Simulate round results (50/50 chance for each team)
        const round1Winner = Math.random() < 0.5 ? 'A' : 'B';
        const round2Winner = Math.random() < 0.5 ? 'A' : 'B';

        finalWeeks.push({
          teamA,
          teamB,
          round1Winner,
          round2Winner,
          round1Map,
          round2Map,
          round1Flipped,
          round2Flipped,
          leadA: matchup.leadA,
          leadB: matchup.leadB,
          isSingleRoundLeads: false
        });
      }
    }

    return {
      weeks: finalWeeks,
      unitLeadCounts,
      unitDivisionLeadCounts
    };
  };

  // Generate playoff bracket based on current standings
  const generatePlayoffBracket = (weekIndex = null) => {
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
    
    return bracket;
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
              <button
                onClick={() => setShowSimulateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition"
                title="Simulate Season"
              >
                <Zap className="w-4 h-4" />
                Simulate
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

              {/* Balancer Settings Section */}
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-amber-300 mb-3 flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Team Balancer Weights
                </h3>
                <p className="text-xs text-slate-400 mb-3">
                  Adjust the weights used in the composite score calculation. Higher weights increase the importance of that metric.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm text-slate-300 mb-1">Teammate History Weight</label>
                    <input
                      type="number"
                      step="0.1"
                      value={balancerSettings.teammateWeight}
                      onChange={(e) => setBalancerSettings({ ...balancerSettings, teammateWeight: parseFloat(e.target.value) || 1.0 })}
                      className="w-full px-3 py-2 bg-slate-800 text-white rounded border border-slate-600 focus:border-amber-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-300 mb-1">Avg Difference Weight</label>
                    <input
                      type="number"
                      step="0.1"
                      value={balancerSettings.avgDiffWeight}
                      onChange={(e) => setBalancerSettings({ ...balancerSettings, avgDiffWeight: parseFloat(e.target.value) || 1.0 })}
                      className="w-full px-3 py-2 bg-slate-800 text-white rounded border border-slate-600 focus:border-amber-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-300 mb-1">Range Gap Weight</label>
                    <input
                      type="number"
                      step="0.1"
                      value={balancerSettings.gapWeight}
                      onChange={(e) => setBalancerSettings({ ...balancerSettings, gapWeight: parseFloat(e.target.value) || 0.75 })}
                      className="w-full px-3 py-2 bg-slate-800 text-white rounded border border-slate-600 focus:border-amber-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-300 mb-1">Min Difference Weight</label>
                    <input
                      type="number"
                      step="0.1"
                      value={balancerSettings.minDiffWeight}
                      onChange={(e) => setBalancerSettings({ ...balancerSettings, minDiffWeight: parseFloat(e.target.value) || 0.50 })}
                      className="w-full px-3 py-2 bg-slate-800 text-white rounded border border-slate-600 focus:border-amber-500 outline-none"
                    />
                  </div>
                  {divisions.length > 0 && (
                    <div>
                      <label className="block text-sm text-slate-300 mb-1">Division Opposition Weight</label>
                      <input
                        type="number"
                        step="0.1"
                        value={balancerSettings.divisionOppositionWeight}
                        onChange={(e) => setBalancerSettings({ ...balancerSettings, divisionOppositionWeight: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 bg-slate-800 text-white rounded border border-slate-600 focus:border-amber-500 outline-none"
                      />
                    </div>
                  )}
                </div>
                <div className="mt-3 text-xs text-slate-400 bg-slate-600 rounded p-3">
                  <p className="font-semibold text-amber-300 mb-2">💡 Weight Explanations:</p>
                  <ul className="space-y-1 ml-4">
                    <li><strong>Teammate History:</strong> Penalizes units that have played together frequently</li>
                    <li><strong>Avg Difference:</strong> Minimizes the average player count difference between teams</li>
                    <li><strong>Range Gap:</strong> Penalizes non-overlapping player ranges (e.g., Team A: 40-50, Team B: 60-70)</li>
                    <li><strong>Min Difference:</strong> Minimizes the difference between minimum player counts</li>
                    {divisions.length > 0 && (
                      <li><strong>Division Opposition:</strong> Prioritizes placing same-division units on opposing teams</li>
                    )}
                  </ul>
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
              
              {/* Team Balance Stats */}
              {(() => {
                const stats = calculateWeekTeamStats();
                if (!stats) return null;
                
                return (
                  <div className="mb-6 bg-slate-600 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-amber-400 mb-3 flex items-center gap-2">
                      <Target className="w-5 h-5" />
                      Team Balance Overview
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-slate-700 rounded p-3">
                        <div className="text-xs text-slate-400 mb-1">Avg Difference</div>
                        <div className="text-lg font-bold text-amber-400">
                          {stats.avgDiff.toFixed(1)}
                        </div>
                      </div>
                      <div className="bg-slate-700 rounded p-3">
                        <div className="text-xs text-slate-400 mb-1">Min Difference</div>
                        <div className="text-lg font-bold text-cyan-400">
                          {stats.minDiff.toFixed(0)}
                        </div>
                      </div>
                      <div className="bg-slate-700 rounded p-3">
                        <div className="text-xs text-slate-400 mb-1">Max Difference</div>
                        <div className="text-lg font-bold text-purple-400">
                          {stats.maxDiff.toFixed(0)}
                        </div>
                      </div>
                      <div className="bg-slate-700 rounded p-3">
                        <div className="text-xs text-slate-400 mb-1">Avg Teammate History</div>
                        <div className="text-lg font-bold text-green-400">
                          {stats.combinedAvgHistory.toFixed(2)}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-3">
                      <div className="bg-slate-700 rounded p-3">
                        <div className="text-xs text-slate-400 mb-1">Total Min Pop</div>
                        <div className="text-lg font-bold text-cyan-400">
                          {stats.totalMin}
                        </div>
                      </div>
                      <div className="bg-slate-700 rounded p-3">
                        <div className="text-xs text-slate-400 mb-1">Total Max Pop</div>
                        <div className="text-lg font-bold text-purple-400">
                          {stats.totalMax}
                        </div>
                      </div>
                      <div className="bg-slate-700 rounded p-3">
                        <div className="text-xs text-slate-400 mb-1">Total Average Pop</div>
                        <div className="text-lg font-bold text-amber-400">
                          {stats.totalAvg.toFixed(1)}
                        </div>
                      </div>
                    </div>
                    {/* Win Probability Bars */}
                    {(stats.round1Probability || stats.round2Probability) && (
                      <div className="mt-4 space-y-3">
                        <h4 className="text-sm font-semibold text-amber-400 flex items-center gap-2">
                          <TrendingUp className="w-4 h-4" />
                          Win Probability
                        </h4>
                        {[
                          { label: 'Round 1', prob: stats.round1Probability, map: selectedWeek.round1Map },
                          { label: 'Round 2', prob: stats.round2Probability, map: selectedWeek.round2Map }
                        ].map(({ label, prob, map }) => {
                          if (!prob) return null;
                          return (
                            <div key={label} className="bg-slate-700 rounded p-3">
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-xs text-slate-400">{label}{map ? ` — ${map}` : ''}</span>
                                <div className="flex gap-3 text-xs">
                                  {prob.factors.elo && (
                                    <span className="text-slate-500" title="Elo-based probability">Elo: {prob.factors.elo.probA}%</span>
                                  )}
                                  {prob.factors.globalMap && (
                                    <span className="text-slate-500" title="Global map win rate">Map: {prob.factors.globalMap.probA}%</span>
                                  )}
                                  {prob.factors.unitMap && (
                                    <span className="text-slate-500" title="Unit map history">Units: {prob.factors.unitMap.probA}%</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-blue-400 w-16 text-right">{teamNames.A} {prob.teamAProb}%</span>
                                <div className="flex-1 h-5 bg-slate-800 rounded-full overflow-hidden flex">
                                  <div
                                    className="h-full transition-all duration-300"
                                    style={{
                                      width: `${prob.teamAProb}%`,
                                      background: `linear-gradient(90deg, #3b82f6, ${prob.teamAProb > 50 ? '#60a5fa' : '#6b7280'})`
                                    }}
                                  />
                                  <div
                                    className="h-full transition-all duration-300"
                                    style={{
                                      width: `${prob.teamBProb}%`,
                                      background: `linear-gradient(90deg, ${prob.teamBProb > 50 ? '#f87171' : '#6b7280'}, #ef4444)`
                                    }}
                                  />
                                </div>
                                <span className="text-xs font-bold text-red-400 w-16">{prob.teamBProb}% {teamNames.B}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      {/* Team A Stats */}
                      <div className="bg-slate-700 rounded p-3">
                        <h4 className="text-sm font-semibold text-blue-400 mb-2">
                          {teamNames.A} ({stats.teamA.length} units)
                        </h4>
                        <div className="text-slate-300 text-sm space-y-1">
                          <p>Players: {stats.minA}-{stats.maxA} (avg: {stats.avgA.toFixed(1)})</p>
                          <p className="text-xs">
                            Avg Teammate History: <span className="text-cyan-400 font-semibold">{stats.avgHistoryA.toFixed(2)}</span>
                          </p>
                        </div>
                      </div>
                      {/* Team B Stats */}
                      <div className="bg-slate-700 rounded p-3">
                        <h4 className="text-sm font-semibold text-red-400 mb-2">
                          {teamNames.B} ({stats.teamB.length} units)
                        </h4>
                        <div className="text-slate-300 text-sm space-y-1">
                          <p>Players: {stats.minB}-{stats.maxB} (avg: {stats.avgB.toFixed(1)})</p>
                          <p className="text-xs">
                            Avg Teammate History: <span className="text-cyan-400 font-semibold">{stats.avgHistoryB.toFixed(2)}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                    {balancerSettings.divisionOppositionWeight > 0 && (() => {
                      const matchups = getDivisionMatchups(stats.teamA, stats.teamB);
                      if (matchups.length === 0) return null;
                      return (
                        <div className="mt-3 bg-slate-700 rounded p-3">
                          <div className="text-xs text-slate-400 mb-2">
                            Division Matchups: <span className="text-indigo-400 font-bold text-sm">{matchups.length}</span>
                          </div>
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {matchups.map((m, i) => (
                              <div key={i} className="text-xs text-slate-300 flex items-center gap-1">
                                <span className="text-blue-400">{m.unitA}</span>
                                <span className="text-slate-500">vs</span>
                                <span className="text-red-400">{m.unitB}</span>
                                <span className="text-indigo-400 ml-1">({m.division})</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                    <p className="text-xs text-slate-400 mt-3 text-center">
                      💡 Lower teammate history = better variety • Counts history up to the current week, not including.
                    </p>
                  </div>
                );
              })()}
              
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
                      
                      // Get min/max for this unit
                      const counts = selectedWeek.unitPlayerCounts?.[unit] || unitPlayerCounts[unit];
                      const minMax = counts ? `(${counts.min}-${counts.max})` : '';
                      
                      return (
                        <div
                          key={unit}
                          draggable
                          onDragStart={() => handleMainDragStart(unit, 'A')}
                          className="flex justify-between items-center p-2 bg-slate-700 rounded cursor-move hover:bg-slate-600 transition"
                        >
                          <div className="flex flex-col flex-1">
                            <div className="flex items-center justify-between">
                              <span className="text-white font-medium">{unit}</span>
                              <span className="text-xs text-slate-400 ml-2">{minMax}</span>
                            </div>
                            <span className="text-xs text-slate-400">
                              Elo: {Math.round(unitElo)} | TII: {unitTii.toFixed(3)}
                            </span>
                          </div>
                          <button
                            onClick={() => removeUnitFromTeam(unit, 'A')}
                            className="p-1 hover:bg-red-600 rounded transition ml-2"
                          >
                            <X className="w-4 h-4 text-white" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {!selectedWeek.isPlayoffs && !selectedWeek.isSingleRoundLeads && (
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
                      
                      // Get min/max for this unit
                      const counts = selectedWeek.unitPlayerCounts?.[unit] || unitPlayerCounts[unit];
                      const minMax = counts ? `(${counts.min}-${counts.max})` : '';
                      
                      return (
                        <div
                          key={unit}
                          draggable
                          onDragStart={() => handleMainDragStart(unit, 'B')}
                          className="flex justify-between items-center p-2 bg-slate-700 rounded cursor-move hover:bg-slate-600 transition"
                        >
                          <div className="flex flex-col flex-1">
                            <div className="flex items-center justify-between">
                              <span className="text-white font-medium">{unit}</span>
                              <span className="text-xs text-slate-400 ml-2">{minMax}</span>
                            </div>
                            <span className="text-xs text-slate-400">
                              Elo: {Math.round(unitElo)} | TII: {unitTii.toFixed(3)}
                            </span>
                          </div>
                          <button
                            onClick={() => removeUnitFromTeam(unit, 'B')}
                            className="p-1 hover:bg-red-600 rounded transition ml-2"
                          >
                            <X className="w-4 h-4 text-white" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {!selectedWeek.isPlayoffs && !selectedWeek.isSingleRoundLeads && (
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
                    onChange={(e) => updateWeek(selectedWeek.id, {
                      isPlayoffs: e.target.checked,
                      ...(e.target.checked && { isSingleRoundLeads: false })
                    })}
                    className="w-4 h-4 rounded border-slate-500 bg-slate-800 text-amber-500 focus:ring-amber-500"
                  />
                  <Star className="w-4 h-4" />
                  <span className="font-semibold">Playoffs Week</span>
                </label>
              </div>

              {/* Single Round Leads Toggle */}
              <div className="mb-4">
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedWeek.isSingleRoundLeads || false}
                    onChange={(e) => updateWeek(selectedWeek.id, {
                      isSingleRoundLeads: e.target.checked,
                      ...(e.target.checked && { isPlayoffs: false })
                    })}
                    className="w-4 h-4 rounded border-slate-500 bg-slate-800 text-amber-500 focus:ring-amber-500"
                  />
                  <Star className="w-4 h-4" />
                  <span className="font-semibold">Single Round Leads</span>
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

              {/* Single Round Leads Lead Selection */}
              {selectedWeek.isSingleRoundLeads && (
                <div className="mb-6 bg-slate-600 rounded-lg p-4">
                  <h3 className="text-lg font-bold text-amber-400 mb-3">Round Leads</h3>
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
                      onClick={closeBalancerModal}
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
                        <div className="grid grid-cols-3 gap-3 mt-3 max-w-4xl mx-auto">
                          <div className="bg-slate-700 rounded p-3">
                            <div className="text-xs text-slate-400 mb-1">Total Min Pop</div>
                            <div className="text-lg font-bold text-cyan-400">
                              {balancerResults.minA + balancerResults.minB}
                            </div>
                          </div>
                          <div className="bg-slate-700 rounded p-3">
                            <div className="text-xs text-slate-400 mb-1">Total Max Pop</div>
                            <div className="text-lg font-bold text-purple-400">
                              {balancerResults.maxA + balancerResults.maxB}
                            </div>
                          </div>
                          <div className="bg-slate-700 rounded p-3">
                            <div className="text-xs text-slate-400 mb-1">Total Average Pop</div>
                            <div className="text-lg font-bold text-amber-400">
                              {((balancerResults.minA + balancerResults.maxA + balancerResults.minB + balancerResults.maxB) / 2).toFixed(1)}
                            </div>
                          </div>
                        </div>
                        {balancerSettings.divisionOppositionWeight > 0 && (() => {
                          const matchups = getDivisionMatchups(balancerResults.teamA, balancerResults.teamB);
                          if (matchups.length === 0) return null;
                          return (
                            <div className="mt-3 max-w-4xl mx-auto bg-slate-700 rounded p-3">
                              <div className="text-xs text-slate-400 mb-2">
                                Division Matchups: <span className="text-indigo-400 font-bold text-sm">{matchups.length}</span>
                              </div>
                              <div className="space-y-1 max-h-32 overflow-y-auto">
                                {matchups.map((m, i) => (
                                  <div key={i} className="text-xs text-slate-300 flex items-center gap-1">
                                    <span className="text-blue-400">{m.unitA}</span>
                                    <span className="text-slate-500">vs</span>
                                    <span className="text-red-400">{m.unitB}</span>
                                    <span className="text-indigo-400 ml-1">({m.division})</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                        {/* Win Probability Bars */}
                        {(balancerResults.round1Probability || balancerResults.round2Probability) && (
                          <div className="mt-4 max-w-4xl mx-auto space-y-3">
                            <h4 className="text-sm font-semibold text-amber-400 flex items-center justify-center gap-2">
                              <TrendingUp className="w-4 h-4" />
                              Win Probability
                            </h4>
                            {[
                              { label: 'Round 1', prob: balancerResults.round1Probability, map: selectedWeek?.round1Map },
                              { label: 'Round 2', prob: balancerResults.round2Probability, map: selectedWeek?.round2Map }
                            ].map(({ label, prob, map }) => {
                              if (!prob) return null;
                              return (
                                <div key={label} className="bg-slate-700 rounded p-3">
                                  <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs text-slate-400">{label}{map ? ` — ${map}` : ''}</span>
                                    <div className="flex gap-3 text-xs">
                                      {prob.factors.elo && (
                                        <span className="text-slate-500" title="Elo-based probability">Elo: {prob.factors.elo.probA}%</span>
                                      )}
                                      {prob.factors.globalMap && (
                                        <span className="text-slate-500" title="Global map win rate">Map: {prob.factors.globalMap.probA}%</span>
                                      )}
                                      {prob.factors.unitMap && (
                                        <span className="text-slate-500" title="Unit map history">Units: {prob.factors.unitMap.probA}%</span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-blue-400 w-16 text-right">{teamNames.A} {prob.teamAProb}%</span>
                                    <div className="flex-1 h-5 bg-slate-800 rounded-full overflow-hidden flex">
                                      <div
                                        className="h-full transition-all duration-300"
                                        style={{
                                          width: `${prob.teamAProb}%`,
                                          background: `linear-gradient(90deg, #3b82f6, ${prob.teamAProb > 50 ? '#60a5fa' : '#6b7280'})`
                                        }}
                                      />
                                      <div
                                        className="h-full transition-all duration-300"
                                        style={{
                                          width: `${prob.teamBProb}%`,
                                          background: `linear-gradient(90deg, ${prob.teamBProb > 50 ? '#f87171' : '#6b7280'}, #ef4444)`
                                        }}
                                      />
                                    </div>
                                    <span className="text-xs font-bold text-red-400 w-16">{prob.teamBProb}% {teamNames.B}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
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
                              {balancerResults.teamA.sort().map(unit => {
                                const counts = balancerUnitCounts[unit];
                                const minMax = counts ? `(${counts.min}-${counts.max})` : '';
                                return (
                                  <div
                                    key={unit}
                                    draggable
                                    onDragStart={() => handleDragStart(unit, 'A')}
                                    className="text-white text-sm py-2 px-3 bg-slate-700 rounded cursor-move hover:bg-slate-600 transition flex items-center justify-between gap-2"
                                  >
                                    <div className="flex items-center gap-2">
                                      <Swords className="w-3 h-3 text-slate-400" />
                                      {unit}
                                    </div>
                                    <span className="text-xs text-slate-400">{minMax}</span>
                                  </div>
                                );
                              })}
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
                              {balancerResults.teamB.sort().map(unit => {
                                const counts = balancerUnitCounts[unit];
                                const minMax = counts ? `(${counts.min}-${counts.max})` : '';
                                return (
                                  <div
                                    key={unit}
                                    draggable
                                    onDragStart={() => handleDragStart(unit, 'B')}
                                    className="text-white text-sm py-2 px-3 bg-slate-700 rounded cursor-move hover:bg-slate-600 transition flex items-center justify-between gap-2"
                                  >
                                    <div className="flex items-center gap-2">
                                      <Swords className="w-3 h-3 text-slate-400" />
                                      {unit}
                                    </div>
                                    <span className="text-xs text-slate-400">{minMax}</span>
                                  </div>
                                );
                              })}
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
                            onClick={closeBalancerModal}
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
                    {(() => {
                      const { overall, byMap } = calculateMapStats();
                      const pct = (wins, total) => total > 0 ? ((wins / total) * 100).toFixed(1) : '0.0';

                      return (
                        <>
                          {/* Overall Statistics */}
                          {overall.totalRounds > 0 && (
                            <div className="mb-4 space-y-3">
                              {/* Faction Win Rates */}
                              <div className="grid grid-cols-2 gap-3">
                                <div className="bg-slate-600 rounded p-3">
                                  <div className="text-xs text-slate-400 mb-1">USA Overall</div>
                                  <div className="text-lg font-bold text-blue-400">
                                    {pct(overall.usaWins, overall.totalRounds)}% <span className="text-xs font-normal text-slate-300">({overall.usaWins}/{overall.totalRounds})</span>
                                  </div>
                                </div>
                                <div className="bg-slate-600 rounded p-3">
                                  <div className="text-xs text-slate-400 mb-1">CSA Overall</div>
                                  <div className="text-lg font-bold text-red-400">
                                    {pct(overall.csaWins, overall.totalRounds)}% <span className="text-xs font-normal text-slate-300">({overall.csaWins}/{overall.totalRounds})</span>
                                  </div>
                                </div>
                              </div>
                              {/* Attacker/Defender Win Rates */}
                              <div className="grid grid-cols-2 gap-3">
                                <div className="bg-slate-600 rounded p-3">
                                  <div className="text-xs text-slate-400 mb-1">Attackers Won</div>
                                  <div className="text-lg font-bold text-amber-400">
                                    {pct(overall.attackerWins, overall.totalRounds)}% <span className="text-xs font-normal text-slate-300">({overall.attackerWins}/{overall.totalRounds})</span>
                                  </div>
                                </div>
                                <div className="bg-slate-600 rounded p-3">
                                  <div className="text-xs text-slate-400 mb-1">Defenders Won</div>
                                  <div className="text-lg font-bold text-green-400">
                                    {pct(overall.defenderWins, overall.totalRounds)}% <span className="text-xs font-normal text-slate-300">({overall.defenderWins}/{overall.totalRounds})</span>
                                  </div>
                                </div>
                              </div>
                              {/* Faction Attack/Defense Breakdown */}
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                <div className="bg-slate-600 rounded p-2">
                                  <div className="text-xs text-slate-400">USA Attack</div>
                                  <div className="text-sm font-semibold text-blue-400">
                                    {pct(overall.usaAttackWins, overall.usaAttackRounds)}% <span className="text-xs font-normal text-slate-400">({overall.usaAttackWins}/{overall.usaAttackRounds})</span>
                                  </div>
                                </div>
                                <div className="bg-slate-600 rounded p-2">
                                  <div className="text-xs text-slate-400">USA Defense</div>
                                  <div className="text-sm font-semibold text-blue-400">
                                    {pct(overall.usaDefenseWins, overall.usaDefenseRounds)}% <span className="text-xs font-normal text-slate-400">({overall.usaDefenseWins}/{overall.usaDefenseRounds})</span>
                                  </div>
                                </div>
                                <div className="bg-slate-600 rounded p-2">
                                  <div className="text-xs text-slate-400">CSA Attack</div>
                                  <div className="text-sm font-semibold text-red-400">
                                    {pct(overall.csaAttackWins, overall.csaAttackRounds)}% <span className="text-xs font-normal text-slate-400">({overall.csaAttackWins}/{overall.csaAttackRounds})</span>
                                  </div>
                                </div>
                                <div className="bg-slate-600 rounded p-2">
                                  <div className="text-xs text-slate-400">CSA Defense</div>
                                  <div className="text-sm font-semibold text-red-400">
                                    {pct(overall.csaDefenseWins, overall.csaDefenseRounds)}% <span className="text-xs font-normal text-slate-400">({overall.csaDefenseWins}/{overall.csaDefenseRounds})</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Maps by Skirmish Area */}
                          <div className="space-y-2">
                            {Object.entries(MAPS).map(([areaKey, areaMaps]) => {
                              const areaName = areaKey.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                              const playedMaps = areaMaps.filter(m => byMap[m]);
                              if (playedMaps.length === 0) return null;

                              return (
                                <div key={areaKey} className="bg-slate-600 rounded-lg overflow-hidden">
                                  <button
                                    onClick={() => toggleSection(`mapStats_${areaKey}`)}
                                    className="w-full flex items-center justify-between bg-slate-500 px-3 py-2 hover:bg-slate-450 transition"
                                  >
                                    <span className="font-semibold text-amber-300">{areaName} ({playedMaps.length})</span>
                                    {expandedSections[`mapStats_${areaKey}`] ? (
                                      <ChevronDown className="w-4 h-4 text-slate-300" />
                                    ) : (
                                      <ChevronRight className="w-4 h-4 text-slate-300" />
                                    )}
                                  </button>
                                  {expandedSections[`mapStats_${areaKey}`] && (
                                    <div className="p-2 space-y-2">
                                      {playedMaps
                                        .sort((a, b) => (byMap[b]?.plays || 0) - (byMap[a]?.plays || 0))
                                        .map(mapName => {
                                          const stats = byMap[mapName];
                                          const avgCas = stats.plays > 0 ? (stats.totalCasualties / stats.plays).toFixed(0) : 0;
                                          return (
                                            <div key={mapName} className="bg-slate-700 rounded p-2">
                                              <div className="flex justify-between items-center mb-1">
                                                <span className="text-sm font-medium text-white">{mapName}</span>
                                                <span className="text-xs text-slate-400">{stats.plays} rounds</span>
                                              </div>
                                              <div className="text-xs space-y-0.5">
                                                <div>
                                                  <span className="text-blue-300">USA: {stats.usaWins} ({pct(stats.usaWins, stats.plays)}%)</span>
                                                  <span className="text-slate-500 mx-2">|</span>
                                                  <span className="text-red-300">CSA: {stats.csaWins} ({pct(stats.csaWins, stats.plays)}%)</span>
                                                </div>
                                                <div className="text-slate-300">Casualties: {stats.totalCasualties} (avg {avgCas})</div>
                                              </div>
                                            </div>
                                          );
                                        })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {Object.keys(byMap).length === 0 && (
                            <p className="text-slate-400 text-center py-4">No map data available</p>
                          )}
                        </>
                      );
                    })()}
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

                  {/* Playoffs Section */}
                  <div className="bg-slate-700 rounded-lg p-4">
                    <h3 className="text-xl font-bold text-amber-400 mb-3 flex items-center gap-2">
                      <Trophy className="w-5 h-5" />
                      Playoffs
                    </h3>
                    
                    {/* Playoff Configuration */}
                    <div className="bg-slate-600 rounded-lg p-4 mb-4">
                      <h4 className="font-semibold text-white mb-3">Playoff Format Settings</h4>
                      
                      <div className="space-y-3">
                        {/* Enable Playoffs */}
                        <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={playoffConfig.enabled}
                            onChange={(e) => setPlayoffConfig({ ...playoffConfig, enabled: e.target.checked })}
                            className="w-4 h-4 rounded border-slate-500 bg-slate-800 text-amber-500 focus:ring-amber-500"
                          />
                          <Star className="w-4 h-4" />
                          <span className="font-semibold">Enable Playoff Tracking</span>
                        </label>
                        
                        {playoffConfig.enabled && (
                          <>
                            {/* Use Divisions */}
                            {divisions && divisions.length > 0 && (
                              <label className="flex items-center gap-2 text-slate-300 cursor-pointer ml-6">
                                <input
                                  type="checkbox"
                                  checked={playoffConfig.useDivisions}
                                  onChange={(e) => setPlayoffConfig({ ...playoffConfig, useDivisions: e.target.checked })}
                                  className="w-4 h-4 rounded border-slate-500 bg-slate-800 text-amber-500 focus:ring-amber-500"
                                />
                                <Shield className="w-4 h-4" />
                                <span className="text-sm">Use Division-based Playoffs</span>
                              </label>
                            )}
                            
                            {/* Teams per Division */}
                            {playoffConfig.useDivisions && (
                              <div className="ml-6">
                                <label className="block text-sm text-slate-300 mb-1">Top Teams per Division</label>
                                <input
                                  type="number"
                                  min="1"
                                  max="4"
                                  value={playoffConfig.teamsPerDivision}
                                  onChange={(e) => setPlayoffConfig({ ...playoffConfig, teamsPerDivision: parseInt(e.target.value) || 1 })}
                                  className="w-24 px-3 py-1 bg-slate-800 text-white rounded border border-slate-500 focus:border-amber-500 outline-none text-sm"
                                />
                              </div>
                            )}
                            
                            {/* Wildcard Teams */}
                            <div className="ml-6">
                              <label className="block text-sm text-slate-300 mb-1">
                                {playoffConfig.useDivisions ? 'Wildcard Teams' : 'Total Playoff Teams'}
                              </label>
                              <input
                                type="number"
                                min="0"
                                max="8"
                                value={playoffConfig.wildcardTeams}
                                onChange={(e) => setPlayoffConfig({ ...playoffConfig, wildcardTeams: parseInt(e.target.value) || 0 })}
                                className="w-24 px-3 py-1 bg-slate-800 text-white rounded border border-slate-500 focus:border-amber-500 outline-none text-sm"
                              />
                            </div>
                            
                            {/* Round Formats */}
                            <div className="ml-6 bg-slate-700 rounded p-3">
                              <h5 className="text-sm font-semibold text-amber-300 mb-2">Rounds per Playoff Stage</h5>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs text-slate-300 mb-1">Wildcard</label>
                                  <input
                                    type="number"
                                    min="1"
                                    max="3"
                                    value={playoffConfig.roundFormats.wildcard}
                                    onChange={(e) => setPlayoffConfig({
                                      ...playoffConfig,
                                      roundFormats: { ...playoffConfig.roundFormats, wildcard: parseInt(e.target.value) || 1 }
                                    })}
                                    className="w-16 px-2 py-1 bg-slate-800 text-white rounded border border-slate-500 focus:border-amber-500 outline-none text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-slate-300 mb-1">Divisional</label>
                                  <input
                                    type="number"
                                    min="1"
                                    max="3"
                                    value={playoffConfig.roundFormats.divisional}
                                    onChange={(e) => setPlayoffConfig({
                                      ...playoffConfig,
                                      roundFormats: { ...playoffConfig.roundFormats, divisional: parseInt(e.target.value) || 1 }
                                    })}
                                    className="w-16 px-2 py-1 bg-slate-800 text-white rounded border border-slate-500 focus:border-amber-500 outline-none text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-slate-300 mb-1">Conference</label>
                                  <input
                                    type="number"
                                    min="1"
                                    max="3"
                                    value={playoffConfig.roundFormats.conference}
                                    onChange={(e) => setPlayoffConfig({
                                      ...playoffConfig,
                                      roundFormats: { ...playoffConfig.roundFormats, conference: parseInt(e.target.value) || 2 }
                                    })}
                                    className="w-16 px-2 py-1 bg-slate-800 text-white rounded border border-slate-500 focus:border-amber-500 outline-none text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-slate-300 mb-1">Finals</label>
                                  <input
                                    type="number"
                                    min="1"
                                    max="3"
                                    value={playoffConfig.roundFormats.finals}
                                    onChange={(e) => setPlayoffConfig({
                                      ...playoffConfig,
                                      roundFormats: { ...playoffConfig.roundFormats, finals: parseInt(e.target.value) || 2 }
                                    })}
                                    className="w-16 px-2 py-1 bg-slate-800 text-white rounded border border-slate-500 focus:border-amber-500 outline-none text-sm"
                                  />
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    
                    {/* Playoff Picture */}
                    {playoffConfig.enabled && (() => {
                      const currentWeekIdx = selectedWeek ? weeks.findIndex(w => w.id === selectedWeek.id) : weeks.length - 1;
                      const bracket = generatePlayoffBracket(currentWeekIdx);
                      
                      if (!bracket || bracket.teams.length === 0) {
                        return (
                          <div className="bg-slate-600 rounded-lg p-4 text-center">
                            <p className="text-slate-400 text-sm">
                              Not enough teams for playoffs. Configure playoff settings above.
                            </p>
                          </div>
                        );
                      }
                      
                      return (
                        <div className="bg-slate-600 rounded-lg p-4">
                          <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
                            <Target className="w-4 h-4" />
                            Playoff Picture
                            {selectedWeek && (
                              <span className="text-xs text-slate-400 font-normal">
                                (as of {selectedWeek.name})
                              </span>
                            )}
                          </h4>
                          
                          {/* Seeding */}
                          <div className="mb-4 bg-slate-700 rounded p-3">
                            <h5 className="text-sm font-semibold text-amber-300 mb-2">Playoff Seeds</h5>
                            {playoffConfig.useDivisions && bracket.teams.some(t => t.conference) ? (
                              // Conference-based seeding display
                              (() => {
                                const conferences = {};
                                bracket.teams.forEach(team => {
                                  const conf = team.conference || 'Unknown';
                                  if (!conferences[conf]) conferences[conf] = [];
                                  conferences[conf].push(team);
                                });
                                
                                return (
                                  <div className="space-y-3">
                                    {Object.entries(conferences).map(([confName, confTeams]) => (
                                      <div key={confName} className="bg-slate-600 rounded p-2">
                                        <h6 className="text-xs font-bold text-cyan-300 mb-2">{confName} Conference</h6>
                                        <div className="grid grid-cols-2 gap-2">
                                          {confTeams.map((team) => (
                                            <div key={team.unit} className="flex items-center gap-2 text-sm">
                                              <span className="text-amber-400 font-bold">#{team.conferenceSeed}</span>
                                              <span className="text-white">{team.unit}</span>
                                              <span className="text-slate-400 text-xs">
                                                ({team.points} pts{team.isWildcard ? ', WC' : ''})
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                );
                              })()
                            ) : (
                              // Simple seeding display
                              <div className="grid grid-cols-2 gap-2">
                                {bracket.teams.map((team) => (
                                  <div key={team.unit} className="flex items-center gap-2 text-sm">
                                    <span className="text-amber-400 font-bold">#{team.seed}</span>
                                    <span className="text-white">{team.unit}</span>
                                    <span className="text-slate-400 text-xs">({team.points} pts)</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          
                          {/* Bracket Rounds */}
                          <div className="space-y-3">
                            {bracket.rounds.map((round, roundIdx) => (
                              <div key={roundIdx} className="bg-slate-700 rounded p-3">
                                <h5 className="text-sm font-semibold text-amber-300 mb-2 flex items-center gap-2">
                                  <Swords className="w-4 h-4" />
                                  {round.name}
                                  <span className="text-xs text-slate-400 font-normal">
                                    ({round.roundsPerMatch} round{round.roundsPerMatch > 1 ? 's' : ''} per match)
                                  </span>
                                </h5>
                                <div className="space-y-2">
                                  {round.matchups.map((matchup, matchIdx) => {
                                    // Show conference name if present
                                    const confLabel = matchup.conference && matchup.conference !== 'Championship'
                                      ? `[${matchup.conference}] `
                                      : '';
                                    
                                    return (
                                      <div key={matchIdx} className="bg-slate-600 rounded p-2">
                                        {confLabel && (
                                          <div className="text-xs text-cyan-400 font-semibold mb-1">{confLabel}</div>
                                        )}
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-2 flex-1">
                                            {matchup.team1 ? (
                                              <>
                                                <span className="text-amber-400 font-bold text-xs">#{matchup.seed1}</span>
                                                <span className="text-white text-sm">{matchup.team1.unit}</span>
                                                {matchup.team1.isWildcard && (
                                                  <span className="text-purple-400 text-xs font-bold">WC</span>
                                                )}
                                              </>
                                            ) : matchup.label ? (
                                              <span className="text-slate-400 text-sm italic">{matchup.label}</span>
                                            ) : (
                                              <span className="text-slate-400 text-sm italic">Seed #{matchup.seed1}</span>
                                            )}
                                          </div>
                                          <span className="text-slate-400 text-xs font-bold mx-2">VS</span>
                                          <div className="flex items-center gap-2 flex-1 justify-end">
                                            {matchup.team2 ? (
                                              <>
                                                {matchup.team2.isWildcard && (
                                                  <span className="text-purple-400 text-xs font-bold">WC</span>
                                                )}
                                                <span className="text-white text-sm">{matchup.team2.unit}</span>
                                                <span className="text-amber-400 font-bold text-xs">#{matchup.seed2}</span>
                                              </>
                                            ) : matchup.label && !matchup.team1 ? (
                                              <span className="text-slate-400 text-sm italic">{matchup.label}</span>
                                            ) : (
                                              <span className="text-slate-400 text-sm italic">
                                                {matchup.seed2 === 'WC1' || matchup.seed2 === 'WC2' ? 'Wildcard Winner' : `Seed #${matchup.seed2}`}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
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
                      This heatmap shows how often units have played together as teammates as a percentage of weeks both units were in attendance.
                      For example, 50% means they played together in half of the weeks they were both present for in the season.
                    </p>
                  </div>

                  {(() => {
                    const { heatmapData, activeUnits, unitActiveWeeks } = calculateTeammateHeatmap();
                    
                    if (activeUnits.length === 0) {
                      return (
                        <div className="text-center text-slate-400 py-12">
                          <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                          <p>No teammate data available yet</p>
                        </div>
                      );
                    }

                    // Helper to get color intensity based on percentage of weeks both units were active
                    // Creates a smooth gradient from blue (0%) -> purple -> orange -> red (100%)
                    const getHeatColor = (count, bothActiveWeeks) => {
                      if (bothActiveWeeks === 0) return 'bg-slate-700';
                      const percentage = (count / bothActiveWeeks) * 100;
                      
                      // Calculate RGB values for smooth gradient
                      // 0% = sky blue (135, 206, 235), 100% = red (220, 38, 38)
                      let r, g, b;
                      
                      if (percentage <= 50) {
                        // Sky Blue to purple (0-50%)
                        const t = percentage / 50;
                        r = Math.round(135 + (147 - 135) * t);    // 135 -> 147
                        g = Math.round(206 - (206 - 51) * t);   // 206 -> 51
                        b = Math.round(235 - (235 - 235) * t);  // 235 -> 235
                      } else {
                        // Purple to red (50-100%)
                        const t = (percentage - 50) / 50;
                        r = Math.round(147 + (220 - 147) * t);  // 147 -> 220
                        g = Math.round(51 - (51 - 38) * t);     // 51 -> 38
                        b = Math.round(235 - (235 - 38) * t);   // 235 -> 38
                      }
                      
                      return `rgb(${r}, ${g}, ${b})`;
                    };

                    // Helper to get percentage display
                    const getPercentage = (count, bothActiveWeeks) => {
                      if (bothActiveWeeks === 0) return '';
                      return Math.round((count / bothActiveWeeks) * 100);
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
                                    const bothActiveWeeks = data?.bothActiveWeeks || 0;
                                    const percentage = getPercentage(count, bothActiveWeeks);
                                    
                                    const bgColor = getHeatColor(count, bothActiveWeeks);
                                    const isSlateGray = bgColor === 'bg-slate-700';
                                    
                                    return (
                                      <td key={unit2} className="p-0.5">
                                        <div
                                          className={`w-full rounded flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-amber-400 transition ${isSlateGray ? bgColor : ''}`}
                                          style={{
                                            height: `${cellSize}px`,
                                            backgroundColor: isSlateGray ? undefined : bgColor
                                          }}
                                          title={`${unit1} & ${unit2}: ${count} weeks together (${percentage}% of ${bothActiveWeeks} weeks both active)`}
                                        >
                                          <span className={`${fontSize} font-semibold text-white`}>
                                            {percentage !== '' ? `${percentage}%` : ''}
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
                        <div className="mt-6">
                          <div className="text-sm text-slate-300 text-center mb-2">
                            Percentage of Weeks Both Units Active
                          </div>
                          <div className="flex items-center justify-center gap-3">
                            <span className="text-xs text-slate-400">0%</span>
                            <div className="relative w-64 h-6 rounded overflow-hidden">
                              <div
                                className="absolute inset-0"
                                style={{
                                  background: 'linear-gradient(to right, rgb(135, 206, 235) 0%, rgb(147, 51, 235) 50%, rgb(220, 38, 38) 100%)'
                                }}
                              />
                            </div>
                            <span className="text-xs text-slate-400">100%</span>
                          </div>
                          <div className="flex items-center justify-center gap-8 mt-2">
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgb(135, 206, 235)' }}></div>
                              <span className="text-xs text-slate-400">Low</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgb(147, 51, 235)' }}></div>
                              <span className="text-xs text-slate-400">Mid</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgb(220, 38, 38)' }}></div>
                              <span className="text-xs text-slate-400">High</span>
                            </div>
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

          {/* Simulation Modal */}
          {showSimulateModal && (
            <div
              className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => setShowSimulateModal(false)}
            >
              <div
                className="bg-slate-800 rounded-lg shadow-2xl border border-slate-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
                      <Zap className="w-6 h-6" />
                      Simulate Season
                    </h2>
                    <button
                      onClick={() => setShowSimulateModal(false)}
                      className="p-2 hover:bg-slate-700 rounded-lg transition"
                    >
                      <X className="w-5 h-5 text-slate-400" />
                    </button>
                  </div>

                  <div className="space-y-6">
                    {/* Info Box */}
                    <div className="bg-slate-700 rounded-lg p-4">
                      <p className="text-sm text-slate-300 mb-2">
                        This will simulate a season by generating weeks with {simScheduleOnly ? 'scheduled leads' : 'randomized'}:
                      </p>
                      {!simScheduleOnly ? (
                        <ul className="text-sm text-slate-300 list-disc list-inside space-y-1 ml-2">
                          <li>Team assignments (leads and supporting units)</li>
                          <li>Map selections for both rounds</li>
                          <li>Round results (50/50 chance per team)</li>
                          <li>No repeat lead matchups</li>
                        </ul>
                      ) : (
                        <ul className="text-sm text-slate-300 list-disc list-inside space-y-1 ml-2">
                          <li>Week creation with assigned leads only</li>
                          <li>Teams remain unassigned (empty)</li>
                          <li>No maps or outcomes generated</li>
                          <li>No repeat lead matchups</li>
                        </ul>
                      )}
                      <p className="text-sm text-amber-400 mt-3">
                        💡 Simulated weeks will be added to your existing weeks.
                      </p>
                    </div>

                    {/* Settings */}
                    <div className="bg-slate-700 rounded-lg p-4 space-y-4">
                      <h3 className="text-lg font-semibold text-amber-400 mb-3">Simulation Settings</h3>
                      
                      {/* Schedule Only Toggle */}
                      <div className="bg-slate-600 rounded-lg p-3">
                        <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={simScheduleOnly}
                            onChange={(e) => setSimScheduleOnly(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-500 bg-slate-800 text-amber-500 focus:ring-amber-500"
                          />
                          <Calendar className="w-4 h-4" />
                          <span className="font-semibold">Schedule Only</span>
                        </label>
                        <p className="text-xs text-slate-400 mt-2 ml-6">
                          {simScheduleOnly
                            ? "Generate weeks with leads assigned but no teams, maps, or outcomes"
                            : "Generate complete weeks with teams, maps, and simulated outcomes"}
                        </p>
                      </div>

                      {/* Lead Nights Per Unit */}
                      <div>
                        <label className="block text-sm text-slate-300 mb-2">
                          # of Lead Nights per Token Unit
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={simLeadNightsPerUnit}
                          onChange={(e) => setSimLeadNightsPerUnit(parseInt(e.target.value) || 1)}
                          className="w-full px-3 py-2 bg-slate-800 text-white rounded border border-slate-600 focus:border-amber-500 outline-none"
                        />
                        <p className="text-xs text-slate-400 mt-1">
                          {simLeadMode === 'rounds'
                            ? `Each token unit will lead ${simLeadNightsPerUnit} night(s) with 2 rounds per night. Total weeks = ${units.filter(u => !nonTokenUnits.includes(u)).length} units × ${simLeadNightsPerUnit} × 2 = ${units.filter(u => !nonTokenUnits.includes(u)).length * simLeadNightsPerUnit * 2} weeks`
                            : `Each token unit will lead this many weeks. Total weeks = ${units.filter(u => !nonTokenUnits.includes(u)).length} units × ${simLeadNightsPerUnit} = ${units.filter(u => !nonTokenUnits.includes(u)).length * simLeadNightsPerUnit} weeks`
                          }
                        </p>
                      </div>

                      {/* Lead Mode Selection */}
                      <div>
                        <label className="block text-sm text-slate-300 mb-2">
                          Lead Assignment Mode
                        </label>
                        <div className="space-y-2">
                          <label className="flex items-start gap-2 text-slate-300 cursor-pointer">
                            <input
                              type="radio"
                              name="simLeadMode"
                              value="fullWeeks"
                              checked={simLeadMode === 'fullWeeks'}
                              onChange={(e) => setSimLeadMode(e.target.value)}
                              className="mt-1"
                            />
                            <div>
                              <div className="text-sm">Full Lead Weeks</div>
                              <div className="text-xs text-slate-400">One unit leads both rounds each night</div>
                            </div>
                          </label>
                          <label className="flex items-start gap-2 text-slate-300 cursor-pointer">
                            <input
                              type="radio"
                              name="simLeadMode"
                              value="rounds"
                              checked={simLeadMode === 'rounds'}
                              onChange={(e) => setSimLeadMode(e.target.value)}
                              className="mt-1"
                            />
                            <div>
                              <div className="text-sm">Lead Rounds</div>
                              <div className="text-xs text-slate-400">Two units lead per night (one per round)</div>
                            </div>
                          </label>
                        </div>
                      </div>

                      {/* Division Lead Nights */}
                      {divisions && divisions.length > 0 && (
                        <div>
                          <label className="block text-sm text-slate-300 mb-2">
                            # of Lead Nights within Division
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={simLeadNightsPerUnit}
                            value={simLeadNightsInDivision}
                            onChange={(e) => setSimLeadNightsInDivision(Math.min(parseInt(e.target.value) || 0, simLeadNightsPerUnit))}
                            className="w-full px-3 py-2 bg-slate-800 text-white rounded border border-slate-600 focus:border-amber-500 outline-none"
                          />
                          <p className="text-xs text-slate-400 mt-1">
                            {simLeadNightsInDivision === 0 
                              ? "0 = Any matchup is fine (no division requirement)" 
                              : `Each unit must lead ${simLeadNightsInDivision} week(s) against opponents in their division`}
                          </p>
                        </div>
                      )}

                      {/* Unit Summary */}
                      <div className="bg-slate-600 rounded p-3">
                        <h4 className="text-sm font-semibold text-white mb-2">Current Units</h4>
                        <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                          <div>Token Units: {units.filter(u => !nonTokenUnits.includes(u)).length}</div>
                          <div>Non-Token Units: {nonTokenUnits.length}</div>
                          <div className="col-span-2">Total Units: {units.length}</div>
                          {divisions && divisions.length > 0 && (
                            <div className="col-span-2">Divisions: {divisions.length}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Buttons */}
                  <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-600">
                    <button
                      onClick={() => setShowSimulateModal(false)}
                      className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={simulateSeason}
                      className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition flex items-center gap-2"
                    >
                      {simScheduleOnly ? <Calendar className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                      {simScheduleOnly ? 'Generate Schedule' : 'Simulate Season'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Simulation Analytics Modal */}
          {showAnalyticsModal && simulationAnalytics && (
            <div
              className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => setShowAnalyticsModal(false)}
            >
              <div
                className="bg-slate-800 rounded-lg shadow-2xl border border-slate-700 max-w-3xl w-full max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
                      <TrendingUp className="w-6 h-6" />
                      Simulation Analytics
                    </h2>
                    <button
                      onClick={() => setShowAnalyticsModal(false)}
                      className="p-2 hover:bg-slate-700 rounded-lg transition"
                    >
                      <X className="w-5 h-5 text-slate-400" />
                    </button>
                  </div>

                  <div className="space-y-6">
                    {/* Success Message */}
                    <div className="bg-green-900/30 border border-green-700 rounded-lg p-4">
                      <p className="text-green-400 font-semibold flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5" />
                        Successfully simulated {simulationAnalytics.totalWeeks} weeks ({simulationAnalytics.totalRounds} rounds)!
                      </p>
                      <p className="text-xs text-slate-300 mt-2">
                        Analysis shows point distribution from a per-token-unit perspective
                      </p>
                    </div>

                    {/* Point System Summary */}
                    <div className="bg-slate-700 rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-amber-400 mb-3 flex items-center gap-2">
                        <Settings className="w-5 h-5" />
                        Current Point System
                      </h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="bg-slate-600 rounded p-3">
                          <div className="text-slate-400 mb-2 font-semibold">Lead Points</div>
                          <div className="space-y-1 text-slate-300">
                            <div>Win: <span className="text-amber-400 font-semibold">{pointSystem.winLead}</span></div>
                            <div>Loss: <span className="text-amber-400 font-semibold">{pointSystem.lossLead}</span></div>
                            <div>Sweep: <span className="text-amber-400 font-semibold">{pointSystem.bonus2_0Lead}</span></div>
                          </div>
                        </div>
                        <div className="bg-slate-600 rounded p-3">
                          <div className="text-slate-400 mb-2 font-semibold">Assist Points</div>
                          <div className="space-y-1 text-slate-300">
                            <div>Win: <span className="text-amber-400 font-semibold">{pointSystem.winAssist}</span></div>
                            <div>Loss: <span className="text-amber-400 font-semibold">{pointSystem.lossAssist}</span></div>
                            <div>Sweep: <span className="text-amber-400 font-semibold">{pointSystem.bonus2_0Assist}</span></div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Theoretical Analysis */}
                    <div className="bg-slate-700 rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-blue-400 mb-3 flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        Theoretical Distribution (Per Token Unit)
                      </h3>
                      <p className="text-xs text-slate-400 mb-4">
                        Maximum possible points per token unit (winning every round and sweep)
                      </p>
                      <div className="space-y-3">
                        <div className="bg-slate-600 rounded p-3">
                          <div className="text-xs text-slate-400 mb-2 font-semibold">Max Possible (Season)</div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-slate-300 font-semibold">Lead Points</span>
                            <span className="text-amber-400 font-bold">{simulationAnalytics.theoretical.leadPoints.toFixed(1)}</span>
                          </div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-slate-300 font-semibold">Assist Points</span>
                            <span className="text-blue-400 font-bold">{simulationAnalytics.theoretical.assistPoints.toFixed(1)}</span>
                          </div>
                          <div className="border-t border-slate-500 my-2"></div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-300 font-semibold">Total Points</span>
                            <span className="text-white font-bold">{simulationAnalytics.theoretical.totalPoints.toFixed(1)}</span>
                          </div>
                        </div>
                        <div className="bg-slate-600 rounded p-3">
                          <div className="text-xs text-slate-400 mb-2 font-semibold">Max Possible (Per Round)</div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-slate-300 font-semibold">Lead Points</span>
                            <span className="text-amber-400 font-bold">{(simulationAnalytics.theoretical.leadPoints / simulationAnalytics.totalRounds).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-slate-300 font-semibold">Assist Points</span>
                            <span className="text-blue-400 font-bold">{(simulationAnalytics.theoretical.assistPoints / simulationAnalytics.totalRounds).toFixed(2)}</span>
                          </div>
                          <div className="border-t border-slate-500 my-2"></div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-300 font-semibold">Total Points</span>
                            <span className="text-white font-bold">{(simulationAnalytics.theoretical.totalPoints / simulationAnalytics.totalRounds).toFixed(2)}</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-amber-900/30 border border-amber-700 rounded p-3 text-center">
                            <div className="text-amber-400 text-2xl font-bold">{simulationAnalytics.theoretical.leadPercentage.toFixed(1)}%</div>
                            <div className="text-xs text-slate-300 mt-1">Lead Points</div>
                          </div>
                          <div className="bg-blue-900/30 border border-blue-700 rounded p-3 text-center">
                            <div className="text-blue-400 text-2xl font-bold">{simulationAnalytics.theoretical.assistPercentage.toFixed(1)}%</div>
                            <div className="text-xs text-slate-300 mt-1">Assist Points</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Simulated Results */}
                    <div className="bg-slate-700 rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-green-400 mb-3 flex items-center gap-2">
                        <BarChart3 className="w-5 h-5" />
                        Simulated Results (Per Token Unit Average)
                      </h3>
                      <p className="text-xs text-slate-400 mb-4">
                        Actual points averaged across all token units from the simulation
                      </p>
                      <div className="space-y-3">
                        <div className="bg-slate-600 rounded p-3">
                          <div className="text-xs text-slate-400 mb-2 font-semibold">Season Totals (Average)</div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-slate-300 font-semibold">Lead Points</span>
                            <span className="text-amber-400 font-bold">{simulationAnalytics.simulated.leadPoints.toFixed(1)}</span>
                          </div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-slate-300 font-semibold">Assist Points</span>
                            <span className="text-blue-400 font-bold">{simulationAnalytics.simulated.assistPoints.toFixed(1)}</span>
                          </div>
                          <div className="border-t border-slate-500 my-2"></div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-300 font-semibold">Total Points</span>
                            <span className="text-white font-bold">{simulationAnalytics.simulated.totalPoints.toFixed(1)}</span>
                          </div>
                        </div>
                        <div className="bg-slate-600 rounded p-3">
                          <div className="text-xs text-slate-400 mb-2 font-semibold">Per Round Average</div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-slate-300 font-semibold">Lead Points</span>
                            <span className="text-amber-400 font-bold">{(simulationAnalytics.simulated.leadPoints / simulationAnalytics.totalRounds).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-slate-300 font-semibold">Assist Points</span>
                            <span className="text-blue-400 font-bold">{(simulationAnalytics.simulated.assistPoints / simulationAnalytics.totalRounds).toFixed(2)}</span>
                          </div>
                          <div className="border-t border-slate-500 my-2"></div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-300 font-semibold">Total Points</span>
                            <span className="text-white font-bold">{(simulationAnalytics.simulated.totalPoints / simulationAnalytics.totalRounds).toFixed(2)}</span>
                          </div>
                        </div>
                        <div className="text-xs text-slate-400 bg-slate-600 rounded p-2">
                          All token units combined: {simulationAnalytics.simulated.totalLeadPoints.toFixed(0)} lead points, {simulationAnalytics.simulated.totalAssistPoints.toFixed(0)} assist points
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-amber-900/30 border border-amber-700 rounded p-3 text-center">
                            <div className="text-amber-400 text-2xl font-bold">{simulationAnalytics.simulated.leadPercentage.toFixed(1)}%</div>
                            <div className="text-xs text-slate-300 mt-1">Lead Points</div>
                          </div>
                          <div className="bg-blue-900/30 border border-blue-700 rounded p-3 text-center">
                            <div className="text-blue-400 text-2xl font-bold">{simulationAnalytics.simulated.assistPercentage.toFixed(1)}%</div>
                            <div className="text-xs text-slate-300 mt-1">Assist Points</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Comparison */}
                    <div className="bg-purple-900/20 border border-purple-700 rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-purple-400 mb-3 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5" />
                        Comparison
                      </h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-slate-400 mb-1">Lead Point Variance</div>
                          <div className={`text-lg font-bold ${Math.abs(simulationAnalytics.simulated.leadPercentage - simulationAnalytics.theoretical.leadPercentage) < 2 ? 'text-green-400' : 'text-yellow-400'}`}>
                            {(simulationAnalytics.simulated.leadPercentage - simulationAnalytics.theoretical.leadPercentage > 0 ? '+' : '')}
                            {(simulationAnalytics.simulated.leadPercentage - simulationAnalytics.theoretical.leadPercentage).toFixed(1)}%
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-400 mb-1">Assist Point Variance</div>
                          <div className={`text-lg font-bold ${Math.abs(simulationAnalytics.simulated.assistPercentage - simulationAnalytics.theoretical.assistPercentage) < 2 ? 'text-green-400' : 'text-yellow-400'}`}>
                            {(simulationAnalytics.simulated.assistPercentage - simulationAnalytics.theoretical.assistPercentage > 0 ? '+' : '')}
                            {(simulationAnalytics.simulated.assistPercentage - simulationAnalytics.theoretical.assistPercentage).toFixed(1)}%
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-slate-400 mt-3">
                        💡 Small variances are expected due to randomization. Large variances may indicate imbalanced settings.
                      </p>
                    </div>

                    {/* Close Button */}
                    <div className="flex justify-end">
                      <button
                        onClick={() => setShowAnalyticsModal(false)}
                        className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition font-semibold"
                      >
                        Close
                      </button>
                    </div>
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