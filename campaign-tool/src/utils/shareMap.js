/**
 * Shareable Campaign Map Utility
 *
 * Encodes campaign state into a compressed URL-safe string for sharing,
 * and decodes it back. Only includes data needed for the read-only map view.
 *
 * Uses lz-string for compression to keep URLs manageable.
 */

import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';

const SHARE_VERSION = 1;

/**
 * Create a minimal share payload from the full campaign state.
 * Strips battles, CP history, regiment stats, and other editor-only data.
 * Keeps everything needed for the read-only map view.
 */
export const createSharePayload = (campaign) => {
  const instantVPGains = campaign.settings?.instantVPGains !== false;

  // Determine which territory IDs have pending battles
  const pendingTerritoryIds = (campaign.battles || [])
    .filter(b => b.status === 'pending' || !b.winner)
    .map(b => b.territoryId);

  // Minimal territory data
  const territories = campaign.territories.map(t => {
    const entry = {
      id: t.id,
      name: t.name,
      owner: t.owner,
      victoryPoints: t.victoryPoints ?? t.pointValue ?? 0,
      adjacentTerritories: t.adjacentTerritories || [],
    };

    // Rendering data - only include what's present
    if (t.svgPath) entry.svgPath = t.svgPath;
    if (t.center) entry.center = t.center;
    if (t.labelPosition) entry.labelPosition = t.labelPosition;
    if (t.countyFips?.length) entry.countyFips = t.countyFips;
    if (t.states?.length) entry.states = t.states;
    if (t.isCapital) entry.isCapital = true;

    // Transition state for pending captures
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
    v: SHARE_VERSION,
    name: campaign.name,
    turn: campaign.currentTurn,
    date: campaign.campaignDate?.displayString || null,
    territories,
    pendingTerritoryIds: pendingTerritoryIds.length > 0 ? pendingTerritoryIds : undefined,
    cpEnabled: campaign.cpSystemEnabled || false,
    cpUSA: campaign.combatPowerUSA || 0,
    cpCSA: campaign.combatPowerCSA || 0,
    instantVP: instantVPGains,
    battleCount: (campaign.battles || []).filter(b => b.status !== 'pending' && b.winner).length,
    pendingCount: pendingTerritoryIds.length || undefined,
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
 * Returns null if decoding fails.
 */
export const decodeSharePayload = (encoded) => {
  try {
    const json = decompressFromEncodedURIComponent(encoded);
    if (!json) return null;
    const payload = JSON.parse(json);
    if (!payload || payload.v !== SHARE_VERSION) return null;
    return payload;
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
