import React, { useState } from 'react';
import { Upload, Clock, Users, Skull, Edit2, Zap, X } from 'lucide-react';

const WarOfRightsLogAnalyzer = () => {
  const [rounds, setRounds] = useState([]);
  const [selectedRound, setSelectedRound] = useState(null);
  const [regimentStats, setRegimentStats] = useState([]);
  const [selectedRegiment, setSelectedRegiment] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [playerAssignments, setPlayerAssignments] = useState({});
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [newRegiment, setNewRegiment] = useState('');
  const [smartMatchThreshold, setSmartMatchThreshold] = useState(70);
  const [smartMatchPreview, setSmartMatchPreview] = useState(null);
  const [showSmartMatchPreview, setShowSmartMatchPreview] = useState(false);

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
    
    // Build regiment list with counts
    const regimentCounts = {};
    selectedRound.kills.forEach(death => {
      const currentRegiment = currentAssignments[death.player] || extractRegimentTag(death.player);
      regimentCounts[currentRegiment] = (regimentCounts[currentRegiment] || 0) + 1;
    });

    // Find large regiments (2+ members)
    const largeRegiments = Object.keys(regimentCounts).filter(reg => regimentCounts[reg] >= 2);
    
    // Find small units (1-2 members)
    const smallUnits = Object.keys(regimentCounts).filter(reg => regimentCounts[reg] <= 2 && reg !== 'UNTAGGED');

    const matches = [];
    // Convert threshold: 50% = 0.5 difference allowed, 90% = 0.1 difference allowed
    const threshold = (100 - smartMatchThreshold) / 100;

    // For each small unit, try to match to a large regiment
    smallUnits.forEach(smallUnit => {
      let bestMatch = null;
      let bestScore = Infinity;
      let bestSimilarity = 1;

      largeRegiments.forEach(largeReg => {
        const distance = levenshteinDistance(smallUnit.toLowerCase(), largeReg.toLowerCase());
        const maxLen = Math.max(smallUnit.length, largeReg.length);
        const similarity = distance / maxLen;
        
        // Use the threshold from slider - lower threshold means more lenient matching
        if (similarity <= threshold && distance < bestScore) {
          bestScore = distance;
          bestMatch = largeReg;
          bestSimilarity = similarity;
        }
      });

      // If we found a match, collect the changes
      if (bestMatch) {
        const affectedPlayers = [];
        selectedRound.kills.forEach(death => {
          const playerRegiment = currentAssignments[death.player] || extractRegimentTag(death.player);
          if (playerRegiment === smallUnit && !affectedPlayers.includes(death.player)) {
            affectedPlayers.push(death.player);
          }
        });

        if (affectedPlayers.length > 0) {
          matches.push({
            fromRegiment: smallUnit,
            toRegiment: bestMatch,
            players: affectedPlayers,
            similarity: Math.round((1 - bestSimilarity) * 100)
          });
        }
      }
    });

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

    setRounds(parsedRounds);
  };

  const analyzeRound = (round, customAssignments = null) => {
    const roundKey = `round_${round.id}`;
    const assignments = customAssignments || playerAssignments[roundKey] || {};
    const regimentCasualties = {};

    // Count respawns (deaths) per regiment
    round.kills.forEach(death => {
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
  };

  const startEditPlayer = (playerName, currentRegiment) => {
    setEditingPlayer(playerName);
    setNewRegiment(currentRegiment);
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

    setEditingPlayer(null);
    setNewRegiment('');

    // Refresh stats
    analyzeRound(selectedRound, currentAssignments);
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
      const regiment = getPlayerRegiment(death.player);
      if (!playerMap[death.player]) {
        playerMap[death.player] = { name: death.player, regiment, deaths: 0 };
      }
      playerMap[death.player].deaths++;
    });

    return Object.values(playerMap).sort((a, b) => 
      a.regiment.localeCompare(b.regiment) || b.deaths - a.deaths
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
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

              <div className="mb-6">
                <label className="block text-slate-300 mb-2">
                  Match Threshold: {smartMatchThreshold}% similarity
                </label>
                <input
                  type="range"
                  min="50"
                  max="90"
                  value={smartMatchThreshold}
                  onChange={(e) => setSmartMatchThreshold(parseInt(e.target.value))}
                  onMouseUp={generateSmartMatchPreview}
                  onTouchEnd={generateSmartMatchPreview}
                  className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-purple-600"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>50% (More matches)</span>
                  <span>90% (Fewer matches)</span>
                </div>
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
                    No matches found at {smartMatchThreshold}% threshold. Try lowering the threshold.
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

              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {getAllPlayers().map((player) => (
                  <div
                    key={player.name}
                    className="bg-slate-600 rounded-lg p-4 flex justify-between items-center gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-white truncate">
                        {player.name}
                      </div>
                      <div className="text-sm text-slate-400">
                        Deaths: {player.deaths}
                      </div>
                    </div>
                    
                    {editingPlayer === player.name ? (
                      <div className="flex items-center gap-2">
                        <select
                          value={newRegiment}
                          onChange={(e) => setNewRegiment(e.target.value)}
                          className="px-3 py-1 bg-slate-700 text-white rounded border border-slate-500 focus:border-amber-500 outline-none"
                        >
                          {getAvailableRegiments().map(reg => (
                            <option key={reg} value={reg}>{reg}</option>
                          ))}
                        </select>
                        <button
                          onClick={savePlayerEdit}
                          className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded transition"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingPlayer(null)}
                          className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded transition"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 bg-amber-600 text-white rounded font-semibold">
                          {player.regiment}
                        </span>
                        <button
                          onClick={() => startEditPlayer(player.name, player.regiment)}
                          className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
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