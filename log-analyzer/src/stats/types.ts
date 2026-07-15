/**
 * Typed model for an imported War of Rights scoreboard (one round).
 *
 * NOTE: steam IDs are kept as STRINGS. A SteamID64 (e.g. 76561198955655763)
 * exceeds Number.MAX_SAFE_INTEGER, so parsing as a number would corrupt it.
 */

export type Team = 'USA' | 'CSA';

/** In-CSV numeric team code → canonical team. */
export const TEAM_BY_CODE: Record<string, Team> = { '1': 'USA', '2': 'CSA' };

export type Formation = 'in_form' | 'skirm' | 'oob';

export interface TeamCasualties {
  total: number;
  inForm: number;
  skirm: number;
  oob: number;
}

export interface ScoreboardMeta {
  roundStartTime: string | null;
  roundEndTime: string | null;
  map: string;
  mode: string;
  area: string | null;
  winner: Team | null;
  popNow: number | null;
  popRoundStart: number | null;
  popRoundPeak: number | null;
  popRoundMax: number | null;
  popRoundEnd: number | null;
  moraleUsa: string | null;
  moraleCsa: string | null;
  casualties: Record<Team, TeamCasualties>;
  /** weapon/cause key → count, per team. */
  deathsByWeapon: Record<Team, Record<string, number>>;
}

export interface ScoreboardPlayer {
  name: string;
  team: Team;
  kills: number;
  deaths: number;
  kd: number;
  deathsInForm: number;
  deathsSkirm: number;
  deathsOob: number;
  steamId: string | null;
}

export interface ScoreboardOfficer {
  name: string;
  team: Team;
  commanded: number;
  /** true = artillery (battery), false = infantry. */
  battery: boolean;
}

export interface RosterEntry {
  team: Team;
  regiment: string | null;
  company: string | null;
  name: string;
  className: string | null;
  rank: string | null;
  steamId: string | null;
}

export interface Kill {
  tsInRound: string;
  killer: string | null;
  killerSteamId: string | null;
  killerTeam: Team | null;
  victim: string;
  victimSteamId: string | null;
  victimTeam: Team | null;
  victimFormation: Formation | null;
  cause: string;
  cat: number;
  sub: number;
}

export interface JoinLeave {
  tsInRound: string;
  name: string;
  steamId: string | null;
  action: 'joined' | 'left';
}

export interface Scoreboard {
  sourceFilename: string;
  /** ISO timestamp derived from the filename, or null if unparseable. */
  recordedAt: string | null;
  meta: ScoreboardMeta;
  players: ScoreboardPlayer[];
  officers: ScoreboardOfficer[];
  roster: RosterEntry[];
  kills: Kill[];
  joinLeaves: JoinLeave[];
}
