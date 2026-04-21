// Turn order, bag draws, calendar/month advance.

import { drawTop, discardCard } from './cardRules';

export const isWinterMonth = (month, winterMonths) => winterMonths.includes(month);

export const fillBags = (campaign) => {
  const aliveUsa = campaign.units.filter(u => u.faction === 'USA' && !u.wiped).map(u => u.id);
  const aliveCsa = campaign.units.filter(u => u.faction === 'CSA' && !u.wiped).map(u => u.id);
  return {
    ...campaign,
    turn: {
      ...campaign.turn,
      bags: { USA: aliveUsa, CSA: aliveCsa },
      discards: { USA: [], CSA: [] }
    }
  };
};

export const drawFromBag = (campaign, side) => {
  const bag = campaign.turn.bags[side];
  if (!bag || bag.length === 0) return { campaign, unitId: null };
  const idx = Math.floor(Math.random() * bag.length);
  const unitId = bag[idx];
  const newBag = bag.filter((_, i) => i !== idx);
  const unit = campaign.units.find(u => u.id === unitId);
  const isEngaged = unit?.engagedBattleId != null;
  const next = {
    ...campaign,
    turn: {
      ...campaign.turn,
      bags: { ...campaign.turn.bags, [side]: newBag },
      discards: {
        ...campaign.turn.discards,
        [side]: [...campaign.turn.discards[side], unitId]
      },
      activeUnitId: isEngaged ? null : unitId,
      activeSide: side
    }
  };
  return { campaign: next, unitId, skipped: isEngaged };
};

export const bothBagsEmpty = (campaign) =>
  campaign.turn.bags.USA.length === 0 && campaign.turn.bags.CSA.length === 0;

export const advanceMonth = (campaign, winterMonths) => {
  let { month, year, turnNumber } = campaign.turn;
  month += 1;
  if (month > 12) { month = 1; year += 1; }
  turnNumber += 1;
  return {
    ...campaign,
    turn: {
      ...campaign.turn,
      month,
      year,
      turnNumber,
      winter: isWinterMonth(month, winterMonths)
    }
  };
};

export const drawEventCard = (campaign) => {
  const deck = campaign.decks.event;
  const { card, deck: nextDeck } = drawTop(deck);
  return {
    ...campaign,
    decks: { ...campaign.decks, event: nextDeck },
    turn: { ...campaign.turn, eventCardId: card }
  };
};

export const discardEventCard = (campaign) => {
  const cardId = campaign.turn.eventCardId;
  if (!cardId) return campaign;
  return {
    ...campaign,
    decks: { ...campaign.decks, event: discardCard(campaign.decks.event, cardId) },
    turn: { ...campaign.turn, eventCardId: null }
  };
};

export const setCoinTossWinner = (campaign, winner) => ({
  ...campaign,
  turn: {
    ...campaign.turn,
    coinTossWinner: winner,
    activeSide: winner
  }
});

export const switchActiveSide = (campaign) => {
  const other = campaign.turn.activeSide === 'USA' ? 'CSA' : 'USA';
  return {
    ...campaign,
    turn: { ...campaign.turn, activeSide: other, activeUnitId: null }
  };
};

export const clearActiveUnit = (campaign) => ({
  ...campaign,
  turn: { ...campaign.turn, activeUnitId: null }
});

export const setPhase = (campaign, phase) => ({
  ...campaign,
  turn: { ...campaign.turn, phase }
});

export const nextDrawingSide = (campaign) => {
  const active = campaign.turn.activeSide;
  const other = active === 'USA' ? 'CSA' : 'USA';
  if (campaign.turn.bags[other].length > 0) return other;
  if (campaign.turn.bags[active].length > 0) return active;
  return null;
};
