// Pure card deck utilities: draw, discard, reshuffle.
// Decks are { draw: string[], discard: string[] }. Cards are ids (strings).

export const drawTop = (deck) => {
  if (!deck) return { card: null, deck };
  if (deck.draw.length === 0 && deck.discard.length === 0) {
    return { card: null, deck };
  }
  let workingDeck = deck;
  if (workingDeck.draw.length === 0) {
    workingDeck = reshuffle(workingDeck);
  }
  const [card, ...rest] = workingDeck.draw;
  return {
    card,
    deck: { draw: rest, discard: workingDeck.discard }
  };
};

export const drawN = (deck, n) => {
  let d = deck;
  const cards = [];
  for (let i = 0; i < n; i++) {
    const { card, deck: next } = drawTop(d);
    if (!card) break;
    cards.push(card);
    d = next;
  }
  return { cards, deck: d };
};

export const discardCard = (deck, card) => {
  return { draw: deck.draw, discard: [...deck.discard, card] };
};

export const putBackOnTop = (deck, card) => {
  return { draw: [card, ...deck.draw], discard: deck.discard };
};

export const reshuffle = (deck) => {
  const combined = [...deck.draw, ...deck.discard];
  for (let i = combined.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [combined[i], combined[j]] = [combined[j], combined[i]];
  }
  return { draw: combined, discard: [] };
};

export const addCardToLibrary = (library, card) => {
  return [...library, card];
};

export const removeCardFromLibrary = (library, cardId) => {
  return library.filter(c => c.id !== cardId);
};

export const updateCardInLibrary = (library, cardId, patch) => {
  return library.map(c => c.id === cardId ? { ...c, ...patch } : c);
};
