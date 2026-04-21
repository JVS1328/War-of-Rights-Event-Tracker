/**
 * Grand Campaign state manipulation — pure functions, no side effects.
 *
 * Every export takes a campaign object and returns a new campaign. Never
 * mutates in place. Callers wire these into React setState.
 */

import { createToken } from '../data/grandCampaign';

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
