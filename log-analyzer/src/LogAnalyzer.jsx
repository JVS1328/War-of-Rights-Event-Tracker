import React, { useState } from 'react';
import { Upload, Clock, Users, Skull, Edit2, Zap, X } from 'lucide-react';

const WarOfRightsLogAnalyzer = () => {
  const [rounds, setRounds] = useState([]);
  const [selectedRound, setSelectedRound] = useState(null);
  const [regimentStats, setRegimentStats] = useState([]);
  const [showEditor, setShowEditor] = useState(false);
  const [playerAssignments, setPlayerAssignments] = useState({});
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [newRegiment, setNewRegiment] = useState('');

  const extractRegimentTag = (playerName) => {
    // Common patterns: [TAG], {TAG}, TAG-, TAG|, (TAG)
    const patterns = [
      /^\[([^\]]+)\]/,           // [51stAL]
      /^\{([^\}]+)\}/,           // {59THNY}
      /^([A-Z0-9]+)-/,           // JD-
      /^([A-Z0-9]+)\|/,          // SR|
      /^\(([^\)]+)\)/,           // (1stTX)
      /^([A-Z]{2,})\s*\[/,       // FSB [
      /^([A-Z]{2,})\{/,          // MSG{
      /^([A-Z]{2,})-/,           // II-
      /^([A-Z]+\d+[A-Z]*)\s/     // 10thUS or 59thNY
    ];

    for (const pattern of patterns) {
      const match = playerName.match(pattern);
      if (match) {
        return match[1].trim().toUpperCase();
      }
    }

    // If no pattern matches, take first word if it looks like a tag
    const firstWord = playerName.split(/[\s\[\{\(\-]/)[0];
    if (firstWord && firstWord.length <= 10 && /[A-Z]/.test(firstWord)) {
      return firstWord.toUpperCase();
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

  const smartMatch = () => {
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

    let matchCount = 0;

    // For each small unit, try to match to a large regiment
    smallUnits.forEach(smallUnit => {
      let bestMatch = null;
      let bestScore = Infinity;

      largeRegiments.forEach(largeReg => {
        const distance = levenshteinDistance(smallUnit.toLowerCase(), largeReg.toLowerCase());
        const similarity = distance / Math.max(smallUnit.length, largeReg.length);
        
        // If similarity is good (< 30% difference), consider it
        if (similarity < 0.3 && distance < bestScore) {
          bestScore = distance;
          bestMatch = largeReg;
        }
      });

      // If we found a match, reassign all players from small unit to large regiment
      if (bestMatch) {
        selectedRound.kills.forEach(death => {
          const playerRegiment = currentAssignments[death.player] || extractRegimentTag(death.player);
          if (playerRegiment === smallUnit) {
            currentAssignments[death.player] = bestMatch;
            matchCount++;
          }
        });
      }
    });

    setPlayerAssignments({
      ...playerAssignments,
      [roundKey]: currentAssignments
    });

    // Refresh stats
    analyzeRound(selectedRound, currentAssignments);
    
    alert(`Smart Match complete! Reassigned ${matchCount} player(s) to matching regiments.`);
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
          teamkills: []
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
      const regiment = assignments[death.player] || extractRegimentTag(death.player);

      if (!regimentCasualties[regiment]) {
        regimentCasualties[regiment] = {
          name: regiment,
          casualties: 0,
          deaths: []
        };
      }

      regimentCasualties[regiment].casualties++;
      regimentCasualties[regiment].deaths.push(death.player);
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
    setShowEditor(false);
    analyzeRound(round);
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

  const savePlayerEdit = () => {
    if (!editingPlayer || !newRegiment || !selectedRound) return;

    const roundKey = `round_${selectedRound.id}`;
    const currentAssignments = { ...playerAssignments[roundKey] } || {};
    currentAssignments[editingPlayer] = newRegiment.toUpperCase().trim();

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
    if (!selectedRound) return extractRegimentTag(playerName);
    const roundKey = `round_${selectedRound.id}`;
    return playerAssignments[roundKey]?.[playerName] || extractRegimentTag(playerName);
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
                        onClick={smartMatch}
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
                        <div
                          key={regiment.name}
                          className="bg-slate-600 rounded-lg p-4"
                        >
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-bold text-lg text-amber-400">
                              {index + 1}. {regiment.name}
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

          {/* Player Editor Modal */}
          {showEditor && selectedRound && (
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

              <div className="mb-4">
                <button
                  onClick={smartMatch}
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
                        <input
                          type="text"
                          value={newRegiment}
                          onChange={(e) => setNewRegiment(e.target.value)}
                          className="px-3 py-1 bg-slate-700 text-white rounded border border-slate-500 focus:border-amber-500 outline-none"
                          placeholder="Regiment tag"
                        />
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