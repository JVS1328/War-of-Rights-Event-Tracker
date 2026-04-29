import React, { useState, useEffect } from 'react';
import {
  Users, Trophy, Calendar, Plus, Trash2, Edit2, Save, X,
  BarChart3, TrendingUp, Award, Download, Upload, Settings,
  ChevronDown, ChevronRight, Star, Target, Map, Flame, Shield, Swords, Maximize2, Zap, Share2,
  CheckCircle2, FileText, Sun, Moon, MoreVertical
} from 'lucide-react';
import {
  generateShareUrl, generateShortShareUrl,
  generateEventShareUrl, generateShortEventShareUrl,
} from './utils/shareSeason';
import {
  migrateToV2,
  migrateLegacyFlatToV2,
  makeDefaultAppState,
  makeDefaultPlayoffConfig as getDefaultPlayoffConfig,
  makeDefaultBalancerSettings as getDefaultBalancerSettings,
  getActiveEvent,
  getActiveSeason,
  updateActiveSeason,
  updateActiveEvent,
  setActiveEvent,
  setActiveSeason,
  addEvent,
  renameActiveEvent,
  removeActiveEvent,
  addSeasonToActiveEvent,
  appendSeasonToActiveEvent,
  renameActiveSeason,
  removeActiveSeason,
  ensureUnitInRegistry,
  renameUnitInEvent,
  removeUnitFromRegistry,
  isUnitReferencedInEvent,
  flattenActiveToLegacy,
} from './utils/eventStore';
import {
  replayEvent,
  replayActiveSeasonUpToWeek,
  replayEventFromAppState,
  replayActiveSeasonUpToWeekFromAppState,
  computeExpectedA,
  accumulateMapHistoryFromSeasons,
  USA_ATTACK_MAPS,
} from './utils/eloEngine';

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

const SeasonTracker = ({ initialShareData = null }) => {
  // v2 app state: events → seasons. All persisted state lives here. Existing
  // top-level field names (units, weeks, etc.) are bound to the active
  // season/event below so the rest of the component reads/writes them as
  // before; only the underlying storage shape is new.
  const [appState, setAppState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return migrateToV2(saved ? JSON.parse(saved) : null);
    } catch (error) {
      console.error('Error loading from localStorage:', error);
      return makeDefaultAppState();
    }
  });

  const activeEvent = getActiveEvent(appState);
  const activeSeason = getActiveSeason(appState);

  // Bind a season-level field as a [value, setter] pair mirroring useState.
  // Setter accepts either a value or an updater function.
  const seasonField = (field) => [
    activeSeason[field],
    (next) => setAppState(prev => updateActiveSeason(prev, s => ({
      ...s,
      [field]: typeof next === 'function' ? next(s[field]) : next,
    }))),
  ];
  const eventField = (field) => [
    activeEvent[field],
    (next) => setAppState(prev => updateActiveEvent(prev, e => ({
      ...e,
      [field]: typeof next === 'function' ? next(e[field]) : next,
    }))),
  ];

  // Season-level persisted state
  const [units, setUnits] = seasonField('units');
  const [nonTokenUnits, setNonTokenUnits] = seasonField('nonTokenUnits');
  const [weeks, setWeeks] = seasonField('weeks');
  const [selectedWeek, setSelectedWeek] = seasonField('selectedWeek');
  const [teamNames, setTeamNames] = seasonField('teamNames');
  const [pointSystem, setPointSystem] = seasonField('pointSystem');
  const [manualAdjustments, setManualAdjustments] = seasonField('manualAdjustments');
  const [unitPlayerCounts, setUnitPlayerCounts] = seasonField('unitPlayerCounts');
  const [divisions, setDivisions] = seasonField('divisions');
  const [mapCooldown, setMapCooldown] = seasonField('mapCooldown');
  const [playoffConfig, setPlayoffConfig] = seasonField('playoffConfig');
  const [balancerSettings, setBalancerSettings] = seasonField('balancerSettings');

  // Event-level persisted state
  const [eloSystem, setEloSystem] = eventField('eloSystem');
  const [eloConfig, setEloConfig] = eventField('eloConfig');

  // Session-only UI state
  const [showSettings, setShowSettings] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showBalancerModal, setShowBalancerModal] = useState(false);
  const [showCasualtyModal, setShowCasualtyModal] = useState(false);
  const [showDivisionModal, setShowDivisionModal] = useState(false);
  const [showMapBiasModal, setShowMapBiasModal] = useState(false);
  const [showRegistryModal, setShowRegistryModal] = useState(false);
  const [statsTab, setStatsTab] = useState('season'); // 'season' | 'event'
  const [heatmapScope, setHeatmapScope] = useState('season'); // 'season' | 'event'
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
  const [balancerResults, setBalancerResults] = useState(null); // Now an array of options
  const [selectedBalanceIndex, setSelectedBalanceIndex] = useState(0);
  const [balancerStatus, setBalancerStatus] = useState('');
  const [draggedUnit, setDraggedUnit] = useState(null);
  const [previewTeams, setPreviewTeams] = useState(null);
  const [draggedMainUnit, setDraggedMainUnit] = useState(null);
  
  // Coord sheet paste state
  const [showCoordPasteModal, setShowCoordPasteModal] = useState(false);
  const [coordPasteText, setCoordPasteText] = useState('');
  const [coordParsedRows, setCoordParsedRows] = useState([]);
  const [coordNewUnitDrafts, setCoordNewUnitDrafts] = useState({});

  // Simulation state
  const [simLeadNightsPerUnit, setSimLeadNightsPerUnit] = useState(2);
  const [simLeadNightsInDivision, setSimLeadNightsInDivision] = useState(0);
  const [simScheduleOnly, setSimScheduleOnly] = useState(false);
  const [simLeadMode, setSimLeadMode] = useState('fullWeeks'); // 'fullWeeks' or 'rounds'

  const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains('dark'));
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  const overflowMenuRef = React.useRef(null);

  // Generic choice dialog — used wherever we used to call window.prompt()
  // for a discrete list of actions (Share kind, ADD vs REPLACE on import,
  // etc). State holds the open dialog spec; askChoice returns a Promise
  // that resolves to the chosen value (or null if dismissed).
  const [choiceDialog, setChoiceDialog] = useState(null);
  const askChoice = ({ title, message, choices }) => new Promise(resolve => {
    setChoiceDialog({
      title, message, choices,
      onChoose: (value) => { setChoiceDialog(null); resolve(value); },
      onClose:  ()      => { setChoiceDialog(null); resolve(null);  },
    });
  });

  const toggleTheme = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };

  useEffect(() => {
    if (!showOverflowMenu) return;
    const handleClickOutside = (e) => {
      if (overflowMenuRef.current && !overflowMenuRef.current.contains(e.target)) {
        setShowOverflowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showOverflowMenu]);

  // Save the v2 app state to localStorage whenever it changes.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }, [appState]);

  // Load shared data from URL (once, on mount). v1 / v2-season payloads
  // arrive as { kind: 'season', payload: <flat> }; v2-event payloads arrive
  // as { kind: 'event', event: <Event> }. Each is offered an action via the
  // ChoiceDialog; "add to existing" appends without replacing.
  useEffect(() => {
    if (!initialShareData) return;
    const dismiss = () => window.history.replaceState(null, '', window.location.pathname);

    (async () => {
      if (initialShareData.kind === 'event') {
        const evt = initialShareData.event;
        const choice = await askChoice({
          title: 'Import shared event',
          message: `"${evt.name}" — ${evt.seasons.length} season${evt.seasons.length === 1 ? '' : 's'}, ${Object.keys(evt.unitRegistry || {}).length} units in registry.`,
          choices: [
            { value: 'add',     label: 'Add as new event',         description: 'Append a new event without touching your current one.', variant: 'primary' },
            { value: 'replace', label: 'Replace active event',     description: 'Overwrites the current active event in place.',         variant: 'danger'  },
            { value: null,      label: 'Cancel', variant: 'cancel' },
          ],
        });
        if (choice === 'add') {
          setAppState(prev => ({
            ...prev,
            events: [...prev.events, evt],
            activeEventId: evt.id,
            activeSeasonId: evt.seasons[0]?.id ?? null,
          }));
        } else if (choice === 'replace') {
          setAppState(prev => ({
            ...prev,
            events: prev.events.map(e => e.id === prev.activeEventId ? evt : e),
            activeEventId: evt.id,
            activeSeasonId: evt.seasons[0]?.id ?? null,
          }));
        }
        dismiss();
        return;
      }

      // Season payload (v1 or v2)
      const choice = await askChoice({
        title: 'Import shared season',
        message: 'A shared season payload — add it under your active event, or start a fresh event with just this season?',
        choices: [
          { value: 'add', label: 'Add as new season',  description: 'Appends under your active event; new unit names merge into the registry.', variant: 'primary'   },
          { value: 'new', label: 'Start fresh event',  description: 'Wipes your current state and creates a new event with just this season.',  variant: 'danger'    },
          { value: null,  label: 'Cancel', variant: 'cancel' },
        ],
      });
      if (choice === 'new') {
        setAppState(migrateLegacyFlatToV2(initialShareData.payload));
      } else if (choice === 'add') {
        const migrated = migrateLegacyFlatToV2(initialShareData.payload);
        const importedSeason = migrated.events[0].seasons[0];
        const importedRegistryNames = Object.values(migrated.events[0].unitRegistry).map(u => u.name);
        setAppState(prev => appendSeasonToActiveEvent(prev, importedSeason, importedRegistryNames));
      }
      dismiss();
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Unit Management — adding to a season's roster also ensures the unit is in
  // the event-level registry. Removing only strips the active season's
  // references; the registry entry persists so historical references in
  // other seasons resolve unchanged.
  const addUnit = () => {
    const name = newUnitName.trim();
    if (!name) return;
    if (units.includes(name)) {
      alert('Unit already exists!');
      return;
    }
    setAppState(prev => {
      const withReg = ensureUnitInRegistry(prev, name);
      return updateActiveSeason(withReg, s => ({ ...s, units: [...s.units, name].sort() }));
    });
    setNewUnitName('');
  };

  const removeUnit = (unitName) => {
    if (!confirm(`Remove ${unitName} from this season? It stays in the event registry so historical references in other seasons are preserved.`)) return;

    setAppState(prev => updateActiveSeason(prev, s => ({
      ...s,
      units: (s.units || []).filter(u => u !== unitName),
      nonTokenUnits: (s.nonTokenUnits || []).filter(u => u !== unitName),
      weeks: (s.weeks || []).map(week => ({
        ...week,
        teamA: (week.teamA || []).filter(u => u !== unitName),
        teamB: (week.teamB || []).filter(u => u !== unitName),
      })),
    })));
  };

  // Rename a unit everywhere in the event: registry + every season's rosters,
  // leads, lookups, casualties, swaps. Stable id under the hood means
  // historical participation isn't lost.
  const renameUnit = (oldName) => {
    const newName = window.prompt(`Rename "${oldName}" to:`, oldName);
    if (newName == null) return;
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;
    setAppState(prev => renameUnitInEvent(prev, oldName, trimmed));
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
      weeklyCasualties: {
        [teamNames.A]: { r1: {}, r2: {} },
        [teamNames.B]: { r1: {}, r2: {} }
      },
      roundSwaps: { r1: [], r2: [] },
      companyConfig: {
        r1: { A: { count: 0, specialCount: 0 }, B: { count: 0, specialCount: 0 } },
        r2: { A: { count: 0, specialCount: 0 }, B: { count: 0, specialCount: 0 } }
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

  // Compute maps on cooldown relative to a given week index
  const getMapsOnCooldown = (weekIndex) => {
    if (mapCooldown <= 0) return new Set();
    const cooldownMaps = new Set();
    const start = Math.max(0, weekIndex - mapCooldown);
    for (let i = start; i < weekIndex; i++) {
      const w = weeks[i];
      if (w.round1Map) cooldownMaps.add(w.round1Map);
      if (w.round2Map) cooldownMaps.add(w.round2Map);
    }
    return cooldownMaps;
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

  // Get effective teams for a specific round, accounting for unit swaps
  const getEffectiveTeams = (week, roundNum) => {
    const baseTeamA = week.teamA || [];
    const baseTeamB = week.teamB || [];
    const swaps = new Set(week.roundSwaps?.[`r${roundNum}`] || []);

    if (swaps.size === 0) return { teamA: baseTeamA, teamB: baseTeamB };

    const teamA = baseTeamA.filter(u => !swaps.has(u)).concat(baseTeamB.filter(u => swaps.has(u)));
    const teamB = baseTeamB.filter(u => !swaps.has(u)).concat(baseTeamA.filter(u => swaps.has(u)));
    return { teamA, teamB };
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

        const effective = getEffectiveTeams(week, roundNum);
        const winningTeam = winner === 'A' ? effective.teamA : effective.teamB;
        const losingTeam = winner === 'A' ? effective.teamB : effective.teamA;

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
        const sweepWinner = week.round1Winner;
        // Only units on the winning side in BOTH rounds get the sweep bonus
        const effectiveR1 = getEffectiveTeams(week, 1);
        const effectiveR2 = getEffectiveTeams(week, 2);
        const r1WinTeam = new Set(sweepWinner === 'A' ? effectiveR1.teamA : effectiveR1.teamB);
        const r2WinTeam = new Set(sweepWinner === 'A' ? effectiveR2.teamA : effectiveR2.teamB);
        const sweepTeam = [...r1WinTeam].filter(u => r2WinTeam.has(u));

        if (isSingleRoundLeads) {
          const r1Lead = week[`lead${sweepWinner}_r1`];
          const r2Lead = week[`lead${sweepWinner}_r2`];
          const sweepLeads = new Set([r1Lead, r2Lead].filter(Boolean));

          sweepTeam.forEach(unit => {
            if (!stats[unit]) return;

            if (sweepLeads.has(unit)) {
              stats[unit].points += pointSystem.bonus2_0Lead;
            } else {
              stats[unit].points += pointSystem.bonus2_0Assist;
            }
          });
        } else {
          const sweepLead = week[`lead${sweepWinner}`];

          sweepTeam.forEach(unit => {
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

    // Apply balance points
    if (pointSystem.balancePoints) {
      weeksToProcess.forEach(week => {
        const r1Swaps = week.roundSwaps?.r1 || [];
        const r2Swaps = week.roundSwaps?.r2 || [];

        if (pointSystem.balancePointsStyle === 'perRound') {
          r1Swaps.forEach(unit => { if (stats[unit]) stats[unit].points += pointSystem.balancePoints; });
          r2Swaps.forEach(unit => { if (stats[unit]) stats[unit].points += pointSystem.balancePoints; });
        } else {
          // perNight: each unit gets balance points at most once per week
          const balanced = new Set([...r1Swaps, ...r2Swaps]);
          balanced.forEach(unit => { if (stats[unit]) stats[unit].points += pointSystem.balancePoints; });
        }
      });
    }

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
      previousStats = calculatePointsUpToWeek(previousWeekIdx);
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

        const pointsDelta = data.points - (previousStats[unit]?.points || 0);

        return {
          unit,
          ...data,
          elo: currentEloValue,
          eloDelta,
          pointsDelta,
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

  // Project an engine mapHistory into the { overall, byMap } shape used by
  // the UI. Attacker/defender breakdowns come from USA_ATTACK_MAPS since map
  // identity is direction-agnostic.
  const projectMapHistory = (mapHistory) => {
    const byMap = {};
    const overall = {
      totalRounds: 0, usaWins: 0, csaWins: 0,
      attackerWins: 0, defenderWins: 0,
      usaAttackWins: 0, usaAttackRounds: 0,
      usaDefenseWins: 0, usaDefenseRounds: 0,
      csaAttackWins: 0, csaAttackRounds: 0,
      csaDefenseWins: 0, csaDefenseRounds: 0,
    };

    for (const [mapName, entry] of Object.entries(mapHistory)) {
      const isUsaAttack = USA_ATTACK_MAPS.has(mapName);
      const usaWins = entry.USA.wins;
      const csaWins = entry.CSA.wins;
      const totalCasualties = entry.USA.casualtiesTaken + entry.CSA.casualtiesTaken;

      byMap[mapName] = {
        plays: entry.plays, usaWins, csaWins,
        attackerWins: isUsaAttack ? usaWins : csaWins,
        defenderWins: isUsaAttack ? csaWins : usaWins,
        totalCasualties,
      };

      overall.totalRounds += entry.plays;
      overall.usaWins += usaWins;
      overall.csaWins += csaWins;

      if (isUsaAttack) {
        overall.usaAttackRounds += entry.plays;
        overall.csaDefenseRounds += entry.plays;
        overall.usaAttackWins += usaWins;
        overall.csaDefenseWins += csaWins;
        overall.attackerWins += usaWins;
        overall.defenderWins += csaWins;
      } else {
        overall.csaAttackRounds += entry.plays;
        overall.usaDefenseRounds += entry.plays;
        overall.csaAttackWins += csaWins;
        overall.usaDefenseWins += usaWins;
        overall.attackerWins += csaWins;
        overall.defenderWins += usaWins;
      }
    }
    return { overall, byMap };
  };

  // Map stats for an arbitrary slice of seasons. KISS: the engine's
  // accumulator does the math; this just projects to the UI shape.
  const mapStatsForSeasons = (seasons) =>
    projectMapHistory(accumulateMapHistoryFromSeasons(seasons));

  // Event-wide map stats — used by the engine-side win-prob path and the
  // Event tab. `calculateMapStats` retains its legacy name (and event-wide
  // semantics) so the existing call sites still work.
  const calculateMapStats = () => mapStatsForSeasons(activeEvent.seasons);

  // Active-season-only map stats for the Season tab.
  const calculateSeasonMapStats = () => mapStatsForSeasons(activeSeason ? [activeSeason] : []);

  // Per-unit per-map combined record (sums USA + CSA sides). The engine
  // tracks per-side records; legacy callers want the combined view.
  const calculateUnitMapStats = (maxWeekIndex = null) => {
    const result = maxWeekIndex !== null
      ? replayActiveSeasonUpToWeekFromAppState(appState, activeEvent.id, activeSeason.id, maxWeekIndex)
      : replayEventFromAppState(appState, activeEvent.id);

    const out = {};
    for (const [unit, byMap] of Object.entries(result.unitOnMapSide)) {
      out[unit] = {};
      for (const [mapName, sides] of Object.entries(byMap)) {
        out[unit][mapName] = {
          wins: sides.USA.wins + sides.CSA.wins,
          losses: sides.USA.losses + sides.CSA.losses,
        };
      }
    }
    return out;
  };

  // Win probability uses the same engine math as Elo updates: pre-round Elo
  // plus shrunk Elo-equivalent adjustments from map-side and unit-on-map-side
  // history (controlled by event.eloConfig). Returns the legacy shape with a
  // factors object so the existing UI breakdown badges keep working.
  const calculateWinProbability = (teamA, teamB, mapName, flipped, weekIndex) => {
    if (teamA.length === 0 || teamB.length === 0) return null;

    const previousWeekIdx = weekIndex != null ? weekIndex - 1 : weeks.length - 1;
    // Even at week 0, global-scope events get prior-event map history as a
    // seed — the engine produces an empty unit Elo + seeded mapHistory.
    const result = replayActiveSeasonUpToWeekFromAppState(
      appState, activeEvent.id, activeSeason.id,
      previousWeekIdx >= 0 ? previousWeekIdx : -1,
    );

    const playerCountFor = (unit) => {
      const week = weekIndex != null ? weeks[weekIndex] : null;
      const counts = week?.unitPlayerCounts?.[unit] || unitPlayerCounts[unit];
      if (!counts) return 25;
      const min = parseInt(counts.min) || 0;
      const max = parseInt(counts.max) || 0;
      return (min + max) / 2 || 25;
    };

    const exp = computeExpectedA(
      { unitElo: result.unitElo, mapHistory: result.mapHistory, unitOnMapSide: result.unitOnMapSide },
      { teamA, teamB, mapName, flipped, playerCountFor },
      result.eloConfig,
      result.eloSystem.initialElo,
    );

    const probA = Math.max(0.05, Math.min(0.95, exp.expectedA));
    return {
      teamAProb: Math.round(probA * 1000) / 10,
      teamBProb: Math.round((1 - probA) * 1000) / 10,
      factors: {
        elo: { probA: Math.round(exp.eloOnlyProbA * 1000) / 10 },
        globalMap: mapName ? { probA: Math.round(exp.eloPlusMapProbA * 1000) / 10 } : null,
        unitMap: mapName ? { probA: Math.round(probA * 1000) / 10 } : null,
      },
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

        const effective = getEffectiveTeams(week, roundNum);
        const winningTeam = winner === 'A' ? effective.teamA : effective.teamB;
        const losingTeam = winner === 'A' ? effective.teamB : effective.teamA;

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

  // Calculate Elo Ratings — thin wrapper over the engine. The engine walks
  // every round in (season, week, round) order and folds map/unit history
  // back into expected probabilities, so map signals affect ratings whenever
  // event.eloConfig.mapWeight or unitWeight is non-zero. Default knobs keep
  // it pure-rating until the user opts in.
  const calculateEloRatings = (maxWeekIndex = null) => {
    const result = maxWeekIndex !== null
      ? replayActiveSeasonUpToWeekFromAppState(appState, activeEvent.id, activeSeason.id, maxWeekIndex)
      : replayEventFromAppState(appState, activeEvent.id);
    return { eloRatings: result.unitElo, roundsPlayed: result.roundsPlayed };
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

  // --- Coord Sheet Paste helpers ---
  const coordNormalize = (name) => name.replace(/\s/g, '').replace(/-/g, '').replace(/[()]/g, '').toLowerCase();

  const coordFuzzyMatch = (parsed, registered) => {
    const normParsed = coordNormalize(parsed);
    // Exact match
    const exact = registered.find(u => u === parsed);
    if (exact) return exact;
    // Normalized match
    const norm = registered.find(u => coordNormalize(u) === normParsed);
    if (norm) return norm;
    // Substring / includes match
    const sub = registered.find(u => coordNormalize(u).includes(normParsed) || normParsed.includes(coordNormalize(u)));
    if (sub) return sub;
    return null;
  };

  const parseCoordPaste = () => {
    if (!coordPasteText.trim()) return;
    const lines = coordPasteText.trim().split('\n');
    const rows = [];
    for (const line of lines) {
      const cols = line.split('\t');
      if (cols.length < 1 || !cols[0].trim()) continue;
      const rawName = cols[0].trim();
      // Strip trailing side indicator like " (T)" or " (B)"
      const cleanName = rawName.replace(/\s*\([TB]\)\s*$/i, '').trim();
      const nums = cols.slice(1).map(c => parseInt(c.trim())).filter(n => !isNaN(n));
      const min = nums.length >= 2 ? Math.min(nums[0], nums[1]) : (nums.length === 1 ? nums[0] : 0);
      const max = nums.length >= 2 ? Math.max(nums[0], nums[1]) : min;
      const match = coordFuzzyMatch(cleanName, units);
      rows.push({
        rawName,
        cleanName,
        min,
        max,
        matchedUnit: match,
        action: match ? 'match' : 'create', // 'match' | 'create' | 'ignore'
        newUnitName: cleanName,
        newUnitIsToken: true,
      });
    }
    setCoordParsedRows(rows);
  };

  const openCoordPasteModal = () => {
    setCoordPasteText('');
    setCoordParsedRows([]);
    setShowCoordPasteModal(true);
  };

  const applyCoordPaste = () => {
    const newCounts = { ...balancerUnitCounts };
    const newUnits = [...units];
    const newNonToken = [...nonTokenUnits];

    for (const row of coordParsedRows) {
      if (row.action === 'ignore') continue;

      let unitName;
      if (row.action === 'match' && row.matchedUnit) {
        unitName = row.matchedUnit;
      } else if (row.action === 'create') {
        unitName = row.newUnitName.trim();
        if (!unitName) continue;
        if (!newUnits.includes(unitName)) {
          newUnits.push(unitName);
          if (!row.newUnitIsToken && !newNonToken.includes(unitName)) {
            newNonToken.push(unitName);
          }
        }
      } else {
        continue;
      }

      newCounts[unitName] = { min: row.min, max: row.max };
    }

    newUnits.sort();
    setUnits(newUnits);
    setNonTokenUnits(newNonToken);
    setBalancerUnitCounts(newCounts);
    setShowCoordPasteModal(false);
    setCoordParsedRows([]);
    setCoordPasteText('');
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
        // result is now an array of top N solutions
        const enrichedResults = result.map(r => {
          const stats = calculatePreviewStats(r.teamA, r.teamB);
          return {
            ...r,
            avgHistoryA: stats.avgHistoryA,
            avgHistoryB: stats.avgHistoryB,
            combinedAvgHistory: stats.combinedAvgHistory,
            round1Probability: stats.round1Probability,
            round2Probability: stats.round2Probability
          };
        });
        setBalancerResults(enrichedResults);
        setSelectedBalanceIndex(0);
        setBalancerStatus(`Found ${enrichedResults.length} balance option${enrichedResults.length > 1 ? 's' : ''}! Best Avg. Diff: ${enrichedResults[0].score.toFixed(1)}`);
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

    // Players to assign (not forced to either team)
    const playersToAssign = players.filter(p => !forcedA.has(p) && !forcedB.has(p)).sort();
    const n = playersToAssign.length;
    const totalCombos = 1 << n; // 2^n bitmask iteration — each bit assigns a unit to team A or B

    const hasDivisions = balancerSettings.divisionOppositionWeight > 0 && Object.keys(unitDivision).length > 0;
    const forcedAArray = [...forcedA];
    const forcedBArray = [...forcedB];

    // Evaluate raw metrics for a given bitmask
    const evaluateMask = (mask) => {
      const teamAArray = [...forcedAArray];
      const teamBArray = [...forcedBArray];
      for (let i = 0; i < n; i++) {
        if (mask & (1 << i)) teamAArray.push(playersToAssign[i]);
        else teamBArray.push(playersToAssign[i]);
      }

      const minA = teamAArray.reduce((sum, p) => sum + (unitData[p]?.min || 0), 0);
      const maxA = teamAArray.reduce((sum, p) => sum + (unitData[p]?.max || 0), 0);
      const minB = teamBArray.reduce((sum, p) => sum + (unitData[p]?.min || 0), 0);
      const maxB = teamBArray.reduce((sum, p) => sum + (unitData[p]?.max || 0), 0);

      const regimentCountDiff = Math.abs(teamAArray.length - teamBArray.length);
      const rangeA = maxA - minA;
      const rangeB = maxB - minB;
      const rangeSimilarity = Math.abs(rangeA - rangeB);
      const avgA = teamAArray.length > 0 ? (minA + maxA) / 2 : 0;
      const avgB = teamBArray.length > 0 ? (minB + maxB) / 2 : 0;
      const avgDiff = Math.abs(avgA - avgB);

      let teammateScore = 0;
      const scorePairs = (arr) => {
        for (let i = 0; i < arr.length; i++) {
          for (let j = i + 1; j < arr.length; j++) {
            const count = teammateHistory[arr[i]]?.[arr[j]] || 0;
            teammateScore += (averageTeammateCount > 0 && count > overTeamingThreshold)
              ? count * overTeamingPenaltyMultiplier : count;
          }
        }
      };
      scorePairs(teamAArray);
      scorePairs(teamBArray);

      let divisionOppositionScore = 0;
      if (hasDivisions) {
        for (const uA of teamAArray) {
          const divA = unitDivision[uA];
          if (!divA) continue;
          for (const uB of teamBArray) {
            if (unitDivision[uB] === divA) divisionOppositionScore--;
          }
        }
      }

      let gap = 0;
      if (maxA < minB) gap = minB - maxA;
      else if (maxB < minA) gap = minA - maxB;

      return {
        stats: [minA, maxA, minB, maxB],
        isValid: gap <= maxPlayerDiff && avgDiff <= maxPlayerDiff,
        raw: { teammateScore, avgDiff, regimentCountDiff, rangeSimilarity, divisionOppositionScore }
      };
    };

    // Pass 1: Iterate all partitions to find min/max of each metric (for normalization)
    const metricKeys = ['teammateScore', 'avgDiff', 'regimentCountDiff', 'rangeSimilarity', 'divisionOppositionScore'];
    const metricMin = {};
    const metricMax = {};
    for (const key of metricKeys) { metricMin[key] = Infinity; metricMax[key] = -Infinity; }

    for (let mask = 0; mask < totalCombos; mask++) {
      const { raw } = evaluateMask(mask);
      for (const key of metricKeys) {
        if (raw[key] < metricMin[key]) metricMin[key] = raw[key];
        if (raw[key] > metricMax[key]) metricMax[key] = raw[key];
      }
    }

    const metricRange = {};
    for (const key of metricKeys) { metricRange[key] = metricMax[key] - metricMin[key]; }

    const weights = {
      teammateScore: balancerSettings.teammateWeight,
      avgDiff: balancerSettings.avgDiffWeight,
      regimentCountDiff: balancerSettings.regimentCountWeight,
      rangeSimilarity: balancerSettings.rangeSimilarityWeight,
      divisionOppositionScore: balancerSettings.divisionOppositionWeight
    };

    // Pass 2: Normalize, score, and find top N partitions
    const topN = balancerSettings.balanceOptionCount || 3;
    const topValidSolutions = []; // sorted ascending by score (best first)
    let bestOverallSolution = null;

    const insertIntoTopN = (arr, entry) => {
      // Insert into sorted array, keep only topN entries
      let inserted = false;
      for (let i = 0; i < arr.length; i++) {
        if (entry.score < arr[i].score) {
          arr.splice(i, 0, entry);
          inserted = true;
          break;
        }
      }
      if (!inserted) arr.push(entry);
      if (arr.length > topN) arr.pop();
    };

    for (let mask = 0; mask < totalCombos; mask++) {
      const result = evaluateMask(mask);
      let score = 0;
      for (const key of metricKeys) {
        const normalized = metricRange[key] === 0 ? 0 : (result.raw[key] - metricMin[key]) / metricRange[key];
        score += normalized * weights[key];
      }

      if (result.isValid) {
        if (topValidSolutions.length < topN || score < topValidSolutions[topValidSolutions.length - 1].score) {
          insertIntoTopN(topValidSolutions, { mask, score, stats: result.stats });
        }
      }
      if (!bestOverallSolution || score < bestOverallSolution.score) {
        bestOverallSolution = { mask, score, stats: result.stats };
      }
    }

    // Reconstruct teams from a bitmask
    const buildTeams = (mask) => {
      const teamA = [...forcedAArray];
      const teamB = [...forcedBArray];
      for (let i = 0; i < n; i++) {
        if (mask & (1 << i)) teamA.push(playersToAssign[i]);
        else teamB.push(playersToAssign[i]);
      }
      return [teamA, teamB];
    };

    // Prefer valid solutions; fall back to overall best for error reporting
    if (topValidSolutions.length > 0) {
      return topValidSolutions.map(sol => {
        const [teamA, teamB] = buildTeams(sol.mask);
        const [minA, maxA, minB, maxB] = sol.stats;
        const avgDiff = Math.abs((minA + maxA) / 2 - (minB + maxB) / 2);
        return { teamA, teamB, score: avgDiff, minA, maxA, minB, maxB, compositeScore: sol.score };
      });
    } else if (bestOverallSolution) {
      const [minA, maxA, minB, maxB] = bestOverallSolution.stats;
      let gap = 0;
      if (maxA < minB) gap = minB - maxA;
      else if (maxB < minA) gap = minA - maxB;
      const avgDiff = Math.abs((minA + maxA) / 2 - (minB + maxB) / 2);

      let msg = `Could not find a balance within the max player difference of ${maxPlayerDiff}.\n`;
      if (gap > maxPlayerDiff) {
        msg += `The best possible balance has a range gap of ${gap.toFixed(0)} players.\n`;
      }
      if (avgDiff > maxPlayerDiff) {
        msg += `The best possible balance has an average difference of ${avgDiff.toFixed(0)} players.\n`;
      }
      alert(msg.trim());
      return null;
    } else {
      alert('No valid team composition could be found with the given constraints.');
      return null;
    }
  };

  const SPECIAL_COMPANY_CAP = 20;

  // Distribute regiments into companies for one side of one round
  const distributeCompanies = (regiments, unitCountsSource, numCompanies, numSpecial) => {
    if (numCompanies <= 0 || regiments.length === 0) return [];

    // Build regiment list with avg player count (use balancer-aware counts)
    const regs = regiments.map(unit => {
      const counts = unitCountsSource[unit] || { min: 0, max: 0 };
      return { unit, avg: (counts.min + counts.max) / 2 };
    }).sort((a, b) => b.avg - a.avg); // largest first for greedy fill

    const companies = Array.from({ length: numCompanies }, (_, i) => ({
      index: i,
      isSpecial: i < numSpecial,
      cap: i < numSpecial ? SPECIAL_COMPANY_CAP : Infinity,
      regiments: [],
      total: 0
    }));

    // Greedy: assign each regiment to the company with the least total that can fit it
    for (const reg of regs) {
      let best = null;
      for (const co of companies) {
        if (co.total + reg.avg > co.cap) continue;
        if (!best || co.total < best.total) best = co;
      }
      // If no company can fit under cap, put in the least-full regular company
      if (!best) {
        const regulars = companies.filter(c => !c.isSpecial);
        best = regulars.length > 0
          ? regulars.reduce((a, b) => a.total <= b.total ? a : b)
          : companies.reduce((a, b) => a.total <= b.total ? a : b);
      }
      best.regiments.push(reg.unit);
      best.total += reg.avg;
    }

    return companies.map((co, i) => ({
      label: co.isSpecial ? `Special Co ${i + 1}` : `Co ${i + 1 - numSpecial}`,
      isSpecial: co.isSpecial,
      regiments: co.regiments,
      totalAvg: co.total
    }));
  };

  const applyBalancerResults = () => {
    if (!balancerResults || !selectedWeek) return;

    const { teamA, teamB } = balancerResults[selectedBalanceIndex];

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

  // New Season function — clears all data and starts from a fresh app state.
  const newSeason = () => {
    if (!confirm('Start a new season? This will clear all current data (units, weeks, standings, etc.). Make sure to export your current season first!')) {
      return;
    }
    setAppState(makeDefaultAppState());
    alert('New season started! All data has been cleared.');
  };

  // Share — offers active season or whole event. Single-season events skip
  // the dialog and share the season directly (matches legacy behavior).
  const shareSeason = async () => {
    let kind;
    if (activeEvent.seasons.length > 1) {
      const choice = await askChoice({
        title: 'Share',
        message: `What would you like to share?`,
        choices: [
          {
            value: 'event',
            label: `Whole event — ${activeEvent.name}`,
            description: `Registry + all ${activeEvent.seasons.length} seasons. Recipients get the full picture.`,
            variant: 'primary',
          },
          {
            value: 'season',
            label: `Active season only — ${activeSeason.name}`,
            description: 'Just this season. Smaller payload; matches legacy share behavior.',
            variant: 'secondary',
          },
          { value: null, label: 'Cancel', variant: 'cancel' },
        ],
      });
      if (!choice) return;
      kind = choice;
    } else {
      kind = 'season';
    }

    let url;
    if (kind === 'event') {
      try { url = await generateShortEventShareUrl(activeEvent); }
      catch { url = generateEventShareUrl(activeEvent); }
    } else {
      const flat = flattenActiveToLegacy(appState);
      try { url = await generateShortShareUrl(flat); }
      catch { url = generateShareUrl(flat); }
    }

    try {
      await navigator.clipboard.writeText(url);
      alert(`Share link copied! (${kind === 'event' ? 'Whole event' : 'Active season'})`);
    } catch {
      prompt('Copy this link to share:', url);
    }
  };

  // Export/Import — JSON file download. For multi-season events the file
  // contains the full event tree; otherwise the active-season legacy shape.
  const exportData = () => {
    const isEvent = activeEvent.seasons.length > 1;
    const data = isEvent
      ? { schemaVersion: 2, kind: 'event', event: activeEvent, exportDate: new Date().toISOString() }
      : { ...flattenActiveToLegacy(appState), exportDate: new Date().toISOString() };

    const filename = isEvent
      ? `event-${activeEvent.name.replace(/[^a-z0-9]+/gi, '-')}-${new Date().toISOString().split('T')[0]}.json`
      : `season-tracker-${new Date().toISOString().split('T')[0]}.json`;

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
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
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);

        // v2 event export — full event tree. Offer ADD vs REPLACE.
        if (data?.kind === 'event' && data.event) {
          const evt = data.event;
          const choice = await askChoice({
            title: 'Import event file',
            message: `"${evt.name}" — ${evt.seasons.length} season${evt.seasons.length === 1 ? '' : 's'}, ${Object.keys(evt.unitRegistry || {}).length} units in registry.`,
            choices: [
              { value: 'add',     label: 'Add as new event',     description: 'Append a new event without touching your current one.', variant: 'primary' },
              { value: 'replace', label: 'Replace active event', description: 'Overwrites the current active event in place.',         variant: 'danger'  },
              { value: null,      label: 'Cancel', variant: 'cancel' },
            ],
          });
          if (!choice) return;
          if (choice === 'add') {
            setAppState(prev => ({
              ...prev,
              events: [...prev.events, evt],
              activeEventId: evt.id,
              activeSeasonId: evt.seasons[0]?.id ?? null,
            }));
          } else if (choice === 'replace') {
            setAppState(prev => ({
              ...prev,
              events: prev.events.map(ev => ev.id === prev.activeEventId ? evt : ev),
              activeEventId: evt.id,
              activeSeasonId: evt.seasons[0]?.id ?? null,
            }));
          }
          alert('Event imported.');
          return;
        }

        // Legacy season formats below — normalize fields, then ask whether
        // to add as a new season under the active event or replace wholesale.
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
        let importedPointSystem = { balancePoints: 0, balancePointsStyle: 'perNight', ...(data.pointSystem || pointSystem) };
        if (data.point_system_values) {
          importedPointSystem = {
            winLead: parseInt(data.point_system_values.win_lead) || 4,
            winAssist: parseInt(data.point_system_values.win_assist) || 2,
            lossLead: parseInt(data.point_system_values.loss_lead) || 0,
            lossAssist: parseInt(data.point_system_values.loss_assist) || 1,
            bonus2_0Lead: parseInt(data.point_system_values.bonus_2_0_lead) || 0,
            bonus2_0Assist: parseInt(data.point_system_values.bonus_2_0_assist) || 1,
            balancePoints: 0,
            balancePointsStyle: 'perNight'
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
        
        // Unit player counts — convert string values to numbers
        let importedUnitPlayerCounts = {};
        const rawPlayerCounts = data.unitPlayerCounts || data.unit_player_counts || {};
        Object.entries(rawPlayerCounts).forEach(([unit, counts]) => {
          importedUnitPlayerCounts[unit] = {
            min: parseInt(counts.min) || 0,
            max: parseInt(counts.max) || 0
          };
        });

        // Assemble a flat legacy-shape object — bias fields intentionally
        // dropped (phase 2 derives map adjustments from outcome history).
        const legacyImported = {
          units: data.units || [],
          nonTokenUnits: data.nonTokenUnits || data.non_token_units || [],
          weeks: importedWeeks,
          selectedWeek: null,
          teamNames: importedTeamNames,
          pointSystem: importedPointSystem,
          manualAdjustments: importedManualAdjustments,
          eloSystem: importedEloSystem,
          unitPlayerCounts: importedUnitPlayerCounts,
          divisions: data.divisions || [],
          mapCooldown: parseInt(data.mapCooldown) || 0,
          playoffConfig: data.playoffConfig,
          balancerSettings: data.balancerSettings,
        };

        const choice = await askChoice({
          title: 'Import season file',
          message: `${(legacyImported.weeks || []).length} week${(legacyImported.weeks || []).length === 1 ? '' : 's'}, ${(legacyImported.units || []).length} units. Add it under your active event, or wipe everything and start fresh?`,
          choices: [
            { value: 'add',     label: 'Add as new season', description: 'Appends under your active event; new unit names merge into the registry.', variant: 'primary' },
            { value: 'replace', label: 'Wipe and replace',   description: 'Clears all events and creates a fresh event with just this season.',        variant: 'danger'  },
            { value: null,      label: 'Cancel', variant: 'cancel' },
          ],
        });
        if (!choice) return;
        if (choice === 'replace') {
          setAppState(migrateLegacyFlatToV2(legacyImported));
        } else if (choice === 'add') {
          const migrated = migrateLegacyFlatToV2(legacyImported);
          const importedSeason = migrated.events[0].seasons[0];
          const importedRegistryNames = Object.values(migrated.events[0].unitRegistry).map(u => u.name);
          setAppState(prev => appendSeasonToActiveEvent(prev, importedSeason, importedRegistryNames));
        }

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

  // Compute teammate and opponent stats (per-round, swap-aware)
  const computeStats = () => {
    const teammate = {};
    const opponent = {};

    weeks.forEach(week => {
      [1, 2].forEach(roundNum => {
        const { teamA, teamB } = getEffectiveTeams(week, roundNum);

        teamA.forEach(unit1 => {
          if (!teammate[unit1]) teammate[unit1] = {};
          teamA.forEach(unit2 => {
            if (unit1 !== unit2) {
              teammate[unit1][unit2] = (teammate[unit1][unit2] || 0) + 1;
            }
          });
        });

        teamB.forEach(unit1 => {
          if (!teammate[unit1]) teammate[unit1] = {};
          teamB.forEach(unit2 => {
            if (unit1 !== unit2) {
              teammate[unit1][unit2] = (teammate[unit1][unit2] || 0) + 1;
            }
          });
        });

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
    });

    return { teammate, opponent };
  };

  // Get detailed interactions with round labels (swap-aware)
  const getDetailedInteractions = () => {
    const interactions = {};

    const ensurePair = (a, b) => {
      if (!interactions[a]) interactions[a] = {};
      if (!interactions[a][b]) interactions[a][b] = { teammateRounds: [], opponentRounds: [] };
    };

    weeks.forEach((week, weekIdx) => {
      [1, 2].forEach(roundNum => {
        const label = `W${weekIdx + 1}R${roundNum}`;
        const { teamA, teamB } = getEffectiveTeams(week, roundNum);

        for (let i = 0; i < teamA.length; i++) {
          for (let j = i + 1; j < teamA.length; j++) {
            ensurePair(teamA[i], teamA[j]);
            ensurePair(teamA[j], teamA[i]);
            interactions[teamA[i]][teamA[j]].teammateRounds.push(label);
            interactions[teamA[j]][teamA[i]].teammateRounds.push(label);
          }
        }

        for (let i = 0; i < teamB.length; i++) {
          for (let j = i + 1; j < teamB.length; j++) {
            ensurePair(teamB[i], teamB[j]);
            ensurePair(teamB[j], teamB[i]);
            interactions[teamB[i]][teamB[j]].teammateRounds.push(label);
            interactions[teamB[j]][teamB[i]].teammateRounds.push(label);
          }
        }

        teamA.forEach(unitA => {
          teamB.forEach(unitB => {
            ensurePair(unitA, unitB);
            ensurePair(unitB, unitA);
            interactions[unitA][unitB].opponentRounds.push(label);
            interactions[unitB][unitA].opponentRounds.push(label);
          });
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

  // Calculate teammate composition heatmap (per-round, swap-aware)
  // Build a teammate-composition heatmap from any list of seasons. KISS DRY:
  // the active-season heatmap is just `seasons = [activeSeason]`; the
  // event-wide heatmap is `seasons = activeEvent.seasons`. Pure aggregation —
  // counts how often each pair was on the same team across all rounds in the
  // supplied seasons (swap-aware via getEffectiveTeams).
  const calculateTeammateHeatmapForSeasons = (seasons) => {
    const allWeeks = (seasons || []).flatMap(s => s.weeks || []);
    const teammate = {};
    allWeeks.forEach(week => {
      [1, 2].forEach(roundNum => {
        const { teamA, teamB } = getEffectiveTeams(week, roundNum);
        const ensure = (u) => (teammate[u] ||= {});
        teamA.forEach(u1 => {
          const m = ensure(u1);
          teamA.forEach(u2 => { if (u1 !== u2) m[u2] = (m[u2] || 0) + 1; });
        });
        teamB.forEach(u1 => {
          const m = ensure(u1);
          teamB.forEach(u2 => { if (u1 !== u2) m[u2] = (m[u2] || 0) + 1; });
        });
      });
    });

    // Active units across the supplied seasons.
    const allUnits = new Set();
    for (const s of seasons || []) (s.units || []).forEach(u => allUnits.add(u));
    const activeUnits = [...allUnits].filter(unit =>
      allWeeks.some(w => (w.teamA || []).includes(unit) || (w.teamB || []).includes(unit))
    ).sort();

    const unitActiveWeeks = {};
    activeUnits.forEach(unit => {
      unitActiveWeeks[unit] = allWeeks.filter(w =>
        (w.teamA || []).includes(unit) || (w.teamB || []).includes(unit)
      ).length;
    });

    const heatmapData = [];
    activeUnits.forEach(u1 => {
      activeUnits.forEach(u2 => {
        if (u1 === u2) return;
        const count = teammate[u1]?.[u2] || 0;
        const bothActiveWeeks = Math.min(unitActiveWeeks[u1] || 0, unitActiveWeeks[u2] || 0);
        const bothActiveRounds = bothActiveWeeks * 2;
        if (count > 0 || bothActiveRounds > 0) {
          heatmapData.push({ unit1: u1, unit2: u2, count, bothActiveWeeks, bothActiveRounds });
        }
      });
    });

    return { heatmapData, activeUnits, unitActiveWeeks };
  };

  // Active-season heatmap (legacy callers).
  const calculateTeammateHeatmap = () =>
    calculateTeammateHeatmapForSeasons(activeSeason ? [activeSeason] : []);

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
    // Only count rounds BEFORE the current week (same as balancer)
    const teammate = {};

    weeks.forEach((week, idx) => {
      if (idx >= weekIdx) return;

      [1, 2].forEach(roundNum => {
        const { teamA: rTeamA, teamB: rTeamB } = getEffectiveTeams(week, roundNum);

        rTeamA.forEach(unit1 => {
          if (!teammate[unit1]) teammate[unit1] = {};
          rTeamA.forEach(unit2 => {
            if (unit1 !== unit2) {
              teammate[unit1][unit2] = (teammate[unit1][unit2] || 0) + 1;
            }
          });
        });

        rTeamB.forEach(unit1 => {
          if (!teammate[unit1]) teammate[unit1] = {};
          rTeamB.forEach(unit2 => {
            if (unit1 !== unit2) {
              teammate[unit1][unit2] = (teammate[unit1][unit2] || 0) + 1;
            }
          });
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

  // Render company config + auto-computed assignments for a round/side
  const renderCompanySection = (roundKey) => {
    if (!selectedWeek) return null;
    const defaultSide = { count: 0, specialCount: 0 };
    const rawConfig = selectedWeek.companyConfig?.[roundKey] || {};
    const config = { A: { ...defaultSide, ...rawConfig.A }, B: { ...defaultSide, ...rawConfig.B } };
    const effective = getEffectiveTeams(selectedWeek, roundKey === 'r1' ? 1 : 2);
    const unitCountsSource = selectedWeek.unitPlayerCounts || unitPlayerCounts;

    return (
      <div className="mt-3 space-y-3">
        <label className="block text-sm text-text-secondary mb-1">Company Balancer</label>
        {['A', 'B'].map(side => (
          <div key={side} className="bg-bg-card rounded p-2 space-y-2">
            <div className="text-xs font-semibold text-text-secondary">{teamNames[side]}</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-text-secondary">Companies</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={config[side].count}
                  onChange={(e) => {
                    const newCount = parseInt(e.target.value) || 0;
                    const newSpecial = Math.min(config[side].specialCount, newCount);
                    updateWeek(selectedWeek.id, {
                      companyConfig: {
                        ...(selectedWeek.companyConfig || {}),
                        [roundKey]: {
                          ...(selectedWeek.companyConfig?.[roundKey] || {}),
                          [side]: { count: newCount, specialCount: newSpecial }
                        }
                      }
                    });
                  }}
                  className="w-full px-2 py-1 bg-bg-inset text-text-primary text-sm rounded border border-border-default focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-text-secondary">Special (cap {SPECIAL_COMPANY_CAP})</label>
                <input
                  type="number"
                  min="0"
                  max={config[side].count}
                  value={config[side].specialCount}
                  onChange={(e) => {
                    const val = Math.min(parseInt(e.target.value) || 0, config[side].count);
                    updateWeek(selectedWeek.id, {
                      companyConfig: {
                        ...(selectedWeek.companyConfig || {}),
                        [roundKey]: {
                          ...(selectedWeek.companyConfig?.[roundKey] || {}),
                          [side]: { ...config[side], specialCount: val }
                        }
                      }
                    });
                  }}
                  className="w-full px-2 py-1 bg-bg-inset text-text-primary text-sm rounded border border-border-default focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>
            </div>
            {config[side].count > 0 && (() => {
              const sideUnits = side === 'A' ? effective.teamA : effective.teamB;
              const companies = distributeCompanies(sideUnits, unitCountsSource, config[side].count, config[side].specialCount);
              return companies.length > 0 && (
                <div className="space-y-1 mt-1">
                  {companies.map((co, idx) => (
                    <div key={idx} className={`text-xs rounded px-2 py-1 ${co.isSpecial ? 'bg-yellow-900/40 border border-yellow-700/50' : 'bg-bg-inset'}`}>
                      <span className={`font-semibold ${co.isSpecial ? 'text-yellow-400' : 'text-text-secondary'}`}>
                        {co.label}
                      </span>
                      <span className="text-text-secondary ml-1">({Math.round(co.totalAvg)} avg)</span>
                      {co.isSpecial && co.totalAvg > SPECIAL_COMPANY_CAP && (
                        <span className="text-red-400 ml-1">OVER CAP</span>
                      )}
                      <div className="text-text-secondary mt-0.5">
                        {co.regiments.length > 0 ? co.regiments.join(', ') : 'Empty'}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        ))}
      </div>
    );
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
    const currentResult = balancerResults[selectedBalanceIndex];

    // Don't do anything if dropping on same team
    if (sourceTeam === targetTeam) {
      setDraggedUnit(null);
      return;
    }

    // Create new team arrays
    const newTeamA = sourceTeam === 'A'
      ? currentResult.teamA.filter(u => u !== unit)
      : [...currentResult.teamA, unit];

    const newTeamB = sourceTeam === 'B'
      ? currentResult.teamB.filter(u => u !== unit)
      : [...currentResult.teamB, unit];

    // Calculate new stats
    const newStats = calculatePreviewStats(newTeamA, newTeamB);

    // Update just the selected option in the results array
    const updatedResults = [...balancerResults];
    updatedResults[selectedBalanceIndex] = {
      ...currentResult,
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
    };
    setBalancerResults(updatedResults);

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
        },
        roundSwaps: { r1: [], r2: [] }
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

  // Shared Map Stats block — overall card + per-skirmish-area collapsible
  // groups. Used by both the Season tab (active-season scope) and the Event
  // tab (event-wide scope). `keyPrefix` namespaces the toggleSection keys so
  // the two tabs' expand/collapse state stay independent.
  const renderMapStatsBlock = (stats, keyPrefix) => {
    const { overall, byMap } = stats;
    const pct = (wins, total) => total > 0 ? ((wins / total) * 100).toFixed(1) : '0.0';

    return (
      <>
        {overall.totalRounds > 0 && (
          <div className="mb-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-bg-inset rounded p-3">
                <div className="text-xs text-text-secondary mb-1">USA Overall</div>
                <div className="text-lg font-bold text-blue-400">
                  {pct(overall.usaWins, overall.totalRounds)}% <span className="text-xs font-normal text-text-secondary">({overall.usaWins}/{overall.totalRounds})</span>
                </div>
              </div>
              <div className="bg-bg-inset rounded p-3">
                <div className="text-xs text-text-secondary mb-1">CSA Overall</div>
                <div className="text-lg font-bold text-red-400">
                  {pct(overall.csaWins, overall.totalRounds)}% <span className="text-xs font-normal text-text-secondary">({overall.csaWins}/{overall.totalRounds})</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-bg-inset rounded p-3">
                <div className="text-xs text-text-secondary mb-1">Attackers Won</div>
                <div className="text-lg font-bold text-indigo-400">
                  {pct(overall.attackerWins, overall.totalRounds)}% <span className="text-xs font-normal text-text-secondary">({overall.attackerWins}/{overall.totalRounds})</span>
                </div>
              </div>
              <div className="bg-bg-inset rounded p-3">
                <div className="text-xs text-text-secondary mb-1">Defenders Won</div>
                <div className="text-lg font-bold text-green-400">
                  {pct(overall.defenderWins, overall.totalRounds)}% <span className="text-xs font-normal text-text-secondary">({overall.defenderWins}/{overall.totalRounds})</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="bg-bg-inset rounded p-2">
                <div className="text-xs text-text-secondary">USA Attack</div>
                <div className="text-sm font-semibold text-blue-400">
                  {pct(overall.usaAttackWins, overall.usaAttackRounds)}% <span className="text-xs font-normal text-text-secondary">({overall.usaAttackWins}/{overall.usaAttackRounds})</span>
                </div>
              </div>
              <div className="bg-bg-inset rounded p-2">
                <div className="text-xs text-text-secondary">USA Defense</div>
                <div className="text-sm font-semibold text-blue-400">
                  {pct(overall.usaDefenseWins, overall.usaDefenseRounds)}% <span className="text-xs font-normal text-text-secondary">({overall.usaDefenseWins}/{overall.usaDefenseRounds})</span>
                </div>
              </div>
              <div className="bg-bg-inset rounded p-2">
                <div className="text-xs text-text-secondary">CSA Attack</div>
                <div className="text-sm font-semibold text-red-400">
                  {pct(overall.csaAttackWins, overall.csaAttackRounds)}% <span className="text-xs font-normal text-text-secondary">({overall.csaAttackWins}/{overall.csaAttackRounds})</span>
                </div>
              </div>
              <div className="bg-bg-inset rounded p-2">
                <div className="text-xs text-text-secondary">CSA Defense</div>
                <div className="text-sm font-semibold text-red-400">
                  {pct(overall.csaDefenseWins, overall.csaDefenseRounds)}% <span className="text-xs font-normal text-text-secondary">({overall.csaDefenseWins}/{overall.csaDefenseRounds})</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {Object.entries(MAPS).map(([areaKey, areaMaps]) => {
            const areaName = areaKey.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            const playedMaps = areaMaps.filter(m => byMap[m]);
            if (playedMaps.length === 0) return null;
            const sectionKey = `${keyPrefix}_${areaKey}`;
            return (
              <div key={areaKey} className="bg-bg-inset rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSection(sectionKey)}
                  className="w-full flex items-center justify-between bg-bg-inset px-3 py-2 hover:bg-border-subtle transition"
                >
                  <span className="font-semibold text-text-secondary">{areaName} ({playedMaps.length})</span>
                  {expandedSections[sectionKey] ? (
                    <ChevronDown className="w-4 h-4 text-text-secondary" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-text-secondary" />
                  )}
                </button>
                {expandedSections[sectionKey] && (
                  <div className="p-2 space-y-2">
                    {playedMaps
                      .sort((a, b) => (byMap[b]?.plays || 0) - (byMap[a]?.plays || 0))
                      .map(mapName => {
                        const s = byMap[mapName];
                        const avgCas = s.plays > 0 ? (s.totalCasualties / s.plays).toFixed(0) : 0;
                        return (
                          <div key={mapName} className="bg-bg-card rounded p-2">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-sm font-medium">{mapName}</span>
                              <span className="text-xs text-text-secondary">{s.plays} rounds</span>
                            </div>
                            <div className="text-xs space-y-0.5">
                              <div>
                                <span className="text-blue-300">USA: {s.usaWins} ({pct(s.usaWins, s.plays)}%)</span>
                                <span className="text-text-secondary mx-2">|</span>
                                <span className="text-red-300">CSA: {s.csaWins} ({pct(s.csaWins, s.plays)}%)</span>
                              </div>
                              <div className="text-text-secondary">Casualties: {s.totalCasualties} (avg {avgCas})</div>
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
          <p className="text-text-secondary text-center py-4">No map data available</p>
        )}
      </>
    );
  };

  // Determine the season's champion based on playoffs. Returns
  //   { side, lead, weekName, finalRound }
  // or null when no playoffs occurred. The champion is the winner of the
  // latest playoff week with a result; round 2 takes precedence over round 1.
  // `side` is the in-game side they won as (USA / CSA), resolved through the
  // round's flip flag — the roster team label is only meaningful relative to
  // the in-game side they played, which the flip determines per round.
  const seasonChampion = (season) => {
    const weeks = season.weeks || [];
    const playoffWeeks = weeks.filter(w => w.isPlayoffs && (w.round1Winner || w.round2Winner));
    if (playoffWeeks.length === 0) return null;
    const last = playoffWeeks[playoffWeeks.length - 1];
    const winnerKey = last.round2Winner || last.round1Winner;
    if (!winnerKey) return null;
    const finalRound = last.round2Winner ? 2 : 1;
    const flipped = !!last[`round${finalRound}Flipped`];
    const usaTeamKey = flipped ? 'B' : 'A';
    return {
      side: winnerKey === usaTeamKey ? 'USA' : 'CSA',
      lead: last[`lead${winnerKey}_r${finalRound}`] || last[`lead${winnerKey}`] || null,
      weekName: last.name || `Week ${weeks.indexOf(last) + 1}`,
      finalRound,
    };
  };

  return (
    <div className="min-h-screen bg-bg-page text-text-primary p-2 sm:p-4 lg:p-6">
      <div className="max-w-7xl mx-auto">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between mb-4 gap-3">
            <h1 className="text-xl font-semibold flex items-center gap-2 shrink-0">
              <Trophy className="w-5 h-5 text-indigo-500" />
              <span className="hidden sm:inline">Season Tracker</span>
              <span className="sm:hidden">Tracker</span>
            </h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowStatsModal(!showStatsModal)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-md transition"
              >
                <BarChart3 className="w-4 h-4" />
                <span className="hidden sm:inline">Stats</span>
              </button>
              <button
                onClick={shareSeason}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-md transition"
                title="Copy share link to clipboard"
              >
                <Share2 className="w-4 h-4" />
                <span className="hidden sm:inline">Share</span>
              </button>
              <button
                onClick={() => {
                  const name = window.prompt('New event name:', 'New Event');
                  if (!name) return;
                  setAppState(prev => addEvent(prev, name.trim() || 'New Event'));
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-md transition"
                title="Add a new event (separate ladder, separate registry)"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">New Event</span>
              </button>
              {/* Overflow Menu */}
              <div className="relative" ref={overflowMenuRef}>
                <button
                  onClick={() => setShowOverflowMenu(!showOverflowMenu)}
                  className="p-1.5 rounded-md hover:bg-bg-inset transition"
                  title="More actions"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
                {showOverflowMenu && (
                  <div className="absolute right-0 top-full mt-1 w-48 bg-bg-card border border-border-default rounded-lg shadow-lg z-50 py-1">
                    <button
                      onClick={() => { exportData(); setShowOverflowMenu(false); }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-bg-inset transition text-left"
                    >
                      <Download className="w-4 h-4" /> Export JSON
                    </button>
                    <button
                      onClick={() => { exportToCSV(); setShowOverflowMenu(false); }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-bg-inset transition text-left"
                    >
                      <Download className="w-4 h-4" /> Export CSV
                    </button>
                    <label className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-bg-inset transition cursor-pointer">
                      <Upload className="w-4 h-4" /> Import
                      <input
                        type="file"
                        accept=".json"
                        onChange={(e) => { importData(e); setShowOverflowMenu(false); }}
                        className="hidden"
                      />
                    </label>
                    <button
                      onClick={() => { setShowSettings(!showSettings); setShowOverflowMenu(false); }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-bg-inset transition text-left"
                    >
                      <Settings className="w-4 h-4" /> Settings
                    </button>
                    <button
                      onClick={() => { setShowSimulateModal(true); setShowOverflowMenu(false); }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-bg-inset transition text-left"
                    >
                      <Zap className="w-4 h-4" /> Simulate
                    </button>
                    <div className="border-t border-border-default my-1" />
                    <button
                      onClick={() => { newSeason(); setShowOverflowMenu(false); }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-red-500/20 text-red-500 transition text-left"
                      title="Wipe ALL data (every event, every season)"
                    >
                      <Trash2 className="w-4 h-4" /> Wipe Everything
                    </button>
                  </div>
                )}
              </div>
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-1.5 rounded-md hover:bg-bg-inset transition"
                title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Event + Season Nav */}
          <div className="bg-bg-card border border-border-default rounded-lg p-3 mb-4 flex flex-wrap items-center gap-3">
            {/* Event picker */}
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-text-secondary">Event</span>
              <select
                value={appState.activeEventId}
                onChange={(e) => setAppState(prev => setActiveEvent(prev, e.target.value))}
                className="px-2 py-1.5 bg-bg-input rounded-md border border-border-default text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {appState.events.map(e => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
              <button
                onClick={() => {
                  const name = window.prompt('Rename event:', activeEvent.name);
                  if (!name || !name.trim() || name.trim() === activeEvent.name) return;
                  setAppState(prev => renameActiveEvent(prev, name.trim()));
                }}
                className="p-1 rounded-md hover:bg-bg-inset text-text-secondary"
                title="Rename event"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                disabled={appState.events.length <= 1}
                onClick={() => {
                  if (!confirm(`Delete event "${activeEvent.name}" and all its seasons? This cannot be undone.`)) return;
                  setAppState(prev => removeActiveEvent(prev));
                }}
                className="p-1 rounded-md hover:bg-red-500/20 text-red-500 disabled:opacity-30 disabled:hover:bg-transparent"
                title={appState.events.length <= 1 ? 'Cannot delete the last event' : 'Delete event'}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="h-6 w-px bg-border-default" />

            {/* Season tabs */}
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-xs uppercase tracking-wide text-text-secondary mr-1">Seasons</span>
              {activeEvent.seasons.map(s => (
                <button
                  key={s.id}
                  onClick={() => setAppState(prev => setActiveSeason(prev, s.id))}
                  className={`px-2.5 py-1 text-sm rounded-md border transition ${
                    s.id === appState.activeSeasonId
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'border-border-default hover:bg-bg-inset text-text-secondary'
                  }`}
                >
                  {s.name}
                </button>
              ))}
              <button
                onClick={() => {
                  const name = window.prompt(`New season name:`, `Season ${activeEvent.seasons.length + 1}`);
                  if (name === null) return;
                  setAppState(prev => addSeasonToActiveEvent(prev, (name && name.trim()) || undefined));
                }}
                className="p-1.5 rounded-md hover:bg-bg-inset text-text-secondary"
                title="Add a new season to this event (inherits the current roster)"
              >
                <Plus className="w-4 h-4" />
              </button>
              <div className="h-5 w-px bg-border-default mx-1" />
              <button
                onClick={() => {
                  const name = window.prompt('Rename season:', activeSeason.name);
                  if (!name || !name.trim() || name.trim() === activeSeason.name) return;
                  setAppState(prev => renameActiveSeason(prev, name.trim()));
                }}
                className="p-1 rounded-md hover:bg-bg-inset text-text-secondary"
                title="Rename current season"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                disabled={activeEvent.seasons.length <= 1}
                onClick={() => {
                  if (!confirm(`Delete season "${activeSeason.name}"? This cannot be undone.`)) return;
                  setAppState(prev => removeActiveSeason(prev));
                }}
                className="p-1 rounded-md hover:bg-red-500/20 text-red-500 disabled:opacity-30 disabled:hover:bg-transparent"
                title={activeEvent.seasons.length <= 1 ? 'Cannot delete the last season' : 'Delete season'}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Registry summary — clickable to open the full editor */}
            <button
              onClick={() => setShowRegistryModal(true)}
              className="ml-auto flex items-center gap-1.5 px-2 py-1 text-xs text-text-secondary hover:bg-bg-inset rounded-md transition"
              title="Manage event-level unit registry"
            >
              <Users className="w-3.5 h-3.5" />
              {Object.keys(activeEvent.unitRegistry).length} unit{Object.keys(activeEvent.unitRegistry).length === 1 ? '' : 's'} in registry
            </button>
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <div className="bg-bg-card border border-border-default rounded-lg p-4 mb-4">
              <h2 className="text-lg font-semibold mb-3">System Settings</h2>
              
              {/* Point System Section */}
              <div className="mb-6">
                <h3 className="text-sm font-medium uppercase tracking-wide text-text-secondary mb-2">Point System</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-text-secondary mb-1">Win Lead Points</label>
                  <input
                    type="number"
                    value={pointSystem.winLead}
                    onChange={(e) => setPointSystem({ ...pointSystem, winLead: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-bg-input rounded-md border border-border-default focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">Win Assist Points</label>
                  <input
                    type="number"
                    value={pointSystem.winAssist}
                    onChange={(e) => setPointSystem({ ...pointSystem, winAssist: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-bg-input rounded-md border border-border-default focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">Loss Lead Points</label>
                  <input
                    type="number"
                    value={pointSystem.lossLead}
                    onChange={(e) => setPointSystem({ ...pointSystem, lossLead: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-bg-input rounded-md border border-border-default focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">Loss Assist Points</label>
                  <input
                    type="number"
                    value={pointSystem.lossAssist}
                    onChange={(e) => setPointSystem({ ...pointSystem, lossAssist: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-bg-input rounded-md border border-border-default focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">2-0 Bonus Lead</label>
                  <input
                    type="number"
                    value={pointSystem.bonus2_0Lead}
                    onChange={(e) => setPointSystem({ ...pointSystem, bonus2_0Lead: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-bg-input rounded-md border border-border-default focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">2-0 Bonus Assist</label>
                  <input
                    type="number"
                    value={pointSystem.bonus2_0Assist}
                    onChange={(e) => setPointSystem({ ...pointSystem, bonus2_0Assist: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-bg-input rounded-md border border-border-default focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">Balancer Points</label>
                  <input
                    type="number"
                    value={pointSystem.balancePoints}
                    onChange={(e) => setPointSystem({ ...pointSystem, balancePoints: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-bg-input rounded-md border border-border-default focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                  />
                </div>
                {pointSystem.balancePoints !== 0 && (
                <div>
                  <label className="block text-sm text-text-secondary mb-1">Balance Points Style</label>
                  <select
                    value={pointSystem.balancePointsStyle || 'perNight'}
                    onChange={(e) => setPointSystem({ ...pointSystem, balancePointsStyle: e.target.value })}
                    className="w-full px-3 py-2 bg-bg-input rounded-md border border-border-default focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                  >
                    <option value="perNight">Per Night</option>
                    <option value="perRound">Per Round</option>
                  </select>
                </div>
                )}
                </div>
              </div>

              {/* Elo System Section */}
              <div className="mb-6">
                <h3 className="text-sm font-medium uppercase tracking-wide text-text-secondary mb-2 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Elo Rating System
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-text-secondary mb-1">Initial Elo</label>
                    <input
                      type="number"
                      value={eloSystem.initialElo}
                      onChange={(e) => setEloSystem({ ...eloSystem, initialElo: parseInt(e.target.value) || 1500 })}
                      className="w-full px-3 py-2 bg-bg-input rounded-md border border-border-default focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-text-secondary mb-1">Standard K-Factor</label>
                    <input
                      type="number"
                      value={eloSystem.kFactorStandard}
                      onChange={(e) => setEloSystem({ ...eloSystem, kFactorStandard: parseInt(e.target.value) || 96 })}
                      className="w-full px-3 py-2 bg-bg-input rounded-md border border-border-default focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-text-secondary mb-1">Provisional K-Factor</label>
                    <input
                      type="number"
                      value={eloSystem.kFactorProvisional}
                      onChange={(e) => setEloSystem({ ...eloSystem, kFactorProvisional: parseInt(e.target.value) || 128 })}
                      className="w-full px-3 py-2 bg-bg-input rounded-md border border-border-default focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-text-secondary mb-1">Provisional Rounds</label>
                    <input
                      type="number"
                      value={eloSystem.provisionalRounds}
                      onChange={(e) => setEloSystem({ ...eloSystem, provisionalRounds: parseInt(e.target.value) || 10 })}
                      className="w-full px-3 py-2 bg-bg-input rounded-md border border-border-default focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-text-secondary mb-1">Sweep Bonus (×)</label>
                    <input
                      type="number"
                      step="0.05"
                      value={eloSystem.sweepBonusMultiplier}
                      onChange={(e) => setEloSystem({ ...eloSystem, sweepBonusMultiplier: parseFloat(e.target.value) || 1.25 })}
                      className="w-full px-3 py-2 bg-bg-input rounded-md border border-border-default focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-text-secondary mb-1">Lead Multiplier (×)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={eloSystem.leadMultiplier}
                      onChange={(e) => setEloSystem({ ...eloSystem, leadMultiplier: parseFloat(e.target.value) || 2.0 })}
                      className="w-full px-3 py-2 bg-bg-input rounded-md border border-border-default focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-text-secondary mb-1">Size Influence</label>
                    <input
                      type="number"
                      step="0.1"
                      value={eloSystem.sizeInfluence}
                      onChange={(e) => setEloSystem({ ...eloSystem, sizeInfluence: parseFloat(e.target.value) || 1.0 })}
                      className="w-full px-3 py-2 bg-bg-input rounded-md border border-border-default focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-text-secondary mb-1">Playoff Multiplier (×)</label>
                    <input
                      type="number"
                      step="0.05"
                      value={eloSystem.playoffMultiplier}
                      onChange={(e) => setEloSystem({ ...eloSystem, playoffMultiplier: parseFloat(e.target.value) || 1.25 })}
                      className="w-full px-3 py-2 bg-bg-input rounded-md border border-border-default focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Map & Unit History Influence */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium uppercase tracking-wide text-text-secondary">Map &amp; Unit History Influence</h3>
                  <button
                    onClick={() => setEloConfig({
                      mapWeight: 1.0, unitWeight: 1.0, priorRounds: 10,
                      carryAlpha: eloConfig.carryAlpha ?? 0.5,
                      mapStatsScope: eloConfig.mapStatsScope ?? 'event',
                    })}
                    className="text-xs text-text-secondary hover:text-indigo-400 underline transition"
                    title="Reset weights and shrinkage to recommended defaults"
                  >
                    Reset to defaults
                  </button>
                </div>
                <p className="text-xs text-text-secondary mb-3">
                  Map-side and per-unit-on-side outcome history feed expected win probability via Bayesian-shrunk Elo equivalents.
                  The engine uses <strong>every prior round</strong> in the event (and across events under <em>global</em> scope).
                  Confidence Samples controls regularization, not how much data is used: at <em>n</em> samples a rate reaches
                  <em> n / (n + samples)</em> of full strength, so a single 100% round can't slam ratings while a long pattern eventually approaches full influence.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm text-text-secondary mb-1" title="Multiplier on the map-side history's Elo-equivalent contribution. 0 ignores it; 1 uses full Bayesian-shrunk strength.">Map Weight</label>
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      value={eloConfig.mapWeight}
                      onChange={(e) => setEloConfig({ ...eloConfig, mapWeight: Math.max(0, parseFloat(e.target.value) || 0) })}
                      className="w-full px-3 py-2 bg-bg-input rounded-md border border-border-default focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-text-secondary mb-1" title="Multiplier on each unit's per-side record on the map. 0 ignores per-unit history; 1 uses full Bayesian-shrunk strength.">Unit Weight</label>
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      value={eloConfig.unitWeight}
                      onChange={(e) => setEloConfig({ ...eloConfig, unitWeight: Math.max(0, parseFloat(e.target.value) || 0) })}
                      className="w-full px-3 py-2 bg-bg-input rounded-md border border-border-default focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label
                      className="block text-sm text-text-secondary mb-1"
                      title="Sample size at which the historical rate reaches half its full Elo-equivalent strength. The engine still uses ALL prior rounds — this only controls regularization. Lower = trust small samples sooner (noisier); higher = require more data before signals matter."
                    >
                      Confidence Samples
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={eloConfig.priorRounds}
                      onChange={(e) => setEloConfig({ ...eloConfig, priorRounds: Math.max(1, parseInt(e.target.value) || 10) })}
                      className="w-full px-3 py-2 bg-bg-input rounded-md border border-border-default focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-text-secondary mb-1" title="Source of map history. 'Event only' uses just this event; 'All events (global)' folds in every prior event's rounds as a starting seed (unit-on-side history stays event-scoped since unit identity is per-event).">Map Stats Scope</label>
                    <select
                      value={eloConfig.mapStatsScope}
                      onChange={(e) => setEloConfig({ ...eloConfig, mapStatsScope: e.target.value })}
                      className="w-full px-3 py-2 bg-bg-input rounded-md border border-border-default focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                    >
                      <option value="event">Event only</option>
                      <option value="global">All events (global)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Map Cooldown Section */}
              <div className="mb-6">
                <h3 className="text-sm font-medium uppercase tracking-wide text-text-secondary mb-2 flex items-center gap-2">
                  <Map className="w-5 h-5" />
                  Map Cooldown
                </h3>
                <div className="flex items-center gap-3">
                  <div>
                    <label className="block text-sm text-text-secondary mb-1">Weeks Until Replayable</label>
                    <input
                      type="number"
                      min="0"
                      value={mapCooldown}
                      onChange={(e) => setMapCooldown(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-24 px-3 py-2 bg-bg-input rounded-md border border-border-default focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                    />
                  </div>
                  <span className="text-xs text-text-secondary mt-5">
                    {mapCooldown === 0
                      ? 'Disabled — maps can be replayed immediately'
                      : `Maps played in the last ${mapCooldown} week${mapCooldown > 1 ? 's' : ''} will be marked on cooldown`}
                  </span>
                </div>
              </div>

              {/* Balancer Settings Section */}
              <div className="mb-6">
                <h3 className="text-sm font-medium uppercase tracking-wide text-text-secondary mb-2 flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Team Balancer Weights
                </h3>
                <p className="text-xs text-text-secondary mb-3">
                  Adjust the weights used in the composite score calculation. Higher weights increase the importance of that metric.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm text-text-secondary mb-1">Teammate History Weight</label>
                    <input
                      type="number"
                      step="0.1"
                      value={balancerSettings.teammateWeight}
                      onChange={(e) => setBalancerSettings({ ...balancerSettings, teammateWeight: parseFloat(e.target.value) || 1.0 })}
                      className="w-full px-3 py-2 bg-bg-input rounded-md border border-border-default focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-text-secondary mb-1">Avg Difference Weight</label>
                    <input
                      type="number"
                      step="0.1"
                      value={balancerSettings.avgDiffWeight}
                      onChange={(e) => setBalancerSettings({ ...balancerSettings, avgDiffWeight: parseFloat(e.target.value) || 1.0 })}
                      className="w-full px-3 py-2 bg-bg-input rounded-md border border-border-default focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-text-secondary mb-1">Regiment Count Weight</label>
                    <input
                      type="number"
                      step="0.1"
                      value={balancerSettings.regimentCountWeight}
                      onChange={(e) => setBalancerSettings({ ...balancerSettings, regimentCountWeight: parseFloat(e.target.value) || 0.75 })}
                      className="w-full px-3 py-2 bg-bg-input rounded-md border border-border-default focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-text-secondary mb-1">Range Similarity Weight</label>
                    <input
                      type="number"
                      step="0.1"
                      value={balancerSettings.rangeSimilarityWeight}
                      onChange={(e) => setBalancerSettings({ ...balancerSettings, rangeSimilarityWeight: parseFloat(e.target.value) || 0.50 })}
                      className="w-full px-3 py-2 bg-bg-input rounded-md border border-border-default focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                    />
                  </div>
                  {divisions.length > 0 && (
                    <div>
                      <label className="block text-sm text-text-secondary mb-1">Division Opposition Weight</label>
                      <input
                        type="number"
                        step="0.1"
                        value={balancerSettings.divisionOppositionWeight}
                        onChange={(e) => setBalancerSettings({ ...balancerSettings, divisionOppositionWeight: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 bg-bg-input rounded-md border border-border-default focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                      />
                    </div>
                  )}
                </div>
                <div className="mt-4">
                  <label className="block text-sm text-text-secondary mb-1">Balance Options to Show</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={balancerSettings.balanceOptionCount}
                    onChange={(e) => setBalancerSettings({ ...balancerSettings, balanceOptionCount: Math.max(1, Math.min(10, parseInt(e.target.value) || 3)) })}
                    className="w-24 px-3 py-2 bg-bg-input rounded-md border border-border-default focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                  />
                  <span className="text-xs text-text-secondary ml-2">Number of balance options the balancer will return (1-10)</span>
                </div>
                <div className="mt-3 text-xs text-text-secondary bg-bg-inset rounded p-3">
                  <p className="font-semibold text-text-secondary mb-2">💡 Weight Explanations:</p>
                  <ul className="space-y-1 ml-4">
                    <li><strong>Teammate History:</strong> Penalizes units that have played together frequently</li>
                    <li><strong>Avg Difference:</strong> Minimizes the average player count difference between teams</li>
                    <li><strong>Regiment Count:</strong> Favors equal regiment counts per team (e.g., 8v8 over 11v5)</li>
                    <li><strong>Range Similarity:</strong> Ensures both teams have similar min-to-max spread (e.g., both 45-55 rather than one 45-50 and one 30-60)</li>
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
                  className="flex items-center gap-2 px-4 py-2 border border-border-default hover:bg-bg-inset rounded-lg transition"
                >
                  <Map className="w-4 h-4" />
                  Map History
                </button>
              </div>
            </div>
          )}

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
            {/* Left Column - Weeks */}
            <div className="bg-bg-card border border-border-default rounded-lg p-4 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Calendar className="w-6 h-6" />
                  Weeks ({weeks.length})
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleEnlarge('weeks')}
                    className="p-1.5 rounded-md hover:bg-bg-inset transition"
                    title="Enlarge View"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={addWeek}
                    className="p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition"
                    title="Add Week"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="space-y-2 max-h-64 sm:max-h-96 overflow-y-auto">
                {weeks.map((week) => (
                  <div
                    key={week.id}
                    className={`p-4 rounded-lg transition cursor-pointer ${
                      selectedWeek?.id === week.id
                        ? 'bg-indigo-600 text-white'
                        : 'bg-bg-inset hover:bg-border-subtle'
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
                          className="flex-1 px-2 py-1 bg-bg-input rounded-md border border-border-default outline-none"
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
                          className="p-1 rounded-md hover:bg-bg-inset transition"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeWeek(week.id);
                          }}
                          className="p-1 rounded-md hover:bg-red-500/20 text-red-500 transition"
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
              className="bg-bg-card border border-border-default rounded-lg p-4 shadow-sm"
              onDragOver={handleMainDragOver}
              onDrop={handleMainDropToUnassigned}
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Users className="w-6 h-6" />
                  {selectedWeek ? `Available Units (${getAvailableUnitsForWeek().length})` : `Units (${units.length})`}
                </h2>
                <button
                  onClick={() => toggleEnlarge('units')}
                  className="p-1.5 rounded-md hover:bg-bg-inset transition"
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
                  className="flex-1 px-3 py-2 bg-bg-input rounded-md border border-border-default focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                />
                <button
                  onClick={addUnit}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-md transition"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {selectedWeek && getAvailableUnitsForWeek().length > 0 && (
                <div className="mb-2 text-xs text-text-muted bg-bg-inset rounded-md p-2">
                  💡 Drag units to teams or use A/B buttons
                </div>
              )}
              <div className="space-y-2 max-h-48 sm:max-h-72 overflow-y-auto">
                {(selectedWeek ? getAvailableUnitsForWeek() : units).map((unit) => {
                  const isNonToken = nonTokenUnits.includes(unit);
                  return (
                    <div
                      key={unit}
                      draggable={selectedWeek ? true : false}
                      onDragStart={() => selectedWeek && handleMainDragStart(unit, null)}
                      className={`flex justify-between items-center p-3 bg-bg-inset rounded-md ${
                        selectedWeek ? 'cursor-move hover:bg-border-subtle' : ''
                      } transition`}
                    >
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleNonTokenStatus(unit)}
                          className={`px-2 py-1 rounded text-xs font-bold transition ${
                            isNonToken
                              ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                              : 'bg-bg-card hover:bg-border-subtle text-text-muted'
                          }`}
                          title={isNonToken ? "Non-token unit (click to toggle)" : "Token unit (click to toggle)"}
                        >
                          {isNonToken ? '*' : '○'}
                        </button>
                        <span className={`font-medium ${isNonToken ? 'text-indigo-400' : ''}`}>
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
                          onClick={() => renameUnit(unit)}
                          className="p-1 rounded-md hover:bg-bg-inset text-text-secondary transition"
                          title="Rename unit (updates everywhere in the event)"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => removeUnit(unit)}
                          className="p-1 rounded-md hover:bg-red-500/20 text-red-500 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
             </div>
            </div>

            {/* Right Column - Standings */}
            <div className="bg-bg-card border border-border-default rounded-lg p-4 shadow-sm sm:col-span-2 lg:col-span-1">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Award className="w-6 h-6" />
                  Standings
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleEnlarge('standings')}
                    className="p-1.5 rounded-md hover:bg-bg-inset transition"
                    title="Enlarge View"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setRankByElo(!rankByElo)}
                    className="px-2.5 py-1 border border-border-default hover:bg-bg-inset rounded-md text-sm transition flex items-center gap-1"
                    title={rankByElo ? "Rank by Points" : "Rank by Elo"}
                  >
                    <TrendingUp className="w-3 h-3" />
                    {rankByElo ? "Elo" : "Points"}
                  </button>
                  {divisions && divisions.length > 0 && (
                    <button
                      onClick={() => setShowGroupedStandings(!showGroupedStandings)}
                      className="px-2.5 py-1 border border-border-default hover:bg-bg-inset rounded-md text-sm transition flex items-center gap-1"
                      title={showGroupedStandings ? "Show All" : "Group by Division"}
                    >
                      {showGroupedStandings ? <Users className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                      {showGroupedStandings ? "Grouped" : "All"}
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-2 max-h-64 sm:max-h-96 overflow-y-auto">
                {showGroupedStandings && divisions && divisions.length > 0 ? (
                  // Grouped view by division
                  getGroupedStandings().map((group) => (
                    <div key={group.name} className="mb-4">
                      <h3 className="text-sm font-bold text-text-secondary mb-2 px-2 flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        {group.name}
                      </h3>
                      <div className="space-y-2">
                        {group.units.map((stat) => {
                          const isNonToken = nonTokenUnits.includes(stat.unit);
                          return (
                            <div
                              key={stat.unit}
                              className="bg-bg-inset rounded-md p-3"
                            >
                              <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-indigo-400 font-bold text-lg">
                                    #{stat.divisionRank || stat.currentRank}
                                  </span>
                                {stat.rankDelta !== null && stat.rankDelta !== undefined && (
                                  <span className={`text-xs font-semibold ${
                                    stat.rankDelta > 0 ? 'text-green-400' :
                                    stat.rankDelta < 0 ? 'text-red-400' :
                                    'text-text-secondary'
                                  }`}>
                                    {stat.rankDelta > 0 ? `↑${stat.rankDelta}` :
                                     stat.rankDelta < 0 ? `↓${Math.abs(stat.rankDelta)}` :
                                     '−'}
                                  </span>
                                )}
                                <span className={`font-semibold ${isNonToken ? 'text-indigo-400' : ''}`}>
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
                                  <span className="text-indigo-400 font-semibold">
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
                                  className="p-1 hover:bg-bg-inset rounded transition"
                                  title="Adjust points"
                                >
                                  <Edit2 className="w-3 h-3 text-text-secondary" />
                                </button>
                                <span className="text-green-400 font-bold text-xl">
                                  {stat.points}
                                </span>
                                {stat.pointsDelta !== 0 && (
                                  <span className={`text-xs ml-1 ${stat.pointsDelta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    ({stat.pointsDelta > 0 ? '+' : ''}{stat.pointsDelta})
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs text-text-secondary">
                              <div>L-Wins: {stat.leadWins}</div>
                              <div>L-Loss: {stat.leadLosses}</div>
                              <div>A-Wins: {stat.assistWins}</div>
                              <div>A-Loss: {stat.assistLosses}</div>
                              <div className="col-span-2 text-indigo-400">
                                Elo: {Math.round(stat.elo)} ({stat.rounds} rounds)
                              </div>
                            </div>
                            {manualAdjustments[stat.unit] != null && manualAdjustments[stat.unit] !== 0 && (
                              <div className="mt-1 text-xs text-indigo-400">
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
                        className="bg-bg-inset rounded-md p-3"
                      >
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-indigo-400 font-bold text-lg">
                              #{index + 1}
                            </span>
                          {stat.rankDelta !== null && stat.rankDelta !== undefined && (
                            <span className={`text-xs font-semibold ${
                              stat.rankDelta > 0 ? 'text-green-400' :
                              stat.rankDelta < 0 ? 'text-red-400' :
                              'text-text-secondary'
                            }`}>
                              {stat.rankDelta > 0 ? `↑${stat.rankDelta}` :
                               stat.rankDelta < 0 ? `↓${Math.abs(stat.rankDelta)}` :
                               '−'}
                            </span>
                          )}
                          <span className={`font-semibold ${isNonToken ? 'text-indigo-400' : ''}`}>
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
                            <span className="text-indigo-400 font-semibold">
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
                            className="p-1 hover:bg-bg-inset rounded transition"
                            title="Adjust points"
                          >
                            <Edit2 className="w-3 h-3 text-text-secondary" />
                          </button>
                          <span className="text-green-400 font-bold text-xl">
                            {stat.points}
                          </span>
                          {stat.pointsDelta !== 0 && (
                            <span className={`text-xs ml-1 ${stat.pointsDelta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                              ({stat.pointsDelta > 0 ? '+' : ''}{stat.pointsDelta})
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-text-secondary">
                        <div>L-Wins: {stat.leadWins}</div>
                        <div>L-Loss: {stat.leadLosses}</div>
                        <div>A-Wins: {stat.assistWins}</div>
                        <div>A-Loss: {stat.assistLosses}</div>
                        <div className="col-span-2 text-indigo-400">
                          Elo: {Math.round(stat.elo)} ({stat.rounds} rounds)
                        </div>
                      </div>
                      {manualAdjustments[stat.unit] != null && manualAdjustments[stat.unit] !== 0 && (
                        <div className="mt-1 text-xs text-indigo-400">
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
            <div className="mt-6 bg-bg-card border border-border-default rounded-lg p-4">
              <h2 className="text-lg font-semibold mb-4">
                {selectedWeek.name} - Team Rosters
              </h2>
              
              {/* Team Balance Stats */}
              {(() => {
                const stats = calculateWeekTeamStats();
                if (!stats) return null;
                
                return (
                  <div className="mb-6 bg-bg-inset rounded-lg p-4">
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <Target className="w-5 h-5" />
                      Team Balance Overview
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-bg-inset rounded p-3">
                        <div className="text-xs text-text-secondary mb-1">Avg Difference</div>
                        <div className="text-lg font-bold text-indigo-400">
                          {stats.avgDiff.toFixed(1)}
                        </div>
                      </div>
                      <div className="bg-bg-inset rounded p-3">
                        <div className="text-xs text-text-secondary mb-1">Min Difference</div>
                        <div className="text-lg font-bold text-cyan-400">
                          {stats.minDiff.toFixed(0)}
                        </div>
                      </div>
                      <div className="bg-bg-inset rounded p-3">
                        <div className="text-xs text-text-secondary mb-1">Max Difference</div>
                        <div className="text-lg font-bold text-purple-400">
                          {stats.maxDiff.toFixed(0)}
                        </div>
                      </div>
                      <div className="bg-bg-inset rounded p-3">
                        <div className="text-xs text-text-secondary mb-1">Avg Teammate History</div>
                        <div className="text-lg font-bold text-green-400">
                          {stats.combinedAvgHistory.toFixed(2)}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-3">
                      <div className="bg-bg-inset rounded p-3">
                        <div className="text-xs text-text-secondary mb-1">Total Min Pop</div>
                        <div className="text-lg font-bold text-cyan-400">
                          {stats.totalMin}
                        </div>
                      </div>
                      <div className="bg-bg-inset rounded p-3">
                        <div className="text-xs text-text-secondary mb-1">Total Max Pop</div>
                        <div className="text-lg font-bold text-purple-400">
                          {stats.totalMax}
                        </div>
                      </div>
                      <div className="bg-bg-inset rounded p-3">
                        <div className="text-xs text-text-secondary mb-1">Total Average Pop</div>
                        <div className="text-lg font-bold text-indigo-400">
                          {stats.totalAvg.toFixed(1)}
                        </div>
                      </div>
                    </div>
                    {/* Win Probability Bars */}
                    {(stats.round1Probability || stats.round2Probability) && (
                      <div className="mt-4 space-y-3">
                        <h4 className="text-sm font-semibold flex items-center gap-2">
                          <TrendingUp className="w-4 h-4" />
                          Win Probability
                        </h4>
                        {[
                          { label: 'Round 1', prob: stats.round1Probability, map: selectedWeek.round1Map },
                          { label: 'Round 2', prob: stats.round2Probability, map: selectedWeek.round2Map }
                        ].map(({ label, prob, map }) => {
                          if (!prob) return null;
                          return (
                            <div key={label} className="bg-bg-inset rounded p-3">
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-xs text-text-secondary">{label}{map ? ` — ${map}` : ''}</span>
                                <div className="flex gap-3 text-xs">
                                  {prob.factors.elo && (
                                    <span className="text-text-secondary" title="Elo-based probability">Elo: {prob.factors.elo.probA}%</span>
                                  )}
                                  {prob.factors.globalMap && (
                                    <span className="text-text-secondary" title="Global map win rate">Map: {prob.factors.globalMap.probA}%</span>
                                  )}
                                  {prob.factors.unitMap && (
                                    <span className="text-text-secondary" title="Unit map history">Units: {prob.factors.unitMap.probA}%</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-blue-400 w-16 text-right">{teamNames.A} {prob.teamAProb}%</span>
                                <div className="flex-1 h-5 bg-bg-card rounded-full overflow-hidden flex">
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
                      <div className="bg-bg-inset rounded p-3">
                        <h4 className="text-sm font-semibold text-blue-400 mb-2">
                          {teamNames.A} ({stats.teamA.length} units)
                        </h4>
                        <div className="text-text-secondary text-sm space-y-1">
                          <p>Players: {stats.minA}-{stats.maxA} (avg: {stats.avgA.toFixed(1)})</p>
                          <p className="text-xs">
                            Avg Teammate History: <span className="text-cyan-400 font-semibold">{stats.avgHistoryA.toFixed(2)}</span>
                          </p>
                        </div>
                      </div>
                      {/* Team B Stats */}
                      <div className="bg-bg-inset rounded p-3">
                        <h4 className="text-sm font-semibold text-red-400 mb-2">
                          {teamNames.B} ({stats.teamB.length} units)
                        </h4>
                        <div className="text-text-secondary text-sm space-y-1">
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
                        <div className="mt-3 bg-bg-inset rounded p-3">
                          <div className="text-xs text-text-secondary mb-2">
                            Division Matchups: <span className="text-indigo-400 font-bold text-sm">{matchups.length}</span>
                          </div>
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {matchups.map((m, i) => (
                              <div key={i} className="text-xs text-text-secondary flex items-center gap-1">
                                <span className="text-blue-400">{m.unitA}</span>
                                <span className="text-text-secondary">vs</span>
                                <span className="text-red-400">{m.unitB}</span>
                                <span className="text-indigo-400 ml-1">({m.division})</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                    <p className="text-xs text-text-secondary mt-3 text-center">
                      💡 Lower teammate history = better variety • Counts rounds played together before the current week.
                    </p>
                  </div>
                );
              })()}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Team A */}
                <div
                  className="bg-bg-inset rounded-lg p-4 min-h-[200px]"
                  onDragOver={handleMainDragOver}
                  onDrop={() => handleMainDrop('A')}
                >
                  <div className="mb-3">
                    <input
                      type="text"
                      value={teamNames.A}
                      onChange={(e) => setTeamNames({ ...teamNames, A: e.target.value })}
                      className="w-full px-3 py-2 bg-bg-input text-center font-bold text-lg rounded-md border border-border-default focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    />
                  </div>
                  {selectedWeek.teamA.length === 0 && (
                    <div className="text-center text-text-secondary py-8 border-2 border-dashed border-border-default rounded">
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
                          className="flex justify-between items-center p-2 bg-bg-card rounded cursor-move hover:bg-bg-inset transition"
                        >
                          <div className="flex flex-col flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{unit}</span>
                              <span className="text-xs text-text-secondary ml-2">{minMax}</span>
                            </div>
                            <span className="text-xs text-text-secondary">
                              Elo: {Math.round(unitElo)} | TII: {unitTii.toFixed(3)}
                            </span>
                          </div>
                          <button
                            onClick={() => removeUnitFromTeam(unit, 'A')}
                            className="p-1 hover:bg-red-500/20 text-red-500 rounded transition ml-2"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {!selectedWeek.isPlayoffs && !selectedWeek.isSingleRoundLeads && (
                    <div className="mt-3">
                      <label className="block text-sm text-text-secondary mb-1">Lead Unit</label>
                      <select
                        value={selectedWeek.leadA || ''}
                        onChange={(e) => updateWeek(selectedWeek.id, { leadA: e.target.value || null })}
                        className="w-full px-3 py-2 bg-bg-input rounded-md border border-border-default focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
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
                  className="bg-bg-inset rounded-lg p-4 min-h-[200px]"
                  onDragOver={handleMainDragOver}
                  onDrop={() => handleMainDrop('B')}
                >
                  <div className="mb-3">
                    <input
                      type="text"
                      value={teamNames.B}
                      onChange={(e) => setTeamNames({ ...teamNames, B: e.target.value })}
                      className="w-full px-3 py-2 bg-bg-input text-center font-bold text-lg rounded-md border border-border-default focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    />
                  </div>
                  {selectedWeek.teamB.length === 0 && (
                    <div className="text-center text-text-secondary py-8 border-2 border-dashed border-border-default rounded">
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
                          className="flex justify-between items-center p-2 bg-bg-card rounded cursor-move hover:bg-bg-inset transition"
                        >
                          <div className="flex flex-col flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{unit}</span>
                              <span className="text-xs text-text-secondary ml-2">{minMax}</span>
                            </div>
                            <span className="text-xs text-text-secondary">
                              Elo: {Math.round(unitElo)} | TII: {unitTii.toFixed(3)}
                            </span>
                          </div>
                          <button
                            onClick={() => removeUnitFromTeam(unit, 'B')}
                            className="p-1 hover:bg-red-500/20 text-red-500 rounded transition ml-2"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {!selectedWeek.isPlayoffs && !selectedWeek.isSingleRoundLeads && (
                    <div className="mt-3">
                      <label className="block text-sm text-text-secondary mb-1">Lead Unit</label>
                      <select
                        value={selectedWeek.leadB || ''}
                        onChange={(e) => updateWeek(selectedWeek.id, { leadB: e.target.value || null })}
                        className="w-full px-3 py-2 bg-bg-input rounded-md border border-border-default focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
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
                <label className="flex items-center gap-2 text-text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedWeek.isPlayoffs || false}
                    onChange={(e) => updateWeek(selectedWeek.id, {
                      isPlayoffs: e.target.checked,
                      ...(e.target.checked && { isSingleRoundLeads: false })
                    })}
                    className="w-4 h-4 rounded border-border-default bg-bg-card focus:ring-2 focus:ring-indigo-500"
                  />
                  <Star className="w-4 h-4" />
                  <span className="font-semibold">Playoffs Week</span>
                </label>
              </div>

              {/* Single Round Leads Toggle */}
              <div className="mb-4">
                <label className="flex items-center gap-2 text-text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedWeek.isSingleRoundLeads || false}
                    onChange={(e) => updateWeek(selectedWeek.id, {
                      isSingleRoundLeads: e.target.checked,
                      ...(e.target.checked && { isPlayoffs: false })
                    })}
                    className="w-4 h-4 rounded border-border-default bg-bg-card focus:ring-2 focus:ring-indigo-500"
                  />
                  <Star className="w-4 h-4" />
                  <span className="font-semibold">Single Round Leads</span>
                </label>
              </div>

              {/* Playoffs Lead Selection */}
              {selectedWeek.isPlayoffs && (
                <div className="mb-6 bg-bg-inset rounded-lg p-4">
                  <h3 className="text-lg font-bold mb-3">Playoff Round Leads</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-text-secondary mb-1">R1 Lead {teamNames.A}</label>
                      <select
                        value={selectedWeek.leadA_r1 || ''}
                        onChange={(e) => updateWeek(selectedWeek.id, { leadA_r1: e.target.value || null })}
                        className="w-full px-3 py-2 bg-bg-input rounded-md border border-border-default focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                      >
                        <option value="">Select...</option>
                        {selectedWeek.teamA.map((unit) => (
                          <option key={unit} value={unit}>{unit}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-text-secondary mb-1">R1 Lead {teamNames.B}</label>
                      <select
                        value={selectedWeek.leadB_r1 || ''}
                        onChange={(e) => updateWeek(selectedWeek.id, { leadB_r1: e.target.value || null })}
                        className="w-full px-3 py-2 bg-bg-input rounded-md border border-border-default focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                      >
                        <option value="">Select...</option>
                        {selectedWeek.teamB.map((unit) => (
                          <option key={unit} value={unit}>{unit}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-text-secondary mb-1">R2 Lead {teamNames.A}</label>
                      <select
                        value={selectedWeek.leadA_r2 || ''}
                        onChange={(e) => updateWeek(selectedWeek.id, { leadA_r2: e.target.value || null })}
                        className="w-full px-3 py-2 bg-bg-input rounded-md border border-border-default focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                      >
                        <option value="">Select...</option>
                        {selectedWeek.teamA.map((unit) => (
                          <option key={unit} value={unit}>{unit}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-text-secondary mb-1">R2 Lead {teamNames.B}</label>
                      <select
                        value={selectedWeek.leadB_r2 || ''}
                        onChange={(e) => updateWeek(selectedWeek.id, { leadB_r2: e.target.value || null })}
                        className="w-full px-3 py-2 bg-bg-input rounded-md border border-border-default focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
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
                <div className="mb-6 bg-bg-inset rounded-lg p-4">
                  <h3 className="text-lg font-bold mb-3">Round Leads</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-text-secondary mb-1">R1 Lead {teamNames.A}</label>
                      <select
                        value={selectedWeek.leadA_r1 || ''}
                        onChange={(e) => updateWeek(selectedWeek.id, { leadA_r1: e.target.value || null })}
                        className="w-full px-3 py-2 bg-bg-input rounded-md border border-border-default focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                      >
                        <option value="">Select...</option>
                        {selectedWeek.teamA.map((unit) => (
                          <option key={unit} value={unit}>{unit}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-text-secondary mb-1">R1 Lead {teamNames.B}</label>
                      <select
                        value={selectedWeek.leadB_r1 || ''}
                        onChange={(e) => updateWeek(selectedWeek.id, { leadB_r1: e.target.value || null })}
                        className="w-full px-3 py-2 bg-bg-input rounded-md border border-border-default focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                      >
                        <option value="">Select...</option>
                        {selectedWeek.teamB.map((unit) => (
                          <option key={unit} value={unit}>{unit}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-text-secondary mb-1">R2 Lead {teamNames.A}</label>
                      <select
                        value={selectedWeek.leadA_r2 || ''}
                        onChange={(e) => updateWeek(selectedWeek.id, { leadA_r2: e.target.value || null })}
                        className="w-full px-3 py-2 bg-bg-input rounded-md border border-border-default focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                      >
                        <option value="">Select...</option>
                        {selectedWeek.teamA.map((unit) => (
                          <option key={unit} value={unit}>{unit}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-text-secondary mb-1">R2 Lead {teamNames.B}</label>
                      <select
                        value={selectedWeek.leadB_r2 || ''}
                        onChange={(e) => updateWeek(selectedWeek.id, { leadB_r2: e.target.value || null })}
                        className="w-full px-3 py-2 bg-bg-input rounded-md border border-border-default focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
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
              {(() => {
                const selectedWeekIdx = weeks.findIndex(w => w.id === selectedWeek.id);
                const cooldownMaps = getMapsOnCooldown(selectedWeekIdx);
                return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {/* Round 1 */}
                <div className="bg-bg-inset rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    Round 1
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm text-text-secondary mb-1">Map</label>
                      <select
                        value={selectedWeek.round1Map || ''}
                        onChange={(e) => updateWeek(selectedWeek.id, { round1Map: e.target.value || null })}
                        className="w-full px-3 py-2 bg-bg-input rounded-md border border-border-default focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                      >
                        <option value="">Select map...</option>
                        {ALL_MAPS.map((map) => (
                          <option key={map} value={map} disabled={cooldownMaps.has(map)}>
                            {cooldownMaps.has(map) ? `${map} (cooldown)` : map}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="flex items-center gap-2 text-text-secondary cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedWeek.round1Flipped || false}
                          onChange={(e) => updateWeek(selectedWeek.id, { round1Flipped: e.target.checked })}
                          className="w-4 h-4 rounded border-border-default bg-bg-card"
                        />
                        <span className="text-sm">Flipped</span>
                      </label>
                    </div>
                    <div>
                      <label className="block text-sm text-text-secondary mb-1">Winner</label>
                      <select
                        value={selectedWeek.round1Winner || ''}
                        onChange={(e) => updateWeek(selectedWeek.id, { round1Winner: e.target.value || null })}
                        className="w-full px-3 py-2 bg-bg-input rounded-md border border-border-default focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                      >
                        <option value="">No winner</option>
                        <option value="A">{teamNames.A}</option>
                        <option value="B">{teamNames.B}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-text-secondary mb-1">Casualties {teamNames.A}</label>
                      <input
                        type="number"
                        value={selectedWeek.r1CasualtiesA || 0}
                        onChange={(e) => updateWeek(selectedWeek.id, { r1CasualtiesA: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 bg-bg-input rounded-md border border-border-default focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-text-secondary mb-1">Casualties {teamNames.B}</label>
                      <input
                        type="number"
                        value={selectedWeek.r1CasualtiesB || 0}
                        onChange={(e) => updateWeek(selectedWeek.id, { r1CasualtiesB: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 bg-bg-input rounded-md border border-border-default focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                        min="0"
                      />
                    </div>
                    {/* Round 1 Balance Swaps */}
                    {(selectedWeek.teamA.length > 0 || selectedWeek.teamB.length > 0) && (
                      <div>
                        <label className="block text-sm text-text-secondary mb-1">Balance Swaps</label>
                        <div className="bg-bg-card rounded p-2 max-h-32 overflow-y-auto space-y-1">
                          {[
                            ...selectedWeek.teamA.map(u => ({ unit: u, home: 'A' })),
                            ...selectedWeek.teamB.map(u => ({ unit: u, home: 'B' }))
                          ].sort((a, b) => a.unit.localeCompare(b.unit)).map(({ unit, home }) => {
                            const swaps = selectedWeek.roundSwaps?.r1 || [];
                            const isSwapped = swaps.includes(unit);
                            const effectiveSide = isSwapped ? (home === 'A' ? 'B' : 'A') : home;
                            return (
                              <label key={unit} className="flex items-center gap-2 cursor-pointer hover:bg-bg-inset rounded px-1 py-0.5">
                                <input
                                  type="checkbox"
                                  checked={isSwapped}
                                  onChange={() => {
                                    const current = selectedWeek.roundSwaps?.r1 || [];
                                    const updated = isSwapped
                                      ? current.filter(u => u !== unit)
                                      : [...current, unit];
                                    updateWeek(selectedWeek.id, {
                                      roundSwaps: { ...(selectedWeek.roundSwaps || { r1: [], r2: [] }), r1: updated }
                                    });
                                  }}
                                  className="w-3 h-3 rounded border-border-default bg-bg-inset"
                                />
                                <span className={`text-xs ${isSwapped ? 'text-orange-400 font-semibold' : 'text-text-secondary'}`}>
                                  {unit}
                                </span>
                                <span className={`text-xs ml-auto ${effectiveSide === 'A' ? 'text-blue-400' : 'text-red-400'}`}>
                                  {effectiveSide === 'A' ? teamNames.A : teamNames.B}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {/* Round 1 Company Balancer */}
                    {(selectedWeek.teamA.length > 0 || selectedWeek.teamB.length > 0) && renderCompanySection('r1')}
                  </div>
                </div>

                {/* Round 2 */}
                <div className="bg-bg-inset rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    Round 2
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm text-text-secondary mb-1">Map</label>
                      <select
                        value={selectedWeek.round2Map || ''}
                        onChange={(e) => updateWeek(selectedWeek.id, { round2Map: e.target.value || null })}
                        className="w-full px-3 py-2 bg-bg-input rounded-md border border-border-default focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                      >
                        <option value="">Select map...</option>
                        {ALL_MAPS.map((map) => (
                          <option key={map} value={map} disabled={cooldownMaps.has(map)}>
                            {cooldownMaps.has(map) ? `${map} (cooldown)` : map}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="flex items-center gap-2 text-text-secondary cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedWeek.round2Flipped || false}
                          onChange={(e) => updateWeek(selectedWeek.id, { round2Flipped: e.target.checked })}
                          className="w-4 h-4 rounded border-border-default bg-bg-card"
                        />
                        <span className="text-sm">Flipped</span>
                      </label>
                    </div>
                    <div>
                      <label className="block text-sm text-text-secondary mb-1">Winner</label>
                      <select
                        value={selectedWeek.round2Winner || ''}
                        onChange={(e) => updateWeek(selectedWeek.id, { round2Winner: e.target.value || null })}
                        className="w-full px-3 py-2 bg-bg-input rounded-md border border-border-default focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                      >
                        <option value="">No winner</option>
                        <option value="A">{teamNames.A}</option>
                        <option value="B">{teamNames.B}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-text-secondary mb-1">Casualties {teamNames.A}</label>
                      <input
                        type="number"
                        value={selectedWeek.r2CasualtiesA || 0}
                        onChange={(e) => updateWeek(selectedWeek.id, { r2CasualtiesA: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 bg-bg-input rounded-md border border-border-default focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-text-secondary mb-1">Casualties {teamNames.B}</label>
                      <input
                        type="number"
                        value={selectedWeek.r2CasualtiesB || 0}
                        onChange={(e) => updateWeek(selectedWeek.id, { r2CasualtiesB: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 bg-bg-input rounded-md border border-border-default focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                        min="0"
                      />
                    </div>
                    {/* Round 2 Balance Swaps */}
                    {(selectedWeek.teamA.length > 0 || selectedWeek.teamB.length > 0) && (
                      <div>
                        <label className="block text-sm text-text-secondary mb-1">Balance Swaps</label>
                        <div className="bg-bg-card rounded p-2 max-h-32 overflow-y-auto space-y-1">
                          {[
                            ...selectedWeek.teamA.map(u => ({ unit: u, home: 'A' })),
                            ...selectedWeek.teamB.map(u => ({ unit: u, home: 'B' }))
                          ].sort((a, b) => a.unit.localeCompare(b.unit)).map(({ unit, home }) => {
                            const swaps = selectedWeek.roundSwaps?.r2 || [];
                            const isSwapped = swaps.includes(unit);
                            const effectiveSide = isSwapped ? (home === 'A' ? 'B' : 'A') : home;
                            return (
                              <label key={unit} className="flex items-center gap-2 cursor-pointer hover:bg-bg-inset rounded px-1 py-0.5">
                                <input
                                  type="checkbox"
                                  checked={isSwapped}
                                  onChange={() => {
                                    const current = selectedWeek.roundSwaps?.r2 || [];
                                    const updated = isSwapped
                                      ? current.filter(u => u !== unit)
                                      : [...current, unit];
                                    updateWeek(selectedWeek.id, {
                                      roundSwaps: { ...(selectedWeek.roundSwaps || { r1: [], r2: [] }), r2: updated }
                                    });
                                  }}
                                  className="w-3 h-3 rounded border-border-default bg-bg-inset"
                                />
                                <span className={`text-xs ${isSwapped ? 'text-orange-400 font-semibold' : 'text-text-secondary'}`}>
                                  {unit}
                                </span>
                                <span className={`text-xs ml-auto ${effectiveSide === 'A' ? 'text-blue-400' : 'text-red-400'}`}>
                                  {effectiveSide === 'A' ? teamNames.A : teamNames.B}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {/* Round 2 Company Balancer */}
                    {(selectedWeek.teamA.length > 0 || selectedWeek.teamB.length > 0) && renderCompanySection('r2')}
                  </div>
                </div>
              </div>
                );
              })()}

              {/* Action Buttons */}
              <div className="mt-4 space-y-2">
                <button
                  onClick={openBalancerModal}
                  disabled={!selectedWeek}
                  className={`w-full px-4 py-3 rounded-lg transition flex items-center justify-center gap-2 ${
                    selectedWeek
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      : 'bg-bg-inset text-text-muted cursor-not-allowed'
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
                      : 'bg-bg-inset text-text-secondary cursor-not-allowed'
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
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
              <div className="bg-bg-card rounded-xl shadow-lg border border-border-default max-w-6xl w-full max-h-[85vh] overflow-y-auto">
                <div className="p-4 sm:p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <Target className="w-6 h-6" />
                      Team Balancer - {selectedWeek.name}
                    </h2>
                    <button
                      onClick={closeBalancerModal}
                      className="p-1.5 rounded-md hover:bg-bg-inset transition"
                    >
                      <X className="w-5 h-5 text-text-muted" />
                    </button>
                  </div>

                  {!balancerResults || balancerResults.length === 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Left: Available Units */}
                      <div className="bg-bg-inset rounded-lg p-4">
                        <h3 className="text-lg font-semibold mb-3">Available Units Pool</h3>
                        <div className="bg-bg-inset rounded p-3 max-h-64 overflow-y-auto">
                          {(() => {
                            const assignedUnits = new Set([...selectedWeek.teamA, ...selectedWeek.teamB]);
                            const available = units.filter(u => !assignedUnits.has(u));
                            return available.length > 0 ? (
                              <div className="space-y-1">
                                {available.map(unit => (
                                  <div key={unit} className="text-sm py-1">
                                    {unit}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-text-secondary text-sm">All units assigned</p>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Right: Constraints */}
                      <div className="space-y-4">
                        {/* Max Player Difference */}
                        <div className="bg-bg-inset rounded-lg p-4">
                          <label className="block text-sm text-text-secondary mb-2">Max Player Difference</label>
                          <input
                            type="number"
                            value={balancerMaxDiff}
                            onChange={(e) => setBalancerMaxDiff(parseInt(e.target.value) || 1)}
                            min="0"
                            max="100"
                            className="w-full px-3 py-2 bg-bg-input rounded-md border border-border-default focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                          />
                        </div>

                        {/* Balance Options Count */}
                        <div className="bg-bg-inset rounded-lg p-4">
                          <label className="block text-sm text-text-secondary mb-2">Balance Options</label>
                          <input
                            type="number"
                            value={balancerSettings.balanceOptionCount}
                            onChange={(e) => setBalancerSettings({ ...balancerSettings, balanceOptionCount: Math.max(1, Math.min(10, parseInt(e.target.value) || 3)) })}
                            min="1"
                            max="10"
                            className="w-full px-3 py-2 bg-bg-input rounded-md border border-border-default focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                          />
                          <p className="text-xs text-text-secondary mt-1">How many balance options to compare (1-10)</p>
                        </div>

                        {/* Unit Player Counts */}
                        <div className="bg-bg-inset rounded-lg p-4">
                          <div className="flex justify-between items-center mb-3">
                            <h3 className="text-lg font-semibold">Unit Player Counts</h3>
                            <button
                              onClick={openCoordPasteModal}
                              className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded transition"
                            >
                              <FileText className="w-3 h-3" />
                              Paste from Coord Sheet
                            </button>
                          </div>
                          <div className="max-h-48 overflow-y-auto space-y-2">
                            {units.map(unit => (
                              <div key={unit} className="grid grid-cols-3 gap-2 items-center">
                                <span className="text-sm truncate" title={unit}>{unit}</span>
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
                                  className="px-2 py-1 bg-bg-input rounded-md border border-border-default outline-none text-sm"
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
                                  className="px-2 py-1 bg-bg-input rounded-md border border-border-default outline-none text-sm"
                                />
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Opposing Units */}
                        <div className="bg-bg-inset rounded-lg p-4">
                          <h3 className="text-lg font-semibold mb-3">Opposing Units</h3>
                          <div className="space-y-2 mb-3 max-h-32 overflow-y-auto">
                            {balancerOpposingPairs.map((pair, idx) => (
                              <div key={idx} className="flex justify-between items-center bg-bg-inset rounded p-2">
                                <span className="text-sm">{pair[0]} vs {pair[1]}</span>
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
                              className="px-2 py-1 bg-bg-input rounded-md border border-border-default outline-none text-sm"
                            >
                              <option value="">Select first unit...</option>
                              {units.map(unit => (
                                <option key={unit} value={unit}>{unit}</option>
                              ))}
                            </select>
                            <select
                              id="opposing-unit-2"
                              className="px-2 py-1 bg-bg-input rounded-md border border-border-default outline-none text-sm"
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
                            className="w-full mt-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-md transition"
                          >
                            Add Opposing Pair
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (() => {
                    const activeResult = balancerResults[selectedBalanceIndex];
                    return (
                    /* Balance Results */
                    <div>
                      {/* Option Tabs */}
                      {balancerResults.length > 1 && (
                        <div className="flex flex-wrap gap-2 mb-4 justify-center">
                          {balancerResults.map((opt, idx) => (
                            <button
                              key={idx}
                              onClick={() => setSelectedBalanceIndex(idx)}
                              className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
                                idx === selectedBalanceIndex
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-bg-inset text-text-secondary hover:bg-border-subtle'
                              }`}
                            >
                              {idx === 0 ? (
                                <>
                                  <Star className="w-3.5 h-3.5" />
                                  Best Balance
                                </>
                              ) : (
                                `Option ${idx + 1}`
                              )}
                              <span className={`text-xs ${idx === selectedBalanceIndex ? 'text-white' : 'text-text-secondary'}`}>
                                (Diff: {opt.score.toFixed(1)})
                              </span>
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="text-center mb-6">
                        <h3 className="text-xl font-bold text-green-400 mb-2">
                          {selectedBalanceIndex === 0 ? 'Best Balance Found!' : `Option ${selectedBalanceIndex + 1}`}
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 max-w-4xl mx-auto">
                          <div className="bg-bg-inset rounded p-3">
                            <div className="text-xs text-text-secondary mb-1">Avg Difference</div>
                            <div className="text-lg font-bold text-indigo-400">
                              {activeResult.score.toFixed(1)}
                            </div>
                          </div>
                          <div className="bg-bg-inset rounded p-3">
                            <div className="text-xs text-text-secondary mb-1">Min Difference</div>
                            <div className="text-lg font-bold text-cyan-400">
                              {Math.abs(activeResult.minA - activeResult.minB).toFixed(0)}
                            </div>
                          </div>
                          <div className="bg-bg-inset rounded p-3">
                            <div className="text-xs text-text-secondary mb-1">Max Difference</div>
                            <div className="text-lg font-bold text-purple-400">
                              {Math.abs(activeResult.maxA - activeResult.maxB).toFixed(0)}
                            </div>
                          </div>
                          <div className="bg-bg-inset rounded p-3">
                            <div className="text-xs text-text-secondary mb-1">Avg Teammate History</div>
                            <div className="text-lg font-bold text-green-400">
                              {activeResult.combinedAvgHistory?.toFixed(2) || '0.00'}
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3 mt-3 max-w-4xl mx-auto">
                          <div className="bg-bg-inset rounded p-3">
                            <div className="text-xs text-text-secondary mb-1">Total Min Pop</div>
                            <div className="text-lg font-bold text-cyan-400">
                              {activeResult.minA + activeResult.minB}
                            </div>
                          </div>
                          <div className="bg-bg-inset rounded p-3">
                            <div className="text-xs text-text-secondary mb-1">Total Max Pop</div>
                            <div className="text-lg font-bold text-purple-400">
                              {activeResult.maxA + activeResult.maxB}
                            </div>
                          </div>
                          <div className="bg-bg-inset rounded p-3">
                            <div className="text-xs text-text-secondary mb-1">Total Average Pop</div>
                            <div className="text-lg font-bold text-indigo-400">
                              {((activeResult.minA + activeResult.maxA + activeResult.minB + activeResult.maxB) / 2).toFixed(1)}
                            </div>
                          </div>
                        </div>
                        {balancerSettings.divisionOppositionWeight > 0 && (() => {
                          const matchups = getDivisionMatchups(activeResult.teamA, activeResult.teamB);
                          if (matchups.length === 0) return null;
                          return (
                            <div className="mt-3 max-w-4xl mx-auto bg-bg-inset rounded p-3">
                              <div className="text-xs text-text-secondary mb-2">
                                Division Matchups: <span className="text-indigo-400 font-bold text-sm">{matchups.length}</span>
                              </div>
                              <div className="space-y-1 max-h-32 overflow-y-auto">
                                {matchups.map((m, i) => (
                                  <div key={i} className="text-xs text-text-secondary flex items-center gap-1">
                                    <span className="text-blue-400">{m.unitA}</span>
                                    <span className="text-text-secondary">vs</span>
                                    <span className="text-red-400">{m.unitB}</span>
                                    <span className="text-indigo-400 ml-1">({m.division})</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                        {/* Win Probability Bars */}
                        {(activeResult.round1Probability || activeResult.round2Probability) && (
                          <div className="mt-4 max-w-4xl mx-auto space-y-3">
                            <h4 className="text-sm font-semibold text-text-secondary flex items-center justify-center gap-2">
                              <TrendingUp className="w-4 h-4" />
                              Win Probability
                            </h4>
                            {[
                              { label: 'Round 1', prob: activeResult.round1Probability, map: selectedWeek?.round1Map },
                              { label: 'Round 2', prob: activeResult.round2Probability, map: selectedWeek?.round2Map }
                            ].map(({ label, prob, map }) => {
                              if (!prob) return null;
                              return (
                                <div key={label} className="bg-bg-inset rounded p-3">
                                  <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs text-text-secondary">{label}{map ? ` — ${map}` : ''}</span>
                                    <div className="flex gap-3 text-xs">
                                      {prob.factors.elo && (
                                        <span className="text-text-secondary" title="Elo-based probability">Elo: {prob.factors.elo.probA}%</span>
                                      )}
                                      {prob.factors.globalMap && (
                                        <span className="text-text-secondary" title="Global map win rate">Map: {prob.factors.globalMap.probA}%</span>
                                      )}
                                      {prob.factors.unitMap && (
                                        <span className="text-text-secondary" title="Unit map history">Units: {prob.factors.unitMap.probA}%</span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-blue-400 w-16 text-right">{teamNames.A} {prob.teamAProb}%</span>
                                    <div className="flex-1 h-5 bg-bg-card rounded-full overflow-hidden flex">
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
                        <p className="text-text-secondary text-sm mt-3">
                          💡 Drag units between teams to adjust balance • Lower teammate history = better variety
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        {/* Team A Results */}
                        <div
                          className="bg-bg-inset rounded-lg p-4"
                          onDragOver={handleDragOver}
                          onDrop={() => handleDrop('A')}
                        >
                          <h4 className="text-lg font-semibold text-blue-400 mb-3">
                            Team A ({activeResult.teamA.length} units)
                          </h4>
                          <div className="text-text-secondary text-sm mb-3 space-y-1">
                            <p>Players: {activeResult.minA}-{activeResult.maxA} (avg: {((activeResult.minA + activeResult.maxA) / 2).toFixed(1)})</p>
                            <p className="text-xs">
                              Avg Teammate History: <span className="text-cyan-400 font-semibold">{activeResult.avgHistoryA?.toFixed(2) || '0.00'}</span>
                            </p>
                          </div>
                          <div className="bg-bg-inset rounded p-3 max-h-64 overflow-y-auto">
                            <div className="space-y-1">
                              {activeResult.teamA.sort().map(unit => {
                                const counts = balancerUnitCounts[unit];
                                const minMax = counts ? `(${counts.min}-${counts.max})` : '';
                                return (
                                  <div
                                    key={unit}
                                    draggable
                                    onDragStart={() => handleDragStart(unit, 'A')}
                                    className="text-sm py-2 px-3 bg-bg-card rounded cursor-move hover:bg-bg-inset transition flex items-center justify-between gap-2"
                                  >
                                    <div className="flex items-center gap-2">
                                      <Swords className="w-3 h-3 text-text-muted" />
                                      {unit}
                                    </div>
                                    <span className="text-xs text-text-secondary">{minMax}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {/* Team B Results */}
                        <div
                          className="bg-bg-inset rounded-lg p-4"
                          onDragOver={handleDragOver}
                          onDrop={() => handleDrop('B')}
                        >
                          <h4 className="text-lg font-semibold text-red-400 mb-3">
                            Team B ({activeResult.teamB.length} units)
                          </h4>
                          <div className="text-text-secondary text-sm mb-3 space-y-1">
                            <p>Players: {activeResult.minB}-{activeResult.maxB} (avg: {((activeResult.minB + activeResult.maxB) / 2).toFixed(1)})</p>
                            <p className="text-xs">
                              Avg Teammate History: <span className="text-cyan-400 font-semibold">{activeResult.avgHistoryB?.toFixed(2) || '0.00'}</span>
                            </p>
                          </div>
                          <div className="bg-bg-inset rounded p-3 max-h-64 overflow-y-auto">
                            <div className="space-y-1">
                              {activeResult.teamB.sort().map(unit => {
                                const counts = balancerUnitCounts[unit];
                                const minMax = counts ? `(${counts.min}-${counts.max})` : '';
                                return (
                                  <div
                                    key={unit}
                                    draggable
                                    onDragStart={() => handleDragStart(unit, 'B')}
                                    className="text-sm py-2 px-3 bg-bg-card rounded cursor-move hover:bg-bg-inset transition flex items-center justify-between gap-2"
                                  >
                                    <div className="flex items-center gap-2">
                                      <Swords className="w-3 h-3 text-text-muted" />
                                      {unit}
                                    </div>
                                    <span className="text-xs text-text-secondary">{minMax}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    );
                  })()}

                  {/* Bottom Buttons */}
                  <div className="flex justify-between items-center mt-6 pt-4 border-t border-border-default">
                    <div className="text-text-secondary text-sm">
                      {balancerStatus}
                    </div>
                    <div className="flex gap-2">
                      {!balancerResults || balancerResults.length === 0 ? (
                        <>
                          <button
                            onClick={closeBalancerModal}
                            className="px-4 py-2 border border-border-default hover:bg-bg-inset text-sm rounded-md transition"
                          >
                            Close
                          </button>
                          <button
                            onClick={runBalancer}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-md transition flex items-center gap-2"
                          >
                            <Target className="w-4 h-4" />
                            Balance!
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => { setBalancerResults(null); setSelectedBalanceIndex(0); }}
                            className="px-4 py-2 border border-border-default hover:bg-bg-inset text-sm rounded-md transition"
                          >
                            Back
                          </button>
                          <button
                            onClick={applyBalancerResults}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-md transition flex items-center gap-2"
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

          {/* Coord Sheet Paste Modal */}
          {showCoordPasteModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-2 sm:p-4">
              <div className="bg-bg-card rounded-xl shadow-lg border border-border-default max-w-3xl w-full max-h-[85vh] overflow-y-auto">
                <div className="p-4 sm:p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold">Paste from Coord Sheet</h2>
                    <button
                      onClick={() => { setShowCoordPasteModal(false); setCoordParsedRows([]); setCoordPasteText(''); }}
                      className="p-1.5 rounded-md hover:bg-bg-inset transition"
                    >
                      <X className="w-5 h-5 text-text-muted" />
                    </button>
                  </div>

                  {coordParsedRows.length === 0 ? (
                    <div className="space-y-3">
                      <p className="text-sm text-text-secondary">
                        Paste rows from your Google Sheets coord sheet. Expected format: tab-separated columns with regiment name, min, (optional column), max.
                      </p>
                      <textarea
                        value={coordPasteText}
                        onChange={(e) => setCoordPasteText(e.target.value)}
                        placeholder={"CQB (T)\t14\t\t16\nJD (T)\t35\t\t40\n..."}
                        rows={10}
                        className="w-full px-3 py-2 bg-bg-input rounded-md border border-border-default focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono text-sm"
                      />
                      <button
                        onClick={parseCoordPaste}
                        disabled={!coordPasteText.trim()}
                        className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-bg-inset disabled:cursor-not-allowed text-white text-sm rounded-md transition font-semibold"
                      >
                        Parse
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-text-secondary mb-2">
                        Review matched regiments below. Adjust matches or choose to create / ignore unmatched ones.
                      </p>
                      <div className="max-h-[50vh] overflow-y-auto space-y-2">
                        {coordParsedRows.map((row, idx) => (
                          <div key={idx} className={`rounded-lg p-3 ${row.action === 'ignore' ? 'bg-bg-card opacity-50' : row.action === 'create' ? 'bg-emerald-900/30 border border-emerald-700' : 'bg-bg-inset'}`}>
                            <div className="grid grid-cols-12 gap-2 items-center">
                              {/* Parsed name */}
                              <div className="col-span-3">
                                <span className="text-sm font-medium">{row.rawName}</span>
                              </div>
                              {/* Min / Max */}
                              <div className="col-span-2 flex gap-1">
                                <input
                                  type="number"
                                  value={row.min}
                                  onChange={(e) => {
                                    const updated = [...coordParsedRows];
                                    updated[idx] = { ...updated[idx], min: parseInt(e.target.value) || 0 };
                                    setCoordParsedRows(updated);
                                  }}
                                  className="w-14 px-1 py-0.5 bg-bg-input text-xs rounded-md border border-border-default text-center"
                                />
                                <input
                                  type="number"
                                  value={row.max}
                                  onChange={(e) => {
                                    const updated = [...coordParsedRows];
                                    updated[idx] = { ...updated[idx], max: parseInt(e.target.value) || 0 };
                                    setCoordParsedRows(updated);
                                  }}
                                  className="w-14 px-1 py-0.5 bg-bg-input text-xs rounded-md border border-border-default text-center"
                                />
                              </div>
                              {/* Arrow */}
                              <div className="col-span-1 text-center text-text-secondary text-sm">→</div>
                              {/* Action / match selector */}
                              <div className="col-span-6">
                                <select
                                  value={row.action === 'match' ? `match:${row.matchedUnit}` : row.action}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const updated = [...coordParsedRows];
                                    if (val === 'ignore') {
                                      updated[idx] = { ...updated[idx], action: 'ignore', matchedUnit: null };
                                    } else if (val === 'create') {
                                      updated[idx] = { ...updated[idx], action: 'create', matchedUnit: null };
                                    } else if (val.startsWith('match:')) {
                                      updated[idx] = { ...updated[idx], action: 'match', matchedUnit: val.slice(6) };
                                    }
                                    setCoordParsedRows(updated);
                                  }}
                                  className="w-full px-2 py-1 bg-bg-input rounded-md border border-border-default outline-none text-sm"
                                >
                                  <optgroup label="Registered Units">
                                    {units.map(u => (
                                      <option key={u} value={`match:${u}`}>{u}{u === row.matchedUnit && row.action === 'match' ? ' ✓' : ''}</option>
                                    ))}
                                  </optgroup>
                                  <optgroup label="Actions">
                                    <option value="create">＋ Create New Unit</option>
                                    <option value="ignore">✕ Ignore</option>
                                  </optgroup>
                                </select>
                              </div>
                            </div>
                            {/* Create new unit options */}
                            {row.action === 'create' && (
                              <div className="mt-2 ml-4 flex items-center gap-3">
                                <label className="text-xs text-text-secondary">Name:</label>
                                <input
                                  type="text"
                                  value={row.newUnitName}
                                  onChange={(e) => {
                                    const updated = [...coordParsedRows];
                                    updated[idx] = { ...updated[idx], newUnitName: e.target.value };
                                    setCoordParsedRows(updated);
                                  }}
                                  className="flex-1 px-2 py-1 bg-bg-input rounded-md border border-border-default outline-none text-sm"
                                />
                                <label className="flex items-center gap-1 text-xs text-text-secondary cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={row.newUnitIsToken}
                                    onChange={(e) => {
                                      const updated = [...coordParsedRows];
                                      updated[idx] = { ...updated[idx], newUnitIsToken: e.target.checked };
                                      setCoordParsedRows(updated);
                                    }}
                                    className="rounded"
                                  />
                                  Token unit
                                </label>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2 mt-4">
                        <button
                          onClick={() => { setCoordParsedRows([]); }}
                          className="flex-1 px-4 py-2 border border-border-default hover:bg-bg-inset text-sm rounded-md transition"
                        >
                          Back
                        </button>
                        <button
                          onClick={applyCoordPaste}
                          className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-md transition font-semibold"
                        >
                          <span className="flex items-center justify-center gap-2">
                            <CheckCircle2 className="w-4 h-4" />
                            Confirm & Apply
                          </span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Casualty Input Modal */}
          {showCasualtyModal && selectedWeek && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
              <div className="bg-bg-card rounded-xl shadow-lg border border-border-default max-w-6xl w-full max-h-[85vh] overflow-y-auto">
                <div className="p-4 sm:p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <Flame className="w-6 h-6" />
                      Input Casualties - {selectedWeek.name}
                    </h2>
                    <button
                      onClick={() => setShowCasualtyModal(false)}
                      className="p-1.5 rounded-md hover:bg-bg-inset transition"
                    >
                      <X className="w-5 h-5 text-text-muted" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Team A and B Casualties */}
                    {[teamNames.A, teamNames.B].map((teamName, teamIdx) => {
                      const teamId = teamIdx === 0 ? 'A' : 'B';
                      const rosterUnits = selectedWeek[`team${teamId}`] || [];

                      return (
                        <div key={teamName} className="bg-bg-inset rounded-lg p-4">
                          <h3 className="text-lg font-semibold mb-4">{teamName} Units</h3>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Round 1 */}
                            <div className="bg-bg-inset rounded-lg p-3">
                              <div className="flex justify-between items-center mb-3">
                                <h4 className="font-semibold">Round 1 Casualties</h4>
                                <label className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs cursor-pointer transition">
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
                                    <label className="text-sm truncate flex-1" title={unit}>
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
                                      className="w-16 px-2 py-1 bg-bg-input rounded-md border border-border-default outline-none text-sm ml-2"
                                    />
                                  </div>
                                ))}
                                {rosterUnits.length === 0 && (
                                  <p className="text-text-secondary text-xs text-center py-2">No units assigned</p>
                                )}
                              </div>
                            </div>

                            {/* Round 2 */}
                            <div className="bg-bg-inset rounded-lg p-3">
                              <div className="flex justify-between items-center mb-3">
                                <h4 className="font-semibold">Round 2 Casualties</h4>
                                <label className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs cursor-pointer transition">
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
                                    <label className="text-sm truncate flex-1" title={unit}>
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
                                      className="w-16 px-2 py-1 bg-bg-input rounded-md border border-border-default outline-none text-sm ml-2"
                                    />
                                  </div>
                                ))}
                                {rosterUnits.length === 0 && (
                                  <p className="text-text-secondary text-xs text-center py-2">No units assigned</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Bottom Buttons */}
                  <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-border-default">
                    <button
                      onClick={() => setShowCasualtyModal(false)}
                      className="px-4 py-2 border border-border-default hover:bg-bg-inset text-sm rounded-md transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveCasualtyData}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-md transition flex items-center gap-2"
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
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4"
              onClick={() => setShowStatsModal(false)}
            >
              <div
                className="bg-bg-card rounded-xl shadow-lg border border-border-default max-w-4xl w-full max-h-[85vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-4 sm:p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <BarChart3 className="w-6 h-6" />
                      Statistics — {activeEvent.name}
                    </h2>
                    <button
                      onClick={() => setShowStatsModal(false)}
                      className="p-1.5 rounded-md hover:bg-bg-inset transition"
                    >
                      <X className="w-5 h-5 text-text-muted" />
                    </button>
                  </div>

                  {/* Tab toggle: per-season vs event-wide */}
                  <div className="flex gap-1 mb-5 border-b border-border-default">
                    <button
                      onClick={() => setStatsTab('season')}
                      className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
                        statsTab === 'season'
                          ? 'border-indigo-500 text-indigo-400'
                          : 'border-transparent text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      Season — {activeSeason.name}
                    </button>
                    <button
                      onClick={() => setStatsTab('event')}
                      className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
                        statsTab === 'event'
                          ? 'border-indigo-500 text-indigo-400'
                          : 'border-transparent text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      Event ({activeEvent.seasons.length} season{activeEvent.seasons.length === 1 ? '' : 's'})
                    </button>
                  </div>

                  {statsTab === 'event' && (() => {
                    // Event-wide aggregates: walk every season's rounds.
                    const seasons = activeEvent.seasons;
                    const totalWeeks = seasons.reduce((n, s) => n + (s.weeks?.length || 0), 0);

                    // Cross-season unit record (rounds-as-lead/assist won/lost) +
                    // event-wide casualties (per side + per unit).
                    const unitRecord = {};
                    let usaCasTotal = 0, csaCasTotal = 0;
                    let totalRoundsWithResult = 0;
                    const ensure = (u) => unitRecord[u] ||= {
                      rounds: 0, leadWins: 0, leadLosses: 0,
                      assistWins: 0, assistLosses: 0,
                      sweeps: 0, casualtiesTaken: 0,
                    };

                    for (const season of seasons) {
                      for (const week of season.weeks || []) {
                        const isPlayoffs = !!week.isPlayoffs;
                        const isSingleRoundLeads = !!week.isSingleRoundLeads;
                        const teamA = week.teamA || [];
                        const teamB = week.teamB || [];

                        // Sweep tally
                        if (week.round1Winner && week.round1Winner === week.round2Winner) {
                          const sweepTeam = week.round1Winner === 'A' ? teamA : teamB;
                          sweepTeam.forEach(u => ensure(u).sweeps += 1);
                        }

                        for (const roundNum of [1, 2]) {
                          const winner = week[`round${roundNum}Winner`];
                          if (!winner) continue;
                          totalRoundsWithResult += 1;

                          // Effective rosters (per-round swaps)
                          const swaps = new Set(week.roundSwaps?.[`r${roundNum}`] || []);
                          const eA = swaps.size === 0 ? teamA :
                            teamA.filter(u => !swaps.has(u)).concat(teamB.filter(u => swaps.has(u)));
                          const eB = swaps.size === 0 ? teamB :
                            teamB.filter(u => !swaps.has(u)).concat(teamA.filter(u => swaps.has(u)));

                          const winningTeam = winner === 'A' ? eA : eB;
                          const losingTeam = winner === 'A' ? eB : eA;
                          const leadKey = (isPlayoffs || isSingleRoundLeads) ? `_r${roundNum}` : '';
                          const leadW = week[`lead${winner}${leadKey}`];
                          const leadL = week[`lead${winner === 'A' ? 'B' : 'A'}${leadKey}`];

                          winningTeam.forEach(u => {
                            const r = ensure(u); r.rounds += 1;
                            if (u === leadW) r.leadWins += 1; else r.assistWins += 1;
                          });
                          losingTeam.forEach(u => {
                            const r = ensure(u); r.rounds += 1;
                            if (u === leadL) r.leadLosses += 1; else r.assistLosses += 1;
                          });

                          // Side-aware casualty bucket
                          const flipped = !!week[`round${roundNum}Flipped`];
                          const usaSide = flipped ? 'B' : 'A';
                          const casA = week[`r${roundNum}CasualtiesA`] || 0;
                          const casB = week[`r${roundNum}CasualtiesB`] || 0;
                          if (usaSide === 'A') { usaCasTotal += casA; csaCasTotal += casB; }
                          else                 { usaCasTotal += casB; csaCasTotal += casA; }

                          // Per-unit casualties (lost) from weeklyCasualties
                          const wc = week.weeklyCasualties || {};
                          for (const sideKey of Object.keys(wc)) {
                            const byUnit = wc[sideKey]?.[`r${roundNum}`] || {};
                            for (const [u, n] of Object.entries(byUnit)) {
                              ensure(u).casualtiesTaken += Number(n) || 0;
                            }
                          }
                        }
                      }
                    }

                    const eventElo = calculateEloRatings();
                    const ladder = Object.entries(unitRecord)
                      .map(([unit, r]) => ({
                        unit, ...r,
                        wins: r.leadWins + r.assistWins,
                        losses: r.leadLosses + r.assistLosses,
                        winPct: r.rounds > 0 ? ((r.leadWins + r.assistWins) / r.rounds) * 100 : 0,
                        elo: eventElo.eloRatings[unit] ?? eloSystem.initialElo,
                      }))
                      .filter(r => r.rounds > 0)
                      .sort((a, b) => b.elo - a.elo);

                    const totalCasUnits = ladder.reduce((s, r) => s + r.casualtiesTaken, 0);

                    return (
                      <div className="space-y-4">
                        {/* Event Overview */}
                        <div className="bg-bg-inset rounded-lg p-4">
                          <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                            <Trophy className="w-5 h-5" />
                            Overview
                          </h3>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="bg-bg-card rounded p-3">
                              <div className="text-xs text-text-secondary mb-1">Seasons</div>
                              <div className="text-2xl font-bold text-indigo-400">{seasons.length}</div>
                            </div>
                            <div className="bg-bg-card rounded p-3">
                              <div className="text-xs text-text-secondary mb-1">Weeks</div>
                              <div className="text-2xl font-bold text-indigo-400">{totalWeeks}</div>
                            </div>
                            <div className="bg-bg-card rounded p-3">
                              <div className="text-xs text-text-secondary mb-1">Rounds Played</div>
                              <div className="text-2xl font-bold text-indigo-400">{totalRoundsWithResult}</div>
                            </div>
                            <div className="bg-bg-card rounded p-3">
                              <div className="text-xs text-text-secondary mb-1">Registry Units</div>
                              <div className="text-2xl font-bold text-indigo-400">{Object.keys(activeEvent.unitRegistry).length}</div>
                            </div>
                          </div>
                        </div>

                        {/* Per-season cards — surfaces playoff status and the
                           champion when playoffs occurred (based on the latest
                           playoff week's result). */}
                        <div className="bg-bg-inset rounded-lg p-4">
                          <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                            <Calendar className="w-5 h-5" />
                            Per-Season Summary
                          </h3>
                          <div className="space-y-2">
                            {seasons.map(season => {
                              const seasonWeeks = season.weeks || [];
                              const weekCount = seasonWeeks.length;
                              let roundCount = 0;
                              let playoffsScheduled = false;
                              for (const w of seasonWeeks) {
                                if (w.round1Winner) roundCount += 1;
                                if (w.round2Winner) roundCount += 1;
                                if (w.isPlayoffs) playoffsScheduled = true;
                              }
                              const rosterSize = (season.units || []).length;
                              const isActive = season.id === activeSeason.id;
                              const champion = seasonChampion(season);
                              return (
                                <button
                                  key={season.id}
                                  onClick={() => setAppState(prev => setActiveSeason(prev, season.id))}
                                  className={`w-full text-left bg-bg-card rounded p-3 border transition ${
                                    isActive ? 'border-indigo-500' : 'border-transparent hover:border-border-default'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="font-semibold flex items-center gap-2 flex-wrap">
                                        {season.name}
                                        {isActive && <span className="text-xs text-indigo-400">(active)</span>}
                                        {playoffsScheduled && (
                                          <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                                            Playoffs
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-xs text-text-secondary mt-0.5">
                                        {weekCount} week{weekCount === 1 ? '' : 's'} · {roundCount} round{roundCount === 1 ? '' : 's'} · {rosterSize} roster unit{rosterSize === 1 ? '' : 's'}
                                      </div>
                                      {champion && (
                                        <div className="text-xs mt-1 flex items-center gap-1.5 flex-wrap">
                                          <Trophy className="w-3 h-3 text-amber-400 shrink-0" />
                                          <span className="text-text-secondary">Champion:</span>
                                          <span className={`font-semibold ${champion.side === 'USA' ? 'text-blue-400' : 'text-red-400'}`}>
                                            {champion.side}
                                          </span>
                                          {champion.lead && (
                                            <span className="text-text-secondary">
                                              · led by <span className="text-text-primary">{champion.lead}</span>
                                            </span>
                                          )}
                                          <span className="text-text-muted">
                                            ({champion.weekName} R{champion.finalRound})
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-text-secondary shrink-0" />
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Cross-season unit ladder */}
                        <div className="bg-bg-inset rounded-lg p-4">
                          <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                            <Award className="w-5 h-5" />
                            Cross-Season Unit Record
                          </h3>
                          {ladder.length === 0 ? (
                            <p className="text-text-secondary text-center py-4 text-sm">No completed rounds yet</p>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-text-secondary border-b border-border-default">
                                    <th className="text-left py-2 px-2">Unit</th>
                                    <th className="text-center py-2 px-2">Elo</th>
                                    <th className="text-center py-2 px-2" title="Total rounds played across all seasons in this event">Rounds</th>
                                    <th className="text-center py-2 px-2">W</th>
                                    <th className="text-center py-2 px-2">L</th>
                                    <th className="text-center py-2 px-2" title="Win percentage across all rounds">Win %</th>
                                    <th className="text-center py-2 px-2" title="Wins as lead / total leads taken">Lead W</th>
                                    <th className="text-center py-2 px-2">Sweeps</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {ladder.map((r, idx) => (
                                    <tr key={r.unit} className={idx % 2 === 0 ? 'bg-bg-card' : 'bg-bg-inset'}>
                                      <td className="py-2 px-2 font-medium">{r.unit}</td>
                                      <td className="text-indigo-400 text-center py-2 px-2 font-semibold">{Math.round(r.elo)}</td>
                                      <td className="text-text-secondary text-center py-2 px-2">{r.rounds}</td>
                                      <td className="text-green-400 text-center py-2 px-2">{r.wins}</td>
                                      <td className="text-red-400 text-center py-2 px-2">{r.losses}</td>
                                      <td className="text-center py-2 px-2">{r.winPct.toFixed(1)}%</td>
                                      <td className="text-text-secondary text-center py-2 px-2">{r.leadWins}</td>
                                      <td className="text-text-secondary text-center py-2 px-2">{r.sweeps}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>

                        {/* Cross-season casualties */}
                        <div className="bg-bg-inset rounded-lg p-4">
                          <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                            <Flame className="w-5 h-5" />
                            Cross-Season Casualties
                          </h3>
                          <div className="grid grid-cols-3 gap-3 mb-3">
                            <div className="bg-bg-card rounded p-3">
                              <div className="text-xs text-text-secondary mb-1">USA Total</div>
                              <div className="text-xl font-bold text-blue-400">{usaCasTotal}</div>
                            </div>
                            <div className="bg-bg-card rounded p-3">
                              <div className="text-xs text-text-secondary mb-1">CSA Total</div>
                              <div className="text-xl font-bold text-red-400">{csaCasTotal}</div>
                            </div>
                            <div className="bg-bg-card rounded p-3">
                              <div className="text-xs text-text-secondary mb-1">Combined</div>
                              <div className="text-xl font-bold text-indigo-400">{usaCasTotal + csaCasTotal}</div>
                            </div>
                          </div>
                          {totalCasUnits > 0 && (
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-text-secondary border-b border-border-default">
                                    <th className="text-left py-2 px-2">Unit</th>
                                    <th className="text-center py-2 px-2">Lost</th>
                                    <th className="text-center py-2 px-2" title="Average lost per round played">Lost / Round</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {ladder
                                    .filter(r => r.casualtiesTaken > 0)
                                    .sort((a, b) => b.casualtiesTaken - a.casualtiesTaken)
                                    .map((r, idx) => (
                                      <tr key={r.unit} className={idx % 2 === 0 ? 'bg-bg-card' : 'bg-bg-inset'}>
                                        <td className="py-2 px-2 font-medium">{r.unit}</td>
                                        <td className="text-red-400 text-center py-2 px-2">{r.casualtiesTaken}</td>
                                        <td className="text-text-secondary text-center py-2 px-2">
                                          {r.rounds > 0 ? (r.casualtiesTaken / r.rounds).toFixed(1) : '–'}
                                        </td>
                                      </tr>
                                    ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>

                        {/* Aggregate map stats — same UI as the Season tab,
                           sourced from event-wide history. */}
                        <div className="bg-bg-inset rounded-lg p-4">
                          <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                            <Map className="w-5 h-5" />
                            Map Statistics (event-wide)
                          </h3>
                          {renderMapStatsBlock(calculateMapStats(), 'eventMapStats')}
                        </div>

                        {/* Cross-season teammate heatmap — opens the existing
                           heatmap modal in event scope (DRY: same modal, same
                           render path). */}
                        <div className="bg-bg-inset rounded-lg p-4">
                          <h3 className="text-base font-semibold mb-2 flex items-center gap-2">
                            <Swords className="w-5 h-5" />
                            Cross-Season Teammate Composition
                          </h3>
                          <p className="text-xs text-text-secondary mb-3">
                            How often each pair of units has played as teammates across every season in this event.
                          </p>
                          <button
                            onClick={() => { setHeatmapScope('event'); setShowHeatmapModal(true); }}
                            className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-md transition"
                          >
                            <Swords className="w-4 h-4" />
                            Open Cross-Season Heatmap
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {statsTab === 'season' && <>

                  {/* Map Statistics — active season only */}
                  <div className="bg-bg-inset rounded-lg p-4 mb-4">
                    <h3 className="text-base font-semibold mb-2 flex items-center gap-2">
                      <Map className="w-5 h-5" />
                      Map Statistics
                    </h3>
                    {renderMapStatsBlock(calculateSeasonMapStats(), 'seasonMapStats')}
                  </div>

                  {/* Casualties Summary */}
                  <div className="bg-bg-inset rounded-lg p-4 mb-4">
                    <h3 className="text-base font-semibold mb-2 flex items-center gap-2">
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
                          <div className="bg-bg-inset rounded p-3">
                            <div className="text-sm text-text-secondary mb-1">USA Casualties</div>
                            <div className="text-2xl font-bold text-blue-400">
                              {usaCasualties}
                            </div>
                          </div>
                          <div className="bg-bg-inset rounded p-3">
                            <div className="text-sm text-text-secondary mb-1">CSA Casualties</div>
                            <div className="text-2xl font-bold text-red-400">
                              {csaCasualties}
                            </div>
                          </div>
                          <div className="bg-bg-inset rounded p-3">
                            <div className="text-sm text-text-secondary mb-1">Combined Casualties</div>
                            <div className="text-2xl font-bold text-indigo-400">
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
                        <div className="bg-bg-inset rounded p-3 mt-4">
                          <h4 className="font-semibold mb-3">Per-Unit Casualty Report</h4>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-text-secondary border-b border-border-default">
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
                                  <tr key={row.unit} className={`${idx % 2 === 0 ? 'bg-bg-card' : 'bg-bg-inset'}`}>
                                    <td className="py-2 px-2">{row.unit}</td>
                                    <td className="text-green-400 text-center py-2 px-2">{row.inflicted}</td>
                                    <td className="text-red-400 text-center py-2 px-2">{row.lost}</td>
                                    <td className="text-indigo-400 text-center py-2 px-2">
                                      {row.kd === Infinity ? '∞' : row.kd.toFixed(2)}
                                    </td>
                                    <td className="text-text-secondary text-center py-2 px-2">{row.inflictedPerGame.toFixed(2)}</td>
                                    <td className="text-text-secondary text-center py-2 px-2">{row.lostPerGame.toFixed(2)}</td>
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
                  <div className="bg-bg-inset rounded-lg p-4 mb-4">
                    <h3 className="text-base font-semibold mb-2 flex items-center gap-2">
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
                        return <p className="text-text-secondary text-center py-4">No TII data available yet</p>;
                      }
                      
                      return (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-text-secondary border-b border-border-default">
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
                                  <tr key={row.unit} className={`${idx % 2 === 0 ? 'bg-bg-inset' : 'bg-bg-card'}`}>
                                    <td className="py-2 px-2">
                                      {row.unit} ({row.avgPlayers.toFixed(1)})
                                    </td>
                                    <td className="text-indigo-400 text-center py-2 px-2 font-semibold">
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
                          <div className="mt-3 text-xs text-text-secondary bg-bg-inset rounded p-3">
                            <p className="font-semibold text-text-secondary mb-2">📊 Metric Explanations:</p>
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
                  <div className="bg-bg-inset rounded-lg p-4">
                    <h3 className="text-base font-semibold mb-2 flex items-center gap-2">
                      <Trophy className="w-5 h-5" />
                      Playoffs
                    </h3>
                    
                    {/* Playoff Configuration */}
                    <div className="bg-bg-inset rounded-lg p-4 mb-4">
                      <h4 className="font-semibold mb-3">Playoff Format Settings</h4>
                      
                      <div className="space-y-3">
                        {/* Enable Playoffs */}
                        <label className="flex items-center gap-2 text-text-secondary cursor-pointer">
                          <input
                            type="checkbox"
                            checked={playoffConfig.enabled}
                            onChange={(e) => setPlayoffConfig({ ...playoffConfig, enabled: e.target.checked })}
                            className="w-4 h-4 rounded border-border-default bg-bg-card focus:ring-2 focus:ring-indigo-500"
                          />
                          <Star className="w-4 h-4" />
                          <span className="font-semibold">Enable Playoff Tracking</span>
                        </label>
                        
                        {playoffConfig.enabled && (
                          <>
                            {/* Use Divisions */}
                            {divisions && divisions.length > 0 && (
                              <label className="flex items-center gap-2 text-text-secondary cursor-pointer ml-6">
                                <input
                                  type="checkbox"
                                  checked={playoffConfig.useDivisions}
                                  onChange={(e) => setPlayoffConfig({ ...playoffConfig, useDivisions: e.target.checked })}
                                  className="w-4 h-4 rounded border-border-default bg-bg-card focus:ring-2 focus:ring-indigo-500"
                                />
                                <Shield className="w-4 h-4" />
                                <span className="text-sm">Use Division-based Playoffs</span>
                              </label>
                            )}
                            
                            {/* Teams per Division */}
                            {playoffConfig.useDivisions && (
                              <div className="ml-6">
                                <label className="block text-sm text-text-secondary mb-1">Top Teams per Division</label>
                                <input
                                  type="number"
                                  min="1"
                                  max="4"
                                  value={playoffConfig.teamsPerDivision}
                                  onChange={(e) => setPlayoffConfig({ ...playoffConfig, teamsPerDivision: parseInt(e.target.value) || 1 })}
                                  className="w-24 px-3 py-1 bg-bg-input rounded-md border border-border-default outline-none text-sm"
                                />
                              </div>
                            )}
                            
                            {/* Wildcard Teams */}
                            <div className="ml-6">
                              <label className="block text-sm text-text-secondary mb-1">
                                {playoffConfig.useDivisions ? 'Wildcard Teams' : 'Total Playoff Teams'}
                              </label>
                              <input
                                type="number"
                                min="0"
                                max="8"
                                value={playoffConfig.wildcardTeams}
                                onChange={(e) => setPlayoffConfig({ ...playoffConfig, wildcardTeams: parseInt(e.target.value) || 0 })}
                                className="w-24 px-3 py-1 bg-bg-input rounded-md border border-border-default outline-none text-sm"
                              />
                            </div>
                            
                            {/* Round Formats */}
                            <div className="ml-6 bg-bg-card rounded p-3">
                              <h5 className="text-sm font-semibold text-text-secondary mb-2">Rounds per Playoff Stage</h5>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs text-text-secondary mb-1">Wildcard</label>
                                  <input
                                    type="number"
                                    min="1"
                                    max="3"
                                    value={playoffConfig.roundFormats.wildcard}
                                    onChange={(e) => setPlayoffConfig({
                                      ...playoffConfig,
                                      roundFormats: { ...playoffConfig.roundFormats, wildcard: parseInt(e.target.value) || 1 }
                                    })}
                                    className="w-16 px-2 py-1 bg-bg-input rounded-md border border-border-default outline-none text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-text-secondary mb-1">Divisional</label>
                                  <input
                                    type="number"
                                    min="1"
                                    max="3"
                                    value={playoffConfig.roundFormats.divisional}
                                    onChange={(e) => setPlayoffConfig({
                                      ...playoffConfig,
                                      roundFormats: { ...playoffConfig.roundFormats, divisional: parseInt(e.target.value) || 1 }
                                    })}
                                    className="w-16 px-2 py-1 bg-bg-input rounded-md border border-border-default outline-none text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-text-secondary mb-1">Conference</label>
                                  <input
                                    type="number"
                                    min="1"
                                    max="3"
                                    value={playoffConfig.roundFormats.conference}
                                    onChange={(e) => setPlayoffConfig({
                                      ...playoffConfig,
                                      roundFormats: { ...playoffConfig.roundFormats, conference: parseInt(e.target.value) || 2 }
                                    })}
                                    className="w-16 px-2 py-1 bg-bg-input rounded-md border border-border-default outline-none text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-text-secondary mb-1">Finals</label>
                                  <input
                                    type="number"
                                    min="1"
                                    max="3"
                                    value={playoffConfig.roundFormats.finals}
                                    onChange={(e) => setPlayoffConfig({
                                      ...playoffConfig,
                                      roundFormats: { ...playoffConfig.roundFormats, finals: parseInt(e.target.value) || 2 }
                                    })}
                                    className="w-16 px-2 py-1 bg-bg-input rounded-md border border-border-default outline-none text-sm"
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
                          <div className="bg-bg-inset rounded-lg p-4 text-center">
                            <p className="text-text-secondary text-sm">
                              Not enough teams for playoffs. Configure playoff settings above.
                            </p>
                          </div>
                        );
                      }
                      
                      return (
                        <div className="bg-bg-inset rounded-lg p-4">
                          <h4 className="font-semibold mb-3 flex items-center gap-2">
                            <Target className="w-4 h-4" />
                            Playoff Picture
                            {selectedWeek && (
                              <span className="text-xs text-text-secondary font-normal">
                                (as of {selectedWeek.name})
                              </span>
                            )}
                          </h4>

                          {/* Seeding */}
                          <div className="mb-4 bg-bg-card rounded p-3">
                            <h5 className="text-sm font-semibold text-text-secondary mb-2">Playoff Seeds</h5>
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
                                      <div key={confName} className="bg-bg-inset rounded p-2">
                                        <h6 className="text-xs font-bold text-cyan-300 mb-2">{confName} Conference</h6>
                                        <div className="grid grid-cols-2 gap-2">
                                          {confTeams.map((team) => (
                                            <div key={team.unit} className="flex items-center gap-2 text-sm">
                                              <span className="text-indigo-400 font-bold">#{team.conferenceSeed}</span>
                                              <span>{team.unit}</span>
                                              <span className="text-text-secondary text-xs">
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
                                    <span className="text-indigo-400 font-bold">#{team.seed}</span>
                                    <span>{team.unit}</span>
                                    <span className="text-text-secondary text-xs">({team.points} pts)</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          
                          {/* Bracket Rounds */}
                          <div className="space-y-3">
                            {bracket.rounds.map((round, roundIdx) => (
                              <div key={roundIdx} className="bg-bg-card rounded p-3">
                                <h5 className="text-sm font-semibold text-text-secondary mb-2 flex items-center gap-2">
                                  <Swords className="w-4 h-4" />
                                  {round.name}
                                  <span className="text-xs text-text-secondary font-normal">
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
                                      <div key={matchIdx} className="bg-bg-inset rounded p-2">
                                        {confLabel && (
                                          <div className="text-xs text-cyan-400 font-semibold mb-1">{confLabel}</div>
                                        )}
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-2 flex-1">
                                            {matchup.team1 ? (
                                              <>
                                                <span className="text-indigo-400 font-bold text-xs">#{matchup.seed1}</span>
                                                <span className="text-sm">{matchup.team1.unit}</span>
                                                {matchup.team1.isWildcard && (
                                                  <span className="text-purple-400 text-xs font-bold">WC</span>
                                                )}
                                              </>
                                            ) : matchup.label ? (
                                              <span className="text-text-secondary text-sm italic">{matchup.label}</span>
                                            ) : (
                                              <span className="text-text-secondary text-sm italic">Seed #{matchup.seed1}</span>
                                            )}
                                          </div>
                                          <span className="text-text-secondary text-xs font-bold mx-2">VS</span>
                                          <div className="flex items-center gap-2 flex-1 justify-end">
                                            {matchup.team2 ? (
                                              <>
                                                {matchup.team2.isWildcard && (
                                                  <span className="text-purple-400 text-xs font-bold">WC</span>
                                                )}
                                                <span className="text-sm">{matchup.team2.unit}</span>
                                                <span className="text-indigo-400 font-bold text-xs">#{matchup.seed2}</span>
                                              </>
                                            ) : matchup.label && !matchup.team1 ? (
                                              <span className="text-text-secondary text-sm italic">{matchup.label}</span>
                                            ) : (
                                              <span className="text-text-secondary text-sm italic">
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
                  <div className="bg-bg-inset rounded-lg p-4">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-base font-semibold flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        Unit Interactions
                      </h3>
                      <button
                        onClick={() => setShowHeatmapModal(true)}
                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm transition flex items-center gap-1"
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
                                rounds: details?.teammateRounds || []
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
                                rounds: details?.opponentRounds || []
                              });
                            }
                          });
                        });
                        opponentPairs.sort((a, b) => b.count - a.count);
                        
                        return (
                          <>
                            <div className="bg-bg-inset rounded p-3">
                              <h4 className="font-semibold mb-2">Most Frequent Teammates</h4>
                              <div className="space-y-1">
                                {teammatePairs.slice(0, 5).map((pair, idx) => (
                                  <div key={idx} className="text-xs text-text-secondary flex justify-between">
                                    <span>{pair.unit1} & {pair.unit2}</span>
                                    <span className="text-indigo-400">{pair.count} rounds</span>
                                  </div>
                                ))}
                                {teammatePairs.length === 0 && (
                                  <p className="text-xs text-text-secondary">No teammate data yet</p>
                                )}
                              </div>
                            </div>

                            <div className="bg-bg-inset rounded p-3">
                              <h4 className="font-semibold mb-2">Most Frequent Opponents</h4>
                              <div className="space-y-1">
                                {opponentPairs.slice(0, 5).map((pair, idx) => (
                                  <div key={idx} className="text-xs text-text-secondary flex justify-between">
                                    <span>{pair.unit1} vs {pair.unit2}</span>
                                    <span className="text-red-400">{pair.count} rounds</span>
                                  </div>
                                ))}
                                {opponentPairs.length === 0 && (
                                  <p className="text-xs text-text-secondary">No opponent data yet</p>
                                )}
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                  </>}
                </div>
              </div>
            </div>
          )}

          {/* Division Management Modal */}
          {showDivisionModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
              <div className="bg-bg-card rounded-xl shadow-lg border border-border-default max-w-4xl w-full max-h-[85vh] overflow-y-auto">
                <div className="p-4 sm:p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <Users className="w-6 h-6" />
                      Division Management
                    </h2>
                    <button
                      onClick={() => setShowDivisionModal(false)}
                      className="p-1.5 rounded-md hover:bg-bg-inset transition"
                    >
                      <X className="w-5 h-5 text-text-muted" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left: Unassigned Units */}
                    <div className="bg-bg-inset rounded-lg p-4">
                      <h3 className="text-lg font-semibold mb-3">Unassigned Units</h3>
                      <div className="bg-bg-inset rounded p-3 max-h-96 overflow-y-auto">
                        {getUnassignedUnits().length > 0 ? (
                          <div className="space-y-1">
                            {getUnassignedUnits().map(unit => (
                              <div key={unit} className="text-sm py-1">
                                {unit}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-text-secondary text-sm">All units assigned to divisions</p>
                        )}
                      </div>
                    </div>

                    {/* Right: Divisions */}
                    <div className="bg-bg-inset rounded-lg p-4">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-lg font-semibold">Divisions</h3>
                        <button
                          onClick={addDivision}
                          className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm transition"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {divisions.map((division) => (
                          <div key={division.name} className="bg-bg-inset rounded-lg p-3">
                            <div className="flex justify-between items-center mb-2">
                              <input
                                type="text"
                                value={division.name}
                                onChange={(e) => renameDivision(division.name, e.target.value)}
                                className="flex-1 px-2 py-1 bg-bg-input rounded-md border border-border-default outline-none text-sm font-semibold"
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
                                  <span>{unit}</span>
                                  <button
                                    onClick={() => removeUnitFromDivision(division.name, unit)}
                                    className="p-1 hover:bg-red-600 rounded transition"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                              {division.units.length === 0 && (
                                <p className="text-text-secondary text-xs">No units in this division</p>
                              )}
                            </div>
                            <select
                              onChange={(e) => {
                                if (e.target.value) {
                                  addUnitToDivision(division.name, e.target.value);
                                  e.target.value = '';
                                }
                              }}
                              className="w-full mt-2 px-2 py-1 bg-bg-input rounded-md border border-border-default outline-none text-xs"
                            >
                              <option value="">Add unit...</option>
                              {getUnassignedUnits().map(unit => (
                                <option key={unit} value={unit}>{unit}</option>
                              ))}
                            </select>
                          </div>
                        ))}
                        {divisions.length === 0 && (
                          <p className="text-text-secondary text-sm text-center py-4">No divisions created yet</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Bottom Buttons */}
                  <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-border-default">
                    <button
                      onClick={() => setShowDivisionModal(false)}
                      className="px-4 py-2 border border-border-default hover:bg-bg-inset text-sm rounded-md transition"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Map History Viewer Modal — derived from outcome history (no manual bias) */}
          {showMapBiasModal && (() => {
            const { byMap } = calculateMapStats();
            return (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
                <div className="bg-bg-card rounded-xl shadow-lg border border-border-default max-w-4xl w-full max-h-[85vh] overflow-y-auto">
                  <div className="p-4 sm:p-6">
                    <div className="flex justify-between items-center mb-6">
                      <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Map className="w-6 h-6" />
                        Map History
                      </h2>
                      <button
                        onClick={() => setShowMapBiasModal(false)}
                        className="p-1.5 rounded-md hover:bg-bg-inset transition"
                      >
                        <X className="w-5 h-5 text-text-muted" />
                      </button>
                    </div>

                    <div className="mb-4 bg-bg-inset rounded-lg p-4">
                      <p className="text-sm text-text-secondary">
                        Per-map outcome history. These numbers feed Elo expected-win-probability when{' '}
                        <strong>Map Weight</strong> in Settings is non-zero, with Bayesian shrinkage controlled by{' '}
                        <strong>Confidence Samples</strong>.
                      </p>
                    </div>

                    {Object.entries(MAPS).map(([category, mapList]) => (
                      <div key={category} className="mb-4">
                        <button
                          onClick={() => toggleSection(category)}
                          className="w-full flex items-center justify-between bg-bg-inset rounded-lg p-3 hover:bg-bg-inset transition"
                        >
                          <h3 className="text-lg font-semibold">
                            {category.replace(/_/g, ' ').toUpperCase()}
                          </h3>
                          {expandedSections[category] ? (
                            <ChevronDown className="w-5 h-5 text-text-secondary" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-text-secondary" />
                          )}
                        </button>

                        {expandedSections[category] && (
                          <div className="mt-2 bg-bg-inset rounded-lg p-4">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-left text-text-secondary border-b border-border-default">
                                  <th className="py-2 pr-2">Map</th>
                                  <th className="py-2 pr-2 text-right">Plays</th>
                                  <th className="py-2 pr-2 text-right">USA W</th>
                                  <th className="py-2 pr-2 text-right">CSA W</th>
                                  <th className="py-2 pr-2 text-right">USA Win %</th>
                                  <th className="py-2 pr-2 text-right">Atk Win %</th>
                                </tr>
                              </thead>
                              <tbody>
                                {mapList.map(mapName => {
                                  const data = byMap[mapName];
                                  if (!data) {
                                    return (
                                      <tr key={mapName} className="border-b border-border-default/40">
                                        <td className="py-2 pr-2">{mapName}</td>
                                        <td colSpan={5} className="py-2 pr-2 text-text-muted text-right">No plays</td>
                                      </tr>
                                    );
                                  }
                                  const usaPct = data.plays > 0 ? Math.round((data.usaWins / data.plays) * 100) : 0;
                                  const atkPct = data.plays > 0 ? Math.round((data.attackerWins / data.plays) * 100) : 0;
                                  return (
                                    <tr key={mapName} className="border-b border-border-default/40">
                                      <td className="py-2 pr-2">{mapName}</td>
                                      <td className="py-2 pr-2 text-right">{data.plays}</td>
                                      <td className="py-2 pr-2 text-right">{data.usaWins}</td>
                                      <td className="py-2 pr-2 text-right">{data.csaWins}</td>
                                      <td className="py-2 pr-2 text-right">{usaPct}%</td>
                                      <td className="py-2 pr-2 text-right">{atkPct}%</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    ))}

                    <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-border-default">
                      <button
                        onClick={() => setShowMapBiasModal(false)}
                        className="px-4 py-2 border border-border-default hover:bg-bg-inset text-sm rounded-md transition"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Unit Registry Editor Modal — event-level identity for every unit
             ever associated with this event. Renames sweep all rosters; hard
             delete is gated on whether the unit has any roster appearance. */}
          {showRegistryModal && (() => {
            const registryEntries = Object.entries(activeEvent.unitRegistry)
              .map(([id, entry]) => ({ id, name: entry.name }))
              .sort((a, b) => a.name.localeCompare(b.name));

            const seasonsByUnit = {};
            for (const s of activeEvent.seasons) {
              const inRoster = new Set([...(s.units || []), ...(s.nonTokenUnits || [])]);
              for (const w of s.weeks || []) {
                (w.teamA || []).forEach(u => inRoster.add(u));
                (w.teamB || []).forEach(u => inRoster.add(u));
              }
              for (const name of inRoster) {
                (seasonsByUnit[name] ||= []).push(s.name);
              }
            }

            return (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4"
                   onClick={() => setShowRegistryModal(false)}>
                <div className="bg-bg-card rounded-xl shadow-lg border border-border-default max-w-3xl w-full max-h-[85vh] overflow-y-auto"
                     onClick={(e) => e.stopPropagation()}>
                  <div className="p-4 sm:p-6">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Users className="w-6 h-6" />
                        Unit Registry — {activeEvent.name}
                      </h2>
                      <button
                        onClick={() => setShowRegistryModal(false)}
                        className="p-1.5 rounded-md hover:bg-bg-inset transition"
                      >
                        <X className="w-5 h-5 text-text-muted" />
                      </button>
                    </div>

                    <div className="mb-4 bg-bg-inset rounded-lg p-3">
                      <p className="text-xs text-text-secondary">
                        Every unit ever associated with this event. Renaming here propagates to all seasons (rosters, leads, swaps, casualties).
                        Hard-delete is only available when a unit has no roster appearance anywhere in the event.
                      </p>
                    </div>

                    {registryEntries.length === 0 ? (
                      <div className="text-center text-text-muted py-8">No units in this event yet.</div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-text-secondary border-b border-border-default">
                            <th className="py-2 pr-2">Unit</th>
                            <th className="py-2 pr-2">In seasons</th>
                            <th className="py-2 pr-2 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {registryEntries.map(({ id, name }) => {
                            const seasons = seasonsByUnit[name] || [];
                            const inUse = seasons.length > 0;
                            return (
                              <tr key={id} className="border-b border-border-default/40">
                                <td className="py-2 pr-2 font-medium">{name}</td>
                                <td className="py-2 pr-2 text-xs text-text-secondary">
                                  {seasons.length === 0 ? <span className="text-text-muted italic">unused</span> : seasons.join(', ')}
                                </td>
                                <td className="py-2 pr-2">
                                  <div className="flex gap-1 justify-end">
                                    <button
                                      onClick={() => {
                                        const newName = window.prompt(`Rename "${name}" to:`, name);
                                        if (newName == null) return;
                                        const trimmed = newName.trim();
                                        if (!trimmed || trimmed === name) return;
                                        setAppState(prev => renameUnitInEvent(prev, name, trimmed));
                                      }}
                                      className="p-1 rounded-md hover:bg-bg-inset text-text-secondary"
                                      title="Rename (sweeps all seasons)"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      disabled={inUse}
                                      onClick={() => {
                                        if (!confirm(`Hard-delete "${name}" from the registry? This is only safe because it has no roster appearance anywhere.`)) return;
                                        setAppState(prev => removeUnitFromRegistry(prev, name));
                                      }}
                                      className="p-1 rounded-md hover:bg-red-500/20 text-red-500 disabled:opacity-30 disabled:hover:bg-transparent"
                                      title={inUse ? 'Cannot hard-delete — unit appears in roster data. Remove from each season first.' : 'Hard-delete from registry'}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}

                    <div className="flex justify-end mt-6 pt-4 border-t border-border-default">
                      <button
                        onClick={() => setShowRegistryModal(false)}
                        className="px-4 py-2 border border-border-default hover:bg-bg-inset text-sm rounded-md transition"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Teammate Composition Heatmap Modal */}
          {showHeatmapModal && (
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4"
              onClick={() => setShowHeatmapModal(false)}
            >
              <div
                className="bg-bg-card rounded-xl shadow-lg border border-border-default max-w-6xl w-full max-h-[85vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-4 sm:p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <Swords className="w-6 h-6" />
                      Teammate Composition Heatmap
                    </h2>
                    <button
                      onClick={() => setShowHeatmapModal(false)}
                      className="p-1.5 rounded-md hover:bg-bg-inset transition"
                    >
                      <X className="w-5 h-5 text-text-muted" />
                    </button>
                  </div>

                  {/* Scope toggle — same UI as the stats modal tab strip */}
                  <div className="flex gap-1 mb-4 border-b border-border-default">
                    <button
                      onClick={() => setHeatmapScope('season')}
                      className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
                        heatmapScope === 'season'
                          ? 'border-indigo-500 text-indigo-400'
                          : 'border-transparent text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      Season — {activeSeason.name}
                    </button>
                    <button
                      onClick={() => setHeatmapScope('event')}
                      className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
                        heatmapScope === 'event'
                          ? 'border-indigo-500 text-indigo-400'
                          : 'border-transparent text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      Event ({activeEvent.seasons.length} season{activeEvent.seasons.length === 1 ? '' : 's'})
                    </button>
                  </div>

                  <div className="mb-4 bg-bg-inset rounded-lg p-4">
                    <p className="text-sm text-text-secondary">
                      How often units have played together as teammates per round, accounting for balance swaps.
                      50% means they were teammates in half of the rounds where both units were present.
                      {heatmapScope === 'event' && ' Aggregated across every season in this event.'}
                    </p>
                  </div>

                  {(() => {
                    const seasonsToScan = heatmapScope === 'event'
                      ? activeEvent.seasons
                      : (activeSeason ? [activeSeason] : []);
                    const { heatmapData, activeUnits, unitActiveWeeks } = calculateTeammateHeatmapForSeasons(seasonsToScan);
                    
                    if (activeUnits.length === 0) {
                      return (
                        <div className="text-center text-text-secondary py-12">
                          <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                          <p>No teammate data available yet</p>
                        </div>
                      );
                    }

                    // Helper to get color intensity based on percentage of rounds both units were active
                    // Creates a smooth gradient from blue (0%) -> purple -> orange -> red (100%)
                    const getHeatColor = (count, bothActiveRounds) => {
                      if (bothActiveRounds === 0) return 'bg-bg-inset';
                      const percentage = (count / bothActiveRounds) * 100;
                      
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
                    const getPercentage = (count, bothActiveRounds) => {
                      if (bothActiveRounds === 0) return '';
                      return Math.round((count / bothActiveRounds) * 100);
                    };

                    // Calculate dynamic cell size based on number of units
                    const unitCount = activeUnits.length;
                    const cellSize = Math.max(24, Math.min(48, Math.floor(800 / unitCount)));
                    const fontSize = cellSize < 32 ? 'text-[8px]' : cellSize < 40 ? 'text-[10px]' : 'text-xs';
                    
                    return (
                      <div className="bg-bg-inset rounded-lg p-4">
                        <div className="w-full">
                          <table className="w-full border-collapse table-fixed">
                            <thead>
                              <tr style={{ height: '80px' }}>
                                <th className="p-1 text-xs font-semibold text-text-secondary bg-bg-inset z-10" style={{ width: '120px' }}></th>
                                {activeUnits.map(unit => (
                                  <th key={unit} className={`p-0.5 ${fontSize} font-semibold text-text-secondary relative`} style={{ height: '80px' }}>
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
                                  <td className={`p-1 ${fontSize} font-semibold text-text-secondary bg-bg-inset z-10 truncate`} style={{ maxWidth: '120px' }} title={unit1}>
                                    {unit1}
                                  </td>
                                  {activeUnits.map(unit2 => {
                                    if (unit1 === unit2) {
                                      return (
                                        <td key={unit2} className="p-0.5">
                                          <div className="w-full bg-bg-card rounded flex items-center justify-center" style={{ height: `${cellSize}px` }}>
                                            <span className={`${fontSize} text-text-muted`}>-</span>
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
                                    const bothActiveRounds = data?.bothActiveRounds || 0;
                                    const percentage = getPercentage(count, bothActiveRounds);

                                    const bgColor = getHeatColor(count, bothActiveRounds);
                                    const isSlateGray = bgColor === 'bg-bg-inset';
                                    
                                    return (
                                      <td key={unit2} className="p-0.5">
                                        <div
                                          className={`w-full rounded flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-indigo-400 transition ${isSlateGray ? bgColor : ''}`}
                                          style={{
                                            height: `${cellSize}px`,
                                            backgroundColor: isSlateGray ? undefined : bgColor
                                          }}
                                          title={`${unit1} & ${unit2}: ${count} rounds together (${percentage}% of ${bothActiveRounds} rounds) — ${bothActiveWeeks} weeks both active`}
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
                          <div className="text-sm text-text-secondary text-center mb-2">
                            Percentage of Weeks Both Units Active
                          </div>
                          <div className="flex items-center justify-center gap-3">
                            <span className="text-xs text-text-secondary">0%</span>
                            <div className="relative w-64 h-6 rounded overflow-hidden">
                              <div
                                className="absolute inset-0"
                                style={{
                                  background: 'linear-gradient(to right, rgb(135, 206, 235) 0%, rgb(147, 51, 235) 50%, rgb(220, 38, 38) 100%)'
                                }}
                              />
                            </div>
                            <span className="text-xs text-text-secondary">100%</span>
                          </div>
                          <div className="flex items-center justify-center gap-8 mt-2">
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgb(135, 206, 235)' }}></div>
                              <span className="text-xs text-text-secondary">Low</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgb(147, 51, 235)' }}></div>
                              <span className="text-xs text-text-secondary">Mid</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgb(220, 38, 38)' }}></div>
                              <span className="text-xs text-text-secondary">High</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Bottom Buttons */}
                  <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-border-default">
                    <button
                      onClick={() => setShowHeatmapModal(false)}
                      className="px-4 py-2 border border-border-default hover:bg-bg-inset text-sm rounded-md transition"
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
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4"
              onClick={() => setShowSimulateModal(false)}
            >
              <div
                className="bg-bg-card rounded-xl shadow-lg border border-border-default max-w-2xl w-full max-h-[85vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-4 sm:p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <Zap className="w-6 h-6" />
                      Simulate Season
                    </h2>
                    <button
                      onClick={() => setShowSimulateModal(false)}
                      className="p-1.5 rounded-md hover:bg-bg-inset transition"
                    >
                      <X className="w-5 h-5 text-text-muted" />
                    </button>
                  </div>

                  <div className="space-y-6">
                    {/* Info Box */}
                    <div className="bg-bg-inset rounded-lg p-4">
                      <p className="text-sm text-text-secondary mb-2">
                        This will simulate a season by generating weeks with {simScheduleOnly ? 'scheduled leads' : 'randomized'}:
                      </p>
                      {!simScheduleOnly ? (
                        <ul className="text-sm text-text-secondary list-disc list-inside space-y-1 ml-2">
                          <li>Team assignments (leads and supporting units)</li>
                          <li>Map selections for both rounds</li>
                          <li>Round results (50/50 chance per team)</li>
                          <li>No repeat lead matchups</li>
                        </ul>
                      ) : (
                        <ul className="text-sm text-text-secondary list-disc list-inside space-y-1 ml-2">
                          <li>Week creation with assigned leads only</li>
                          <li>Teams remain unassigned (empty)</li>
                          <li>No maps or outcomes generated</li>
                          <li>No repeat lead matchups</li>
                        </ul>
                      )}
                      <p className="text-sm text-text-secondary mt-3">
                        💡 Simulated weeks will be added to your existing weeks.
                      </p>
                    </div>

                    {/* Settings */}
                    <div className="bg-bg-inset rounded-lg p-4 space-y-4">
                      <h3 className="text-lg font-semibold mb-3">Simulation Settings</h3>

                      {/* Schedule Only Toggle */}
                      <div className="bg-bg-inset rounded-lg p-3">
                        <label className="flex items-center gap-2 text-text-secondary cursor-pointer">
                          <input
                            type="checkbox"
                            checked={simScheduleOnly}
                            onChange={(e) => setSimScheduleOnly(e.target.checked)}
                            className="w-4 h-4 rounded border-border-default bg-bg-card focus:ring-2 focus:ring-indigo-500"
                          />
                          <Calendar className="w-4 h-4" />
                          <span className="font-semibold">Schedule Only</span>
                        </label>
                        <p className="text-xs text-text-secondary mt-2 ml-6">
                          {simScheduleOnly
                            ? "Generate weeks with leads assigned but no teams, maps, or outcomes"
                            : "Generate complete weeks with teams, maps, and simulated outcomes"}
                        </p>
                      </div>

                      {/* Lead Nights Per Unit */}
                      <div>
                        <label className="block text-sm text-text-secondary mb-2">
                          # of Lead Nights per Token Unit
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={simLeadNightsPerUnit}
                          onChange={(e) => setSimLeadNightsPerUnit(parseInt(e.target.value) || 1)}
                          className="w-full px-3 py-2 bg-bg-input rounded-md border border-border-default focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                        />
                        <p className="text-xs text-text-secondary mt-1">
                          {simLeadMode === 'rounds'
                            ? `Each token unit will lead ${simLeadNightsPerUnit} night(s) with 2 rounds per night. Total weeks = ${units.filter(u => !nonTokenUnits.includes(u)).length} units × ${simLeadNightsPerUnit} × 2 = ${units.filter(u => !nonTokenUnits.includes(u)).length * simLeadNightsPerUnit * 2} weeks`
                            : `Each token unit will lead this many weeks. Total weeks = ${units.filter(u => !nonTokenUnits.includes(u)).length} units × ${simLeadNightsPerUnit} = ${units.filter(u => !nonTokenUnits.includes(u)).length * simLeadNightsPerUnit} weeks`
                          }
                        </p>
                      </div>

                      {/* Lead Mode Selection */}
                      <div>
                        <label className="block text-sm text-text-secondary mb-2">
                          Lead Assignment Mode
                        </label>
                        <div className="space-y-2">
                          <label className="flex items-start gap-2 text-text-secondary cursor-pointer">
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
                              <div className="text-xs text-text-secondary">One unit leads both rounds each night</div>
                            </div>
                          </label>
                          <label className="flex items-start gap-2 text-text-secondary cursor-pointer">
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
                              <div className="text-xs text-text-secondary">Two units lead per night (one per round)</div>
                            </div>
                          </label>
                        </div>
                      </div>

                      {/* Division Lead Nights */}
                      {divisions && divisions.length > 0 && (
                        <div>
                          <label className="block text-sm text-text-secondary mb-2">
                            # of Lead Nights within Division
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={simLeadNightsPerUnit}
                            value={simLeadNightsInDivision}
                            onChange={(e) => setSimLeadNightsInDivision(Math.min(parseInt(e.target.value) || 0, simLeadNightsPerUnit))}
                            className="w-full px-3 py-2 bg-bg-input rounded-md border border-border-default focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                          />
                          <p className="text-xs text-text-secondary mt-1">
                            {simLeadNightsInDivision === 0
                              ? "0 = Any matchup is fine (no division requirement)" 
                              : `Each unit must lead ${simLeadNightsInDivision} week(s) against opponents in their division`}
                          </p>
                        </div>
                      )}

                      {/* Unit Summary */}
                      <div className="bg-bg-inset rounded p-3">
                        <h4 className="text-sm font-semibold mb-2">Current Units</h4>
                        <div className="grid grid-cols-2 gap-2 text-xs text-text-secondary">
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
                  <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-border-default">
                    <button
                      onClick={() => setShowSimulateModal(false)}
                      className="px-4 py-2 border border-border-default hover:bg-bg-inset text-sm rounded-md transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={simulateSeason}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-md transition flex items-center gap-2"
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
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4"
              onClick={() => setShowAnalyticsModal(false)}
            >
              <div
                className="bg-bg-card rounded-xl shadow-lg border border-border-default max-w-3xl w-full max-h-[85vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-4 sm:p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <TrendingUp className="w-6 h-6" />
                      Simulation Analytics
                    </h2>
                    <button
                      onClick={() => setShowAnalyticsModal(false)}
                      className="p-1.5 rounded-md hover:bg-bg-inset transition"
                    >
                      <X className="w-5 h-5 text-text-muted" />
                    </button>
                  </div>

                  <div className="space-y-6">
                    {/* Success Message */}
                    <div className="bg-green-900/30 border border-green-700 rounded-lg p-4">
                      <p className="text-green-400 font-semibold flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5" />
                        Successfully simulated {simulationAnalytics.totalWeeks} weeks ({simulationAnalytics.totalRounds} rounds)!
                      </p>
                      <p className="text-xs text-text-secondary mt-2">
                        Analysis shows point distribution from a per-token-unit perspective
                      </p>
                    </div>

                    {/* Point System Summary */}
                    <div className="bg-bg-inset rounded-lg p-4">
                      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        <Settings className="w-5 h-5" />
                        Current Point System
                      </h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="bg-bg-inset rounded p-3">
                          <div className="text-text-secondary mb-2 font-semibold">Lead Points</div>
                          <div className="space-y-1 text-text-secondary">
                            <div>Win: <span className="text-indigo-400 font-semibold">{pointSystem.winLead}</span></div>
                            <div>Loss: <span className="text-indigo-400 font-semibold">{pointSystem.lossLead}</span></div>
                            <div>Sweep: <span className="text-indigo-400 font-semibold">{pointSystem.bonus2_0Lead}</span></div>
                          </div>
                        </div>
                        <div className="bg-bg-inset rounded p-3">
                          <div className="text-text-secondary mb-2 font-semibold">Assist Points</div>
                          <div className="space-y-1 text-text-secondary">
                            <div>Win: <span className="text-indigo-400 font-semibold">{pointSystem.winAssist}</span></div>
                            <div>Loss: <span className="text-indigo-400 font-semibold">{pointSystem.lossAssist}</span></div>
                            <div>Sweep: <span className="text-indigo-400 font-semibold">{pointSystem.bonus2_0Assist}</span></div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Theoretical Analysis */}
                    <div className="bg-bg-inset rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-blue-400 mb-3 flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        Theoretical Distribution (Per Token Unit)
                      </h3>
                      <p className="text-xs text-text-secondary mb-4">
                        Maximum possible points per token unit (winning every round and sweep)
                      </p>
                      <div className="space-y-3">
                        <div className="bg-bg-inset rounded p-3">
                          <div className="text-xs text-text-secondary mb-2 font-semibold">Max Possible (Season)</div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-text-secondary font-semibold">Lead Points</span>
                            <span className="text-indigo-400 font-bold">{simulationAnalytics.theoretical.leadPoints.toFixed(1)}</span>
                          </div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-text-secondary font-semibold">Assist Points</span>
                            <span className="text-blue-400 font-bold">{simulationAnalytics.theoretical.assistPoints.toFixed(1)}</span>
                          </div>
                          <div className="border-t border-border-default my-2"></div>
                          <div className="flex justify-between items-center">
                            <span className="text-text-secondary font-semibold">Total Points</span>
                            <span className="font-bold">{simulationAnalytics.theoretical.totalPoints.toFixed(1)}</span>
                          </div>
                        </div>
                        <div className="bg-bg-inset rounded p-3">
                          <div className="text-xs text-text-secondary mb-2 font-semibold">Max Possible (Per Round)</div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-text-secondary font-semibold">Lead Points</span>
                            <span className="text-indigo-400 font-bold">{(simulationAnalytics.theoretical.leadPoints / simulationAnalytics.totalRounds).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-text-secondary font-semibold">Assist Points</span>
                            <span className="text-blue-400 font-bold">{(simulationAnalytics.theoretical.assistPoints / simulationAnalytics.totalRounds).toFixed(2)}</span>
                          </div>
                          <div className="border-t border-border-default my-2"></div>
                          <div className="flex justify-between items-center">
                            <span className="text-text-secondary font-semibold">Total Points</span>
                            <span className="font-bold">{(simulationAnalytics.theoretical.totalPoints / simulationAnalytics.totalRounds).toFixed(2)}</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-indigo-900/30 border border-indigo-700 rounded p-3 text-center">
                            <div className="text-indigo-400 text-2xl font-bold">{simulationAnalytics.theoretical.leadPercentage.toFixed(1)}%</div>
                            <div className="text-xs text-text-secondary mt-1">Lead Points</div>
                          </div>
                          <div className="bg-blue-900/30 border border-blue-700 rounded p-3 text-center">
                            <div className="text-blue-400 text-2xl font-bold">{simulationAnalytics.theoretical.assistPercentage.toFixed(1)}%</div>
                            <div className="text-xs text-text-secondary mt-1">Assist Points</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Simulated Results */}
                    <div className="bg-bg-inset rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-green-400 mb-3 flex items-center gap-2">
                        <BarChart3 className="w-5 h-5" />
                        Simulated Results (Per Token Unit Average)
                      </h3>
                      <p className="text-xs text-text-secondary mb-4">
                        Actual points averaged across all token units from the simulation
                      </p>
                      <div className="space-y-3">
                        <div className="bg-bg-inset rounded p-3">
                          <div className="text-xs text-text-secondary mb-2 font-semibold">Season Totals (Average)</div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-text-secondary font-semibold">Lead Points</span>
                            <span className="text-indigo-400 font-bold">{simulationAnalytics.simulated.leadPoints.toFixed(1)}</span>
                          </div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-text-secondary font-semibold">Assist Points</span>
                            <span className="text-blue-400 font-bold">{simulationAnalytics.simulated.assistPoints.toFixed(1)}</span>
                          </div>
                          <div className="border-t border-border-default my-2"></div>
                          <div className="flex justify-between items-center">
                            <span className="text-text-secondary font-semibold">Total Points</span>
                            <span className="font-bold">{simulationAnalytics.simulated.totalPoints.toFixed(1)}</span>
                          </div>
                        </div>
                        <div className="bg-bg-inset rounded p-3">
                          <div className="text-xs text-text-secondary mb-2 font-semibold">Per Round Average</div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-text-secondary font-semibold">Lead Points</span>
                            <span className="text-indigo-400 font-bold">{(simulationAnalytics.simulated.leadPoints / simulationAnalytics.totalRounds).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-text-secondary font-semibold">Assist Points</span>
                            <span className="text-blue-400 font-bold">{(simulationAnalytics.simulated.assistPoints / simulationAnalytics.totalRounds).toFixed(2)}</span>
                          </div>
                          <div className="border-t border-border-default my-2"></div>
                          <div className="flex justify-between items-center">
                            <span className="text-text-secondary font-semibold">Total Points</span>
                            <span className="font-bold">{(simulationAnalytics.simulated.totalPoints / simulationAnalytics.totalRounds).toFixed(2)}</span>
                          </div>
                        </div>
                        <div className="text-xs text-text-secondary bg-bg-inset rounded p-2">
                          All token units combined: {simulationAnalytics.simulated.totalLeadPoints.toFixed(0)} lead points, {simulationAnalytics.simulated.totalAssistPoints.toFixed(0)} assist points
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-indigo-900/30 border border-indigo-700 rounded p-3 text-center">
                            <div className="text-indigo-400 text-2xl font-bold">{simulationAnalytics.simulated.leadPercentage.toFixed(1)}%</div>
                            <div className="text-xs text-text-secondary mt-1">Lead Points</div>
                          </div>
                          <div className="bg-blue-900/30 border border-blue-700 rounded p-3 text-center">
                            <div className="text-blue-400 text-2xl font-bold">{simulationAnalytics.simulated.assistPercentage.toFixed(1)}%</div>
                            <div className="text-xs text-text-secondary mt-1">Assist Points</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Comparison */}
                    <div className="bg-indigo-900/20 border border-indigo-700 rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-indigo-400 mb-3 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5" />
                        Comparison
                      </h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-text-secondary mb-1">Lead Point Variance</div>
                          <div className={`text-lg font-bold ${Math.abs(simulationAnalytics.simulated.leadPercentage - simulationAnalytics.theoretical.leadPercentage) < 2 ? 'text-green-400' : 'text-yellow-400'}`}>
                            {(simulationAnalytics.simulated.leadPercentage - simulationAnalytics.theoretical.leadPercentage > 0 ? '+' : '')}
                            {(simulationAnalytics.simulated.leadPercentage - simulationAnalytics.theoretical.leadPercentage).toFixed(1)}%
                          </div>
                        </div>
                        <div>
                          <div className="text-text-secondary mb-1">Assist Point Variance</div>
                          <div className={`text-lg font-bold ${Math.abs(simulationAnalytics.simulated.assistPercentage - simulationAnalytics.theoretical.assistPercentage) < 2 ? 'text-green-400' : 'text-yellow-400'}`}>
                            {(simulationAnalytics.simulated.assistPercentage - simulationAnalytics.theoretical.assistPercentage > 0 ? '+' : '')}
                            {(simulationAnalytics.simulated.assistPercentage - simulationAnalytics.theoretical.assistPercentage).toFixed(1)}%
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-text-secondary mt-3">
                        💡 Small variances are expected due to randomization. Large variances may indicate imbalanced settings.
                      </p>
                    </div>

                    {/* Close Button */}
                    <div className="flex justify-end">
                      <button
                        onClick={() => setShowAnalyticsModal(false)}
                        className="px-6 py-2 border border-border-default hover:bg-bg-inset text-sm rounded-md transition font-semibold"
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
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
              <div className="bg-bg-card rounded-xl shadow-lg border border-border-default w-full max-w-6xl max-h-[85vh] overflow-y-auto">
                <div className="p-4 sm:p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
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
                      className="p-1.5 rounded-md hover:bg-bg-inset transition"
                    >
                      <X className="w-5 h-5 text-text-muted" />
                    </button>
                  </div>

                  {/* Weeks Enlarged View */}
                  {enlargedSection === 'weeks' && (
                    <div>
                      <div className="mb-4 flex justify-end">
                        <button
                          onClick={addWeek}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-md transition flex items-center gap-2"
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
                                ? 'bg-indigo-600 text-white'
                                : 'bg-bg-inset hover:bg-border-subtle'
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
                                  className="flex-1 px-2 py-1 bg-bg-input rounded-md border border-border-default outline-none"
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
                                  className="p-1 hover:bg-bg-inset rounded transition"
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
                          className="flex-1 px-3 py-2 bg-bg-input rounded-md border border-border-default focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                        />
                        <button
                          onClick={addUnit}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-md transition flex items-center gap-2"
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
                              className="flex justify-between items-center p-3 bg-bg-inset rounded-lg"
                            >
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => toggleNonTokenStatus(unit)}
                                  className={`px-2 py-1 rounded text-xs font-bold transition ${
                                    isNonToken
                                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                      : 'bg-bg-card hover:bg-bg-inset text-text-secondary'
                                  }`}
                                  title={isNonToken ? "Non-token unit (click to toggle)" : "Token unit (click to toggle)"}
                                >
                                  {isNonToken ? '*' : '○'}
                                </button>
                                <span className={`font-medium ${isNonToken ? 'text-indigo-400' : 'text-text-primary'}`}>
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
                          className="px-3 py-2 border border-border-default hover:bg-bg-inset text-sm rounded-md transition flex items-center gap-1"
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
                            <div key={group.name} className="bg-bg-inset rounded-lg p-4">
                              <h3 className="text-sm font-bold text-text-secondary mb-3 px-2 flex items-center gap-2">
                                <Shield className="w-4 h-4" />
                                {group.name}
                              </h3>
                              <div className="space-y-2">
                                {group.units.map((stat) => {
                                  const isNonToken = nonTokenUnits.includes(stat.unit);
                                  return (
                                    <div
                                      key={stat.unit}
                                      className="bg-bg-inset rounded-lg p-3"
                                    >
                                      <div className="flex justify-between items-center mb-2">
                                        <div className="flex items-center gap-2">
                                          <span className="text-indigo-400 font-bold text-lg">
                                            #{stat.divisionRank || stat.currentRank}
                                          </span>
                                          {stat.rankDelta !== null && stat.rankDelta !== undefined && (
                                            <span className={`text-xs font-semibold ${
                                              stat.rankDelta > 0 ? 'text-green-400' :
                                              stat.rankDelta < 0 ? 'text-red-400' :
                                              'text-text-secondary'
                                            }`}>
                                              {stat.rankDelta > 0 ? `↑${stat.rankDelta}` :
                                               stat.rankDelta < 0 ? `↓${Math.abs(stat.rankDelta)}` :
                                               '−'}
                                            </span>
                                          )}
                                          <span className={`font-semibold ${isNonToken ? 'text-indigo-400' : 'text-text-primary'}`}>
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
                                          {stat.pointsDelta !== 0 && (
                                            <span className={`text-xs ml-1 ${stat.pointsDelta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                              ({stat.pointsDelta > 0 ? '+' : ''}{stat.pointsDelta})
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <div className="grid grid-cols-2 gap-2 text-xs text-text-secondary">
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
                                className="bg-bg-inset rounded-lg p-3"
                              >
                                <div className="flex justify-between items-center mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-indigo-400 font-bold text-lg">
                                      #{index + 1}
                                    </span>
                                    {stat.rankDelta !== null && stat.rankDelta !== undefined && (
                                      <span className={`text-xs font-semibold ${
                                        stat.rankDelta > 0 ? 'text-green-400' :
                                        stat.rankDelta < 0 ? 'text-red-400' :
                                        'text-text-secondary'
                                      }`}>
                                        {stat.rankDelta > 0 ? `↑${stat.rankDelta}` :
                                         stat.rankDelta < 0 ? `↓${Math.abs(stat.rankDelta)}` :
                                         '−'}
                                      </span>
                                    )}
                                    <span className={`font-semibold ${isNonToken ? 'text-indigo-400' : 'text-text-primary'}`}>
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
                                    {stat.pointsDelta !== 0 && (
                                      <span className={`text-xs ml-1 ${stat.pointsDelta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        ({stat.pointsDelta > 0 ? '+' : ''}{stat.pointsDelta})
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs text-text-secondary">
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
            <div className="text-center text-text-secondary py-12 mt-6">
              <Calendar className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">Add a week to get started</p>
            </div>
          )}
        </div>
      </div>

      {/* Generic Choice Dialog — replaces window.prompt() for action picks */}
      {choiceDialog && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
          onClick={choiceDialog.onClose}
        >
          <div
            className="bg-bg-card rounded-xl shadow-lg border border-border-default max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5">
              <div className="flex justify-between items-start gap-3 mb-2">
                <h2 className="text-base font-semibold">{choiceDialog.title}</h2>
                <button
                  onClick={choiceDialog.onClose}
                  className="p-1 rounded-md hover:bg-bg-inset transition shrink-0"
                  aria-label="Close"
                >
                  <X className="w-4 h-4 text-text-muted" />
                </button>
              </div>
              {choiceDialog.message && (
                <p className="text-sm text-text-secondary mb-4">{choiceDialog.message}</p>
              )}
              <div className="flex flex-col gap-2">
                {choiceDialog.choices.map((c, idx) => {
                  const variant = c.variant || 'secondary';
                  const cls =
                    variant === 'primary'   ? 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600'
                  : variant === 'danger'    ? 'bg-red-600/90 hover:bg-red-600 text-white border-red-600'
                  : variant === 'cancel'    ? 'bg-transparent hover:bg-bg-inset text-text-secondary border-border-default'
                  :                           'bg-bg-inset hover:bg-border-subtle text-text-primary border-border-default';
                  return (
                    <button
                      key={idx}
                      onClick={() => choiceDialog.onChoose(c.value)}
                      className={`text-left px-4 py-2.5 rounded-md border transition ${cls}`}
                    >
                      <div className="text-sm font-medium">{c.label}</div>
                      {c.description && (
                        <div className={`text-xs mt-0.5 ${variant === 'primary' || variant === 'danger' ? 'opacity-90' : 'text-text-secondary'}`}>
                          {c.description}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SeasonTracker;