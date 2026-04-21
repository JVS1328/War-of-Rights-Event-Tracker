/**
 * Grand Campaign state manipulation — pure functions, no side effects.
 *
 * Every export takes a campaign object and returns a new campaign. Never
 * mutates in place. Callers wire these into React setState.
 */

import { createToken, createMapPoint, createMapLine } from '../data/grandCampaign';
import { advanceTurn as advanceCampaignDate } from './dateSystem';

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
      // All tokens placed — transition to playing phase. Refill both draw
      // bags from the placed roster so month 1 can actually draw turns.
      const usaIds = gc.tokens.filter(t => t.side === 'USA' && t.status !== 'wiped').map(t => t.id);
      const csaIds = gc.tokens.filter(t => t.side === 'CSA' && t.status !== 'wiped').map(t => t.id);
      return {
        ...campaign,
        currentTurn: 1,
        grandCampaign: {
          ...gc,
          phase: 'playing',
          currentTokenId: null,
          activeSide: gc.coinFlipWinner, // first drawer of month 1 = coin-flip winner
          monthStartedBy: gc.coinFlipWinner,
          bags: {
            USA: shuffleInPlace(usaIds),
            CSA: shuffleInPlace(csaIds),
            discardUSA: [],
            discardCSA: [],
          },
        },
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

// ---------------------------------------------------------------------------
// Core turn loop (phase: 'playing')
// ---------------------------------------------------------------------------

/** Count owned cities by side — economy driver. */
export const countOwnedCities = (campaign, side) => {
  if (!isGrandCampaign(campaign)) return 0;
  return campaign.grandCampaign.mapFeatures.cities.filter(c => c.side === side).length;
};

/**
 * Apply the start-of-month economy tick + refill draw bags. Called by
 * drawNextToken when both bags are empty. Advances currentTurn (our "month"
 * counter), swaps monthStartedBy, and resets activeSide to the new first-
 * drawer of the month.
 */
export const advanceMonth = (campaign) => {
  if (!isGrandCampaign(campaign)) return campaign;
  const gc = campaign.grandCampaign;
  const s = gc.settings;

  // Monthly economy — per owned city per side.
  const usaCities = countOwnedCities(campaign, 'USA');
  const csaCities = countOwnedCities(campaign, 'CSA');

  const newPools = {
    USA: {
      treasury: gc.pools.USA.treasury + usaCities * s.incomePerCity,
      manpower: gc.pools.USA.manpower + usaCities * s.manpowerPerCity,
    },
    CSA: {
      treasury: gc.pools.CSA.treasury + csaCities * s.incomePerCity,
      manpower: gc.pools.CSA.manpower + csaCities * s.manpowerPerCity,
    },
  };

  // First drawer of the new month flips.
  const newMonthStartedBy = OPPOSITE_SIDE[gc.monthStartedBy] || 'USA';

  // Refill bags from discards, reshuffled.
  const newUsaBag = shuffleInPlace([...gc.bags.discardUSA]);
  const newCsaBag = shuffleInPlace([...gc.bags.discardCSA]);

  // Advance campaign date by one real month (April 1861 → May 1861 → …).
  const nextDate = campaign.campaignDate
    ? advanceCampaignDate(campaign.campaignDate, 1)
    : campaign.campaignDate;

  // Accumulate territory influence from current token presence before the
  // new month begins. Each USA token inside a territory pushes it +1;
  // each CSA token pushes it -1. Magnitude capped at the threshold; when it
  // hits +/- threshold the owner flips.
  const tickedTerritories = applyInfluenceTick(campaign);

  return {
    ...campaign,
    territories: tickedTerritories,
    currentTurn: campaign.currentTurn + 1,
    campaignDate: nextDate,
    grandCampaign: {
      ...gc,
      pools: newPools,
      bags: { USA: newUsaBag, CSA: newCsaBag, discardUSA: [], discardCSA: [] },
      monthStartedBy: newMonthStartedBy,
      activeSide: newMonthStartedBy,
      currentTokenId: null,
    },
  };
};

// ---------------------------------------------------------------------------
// Territory influence — tokens inside a territory shift it toward their side.
// ---------------------------------------------------------------------------

/** Default influence contribution cap (matches MapView gradient saturation). */
export const INFLUENCE_THRESHOLD = 5;

/**
 * Scan all tokens and tally, per territory, the net influence delta:
 *   +1 per USA token inside, -1 per CSA token inside.
 * Returns the next territories array, with `influence` updated (clamped
 * to ±threshold) and `owner` flipped when influence saturates.
 */
export const applyInfluenceTick = (campaign) => {
  if (!isGrandCampaign(campaign)) return campaign.territories;
  const threshold = campaign.grandCampaign.settings.influenceThreshold ?? INFLUENCE_THRESHOLD;
  if (typeof document === 'undefined') return campaign.territories;
  const svg = document.querySelector('svg[viewBox="0 0 1000 589"]');
  if (!svg) return campaign.territories;

  // Bucket each token to a territory via DOM hit-test; cheap enough at this
  // scale (dozens of tokens × dozens of territories).
  const deltas = new Map(); // territoryId → net delta
  for (const token of campaign.grandCampaign.tokens) {
    if (!token.position || token.status === 'wiped') continue;
    const pt = svg.createSVGPoint();
    pt.x = token.position.x;
    pt.y = token.position.y;
    const paths = svg.querySelectorAll('[data-territory-id]');
    for (const path of paths) {
      try {
        if (path.isPointInFill && path.isPointInFill(pt)) {
          const id = path.dataset.territoryId;
          const d = token.side === 'USA' ? 1 : -1;
          deltas.set(id, (deltas.get(id) || 0) + d);
          break;
        }
      } catch (_) { /* ignore unsupported nodes */ }
    }
  }

  return campaign.territories.map(t => {
    const delta = deltas.get(t.id) || 0;
    if (delta === 0) return t;
    const current = typeof t.influence === 'number' ? t.influence : ownerToInfluence(t.owner, threshold);
    const next = Math.max(-threshold, Math.min(threshold, current + delta));
    let nextOwner = t.owner;
    if (next >= threshold) nextOwner = 'USA';
    else if (next <= -threshold) nextOwner = 'CSA';
    else if (next === 0) nextOwner = 'NEUTRAL';
    // If we crossed a sign boundary into a neutral zone, demote from side.
    return { ...t, influence: next, owner: nextOwner };
  });
};

/** Seed influence from a starting owner (used when creating a GC). */
export const ownerToInfluence = (owner, threshold = INFLUENCE_THRESHOLD) => {
  if (owner === 'USA') return threshold;
  if (owner === 'CSA') return -threshold;
  return 0;
};

/**
 * Draw the next token for the current activeSide during play. Handles:
 *   - empty bag → swap to the other side's bag
 *   - both bags empty → advanceMonth() and try again
 *   - drawn token is in combat → skip to discard and redraw
 * Returns the updated campaign with currentTokenId set (or unchanged if no
 * tokens exist at all).
 */
export const drawNextToken = (campaign) => {
  if (!isGrandCampaign(campaign)) return campaign;
  const gc = campaign.grandCampaign;
  if (gc.phase !== 'playing') return campaign;

  // Short-circuit: no tokens exist at all.
  const totalInBags =
    gc.bags.USA.length + gc.bags.CSA.length +
    gc.bags.discardUSA.length + gc.bags.discardCSA.length;
  if (totalInBags === 0) return campaign;

  const side = gc.activeSide;
  const bagKey = side;
  const bag = gc.bags[bagKey];

  if (bag.length === 0) {
    const otherSide = OPPOSITE_SIDE[side];
    if (gc.bags[otherSide].length === 0) {
      // Both live bags empty → end of month.
      return drawNextToken(advanceMonth(campaign));
    }
    return drawNextToken({
      ...campaign,
      grandCampaign: { ...gc, activeSide: otherSide },
    });
  }

  const [drawnId, ...rest] = bag;
  const drawnToken = gc.tokens.find(t => t.id === drawnId);
  const discardKey = side === 'USA' ? 'discardUSA' : 'discardCSA';

  // Skip tokens currently locked in a pending battle — per GC rules their
  // tile goes into the discard bag immediately.
  if (!drawnToken || drawnToken.status === 'wiped' || drawnToken.inCombat) {
    return drawNextToken({
      ...campaign,
      grandCampaign: {
        ...gc,
        bags: {
          ...gc.bags,
          [bagKey]: rest,
          [discardKey]: [...gc.bags[discardKey], drawnId],
        },
      },
    });
  }

  // Fresh turn for the drawn token — reset per-turn counters.
  return {
    ...campaign,
    grandCampaign: {
      ...gc,
      bags: { ...gc.bags, [bagKey]: rest },
      currentTokenId: drawnId,
      lastDrawnTokenId: drawnId,
      tokens: gc.tokens.map(t =>
        t.id === drawnId
          ? { ...t, movementPointsUsed: 0, combatThisTurn: false, lastActionMonth: campaign.currentTurn }
          : t
      ),
    },
  };
};

// ---------------------------------------------------------------------------
// Geometry — inch-based movement helpers.
// ---------------------------------------------------------------------------

/** Perpendicular distance from a point to a line segment AB. */
export const distanceToSegment = (p, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return distance(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return distance(p, { x: a.x + t * dx, y: a.y + t * dy });
};

/** Minimum distance from a point to any segment of a polyline. */
export const distanceToPolyline = (p, points) => {
  let min = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const d = distanceToSegment(p, points[i], points[i + 1]);
    if (d < min) min = d;
  }
  return min;
};

/** Do segments AB and CD intersect? Used for river-crossing detection. */
const segmentsIntersect = (a, b, c, d) => {
  const det = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
  if (det === 0) return false;
  const t = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / det;
  const u = ((c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)) / det;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
};

/** Count how many river segments the movement line crosses. */
const countRiverCrossings = (from, to, rivers) => {
  let n = 0;
  for (const r of rivers) {
    for (let i = 0; i < r.points.length - 1; i++) {
      if (segmentsIntersect(from, to, r.points[i], r.points[i + 1])) n++;
    }
  }
  return n;
};

/**
 * Evaluate a proposed move for a token. Returns an object describing all
 * available movement modes, their MP costs, the river crossing count, and
 * the suggested (cheapest available) mode. Does not mutate state.
 */
export const evaluateMove = (campaign, tokenId, destination) => {
  if (!isGrandCampaign(campaign)) return { valid: false, error: 'not a grand campaign' };
  const gc = campaign.grandCampaign;
  const token = gc.tokens.find(t => t.id === tokenId);
  if (!token) return { valid: false, error: 'token not found' };
  if (!token.position) return { valid: false, error: 'token has no position' };
  if (token.status === 'wiped') return { valid: false, error: 'wiped token cannot move' };

  const s = gc.settings;
  const from = token.position;
  const to = destination;
  const distSvg = distance(from, to);
  const inches = distSvg / (s.svgUnitsPerInch || 1);

  const railSnap = inchesToSvg(s.railSnapInches, s);
  const riverSnap = inchesToSvg(s.riverSnapInches, s);

  // Rail eligibility: token is at a city / fort / station AND destination is
  // near the same railway.
  const boardingFeatures = [
    ...gc.mapFeatures.cities,
    ...gc.mapFeatures.forts,
    ...gc.mapFeatures.stations,
  ];
  const atRailBoarding = boardingFeatures.some(f => distance(from, f) <= railSnap);
  const railAvailable = atRailBoarding && gc.mapFeatures.railways.some(r =>
    distanceToPolyline(from, r.points) <= railSnap &&
    distanceToPolyline(to, r.points) <= railSnap
  );

  // River eligibility: both start and destination are on the same river.
  const riverAvailable = gc.mapFeatures.rivers.some(r =>
    distanceToPolyline(from, r.points) <= riverSnap &&
    distanceToPolyline(to, r.points) <= riverSnap
  );

  // River crossings only add cost when marching — if travelling BY river you
  // follow its course, not crossing it.
  const crossings = riverAvailable ? 0 : countRiverCrossings(from, to, gc.mapFeatures.rivers);

  const marchCost = Math.max(1, Math.ceil(inches / s.marchInchesPerMP)) + crossings * s.riverCrossCost;
  const riverCost = riverAvailable ? Math.max(1, Math.ceil(inches / s.riverInchesPerMP)) : null;
  const railCost = railAvailable ? Math.max(1, Math.ceil(inches / s.railInchesPerMP)) : null;

  const options = { march: { cost: marchCost, available: true } };
  if (riverAvailable) options.river = { cost: riverCost, available: true };
  if (railAvailable) options.rail = { cost: railCost, available: true };

  // Cheapest wins.
  const suggested = Object.entries(options)
    .sort((a, b) => a[1].cost - b[1].cost)[0][0];

  return {
    valid: true,
    inches,
    crossings,
    options,
    suggested,
  };
};

/**
 * After a token arrives at a position, check whether it has walked into an
 * undefended enemy city/fort — if so, flip ownership, pay out $750, award
 * capital capture VP (if applicable), and end the token's turn per rules.
 *
 * Defended = an enemy token is within combat adjacency of the feature, OR
 * the feature carries a non-empty enemy garrison.
 */
export const applyCaptureAtPosition = (campaign, tokenId) => {
  if (!isGrandCampaign(campaign)) return { campaign, captured: null };
  const gc = campaign.grandCampaign;
  const token = gc.tokens.find(t => t.id === tokenId);
  if (!token || !token.position) return { campaign, captured: null };

  const radius = inchesToSvg(gc.settings.railSnapInches, gc.settings);
  const adjRadius = inchesToSvg(gc.settings.combatAdjacencyInches, gc.settings);
  const candidates = [
    ...gc.mapFeatures.cities.map(f => ({ ...f, bucket: 'cities' })),
    ...gc.mapFeatures.forts.map(f => ({ ...f, bucket: 'forts' })),
  ];

  const target = candidates.find(f =>
    f.side !== token.side &&
    distance(token.position, f) <= radius &&
    // Undefended by an enemy token?
    !gc.tokens.some(t2 =>
      t2.id !== tokenId && t2.side !== token.side && t2.position && t2.status !== 'wiped' &&
      distance(t2.position, f) <= adjRadius
    ) &&
    // No enemy garrison.
    (!f.garrison || f.garrison.men === 0 || f.garrison.side === token.side)
  );

  if (!target) return { campaign, captured: null };

  const isCapital = !!target.isCapital && target.bucket === 'cities';
  const payout = gc.settings.moneyPerCityCapture;
  const vpDelta = isCapital ? gc.settings.vpPerCapitalCapture : 0;

  // Update the feature: side flips, garrison cleared, capture history appended.
  const newFeature = {
    ...target,
    side: token.side,
    garrison: null,
    capturedBy: [...(target.capturedBy || []), { side: token.side, month: campaign.currentTurn }],
  };
  delete newFeature.bucket;

  let vpUSA = campaign.victoryPointsUSA || 0;
  let vpCSA = campaign.victoryPointsCSA || 0;
  if (token.side === 'USA') vpUSA += vpDelta;
  else vpCSA += vpDelta;

  const vpEvents = [...(gc.vpEvents || [])];
  if (isCapital) {
    vpEvents.push({
      type: 'capital',
      turn: campaign.currentTurn,
      side: token.side,
      featureId: target.id,
      vp: vpDelta,
    });
  }

  return {
    campaign: {
      ...campaign,
      victoryPointsUSA: vpUSA,
      victoryPointsCSA: vpCSA,
      grandCampaign: {
        ...gc,
        mapFeatures: {
          ...gc.mapFeatures,
          [target.bucket]: gc.mapFeatures[target.bucket].map(f => f.id === target.id ? newFeature : f),
        },
        pools: {
          ...gc.pools,
          [token.side]: {
            ...gc.pools[token.side],
            treasury: gc.pools[token.side].treasury + payout,
          },
        },
        vpEvents,
        // Capture ends the token's turn per rules.
        tokens: gc.tokens.map(t => t.id === tokenId ? {
          ...t,
          movementPointsUsed: gc.settings.movementPointsPerTurn,
        } : t),
      },
    },
    captured: { feature: newFeature, isCapital, payout, vpDelta },
  };
};

/**
 * Commit a move for a token using a specific mode. Deducts MP; rail/river
 * moves exhaust all remaining MP (board + disembark ends turn per rules).
 * Returns { campaign, error, turnEnds }.
 */
export const performMove = (campaign, tokenId, destination, mode) => {
  if (!isGrandCampaign(campaign)) return { campaign, error: 'not a grand campaign' };
  const evalResult = evaluateMove(campaign, tokenId, destination);
  if (!evalResult.valid) return { campaign, error: evalResult.error };

  const option = evalResult.options[mode];
  if (!option || !option.available) return { campaign, error: `Mode ${mode} not available` };

  const gc = campaign.grandCampaign;
  const token = gc.tokens.find(t => t.id === tokenId);
  const mpMax = gc.settings.movementPointsPerTurn;
  const mpLeft = mpMax - (token.movementPointsUsed || 0);

  if (option.cost > mpLeft) {
    return { campaign, error: `Not enough MP (need ${option.cost}, have ${mpLeft}).` };
  }
  if (!isPositionClear(campaign, destination, tokenId)) {
    return { campaign, error: 'Destination overlaps another token.' };
  }

  // Rail and river movement consume the remainder of the turn — disembarking
  // ends your turn per the rules. March keeps your MP available.
  const turnEnds = mode === 'rail' || mode === 'river';
  const newMpUsed = turnEnds ? mpMax : (token.movementPointsUsed || 0) + option.cost;

  const moved = {
    ...campaign,
    grandCampaign: {
      ...gc,
      tokens: gc.tokens.map(t => t.id === tokenId ? {
        ...t,
        position: { x: destination.x, y: destination.y },
        movementPointsUsed: newMpUsed,
      } : t),
    },
  };

  // Walking into an undefended enemy city/fort captures it and ends the turn.
  const captureResult = applyCaptureAtPosition(moved, tokenId);

  return {
    campaign: captureResult.campaign,
    error: null,
    turnEnds: turnEnds || !!captureResult.captured,
    capture: captureResult.captured,
  };
};

/**
 * End the currently-drawn token's turn: fatigue resets if the token did not
 * engage in combat this turn, token moves into the correct discard bag, and
 * activeSide flips. Caller is responsible for drawing the next token.
 */
export const endTokenTurn = (campaign) => {
  if (!isGrandCampaign(campaign)) return campaign;
  const gc = campaign.grandCampaign;
  if (!gc.currentTokenId) return campaign;

  const side = gc.activeSide;
  const discardKey = side === 'USA' ? 'discardUSA' : 'discardCSA';
  const token = gc.tokens.find(t => t.id === gc.currentTokenId);

  const updatedTokens = gc.tokens.map(t => {
    if (t.id !== gc.currentTokenId) return t;
    return {
      ...t,
      fatigue: t.combatThisTurn ? t.fatigue : 0,
      combatThisTurn: false,
      movementPointsUsed: 0,
    };
  });

  return {
    ...campaign,
    grandCampaign: {
      ...gc,
      tokens: updatedTokens,
      bags: {
        ...gc.bags,
        [discardKey]: [...gc.bags[discardKey], gc.currentTokenId],
      },
      lastDrawnTokenId: gc.currentTokenId,
      currentTokenId: null,
      activeSide: OPPOSITE_SIDE[side],
    },
  };
};

// ---------------------------------------------------------------------------
// Station/city/fort proximity — replenishment & garrison eligibility.
// ---------------------------------------------------------------------------

/** Friendly city or fort within railSnapInches of this token, or null. */
export const findStrongholdAtToken = (campaign, tokenId) => {
  if (!isGrandCampaign(campaign)) return null;
  const gc = campaign.grandCampaign;
  const token = gc.tokens.find(t => t.id === tokenId);
  if (!token || !token.position) return null;
  const radius = inchesToSvg(gc.settings.railSnapInches, gc.settings);
  const candidates = [
    ...gc.mapFeatures.cities.map(c => ({ ...c, bucket: 'cities' })),
    ...gc.mapFeatures.forts.map(f => ({ ...f, bucket: 'forts' })),
  ].filter(f => f.side === token.side && distance(token.position, f) <= radius);
  return candidates[0] || null;
};

/**
 * Nearest named map feature (city / fort / station) to a point, regardless
 * of side. Returns { feature, distance } or null. Used to label Grand
 * Campaign battles by their real-world location.
 */
export const findNearestNamedFeature = (campaign, point) => {
  if (!isGrandCampaign(campaign) || !point) return null;
  const gc = campaign.grandCampaign;
  const candidates = [
    ...gc.mapFeatures.cities,
    ...gc.mapFeatures.forts,
    ...gc.mapFeatures.stations,
  ];
  if (candidates.length === 0) return null;
  let best = null;
  for (const f of candidates) {
    const d = distance(point, f);
    if (!best || d < best.distance) best = { feature: f, distance: d };
  }
  return best;
};

/**
 * Hit-test a point (in SVG viewBox coords) against the currently-rendered
 * territory paths in the DOM. Uses SVGPathElement.isPointInFill so it works
 * under the map's transform group. Returns the matching territory object or
 * null. Safe to call in SSR (returns null if document is unavailable).
 */
export const findTerritoryAtSvgPoint = (campaign, point) => {
  if (typeof document === 'undefined' || !point) return null;
  const svg = document.querySelector('svg[viewBox="0 0 1000 589"]');
  if (!svg) return null;
  const svgPoint = svg.createSVGPoint();
  svgPoint.x = point.x;
  svgPoint.y = point.y;
  const paths = svg.querySelectorAll('[data-territory-id]');
  for (const path of paths) {
    try {
      if (path.isPointInFill && path.isPointInFill(svgPoint)) {
        const id = path.dataset.territoryId;
        return campaign.territories.find(t => t.id === id) || null;
      }
    } catch (_) { /* browsers that don't support isPointInFill on this node */ }
  }
  return null;
};

// ---------------------------------------------------------------------------
// Replenishment — active turn action at a friendly city/fort.
// ---------------------------------------------------------------------------

export const canReplenish = (campaign, tokenId) => {
  if (!isGrandCampaign(campaign)) return { ok: false, reason: 'not GC' };
  const gc = campaign.grandCampaign;
  const token = gc.tokens.find(t => t.id === tokenId);
  if (!token) return { ok: false, reason: 'no token' };
  if (token.status === 'wiped') return { ok: false, reason: 'wiped' };
  const mpLeft = gc.settings.movementPointsPerTurn - (token.movementPointsUsed || 0);
  if (mpLeft < 1) return { ok: false, reason: 'no MP' };
  if (!findStrongholdAtToken(campaign, tokenId)) return { ok: false, reason: 'not at friendly city/fort' };
  const pool = gc.pools[token.side];
  if (pool.treasury < gc.settings.replenishMoneyCost) return { ok: false, reason: 'not enough treasury' };
  if (pool.manpower < gc.settings.replenishManpowerCost) return { ok: false, reason: 'not enough national manpower' };
  return { ok: true };
};

export const performReplenish = (campaign, tokenId) => {
  const check = canReplenish(campaign, tokenId);
  if (!check.ok) return { campaign, error: check.reason };
  const gc = campaign.grandCampaign;
  const token = gc.tokens.find(t => t.id === tokenId);
  const s = gc.settings;

  return {
    campaign: {
      ...campaign,
      grandCampaign: {
        ...gc,
        pools: {
          ...gc.pools,
          [token.side]: {
            treasury: gc.pools[token.side].treasury - s.replenishMoneyCost,
            manpower: gc.pools[token.side].manpower - s.replenishManpowerCost,
          },
        },
        tokens: gc.tokens.map(t => t.id === tokenId ? {
          ...t,
          manpower: t.manpower + s.replenishYield,
          movementPointsUsed: s.movementPointsPerTurn, // ends turn
        } : t),
      },
    },
    error: null,
    turnEnds: true,
  };
};

// ---------------------------------------------------------------------------
// Garrison — detach up to maxGarrison men into a friendly city/fort.
// ---------------------------------------------------------------------------

/** Detach `men` from the drawn token into the stronghold at its position. */
export const performGarrison = (campaign, tokenId, featureId, men) => {
  if (!isGrandCampaign(campaign)) return { campaign, error: 'not GC' };
  const gc = campaign.grandCampaign;
  const token = gc.tokens.find(t => t.id === tokenId);
  if (!token || token.status === 'wiped') return { campaign, error: 'invalid token' };

  // Find the feature — search cities then forts.
  const bucket = gc.mapFeatures.cities.find(c => c.id === featureId)
    ? 'cities'
    : gc.mapFeatures.forts.find(f => f.id === featureId)
      ? 'forts' : null;
  if (!bucket) return { campaign, error: 'feature not a city/fort' };

  const feature = gc.mapFeatures[bucket].find(f => f.id === featureId);
  if (feature.side !== token.side) return { campaign, error: 'not a friendly stronghold' };

  const currentGarrison = feature.garrison?.men || 0;
  const amount = Math.max(0, Math.min(men, token.manpower, gc.settings.maxGarrison - currentGarrison));
  if (amount === 0) return { campaign, error: 'nothing to garrison' };

  const newGarrison = { side: token.side, men: currentGarrison + amount };

  return {
    campaign: {
      ...campaign,
      grandCampaign: {
        ...gc,
        mapFeatures: {
          ...gc.mapFeatures,
          [bucket]: gc.mapFeatures[bucket].map(f => f.id === featureId ? { ...f, garrison: newGarrison } : f),
        },
        tokens: gc.tokens.map(t => t.id === tokenId ? {
          ...t,
          manpower: t.manpower - amount,
          movementPointsUsed: gc.settings.movementPointsPerTurn, // ends turn
        } : t),
      },
    },
    error: null,
    turnEnds: true,
  };
};

/** Recall `men` from a friendly garrison back into the drawn token. Ends turn. */
export const performRecallGarrison = (campaign, tokenId, featureId, men) => {
  if (!isGrandCampaign(campaign)) return { campaign, error: 'not GC' };
  const gc = campaign.grandCampaign;
  const token = gc.tokens.find(t => t.id === tokenId);
  if (!token) return { campaign, error: 'no token' };

  const bucket = gc.mapFeatures.cities.find(c => c.id === featureId)
    ? 'cities'
    : gc.mapFeatures.forts.find(f => f.id === featureId)
      ? 'forts' : null;
  if (!bucket) return { campaign, error: 'feature not a city/fort' };

  const feature = gc.mapFeatures[bucket].find(f => f.id === featureId);
  if (!feature.garrison || feature.garrison.side !== token.side) {
    return { campaign, error: 'no friendly garrison' };
  }
  const amount = Math.max(0, Math.min(men, feature.garrison.men));
  if (amount === 0) return { campaign, error: 'nothing to recall' };

  const newMen = feature.garrison.men - amount;
  const newGarrison = newMen > 0 ? { ...feature.garrison, men: newMen } : null;

  return {
    campaign: {
      ...campaign,
      grandCampaign: {
        ...gc,
        mapFeatures: {
          ...gc.mapFeatures,
          [bucket]: gc.mapFeatures[bucket].map(f => f.id === featureId ? { ...f, garrison: newGarrison } : f),
        },
        tokens: gc.tokens.map(t => t.id === tokenId ? {
          ...t,
          manpower: t.manpower + amount,
          movementPointsUsed: gc.settings.movementPointsPerTurn,
        } : t),
      },
    },
    error: null,
    turnEnds: true,
  };
};

// ---------------------------------------------------------------------------
// Combat — adjacency, supporters, casualty resolution, retreat, VP events.
// ---------------------------------------------------------------------------

/** Return opposite-side live tokens within combat adjacency of `tokenId`. */
export const findAttackTargets = (campaign, tokenId) => {
  if (!isGrandCampaign(campaign)) return [];
  const gc = campaign.grandCampaign;
  const attacker = gc.tokens.find(t => t.id === tokenId);
  if (!attacker || !attacker.position || attacker.status !== 'active') return [];
  const radius = inchesToSvg(gc.settings.combatAdjacencyInches, gc.settings);
  return gc.tokens.filter(t =>
    t.id !== tokenId &&
    t.position &&
    t.status !== 'wiped' &&
    t.side !== attacker.side &&
    !t.inCombat &&
    distance(attacker.position, t.position) <= radius
  );
};

/**
 * Return same-side live, free tokens within support range of the *engaged
 * token* (attacker or defender) — exactly one of these may reinforce.
 */
export const findSupporters = (campaign, engagedTokenId, exclude = []) => {
  if (!isGrandCampaign(campaign)) return [];
  const gc = campaign.grandCampaign;
  const engaged = gc.tokens.find(t => t.id === engagedTokenId);
  if (!engaged || !engaged.position) return [];
  const radius = inchesToSvg(gc.settings.supportRangeInches, gc.settings);
  return gc.tokens.filter(t =>
    t.id !== engagedTokenId &&
    !exclude.includes(t.id) &&
    t.position &&
    t.status !== 'wiped' &&
    t.side === engaged.side &&
    !t.inCombat &&
    distance(engaged.position, t.position) <= radius
  );
};

/**
 * Compute a human-readable location label for a battle at `position` — the
 * nearest named feature if within ~1 inch, otherwise the containing
 * territory name, otherwise null.
 */
export const describeBattleLocation = (campaign, position) => {
  if (!isGrandCampaign(campaign) || !position) return null;
  const gc = campaign.grandCampaign;
  const near = findNearestNamedFeature(campaign, position);
  const nearLimit = inchesToSvg(1.0, gc.settings);
  if (near && near.distance <= nearLimit) {
    const kindLabel = near.feature.kind === 'city'
      ? (near.feature.isCapital ? 'capital of' : 'at')
      : near.feature.kind === 'fort'
        ? 'at Fort' : 'near';
    return `${kindLabel} ${near.feature.name}`;
  }
  const territory = findTerritoryAtSvgPoint(campaign, position);
  if (territory) return `in ${territory.name}`;
  return null;
};

/**
 * Create a pending Grand Campaign battle. Marks all participants as inCombat
 * so they're skipped if drawn, records the attacker's turn as over (per GC
 * rules — an attack ends your turn), and appends a battle entry.
 *
 * payload: { attackerId, defenderId, attackerSupportId?, defenderSupportId?, mapName, battleId? }
 */
export const createGCBattle = (campaign, payload) => {
  if (!isGrandCampaign(campaign)) return campaign;
  const gc = campaign.grandCampaign;
  const { attackerId, defenderId, attackerSupportId, defenderSupportId, mapName, battleId } = payload;

  const attacker = gc.tokens.find(t => t.id === attackerId);
  const defender = gc.tokens.find(t => t.id === defenderId);
  if (!attacker || !defender) return campaign;

  const participantIds = [attackerId, defenderId, attackerSupportId, defenderSupportId].filter(Boolean);
  const locationLabel = describeBattleLocation(campaign, defender.position);
  // Stash a territoryId for the legacy validator: use defender's containing
  // territory if we can identify it, else the sentinel 'grand-campaign'.
  const defenderTerritory = findTerritoryAtSvgPoint(campaign, defender.position);

  const battle = {
    id: battleId || nextId('battle'),
    mode: 'grand',
    turn: campaign.currentTurn,
    status: 'pending',
    mapName: mapName || 'Unknown Map',
    attacker: attacker.side,
    defender: defender.side,
    attackerTokenId: attackerId,
    defenderTokenId: defenderId,
    attackerSupportId: attackerSupportId || null,
    defenderSupportId: defenderSupportId || null,
    winner: null,
    casualties: null,
    resolution: null,
    locationLabel: locationLabel || null,
    // territoryId — real one if we resolved it, else sentinel for validation.
    territoryId: defenderTerritory?.id || 'grand-campaign',
  };

  return {
    ...campaign,
    battles: [...campaign.battles, battle],
    grandCampaign: {
      ...gc,
      tokens: gc.tokens.map(t => participantIds.includes(t.id) ? {
        ...t,
        inCombat: true,
        combatThisTurn: true,
      } : t),
      // Attacker's turn ends when declaring an attack.
      currentTokenId: null,
      lastDrawnTokenId: attackerId,
      activeSide: OPPOSITE_SIDE[gc.activeSide],
      bags: {
        ...gc.bags,
        [gc.activeSide === 'USA' ? 'discardUSA' : 'discardCSA']: [
          ...gc.bags[gc.activeSide === 'USA' ? 'discardUSA' : 'discardCSA'],
          attackerId,
        ],
      },
    },
  };
};

/**
 * Apply rule-based casualty modifiers to a raw number. Flags: fatigue points
 * on the receiving token, whether the token is the attacker in a winter
 * month, and whether the token is on a train/river at the time.
 */
export const applyCasualtyModifiers = (raw, { fatigue = 0, isAttackerInWinter = false, onTrainOrRiver = false }, settings) => {
  const s = settings;
  const mult =
    1 +
    (fatigue * s.fatigueCasPct) / 100 +
    (isAttackerInWinter ? s.winterAttackerCasPct / 100 : 0) +
    (onTrainOrRiver ? s.trainRiverCasPct / 100 : 0);
  return Math.round(raw * mult);
};

/** Is the current campaign month a winter month? */
export const isWinterMonth = (campaign) => {
  if (!isGrandCampaign(campaign)) return false;
  const s = campaign.grandCampaign.settings;
  const winters = s.winterMonths || [];
  // Derive game-month-of-year from currentTurn + campaignDate. If date isn't
  // tracked precisely, assume turn N maps to month ((N-1) % 12) + 1.
  const month = ((campaign.currentTurn - 1) % 12) + 1;
  return winters.includes(month);
};

/** Nearest friendly city or fort to a point; null if none. */
const nearestFriendlyStronghold = (gc, side, from) => {
  const candidates = [
    ...gc.mapFeatures.cities.filter(c => c.side === side),
    ...gc.mapFeatures.forts.filter(f => f.side === side),
  ];
  if (candidates.length === 0) return null;
  return candidates.reduce((best, c) =>
    !best || distance(from, c) < distance(from, best) ? c : best
  , null);
};

/** Retreat `tokenId` toward its side's nearest city/fort, up to 4 march-MP. */
const applyRetreat = (campaign, tokenId) => {
  if (!isGrandCampaign(campaign)) return campaign;
  const gc = campaign.grandCampaign;
  const token = gc.tokens.find(t => t.id === tokenId);
  if (!token || !token.position) return campaign;

  const target = nearestFriendlyStronghold(gc, token.side, token.position);
  if (!target) return campaign;

  const maxInches = 4 * gc.settings.marchInchesPerMP; // per rules: 4 hexes
  const maxSvg = inchesToSvg(maxInches, gc.settings);
  const dx = target.x - token.position.x;
  const dy = target.y - token.position.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d === 0) return campaign;
  const step = Math.min(d, maxSvg);
  const nx = token.position.x + (dx / d) * step;
  const ny = token.position.y + (dy / d) * step;

  // If the retreat spot overlaps another token, nudge along until clear or
  // give up (up to a few attempts).
  let candidate = { x: nx, y: ny };
  for (let i = 0; i < 5 && !isPositionClear(campaign, candidate, tokenId); i++) {
    const nudge = inchesToSvg(gc.settings.tokenFootprintInches * 2, gc.settings);
    candidate = { x: candidate.x + (dx / d) * nudge, y: candidate.y + (dy / d) * nudge };
  }

  return {
    ...campaign,
    grandCampaign: {
      ...gc,
      tokens: gc.tokens.map(t => t.id === tokenId ? { ...t, position: candidate } : t),
    },
  };
};

/**
 * Resolve a pending Grand Campaign battle. Casualties object:
 *   { attackerRaw, defenderRaw, attackerOnTrainRiver, defenderOnTrainRiver }
 *
 * Applies modifiers, subtracts manpower from engaged tokens and their
 * supporters (40%), increments fatigue on all participants, auto-retreats
 * the loser, applies last-stand / wipe status, and logs VP events for wipes.
 */
export const resolveGCBattle = (campaign, battleId, { winner, attackerRaw, defenderRaw, attackerOnTrainRiver = false, defenderOnTrainRiver = false }) => {
  if (!isGrandCampaign(campaign)) return { campaign, error: 'not a grand campaign' };
  const battle = campaign.battles.find(b => b.id === battleId);
  if (!battle || battle.mode !== 'grand') return { campaign, error: 'battle not found' };
  if (battle.status !== 'pending') return { campaign, error: 'battle already resolved' };
  if (winner !== 'USA' && winner !== 'CSA') return { campaign, error: 'invalid winner' };

  const gc = campaign.grandCampaign;
  const attacker = gc.tokens.find(t => t.id === battle.attackerTokenId);
  const defender = gc.tokens.find(t => t.id === battle.defenderTokenId);
  if (!attacker || !defender) return { campaign, error: 'participants missing' };

  const winter = isWinterMonth(campaign);

  // Compute modified casualties on each side.
  let attackerTotal = applyCasualtyModifiers(Number(attackerRaw) || 0, {
    fatigue: attacker.fatigue,
    isAttackerInWinter: winter,
    onTrainOrRiver: attackerOnTrainRiver,
  }, gc.settings);
  let defenderTotal = applyCasualtyModifiers(Number(defenderRaw) || 0, {
    fatigue: defender.fatigue,
    isAttackerInWinter: false,
    onTrainOrRiver: defenderOnTrainRiver,
  }, gc.settings);

  // Garrison integration — if the defender is at a friendly city/fort with a
  // garrison, that garrison (a) takes defender casualties first, and (b)
  // inflicts extra casualties on the attacker (per rules: 100/100).
  const defenderStronghold = (() => {
    const radius = inchesToSvg(gc.settings.railSnapInches, gc.settings);
    const candidates = [
      ...gc.mapFeatures.cities.map(c => ({ ...c, bucket: 'cities' })),
      ...gc.mapFeatures.forts.map(f => ({ ...f, bucket: 'forts' })),
    ];
    return candidates.find(f =>
      f.side === defender.side &&
      f.garrison?.side === defender.side &&
      distance(defender.position, f) <= radius
    ) || null;
  })();

  let garrisonAbsorbed = 0;
  let workingCampaignMapFeatures = gc.mapFeatures;
  if (defenderStronghold) {
    const g = defenderStronghold.garrison;
    // Garrison counter-fire: +100 attacker cas per 100 garrison men.
    const extraAttackerCas = Math.floor(g.men / 100) * gc.settings.garrisonCasPer100;
    attackerTotal += extraAttackerCas;
    // Defender casualties drained from garrison first.
    garrisonAbsorbed = Math.min(defenderTotal, g.men);
    defenderTotal -= garrisonAbsorbed;
    const remaining = g.men - garrisonAbsorbed;
    const newGarrison = remaining > 0 ? { ...g, men: remaining } : null;
    workingCampaignMapFeatures = {
      ...gc.mapFeatures,
      [defenderStronghold.bucket]: gc.mapFeatures[defenderStronghold.bucket].map(f =>
        f.id === defenderStronghold.id ? { ...f, garrison: newGarrison } : f
      ),
    };
  }

  const participantIds = [
    battle.attackerTokenId,
    battle.defenderTokenId,
    battle.attackerSupportId,
    battle.defenderSupportId,
  ].filter(Boolean);

  // Apply manpower changes. Supporters absorb 40% of their side's casualties.
  let workingCampaign = {
    ...campaign,
    grandCampaign: {
      ...gc,
      mapFeatures: workingCampaignMapFeatures,
      tokens: gc.tokens.map(t => {
        if (!participantIds.includes(t.id)) return t;
        let cas = 0;
        if (t.id === battle.attackerTokenId) cas = Math.round(attackerTotal * 0.6);
        else if (t.id === battle.attackerSupportId) cas = Math.round(attackerTotal * 0.4);
        else if (t.id === battle.defenderTokenId) cas = Math.round(defenderTotal * 0.6);
        else if (t.id === battle.defenderSupportId) cas = Math.round(defenderTotal * 0.4);
        // With no supporter, the engaged token takes the full hit.
        if (t.id === battle.attackerTokenId && !battle.attackerSupportId) cas = attackerTotal;
        if (t.id === battle.defenderTokenId && !battle.defenderSupportId) cas = defenderTotal;
        const newManpower = Math.max(0, t.manpower - cas);
        let newStatus = t.status;
        if (newManpower < gc.settings.lastStandMin) newStatus = 'wiped';
        else if (newManpower <= gc.settings.lastStandMax) newStatus = 'last-stand';
        else newStatus = 'active';
        return {
          ...t,
          manpower: newManpower,
          fatigue: t.fatigue + 1,
          inCombat: false,
          combatThisTurn: true,
          status: newStatus,
        };
      }),
    },
  };

  // Auto-retreat loser's engaged token (up to 4 march-MP toward friendly
  // stronghold). Winner stays.
  const loserTokenId = winner === 'USA' ? battle.defenderTokenId : battle.attackerTokenId;
  const loserSide = winner === 'USA' ? battle.defender : battle.attacker;
  if (loserSide === 'USA' || loserSide === 'CSA') {
    const loserToken = workingCampaign.grandCampaign.tokens.find(t => t.id === loserTokenId);
    if (loserToken && loserToken.status !== 'wiped') {
      workingCampaign = applyRetreat(workingCampaign, loserTokenId);
    }
  }

  // Award VP for every participant that was wiped; accumulate events.
  const vpEvents = [...(workingCampaign.grandCampaign.vpEvents || [])];
  let vpUSA = campaign.victoryPointsUSA || 0;
  let vpCSA = campaign.victoryPointsCSA || 0;

  for (const id of participantIds) {
    const t = workingCampaign.grandCampaign.tokens.find(tt => tt.id === id);
    if (t && t.status === 'wiped' && !vpEvents.some(e => e.type === 'wipe' && e.tokenId === id)) {
      const killerSide = t.side === 'USA' ? 'CSA' : 'USA';
      const award = gc.settings.vpPerTokenWipe;
      if (killerSide === 'USA') vpUSA += award;
      else vpCSA += award;
      vpEvents.push({
        type: 'wipe',
        turn: campaign.currentTurn,
        side: killerSide,
        tokenId: id,
        vp: award,
      });
    }
  }

  // Battle record closes out.
  const updatedBattles = workingCampaign.battles.map(b =>
    b.id === battleId
      ? {
          ...b,
          status: 'completed',
          winner,
          casualties: { attackerRaw, defenderRaw, attackerTotal, defenderTotal },
        }
      : b
  );

  // Battle victor gets the $400 prize.
  const winPayout = gc.settings.moneyPerBattleWin;
  const newPools = {
    ...workingCampaign.grandCampaign.pools,
    [winner]: {
      ...workingCampaign.grandCampaign.pools[winner],
      treasury: workingCampaign.grandCampaign.pools[winner].treasury + winPayout,
    },
  };

  return {
    campaign: {
      ...workingCampaign,
      battles: updatedBattles,
      victoryPointsUSA: vpUSA,
      victoryPointsCSA: vpCSA,
      grandCampaign: {
        ...workingCampaign.grandCampaign,
        pools: newPools,
        vpEvents,
      },
    },
    error: null,
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

