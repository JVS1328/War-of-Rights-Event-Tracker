/**
 * Grand Campaign state manipulation — pure functions, no side effects.
 *
 * Every export takes a campaign object and returns a new campaign. Never
 * mutates in place. Callers wire these into React setState.
 */

import { createToken, createMapPoint, createMapLine } from '../data/grandCampaign';

// ---------------------------------------------------------------------------
// ID generator — short, readable, collision-free within a session.
// ---------------------------------------------------------------------------
let _idCounter = 0;
const nextId = (prefix) => `${prefix}-${Date.now().toString(36)}-${(++_idCounter).toString(36)}`;

// ---------------------------------------------------------------------------
// Core helpers
// ---------------------------------------------------------------------------

/** True when `campaign` is a Grand Campaign style campaign. */
export const isGrandCampaign = (campaign) =>
  campaign?.campaignStyle === 'grand' && campaign.grandCampaign != null;

/** Distance in SVG units between two points. */
export const distance = (a, b) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
};

/** Convert inches (as stored in settings) to SVG units using the calibration constant. */
export const inchesToSvg = (inches, settings) =>
  inches * (settings?.svgUnitsPerInch || 10);

/**
 * Collision check — can this position hold a token without overlapping
 * another one? `ignoreTokenId` lets a token "move past itself" when editing.
 */
export const isPositionClear = (campaign, point, ignoreTokenId = null) => {
  const gc = campaign.grandCampaign;
  if (!gc) return true;
  const radius = inchesToSvg(gc.settings.tokenFootprintInches, gc.settings);
  return gc.tokens.every(t => {
    if (t.id === ignoreTokenId) return true;
    if (!t.position || t.status === 'wiped') return true;
    return distance(point, t.position) > radius * 2;
  });
};

// ---------------------------------------------------------------------------
// Token CRUD — each action also keeps the regiment list in lockstep (1:1).
// ---------------------------------------------------------------------------

/**
 * Add a new token. Simultaneously creates a matching regiment entry so the
 * regiment leaderboard and token roster stay 1:1.
 */
export const addToken = (campaign, { name, side }) => {
  if (!isGrandCampaign(campaign)) return campaign;
  if (side !== 'USA' && side !== 'CSA') return campaign;

  const regimentId = nextId('reg');
  const tokenId = nextId('tok');
  const startingStrength = campaign.grandCampaign.settings.startingTokenStrength;

  const newRegiment = { id: regimentId, name };
  const newToken = createToken({
    id: tokenId,
    regimentId,
    name,
    side,
    manpower: startingStrength,
  });

  return {
    ...campaign,
    regiments: {
      ...campaign.regiments,
      [side]: [...(campaign.regiments?.[side] || []), newRegiment],
    },
    grandCampaign: {
      ...campaign.grandCampaign,
      tokens: [...campaign.grandCampaign.tokens, newToken],
    },
  };
};

/** Rename a token (and its regiment). */
export const renameToken = (campaign, tokenId, newName) => {
  if (!isGrandCampaign(campaign)) return campaign;
  const token = campaign.grandCampaign.tokens.find(t => t.id === tokenId);
  if (!token) return campaign;

  return {
    ...campaign,
    regiments: {
      ...campaign.regiments,
      [token.side]: campaign.regiments[token.side].map(r =>
        r.id === token.regimentId ? { ...r, name: newName } : r
      ),
    },
    grandCampaign: {
      ...campaign.grandCampaign,
      tokens: campaign.grandCampaign.tokens.map(t =>
        t.id === tokenId ? { ...t, name: newName } : t
      ),
    },
  };
};

/** Remove a token and its regiment. Also scrubs bags and currentTokenId. */
export const removeToken = (campaign, tokenId) => {
  if (!isGrandCampaign(campaign)) return campaign;
  const token = campaign.grandCampaign.tokens.find(t => t.id === tokenId);
  if (!token) return campaign;

  const gc = campaign.grandCampaign;
  const side = token.side;

  return {
    ...campaign,
    regiments: {
      ...campaign.regiments,
      [side]: campaign.regiments[side].filter(r => r.id !== token.regimentId),
    },
    grandCampaign: {
      ...gc,
      tokens: gc.tokens.filter(t => t.id !== tokenId),
      bags: {
        USA: gc.bags.USA.filter(id => id !== tokenId),
        CSA: gc.bags.CSA.filter(id => id !== tokenId),
        discardUSA: gc.bags.discardUSA.filter(id => id !== tokenId),
        discardCSA: gc.bags.discardCSA.filter(id => id !== tokenId),
      },
      currentTokenId: gc.currentTokenId === tokenId ? null : gc.currentTokenId,
      lastDrawnTokenId: gc.lastDrawnTokenId === tokenId ? null : gc.lastDrawnTokenId,
    },
  };
};

/**
 * Manually move (or place) a token to a specific SVG point. Admin action —
 * ignores movement-point rules. Still enforces collision.
 */
export const moveTokenTo = (campaign, tokenId, point) => {
  if (!isGrandCampaign(campaign)) return campaign;
  if (!isPositionClear(campaign, point, tokenId)) return campaign;

  return {
    ...campaign,
    grandCampaign: {
      ...campaign.grandCampaign,
      tokens: campaign.grandCampaign.tokens.map(t =>
        t.id === tokenId ? { ...t, position: { x: point.x, y: point.y } } : t
      ),
    },
  };
};

/** Replace a token's full state (used for bulk edits: manpower, fatigue, side). */
export const updateToken = (campaign, tokenId, patch) => {
  if (!isGrandCampaign(campaign)) return campaign;
  return {
    ...campaign,
    grandCampaign: {
      ...campaign.grandCampaign,
      tokens: campaign.grandCampaign.tokens.map(t =>
        t.id === tokenId ? { ...t, ...patch } : t
      ),
    },
  };
};

// ---------------------------------------------------------------------------
// Map feature CRUD — cities / forts / stations (points), railways / rivers
// (polylines). All stored in grandCampaign.mapFeatures.
// ---------------------------------------------------------------------------

const POINT_KIND_TO_BUCKET = { city: 'cities', fort: 'forts', station: 'stations' };
const LINE_KIND_TO_BUCKET = { railway: 'railways', river: 'rivers' };

/** Add a point-type feature at a map position. */
export const addMapPoint = (campaign, { kind, name, x, y, side = 'NEUTRAL', isCapital = false }) => {
  if (!isGrandCampaign(campaign)) return campaign;
  const bucket = POINT_KIND_TO_BUCKET[kind];
  if (!bucket) return campaign;

  const feature = createMapPoint({
    id: nextId(kind),
    name: name || `${kind} ${campaign.grandCampaign.mapFeatures[bucket].length + 1}`,
    kind,
    x,
    y,
    side: kind === 'station' ? 'NEUTRAL' : side,
    isCapital: kind === 'city' ? isCapital : false,
  });

  return {
    ...campaign,
    grandCampaign: {
      ...campaign.grandCampaign,
      mapFeatures: {
        ...campaign.grandCampaign.mapFeatures,
        [bucket]: [...campaign.grandCampaign.mapFeatures[bucket], feature],
      },
    },
  };
};

/** Add a polyline-type feature (railway / river) from an array of points. */
export const addMapLine = (campaign, { kind, name, points }) => {
  if (!isGrandCampaign(campaign)) return campaign;
  if (!Array.isArray(points) || points.length < 2) return campaign;
  const bucket = LINE_KIND_TO_BUCKET[kind];
  if (!bucket) return campaign;

  const feature = createMapLine({
    id: nextId(kind),
    name: name || `${kind} ${campaign.grandCampaign.mapFeatures[bucket].length + 1}`,
    kind,
    points: points.map(p => ({ x: p.x, y: p.y })),
  });

  return {
    ...campaign,
    grandCampaign: {
      ...campaign.grandCampaign,
      mapFeatures: {
        ...campaign.grandCampaign.mapFeatures,
        [bucket]: [...campaign.grandCampaign.mapFeatures[bucket], feature],
      },
    },
  };
};

/** Patch any feature by id (searches every bucket). */
export const updateMapFeature = (campaign, featureId, patch) => {
  if (!isGrandCampaign(campaign)) return campaign;
  const mapFeatures = { ...campaign.grandCampaign.mapFeatures };
  let changed = false;
  for (const bucket of Object.keys(mapFeatures)) {
    const idx = mapFeatures[bucket].findIndex(f => f.id === featureId);
    if (idx >= 0) {
      mapFeatures[bucket] = [...mapFeatures[bucket]];
      mapFeatures[bucket][idx] = { ...mapFeatures[bucket][idx], ...patch };
      changed = true;
      break;
    }
  }
  if (!changed) return campaign;
  return {
    ...campaign,
    grandCampaign: { ...campaign.grandCampaign, mapFeatures },
  };
};

/** Delete any feature by id. */
export const removeMapFeature = (campaign, featureId) => {
  if (!isGrandCampaign(campaign)) return campaign;
  const mapFeatures = { ...campaign.grandCampaign.mapFeatures };
  let changed = false;
  for (const bucket of Object.keys(mapFeatures)) {
    const next = mapFeatures[bucket].filter(f => f.id !== featureId);
    if (next.length !== mapFeatures[bucket].length) {
      mapFeatures[bucket] = next;
      changed = true;
      break;
    }
  }
  if (!changed) return campaign;
  return {
    ...campaign,
    grandCampaign: { ...campaign.grandCampaign, mapFeatures },
  };
};

/** Flatten every feature into one iterable — handy for hit-testing / rendering. */
export const allMapFeatures = (campaign) => {
  if (!isGrandCampaign(campaign)) return [];
  const mf = campaign.grandCampaign.mapFeatures;
  return [
    ...mf.cities,
    ...mf.forts,
    ...mf.stations,
    ...mf.railways,
    ...mf.rivers,
  ];
};

// ---------------------------------------------------------------------------
// Setup wizard — coin flip & alternating placement.
// ---------------------------------------------------------------------------

const OPPOSITE_SIDE = { USA: 'CSA', CSA: 'USA' };

/** Resolve the coin flip and prime bags for alternating placement. */
export const resolveCoinFlip = (campaign, winner) => {
  if (!isGrandCampaign(campaign)) return campaign;
  if (winner !== 'USA' && winner !== 'CSA') return campaign;

  const gc = campaign.grandCampaign;
  const usaIds = gc.tokens.filter(t => t.side === 'USA').map(t => t.id);
  const csaIds = gc.tokens.filter(t => t.side === 'CSA').map(t => t.id);

  return {
    ...campaign,
    grandCampaign: {
      ...gc,
      phase: 'setup-placement',
      coinFlipWinner: winner,
      activeSide: winner,
      monthStartedBy: winner,
      bags: {
        USA: shuffleInPlace([...usaIds]),
        CSA: shuffleInPlace([...csaIds]),
        discardUSA: [],
        discardCSA: [],
      },
      currentTokenId: null,      // drawn by drawNextSetupToken
      lastDrawnTokenId: null,
    },
  };
};

/** Fisher-Yates shuffle — side-effect on the array, returned for convenience. */
function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Draw the next token for the current activeSide during setup. Returns the
 * updated campaign with currentTokenId set to the drawn token, or transitions
 * phase to 'playing' if both bags are empty.
 */
export const drawNextSetupToken = (campaign) => {
  if (!isGrandCampaign(campaign)) return campaign;
  const gc = campaign.grandCampaign;
  if (gc.phase !== 'setup-placement') return campaign;

  const side = gc.activeSide;
  const bagKey = side === 'USA' ? 'USA' : 'CSA';
  const bag = gc.bags[bagKey];

  if (bag.length === 0) {
    // This side's bag is empty — try the other side.
    const otherSide = OPPOSITE_SIDE[side];
    const otherBag = gc.bags[otherSide];
    if (otherBag.length === 0) {
      // All placed — transition to playing phase.
      return {
        ...campaign,
        grandCampaign: {
          ...gc,
          phase: 'playing',
          currentTokenId: null,
          activeSide: gc.coinFlipWinner, // first drawer of month 1 is the coin-flip winner
          currentTurn: gc.currentTurn,
        },
        currentTurn: 1,
      };
    }
    return drawNextSetupToken({
      ...campaign,
      grandCampaign: { ...gc, activeSide: otherSide },
    });
  }

  const [drawnId, ...rest] = bag;
  return {
    ...campaign,
    grandCampaign: {
      ...gc,
      bags: { ...gc.bags, [bagKey]: rest },
      currentTokenId: drawnId,
    },
  };
};

/**
 * Place the currently-drawn setup token at point. Enforces:
 *   - the point's containing territory must be owned by the token's side
 *   - collision (no overlapping existing tokens)
 * Returns { campaign, error } — error is null on success.
 */
export const placeSetupToken = (campaign, point, territoryOwner) => {
  if (!isGrandCampaign(campaign)) return { campaign, error: 'not a grand campaign' };
  const gc = campaign.grandCampaign;
  if (gc.phase !== 'setup-placement') return { campaign, error: 'not in setup placement phase' };

  const tokenId = gc.currentTokenId;
  if (!tokenId) return { campaign, error: 'no token drawn' };
  const token = gc.tokens.find(t => t.id === tokenId);
  if (!token) return { campaign, error: 'token not found' };

  if (!territoryOwner || territoryOwner !== token.side) {
    return { campaign, error: `Must place ${token.side} tokens in ${token.side}-controlled territory.` };
  }
  if (!isPositionClear(campaign, point, tokenId)) {
    return { campaign, error: 'That spot overlaps another token.' };
  }

  const placedCampaign = {
    ...campaign,
    grandCampaign: {
      ...gc,
      tokens: gc.tokens.map(t => t.id === tokenId ? { ...t, position: { x: point.x, y: point.y } } : t),
      currentTokenId: null,
      lastDrawnTokenId: tokenId,
      activeSide: OPPOSITE_SIDE[gc.activeSide],
    },
  };

  // Immediately draw the next token for the now-active side.
  const nextDrawn = drawNextSetupToken(placedCampaign);
  return { campaign: nextDrawn, error: null };
};

