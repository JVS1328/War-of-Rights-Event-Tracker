// Optional scoreboard-CSV parser for the Replay Suite.
//
// A scoreboard is OPTIONAL kill/casualty enrichment attached to a replay round.
// The replay is the spine (positions/headings/presence); a scoreboard adds the
// killer→victim→cause + exact counts the pose stream can't carry.
//
// This is lifted verbatim from the original LogAnalyzer.parseScoreboardCSV so
// the produced object keeps the exact `kills[]` / `metadata` shape that
// ReplayViewer already aligns to the replay timeline (via roundStartSec /
// killToReplayTs). Only the closure→module conversion changed.
//
// Returns a single parsed scoreboard object, or null when the text isn't a
// recognizable scoreboard.

function parseCSVLine(line) {
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
}

// Cheap detector to route an uploaded CSV between the replay path and the
// scoreboard path. A scoreboard has a "name,…,kills,…,deaths,…" player header.
export function looksLikeScoreboardCsv(text) {
  const rawLines = text.split('\n', 60);
  for (const raw of rawLines) {
    const lower = raw.trim().toLowerCase();
    if (lower.startsWith('name,') && lower.includes('kills') && lower.includes('deaths')) {
      return true;
    }
  }
  return false;
}

// Parse a scoreboard CSV into a round-shaped object:
//   { startTime, endTime, duration, kills[], playerKills, playerFormations,
//     metadata, players[], roster[], adjustedCasualties, isScoreboard }
// `kills[]` entries carry { player, victim, time, killer, cause,
// victimFormation, victimTeam, killerTeam, killerSteamId, victimSteamId } when a
// kill log is present. `players[]` carry an optional `steamId`. `roster[]` (when
// the scoreboard has a roster section) carries per-player
// { name, team, regiment, company, className, rank, steamId } — the in-game
// regiment/company/role the viewer surfaces on hover and in the side panel.
export function parseScoreboardCsv(csvText) {
  const rawLines = csvText.split('\n').map(l => l.replace(/\r$/, ''));
  if (rawLines.length < 2) return null;

  // Detect new format: metadata section starts with key,value pairs (no header
  // row with "kills").
  const firstLine = rawLines[0].toLowerCase();
  const hasMetadataSection = !firstLine.includes('kills') && firstLine.includes(',') && firstLine.split(',').length === 2;

  const metadata = {};
  let playerStartIdx = 0;

  if (hasMetadataSection) {
    // Parse metadata key-value pairs until we hit a blank line or a header row.
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
    // Skip blank lines to find player header.
    while (playerStartIdx < rawLines.length && !rawLines[playerStartIdx].trim()) playerStartIdx++;
  }

  // Find the player header row.
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
  // continuing to parse past the blank would re-parse those as player rows and
  // clobber officers' formation/kill counts with the wrong columns.
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

  // Find the roster section header (team,regiment,company,name,class,rank,
  // steam_id) — it sits between the player rows and the kill log in newer
  // scoreboards and carries each player's in-game regiment/company/role and
  // SteamID. Absent in older/replay-only rounds, which is fine.
  let rosterHeaderIdx = -1;
  for (let i = playerEndIdx; i < rawLines.length; i++) {
    if (rawLines[i].trim().toLowerCase().startsWith('team,regiment')) {
      rosterHeaderIdx = i;
      break;
    }
  }

  // Parse players.
  const nameIdx = playerHeader.indexOf('name');
  const teamIdx = playerHeader.indexOf('team');
  const killsIdx = playerHeader.indexOf('kills');
  const deathsIdx = playerHeader.indexOf('deaths');
  const formIdx = playerHeader.indexOf('deaths_in_form');
  const skirmIdx = playerHeader.indexOf('deaths_skirm');
  const oobIdx = playerHeader.indexOf('deaths_oob');
  const steamIdx = playerHeader.indexOf('steam_id');

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
    // SteamID64s exceed Number.MAX_SAFE_INTEGER — keep as a string so the id
    // survives round-tripping (used for Steam profile links in the viewer).
    if (steamIdx >= 0) player.steamId = (parts[steamIdx] || '').trim() || null;
    players.push(player);
  }

  if (players.length === 0) return null;

  // Parse the roster section if present. Rows end at the first blank line after
  // the header. Regiment/company/class/rank/steamId are all optional per row
  // (e.g. an "Unenlisted" player has no company or rank).
  const roster = [];
  if (rosterHeaderIdx >= 0) {
    const rHeader = parseCSVLine(rawLines[rosterHeaderIdx]).map(h => h.toLowerCase().trim());
    const rTeamIdx = rHeader.indexOf('team');
    const rRegIdx = rHeader.indexOf('regiment');
    const rCoyIdx = rHeader.indexOf('company');
    const rNameIdx = rHeader.indexOf('name');
    const rClassIdx = rHeader.indexOf('class');
    const rRankIdx = rHeader.indexOf('rank');
    const rSteamIdx = rHeader.indexOf('steam_id');
    const cell = (parts, idx) => (idx >= 0 ? (parts[idx] || '').trim() : '');
    for (let i = rosterHeaderIdx + 1; i < rawLines.length; i++) {
      if (!rawLines[i].trim()) break;               // section ends at blank line
      const parts = parseCSVLine(rawLines[i]);
      const name = cell(parts, rNameIdx);
      if (!name) continue;
      roster.push({
        name,
        team: cell(parts, rTeamIdx) || null,        // text team ("USA"/"CSA")
        regiment: cell(parts, rRegIdx) || null,
        company: cell(parts, rCoyIdx) || null,
        className: cell(parts, rClassIdx) || null,
        rank: cell(parts, rRankIdx) || null,
        steamId: cell(parts, rSteamIdx) || null,
      });
    }
  }

  // Parse kill log if present.
  const killLog = [];
  if (killLogHeaderIdx > 0) {
    const klHeader = parseCSVLine(rawLines[killLogHeaderIdx]).map(h => h.toLowerCase().trim());
    const tIdx = klHeader.indexOf('time');
    const krIdx = klHeader.indexOf('killer');
    const ktIdx = klHeader.indexOf('killer_team');
    const ksIdx = klHeader.indexOf('killer_steam_id');
    const vIdx = klHeader.indexOf('victim');
    const vtIdx = klHeader.indexOf('victim_team');
    const vsIdx = klHeader.indexOf('victim_steam_id');
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
        killerSteamId: ksIdx >= 0 ? (parts[ksIdx] || '').trim() || null : null,
        victim: parts[vIdx >= 0 ? vIdx : 3].trim(),
        victimTeam: parseInt(parts[vtIdx >= 0 ? vtIdx : 4]),
        victimSteamId: vsIdx >= 0 ? (parts[vsIdx] || '').trim() || null : null,
        victimFormation: vfIdx >= 0 ? parts[vfIdx].trim() : null,
        cause: cIdx >= 0 ? parts[cIdx].trim() : null,
      });
    }
  }

  const hasKillLog = killLog.length > 0;
  const playerKills = {};
  players.forEach(p => { playerKills[p.name] = p.kills; });

  // Build player formation data map.
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

  // Newer scoreboards carry explicit round_start_time / round_end_time in
  // metadata. Prefer those over first-kill → last-death because they cover the
  // full round window even when the first/last casualties land mid-round.
  const tsPattern = /^\d{2}:\d{2}:\d{2}$/;
  const metaStart = metadata.round_start_time && tsPattern.test(metadata.round_start_time) ? metadata.round_start_time : null;
  const metaEnd = metadata.round_end_time && tsPattern.test(metadata.round_end_time) ? metadata.round_end_time : null;

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
      killerSteamId: k.killerSteamId,
      victimSteamId: k.victimSteamId,
    }));

    const times = killLog.map(k => k.time);
    startTime = metaStart || times[0];
    endTime = metaEnd || times[times.length - 1];

    const s = startTime.split(':').map(Number);
    const e = endTime.split(':').map(Number);
    const durSec = (e[0] * 3600 + e[1] * 60 + e[2]) - (s[0] * 3600 + s[1] * 60 + s[2]);
    const mins = Math.floor(durSec / 60);
    const secs = durSec % 60;
    duration = `${mins}m ${secs}s`;
  } else if (metaStart && metaEnd) {
    deathEntries = [];
    players.forEach(p => {
      for (let d = 0; d < p.deaths; d++) {
        deathEntries.push({ player: p.name, time: null, cause: null });
      }
    });
    startTime = metaStart;
    endTime = metaEnd;
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

  const scoreboard = {
    startTime,
    endTime,
    duration,
    kills: deathEntries,
    adjustedCasualties: deathEntries.length,
    isScoreboard: true,
    playerKills,
    playerFormations,
    metadata: Object.keys(metadata).length > 0 ? metadata : null,
    players,
    roster,
  };

  return scoreboard;
}
