import { CAMPAIGN_VERSION } from '../../utils/campaignValidation';
import { getDefaultStartDate } from '../../utils/dateSystem';
import { createDefaultBoard } from './defaultBoard';
import { createStarterDecks } from './starterCards';

export const DEFAULT_GRAND_SETTINGS = {
  startingMoney: 8000,
  startingManpower: 10000,
  manpowerPerToken: 2000,
  cityIncomeMoney: 50,
  cityIncomeManpower: 100,
  captureBonus: 750,
  winBonus: 400,
  replenishCost: 200,
  replenishManpowerCost: 100,
  replenishSoldiers: 100,
  winterAttritionPct: 25,
  trainRiverAmbushPct: 15,
  fatigueCasPctPerPoint: 5,
  garrisonMax: 500,
  reinforceShare: 0.4,
  lastStandLow: 100,
  lastStandHigh: 500,
  mpPerTurn: 2,
  marchHexPerMP: 2,
  riverHexPerMP: 3,
  trainHexPerMP: 4,
  vpToWin: 10,
  vpPerCapital: 2,
  vpPerWipe: 2,
  mapCooldownTurns: 2,
  conquestRollThreshold: 4,
  victoriesForSpecialCard: 5,
  winterMonths: [12, 1, 2]
};

const initFaction = (settings) => ({
  money: settings.startingMoney,
  manpower: settings.startingManpower,
  victories: 0,
  vp: 0,
  specialsEarned: 0,
  battleCards: [],
  specialCards: []
});

export const createGrandCampaign = (overrides = {}) => {
  const settings = { ...DEFAULT_GRAND_SETTINGS, ...(overrides.settings || {}) };
  const board = overrides.board || createDefaultBoard();
  const decks = overrides.decks || createStarterDecks();

  return {
    version: CAMPAIGN_VERSION,
    campaignType: 'grand-tabletop',
    id: Date.now().toString(),
    name: overrides.name || 'Grand Campaign',
    startDate: new Date().toISOString(),
    settings,
    board,
    factions: {
      USA: initFaction(settings),
      CSA: initFaction(settings)
    },
    units: [],
    turn: {
      month: 4,
      year: 1861,
      turnNumber: 1,
      winter: false,
      coinTossWinner: null,
      phase: 'setup',
      bags: { USA: [], CSA: [] },
      discards: { USA: [], CSA: [] },
      activeSide: null,
      activeUnitId: null,
      placementDrawnId: null,
      eventCardId: null,
      pendingBattleResults: [],
      lastActivityAt: null
    },
    decks,
    battles: [],
    log: [],
    mapHistory: []
  };
};
