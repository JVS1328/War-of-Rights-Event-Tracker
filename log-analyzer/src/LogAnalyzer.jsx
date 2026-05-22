import React, { useState, useRef, useEffect } from 'react';
import { Upload, Clock, Users, Skull, Edit2, Zap, X, TrendingUp, Award, Timer, BarChart3, ChevronDown, ChevronRight, Trash2, ArrowRight, Download, AlertTriangle, Share2, ListChecks, Film, Link2 } from 'lucide-react';
import { generateRoundPDF } from './PDFExport';
import { generateShareUrl, generateShortShareUrl } from './utils/shareAnalysis';
import RegimentListModal from './RegimentListModal';
import ReplayViewer from './ReplayViewer';
import { parseReplayCsv, looksLikeReplayCsv, timestampFromFilename } from './utils/replayParser';
import { encodeReplay, decodeReplay } from './utils/replayCodec';
import { putReplay, getReplay, deleteReplay, computeReplayId } from './utils/replayStore';

const STORAGE_KEY = 'WarOfRightsLogAnalyzer';

const WarOfRightsLogAnalyzer = ({ initialShareData }) => {
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
  const [logDate, setLogDate] = useState(savedState?.logDate || null);
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
  const [disabledDeathTypes, setDisabledDeathTypes] = useState(new Set());
  const [casualtyBreakdownView, setCasualtyBreakdownView] = useState('overall');
  const [showAllKillRates, setShowAllKillRates] = useState(false);
  const [killsTimeRangeStart, setKillsTimeRangeStart] = useState(0);
  const [killsTimeRangeEnd, setKillsTimeRangeEnd] = useState(100);
  const [killsHoverInfo, setKillsHoverInfo] = useState(null);
  const [killsHoveredRegiment, setKillsHoveredRegiment] = useState(null);
  const [killsPinnedRegiment, setKillsPinnedRegiment] = useState(null);
  const killsSvgRef = useRef(null);

  // Regiment list modal state
  const [showRegimentListModal, setShowRegimentListModal] = useState(false);
  const [regimentModalKind, setRegimentModalKind] = useState('import'); // 'import' | 'post'
  const [pendingImport, setPendingImport] = useState(null); // { kind: 'csv'|'log', rounds, extractedDate? }
  const [playerSearchQuery, setPlayerSearchQuery] = useState('');

  // Replay state. `replays` is an in-memory Map<replayId, parsedReplay>;
  // the persistent copy lives in IndexedDB (rounds carry only `replayId`,
  // not the payload, so localStorage stays small). `replayMatchModal`
  // holds parsed replays + a per-replay user assignment when the import
  // flow needs disambiguation.
  const [replays, setReplays] = useState(() => new Map());
  const [replayMatchModal, setReplayMatchModal] = useState(null);
  const replayInputRef = useRef(null);

  // Save state to localStorage whenever relevant state changes!
  useEffect(() => {
    const stateToSave = {
      rounds,
      selectedRound,
      logDate,
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
  }, [rounds, selectedRound, logDate, playerAssignments, expandedRegiments, pinnedRegiment, timeRangeStart, timeRangeEnd, showAllLossRates, showAllTimeInCombat]);

  // Restore selected round's stats on mount if there's a saved selected round
  useEffect(() => {
    if (savedState?.selectedRound && rounds.length > 0) {
      const round = rounds.find(r => r.id === savedState.selectedRound.id);
      if (round) {
        analyzeRound(round);
      }
    }
  }, []); // Only run once on mount

  // Rehydrate any replays referenced by saved rounds from IndexedDB. Runs
  // once per round-list change that introduces new replayIds (e.g. on
  // mount after loading from localStorage, or after a share import).
  useEffect(() => {
    const needed = new Set(
      rounds.map(r => r.replayId).filter(id => id && !replays.has(id))
    );
    if (needed.size === 0) return;
    let cancelled = false;
    (async () => {
      const loaded = new Map();
      for (const id of needed) {
        try {
          const buf = await getReplay(id);
          if (!buf) continue;
          loaded.set(id, decodeReplay(buf));
        } catch (err) {
          console.warn('Failed to load replay from IDB', id, err);
        }
      }
      if (cancelled || loaded.size === 0) return;
      setReplays(prev => {
        const next = new Map(prev);
        for (const [id, replay] of loaded) next.set(id, replay);
        return next;
      });
    })();
    return () => { cancelled = true; };
  }, [rounds]);

  // Load shared state if present
  useEffect(() => {
    if (initialShareData) {
      setRounds(initialShareData.rounds);
      setPlayerAssignments(initialShareData.playerAssignments || {});
      setDisabledDeathTypes(initialShareData.disabledDeathTypes || new Set());
      setLogDate(null);
      setSelectedRegiment(null);
      setExpandedRegiments({});
      setPinnedRegiment(null);
      setTimeRangeStart(0);
      setTimeRangeEnd(100);
      setShowAllLossRates(false);
      setShowAllTimeInCombat(false);

      if (initialShareData.selectedRoundId != null) {
        const round = initialShareData.rounds.find(r => r.id === initialShareData.selectedRoundId);
        if (round) {
          setSelectedRound(round);
          setTimeout(() => analyzeRound(round, initialShareData.playerAssignments), 0);
        }
      }

      // If the share carried replays, write them through to IDB so they
      // survive a refresh just like locally-attached replays do.
      if (initialShareData.replays && initialShareData.replays.size > 0) {
        setReplays(prev => {
          const next = new Map(prev);
          for (const [id, replay] of initialShareData.replays) next.set(id, replay);
          return next;
        });
        (async () => {
          for (const [id, replay] of initialShareData.replays) {
            try { await putReplay(id, encodeReplay(replay)); } catch {}
          }
        })();
      }

      window.location.hash = '';
    }
  }, [initialShareData]);

  // Re-analyze when death type filters change
  useEffect(() => {
    if (selectedRound) {
      analyzeRound(selectedRound);
    }
  }, [disabledDeathTypes]);

  const normalizeRegimentTag = (tag) => {
    if (!tag) return tag;
    
    // Remove all company/unit suffixes and extra characters
    // Handles: (A), (B), (WB), .A, .B, .I*, .CG, . C, etc..
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

  // Parse the textarea content from the regiment list modal.
  // Returns: [{ label: string, patterns: string[] }, ...] with patterns uppercased.
  const parseRegimentList = (text) => {
    if (!text) return [];
    const entries = [];
    text.split(/\r?\n/).forEach(rawLine => {
      const line = rawLine.trim();
      if (!line) return;
      let label;
      let patterns;
      const eqIdx = line.indexOf('=');
      if (eqIdx >= 0) {
        label = line.slice(0, eqIdx).trim();
        const rhs = line.slice(eqIdx + 1).trim();
        patterns = rhs.split(',').map(p => p.trim()).filter(Boolean);
        if (!label || patterns.length === 0) return;
      } else {
        label = line;
        patterns = [line];
      }
      const normalizedLabel = normalizeRegimentTag(label) || label;
      const upperPatterns = patterns.map(p => p.toUpperCase()).filter(Boolean);
      if (upperPatterns.length === 0) return;
      entries.push({ label: normalizedLabel, patterns: upperPatterns });
    });
    return entries;
  };

  // Find the best (label, pattern) match for a player name.
  // Match rule: case-insensitive substring with non-alphanumeric (or string-edge)
  // boundaries on each side. Longest pattern wins; ties broken by entry order.
  const matchPlayerToRegimentList = (playerName, parsedList) => {
    if (!playerName || !parsedList || parsedList.length === 0) return null;
    const upper = playerName.toUpperCase();
    const isBoundary = (ch) => ch === undefined || !/[A-Z0-9]/.test(ch);
    let best = null;
    for (let i = 0; i < parsedList.length; i++) {
      const entry = parsedList[i];
      for (const pattern of entry.patterns) {
        if (!pattern) continue;
        let from = 0;
        while (from <= upper.length - pattern.length) {
          const idx = upper.indexOf(pattern, from);
          if (idx < 0) break;
          const before = idx === 0 ? undefined : upper[idx - 1];
          const after = idx + pattern.length >= upper.length ? undefined : upper[idx + pattern.length];
          if (isBoundary(before) && isBoundary(after)) {
            if (
              !best ||
              pattern.length > best.length ||
              (pattern.length === best.length && i < best.entryIndex)
            ) {
              best = { label: entry.label, length: pattern.length, entryIndex: i };
            }
            break; // longer matches at later positions of the same pattern won't help
          }
          from = idx + 1;
        }
      }
    }
    return best ? best.label : null;
  };

  // Build a playerAssignments map from a regiment list against the union of known
  // players across the supplied rounds. Mode: 'replace' assigns UNTAGGED on no
  // match; 'augment' leaves unmatched players unset (so the caller's existing
  // assignments / extractRegimentTag fallback applies downstream).
  const buildAssignmentsFromRegimentList = (rounds, parsedList, mode, baseAssignments = {}) => {
    const out = mode === 'augment' ? { ...baseAssignments } : {};
    if (!rounds || rounds.length === 0) return out;
    const playerSet = new Set();
    rounds.forEach(round => {
      getKnownPlayers(round).forEach(p => playerSet.add(p));
    });
    playerSet.forEach(playerName => {
      const matched = matchPlayerToRegimentList(playerName, parsedList);
      if (matched) {
        out[playerName] = matched;
      } else if (mode === 'replace') {
        out[playerName] = 'UNTAGGED';
      }
    });
    return out;
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
    
    const assignments = playerAssignments || {};
    const regimentMap = {};
    
    // Collect all regiments from all known players and normalize them
    getKnownPlayers(selectedRound).forEach(playerName => {
      const regiment = assignments[playerName] || extractRegimentTag(playerName);
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

    const currentAssignments = { ...playerAssignments } || {};
    
    // Build regiment list with counts and player lists from all known players
    const regimentData = {};
    getKnownPlayers(selectedRound).forEach(playerName => {
      const currentRegiment = currentAssignments[playerName] || extractRegimentTag(playerName);
      if (!regimentData[currentRegiment]) {
        regimentData[currentRegiment] = {
          count: 0,
          players: []
        };
      }
      if (!regimentData[currentRegiment].players.includes(playerName)) {
        regimentData[currentRegiment].players.push(playerName);
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

    const currentAssignments = { ...playerAssignments } || {};
    
    let totalChanges = 0;
    smartMatchPreview.forEach(match => {
      match.players.forEach(player => {
        // Check if there's a player-specific override
        const targetRegiment = match.playerOverrides?.[player] || match.toRegiment;
        currentAssignments[player] = targetRegiment;
        totalChanges++;
      });
    });

    setPlayerAssignments(currentAssignments);

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

  // Filter out incomplete rounds (map switches) that don't have an end time
  const filterCompleteRounds = (rounds) => {
    return rounds.filter(round => round.endTime !== null);
  };

  // When no round has casualty data, merge all rounds into one collective player roster
  const mergeRoundsIfNoCasualties = (rounds) => {
    if (rounds.length <= 1) return rounds;
    if (rounds.some(r => r.kills.length > 0)) return rounds;

    // All rounds have zero kills — merge into a single round
    const merged = {
      id: 1,
      startTime: rounds[0].startTime,
      endTime: rounds[rounds.length - 1].endTime,
      duration: null,
      kills: [],
      teamkills: [],
      playerSessions: {},
      chatPlayers: [],
      adjustedCasualties: 0,
    };

    // Calculate duration
    if (merged.startTime !== 'Unknown' && merged.endTime !== 'Unknown') {
      const start = merged.startTime.split(':').map(Number);
      const end = merged.endTime.split(':').map(Number);
      const durationSeconds = (end[0] * 3600 + end[1] * 60 + end[2]) - (start[0] * 3600 + start[1] * 60 + start[2]);
      const minutes = Math.floor(durationSeconds / 60);
      const seconds = durationSeconds % 60;
      merged.duration = `${minutes}m ${seconds}s`;
    }

    // Merge all players from every round
    rounds.forEach(round => {
      Object.entries(round.playerSessions).forEach(([player, sessions]) => {
        if (!merged.playerSessions[player]) {
          merged.playerSessions[player] = [];
        }
        merged.playerSessions[player].push(...sessions);
      });

      const chatList = Array.isArray(round.chatPlayers) ? round.chatPlayers : [...round.chatPlayers];
      chatList.forEach(player => {
        if (!merged.chatPlayers.includes(player)) {
          merged.chatPlayers.push(player);
        }
      });
    });

    return [merged];
  };

  // Get all known players for a round from all available sources (joins, chat, kills)
  const getKnownPlayers = (round) => {
    const known = new Set();
    Object.keys(round.playerSessions || {}).forEach(p => known.add(p));
    (round.chatPlayers || []).forEach(p => known.add(p));
    round.kills.forEach(k => known.add(k.player));
    return [...known];
  };

  const parseLogFile = (logText) => {
    const lines = logText.split('\n');
    const parsedRounds = [];
    let currentRound = null;
    let roundNumber = 0;
    let extractedDate = null;
    let betweenRoundBuffer = new Set(); // Players seen between rounds (after victory, before next start)

    // Extract date from near the top of the file: "Log Started at Wed Nov 19 19:31:14 2025"
    // Extract only: "Wed Nov 19 2025" (remove time)
    const searchLines = Math.min(100, lines.length);
    for (let i = 0; i < searchLines; i++) {
      const dateMatch = lines[i].match(/Log Started at (\w+\s+\w+\s+\d+)\s+\d+:\d+:\d+\s+(\d+)/);
      if (dateMatch) {
        extractedDate = `${dateMatch[1]} ${dateMatch[2]}`; // "Wed Nov 19 2025"
        break;
      }
    }

    lines.forEach(line => {
      // Detect round start
      if (line.includes('CGameRulesEventHelper::OnRoundStarted')) {
        if (currentRound && currentRound.endTime !== null) {
          // Previous round completed normally, push it
          parsedRounds.push(currentRound);
        } else if (currentRound && currentRound.endTime === null) {
          // Consecutive OnRoundStarted without a victory in between.
          // Keep the existing round data (players, sessions, chat) and
          // treat the original start time as the real start so we don't
          // lose players discovered between the two events.
          return;
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
          playerSessions: {},
          chatPlayers: new Set(), // Players discovered from chat messages
          adjustedCasualties: 0 // Track adjusted casualties (excluding initial spawns)
        };

        // Merge between-round players into new round as present from start
        betweenRoundBuffer.forEach(playerName => {
          if (!currentRound.playerSessions[playerName]) {
            currentRound.playerSessions[playerName] = [{ join: currentRound.startTime, leave: null }];
          }
        });
        betweenRoundBuffer.clear();
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
          const joinTime = match[1];
          const playerName = match[2].trim();

          if (currentRound.endTime !== null) {
            // Between rounds - buffer for next round
            betweenRoundBuffer.add(playerName);
          } else {
            // During active round
            let shouldTrackJoin = true;
            if (currentRound.startTime && currentRound.startTime !== 'Unknown') {
              const joinSeconds = joinTime.split(':').map(Number);
              const startSeconds = currentRound.startTime.split(':').map(Number);
              const joinTimeInSeconds = joinSeconds[0] * 3600 + joinSeconds[1] * 60 + joinSeconds[2];
              const startTimeInSeconds = startSeconds[0] * 3600 + startSeconds[1] * 60 + startSeconds[2];
              shouldTrackJoin = joinTimeInSeconds >= startTimeInSeconds;
            }

            if (shouldTrackJoin) {
              if (!currentRound.playerSessions[playerName]) {
                currentRound.playerSessions[playerName] = [];
              }
              currentRound.playerSessions[playerName].push({ join: joinTime, leave: null });
            }
          }
        }
      }

      // Detect player leaves
      if (line.includes('has left the server') && currentRound) {
        const match = line.match(/<(\d{2}:\d{2}:\d{2})>\s+Player\s+(.+?)\s+has left the server/);
        if (match) {
          const leaveTime = match[1];
          const playerName = match[2].trim();

          if (currentRound.endTime !== null) {
            // Between rounds - add to the just-ended round if not already tracked
            if (!currentRound.playerSessions[playerName] && !currentRound.chatPlayers.has(playerName)) {
              currentRound.playerSessions[playerName] = [{ join: currentRound.startTime, leave: currentRound.endTime }];
            }
            // They left, so remove from next-round buffer
            betweenRoundBuffer.delete(playerName);
          } else {
            // During active round
            let cappedLeaveTime = leaveTime;

            if (!currentRound.playerSessions[playerName]) {
              // Player not tracked yet - they were here, add them (session from round start to now)
              currentRound.playerSessions[playerName] = [{ join: currentRound.startTime, leave: cappedLeaveTime }];
            } else {
              const sessions = currentRound.playerSessions[playerName];
              const lastSession = sessions[sessions.length - 1];
              if (lastSession && !lastSession.leave) {
                lastSession.leave = cappedLeaveTime;
              }
            }
          }
        }
      }

      // Detect respawns (casualties)
      if (line.includes('[CPlayer::ClDoRespawn]') && currentRound) {
        const timeMatch = line.match(/<(\d{2}:\d{2}:\d{2})>/);
        const playerMatch = line.match(/\[CPlayer::ClDoRespawn\]\s+"([^"]+)"\s+beginning respawning/);
        
        if (playerMatch && timeMatch) {
          const deathTime = timeMatch[1];
          
          // Only add death if it's within round bounds
          // If round hasn't ended yet (endTime is null), add it
          // If round has ended, only add if death occurred before or at round end
          let shouldAddDeath = true;
          
          if (currentRound.endTime && currentRound.endTime !== 'Unknown') {
            const deathSeconds = deathTime.split(':').map(Number);
            const endSeconds = currentRound.endTime.split(':').map(Number);
            const deathTimeInSeconds = deathSeconds[0] * 3600 + deathSeconds[1] * 60 + deathSeconds[2];
            const endTimeInSeconds = endSeconds[0] * 3600 + endSeconds[1] * 60 + endSeconds[2];
            
            // Only add if death occurred at or before round end
            shouldAddDeath = deathTimeInSeconds <= endTimeInSeconds;
          }
          
          if (shouldAddDeath) {
            currentRound.kills.push({
              player: playerMatch[1].trim(),
              time: deathTime
            });
          }
        }
      }

      // Detect chat messages to discover players present in the round
      if ((line.includes('[Team]') || line.includes('[All]')) && currentRound) {
        const chatMatch = line.match(/<(\d{2}:\d{2}:\d{2})>\s+\[(Team|All)\]\s+(.+)/);
        if (chatMatch) {
          let playerName = chatMatch[3].trim();
          // Remove message content after ': ' if present
          const colonIndex = playerName.indexOf(': ');
          if (colonIndex !== -1) {
            playerName = playerName.substring(0, colonIndex).trim();
          }

          if (currentRound.endTime !== null) {
            // Between rounds - buffer for next round
            betweenRoundBuffer.add(playerName);
          } else {
            currentRound.chatPlayers.add(playerName);
          }
        }
      }
    });

    // Push last round if exists
    if (currentRound) {
      parsedRounds.push(currentRound);
    }

    // Post-process rounds: convert chatPlayers Set to array, calculate adjusted casualties
    parsedRounds.forEach(round => {
      round.chatPlayers = [...round.chatPlayers];

      const playerRespawnSkipCount = {};
      const playerSessionCounts = {};
      
      // Count sessions for each player
      Object.entries(round.playerSessions).forEach(([playerName, sessions]) => {
        playerSessionCounts[playerName] = sessions.length;
      });
      
      // Count adjusted casualties
      let adjustedCount = 0;
      round.kills.forEach(death => {
        const sessionCount = playerSessionCounts[death.player] || 1;
        
        if (!playerRespawnSkipCount[death.player]) {
          playerRespawnSkipCount[death.player] = 0;
        }
        
        // Skip if we haven't skipped enough respawns yet (one per session)
        if (playerRespawnSkipCount[death.player] < sessionCount) {
          playerRespawnSkipCount[death.player]++;
          return;
        }
        
        adjustedCount++;
      });
      
      round.adjustedCasualties = adjustedCount;
    });

    // Filter out incomplete rounds (map switches without end times)
    const completeRounds = mergeRoundsIfNoCasualties(filterCompleteRounds(parsedRounds));
    return { rounds: completeRounds, extractedDate };
  };

  // Commit a freshly parsed import (CSV or log) to component state. Optionally
  // accepts a precomputed playerAssignments map (from the regiment list modal).
  const commitImport = ({ kind, rounds: importedRounds, extractedDate, pendingReplays }, assignments = {}) => {
    importedRounds.forEach((r, i) => { r.id = i + 1; });
    setRounds(importedRounds);
    setLogDate(kind === 'log' ? (extractedDate || null) : null);
    setSelectedRound(null);
    setRegimentStats([]);
    setSelectedRegiment(null);
    setPlayerAssignments(assignments);
    setExpandedRegiments({});
    setPinnedRegiment(null);
    setTimeRangeStart(0);
    setTimeRangeEnd(100);
    setShowAllLossRates(false);
    setShowAllTimeInCombat(false);
    setShowWarning(true);
    setDisabledDeathTypes(new Set());

    // If the same upload included replay CSVs, queue the matching modal
    // now that the rounds have their final ids.
    if (pendingReplays && pendingReplays.length > 0) {
      openReplayMatchModal(pendingReplays, importedRounds);
    }
  };

  // --- Replay matching + persistence ----------------------------------------

  // Open the replay-match modal, seeding each replay with a best-guess
  // round assignment based on filename-timestamp adjacency within ±60s.
  // The user can override before committing.
  const openReplayMatchModal = (parsedReplays, candidateRounds) => {
    if (parsedReplays.length === 0) return;
    const roundMeta = candidateRounds.map(r => ({
      id: r.id,
      label: r.metadata?.area || r.metadata?.map || r.sourceFile || `Round ${r.id}`,
      ts: timestampFromFilename(r.sourceFile || ''),
      sourceFile: r.sourceFile,
    }));

    // Already-claimed round ids — don't double-suggest.
    const claimed = new Set(
      candidateRounds.filter(r => r.replayId).map(r => r.id)
    );

    const entries = parsedReplays.map(({ filename, replay }) => {
      const replayTs = timestampFromFilename(filename);
      let best = null;
      let bestDelta = Infinity;
      if (replayTs) {
        for (const r of roundMeta) {
          if (claimed.has(r.id)) continue;
          if (!r.ts) continue;
          const delta = Math.abs(r.ts.getTime() - replayTs.getTime());
          if (delta < bestDelta && delta <= 60 * 60 * 1000) {  // within 60 min
            bestDelta = delta;
            best = r.id;
          }
        }
      }
      if (best != null) claimed.add(best);
      return {
        filename,
        replay,
        assignedRoundId: best,
        deltaMs: best != null ? bestDelta : null,
      };
    });

    setReplayMatchModal({ entries, roundMeta });
  };

  // Persist a parsed replay to IDB + in-memory state, return its id.
  const persistReplay = async (filename, parsedReplay) => {
    const id = computeReplayId(filename, parsedReplay.meta.sampleCount, parsedReplay.frameCount);
    try {
      const buf = encodeReplay(parsedReplay);
      await putReplay(id, buf);
    } catch (err) {
      console.warn('Failed to persist replay to IndexedDB', err);
    }
    setReplays(prev => {
      const next = new Map(prev);
      next.set(id, parsedReplay);
      return next;
    });
    return id;
  };

  // Commit the user's choices in the match modal. Each entry either attaches
  // its replay to the chosen round (persisting to IDB) or is skipped.
  const commitReplayMatches = async (entries) => {
    const updates = new Map();  // roundId → replayId
    for (const entry of entries) {
      if (entry.assignedRoundId == null) continue;
      const id = await persistReplay(entry.filename, entry.replay);
      // Clean up the previous replay on this round, if any.
      const prevRound = rounds.find(r => r.id === entry.assignedRoundId);
      if (prevRound?.replayId && prevRound.replayId !== id) {
        try { await deleteReplay(prevRound.replayId); } catch {}
        setReplays(prev => {
          const next = new Map(prev);
          next.delete(prevRound.replayId);
          return next;
        });
      }
      updates.set(entry.assignedRoundId, id);
    }
    if (updates.size > 0) {
      setRounds(prev => prev.map(r => {
        if (!updates.has(r.id)) return r;
        return { ...r, replayId: updates.get(r.id) };
      }));
      // Mirror onto selectedRound so the viewer appears without a re-select.
      setSelectedRound(prev => prev && updates.has(prev.id)
        ? { ...prev, replayId: updates.get(prev.id) }
        : prev);
    }
    setReplayMatchModal(null);
  };

  // Detach a replay from a round (does not delete from IDB unless this was
  // the only round referencing it — keeps the cache usable if the user
  // re-attaches without re-uploading).
  const detachReplay = async (roundId) => {
    const round = rounds.find(r => r.id === roundId);
    if (!round?.replayId) return;
    const id = round.replayId;
    setRounds(prev => prev.map(r => r.id === roundId ? { ...r, replayId: null } : r));
    setSelectedRound(prev => prev && prev.id === roundId ? { ...prev, replayId: null } : prev);
    const stillReferenced = rounds.some(r => r.id !== roundId && r.replayId === id);
    if (!stillReferenced) {
      try { await deleteReplay(id); } catch {}
      setReplays(prev => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const analyzeRound = (round, customAssignments = null) => {
    const assignments = customAssignments || playerAssignments || {};
    const regimentCasualties = {};
    const isScoreboard = round.isScoreboard || false;

    const ensureRegiment = (regiment, playerName) => {
      if (!regimentCasualties[regiment]) {
        regimentCasualties[regiment] = {
          name: regiment,
          casualties: 0,
          kills: 0,
          deaths: [],
          players: {},
          playerKills: {},
        };
      }
      if (playerName && !regimentCasualties[regiment].players[playerName]) {
        regimentCasualties[regiment].players[playerName] = 0;
      }
    };

    if (isScoreboard) {
      // Scoreboard CSV: deaths are exact counts, filter by disabled death types
      round.kills.forEach(death => {
        if (death.cause && disabledDeathTypes.has(death.cause)) return;
        const regiment = normalizeRegimentTag(assignments[death.player] || extractRegimentTag(death.player));
        ensureRegiment(regiment, death.player);
        regimentCasualties[regiment].casualties++;
        regimentCasualties[regiment].deaths.push(death.player);
        regimentCasualties[regiment].players[death.player]++;
      });

      // Aggregate kills from playerKills — if we have a kill log with causes, only count non-disabled
      if (round.kills.some(k => k.cause)) {
        // Re-derive kills from kill log filtered by cause
        round.kills.forEach(death => {
          if (death.cause && disabledDeathTypes.has(death.cause)) return;
          if (!death.killer || death.killer === '(environment)') return;
          const regiment = normalizeRegimentTag(assignments[death.killer] || extractRegimentTag(death.killer));
          ensureRegiment(regiment, death.killer);
          regimentCasualties[regiment].kills++;
          regimentCasualties[regiment].playerKills[death.killer] = (regimentCasualties[regiment].playerKills[death.killer] || 0) + 1;
        });
      } else if (round.playerKills) {
        Object.entries(round.playerKills).forEach(([playerName, killCount]) => {
          const regiment = normalizeRegimentTag(assignments[playerName] || extractRegimentTag(playerName));
          ensureRegiment(regiment, playerName);
          regimentCasualties[regiment].kills += killCount;
          regimentCasualties[regiment].playerKills[playerName] = killCount;
        });
      }
    } else {
      // Log file: skip initial spawns per session
      const playerRespawnSkipCount = {};
      const playerSessionCounts = {};

      Object.entries(round.playerSessions).forEach(([playerName, sessions]) => {
        playerSessionCounts[playerName] = sessions.length;
      });

      // First pass: Initialize all players
      round.kills.forEach(death => {
        const regiment = normalizeRegimentTag(assignments[death.player] || extractRegimentTag(death.player));
        ensureRegiment(regiment, death.player);
      });

      // Second pass: Count actual deaths (skipping initial spawns)
      round.kills.forEach(death => {
        const sessionCount = playerSessionCounts[death.player] || 1;
        if (!playerRespawnSkipCount[death.player]) playerRespawnSkipCount[death.player] = 0;
        if (playerRespawnSkipCount[death.player] < sessionCount) {
          playerRespawnSkipCount[death.player]++;
          return;
        }
        const regiment = normalizeRegimentTag(assignments[death.player] || extractRegimentTag(death.player));
        regimentCasualties[regiment].casualties++;
        regimentCasualties[regiment].deaths.push(death.player);
        regimentCasualties[regiment].players[death.player]++;
      });
    }

    // Include all known players (from joins and chat) even without casualties
    getKnownPlayers(round).forEach(playerName => {
      const regiment = normalizeRegimentTag(assignments[playerName] || extractRegimentTag(playerName));
      ensureRegiment(regiment, playerName);
    });

    // Convert to array, compute K/D ratio, and sort by casualties
    const stats = Object.values(regimentCasualties).map(r => ({
      ...r,
      playerCount: Object.keys(r.players).length,
      kd: r.casualties > 0 ? (r.kills / r.casualties) : (r.kills > 0 ? r.kills : 0),
    })).sort((a, b) => b.casualties - a.casualties);

    setRegimentStats(stats);
  };

  const parseCSVLine = (line) => {
    const parts = [];
    let current = '';
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ',' && !inQuotes) { parts.push(current.trim()); current = ''; continue; }
      current += ch;
    }
    parts.push(current.trim());
    return parts;
  };

  const parseScoreboardCSV = (csvText, roundId = 1) => {
    const rawLines = csvText.split('\n').map(l => l.replace(/\r$/, ''));
    if (rawLines.length < 2) return null;

    // Detect new format: metadata section starts with key,value pairs (no header row with "kills")
    const firstLine = rawLines[0].toLowerCase();
    const hasMetadataSection = !firstLine.includes('kills') && firstLine.includes(',') && firstLine.split(',').length === 2;

    let metadata = {};
    let playerStartIdx = 0;

    if (hasMetadataSection) {
      // Parse metadata key-value pairs until we hit a blank line or a header row
      for (let i = 0; i < rawLines.length; i++) {
        const line = rawLines[i].trim();
        if (!line) { playerStartIdx = i + 1; break; }
        const lower = line.toLowerCase();
        if (lower.startsWith('name,team') || lower.includes('kills')) { playerStartIdx = i; break; }
        const parts = parseCSVLine(rawLines[i]);
        if (parts.length >= 2) {
          metadata[parts[0].trim().toLowerCase()] = parts[1].trim();
        }
      }
      // Skip blank lines to find player header
      while (playerStartIdx < rawLines.length && !rawLines[playerStartIdx].trim()) playerStartIdx++;
    }

    // Find the player header row
    let playerHeaderIdx = playerStartIdx;
    for (let i = playerStartIdx; i < rawLines.length; i++) {
      const lower = rawLines[i].trim().toLowerCase();
      if (lower.startsWith('name,') && lower.includes('kills')) { playerHeaderIdx = i; break; }
    }

    const playerHeader = rawLines[playerHeaderIdx] ? parseCSVLine(rawLines[playerHeaderIdx]).map(h => h.toLowerCase()) : [];
    if (!playerHeader.includes('kills') || !playerHeader.includes('deaths')) return null;

    // End the player section at the first blank line. Newer scoreboards drop
    // additional blank-line-delimited sections (e.g. an "officer,team,
    // commanded,battery" table) between the player rows and the kill log;
    // continuing to parse past the blank would re-parse those as player rows
    // and clobber officers' formation/kill counts with the wrong columns.
    let playerEndIdx = rawLines.length;
    for (let i = playerHeaderIdx + 1; i < rawLines.length; i++) {
      if (rawLines[i].trim() === '') { playerEndIdx = i; break; }
    }

    // Find the kill log header anywhere after the player section, skipping
    // intervening sections like "officer,team,commanded,battery".
    let killLogHeaderIdx = -1;
    for (let i = playerEndIdx; i < rawLines.length; i++) {
      if (rawLines[i].trim().toLowerCase().startsWith('time,killer')) {
        killLogHeaderIdx = i;
        break;
      }
    }

    // Parse players
    const nameIdx = playerHeader.indexOf('name');
    const teamIdx = playerHeader.indexOf('team');
    const killsIdx = playerHeader.indexOf('kills');
    const deathsIdx = playerHeader.indexOf('deaths');
    const formIdx = playerHeader.indexOf('deaths_in_form');
    const skirmIdx = playerHeader.indexOf('deaths_skirm');
    const oobIdx = playerHeader.indexOf('deaths_oob');

    const players = [];
    for (let i = playerHeaderIdx + 1; i < playerEndIdx; i++) {
      if (!rawLines[i].trim()) continue;
      const parts = parseCSVLine(rawLines[i]);
      if (parts.length < 4) continue;
      const name = parts[nameIdx >= 0 ? nameIdx : 0];
      const team = parseInt(parts[teamIdx >= 0 ? teamIdx : 1]);
      const kills = parseInt(parts[killsIdx >= 0 ? killsIdx : 2]);
      const deaths = parseInt(parts[deathsIdx >= 0 ? deathsIdx : 3]);
      if (!name || isNaN(team) || isNaN(kills) || isNaN(deaths)) continue;
      const player = { name, team, kills, deaths };
      if (formIdx >= 0) player.deathsInForm = parseInt(parts[formIdx]) || 0;
      if (skirmIdx >= 0) player.deathsSkirm = parseInt(parts[skirmIdx]) || 0;
      if (oobIdx >= 0) player.deathsOob = parseInt(parts[oobIdx]) || 0;
      players.push(player);
    }

    if (players.length === 0) return null;

    // Parse kill log if present
    const killLog = [];
    if (killLogHeaderIdx > 0) {
      const klHeader = parseCSVLine(rawLines[killLogHeaderIdx]).map(h => h.toLowerCase().trim());
      const tIdx = klHeader.indexOf('time');
      const krIdx = klHeader.indexOf('killer');
      const ktIdx = klHeader.indexOf('killer_team');
      const vIdx = klHeader.indexOf('victim');
      const vtIdx = klHeader.indexOf('victim_team');
      const vfIdx = klHeader.indexOf('victim_formation');
      const cIdx = klHeader.indexOf('cause');

      for (let i = killLogHeaderIdx + 1; i < rawLines.length; i++) {
        if (!rawLines[i].trim()) continue;
        const parts = parseCSVLine(rawLines[i]);
        if (parts.length < 5) continue;
        const time = parts[tIdx >= 0 ? tIdx : 0].trim();
        if (!/^\d{2}:\d{2}:\d{2}$/.test(time)) continue;
        killLog.push({
          time,
          killer: parts[krIdx >= 0 ? krIdx : 1].trim(),
          killerTeam: parseInt(parts[ktIdx >= 0 ? ktIdx : 2]),
          victim: parts[vIdx >= 0 ? vIdx : 3].trim(),
          victimTeam: parseInt(parts[vtIdx >= 0 ? vtIdx : 4]),
          victimFormation: vfIdx >= 0 ? parts[vfIdx].trim() : null,
          cause: cIdx >= 0 ? parts[cIdx].trim() : null,
        });
      }
    }

    const hasKillLog = killLog.length > 0;
    const playerKills = {};
    players.forEach(p => { playerKills[p.name] = p.kills; });

    // Build player formation data map
    const playerFormations = {};
    players.forEach(p => {
      if (p.deathsInForm !== undefined) {
        playerFormations[p.name] = {
          inForm: p.deathsInForm,
          skirm: p.deathsSkirm || 0,
          oob: p.deathsOob || 0,
        };
      }
    });

    let deathEntries;
    let startTime = 'Unknown';
    let endTime = 'Unknown';
    let duration = null;

    if (hasKillLog) {
      deathEntries = killLog.map(k => ({
        player: k.victim,
        victim: k.victim,
        time: k.time,
        killer: k.killer,
        cause: k.cause,
        victimFormation: k.victimFormation,
        victimTeam: k.victimTeam,
        killerTeam: k.killerTeam,
      }));

      const times = killLog.map(k => k.time);
      startTime = times[0];
      endTime = times[times.length - 1];

      const s = startTime.split(':').map(Number);
      const e = endTime.split(':').map(Number);
      const durSec = (e[0] * 3600 + e[1] * 60 + e[2]) - (s[0] * 3600 + s[1] * 60 + s[2]);
      const mins = Math.floor(durSec / 60);
      const secs = durSec % 60;
      duration = `${mins}m ${secs}s`;
    } else {
      deathEntries = [];
      players.forEach(p => {
        for (let d = 0; d < p.deaths; d++) {
          deathEntries.push({ player: p.name, time: null, cause: null });
        }
      });
    }

    const round = {
      id: roundId,
      startTime,
      endTime,
      duration,
      kills: deathEntries,
      teamkills: [],
      playerSessions: {},
      chatPlayers: [],
      adjustedCasualties: deathEntries.length,
      isScoreboard: true,
      playerKills,
      playerFormations,
      metadata: Object.keys(metadata).length > 0 ? metadata : null,
      players,
    };

    players.forEach(p => {
      round.playerSessions[p.name] = hasKillLog
        ? [{ join: startTime, leave: endTime }]
        : [];
    });

    return [round];
  };

  const handleFileUpload = (event) => {
    const files = Array.from(event.target.files);
    if (!files.length) return;

    const csvFiles = files.filter(f => f.name.toLowerCase().endsWith('.csv'));
    const jsonFile = files.find(f => f.name.toLowerCase().endsWith('.json'));
    const logFile = files.find(f => !f.name.toLowerCase().endsWith('.csv') && !f.name.toLowerCase().endsWith('.json'));

    if (csvFiles.length > 0) {
      const readPromises = csvFiles.map(file => new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve({ name: file.name, text: e.target.result });
        reader.readAsText(file);
      }));

      Promise.all(readPromises).then(results => {
        const scoreboardResults = [];
        const replayResults = [];
        for (const r of results) {
          if (looksLikeReplayCsv(r.text)) replayResults.push(r);
          else                            scoreboardResults.push(r);
        }

        // --- scoreboards: existing flow, with the filename stashed on the round ---
        const allRounds = [];
        scoreboardResults.forEach((r, idx) => {
          const parsed = parseScoreboardCSV(r.text, idx + 1);
          if (parsed) {
            parsed.forEach(round => { round.sourceFile = r.name; });
            allRounds.push(...parsed);
          }
        });

        // --- replays: parse, persist to IDB, queue a matching modal ---
        const parsedReplays = [];
        for (const r of replayResults) {
          try {
            const parsed = parseReplayCsv(r.text);
            if (parsed) parsedReplays.push({ filename: r.name, replay: parsed });
          } catch (err) {
            console.warn('Replay parse failed for', r.name, err);
          }
        }

        if (allRounds.length === 0 && parsedReplays.length === 0) {
          alert('Could not parse CSV(s). Expected a scoreboard or replay CSV.');
          return;
        }

        if (allRounds.length > 0) {
          // Stash pending replays on the import so commit can attach them
          // after the regiment-list modal closes (rounds need real ids
          // first before we can match).
          setPendingImport({ kind: 'csv', rounds: allRounds, pendingReplays: parsedReplays });
          setRegimentModalKind('import');
          setShowRegimentListModal(true);
        } else {
          // Only replays were uploaded — match against the existing rounds.
          openReplayMatchModal(parsedReplays, rounds);
        }
      });

      event.target.value = '';
      return;
    }

    const file = jsonFile || logFile || files[0];
    const fileName = file.name.toLowerCase();
    const isJsonFile = fileName.endsWith('.json');

    const reader = new FileReader();
    reader.onload = (e) => {
      if (isJsonFile) {
        // Handle analysis file import
        try {
          const importedData = JSON.parse(e.target.result);

          // Validate the imported data
          if (!importedData.rounds || !Array.isArray(importedData.rounds)) {
            alert('Invalid analysis file format');
            return;
          }

          // Filter out incomplete rounds (map switches without end times)
          const completeRounds = mergeRoundsIfNoCasualties(filterCompleteRounds(importedData.rounds || []));

          // Load the imported data into state
          setRounds(completeRounds);
          setLogDate(importedData.logDate || null);
          setPlayerAssignments(importedData.playerAssignments || {});
          setExpandedRegiments(importedData.expandedRegiments || {});
          setPinnedRegiment(importedData.pinnedRegiment || null);
          setTimeRangeStart(importedData.timeRangeStart || 0);
          setTimeRangeEnd(importedData.timeRangeEnd || 100);
          setShowAllLossRates(importedData.showAllLossRates || false);
          setShowAllTimeInCombat(importedData.showAllTimeInCombat || false);

          // If there was a selected round, re-analyze it
          if (importedData.selectedRound) {
            const round = completeRounds.find(r => r.id === importedData.selectedRound.id);
            if (round) {
              setSelectedRound(round);
              analyzeRound(round);
            }
          } else {
            setSelectedRound(null);
            setRegimentStats([]);
          }

          alert('Analysis imported successfully!');
        } catch (error) {
          console.error('Error importing analysis:', error);
          alert('Failed to import analysis. Please check the file format.');
        }
      } else {
        // Handle log file parsing — defer commit until regiment list modal closes
        const parsed = parseLogFile(e.target.result);
        if (!parsed || !parsed.rounds || parsed.rounds.length === 0) {
          alert('Could not parse any complete rounds from the log file.');
          return;
        }
        setPendingImport({ kind: 'log', rounds: parsed.rounds, extractedDate: parsed.extractedDate });
        setRegimentModalKind('import');
        setShowRegimentListModal(true);
      }
    };
    reader.readAsText(file);

    // Reset the input so the same file can be uploaded again
    event.target.value = '';
  };

  // Modal handlers ---------------------------------------------------------

  const handleRegimentModalApply = (text, applyMode) => {
    const parsedList = parseRegimentList(text);

    if (regimentModalKind === 'import' && pendingImport) {
      const assignments = parsedList.length > 0
        ? buildAssignmentsFromRegimentList(pendingImport.rounds, parsedList, applyMode, {})
        : {};
      commitImport(pendingImport, assignments);
      setPendingImport(null);
      setShowRegimentListModal(false);
      return;
    }

    if (regimentModalKind === 'post') {
      if (parsedList.length === 0 || rounds.length === 0) {
        setShowRegimentListModal(false);
        return;
      }
      const baseAssignments = applyMode === 'augment' ? (playerAssignments || {}) : {};
      const newAssignments = buildAssignmentsFromRegimentList(rounds, parsedList, applyMode, baseAssignments);
      setPlayerAssignments(newAssignments);
      if (selectedRound) {
        analyzeRound(selectedRound, newAssignments);
      }
      setShowRegimentListModal(false);
      return;
    }

    setShowRegimentListModal(false);
  };

  const handleRegimentModalSkip = () => {
    if (regimentModalKind === 'import' && pendingImport) {
      commitImport(pendingImport, {});
      setPendingImport(null);
    }
    setShowRegimentListModal(false);
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

  const handleShare = async () => {
    if (!rounds.length) {
      alert('Nothing to share — upload a log or CSV first.');
      return;
    }

    const state = {
      rounds,
      playerAssignments,
      selectedRoundId: selectedRound?.id ?? null,
      disabledDeathTypes,
      replaysById: replays,
    };

    let url;
    try {
      url = await generateShortShareUrl(state);
    } catch {
      url = generateShareUrl(state);
    }

    try {
      await navigator.clipboard.writeText(url);
      alert('Share link copied to clipboard!');
    } catch {
      prompt('Copy this link to share:', url);
    }
  };

  const handleExportPDF = async () => {
    if (!selectedRound || !regimentStats.length) {
      alert('Please select a round to export');
      return;
    }

    try {
      const lossRates = getHighestLossRates(true); // Get all regiments
      const topDeaths = getTopIndividualDeaths();
      const timelineData = getRegimentLossesOverTime();
      const firstAndLastDeaths = getFirstAndLastDeaths();

      await generateRoundPDF({
        round: selectedRound,
        regimentStats,
        lossRates,
        topDeaths,
        timelineData,
        getPlayerPresenceData,
        logDate,
        firstAndLastDeaths,
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  const handleExportAnalysis = () => {
    if (!rounds || rounds.length === 0) {
      alert('No analysis data to export');
      return;
    }

    try {
      const analysisData = {
        rounds,
        selectedRound,
        logDate,
        playerAssignments,
        expandedRegiments,
        pinnedRegiment,
        timeRangeStart,
        timeRangeEnd,
        showAllLossRates,
        showAllTimeInCombat,
        exportedAt: new Date().toISOString(),
        version: '1.0'
      };

      const dataStr = JSON.stringify(analysisData, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `WoR_Analysis_${logDate ? logDate.replace(/\s+/g, '_') : new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting analysis:', error);
      alert('Failed to export analysis. Please try again.');
    }
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

    const regiment = regimentStats.find(r => r.name === regimentName);
    if (!regiment) return [];

    if (selectedRound.isScoreboard) {
      return Object.entries(regiment.players).map(([playerName, deathCount]) => ({
        name: playerName,
        deaths: deathCount,
        kills: regiment.playerKills?.[playerName] || 0,
        presence: 100
      })).sort((a, b) => b.kills - a.kills || b.deaths - a.deaths);
    }

    const roundDuration = getRoundDurationSeconds();
    if (roundDuration === 0) return [];

    const roundStartSeconds = timeToSeconds(selectedRound.startTime);
    const roundEndSeconds = timeToSeconds(selectedRound.endTime);

    const playerData = Object.entries(regiment.players).map(([playerName, deathCount]) => {
      let presenceSeconds = 0;
      let hasValidSessionData = false;

      const sessions = selectedRound.playerSessions[playerName];
      if (sessions && sessions.length > 0) {
        sessions.forEach(session => {
          const joinTime = timeToSeconds(session.join);
          const leaveTime = session.leave ? timeToSeconds(session.leave) : roundEndSeconds;
          if (joinTime > roundEndSeconds) return;
          const effectiveJoin = Math.max(joinTime, roundStartSeconds);
          const effectiveLeave = Math.min(leaveTime, roundEndSeconds);
          if (effectiveLeave > effectiveJoin) {
            hasValidSessionData = true;
            presenceSeconds += (effectiveLeave - effectiveJoin);
          }
        });
      }

      if (!hasValidSessionData) {
        presenceSeconds = roundDuration;
      }

      const presencePercentage = Math.min(100, Math.round((presenceSeconds / roundDuration) * 100));

      return {
        name: playerName,
        deaths: deathCount,
        kills: regiment.playerKills?.[playerName] || 0,
        presence: presencePercentage
      };
    });

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

    const currentAssignments = { ...playerAssignments } || {};
    currentAssignments[editingPlayer] = newRegiment;

    setPlayerAssignments(currentAssignments);

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

    const currentAssignments = { ...playerAssignments } || {};
    
    // Apply all pending edits
    Object.entries(pendingEdits).forEach(([playerName, regiment]) => {
      currentAssignments[playerName] = regiment;
    });

    setPlayerAssignments(currentAssignments);

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
    const assigned = playerAssignments[playerName];
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

    // Include known players not found in kills (from joins and chat)
    getKnownPlayers(selectedRound).forEach(playerName => {
      if (!playerMap[playerName]) {
        const baseRegiment = getPlayerRegiment(playerName);
        playerMap[playerName] = {
          name: playerName,
          regiment: baseRegiment,
          displayRegiment: pendingEdits[playerName] || baseRegiment,
          deaths: 0
        };
      }
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
    
    const assignments = playerAssignments || {};
    const roundDurationSeconds = getRoundDurationSeconds();
    
    if (roundDurationSeconds === 0) return { buckets: [], regiments: [], bucketSeconds: [] };
    
    // Create time buckets (every 1 min for granular data)
    const bucketSize = 60; // 60 seconds
    const numBuckets = Math.ceil(roundDurationSeconds / bucketSize);
    
    // Track deaths per regiment per time bucket and player counts
    const regimentTimeline = {};
    const regimentPlayerCounts = {};
    const playerRespawnSkipCount = {}; // Track how many respawns we've skipped per player
    const playerSessionCounts = {}; // Track how many sessions each player has
    
    // Count sessions for each player
    Object.entries(selectedRound.playerSessions).forEach(([playerName, sessions]) => {
      playerSessionCounts[playerName] = sessions.length;
    });
    
    const isScoreboard = selectedRound.isScoreboard || false;
    const roundStartSeconds = timeToSeconds(selectedRound.startTime);

    const processKill = (death, index) => {
      const regiment = normalizeRegimentTag(
        assignments[death.player] || extractRegimentTag(death.player)
      );
      if (regiment === 'UNTAGGED') return;

      if (!regimentPlayerCounts[regiment]) regimentPlayerCounts[regiment] = new Set();
      regimentPlayerCounts[regiment].add(death.player);

      let deathTimeSec;
      if (death.time && death.time !== 'Unknown') {
        deathTimeSec = timeToSeconds(death.time) - roundStartSeconds;
      } else {
        deathTimeSec = (index / selectedRound.kills.length) * roundDurationSeconds;
      }
      const bucketIndex = Math.floor(deathTimeSec / bucketSize);

      if (!regimentTimeline[regiment]) regimentTimeline[regiment] = Array(numBuckets).fill(0);
      if (bucketIndex >= 0 && bucketIndex < numBuckets) regimentTimeline[regiment][bucketIndex]++;
    };

    if (isScoreboard) {
      selectedRound.kills.forEach((death, index) => processKill(death, index));
    } else {
      selectedRound.kills.forEach((death, index) => {
        const sessionCount = playerSessionCounts[death.player] || 1;
        if (!playerRespawnSkipCount[death.player]) playerRespawnSkipCount[death.player] = 0;
        if (playerRespawnSkipCount[death.player] < sessionCount) {
          playerRespawnSkipCount[death.player]++;
          return;
        }
        processKill(death, index);
      });
    }
    
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

  const getRegimentKillsOverTime = () => {
    if (!selectedRound) return { buckets: [], regiments: [], bucketSeconds: [] };

    const assignments = playerAssignments || {};
    const roundDurationSeconds = getRoundDurationSeconds();

    if (roundDurationSeconds === 0) return { buckets: [], regiments: [], bucketSeconds: [] };

    const bucketSize = 60;
    const numBuckets = Math.ceil(roundDurationSeconds / bucketSize);

    const regimentTimeline = {};
    const regimentPlayerCounts = {};
    const isScoreboard = selectedRound.isScoreboard || false;
    const roundStartSeconds = timeToSeconds(selectedRound.startTime);

    const processKillEvent = (death, index) => {
      if (!death.killer || death.killer === '(environment)') return;
      if (death.cause && disabledDeathTypes.has(death.cause)) return;

      const regiment = normalizeRegimentTag(
        assignments[death.killer] || extractRegimentTag(death.killer)
      );
      if (regiment === 'UNTAGGED') return;

      if (!regimentPlayerCounts[regiment]) regimentPlayerCounts[regiment] = new Set();
      regimentPlayerCounts[regiment].add(death.killer);

      let deathTimeSec;
      if (death.time && death.time !== 'Unknown') {
        deathTimeSec = timeToSeconds(death.time) - roundStartSeconds;
      } else {
        deathTimeSec = (index / selectedRound.kills.length) * roundDurationSeconds;
      }
      const bucketIndex = Math.floor(deathTimeSec / bucketSize);

      if (!regimentTimeline[regiment]) regimentTimeline[regiment] = Array(numBuckets).fill(0);
      if (bucketIndex >= 0 && bucketIndex < numBuckets) regimentTimeline[regiment][bucketIndex]++;
    };

    if (isScoreboard) {
      selectedRound.kills.forEach((death, index) => processKillEvent(death, index));
    } else {
      const playerRespawnSkipCount = {};
      const playerSessionCounts = {};
      Object.entries(selectedRound.playerSessions).forEach(([playerName, sessions]) => {
        playerSessionCounts[playerName] = sessions.length;
      });

      selectedRound.kills.forEach((death, index) => {
        const sessionCount = playerSessionCounts[death.player] || 1;
        if (!playerRespawnSkipCount[death.player]) playerRespawnSkipCount[death.player] = 0;
        if (playerRespawnSkipCount[death.player] < sessionCount) {
          playerRespawnSkipCount[death.player]++;
          return;
        }
        processKillEvent(death, index);
      });
    }

    const filteredRegiments = Object.entries(regimentTimeline)
      .filter(([name]) => regimentPlayerCounts[name] && regimentPlayerCounts[name].size >= 2)
      .map(([name, kills]) => ({
        name,
        deaths: kills,
        total: kills.reduce((a, b) => a + b, 0)
      }))
      .sort((a, b) => b.total - a.total);

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

  const getTopIndividualDeaths = () => {
    if (!selectedRound) return [];

    const assignments = playerAssignments || {};
    const playerDeaths = {};
    const isScoreboard = selectedRound.isScoreboard || false;

    if (isScoreboard) {
      selectedRound.kills.forEach(death => {
        if (death.cause && disabledDeathTypes.has(death.cause)) return;
        const regiment = normalizeRegimentTag(assignments[death.player] || extractRegimentTag(death.player));
        if (!playerDeaths[death.player]) playerDeaths[death.player] = { name: death.player, regiment, deaths: 0 };
        playerDeaths[death.player].deaths++;
      });
    } else {
      const playerRespawnSkipCount = {};
      const playerSessionCounts = {};
      Object.entries(selectedRound.playerSessions).forEach(([playerName, sessions]) => {
        playerSessionCounts[playerName] = sessions.length;
      });

      selectedRound.kills.forEach(death => {
        const sessionCount = playerSessionCounts[death.player] || 1;
        if (!playerRespawnSkipCount[death.player]) playerRespawnSkipCount[death.player] = 0;
        if (playerRespawnSkipCount[death.player] < sessionCount) {
          playerRespawnSkipCount[death.player]++;
          return;
        }
        const regiment = normalizeRegimentTag(assignments[death.player] || extractRegimentTag(death.player));
        if (!playerDeaths[death.player]) playerDeaths[death.player] = { name: death.player, regiment, deaths: 0 };
        playerDeaths[death.player].deaths++;
      });
    }

    return Object.values(playerDeaths)
      .sort((a, b) => b.deaths - a.deaths)
      .slice(0, 10);
  };

  const getTopIndividualKills = () => {
    if (!selectedRound) return [];

    const assignments = playerAssignments || {};
    const playerKillCounts = {};

    if (selectedRound.kills.some(k => k.cause)) {
      selectedRound.kills.forEach(death => {
        if (death.cause && disabledDeathTypes.has(death.cause)) return;
        if (!death.killer || death.killer === '(environment)') return;
        const regiment = normalizeRegimentTag(assignments[death.killer] || extractRegimentTag(death.killer));
        if (!playerKillCounts[death.killer]) playerKillCounts[death.killer] = { name: death.killer, regiment, kills: 0 };
        playerKillCounts[death.killer].kills++;
      });
    } else if (selectedRound.playerKills) {
      Object.entries(selectedRound.playerKills).forEach(([playerName, killCount]) => {
        const regiment = normalizeRegimentTag(assignments[playerName] || extractRegimentTag(playerName));
        playerKillCounts[playerName] = { name: playerName, regiment, kills: killCount };
      });
    }

    return Object.values(playerKillCounts)
      .sort((a, b) => b.kills - a.kills)
      .slice(0, 10);
  };

  const getHighestKillRates = (showAll = false) => {
    if (!regimentStats.length) return [];

    const filtered = regimentStats
      .filter(regiment => {
        const playerCount = Object.keys(regiment.players).length;
        return regiment.name !== 'UNTAGGED' && playerCount >= 2 && regiment.kills > 0;
      })
      .map(regiment => {
        const playerCount = Object.keys(regiment.players).length;
        const killRate = (regiment.kills / playerCount).toFixed(2);
        return {
          name: regiment.name,
          kills: regiment.kills,
          playerCount,
          killRate: parseFloat(killRate),
          kd: regiment.kd,
        };
      })
      .sort((a, b) => b.killRate - a.killRate);

    return showAll ? filtered : filtered.slice(0, 10);
  };

  const getCasualtyBreakdown = () => {
    if (!selectedRound || !selectedRound.kills.some(k => k.cause)) return null;

    const allDeathTypes = [...new Set(selectedRound.kills.map(k => k.cause).filter(Boolean))];
    const activeKills = selectedRound.kills.filter(k => !k.cause || !disabledDeathTypes.has(k.cause));

    const buildBreakdown = (deaths) => {
      const byType = {};
      allDeathTypes.forEach(t => { byType[t] = 0; });
      deaths.forEach(d => {
        if (d.cause && !disabledDeathTypes.has(d.cause)) byType[d.cause] = (byType[d.cause] || 0) + 1;
      });
      return Object.entries(byType)
        .filter(([, count]) => count > 0)
        .sort((a, b) => b[1] - a[1]);
    };

    const overall = buildBreakdown(activeKills);
    const usaDeaths = activeKills.filter(k => k.victimTeam === 2);
    const csaDeaths = activeKills.filter(k => k.victimTeam === 1);
    const byFormation = {
      in_form: buildBreakdown(activeKills.filter(k => k.victimFormation === 'in_form')),
      skirm: buildBreakdown(activeKills.filter(k => k.victimFormation === 'skirm')),
      oob: buildBreakdown(activeKills.filter(k => k.victimFormation === 'oob')),
    };

    return {
      overall,
      usa: buildBreakdown(usaDeaths),
      csa: buildBreakdown(csaDeaths),
      byFormation,
      totals: {
        overall: activeKills.length,
        usa: usaDeaths.length,
        csa: csaDeaths.length,
        in_form: activeKills.filter(k => k.victimFormation === 'in_form').length,
        skirm: activeKills.filter(k => k.victimFormation === 'skirm').length,
        oob: activeKills.filter(k => k.victimFormation === 'oob').length,
      },
    };
  };

  // Get time in combat per regiment (based on periods with 5%+ casualty rate per minute)
  const getTimeInCombat = (showAll = false) => {
    if (!selectedRound || !regimentStats.length) return [];
    
    const assignments = playerAssignments || {};
    const roundDurationSeconds = getRoundDurationSeconds();
    
    if (roundDurationSeconds === 0) return [];
    
    const regimentCombatTime = {};
    const regimentPlayerCounts = {};
    const regimentDeathTimes = {}; // Track all death times per regiment
    const playerRespawnSkipCount = {}; // Track how many respawns we've skipped per player
    const playerSessionCounts = {}; // Track how many sessions each player has
    
    // Count sessions for each player
    Object.entries(selectedRound.playerSessions).forEach(([playerName, sessions]) => {
      playerSessionCounts[playerName] = sessions.length;
    });
    
    const isScoreboard = selectedRound.isScoreboard || false;
    const roundStartSeconds = timeToSeconds(selectedRound.startTime);

    const processCombatKill = (death, index) => {
      const regiment = normalizeRegimentTag(
        assignments[death.player] || extractRegimentTag(death.player)
      );
      if (regiment === 'UNTAGGED') return;

      let deathTimeSec;
      if (death.time && death.time !== 'Unknown') {
        deathTimeSec = timeToSeconds(death.time) - roundStartSeconds;
      } else {
        deathTimeSec = (index / selectedRound.kills.length) * roundDurationSeconds;
      }

      if (!regimentPlayerCounts[regiment]) regimentPlayerCounts[regiment] = new Set();
      regimentPlayerCounts[regiment].add(death.player);

      if (!regimentDeathTimes[regiment]) regimentDeathTimes[regiment] = [];
      regimentDeathTimes[regiment].push(deathTimeSec);

      if (!regimentCombatTime[regiment]) {
        regimentCombatTime[regiment] = { name: regiment, firstDeath: deathTimeSec, lastDeath: deathTimeSec, totalDeaths: 0 };
      }
      regimentCombatTime[regiment].firstDeath = Math.min(regimentCombatTime[regiment].firstDeath, deathTimeSec);
      regimentCombatTime[regiment].lastDeath = Math.max(regimentCombatTime[regiment].lastDeath, deathTimeSec);
      regimentCombatTime[regiment].totalDeaths++;
    };

    if (isScoreboard) {
      selectedRound.kills.forEach((death, index) => processCombatKill(death, index));
    } else {
      selectedRound.kills.forEach((death, index) => {
        const sessionCount = playerSessionCounts[death.player] || 1;
        if (!playerRespawnSkipCount[death.player]) playerRespawnSkipCount[death.player] = 0;
        if (playerRespawnSkipCount[death.player] < sessionCount) {
          playerRespawnSkipCount[death.player]++;
          return;
        }
        processCombatKill(death, index);
      });
    }
    
    const sorted = Object.values(regimentCombatTime)
      .filter(reg => regimentPlayerCounts[reg.name] && regimentPlayerCounts[reg.name].size >= 2)
      .map(reg => {
        const playerCount = regimentPlayerCounts[reg.name].size;
        const deathTimes = regimentDeathTimes[reg.name].sort((a, b) => a - b);
        
        // Calculate combat periods dynamically based on casualty rate
        // Combat starts when we see ≥5% casualties in a rolling window, ends when it drops below
        const combatPeriods = [];
        const windowSize = 30; // 30 second rolling window to check casualty rate
        const casualtyThreshold = Math.max(1, Math.ceil(playerCount * 0.05)); // 5% threshold, minimum 1
        
        let currentPeriod = null;
        
        // Process each death and check if we're in a combat period
        deathTimes.forEach((deathTime, index) => {
          // Count deaths in the rolling window ending at this death
          const windowStart = deathTime - windowSize;
          const deathsInWindow = deathTimes.filter(t => t > windowStart && t <= deathTime).length;
          
          const inCombat = deathsInWindow >= casualtyThreshold;
          
          if (inCombat) {
            if (!currentPeriod) {
              // Start new combat period
              currentPeriod = { start: deathTime, end: deathTime };
            } else {
              // Extend current combat period
              currentPeriod.end = deathTime;
            }
          } else if (currentPeriod) {
            // Check if we should end the current period
            // Look ahead to see if combat picks up again soon
            const lookAheadWindow = 15; // 15 seconds grace period
            const nextDeaths = deathTimes.slice(index + 1).filter(t => t <= deathTime + lookAheadWindow);
            
            if (nextDeaths.length === 0) {
              // No more deaths soon, end the period
              combatPeriods.push(currentPeriod);
              currentPeriod = null;
            } else {
              // Keep period open, might pick up again
              currentPeriod.end = deathTime;
            }
          }
        });
        
        // Close any open period
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
          combatDuration: totalActiveCombatTime,
          combatDurationFormatted: formatSeconds(totalActiveCombatTime),
          firstDeathFormatted: formatSeconds(reg.firstDeath),
          lastDeathFormatted: formatSeconds(reg.lastDeath),
          avgCombatDuration: avgCombatDuration,
          avgCombatDurationFormatted: formatSeconds(avgCombatDuration),
          combatPeriods: combatPeriods.length,
          casualtyThreshold: casualtyThreshold
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

  // Get first and last deaths of the round (excluding initial spawns)
  const getFirstAndLastDeaths = () => {
    if (!selectedRound) return { firstDeath: null, lastDeath: null };

    const assignments = playerAssignments || {};
    const validDeaths = [];

    if (selectedRound.isScoreboard) {
      selectedRound.kills.forEach((death, index) => {
        validDeaths.push({
          player: death.player,
          regiment: normalizeRegimentTag(assignments[death.player] || extractRegimentTag(death.player)),
          killer: death.killer || null,
          index
        });
      });
    } else {
      const playerRespawnSkipCount = {};
      const playerSessionCounts = {};
      Object.entries(selectedRound.playerSessions).forEach(([playerName, sessions]) => {
        playerSessionCounts[playerName] = sessions.length;
      });

      selectedRound.kills.forEach((death, index) => {
        const sessionCount = playerSessionCounts[death.player] || 1;
        if (!playerRespawnSkipCount[death.player]) playerRespawnSkipCount[death.player] = 0;
        if (playerRespawnSkipCount[death.player] < sessionCount) {
          playerRespawnSkipCount[death.player]++;
          return;
        }
        validDeaths.push({
          player: death.player,
          regiment: normalizeRegimentTag(assignments[death.player] || extractRegimentTag(death.player)),
          killer: death.killer || null,
          index
        });
      });
    }

    if (validDeaths.length === 0) return { firstDeath: null, lastDeath: null };

    return {
      firstDeath: validDeaths[0],
      lastDeath: validDeaths[validDeaths.length - 1]
    };
  };

  const getNemesisStats = () => {
    if (!selectedRound) return [];

    const killsWithKiller = selectedRound.kills.filter(k => k.killer);
    if (killsWithKiller.length === 0) return [];

    const pairCounts = {};
    killsWithKiller.forEach(({ killer, player: victim }) => {
      const key = `${killer} → ${victim}`;
      if (!pairCounts[key]) pairCounts[key] = { killer, victim, count: 0 };
      pairCounts[key].count++;
    });

    return Object.values(pairCounts)
      .filter(p => p.count >= 2)
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
  };

  const exportRegimentCasualtiesCSV = () => {
    if (!regimentStats.length || !selectedRound) return;

    const hasKills = regimentStats.some(r => r.kills > 0);
    const csvRows = [
      hasKills
        ? ['Regiment Name', 'Casualties', 'Player Count', 'Kills']
        : ['Regiment Name', 'Casualties', 'Player Count'],
      ...regimentStats.map(regiment => {
        const row = [
          regiment.name,
          regiment.casualties,
          Object.keys(regiment.players).length
        ];
        if (hasKills) row.push(regiment.kills || 0);
        return row;
      })
    ];

    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    const dateStr = logDate ? `_${logDate.replace(/\s+/g, '_')}` : '';
    link.setAttribute('href', url);
    link.setAttribute('download', `round_${selectedRound.id}_casualties${dateStr}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportCasualtyList = () => {
    if (!selectedRound) return;

    const assignments = playerAssignments || {};
    const regimentData = {};
    const isScoreboard = selectedRound.isScoreboard || false;

    if (isScoreboard) {
      selectedRound.kills.forEach(death => {
        const regiment = normalizeRegimentTag(assignments[death.player] || extractRegimentTag(death.player));
        if (!regimentData[regiment]) regimentData[regiment] = {};
        regimentData[regiment][death.player] = (regimentData[regiment][death.player] || 0) + 1;
      });
    } else {
      const playerRespawnSkipCount = {};
      const playerSessionCounts = {};
      Object.entries(selectedRound.playerSessions).forEach(([playerName, sessions]) => {
        playerSessionCounts[playerName] = sessions.length;
      });

      selectedRound.kills.forEach(death => {
        const sessionCount = playerSessionCounts[death.player] || 1;
        if (!playerRespawnSkipCount[death.player]) playerRespawnSkipCount[death.player] = 0;
        if (playerRespawnSkipCount[death.player] < sessionCount) {
          playerRespawnSkipCount[death.player]++;
          return;
        }
        const regiment = normalizeRegimentTag(assignments[death.player] || extractRegimentTag(death.player));
        if (!regimentData[regiment]) regimentData[regiment] = {};
        regimentData[regiment][death.player] = (regimentData[regiment][death.player] || 0) + 1;
      });
    }

    // Build text content
    let textContent = `Casualty List - Round ${selectedRound.id}\n`;
    textContent += `Generated: ${new Date().toLocaleString()}\n`;
    textContent += `${'='.repeat(50)}\n\n`;

    // Sort regiments alphabetically
    const sortedRegiments = Object.keys(regimentData).sort();

    sortedRegiments.forEach(regiment => {
      textContent += `${regiment}\n`;

      // Sort players by death count (descending)
      const players = Object.entries(regimentData[regiment])
        .sort((a, b) => b[1] - a[1]);

      players.forEach(([playerName, deathCount]) => {
        textContent += `- ${playerName} (${deathCount} ${deathCount === 1 ? 'time' : 'times'} died)\n`;
      });

      textContent += '\n';
    });

    // Create and download file
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    const dateStr = logDate ? `_${logDate.replace(/\s+/g, '_')}` : '';
    link.setAttribute('href', url);
    link.setAttribute('download', `round_${selectedRound.id}_casualty_list${dateStr}.txt`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-3 sm:p-6">
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

        <div className="bg-slate-800 rounded-lg shadow-2xl border border-slate-700 p-4 sm:p-8">
          <h1 className="text-2xl sm:text-4xl font-bold text-amber-400 mb-2 flex items-center gap-2 sm:gap-3">
            <Users className="w-7 h-7 sm:w-10 sm:h-10 shrink-0" />
            War of Rights Log Analyzer
          </h1>
          <p className="text-slate-400 mb-6 text-sm sm:text-base">Analyze rounds and regiment casualties from game logs</p>

          {/* File Upload */}
          <div className="mb-6 sm:mb-8">
            <label className="flex items-center justify-center w-full h-28 sm:h-32 px-4 transition bg-slate-700 border-2 border-slate-600 border-dashed rounded-lg hover:bg-slate-600 hover:border-amber-500 cursor-pointer">
              <div className="flex flex-col items-center space-y-2 text-center">
                <Upload className="w-7 h-7 sm:w-8 sm:h-8 text-amber-400" />
                <span className="text-slate-300 font-medium text-sm sm:text-base">
                  Click to upload log file, analysis file, scoreboard CSVs, or replay CSVs
                </span>
                <span className="text-slate-500 text-xs sm:text-sm">
                  .txt, .log, .json, or .csv (scoreboards + replays detected automatically)
                </span>
              </div>
              <input
                type="file"
                className="hidden"
                accept=".txt,.log,.json,.csv"
                multiple
                onChange={handleFileUpload}
              />
            </label>
          </div>

          {/* Rounds List */}
          {rounds.length > 0 && !showEditor && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-slate-700 rounded-lg p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4 gap-2">
                  <h2 className="text-lg sm:text-2xl font-bold text-amber-400 flex items-center gap-2 min-w-0">
                    <Clock className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
                    <span className="truncate">Rounds ({rounds.length}){logDate && ` - ${logDate}`}</span>
                  </h2>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => {
                        setRegimentModalKind('post');
                        setShowRegimentListModal(true);
                      }}
                      className="p-2 bg-amber-700 hover:bg-amber-600 text-white rounded transition"
                      title="Group players by an explicit regiment list"
                    >
                      <ListChecks className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleShare}
                      className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded transition"
                      title="Copy share link to clipboard"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                    {selectedRound && (
                      <button
                        onClick={handleExportPDF}
                        className="p-2 bg-amber-600 hover:bg-amber-700 text-white rounded transition"
                        title="Export current round to PDF"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={handleExportAnalysis}
                      className="p-2 bg-green-600 hover:bg-green-700 text-white rounded transition"
                      title="Export all analysis data"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
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
                      <div className="font-semibold flex items-center gap-2">
                        <span className="truncate">
                          {round.metadata?.area || round.metadata?.map
                            ? `${round.metadata.area || round.metadata.map}`
                            : round.isScoreboard ? `Round ${round.id}` : `Round ${round.id}`}
                        </span>
                        {round.replayId && (
                          <span title="Replay attached" className="shrink-0">
                            <Film className="w-4 h-4" />
                          </span>
                        )}
                      </div>
                      {round.metadata?.map && round.metadata?.mode && (
                        <div className="text-sm opacity-90">
                          {round.metadata.map} — {round.metadata.mode}
                        </div>
                      )}
                      {!round.isScoreboard && !round.metadata && (
                        <div className="text-sm opacity-90">
                          {round.startTime} - {round.endTime}
                        </div>
                      )}
                      {round.duration && (
                        <div className="text-sm opacity-75">
                          Duration: {round.duration}
                        </div>
                      )}
                      <div className="text-sm opacity-75">
                        {round.adjustedCasualties} casualties
                      </div>
                      <div className="text-sm opacity-75">
                        {getKnownPlayers(round).length} players
                      </div>
                      {round.metadata?.winner && (
                        <div className="text-sm font-semibold mt-1" style={{ color: round.metadata.winner === 'USA' ? '#60a5fa' : '#f87171' }}>
                          Winner: {round.metadata.winner}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Round Metadata & Casualty Breakdown */}
              {selectedRound?.metadata && (
                <div className="bg-slate-700 rounded-lg p-4 sm:p-6 lg:col-span-2">
                  <h2 className="text-lg sm:text-xl font-bold text-amber-400 mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 shrink-0" />
                    Round Summary
                  </h2>

                  {/* Top-level stats */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-4">
                    {selectedRound.metadata.casualties_usa && (
                      <div className="bg-slate-600 rounded p-3">
                        <div className="text-slate-400 text-xs">USA Losses</div>
                        <div className="text-blue-400 font-bold text-lg">{selectedRound.metadata.casualties_usa}</div>
                        <div className="text-xs text-slate-500 mt-1">
                          Form: {selectedRound.metadata.casualties_usa_in_form || 0} | Skirm: {selectedRound.metadata.casualties_usa_skirm || 0} | OOL: {selectedRound.metadata.casualties_usa_oob || 0}
                        </div>
                      </div>
                    )}
                    {selectedRound.metadata.casualties_csa && (
                      <div className="bg-slate-600 rounded p-3">
                        <div className="text-slate-400 text-xs">CSA Losses</div>
                        <div className="text-red-400 font-bold text-lg">{selectedRound.metadata.casualties_csa}</div>
                        <div className="text-xs text-slate-500 mt-1">
                          Form: {selectedRound.metadata.casualties_csa_in_form || 0} | Skirm: {selectedRound.metadata.casualties_csa_skirm || 0} | OOL: {selectedRound.metadata.casualties_csa_oob || 0}
                        </div>
                      </div>
                    )}
                    <div className="bg-slate-600 rounded p-3">
                      <div className="text-slate-400 text-xs">Total Losses</div>
                      <div className="text-amber-400 font-bold text-lg">
                        {(parseInt(selectedRound.metadata.casualties_usa || 0) + parseInt(selectedRound.metadata.casualties_csa || 0)) || selectedRound.adjustedCasualties}
                      </div>
                    </div>
                    {selectedRound.metadata.winner && (
                      <div className="bg-slate-600 rounded p-3">
                        <div className="text-slate-400 text-xs">Winner</div>
                        <div className={`font-bold text-lg ${selectedRound.metadata.winner === 'USA' ? 'text-blue-400' : 'text-red-400'}`}>
                          {selectedRound.metadata.winner}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          USA: {selectedRound.metadata.morale_usa || '—'} | CSA: {selectedRound.metadata.morale_csa || '—'}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Death Type Toggles */}
                  {selectedRound.kills.some(k => k.cause) && (
                    <div className="mb-4">
                      <div className="text-sm text-slate-400 mb-2">Death Type Filters (click to toggle):</div>
                      <div className="flex flex-wrap gap-2">
                        {(() => {
                          const causes = [...new Set(selectedRound.kills.map(k => k.cause).filter(Boolean))];
                          return causes.map(cause => {
                            const isDisabled = disabledDeathTypes.has(cause);
                            const count = selectedRound.kills.filter(k => k.cause === cause).length;
                            return (
                              <button
                                key={cause}
                                onClick={() => {
                                  const next = new Set(disabledDeathTypes);
                                  if (isDisabled) next.delete(cause);
                                  else next.add(cause);
                                  setDisabledDeathTypes(next);
                                }}
                                className={`px-3 py-1 rounded-full text-sm font-medium transition ${
                                  isDisabled
                                    ? 'bg-slate-800 text-slate-500 line-through'
                                    : 'bg-slate-600 text-slate-200 hover:bg-slate-500'
                                }`}
                              >
                                {cause} ({count})
                              </button>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Casualty Breakdown by Death Type */}
                  {(() => {
                    const breakdown = getCasualtyBreakdown();
                    if (!breakdown) return null;

                    const views = [
                      { key: 'overall', label: 'Overall' },
                      { key: 'usa', label: 'USA' },
                      { key: 'csa', label: 'CSA' },
                      { key: 'in_form', label: 'In Formation' },
                      { key: 'skirm', label: 'Skirmish' },
                      { key: 'oob', label: 'Out of Line' },
                    ];

                    const currentData = casualtyBreakdownView === 'in_form' || casualtyBreakdownView === 'skirm' || casualtyBreakdownView === 'oob'
                      ? breakdown.byFormation[casualtyBreakdownView]
                      : breakdown[casualtyBreakdownView] || breakdown.overall;

                    const currentTotal = breakdown.totals[casualtyBreakdownView] || breakdown.totals.overall;
                    const maxCount = currentData.length > 0 ? currentData[0][1] : 1;

                    const causeColors = {
                      Minie: 'bg-blue-500',
                      Cannon: 'bg-orange-500',
                      Round: 'bg-yellow-500',
                      Pellet: 'bg-lime-500',
                      Pistol: 'bg-purple-500',
                      Hexagonal: 'bg-pink-500',
                      Melee: 'bg-red-500',
                      Env: 'bg-slate-400',
                      Compression: 'bg-teal-500',
                    };

                    return (
                      <div>
                        <div className="text-sm text-slate-400 mb-2">Casualty Breakdown by Cause:</div>
                        <div className="flex flex-wrap gap-1 mb-3">
                          {views.map(v => (
                            <button
                              key={v.key}
                              onClick={() => setCasualtyBreakdownView(v.key)}
                              className={`px-3 py-1 rounded text-sm font-medium transition ${
                                casualtyBreakdownView === v.key
                                  ? 'bg-amber-600 text-white'
                                  : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                              }`}
                            >
                              {v.label} ({breakdown.totals[v.key] || 0})
                            </button>
                          ))}
                        </div>
                        <div className="space-y-1.5">
                          {currentData.map(([cause, count]) => (
                            <div key={cause} className="flex items-center gap-3">
                              <span className="text-sm text-slate-300 w-24 text-right shrink-0">{cause}</span>
                              <div className="flex-1 bg-slate-800 rounded-full h-5 overflow-hidden">
                                <div
                                  className={`${causeColors[cause] || 'bg-slate-500'} h-full rounded-full transition-all`}
                                  style={{ width: `${(count / maxCount) * 100}%` }}
                                />
                              </div>
                              <span className="text-sm text-slate-300 w-16 shrink-0">
                                {count} <span className="text-slate-500 text-xs">({currentTotal > 0 ? ((count / currentTotal) * 100).toFixed(0) : 0}%)</span>
                              </span>
                            </div>
                          ))}
                          {currentData.length === 0 && (
                            <div className="text-slate-500 text-sm text-center py-2">No casualties in this view</div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Replay Viewer (only when selected round has a replay attached) */}
              {selectedRound && selectedRound.replayId && (
                <div className="lg:col-span-2">
                  {replays.get(selectedRound.replayId) ? (
                    <div>
                      <div className="flex items-center justify-end mb-2">
                        <button
                          onClick={() => detachReplay(selectedRound.id)}
                          className="flex items-center gap-1 px-2 py-1 bg-red-700 hover:bg-red-600 text-white text-xs rounded transition"
                          title="Detach replay from this round"
                        >
                          <X className="w-3 h-3" /> Detach replay
                        </button>
                      </div>
                      <ReplayViewer
                        replay={replays.get(selectedRound.replayId)}
                        round={selectedRound}
                      />
                    </div>
                  ) : (
                    <div className="bg-slate-700 rounded-lg p-4 text-sm text-slate-400">
                      Loading replay from cache…
                    </div>
                  )}
                </div>
              )}

              {/* "Attach replay" prompt when the selected round has none */}
              {selectedRound && !selectedRound.replayId && (
                <div className="lg:col-span-2 bg-slate-700 rounded-lg p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm text-slate-300">
                    <Film className="w-4 h-4 text-slate-400" />
                    <span>No replay attached to this round.</span>
                  </div>
                  <label className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-sm cursor-pointer transition flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5" /> Attach replay CSV
                    <input
                      ref={replayInputRef}
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (!file) return;
                        const text = await file.text();
                        if (!looksLikeReplayCsv(text)) {
                          alert('That CSV does not look like a replay (header should start with map,...).');
                          return;
                        }
                        try {
                          const parsed = parseReplayCsv(text);
                          if (!parsed) return;
                          openReplayMatchModal(
                            [{ filename: file.name, replay: parsed }],
                            rounds
                          );
                          // Pre-select this round in the modal for convenience.
                          setReplayMatchModal(prev => prev && {
                            ...prev,
                            entries: prev.entries.map(en => ({ ...en, assignedRoundId: selectedRound.id })),
                          });
                        } catch (err) {
                          alert('Failed to parse replay: ' + err.message);
                        }
                      }}
                    />
                  </label>
                </div>
              )}

              {/* Regiment Statistics */}
              <div className="bg-slate-700 rounded-lg p-4 sm:p-6 lg:col-span-2">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
                  <h2 className="text-lg sm:text-2xl font-bold text-amber-400 flex items-center gap-2">
                    <Skull className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
                    Regiment Stats
                  </h2>
                  {selectedRound && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={exportRegimentCasualtiesCSV}
                        className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition text-sm"
                        title="Export as CSV"
                      >
                        <Download className="w-4 h-4" />
                        <span className="hidden sm:inline">Export</span> CSV
                      </button>
                      <button
                        onClick={generateSmartMatchPreview}
                        className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition text-sm"
                      >
                        <Zap className="w-4 h-4" />
                        Smart Match
                      </button>
                      <button
                        onClick={openEditor}
                        className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-sm"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit Players
                      </button>
                    </div>
                  )}
                </div>

                {/* Player / regiment search — filters the list below in place */}
                {selectedRound && regimentStats.length > 0 && (
                  <div className="relative mb-4">
                    <Skull className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    <input
                      type="text"
                      value={playerSearchQuery}
                      onChange={(e) => setPlayerSearchQuery(e.target.value)}
                      placeholder="Filter by player or regiment…"
                      className="w-full pl-9 pr-8 py-2 bg-slate-800 border border-slate-600 rounded text-slate-200 text-sm focus:outline-none focus:border-amber-500"
                    />
                    {playerSearchQuery && (
                      <button
                        onClick={() => setPlayerSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200"
                        title="Clear"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}

                {(() => {
                  // Filter the regiment list against the search query.
                  // Empty query → every regiment, every player.
                  // Query → keep regiments matched by name OR by any player; when
                  // a regiment matches only via a player, the expanded individual
                  // list is restricted to the matching player(s).
                  const q = playerSearchQuery.trim().toLowerCase();
                  let entries;
                  if (!q) {
                    entries = regimentStats.map(r => ({ reg: r, playerFilter: null }));
                  } else {
                    entries = [];
                    for (const reg of regimentStats) {
                      const regMatches = reg.name.toLowerCase().includes(q);
                      if (regMatches) {
                        entries.push({ reg, playerFilter: null });
                        continue;
                      }
                      const matching = Object.keys(reg.players).filter(n => n.toLowerCase().includes(q));
                      if (matching.length > 0) {
                        entries.push({ reg, playerFilter: new Set(matching) });
                      }
                    }
                  }

                  if (!selectedRound) {
                    return <p className="text-slate-400 text-center py-8">Select a round to view statistics</p>;
                  }
                  if (regimentStats.length === 0) {
                    return <p className="text-slate-400 text-center py-8">No casualties recorded in this round</p>;
                  }
                  if (entries.length === 0) {
                    return (
                      <div className="text-slate-400 text-sm px-2 py-3">
                        No regiments or players match "{playerSearchQuery}".
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-2 max-h-[32rem] overflow-y-auto">
                      {entries.map((entry, index) => {
                        const regiment = entry.reg;
                        const playerFilter = entry.playerFilter;
                        const individuals = getPlayerPresenceData(regiment.name);
                        const visibleIndividuals = playerFilter
                          ? individuals.filter(p => playerFilter.has(p.name))
                          : individuals;
                        return (
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
                            <div className={`grid ${regimentStats.some(r => r.kills > 0) ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2'} gap-2 sm:gap-4 text-sm`}>
                              <div>
                                <span className="text-slate-400">Deaths:</span>
                                <span className="text-red-400 font-semibold ml-2">
                                  {regiment.casualties}
                                </span>
                              </div>
                              {regimentStats.some(r => r.kills > 0) && (
                                <div>
                                  <span className="text-slate-400">Kills:</span>
                                  <span className="text-green-400 font-semibold ml-2">
                                    {regiment.kills}
                                  </span>
                                </div>
                              )}
                              {regimentStats.some(r => r.kills > 0) && (
                                <div>
                                  <span className="text-slate-400">K/D:</span>
                                  <span className={`font-semibold ml-2 ${regiment.kd >= 1 ? 'text-green-400' : 'text-red-400'}`}>
                                    {regiment.kd?.toFixed(2) || '0.00'}
                                  </span>
                                </div>
                              )}
                              <div>
                                <span className="text-slate-400">Players:</span>
                                <span className="text-blue-400 font-semibold ml-2">
                                  {playerFilter ? `${visibleIndividuals.length} / ${Object.keys(regiment.players).length}` : Object.keys(regiment.players).length}
                                </span>
                              </div>
                            </div>
                          </button>

                          {selectedRegiment?.name === regiment.name && (
                            <div className="bg-slate-700 p-4 border-t border-slate-500">
                              <h3 className="text-sm font-semibold text-amber-300 mb-3">
                                Individual Players{playerFilter ? ` (filtered)` : ''}
                              </h3>
                              <div className="space-y-2">
                                {visibleIndividuals.map((player) => (
                                  <div key={player.name} className="bg-slate-600 rounded p-3">
                                    <div className="flex justify-between items-start mb-2">
                                      <span className="text-white text-sm font-medium flex-1 mr-2">
                                        {player.name}
                                      </span>
                                      <div className="flex gap-3">
                                        {player.kills > 0 && (
                                          <span className="text-green-400 font-semibold text-sm whitespace-nowrap">
                                            {player.kills} {player.kills === 1 ? 'kill' : 'kills'}
                                          </span>
                                        )}
                                        <span className="text-red-400 font-semibold text-sm whitespace-nowrap">
                                          {player.deaths} {player.deaths === 1 ? 'death' : 'deaths'}
                                        </span>
                                        {player.kills > 0 && player.deaths > 0 && (
                                          <span className={`font-semibold text-sm whitespace-nowrap ${player.kills / player.deaths >= 1 ? 'text-green-300' : 'text-red-300'}`}>
                                            {(player.kills / player.deaths).toFixed(2)} K/D
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    {selectedRound?.playerFormations?.[player.name] && (
                                      <div className="flex gap-3 text-xs text-slate-400 mb-1">
                                        <span>Form: <span className="text-slate-300">{selectedRound.playerFormations[player.name].inForm}</span></span>
                                        <span>Skirm: <span className="text-slate-300">{selectedRound.playerFormations[player.name].skirm}</span></span>
                                        <span>OOL: <span className="text-slate-300">{selectedRound.playerFormations[player.name].oob}</span></span>
                                      </div>
                                    )}
                                    {selectedRound && selectedRound.startTime !== 'Unknown' && (
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
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* New Analytics Section */}
          {selectedRound && !showEditor && !showSmartMatchPreview && (
            <div className="mt-6 space-y-6">
              {/* Timeline Graph — hide for scoreboard rounds (no timestamps) */}
              {selectedRound.startTime !== 'Unknown' && <div className="bg-slate-700 rounded-lg p-4 sm:p-6">
                <h2 className="text-lg sm:text-2xl font-bold text-amber-400 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
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
                      <div className="relative bg-slate-800 rounded-lg p-2 sm:p-4 overflow-x-auto" style={{ height: `${graphHeight}px` }}>
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
              </div>}

              {/* Regiment Kills Over Time — only show when kills data exists */}
              {selectedRound.startTime !== 'Unknown' && regimentStats.some(r => r.kills > 0) && (() => {
                const killsTimelineData = getRegimentKillsOverTime();
                if (killsTimelineData.regiments.length === 0) return null;

                const colors = [
                  { line: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)' },
                  { line: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
                  { line: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
                  { line: '#f97316', bg: 'rgba(249, 115, 22, 0.1)' },
                  { line: '#eab308', bg: 'rgba(234, 179, 8, 0.1)' },
                  { line: '#a855f7', bg: 'rgba(168, 85, 247, 0.1)' },
                  { line: '#ec4899', bg: 'rgba(236, 72, 153, 0.1)' },
                  { line: '#06b6d4', bg: 'rgba(6, 182, 212, 0.1)' },
                  { line: '#84cc16', bg: 'rgba(132, 204, 22, 0.1)' },
                  { line: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
                ];

                const graphHeight = 300;
                const startIndex = Math.floor((killsTimeRangeStart / 100) * killsTimelineData.buckets.length);
                const endIndex = Math.ceil((killsTimeRangeEnd / 100) * killsTimelineData.buckets.length);

                const selectedRange = {
                  start: startIndex,
                  end: endIndex,
                  buckets: killsTimelineData.buckets.slice(startIndex, endIndex),
                  bucketSeconds: killsTimelineData.bucketSeconds.slice(startIndex, endIndex)
                };

                const regimentsInRange = killsTimelineData.regiments.map(regiment => {
                  const killsInRange = regiment.deaths.slice(startIndex, endIndex);
                  return { ...regiment, deathsInRange: killsInRange, totalInRange: killsInRange.reduce((a, b) => a + b, 0) };
                });

                const maxKillsInRange = Math.max(1, ...regimentsInRange.flatMap(r => r.deathsInRange));

                return (
                  <div className="bg-slate-700 rounded-lg p-4 sm:p-6">
                    <h2 className="text-lg sm:text-2xl font-bold text-amber-400 mb-4 flex items-center gap-2">
                      <Zap className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
                      Regiment Kills Over Time
                    </h2>
                    <div className="space-y-4">
                      {/* Time Range Slider */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <label className="text-white text-sm font-medium">
                            Time Range: {killsTimelineData.buckets[startIndex] || '0m'} - {killsTimelineData.buckets[Math.min(endIndex - 1, killsTimelineData.buckets.length - 1)] || '0m'}
                          </label>
                          <button
                            onClick={() => { setKillsTimeRangeStart(0); setKillsTimeRangeEnd(100); }}
                            className="text-xs text-amber-400 hover:text-amber-300 transition"
                          >
                            Reset Range
                          </button>
                        </div>
                        <div className="relative h-8 flex items-center">
                          <div className="absolute w-full h-2 bg-slate-600 rounded-lg" />
                          <div className="absolute h-2 bg-green-500 rounded-lg" style={{ left: `${killsTimeRangeStart}%`, width: `${killsTimeRangeEnd - killsTimeRangeStart}%` }} />
                          <input type="range" min="0" max="100" value={killsTimeRangeStart}
                            onChange={(e) => { const v = Number(e.target.value); if (v < killsTimeRangeEnd - 1) setKillsTimeRangeStart(v); }}
                            className="absolute w-full appearance-none bg-transparent pointer-events-none"
                            style={{ zIndex: killsTimeRangeStart > 50 ? 5 : 4 }} />
                          <input type="range" min="0" max="100" value={killsTimeRangeEnd}
                            onChange={(e) => { const v = Number(e.target.value); if (v > killsTimeRangeStart + 1) setKillsTimeRangeEnd(v); }}
                            className="absolute w-full appearance-none bg-transparent pointer-events-none"
                            style={{ zIndex: killsTimeRangeEnd <= 50 ? 5 : 4 }} />
                        </div>
                        <div className="flex justify-between text-xs text-slate-400 px-1">
                          <span>Start: {killsTimelineData.buckets[startIndex] || '0m'}</span>
                          <span>End: {killsTimelineData.buckets[Math.min(endIndex - 1, killsTimelineData.buckets.length - 1)] || '0m'}</span>
                        </div>
                      </div>

                      {/* Legend */}
                      <div className="flex flex-wrap gap-3">
                        {regimentsInRange.map((regiment, idx) => {
                          const isActive = killsPinnedRegiment === regiment.name || killsHoveredRegiment === regiment.name;
                          const shouldDim = (killsPinnedRegiment !== null && killsPinnedRegiment !== regiment.name) ||
                                          (killsPinnedRegiment === null && killsHoveredRegiment !== null && killsHoveredRegiment !== regiment.name);
                          return (
                            <div key={regiment.name} className="flex items-center gap-2 cursor-pointer transition-all hover:scale-105"
                              onMouseEnter={() => setKillsHoveredRegiment(regiment.name)}
                              onMouseLeave={() => setKillsHoveredRegiment(null)}
                              onClick={() => setKillsPinnedRegiment(killsPinnedRegiment === regiment.name ? null : regiment.name)}
                              style={{ opacity: shouldDim ? 0.3 : 1 }}>
                              <div className="w-4 h-4 rounded transition-all" style={{
                                backgroundColor: colors[idx % colors.length].line,
                                boxShadow: isActive ? `0 0 8px ${colors[idx % colors.length].line}` : 'none',
                                border: killsPinnedRegiment === regiment.name ? `2px solid ${colors[idx % colors.length].line}` : 'none'
                              }} />
                              <span className={`text-sm font-medium transition-colors ${killsPinnedRegiment === regiment.name ? 'text-amber-400' : 'text-white'}`}>
                                {regiment.name} ({regiment.totalInRange})
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Line Graph */}
                      <div className="relative bg-slate-800 rounded-lg p-2 sm:p-4 overflow-x-auto" style={{ height: `${graphHeight}px` }}>
                        <svg ref={killsSvgRef} width="100%" height="100%" viewBox={`0 0 1000 ${graphHeight}`} preserveAspectRatio="none" className="overflow-visible"
                          onMouseMove={(e) => {
                            if (!killsSvgRef.current) return;
                            const rect = killsSvgRef.current.getBoundingClientRect();
                            const x = e.clientX - rect.left;
                            const xPercent = x / rect.width;
                            const bucketIndex = Math.floor(xPercent * selectedRange.buckets.length);
                            if (bucketIndex >= 0 && bucketIndex < selectedRange.buckets.length) {
                              const timestamp = selectedRange.buckets[bucketIndex];
                              const activeRegiment = killsPinnedRegiment || killsHoveredRegiment;
                              const regimentData = regimentsInRange.map((reg, idx) => ({
                                name: reg.name, deaths: reg.deathsInRange[bucketIndex] || 0,
                                color: colors[idx % colors.length].line, isHighlighted: activeRegiment === reg.name
                              })).filter(r => r.deaths > 0);
                              setKillsHoverInfo({ timestamp, regiments: regimentData, x: e.clientX - rect.left, y: e.clientY - rect.top });
                            }
                          }}
                          onMouseLeave={() => setKillsHoverInfo(null)}>
                          {[0, 0.25, 0.5, 0.75, 1].map((fraction, i) => (
                            <line key={i} x1="0" y1={graphHeight - (fraction * graphHeight)} x2="1000" y2={graphHeight - (fraction * graphHeight)} stroke="#475569" strokeWidth="1" strokeDasharray="4" />
                          ))}
                          {regimentsInRange.map((regiment, regIndex) => {
                            const activeRegiment = killsPinnedRegiment || killsHoveredRegiment;
                            const isHighlighted = activeRegiment === null || activeRegiment === regiment.name;
                            const opacity = isHighlighted ? 1 : 0.15;
                            const strokeWidth = isHighlighted ? (activeRegiment === regiment.name ? 4 : 3) : 2;
                            const points = regiment.deathsInRange.map((count, bucketIndex) => {
                              const x = (bucketIndex / Math.max(1, regiment.deathsInRange.length - 1)) * 1000;
                              const y = graphHeight - ((count / maxKillsInRange) * (graphHeight - 20));
                              return `${x},${y}`;
                            }).join(' ');
                            return (
                              <g key={regiment.name}
                                onMouseEnter={() => setKillsHoveredRegiment(regiment.name)}
                                onMouseLeave={() => setKillsHoveredRegiment(null)}
                                onClick={() => setKillsPinnedRegiment(killsPinnedRegiment === regiment.name ? null : regiment.name)}
                                style={{ cursor: 'pointer' }}>
                                <polyline points={points} fill="none" stroke={colors[regIndex % colors.length].line}
                                  strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" opacity={opacity} className="transition-all duration-200" />
                                {regiment.deathsInRange.map((count, bucketIndex) => {
                                  const x = (bucketIndex / Math.max(1, regiment.deathsInRange.length - 1)) * 1000;
                                  const y = graphHeight - ((count / maxKillsInRange) * (graphHeight - 20));
                                  return <circle key={bucketIndex} cx={x} cy={y}
                                    r={isHighlighted ? (killsHoveredRegiment === regiment.name ? 5 : 4) : 3}
                                    fill={colors[regIndex % colors.length].line} opacity={opacity} className="transition-all duration-200" />;
                                })}
                              </g>
                            );
                          })}
                        </svg>
                        {killsHoverInfo && (
                          <div className="absolute bg-slate-900 border border-green-500 rounded-lg p-3 pointer-events-none z-10 shadow-xl"
                            style={{ left: `${killsHoverInfo.x + 10}px`, top: `${killsHoverInfo.y - 10}px`, transform: killsHoverInfo.x > 500 ? 'translateX(-100%) translateX(-20px)' : 'none' }}>
                            <div className="text-green-400 font-bold mb-2 text-sm">{killsHoverInfo.timestamp}</div>
                            {killsHoverInfo.regiments.length > 0 ? (
                              <div className="space-y-1">
                                {killsHoverInfo.regiments.map((reg) => {
                                  const activeRegiment = killsPinnedRegiment || killsHoveredRegiment;
                                  return (
                                    <div key={reg.name} className={`flex items-center gap-2 text-xs transition-all ${reg.isHighlighted ? 'scale-110' : activeRegiment !== null ? 'opacity-40' : ''}`}>
                                      <div className="w-3 h-3 rounded transition-all" style={{ backgroundColor: reg.color, boxShadow: reg.isHighlighted ? `0 0 8px ${reg.color}` : 'none' }} />
                                      <span className={`font-medium ${reg.isHighlighted ? 'text-green-400' : 'text-white'}`}>{reg.name}:</span>
                                      <span className={`font-bold ${reg.isHighlighted ? 'text-green-400' : 'text-green-400'}`}>{reg.deaths}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-slate-400 text-xs">No kills at this time</div>
                            )}
                          </div>
                        )}
                        <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-xs text-slate-400 pr-2">
                          <span>{maxKillsInRange}</span>
                          <span>{Math.floor(maxKillsInRange * 0.75)}</span>
                          <span>{Math.floor(maxKillsInRange * 0.5)}</span>
                          <span>{Math.floor(maxKillsInRange * 0.25)}</span>
                          <span>0</span>
                        </div>
                      </div>
                      <div className="flex justify-between text-xs text-slate-400 px-4">
                        {selectedRange.buckets.map((label, i) => {
                          const showEvery = Math.max(1, Math.ceil(selectedRange.buckets.length / 10));
                          return i % showEvery === 0 ? <span key={i} className="font-mono">{label}</span> : null;
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Two Column Layout for Tables */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Highest Loss Rates */}
                <div className="bg-slate-700 rounded-lg p-4 sm:p-6">
                  <div className="flex justify-between items-center mb-4 gap-2">
                    <h2 className="text-lg sm:text-2xl font-bold text-amber-400 flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
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

                {/* Highest Kill Rates */}
                {regimentStats.some(r => r.kills > 0) && (
                  <div className="bg-slate-700 rounded-lg p-4 sm:p-6">
                    <div className="flex justify-between items-center mb-4 gap-2">
                      <h2 className="text-lg sm:text-2xl font-bold text-amber-400 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
                        Highest Kill Rates
                      </h2>
                      <button
                        onClick={() => setShowAllKillRates(!showAllKillRates)}
                        className="px-3 py-1 bg-slate-600 hover:bg-slate-500 text-white rounded text-sm transition"
                      >
                        {showAllKillRates ? 'Top 10' : 'Show All'}
                      </button>
                    </div>
                    <div className="space-y-2">
                      {getHighestKillRates(showAllKillRates).map((regiment, index) => (
                        <div key={regiment.name} className="bg-slate-600 rounded-lg p-3">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-white font-semibold">
                              {index + 1}. {regiment.name}
                            </span>
                            <span className="text-green-400 font-bold text-lg">
                              {regiment.killRate}
                            </span>
                          </div>
                          <div className="text-sm text-slate-400">
                            {regiment.kills} kills / {regiment.playerCount} players (K/D: {regiment.kd?.toFixed(2)})
                          </div>
                          <div className="mt-2 bg-slate-800 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-green-500 to-emerald-500 h-full rounded-full"
                              style={{ width: `${Math.min(100, (regiment.killRate / 10) * 100)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Top Individual Deaths */}
                <div className="bg-slate-700 rounded-lg p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
                    <h2 className="text-lg sm:text-2xl font-bold text-amber-400 flex items-center gap-2">
                      <Award className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
                      Top 10 Individual Deaths
                    </h2>
                    <button
                      onClick={exportCasualtyList}
                      className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition text-sm shrink-0"
                      title="Export Casualty List"
                    >
                      <Download className="w-4 h-4" />
                      Export Casualty List
                    </button>
                  </div>
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

                {/* Top 10 Individual Kills */}
                {regimentStats.some(r => r.kills > 0) && (
                  <div className="bg-slate-700 rounded-lg p-4 sm:p-6">
                    <div className="flex justify-between items-center mb-4 gap-2">
                      <h2 className="text-lg sm:text-2xl font-bold text-amber-400 flex items-center gap-2">
                        <Award className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
                        Top 10 Individual Kills
                      </h2>
                    </div>
                    <div className="space-y-2">
                      {getTopIndividualKills().map((player, index) => (
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
                              <div className="text-green-400 font-bold text-xl">
                                {player.kills}
                              </div>
                              <div className="text-xs text-slate-400">kills</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Time in Combat Table — hide for scoreboard rounds */}
              {selectedRound.startTime !== 'Unknown' && <div className="bg-slate-700 rounded-lg p-4 sm:p-6">
                <div className="flex justify-between items-center mb-4 gap-2">
                  <h2 className="text-lg sm:text-2xl font-bold text-amber-400 flex items-center gap-2">
                    <Timer className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
                    <span className="hidden sm:inline">Time in Combat (Per Regiment)</span>
                    <span className="sm:hidden">Time in Combat</span>
                  </h2>
                  <button
                    onClick={() => setShowAllTimeInCombat(!showAllTimeInCombat)}
                    className="px-3 py-1 bg-slate-600 hover:bg-slate-500 text-white rounded text-sm transition shrink-0"
                  >
                    {showAllTimeInCombat ? 'Top 10' : 'Show All'}
                  </button>
                </div>
                <div className="mb-3 text-sm text-slate-400">
                  <p>Combat periods start when ≥5% of the regiment dies within 30 seconds and end when the casualty rate drops below that threshold. Excludes initial spawns.</p>
                </div>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
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
                {/* Mobile card layout */}
                <div className="md:hidden space-y-3">
                  {getTimeInCombat(showAllTimeInCombat).map((regiment, index) => (
                    <div key={regiment.name} className="bg-slate-600 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-amber-400 font-bold">{index + 1}.</span>
                        <span className="text-white font-semibold">{regiment.name}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                        <div><span className="text-slate-400">Duration:</span> <span className="text-green-400 font-semibold">{regiment.combatDurationFormatted}</span></div>
                        <div><span className="text-slate-400">Avg:</span> <span className="text-cyan-400 font-semibold">{regiment.avgCombatDurationFormatted}</span></div>
                        <div><span className="text-slate-400">Periods:</span> <span className="text-purple-400 font-semibold">{regiment.combatPeriods}</span></div>
                        <div><span className="text-slate-400">Deaths:</span> <span className="text-red-400 font-semibold">{regiment.totalDeaths}</span></div>
                        <div><span className="text-slate-400">First:</span> <span className="text-slate-300">{regiment.firstDeathFormatted}</span></div>
                        <div><span className="text-slate-400">Last:</span> <span className="text-slate-300">{regiment.lastDeathFormatted}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>}

              {/* First and Last Deaths — hide for scoreboard rounds */}
              {selectedRound.startTime !== 'Unknown' && <div className="bg-slate-700 rounded-lg p-4 sm:p-6">
                <h2 className="text-lg sm:text-2xl font-bold text-amber-400 mb-4 flex items-center gap-2">
                  <Skull className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
                  First & Last Deaths
                </h2>
                {(() => {
                  const { firstDeath, lastDeath } = getFirstAndLastDeaths();
                  
                  if (!firstDeath && !lastDeath) {
                    return (
                      <p className="text-slate-400 text-center py-8">
                        No deaths recorded in this round (excluding initial spawns)
                      </p>
                    );
                  }
                  
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* First Death */}
                      {firstDeath && (
                        <div className="bg-slate-600 rounded-lg p-6">
                          <h3 className="text-lg font-bold text-green-400 mb-4 flex items-center gap-2">
                            <Skull className="w-5 h-5" />
                            First Death
                          </h3>
                          <div className="space-y-3">
                            <div>
                              <div className="text-sm text-slate-400 mb-1">Player</div>
                              <div className="text-white font-semibold text-lg break-words">
                                {firstDeath.player}
                              </div>
                            </div>
                            <div>
                              <div className="text-sm text-slate-400 mb-1">Regiment</div>
                              <div className="inline-block px-3 py-1 bg-amber-600 text-white rounded font-semibold">
                                {firstDeath.regiment}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Last Death */}
                      {lastDeath && (
                        <div className="bg-slate-600 rounded-lg p-6">
                          <h3 className="text-lg font-bold text-red-400 mb-4 flex items-center gap-2">
                            <Skull className="w-5 h-5" />
                            Last Death
                          </h3>
                          <div className="space-y-3">
                            <div>
                              <div className="text-sm text-slate-400 mb-1">Player</div>
                              <div className="text-white font-semibold text-lg break-words">
                                {lastDeath.player}
                              </div>
                            </div>
                            <div>
                              <div className="text-sm text-slate-400 mb-1">Regiment</div>
                              <div className="inline-block px-3 py-1 bg-amber-600 text-white rounded font-semibold">
                                {lastDeath.regiment}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>}

              {/* Nemesis Stats */}
              {(() => {
                const nemeses = getNemesisStats();
                if (nemeses.length === 0) return null;
                return (
                  <div className="bg-slate-700 rounded-lg p-4 sm:p-6">
                    <h2 className="text-lg sm:text-2xl font-bold text-amber-400 mb-4 flex items-center gap-2">
                      <Skull className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
                      Nemesis Stats
                    </h2>
                    <p className="text-slate-400 text-sm mb-4">Players who killed the same opponent 2+ times</p>
                    <div className="space-y-2">
                      {nemeses.map((pair, index) => (
                        <div key={index} className="bg-slate-600 rounded-lg p-3 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
                            <span className="text-amber-400 font-bold w-6 text-right shrink-0">{index + 1}.</span>
                            <span className="text-green-400 font-semibold truncate text-sm sm:text-base">{pair.killer}</span>
                            <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 text-slate-400 shrink-0" />
                            <span className="text-red-400 font-semibold truncate text-sm sm:text-base">{pair.victim}</span>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-white font-bold text-base sm:text-lg">{pair.count}</span>
                            <span className="text-slate-400 text-xs sm:text-sm ml-1">{pair.count === 1 ? 'kill' : 'kills'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Smart Match Preview Modal */}
          {showSmartMatchPreview && smartMatchPreview && (
            <div className="bg-slate-700 rounded-lg p-4 sm:p-6 mb-6">
              <div className="flex justify-between items-center mb-6 gap-2">
                <h2 className="text-lg sm:text-2xl font-bold text-amber-400 flex items-center gap-2">
                  <Zap className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
                  <span className="hidden sm:inline">Smart Match Preview - {smartMatchPreview.length} Match{smartMatchPreview.length !== 1 ? 'es' : ''} Found</span>
                  <span className="sm:hidden">Smart Match ({smartMatchPreview.length})</span>
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
            <div className="bg-slate-700 rounded-lg p-4 sm:p-6">
              <div className="flex justify-between items-center mb-6 gap-2">
                <h2 className="text-lg sm:text-2xl font-bold text-amber-400 flex items-center gap-2">
                  <Edit2 className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
                  <span className="hidden sm:inline">Edit Player Assignments - Round {selectedRound.id}</span>
                  <span className="sm:hidden">Edit Players - R{selectedRound.id}</span>
                </h2>
                <button
                  onClick={closeEditor}
                  className="p-2 bg-slate-600 hover:bg-slate-500 rounded-lg transition shrink-0"
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
                    <div className="bg-slate-700 p-3 sm:p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
                        <button
                          onClick={() => toggleRegiment(regiment.name)}
                          className="flex items-center gap-2 flex-1 text-left hover:text-amber-400 transition min-w-0"
                        >
                          {expandedRegiments[regiment.name] ? (
                            <ChevronDown className="w-5 h-5 text-amber-400 shrink-0" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
                          )}
                          <span className="font-bold text-base sm:text-lg text-white truncate">
                            {regiment.name}
                          </span>
                          <span className="text-sm text-slate-400 shrink-0">
                            ({regiment.playerCount})
                          </span>
                        </button>

                        {/* Regiment Controls */}
                        <div className="flex items-center gap-2 flex-wrap pl-7 sm:pl-0">
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
                              <div className="flex items-center gap-2 flex-wrap">
                                <select
                                  value={newRegiment}
                                  onChange={(e) => setNewRegiment(e.target.value)}
                                  className="px-3 py-1 bg-slate-800 text-white rounded border border-slate-500 focus:border-amber-500 outline-none text-sm min-w-0 flex-1 sm:flex-none"
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

      <RegimentListModal
        isOpen={showRegimentListModal}
        mode={regimentModalKind}
        onApply={handleRegimentModalApply}
        onSkip={handleRegimentModalSkip}
      />

      {/* Replay → round match modal */}
      {replayMatchModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg shadow-2xl border border-slate-700 max-w-2xl w-full p-6">
            <div className="flex items-center gap-2 mb-4">
              <Film className="w-6 h-6 text-amber-400" />
              <h2 className="text-xl font-bold text-amber-400">Attach Replays to Rounds</h2>
            </div>
            <p className="text-sm text-slate-400 mb-4">
              Matched by closest filename timestamp. Pick a different round if needed,
              or choose "Skip" to leave a replay unattached.
            </p>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {replayMatchModal.entries.map((entry, idx) => (
                <div key={idx} className="bg-slate-700 rounded-lg p-3">
                  <div className="text-sm text-slate-200 font-mono truncate mb-1">
                    {entry.filename}
                  </div>
                  <div className="text-xs text-slate-400 mb-2">
                    {entry.replay.meta.map || 'unknown map'}
                    {entry.replay.meta.area && ` · ${entry.replay.meta.area}`}
                    {' · '}{entry.replay.frameCount} frames @ {entry.replay.meta.sampleRateHz} Hz
                    {' · '}{entry.replay.playerCount} players
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-400">Round:</label>
                    <select
                      value={entry.assignedRoundId ?? ''}
                      onChange={(e) => {
                        const val = e.target.value === '' ? null : parseInt(e.target.value, 10);
                        setReplayMatchModal(prev => ({
                          ...prev,
                          entries: prev.entries.map((en, i) => i === idx ? { ...en, assignedRoundId: val } : en),
                        }));
                      }}
                      className="flex-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                    >
                      <option value="">— Skip —</option>
                      {replayMatchModal.roundMeta.map(rm => (
                        <option key={rm.id} value={rm.id}>{rm.label}</option>
                      ))}
                    </select>
                  </div>
                  {entry.deltaMs != null && entry.assignedRoundId != null && (
                    <div className="text-xs text-slate-500 mt-1">
                      Time delta: {Math.round(entry.deltaMs / 1000)}s
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <button
                onClick={() => setReplayMatchModal(null)}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded transition text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => commitReplayMatches(replayMatchModal.entries)}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded transition text-sm font-semibold"
              >
                Attach
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WarOfRightsLogAnalyzer;