import React, { useState, useRef, useEffect } from 'react';
import { Upload, Clock, Users, Skull, Edit2, Zap, X, TrendingUp, Award, Timer, BarChart3, ChevronDown, ChevronRight, Trash2, ArrowRight, Download, AlertTriangle } from 'lucide-react';

const STORAGE_KEY = 'WarOfRightsLogAnalyzer';

const WarOfRightsLogAnalyzer = () => {
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

  const [rounds, setRounds] = useState(savedState?.rounds || []);
  const [selectedRound, setSelectedRound] = useState(savedState?.selectedRound || null);
  const [regimentStats, setRegimentStats] = useState([]);
  const [selectedRegiment, setSelectedRegiment] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [playerAssignments, setPlayerAssignments] = useState(savedState?.playerAssignments || {});
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [newRegiment, setNewRegiment] = useState('');
  const [expandedRegiments, setExpandedRegiments] = useState(savedState?.expandedRegiments || {});
  const [editingRegiment, setEditingRegiment] = useState(null);
  const [newRegimentName, setNewRegimentName] = useState('');
  const [smartMatchPreview, setSmartMatchPreview] = useState(null);
  const [showSmartMatchPreview, setShowSmartMatchPreview] = useState(false);
  const [pendingEdits, setPendingEdits] = useState({});
  const [hoveredRegiment, setHoveredRegiment] = useState(null);
  const [pinnedRegiment, setPinnedRegiment] = useState(savedState?.pinnedRegiment || null);
  const [timeRangeStart, setTimeRangeStart] = useState(savedState?.timeRangeStart || 0);
  const [timeRangeEnd, setTimeRangeEnd] = useState(savedState?.timeRangeEnd || 100);
  const [hoverInfo, setHoverInfo] = useState(null);
  const svgRef = useRef(null);
  const [showAllLossRates, setShowAllLossRates] = useState(savedState?.showAllLossRates || false);
  const [showAllTimeInCombat, setShowAllTimeInCombat] = useState(savedState?.showAllTimeInCombat || false);
  const [showWarning, setShowWarning] = useState(false);

  // Save state to localStorage whenever relevant state changes
  useEffect(() => {
    const stateToSave = {
      rounds,
      selectedRound,
      playerAssignments,
      expandedRegiments,
      pinnedRegiment,
      timeRangeStart,
      timeRangeEnd,
      showAllLossRates,
      showAllTimeInCombat,
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }, [rounds, selectedRound, playerAssignments, expandedRegiments, pinnedRegiment, timeRangeStart, timeRangeEnd, showAllLossRates, showAllTimeInCombat]);

  // Restore selected round's stats on mount if there's a saved selected round
  useEffect(() => {
    if (savedState?.selectedRound && rounds.length > 0) {
      const round = rounds.find(r => r.id === savedState.selectedRound.id);
      if (round) {
        analyzeRound(round);
      }
    }
  }, []); // Only run once on mount

  const normalizeRegimentTag = (tag) => {
    if (!tag) return tag;
    
    // Remove all company/unit suffixes and extra characters
    // Handles: (A), (B), (WB), .A, .B, .I*, .CG, . C, etc.
    let normalized = tag
      .replace(/\([A-Z0-9*]+\)$/i, '')  // Remove (A), (B), (WB), etc.
      .replace(/\.[A-Z0-9*\s]+$/i, '')  // Remove .A, .B, .I*, .CG, . C, etc.
      .replace(/\|+$/, '')              // Remove trailing pipes |
      .replace(/\s+/g, '')              // Remove ALL spaces (23rd NYV -> 23rdNYV)
      .trim();
    
    return normalized;
  };

  const extractRegimentTag = (playerName) => {
    // Priority order: Check for outer brackets first (CB[8th OH] should extract CB, not 8th OH)
    const outerBracketPatterns = [
      /^([A-Z]{2,})\[/,          // CB[ or FSB[ - outer tag before bracket
      /^([A-Z]{2,})\{/,          // MSG{ - outer tag before brace
    ];

    for (const pattern of outerBracketPatterns) {
      const match = playerName.match(pattern);
      if (match) {
        let tag = match[1].trim().toUpperCase();
        return normalizeRegimentTag(tag);
      }
    }

    // Then check for standard bracket/brace patterns
    const bracketPatterns = [
      /^\[([^\]]+)\]/,           // [51stAL]
      /^\{([^\}]+)\}/,           // {59THNY}
      /^\(([^\)]+)\)/,           // (1stTX)
    ];

    for (const pattern of bracketPatterns) {
      const match = playerName.match(pattern);
      if (match) {
        let tag = match[1].trim().toUpperCase();
        return normalizeRegimentTag(tag);
      }
    }

    // Then check for delimiter patterns
    const delimiterPatterns = [
      /^([A-Z0-9]+)-/,           // JD-
      /^([A-Z0-9]+)\|/,          // SR| or 10THSC|
      /^([A-Z]{2,})-/,           // II-
      /^([A-Z]+\d+[A-Z]*)\s/,    // 10thUS or 59thNY
    ];

    for (const pattern of delimiterPatterns) {
      const match = playerName.match(pattern);
      if (match) {
        let tag = match[1].trim().toUpperCase();
        return normalizeRegimentTag(tag);
      }
    }

    // If no pattern matches, take first word if it looks like a tag
    const firstWord = playerName.split(/[\s\[\{\(\-]/)[0];
    if (firstWord && firstWord.length <= 10 && /[A-Z]/.test(firstWord)) {
      let tag = firstWord.toUpperCase();
      return normalizeRegimentTag(tag);
    }

    return 'UNTAGGED';
  };

  const levenshteinDistance = (str1, str2) => {
    const m = str1.length;
    const n = str2.length;
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(
            dp[i - 1][j - 1] + 1,
            dp[i - 1][j] + 1,
            dp[i][j - 1] + 1
          );
        }
      }
    }

    return dp[m][n];
  };

  const getAvailableRegiments = () => {
    if (!selectedRound) return [];
    
    const roundKey = `round_${selectedRound.id}`;
    const assignments = playerAssignments[roundKey] || {};
    const regimentMap = {};
    
    // Collect all regiments and normalize them
    selectedRound.kills.forEach(death => {
      const regiment = assignments[death.player] || extractRegimentTag(death.player);
      if (regiment !== 'UNTAGGED') {
        const normalized = normalizeRegimentTag(regiment);
        if (!regimentMap[normalized]) {
          regimentMap[normalized] = normalized;
        }
      }
    });
    
    return Object.keys(regimentMap).sort();
  };

  const generateSmartMatchPreview = () => {
    if (!selectedRound) return;

    const roundKey = `round_${selectedRound.id}`;
    const currentAssignments = { ...playerAssignments[roundKey] } || {};
    
    // Build regiment list with counts and player lists
    const regimentData = {};
    selectedRound.kills.forEach(death => {
      const currentRegiment = currentAssignments[death.player] || extractRegimentTag(death.player);
      if (!regimentData[currentRegiment]) {
        regimentData[currentRegiment] = {
          count: 0,
          players: []
        };
      }
      if (!regimentData[currentRegiment].players.includes(death.player)) {
        regimentData[currentRegiment].players.push(death.player);
        regimentData[currentRegiment].count++;
      }
    });

    // Find regiments with 2+ members (target regiments to match TO)
    const targetRegiments = Object.keys(regimentData).filter(reg => regimentData[reg].count >= 2);
    
    // Find regiments with 1 member (including UNTAGGED) - these need matching
    const singlePlayerRegiments = Object.keys(regimentData).filter(reg => regimentData[reg].count === 1);

    const matches = [];
    const playerMatches = {}; // Track individual player matches

    // Helper function to extract all possible regiment tags from a player name
    const extractAllPossibleTags = (playerName) => {
      const tags = new Set();
      const nameUpper = playerName.toUpperCase();
      
      // Extract tags from brackets/braces/parens
      const bracketMatches = [
        ...nameUpper.matchAll(/\[([^\]]+)\]/g),
        ...nameUpper.matchAll(/\{([^\}]+)\}/g),
        ...nameUpper.matchAll(/\(([^\)]+)\)/g)
      ];
      
      bracketMatches.forEach(match => {
        const tag = normalizeRegimentTag(match[1].trim());
        if (tag && tag !== 'UNTAGGED') {
          tags.add(tag);
        }
      });
      
      // Extract tags before delimiters
      const delimiterMatches = [
        nameUpper.match(/^([A-Z0-9]+)[-_]/),
        nameUpper.match(/^([A-Z0-9]+)\|/),
        nameUpper.match(/^([A-Z]+\d+[A-Z]*)\s/)
      ];
      
      delimiterMatches.forEach(match => {
        if (match) {
          const tag = normalizeRegimentTag(match[1].trim());
          if (tag && tag !== 'UNTAGGED') {
            tags.add(tag);
          }
        }
      });
      
      // Extract first word if it looks like a tag
      const firstWord = playerName.split(/[\s\[\{\(\-_|]/)[0];
      if (firstWord && firstWord.length <= 10 && /[A-Z]/.test(firstWord)) {
        const tag = normalizeRegimentTag(firstWord.toUpperCase());
        if (tag && tag !== 'UNTAGGED') {
          tags.add(tag);
        }
      }
      
      return Array.from(tags);
    };

    // Check each player in single-player regiments (including UNTAGGED)
    singlePlayerRegiments.forEach(sourceReg => {
      regimentData[sourceReg].players.forEach(playerName => {
        const playerNameUpper = playerName.toUpperCase();
        
        // Extract all possible tags from the player's name
        const playerTags = extractAllPossibleTags(playerName);
        
        // Check if ANY target regiment tag appears in the player's name (substring or extracted)
        targetRegiments.forEach(targetReg => {
          const targetRegUpper = targetReg.toUpperCase();
          const targetRegNormalized = normalizeRegimentTag(targetReg);
          
          let isMatch = false;
          
          // Method 1: Direct substring check
          if (playerNameUpper.includes(targetRegUpper)) {
            isMatch = true;
          }
          
          // Method 2: Check if any extracted tag matches the target regiment
          if (!isMatch) {
            playerTags.forEach(playerTag => {
              const playerTagNormalized = normalizeRegimentTag(playerTag);
              if (playerTagNormalized === targetRegNormalized) {
                isMatch = true;
              }
            });
          }
          
          if (isMatch) {
            if (!playerMatches[targetReg]) {
              playerMatches[targetReg] = [];
            }
            playerMatches[targetReg].push({
              player: playerName,
              fromRegiment: sourceReg
            });
          }
        });
      });
    });

    // Convert playerMatches to the format expected by the UI
    Object.keys(playerMatches).forEach(targetReg => {
      const playerList = playerMatches[targetReg];
      
      // Group by source regiment for cleaner display
      const bySourceReg = {};
      playerList.forEach(({ player, fromRegiment }) => {
        if (!bySourceReg[fromRegiment]) {
          bySourceReg[fromRegiment] = {
            players: []
          };
        }
        bySourceReg[fromRegiment].players.push(player);
      });

      // Create a match entry for each source regiment
      Object.keys(bySourceReg).forEach(sourceReg => {
        matches.push({
          fromRegiment: sourceReg,
          toRegiment: targetReg,
          players: bySourceReg[sourceReg].players,
          similarity: 100 // Always 100% since we only show substring matches
        });
      });
    });

    // Sort matches by target regiment name
    matches.sort((a, b) => a.toRegiment.localeCompare(b.toRegiment));

    setSmartMatchPreview(matches);
    setShowSmartMatchPreview(true);
  };

  const applySmartMatch = () => {
    if (!smartMatchPreview || !selectedRound) return;

    const roundKey = `round_${selectedRound.id}`;
    const currentAssignments = { ...playerAssignments[roundKey] } || {};
    
    let totalChanges = 0;
    smartMatchPreview.forEach(match => {
      match.players.forEach(player => {
        // Check if there's a player-specific override
        const targetRegiment = match.playerOverrides?.[player] || match.toRegiment;
        currentAssignments[player] = targetRegiment;
        totalChanges++;
      });
    });

    setPlayerAssignments({
      ...playerAssignments,
      [roundKey]: currentAssignments
    });

    // Refresh stats
    analyzeRound(selectedRound, currentAssignments);
    
    setShowSmartMatchPreview(false);
    setSmartMatchPreview(null);
    
    alert(`Smart Match applied! Reassigned ${totalChanges} player(s) to matching regiments.`);
  };

  const cancelSmartMatch = () => {
    setShowSmartMatchPreview(false);
    setSmartMatchPreview(null);
  };

  const parseLogFile = (logText) => {
    const lines = logText.split('\n');
    const parsedRounds = [];
    let currentRound = null;
    let roundNumber = 0;

    lines.forEach(line => {
      // Detect round start
      if (line.includes('CGameRulesEventHelper::OnRoundStarted')) {
        if (currentRound) {
          parsedRounds.push(currentRound);
        }
        roundNumber++;
        const timeMatch = line.match(/<(\d{2}:\d{2}:\d{2})>/);
        currentRound = {
          id: roundNumber,
          startTime: timeMatch ? timeMatch[1] : 'Unknown',
          endTime: null,
          duration: null,
          kills: [],
          teamkills: [],
          playerSessions: {}
        };
      }

      // Detect round end (victory)
      if (line.includes('CGameRulesEventHelper::OnVictory') && currentRound) {
        const timeMatch = line.match(/<(\d{2}:\d{2}:\d{2})>/);
        currentRound.endTime = timeMatch ? timeMatch[1] : 'Unknown';
        
        if (currentRound.startTime !== 'Unknown' && currentRound.endTime !== 'Unknown') {
          const start = currentRound.startTime.split(':').map(Number);
          const end = currentRound.endTime.split(':').map(Number);
          const startSeconds = start[0] * 3600 + start[1] * 60 + start[2];
          const endSeconds = end[0] * 3600 + end[1] * 60 + end[2];
          const durationSeconds = endSeconds - startSeconds;
          const minutes = Math.floor(durationSeconds / 60);
          const seconds = durationSeconds % 60;
          currentRound.duration = `${minutes}m ${seconds}s`;
        }
      }

      // Detect player joins
      if (line.includes('has joined the server') && currentRound) {
        const match = line.match(/<(\d{2}:\d{2}:\d{2})>\s+Player\s+(.+?)\s+has joined the server/);
        if (match) {
          const time = match[1];
          const playerName = match[2].trim();
          if (!currentRound.playerSessions[playerName]) {
            currentRound.playerSessions[playerName] = [];
          }
          currentRound.playerSessions[playerName].push({ join: time, leave: null });
        }
      }

      // Detect player leaves
      if (line.includes('has left the server') && currentRound) {
        const match = line.match(/<(\d{2}:\d{2}:\d{2})>\s+Player\s+(.+?)\s+has left the server/);
        if (match) {
          const time = match[1];
          const playerName = match[2].trim();
          if (currentRound.playerSessions[playerName]) {
            const sessions = currentRound.playerSessions[playerName];
            const lastSession = sessions[sessions.length - 1];
            if (lastSession && !lastSession.leave) {
              lastSession.leave = time;
            }
          }
        }
      }

      // Detect respawns (casualties)
      if (line.includes('[CPlayer::ClDoRespawn]') && currentRound) {
        const match = line.match(/\[CPlayer::ClDoRespawn\]\s+"([^"]+)"\s+beginning respawning with revive counter\s+(\d+)/);
        if (match) {
          currentRound.kills.push({
            player: match[1].trim(),
            reviveCounter: parseInt(match[2])
          });
        }
      }
    });

    // Push last round if exists
    if (currentRound) {
      parsedRounds.push(currentRound);
    }

    // Reset all state when loading a new log file
    setRounds(parsedRounds);
    setSelectedRound(null);
    setRegimentStats([]);
    setSelectedRegiment(null);
    setPlayerAssignments({});
    setExpandedRegiments({});
    setPinnedRegiment(null);
    setTimeRangeStart(0);
    setTimeRangeEnd(100);
    setShowAllLossRates(false);
    setShowAllTimeInCombat(false);
    setShowWarning(true);
  };

  const analyzeRound = (round, customAssignments = null) => {
    const roundKey = `round_${round.id}`;
    const assignments = customAssignments || playerAssignments[roundKey] || {};
    const regimentCasualties = {};
    
    // Calculate round duration from the round parameter
    let roundDurationSeconds = 0;
    if (round.startTime && round.endTime && round.startTime !== 'Unknown' && round.endTime !== 'Unknown') {
      const start = round.startTime.split(':').map(Number);
      const end = round.endTime.split(':').map(Number);
      const startSeconds = start[0] * 3600 + start[1] * 60 + start[2];
      const endSeconds = end[0] * 3600 + end[1] * 60 + end[2];
      roundDurationSeconds = endSeconds - startSeconds;
    }

    // Count respawns (deaths) per regiment, excluding first 1 minute
    round.kills.forEach((death, index) => {
      // Estimate death time based on position in kills array
      const estimatedDeathTime = roundDurationSeconds > 0
        ? (index / round.kills.length) * roundDurationSeconds
        : 0;
      
      // Skip deaths in the first 1 minutes (60 seconds)
      if (estimatedDeathTime < 60) {
        return;
      }

      let regiment = assignments[death.player] || extractRegimentTag(death.player);
      // Normalize to merge duplicates
      regiment = normalizeRegimentTag(regiment);

      if (!regimentCasualties[regiment]) {
        regimentCasualties[regiment] = {
          name: regiment,
          casualties: 0,
          deaths: [],
          players: {}
        };
      }

      regimentCasualties[regiment].casualties++;
      regimentCasualties[regiment].deaths.push(death.player);
      
      // Track individual player deaths
      if (!regimentCasualties[regiment].players[death.player]) {
        regimentCasualties[regiment].players[death.player] = 0;
      }
      regimentCasualties[regiment].players[death.player]++;
    });

    // Convert to array and sort by casualties
    const stats = Object.values(regimentCasualties)
      .sort((a, b) => b.casualties - a.casualties);

    setRegimentStats(stats);
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        parseLogFile(e.target.result);
      };
      reader.readAsText(file);
    }
  };

  const handleRoundSelect = (round) => {
    setSelectedRound(round);
    setSelectedRegiment(null);
    setShowEditor(false);
    analyzeRound(round);
  };

  const handleRegimentClick = (regiment) => {
    setSelectedRegiment(selectedRegiment?.name === regiment.name ? null : regiment);
  };

  const getRoundDurationSeconds = () => {
    if (!selectedRound || !selectedRound.startTime || !selectedRound.endTime) return 0;
    if (selectedRound.startTime === 'Unknown' || selectedRound.endTime === 'Unknown') return 0;
    
    const start = selectedRound.startTime.split(':').map(Number);
    const end = selectedRound.endTime.split(':').map(Number);
    const startSeconds = start[0] * 3600 + start[1] * 60 + start[2];
    const endSeconds = end[0] * 3600 + end[1] * 60 + end[2];
    return endSeconds - startSeconds;
  };

  const timeToSeconds = (timeStr) => {
    const parts = timeStr.split(':').map(Number);
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  };

  const getPlayerPresenceData = (regimentName) => {
    if (!selectedRound) return [];
    
    const roundDuration = getRoundDurationSeconds();
    if (roundDuration === 0) return [];

    const regiment = regimentStats.find(r => r.name === regimentName);
    if (!regiment) return [];

    const roundStartSeconds = timeToSeconds(selectedRound.startTime);
    const roundEndSeconds = timeToSeconds(selectedRound.endTime);

    // Get unique players and their death counts
    const playerData = Object.entries(regiment.players).map(([playerName, deathCount]) => {
      let presenceSeconds = 0;

      // Calculate actual presence from join/leave sessions
      const sessions = selectedRound.playerSessions[playerName];
      if (sessions && sessions.length > 0) {
        sessions.forEach(session => {
          const joinTime = timeToSeconds(session.join);
          const leaveTime = session.leave ? timeToSeconds(session.leave) : roundEndSeconds;
          
          // Clamp to round boundaries
          const effectiveJoin = Math.max(joinTime, roundStartSeconds);
          const effectiveLeave = Math.min(leaveTime, roundEndSeconds);
          
          if (effectiveLeave > effectiveJoin) {
            presenceSeconds += (effectiveLeave - effectiveJoin);
          }
        });
      } else {
        // If no session data, assume they were present the whole round
        presenceSeconds = roundDuration;
      }
      
      const presencePercentage = Math.min(100, Math.round((presenceSeconds / roundDuration) * 100));
      
      return {
        name: playerName,
        deaths: deathCount,
        presence: presencePercentage
      };
    });

    // Sort by death count (high to low)
    return playerData.sort((a, b) => b.deaths - a.deaths);
  };

  const openEditor = () => {
    setShowEditor(true);
  };

  const closeEditor = () => {
    setShowEditor(false);
    setEditingPlayer(null);
    setNewRegiment('');
    setPendingEdits({});
    setExpandedRegiments({});
    setEditingRegiment(null);
    setNewRegimentName('');
  };

  const startEditPlayer = (playerName, currentRegiment) => {
    setEditingPlayer(playerName);
    // Check if there's a pending edit for this player, otherwise use current regiment
    const pendingRegiment = pendingEdits[playerName];
    setNewRegiment(pendingRegiment || currentRegiment);
  };

  const updateSmartMatchPlayer = (matchIndex, playerIndex, newRegimentValue) => {
    const updatedPreview = [...smartMatchPreview];
    const match = updatedPreview[matchIndex];
    
    // Update the specific player's target regiment
    if (!match.playerOverrides) {
      match.playerOverrides = {};
    }
    match.playerOverrides[match.players[playerIndex]] = newRegimentValue;
    
    setSmartMatchPreview(updatedPreview);
  };

  const savePlayerEdit = () => {
    if (!editingPlayer || !newRegiment || !selectedRound) return;

    const roundKey = `round_${selectedRound.id}`;
    const currentAssignments = { ...playerAssignments[roundKey] } || {};
    currentAssignments[editingPlayer] = newRegiment;

    setPlayerAssignments({
      ...playerAssignments,
      [roundKey]: currentAssignments
    });

    // Clear this player from pending edits
    const updatedPending = { ...pendingEdits };
    delete updatedPending[editingPlayer];
    setPendingEdits(updatedPending);

    setEditingPlayer(null);
    setNewRegiment('');

    // Refresh stats
    analyzeRound(selectedRound, currentAssignments);
  };

  const updatePendingEdit = (playerName, regiment) => {
    setPendingEdits({
      ...pendingEdits,
      [playerName]: regiment
    });
  };

  const saveAllEdits = () => {
    if (!selectedRound || Object.keys(pendingEdits).length === 0) return;

    const roundKey = `round_${selectedRound.id}`;
    const currentAssignments = { ...playerAssignments[roundKey] } || {};
    
    // Apply all pending edits
    Object.entries(pendingEdits).forEach(([playerName, regiment]) => {
      currentAssignments[playerName] = regiment;
    });

    setPlayerAssignments({
      ...playerAssignments,
      [roundKey]: currentAssignments
    });

    // Clear pending edits and editing state
    setPendingEdits({});
    setEditingPlayer(null);
    setNewRegiment('');

    // Refresh stats
    analyzeRound(selectedRound, currentAssignments);

    alert(`Saved ${Object.keys(pendingEdits).length} player assignment(s)!`);
  };

  const getPlayerRegiment = (playerName) => {
    if (!selectedRound) return normalizeRegimentTag(extractRegimentTag(playerName));
    const roundKey = `round_${selectedRound.id}`;
    const assigned = playerAssignments[roundKey]?.[playerName];
    return assigned ? normalizeRegimentTag(assigned) : normalizeRegimentTag(extractRegimentTag(playerName));
  };

  const getAllPlayers = () => {
    if (!selectedRound) return [];
    
    const playerMap = {};
    selectedRound.kills.forEach(death => {
      const baseRegiment = getPlayerRegiment(death.player);
      if (!playerMap[death.player]) {
        playerMap[death.player] = {
          name: death.player,
          regiment: baseRegiment,
          displayRegiment: pendingEdits[death.player] || baseRegiment,
          deaths: 0
        };
      }
      playerMap[death.player].deaths++;
    });

    return Object.values(playerMap).sort((a, b) =>
      a.regiment.localeCompare(b.regiment) || b.deaths - a.deaths
    );
  };

  const getPlayersByRegiment = () => {
    const players = getAllPlayers();
    const regimentMap = {};
    
    players.forEach(player => {
      const regiment = player.displayRegiment;
      if (!regimentMap[regiment]) {
        regimentMap[regiment] = [];
      }
      regimentMap[regiment].push(player);
    });
    
    return Object.entries(regimentMap)
      .map(([name, players]) => ({
        name,
        players,
        playerCount: players.length
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  const toggleRegiment = (regimentName) => {
    setExpandedRegiments(prev => ({
      ...prev,
      [regimentName]: !prev[regimentName]
    }));
  };

  const transferRegiment = (fromRegiment, toRegiment) => {
    if (!selectedRound || fromRegiment === toRegiment) return;
    
    const players = getAllPlayers().filter(p => p.displayRegiment === fromRegiment);
    const newPendingEdits = { ...pendingEdits };
    
    players.forEach(player => {
      newPendingEdits[player.name] = toRegiment;
    });
    
    setPendingEdits(newPendingEdits);
  };

  const renameRegiment = (oldName, newName) => {
    if (!selectedRound || !newName || oldName === newName) return;
    
    const players = getAllPlayers().filter(p => p.displayRegiment === oldName);
    const newPendingEdits = { ...pendingEdits };
    
    players.forEach(player => {
      newPendingEdits[player.name] = newName;
    });
    
    setPendingEdits(newPendingEdits);
    setEditingRegiment(null);
    setNewRegimentName('');
  };

  const deleteRegiment = (regimentName) => {
    if (!selectedRound || regimentName === 'UNTAGGED') return;
    
    if (!confirm(`Delete regiment "${regimentName}" and move all players to UNTAGGED?`)) {
      return;
    }
    
    transferRegiment(regimentName, 'UNTAGGED');
  };

  // Helper function to format seconds as HH:MM:SS
  const formatTimeHHMMSS = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Get regiment losses over time for timeline graph
  const getRegimentLossesOverTime = () => {
    if (!selectedRound) return { buckets: [], regiments: [], bucketSeconds: [] };
    
    const roundKey = `round_${selectedRound.id}`;
    const assignments = playerAssignments[roundKey] || {};
    const roundDurationSeconds = getRoundDurationSeconds();
    
    if (roundDurationSeconds === 0) return { buckets: [], regiments: [], bucketSeconds: [] };
    
    // Create time buckets (every 1 min for granular data)
    const bucketSize = 60; // 60 seconds
    const numBuckets = Math.ceil(roundDurationSeconds / bucketSize);
    
    // Track deaths per regiment per time bucket and player counts
    const regimentTimeline = {};
    const regimentPlayerCounts = {};
    
    selectedRound.kills.forEach((death, index) => {
      const regiment = normalizeRegimentTag(
        assignments[death.player] || extractRegimentTag(death.player)
      );
      
      // Skip UNTAGGED
      if (regiment === 'UNTAGGED') return;
      
      // Track unique players per regiment
      if (!regimentPlayerCounts[regiment]) {
        regimentPlayerCounts[regiment] = new Set();
      }
      regimentPlayerCounts[regiment].add(death.player);
      
      // Estimate death time based on position in kills array
      const estimatedDeathTime = (index / selectedRound.kills.length) * roundDurationSeconds;
      const bucketIndex = Math.floor(estimatedDeathTime / bucketSize);
      
      if (!regimentTimeline[regiment]) {
        regimentTimeline[regiment] = Array(numBuckets).fill(0);
      }
      
      if (bucketIndex < numBuckets) {
        regimentTimeline[regiment][bucketIndex]++;
      }
    });
    
    // Filter regiments with less than 2 players and sort by total deaths
    const filteredRegiments = Object.entries(regimentTimeline)
      .filter(([name]) => regimentPlayerCounts[name] && regimentPlayerCounts[name].size >= 2)
      .map(([name, deaths]) => ({
        name,
        deaths,
        total: deaths.reduce((a, b) => a + b, 0)
      }))
      .sort((a, b) => b.total - a.total);
    
    // Create bucket labels and track actual seconds
    const bucketSeconds = Array.from({ length: numBuckets }, (_, i) => i * bucketSize);
    const buckets = bucketSeconds.map(seconds => formatTimeHHMMSS(seconds));
    
    return {
      buckets,
      regiments: filteredRegiments,
      bucketSeconds
    };
  };

  // Get highest loss rates (deaths per player)
  const getHighestLossRates = (showAll = false) => {
    if (!regimentStats.length) return [];
    
    const filtered = regimentStats
      .filter(regiment => {
        const playerCount = Object.keys(regiment.players).length;
        return regiment.name !== 'UNTAGGED' && playerCount >= 2;
      })
      .map(regiment => {
        const playerCount = Object.keys(regiment.players).length;
        const lossRate = playerCount > 0 ? (regiment.casualties / playerCount).toFixed(2) : 0;
        return {
          name: regiment.name,
          casualties: regiment.casualties,
          playerCount,
          lossRate: parseFloat(lossRate)
        };
      })
      .sort((a, b) => b.lossRate - a.lossRate);
    
    return showAll ? filtered : filtered.slice(0, 10);
  };

  // Get top 10 individual death counts
  const getTopIndividualDeaths = () => {
    if (!selectedRound) return [];
    
    const roundKey = `round_${selectedRound.id}`;
    const assignments = playerAssignments[roundKey] || {};
    const playerDeaths = {};
    
    selectedRound.kills.forEach(death => {
      const regiment = normalizeRegimentTag(
        assignments[death.player] || extractRegimentTag(death.player)
      );
      
      if (!playerDeaths[death.player]) {
        playerDeaths[death.player] = {
          name: death.player,
          regiment,
          deaths: 0
        };
      }
      playerDeaths[death.player].deaths++;
    });
    
    return Object.values(playerDeaths)
      .sort((a, b) => b.deaths - a.deaths)
      .slice(0, 10);
  };

  // Get time in combat per regiment (based on first and last death)
  const getTimeInCombat = (showAll = false) => {
    if (!selectedRound || !regimentStats.length) return [];
    
    const roundKey = `round_${selectedRound.id}`;
    const assignments = playerAssignments[roundKey] || {};
    const roundDurationSeconds = getRoundDurationSeconds();
    
    if (roundDurationSeconds === 0) return [];
    
    const regimentCombatTime = {};
    const regimentPlayerCounts = {};
    const regimentDeathTimes = {}; // Track all death times per regiment
    
    selectedRound.kills.forEach((death, index) => {
      const regiment = normalizeRegimentTag(
        assignments[death.player] || extractRegimentTag(death.player)
      );
      
      // Skip UNTAGGED
      if (regiment === 'UNTAGGED') return;
      
      // Estimate death time based on position
      const estimatedDeathTime = (index / selectedRound.kills.length) * roundDurationSeconds;
      
      // Skip deaths in first 1 minute for combat calculations
      if (estimatedDeathTime < 60) return;
      
      // Track unique players per regiment
      if (!regimentPlayerCounts[regiment]) {
        regimentPlayerCounts[regiment] = new Set();
      }
      regimentPlayerCounts[regiment].add(death.player);
      
      // Track death times for average combat duration calculation
      if (!regimentDeathTimes[regiment]) {
        regimentDeathTimes[regiment] = [];
      }
      regimentDeathTimes[regiment].push(estimatedDeathTime);
      
      if (!regimentCombatTime[regiment]) {
        regimentCombatTime[regiment] = {
          name: regiment,
          firstDeath: estimatedDeathTime,
          lastDeath: estimatedDeathTime,
          totalDeaths: 0
        };
      }
      
      regimentCombatTime[regiment].firstDeath = Math.min(
        regimentCombatTime[regiment].firstDeath,
        estimatedDeathTime
      );
      regimentCombatTime[regiment].lastDeath = Math.max(
        regimentCombatTime[regiment].lastDeath,
        estimatedDeathTime
      );
      regimentCombatTime[regiment].totalDeaths++;
    });
    
    const sorted = Object.values(regimentCombatTime)
      .filter(reg => regimentPlayerCounts[reg.name] && regimentPlayerCounts[reg.name].size >= 2)
      .map(reg => {
        // Calculate average combat duration (active combat periods)
        // Group deaths into combat periods - deaths within 60 seconds are considered same combat period
        const deathTimes = regimentDeathTimes[reg.name].sort((a, b) => a - b);
        const combatPeriods = [];
        let currentPeriod = null;
        const combatGapThreshold = 60; // 60 seconds gap = new combat period
        
        deathTimes.forEach(deathTime => {
          if (!currentPeriod) {
            currentPeriod = { start: deathTime, end: deathTime };
          } else if (deathTime - currentPeriod.end <= combatGapThreshold) {
            // Extend current combat period
            currentPeriod.end = deathTime;
          } else {
            // Start new combat period
            combatPeriods.push(currentPeriod);
            currentPeriod = { start: deathTime, end: deathTime };
          }
        });
        
        // Don't forget the last period
        if (currentPeriod) {
          combatPeriods.push(currentPeriod);
        }
        
        // Calculate total active combat time and average
        const totalActiveCombatTime = combatPeriods.reduce((sum, period) => {
          return sum + (period.end - period.start);
        }, 0);
        
        const avgCombatDuration = combatPeriods.length > 0
          ? totalActiveCombatTime / combatPeriods.length
          : 0;
        
        return {
          ...reg,
          combatDuration: reg.lastDeath - reg.firstDeath,
          combatDurationFormatted: formatSeconds(reg.lastDeath - reg.firstDeath),
          firstDeathFormatted: formatSeconds(reg.firstDeath),
          lastDeathFormatted: formatSeconds(reg.lastDeath),
          avgCombatDuration: avgCombatDuration,
          avgCombatDurationFormatted: formatSeconds(avgCombatDuration),
          combatPeriods: combatPeriods.length
        };
      })
      .sort((a, b) => b.combatDuration - a.combatDuration);
    
    return showAll ? sorted : sorted.slice(0, 10);
  };

  const formatSeconds = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  const exportRegimentCasualtiesCSV = () => {
    if (!regimentStats.length || !selectedRound) return;

    const csvRows = [
      ['Regiment Name', 'Casualties', 'Player Count'],
      ...regimentStats.map(regiment => [
        regiment.name,
        regiment.casualties,
        Object.keys(regiment.players).length
      ])
    ];

    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `round_${selectedRound.id}_casualties.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Warning Modal */}
        {showWarning && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-lg shadow-2xl border-2 border-amber-500 max-w-2xl w-full p-6">
              <div className="flex items-start gap-4 mb-4">
                <AlertTriangle className="w-8 h-8 text-amber-500 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-amber-400 mb-3">Important Notice</h2>
                  <p className="text-slate-200 text-lg leading-relaxed">
                    You may need to transfer members of regiments from the <span className="font-semibold text-amber-400">UNTAGGED</span> group,
                    and transfer merc regiments into main regiment lists when you select a round to view.
                    Use the <span className="font-semibold text-blue-400">'Edit Players'</span> button to do this or you may have inaccurate data!
                  </p>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => setShowWarning(false)}
                  className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition font-semibold"
                >
                  Got it!
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-slate-800 rounded-lg shadow-2xl border border-slate-700 p-8">
          <h1 className="text-4xl font-bold text-amber-400 mb-2 flex items-center gap-3">
            <Users className="w-10 h-10" />
            War of Rights Log Analyzer
          </h1>
          <p className="text-slate-400 mb-6">Analyze rounds and regiment casualties from game logs</p>

          {/* File Upload */}
          <div className="mb-8">
            <label className="flex items-center justify-center w-full h-32 px-4 transition bg-slate-700 border-2 border-slate-600 border-dashed rounded-lg hover:bg-slate-600 hover:border-amber-500 cursor-pointer">
              <div className="flex flex-col items-center space-y-2">
                <Upload className="w-8 h-8 text-amber-400" />
                <span className="text-slate-300 font-medium">
                  Click to upload log file
                </span>
                <span className="text-slate-500 text-sm">
                  .txt or .log files
                </span>
              </div>
              <input
                type="file"
                className="hidden"
                accept=".txt,.log"
                onChange={handleFileUpload}
              />
            </label>
          </div>

          {/* Rounds List */}
          {rounds.length > 0 && !showEditor && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-slate-700 rounded-lg p-6">
                <h2 className="text-2xl font-bold text-amber-400 mb-4 flex items-center gap-2">
                  <Clock className="w-6 h-6" />
                  Rounds ({rounds.length})
                </h2>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {rounds.map((round) => (
                    <button
                      key={round.id}
                      onClick={() => handleRoundSelect(round)}
                      className={`w-full text-left p-4 rounded-lg transition ${
                        selectedRound?.id === round.id
                          ? 'bg-amber-600 text-white'
                          : 'bg-slate-600 text-slate-200 hover:bg-slate-500'
                      }`}
                    >
                      <div className="font-semibold">Round {round.id}</div>
                      <div className="text-sm opacity-90">
                        {round.startTime} - {round.endTime}
                      </div>
                      {round.duration && (
                        <div className="text-sm opacity-75">
                          Duration: {round.duration}
                        </div>
                      )}
                      <div className="text-sm opacity-75">
                        {round.kills.length} casualties
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Regiment Statistics */}
              <div className="bg-slate-700 rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
                    <Skull className="w-6 h-6" />
                    Regiment Casualties
                  </h2>
                  {selectedRound && (
                    <div className="flex gap-2">
                      <button
                        onClick={exportRegimentCasualtiesCSV}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition"
                        title="Export as CSV"
                      >
                        <Download className="w-4 h-4" />
                        Export CSV
                      </button>
                      <button
                        onClick={generateSmartMatchPreview}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition"
                      >
                        <Zap className="w-4 h-4" />
                        Smart Match
                      </button>
                      <button
                        onClick={openEditor}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit Players
                      </button>
                    </div>
                  )}
                </div>
                {selectedRound ? (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {regimentStats.length > 0 ? (
                      regimentStats.map((regiment, index) => (
                        <div key={regiment.name} className="bg-slate-600 rounded-lg overflow-hidden">
                          <button
                            onClick={() => handleRegimentClick(regiment)}
                            className="w-full p-4 text-left hover:bg-slate-500 transition"
                          >
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-bold text-lg text-amber-400">
                                {index + 1}. {regiment.name}
                              </span>
                              <span className="text-slate-400 text-sm">
                                {selectedRegiment?.name === regiment.name ? '▼' : '▶'}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-slate-400">Deaths:</span>
                                <span className="text-red-400 font-semibold ml-2">
                                  {regiment.casualties}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-400">Players:</span>
                                <span className="text-blue-400 font-semibold ml-2">
                                  {new Set(regiment.deaths).size}
                                </span>
                              </div>
                            </div>
                          </button>
                          
                          {selectedRegiment?.name === regiment.name && (
                            <div className="bg-slate-700 p-4 border-t border-slate-500">
                              <h3 className="text-sm font-semibold text-amber-300 mb-3">Individual Players</h3>
                              <div className="space-y-2">
                                {getPlayerPresenceData(regiment.name).map((player) => (
                                  <div key={player.name} className="bg-slate-600 rounded p-3">
                                    <div className="flex justify-between items-start mb-2">
                                      <span className="text-white text-sm font-medium flex-1 mr-2">
                                        {player.name}
                                      </span>
                                      <span className="text-red-400 font-semibold text-sm whitespace-nowrap">
                                        {player.deaths} {player.deaths === 1 ? 'death' : 'deaths'}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <div className="flex-1 bg-slate-800 rounded-full h-2 overflow-hidden">
                                        <div
                                          className="bg-gradient-to-r from-green-500 to-emerald-400 h-full rounded-full transition-all"
                                          style={{ width: `${player.presence}%` }}
                                        />
                                      </div>
                                      <span className="text-emerald-400 text-xs font-semibold whitespace-nowrap">
                                        {player.presence}%
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-400 text-center py-8">
                        No casualties recorded in this round
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-slate-400 text-center py-8">
                    Select a round to view statistics
                  </p>
                )}
              </div>
            </div>
          )}

          {/* New Analytics Section */}
          {selectedRound && !showEditor && !showSmartMatchPreview && (
            <div className="mt-6 space-y-6">
              {/* Timeline Graph */}
              <div className="bg-slate-700 rounded-lg p-6">
                <h2 className="text-2xl font-bold text-amber-400 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-6 h-6" />
                  Regiment Losses Over Time
                </h2>
                {(() => {
                  const timelineData = getRegimentLossesOverTime();
                  if (timelineData.regiments.length === 0) {
                    return <p className="text-slate-400 text-center py-8">No timeline data available</p>;
                  }
                  
                  const colors = [
                    { line: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },  // red
                    { line: '#f97316', bg: 'rgba(249, 115, 22, 0.1)' }, // orange
                    { line: '#eab308', bg: 'rgba(234, 179, 8, 0.1)' },  // yellow
                    { line: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)' },  // green
                    { line: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' }, // blue
                    { line: '#a855f7', bg: 'rgba(168, 85, 247, 0.1)' }, // purple
                    { line: '#ec4899', bg: 'rgba(236, 72, 153, 0.1)' }, // pink
                    { line: '#06b6d4', bg: 'rgba(6, 182, 212, 0.1)' },  // cyan
                    { line: '#84cc16', bg: 'rgba(132, 204, 22, 0.1)' }, // lime
                    { line: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' }, // amber
                  ];
                  
                  const graphHeight = 300;
                  
                  // Calculate start and end indices based on range sliders
                  const startIndex = Math.floor((timeRangeStart / 100) * timelineData.buckets.length);
                  const endIndex = Math.ceil((timeRangeEnd / 100) * timelineData.buckets.length);
                  
                  // Get the selected range of data
                  const selectedRange = {
                    start: startIndex,
                    end: endIndex,
                    buckets: timelineData.buckets.slice(startIndex, endIndex),
                    bucketSeconds: timelineData.bucketSeconds.slice(startIndex, endIndex)
                  };
                  
                  // Calculate deaths in the selected range
                  const regimentsInRange = timelineData.regiments.map(regiment => {
                    const deathsInRange = regiment.deaths.slice(startIndex, endIndex);
                    return {
                      ...regiment,
                      deathsInRange,
                      totalInRange: deathsInRange.reduce((a, b) => a + b, 0)
                    };
                  });
                  
                  // Calculate max deaths in the visible range for proper scaling
                  const maxDeathsInRange = Math.max(
                    1, // Minimum of 1 to avoid division by zero
                    ...regimentsInRange.flatMap(r => r.deathsInRange)
                  );
                  
                  return (
                    <div className="space-y-4">
                      {/* Time Range Slider */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <label className="text-white text-sm font-medium">
                            Time Range: {timelineData.buckets[startIndex] || '0m'} - {timelineData.buckets[Math.min(endIndex - 1, timelineData.buckets.length - 1)] || '0m'}
                          </label>
                          <button
                            onClick={() => {
                              setTimeRangeStart(0);
                              setTimeRangeEnd(100);
                            }}
                            className="text-xs text-amber-400 hover:text-amber-300 transition"
                          >
                            Reset Range
                          </button>
                        </div>
                        
                        {/* Custom Range Slider */}
                        <div className="relative h-8 flex items-center">
                          {/* Track background */}
                          <div className="absolute w-full h-2 bg-slate-600 rounded-lg" />
                          
                          {/* Active range */}
                          <div
                            className="absolute h-2 bg-green-500 rounded-lg"
                            style={{
                              left: `${timeRangeStart}%`,
                              width: `${timeRangeEnd - timeRangeStart}%`
                            }}
                          />
                          
                          {/* Start handle */}
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={timeRangeStart}
                            onChange={(e) => {
                              const newStart = Number(e.target.value);
                              if (newStart < timeRangeEnd - 1) {
                                setTimeRangeStart(newStart);
                              }
                            }}
                            className="absolute w-full appearance-none bg-transparent pointer-events-none"
                            style={{
                              zIndex: timeRangeStart > 50 ? 5 : 4
                            }}
                          />
                          
                          {/* End handle */}
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={timeRangeEnd}
                            onChange={(e) => {
                              const newEnd = Number(e.target.value);
                              if (newEnd > timeRangeStart + 1) {
                                setTimeRangeEnd(newEnd);
                              }
                            }}
                            className="absolute w-full appearance-none bg-transparent pointer-events-none"
                            style={{
                              zIndex: timeRangeEnd <= 50 ? 5 : 4
                            }}
                          />
                          
                          {/* Custom thumb styling */}
                          <style>{`
                            input[type="range"]::-webkit-slider-thumb {
                              appearance: none;
                              width: 20px;
                              height: 20px;
                              border-radius: 50%;
                              background: #22c55e;
                              cursor: pointer;
                              pointer-events: all;
                              border: 3px solid #1e293b;
                              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                            }
                            input[type="range"]::-webkit-slider-thumb:hover {
                              background: #16a34a;
                              transform: scale(1.1);
                            }
                            input[type="range"]::-moz-range-thumb {
                              width: 20px;
                              height: 20px;
                              border-radius: 50%;
                              background: #22c55e;
                              cursor: pointer;
                              pointer-events: all;
                              border: 3px solid #1e293b;
                              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                            }
                            input[type="range"]::-moz-range-thumb:hover {
                              background: #16a34a;
                              transform: scale(1.1);
                            }
                          `}</style>
                        </div>
                        
                        {/* Time labels */}
                        <div className="flex justify-between text-xs text-slate-400 px-1">
                          <span>Start: {timelineData.buckets[startIndex] || '0m'}</span>
                          <span>End: {timelineData.buckets[Math.min(endIndex - 1, timelineData.buckets.length - 1)] || '0m'}</span>
                        </div>
                      </div>
                      
                      {/* Legend */}
                      <div className="flex flex-wrap gap-3">
                        {regimentsInRange.map((regiment, idx) => {
                          const isActive = pinnedRegiment === regiment.name || hoveredRegiment === regiment.name;
                          const shouldDim = (pinnedRegiment !== null && pinnedRegiment !== regiment.name) ||
                                          (pinnedRegiment === null && hoveredRegiment !== null && hoveredRegiment !== regiment.name);
                          
                          return (
                            <div
                              key={regiment.name}
                              className="flex items-center gap-2 cursor-pointer transition-all hover:scale-105"
                              onMouseEnter={() => setHoveredRegiment(regiment.name)}
                              onMouseLeave={() => setHoveredRegiment(null)}
                              onClick={() => setPinnedRegiment(pinnedRegiment === regiment.name ? null : regiment.name)}
                              style={{
                                opacity: shouldDim ? 0.3 : 1
                              }}
                            >
                              <div
                                className="w-4 h-4 rounded transition-all"
                                style={{
                                  backgroundColor: colors[idx % colors.length].line,
                                  boxShadow: isActive ? `0 0 8px ${colors[idx % colors.length].line}` : 'none',
                                  border: pinnedRegiment === regiment.name ? `2px solid ${colors[idx % colors.length].line}` : 'none'
                                }}
                              />
                              <span className={`text-sm font-medium transition-colors ${
                                pinnedRegiment === regiment.name ? 'text-amber-400' : 'text-white'
                              }`}>
                                {regiment.name} ({regiment.totalInRange})
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      
                      {/* Line Graph */}
                      <div className="relative bg-slate-800 rounded-lg p-4" style={{ height: `${graphHeight}px` }}>
                        <svg
                          ref={svgRef}
                          width="100%"
                          height="100%"
                          viewBox={`0 0 1000 ${graphHeight}`}
                          preserveAspectRatio="none"
                          className="overflow-visible"
                          onMouseMove={(e) => {
                            if (!svgRef.current) return;
                            const rect = svgRef.current.getBoundingClientRect();
                            const x = e.clientX - rect.left;
                            const xPercent = x / rect.width;
                            const bucketIndex = Math.floor(xPercent * selectedRange.buckets.length);
                            
                            if (bucketIndex >= 0 && bucketIndex < selectedRange.buckets.length) {
                              const timestamp = selectedRange.buckets[bucketIndex];
                              const activeRegiment = pinnedRegiment || hoveredRegiment;
                              const regimentData = regimentsInRange.map((reg, idx) => ({
                                name: reg.name,
                                deaths: reg.deathsInRange[bucketIndex] || 0,
                                color: colors[idx % colors.length].line,
                                isHighlighted: activeRegiment === reg.name
                              })).filter(r => r.deaths > 0);
                              
                              setHoverInfo({
                                timestamp,
                                regiments: regimentData,
                                x: e.clientX - rect.left,
                                y: e.clientY - rect.top
                              });
                            }
                          }}
                          onMouseLeave={() => setHoverInfo(null)}
                        >
                          {/* Grid lines */}
                          {[0, 0.25, 0.5, 0.75, 1].map((fraction, i) => (
                            <line
                              key={i}
                              x1="0"
                              y1={graphHeight - (fraction * graphHeight)}
                              x2="1000"
                              y2={graphHeight - (fraction * graphHeight)}
                              stroke="#475569"
                              strokeWidth="1"
                              strokeDasharray="4"
                            />
                          ))}
                          
                          {/* Lines for each regiment */}
                          {regimentsInRange.map((regiment, regIndex) => {
                            const activeRegiment = pinnedRegiment || hoveredRegiment;
                            const isHighlighted = activeRegiment === null || activeRegiment === regiment.name;
                            const opacity = isHighlighted ? 1 : 0.15;
                            const strokeWidth = isHighlighted ? (activeRegiment === regiment.name ? 4 : 3) : 2;
                            
                            // Show only data in the selected range, rescaled to fill the view
                            const points = regiment.deathsInRange.map((count, bucketIndex) => {
                              const x = (bucketIndex / Math.max(1, regiment.deathsInRange.length - 1)) * 1000;
                              const y = graphHeight - ((count / maxDeathsInRange) * (graphHeight - 20));
                              return `${x},${y}`;
                            }).join(' ');
                            
                            return (
                              <g
                                key={regiment.name}
                                onMouseEnter={() => setHoveredRegiment(regiment.name)}
                                onMouseLeave={() => setHoveredRegiment(null)}
                                onClick={() => setPinnedRegiment(pinnedRegiment === regiment.name ? null : regiment.name)}
                                style={{ cursor: 'pointer' }}
                              >
                                {/* Line */}
                                <polyline
                                  points={points}
                                  fill="none"
                                  stroke={colors[regIndex % colors.length].line}
                                  strokeWidth={strokeWidth}
                                  strokeLinejoin="round"
                                  strokeLinecap="round"
                                  opacity={opacity}
                                  className="transition-all duration-200"
                                />
                                {/* Data points */}
                                {regiment.deathsInRange.map((count, bucketIndex) => {
                                  const x = (bucketIndex / Math.max(1, regiment.deathsInRange.length - 1)) * 1000;
                                  const y = graphHeight - ((count / maxDeathsInRange) * (graphHeight - 20));
                                  return (
                                    <circle
                                      key={bucketIndex}
                                      cx={x}
                                      cy={y}
                                      r={isHighlighted ? (hoveredRegiment === regiment.name ? 5 : 4) : 3}
                                      fill={colors[regIndex % colors.length].line}
                                      opacity={opacity}
                                      className="transition-all duration-200"
                                    />
                                  );
                                })}
                              </g>
                            );
                          })}
                        </svg>
                        
                        {/* Hover tooltip */}
                        {hoverInfo && (
                          <div
                            className="absolute bg-slate-900 border border-amber-500 rounded-lg p-3 pointer-events-none z-10 shadow-xl"
                            style={{
                              left: `${hoverInfo.x + 10}px`,
                              top: `${hoverInfo.y - 10}px`,
                              transform: hoverInfo.x > 500 ? 'translateX(-100%) translateX(-20px)' : 'none'
                            }}
                          >
                            <div className="text-amber-400 font-bold mb-2 text-sm">
                              {hoverInfo.timestamp}
                            </div>
                            {hoverInfo.regiments.length > 0 ? (
                              <div className="space-y-1">
                                {hoverInfo.regiments.map((reg) => {
                                  const activeRegiment = pinnedRegiment || hoveredRegiment;
                                  return (
                                    <div
                                      key={reg.name}
                                      className={`flex items-center gap-2 text-xs transition-all ${
                                        reg.isHighlighted ? 'scale-110' : activeRegiment !== null ? 'opacity-40' : ''
                                      }`}
                                    >
                                    <div
                                      className="w-3 h-3 rounded transition-all"
                                      style={{
                                        backgroundColor: reg.color,
                                        boxShadow: reg.isHighlighted ? `0 0 8px ${reg.color}` : 'none'
                                      }}
                                    />
                                    <span className={`font-medium ${reg.isHighlighted ? 'text-amber-400' : 'text-white'}`}>
                                      {reg.name}:
                                    </span>
                                    <span className={`font-bold ${reg.isHighlighted ? 'text-amber-400' : 'text-red-400'}`}>
                                      {reg.deaths}
                                    </span>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-slate-400 text-xs">No deaths at this time</div>
                            )}
                          </div>
                        )}
                        
                        {/* Y-axis labels - scaled to visible range */}
                        <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-xs text-slate-400 pr-2">
                          <span>{maxDeathsInRange}</span>
                          <span>{Math.floor(maxDeathsInRange * 0.75)}</span>
                          <span>{Math.floor(maxDeathsInRange * 0.5)}</span>
                          <span>{Math.floor(maxDeathsInRange * 0.25)}</span>
                          <span>0</span>
                        </div>
                      </div>
                      
                      {/* X-axis labels - only show selected range with HH:MM:SS format */}
                      <div className="flex justify-between text-xs text-slate-400 px-4">
                        {selectedRange.buckets.map((label, i) => {
                          const showEvery = Math.max(1, Math.ceil(selectedRange.buckets.length / 10));
                          return i % showEvery === 0 ? (
                            <span key={i} className="font-mono">{label}</span>
                          ) : null;
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Two Column Layout for Tables */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Highest Loss Rates */}
                <div className="bg-slate-700 rounded-lg p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
                      <BarChart3 className="w-6 h-6" />
                      Highest Loss Rates
                    </h2>
                    <button
                      onClick={() => setShowAllLossRates(!showAllLossRates)}
                      className="px-3 py-1 bg-slate-600 hover:bg-slate-500 text-white rounded text-sm transition"
                    >
                      {showAllLossRates ? 'Top 10' : 'Show All'}
                    </button>
                  </div>
                  <div className="space-y-2">
                    {getHighestLossRates(showAllLossRates).map((regiment, index) => (
                      <div key={regiment.name} className="bg-slate-600 rounded-lg p-3">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-white font-semibold">
                            {index + 1}. {regiment.name}
                          </span>
                          <span className="text-red-400 font-bold text-lg">
                            {regiment.lossRate}
                          </span>
                        </div>
                        <div className="text-sm text-slate-400">
                          {regiment.casualties} deaths / {regiment.playerCount} players
                        </div>
                        <div className="mt-2 bg-slate-800 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-red-500 to-orange-500 h-full rounded-full"
                            style={{ width: `${Math.min(100, (regiment.lossRate / 10) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top Individual Deaths */}
                <div className="bg-slate-700 rounded-lg p-6">
                  <h2 className="text-2xl font-bold text-amber-400 mb-4 flex items-center gap-2">
                    <Award className="w-6 h-6" />
                    Top 10 Individual Deaths
                  </h2>
                  <div className="space-y-2">
                    {getTopIndividualDeaths().map((player, index) => (
                      <div key={player.name} className="bg-slate-600 rounded-lg p-3">
                        <div className="flex justify-between items-center">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-amber-400 font-bold text-lg">
                                #{index + 1}
                              </span>
                              <span className="text-white font-medium truncate">
                                {player.name}
                              </span>
                            </div>
                            <div className="text-xs text-slate-400 mt-1">
                              {player.regiment}
                            </div>
                          </div>
                          <div className="text-right ml-2">
                            <div className="text-red-400 font-bold text-xl">
                              {player.deaths}
                            </div>
                            <div className="text-xs text-slate-400">deaths</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Time in Combat Table */}
              <div className="bg-slate-700 rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
                    <Timer className="w-6 h-6" />
                    Time in Combat (Per Regiment)
                  </h2>
                  <button
                    onClick={() => setShowAllTimeInCombat(!showAllTimeInCombat)}
                    className="px-3 py-1 bg-slate-600 hover:bg-slate-500 text-white rounded text-sm transition"
                  >
                    {showAllTimeInCombat ? 'Top 10' : 'Show All'}
                  </button>
                </div>
                <div className="mb-3 text-sm text-slate-400">
                  <p>Combat periods are calculated by grouping deaths within 60 seconds. Excludes first 1 Minute of round.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-600">
                        <th className="text-left py-3 px-4 text-slate-300 font-semibold">Rank</th>
                        <th className="text-left py-3 px-4 text-slate-300 font-semibold">Regiment</th>
                        <th className="text-left py-3 px-4 text-slate-300 font-semibold">Combat Duration</th>
                        <th className="text-left py-3 px-4 text-slate-300 font-semibold">Avg Combat Duration</th>
                        <th className="text-left py-3 px-4 text-slate-300 font-semibold">Combat Periods</th>
                        <th className="text-left py-3 px-4 text-slate-300 font-semibold">First Death</th>
                        <th className="text-left py-3 px-4 text-slate-300 font-semibold">Last Death</th>
                        <th className="text-left py-3 px-4 text-slate-300 font-semibold">Total Deaths</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getTimeInCombat(showAllTimeInCombat).map((regiment, index) => (
                        <tr key={regiment.name} className="border-b border-slate-600 hover:bg-slate-600 transition">
                          <td className="py-3 px-4 text-amber-400 font-bold">{index + 1}</td>
                          <td className="py-3 px-4 text-white font-semibold">{regiment.name}</td>
                          <td className="py-3 px-4 text-green-400 font-semibold">
                            {regiment.combatDurationFormatted}
                          </td>
                          <td className="py-3 px-4 text-cyan-400 font-semibold">
                            {regiment.avgCombatDurationFormatted}
                          </td>
                          <td className="py-3 px-4 text-purple-400 font-semibold">{regiment.combatPeriods}</td>
                          <td className="py-3 px-4 text-slate-300">{regiment.firstDeathFormatted}</td>
                          <td className="py-3 px-4 text-slate-300">{regiment.lastDeathFormatted}</td>
                          <td className="py-3 px-4 text-red-400 font-semibold">{regiment.totalDeaths}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Smart Match Preview Modal */}
          {showSmartMatchPreview && smartMatchPreview && (
            <div className="bg-slate-700 rounded-lg p-6 mb-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
                  <Zap className="w-6 h-6" />
                  Smart Match Preview - {smartMatchPreview.length} Match{smartMatchPreview.length !== 1 ? 'es' : ''} Found
                </h2>
                <button
                  onClick={cancelSmartMatch}
                  className="p-2 bg-slate-600 hover:bg-slate-500 rounded-lg transition"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>

              <div className="mb-6 bg-slate-600 rounded-lg p-4">
                <p className="text-slate-300 text-sm">
                  Showing players in 1-person regiments or UNTAGGED that have any regiment tag in their name.
                  Review and confirm matches below.
                </p>
              </div>

              {smartMatchPreview.length > 0 ? (
                <>
                  <div className="space-y-4 max-h-[500px] overflow-y-auto mb-6">
                    {smartMatchPreview.map((match, matchIndex) => (
                      <div key={matchIndex} className="bg-slate-600 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="px-3 py-1 bg-red-600 text-white rounded font-semibold">
                            {match.fromRegiment}
                          </span>
                          <span className="text-slate-400">→</span>
                          <span className="px-3 py-1 bg-green-600 text-white rounded font-semibold">
                            {match.toRegiment}
                          </span>
                          <span className="text-slate-400 text-sm ml-auto">
                            {match.similarity}% match
                          </span>
                        </div>
                        <div className="space-y-2">
                          {match.players.map((player, playerIndex) => (
                            <div key={player} className="flex items-center gap-2 bg-slate-700 rounded p-2">
                              <span className="text-white flex-1 text-sm">{player}</span>
                              <select
                                value={match.playerOverrides?.[player] || match.toRegiment}
                                onChange={(e) => updateSmartMatchPlayer(matchIndex, playerIndex, e.target.value)}
                                className="px-2 py-1 bg-slate-800 text-white rounded border border-slate-500 focus:border-amber-500 outline-none text-sm"
                              >
                                {getAvailableRegiments().map(reg => (
                                  <option key={reg} value={reg}>{reg}</option>
                                ))}
                              </select>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={applySmartMatch}
                      className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition font-semibold"
                    >
                      Apply Changes
                    </button>
                    <button
                      onClick={cancelSmartMatch}
                      className="flex-1 px-4 py-3 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition font-semibold"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-slate-400">
                    No matches found. All players in 1-person regiments or UNTAGGED don't have any regiment tags in their names.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Player Editor Modal */}
          {showEditor && selectedRound && !showSmartMatchPreview && (
            <div className="bg-slate-700 rounded-lg p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
                  <Edit2 className="w-6 h-6" />
                  Edit Player Assignments - Round {selectedRound.id}
                </h2>
                <button
                  onClick={closeEditor}
                  className="p-2 bg-slate-600 hover:bg-slate-500 rounded-lg transition"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>

              <div className="mb-6">
                <button
                  onClick={generateSmartMatchPreview}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition w-full justify-center"
                >
                  <Zap className="w-4 h-4" />
                  Run Smart Match
                </button>
              </div>

              <div className="space-y-3 max-h-[600px] overflow-y-auto mb-6">
                {getPlayersByRegiment().map((regiment) => (
                  <div key={regiment.name} className="bg-slate-600 rounded-lg overflow-hidden">
                    {/* Regiment Header */}
                    <div className="bg-slate-700 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <button
                          onClick={() => toggleRegiment(regiment.name)}
                          className="flex items-center gap-2 flex-1 text-left hover:text-amber-400 transition"
                        >
                          {expandedRegiments[regiment.name] ? (
                            <ChevronDown className="w-5 h-5 text-amber-400" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-slate-400" />
                          )}
                          <span className="font-bold text-lg text-white">
                            {regiment.name}
                          </span>
                          <span className="text-sm text-slate-400">
                            ({regiment.playerCount} player{regiment.playerCount !== 1 ? 's' : ''})
                          </span>
                        </button>

                        {/* Regiment Controls */}
                        <div className="flex items-center gap-2">
                          {editingRegiment === regiment.name ? (
                            <>
                              <input
                                type="text"
                                value={newRegimentName}
                                onChange={(e) => setNewRegimentName(e.target.value)}
                                placeholder="New name"
                                className="px-3 py-1 bg-slate-800 text-white rounded border border-slate-500 focus:border-amber-500 outline-none text-sm"
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') {
                                    renameRegiment(regiment.name, newRegimentName);
                                  }
                                }}
                              />
                              <button
                                onClick={() => renameRegiment(regiment.name, newRegimentName)}
                                className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm transition"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => {
                                  setEditingRegiment(null);
                                  setNewRegimentName('');
                                }}
                                className="px-3 py-1 bg-slate-600 hover:bg-slate-500 text-white rounded text-sm transition"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  setEditingRegiment(regiment.name);
                                  setNewRegimentName(regiment.name);
                                }}
                                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition flex items-center gap-1"
                                title="Rename regiment"
                              >
                                <Edit2 className="w-3 h-3" />
                                Rename
                              </button>
                              
                              <select
                                onChange={(e) => {
                                  if (e.target.value) {
                                    transferRegiment(regiment.name, e.target.value);
                                    e.target.value = '';
                                  }
                                }}
                                className="px-3 py-1 bg-slate-800 text-white rounded border border-slate-500 focus:border-amber-500 outline-none text-sm"
                                title="Transfer all players to another regiment"
                              >
                                <option value="">Transfer to...</option>
                                {getAvailableRegiments()
                                  .filter(r => r !== regiment.name)
                                  .map(reg => (
                                    <option key={reg} value={reg}>{reg}</option>
                                  ))}
                              </select>

                              {regiment.name !== 'UNTAGGED' && (
                                <button
                                  onClick={() => deleteRegiment(regiment.name)}
                                  className="p-2 bg-red-600 hover:bg-red-700 text-white rounded transition"
                                  title="Delete regiment (moves players to UNTAGGED)"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Players List (Collapsible) */}
                    {expandedRegiments[regiment.name] && (
                      <div className="p-4 space-y-2 bg-slate-600">
                        {regiment.players.map((player) => (
                          <div
                            key={player.name}
                            className="bg-slate-700 rounded-lg p-3 flex justify-between items-center gap-4"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-white truncate text-sm">
                                {player.name}
                              </div>
                              <div className="text-xs text-slate-400">
                                Deaths: {player.deaths}
                              </div>
                            </div>
                            
                            {editingPlayer === player.name ? (
                              <div className="flex items-center gap-2">
                                <select
                                  value={newRegiment}
                                  onChange={(e) => setNewRegiment(e.target.value)}
                                  className="px-3 py-1 bg-slate-800 text-white rounded border border-slate-500 focus:border-amber-500 outline-none text-sm"
                                >
                                  {getAvailableRegiments().map(reg => (
                                    <option key={reg} value={reg}>{reg}</option>
                                  ))}
                                </select>
                                <button
                                  onClick={savePlayerEdit}
                                  className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm transition"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => {
                                    updatePendingEdit(player.name, newRegiment);
                                    setEditingPlayer(null);
                                  }}
                                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition"
                                >
                                  Queue
                                </button>
                                <button
                                  onClick={() => setEditingPlayer(null)}
                                  className="px-3 py-1 bg-slate-600 hover:bg-slate-500 text-white rounded text-sm transition"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                {pendingEdits[player.name] && (
                                  <div className="flex items-center gap-1 text-xs">
                                    <ArrowRight className="w-3 h-3 text-blue-400" />
                                    <span className="text-blue-400 font-semibold">
                                      {pendingEdits[player.name]}
                                    </span>
                                  </div>
                                )}
                                <button
                                  onClick={() => startEditPlayer(player.name, player.regiment)}
                                  className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Save All Button */}
              {Object.keys(pendingEdits).length > 0 && (
                <div className="sticky bottom-0 bg-slate-700 pt-4 border-t border-slate-600">
                  <button
                    onClick={saveAllEdits}
                    className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition font-semibold flex items-center justify-center gap-2"
                  >
                    Save All Changes ({Object.keys(pendingEdits).length} pending)
                  </button>
                </div>
              )}
            </div>
          )}

          {rounds.length === 0 && (
            <div className="text-center text-slate-400 py-12">
              <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">Upload a log file to begin analysis</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WarOfRightsLogAnalyzer;