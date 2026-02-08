/**
 * Shareable Campaign Map Utility
 *
 * Encodes campaign state into a compressed URL-safe string for sharing,
 * and decodes it back. Only includes data needed for the read-only map view.
 *
 * V2 uses template-based encoding: stores only the template ID + per-territory
 * dynamic state (owner, VP changes, transitions). The viewer reconstructs the
 * full map from the template. Falls back to full (optimized) data for custom maps.
 *
 * Uses lz-string for compression to keep URLs manageable.
 */

import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { CAMPAIGN_TEMPLATES } from '../data/defaultCampaign';

const SHARE_VERSION = 2;

const OWNER_TO_CHAR = { 'USA': 'U', 'CSA': 'C', 'NEUTRAL': 'N' };
const CHAR_TO_OWNER = { 'U': 'USA', 'C': 'CSA', 'N': 'NEUTRAL' };

/**
 * Build the common (non-territory) share payload fields.
 */
const buildBasePayload = (campaign) => {
  const instantVPGains = campaign.settings?.instantVPGains !== false;
  const pendingTerritoryIds = (campaign.battles || [])
    .filter(b => b.status === 'pending' || !b.winner)
    .map(b => b.territoryId);

  return {
    v: SHARE_VERSION,
    name: campaign.name,
    turn: campaign.currentTurn,
    date: campaign.campaignDate?.displayString || null,
    cpEnabled: campaign.cpSystemEnabled || false,
    cpUSA: campaign.combatPowerUSA || 0,
    cpCSA: campaign.combatPowerCSA || 0,
    spSettings: campaign.cpSystemEnabled ? {
      vpBase: campaign.settings?.vpBase || 1,
      attackEnemy: campaign.settings?.baseAttackCostEnemy ?? 75,
      attackNeutral: campaign.settings?.baseAttackCostNeutral ?? 50,
      defenseFriendly: campaign.settings?.baseDefenseCostFriendly ?? 25,
      defenseNeutral: campaign.settings?.baseDefenseCostNeutral ?? 50,
    } : undefined,
    instantVP: instantVPGains,
    battleCount: (campaign.battles || []).filter(b => b.status !== 'pending' && b.winner).length,
    pendingCount: pendingTerritoryIds.length || undefined,
    _pendingTerritoryIds: pendingTerritoryIds,
  };
};

/**
 * Encode a single territory's transition state compactly.
 */
const encodeTransition = (ts) => ({
  r: ts.turnsRemaining,
  t: ts.totalTurns,
  p: OWNER_TO_CHAR[ts.previousOwner] || 'N',
});

/**
 * Decode a compact transition state back to full form.
 */
const decodeTransition = (ts) => ({
  isTransitioning: true,
  turnsRemaining: ts.r,
  totalTurns: ts.t,
  previousOwner: CHAR_TO_OWNER[ts.p] || 'NEUTRAL',
});

/**
 * Create a minimal share payload from the full campaign state.
 * Uses template-based compact encoding when possible.
 */
export const createSharePayload = (campaign) => {
  const base = buildBasePayload(campaign);
  const pendingTerritoryIds = base._pendingTerritoryIds;
  delete base._pendingTerritoryIds;

  const tplKey = campaign.mapTemplate;
  const template = tplKey && tplKey !== 'custom' && CAMPAIGN_TEMPLATES[tplKey];

  // Template-based compact encoding
  if (template) {
    const freshCampaign = template.create();
    const templateMap = new Map(freshCampaign.territories.map(t => [t.id, t]));

    const td = {};
    campaign.territories.forEach(t => {
      const ownerChar = OWNER_TO_CHAR[t.owner] || 'N';
      const vp = t.victoryPoints ?? t.pointValue ?? 0;
      const tmpl = templateMap.get(t.id);
      const tmplVP = tmpl ? (tmpl.victoryPoints ?? tmpl.pointValue ?? 0) : null;
      const hasVPChange = tmpl && vp !== tmplVP;
      const hasTransition = t.transitionState?.isTransitioning;

      if (!hasVPChange && !hasTransition) {
        td[t.id] = ownerChar;
      } else {
        const entry = { o: ownerChar };
        if (hasVPChange) entry.vp = vp;
        if (hasTransition) entry.ts = encodeTransition(t.transitionState);
        td[t.id] = entry;
      }
    });

    return {
      ...base,
      tpl: tplKey,
      td,
      pending: pendingTerritoryIds.length > 0 ? pendingTerritoryIds : undefined,
    };
  }

  // Fallback: full territory data (strip svgPath when states exist - MapView resolves those)
  const territories = campaign.territories.map(t => {
    const entry = {
      id: t.id,
      name: t.name,
      owner: t.owner,
      victoryPoints: t.victoryPoints ?? t.pointValue ?? 0,
      adjacentTerritories: t.adjacentTerritories || [],
    };

    // Only include svgPath when there's no states array (MapView looks up state paths from usaStates)
    if (t.svgPath && !t.states?.length) entry.svgPath = t.svgPath;
    if (t.center) entry.center = t.center;
    if (t.labelPosition) entry.labelPosition = t.labelPosition;
    if (t.countyFips?.length) entry.countyFips = t.countyFips;
    if (t.states?.length) entry.states = t.states;
    if (t.isCapital) entry.isCapital = true;

    if (t.transitionState?.isTransitioning) {
      entry.transitionState = {
        isTransitioning: true,
        turnsRemaining: t.transitionState.turnsRemaining,
        totalTurns: t.transitionState.totalTurns,
        previousOwner: t.transitionState.previousOwner,
      };
    }

    return entry;
  });

  return {
    ...base,
    territories,
    pendingTerritoryIds: pendingTerritoryIds.length > 0 ? pendingTerritoryIds : undefined,
  };
};

/**
 * Reconstruct full share data from a template-based compact payload.
 */
const reconstructFromTemplate = (payload) => {
  const template = CAMPAIGN_TEMPLATES[payload.tpl];
  if (!template) return null;

  const freshCampaign = template.create();

  const territories = freshCampaign.territories.map(t => {
    const dynamic = payload.td[t.id];
    if (!dynamic) return t;

    // String = just owner change
    if (typeof dynamic === 'string') {
      return { ...t, owner: CHAR_TO_OWNER[dynamic] || 'NEUTRAL' };
    }

    // Object = owner + optional VP override + optional transition
    const result = { ...t, owner: CHAR_TO_OWNER[dynamic.o] || 'NEUTRAL' };
    if (dynamic.vp != null) {
      result.victoryPoints = dynamic.vp;
      result.pointValue = dynamic.vp;
    }
    if (dynamic.ts) {
      result.transitionState = decodeTransition(dynamic.ts);
    }
    return result;
  });

  return {
    ...payload,
    territories,
    pendingTerritoryIds: payload.pending || [],
  };
};

/**
 * Encode a share payload into a URL-safe compressed string.
 */
export const encodeSharePayload = (payload) => {
  const json = JSON.stringify(payload);
  return compressToEncodedURIComponent(json);
};

/**
 * Decode a compressed share string back into a payload.
 * Supports both v1 (full territory data) and v2 (template-based compact).
 * Returns null if decoding fails.
 */
export const decodeSharePayload = (encoded) => {
  try {
    const json = decompressFromEncodedURIComponent(encoded);
    if (!json) return null;
    const payload = JSON.parse(json);
    if (!payload?.v) return null;

    // V1 legacy: full territory data, return as-is
    if (payload.v === 1 && payload.territories) return payload;

    // V2 template-based: reconstruct from template
    if (payload.v === 2 && payload.tpl && payload.td) {
      return reconstructFromTemplate(payload);
    }

    // V2 custom maps: full territory data
    if (payload.v === 2 && payload.territories) return payload;

    return null;
  } catch {
    return null;
  }
};

/**
 * Generate a full shareable URL for the current page with the encoded campaign.
 */
export const generateShareUrl = (campaign) => {
  const payload = createSharePayload(campaign);
  const encoded = encodeSharePayload(payload);
  const base = window.location.origin + window.location.pathname;
  return `${base}#share=${encoded}`;
};

/**
 * Check if the current URL contains a share hash.
 * Returns the decoded payload or null.
 */
export const getShareFromUrl = () => {
  const hash = window.location.hash;
  if (!hash.startsWith('#share=')) return null;
  const encoded = hash.slice('#share='.length);
  return decodeSharePayload(encoded);
};
