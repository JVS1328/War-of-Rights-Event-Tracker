/**
 * Shareable Campaign Map Utility
 *
 * Encodes campaign state into a compressed URL-safe string for sharing.
 *
 * For template-based campaigns: stores template ID + a single owner string
 * ("UUCNNC...") where each char's position maps to the template territory
 * array index. VP overrides and transitions stored as sparse index maps.
 *
 * For custom maps: stores optimized territory data (SVG paths stripped when
 * MapView can resolve them from usaStates).
 */

import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { CAMPAIGN_TEMPLATES } from '../data/defaultCampaign';

const V = 2;
const O2C = { 'USA': 'U', 'CSA': 'C', 'NEUTRAL': 'N' };
const C2O = { 'U': 'USA', 'C': 'CSA', 'N': 'NEUTRAL' };

const encodeTransition = (ts) => [ts.turnsRemaining, ts.totalTurns, O2C[ts.previousOwner] || 'N'];
const decodeTransition = ([r, t, p]) => ({ isTransitioning: true, turnsRemaining: r, totalTurns: t, previousOwner: C2O[p] || 'NEUTRAL' });

/**
 * Create a minimal share payload from the full campaign state.
 */
export const createSharePayload = (campaign) => {
  const pending = (campaign.battles || [])
    .filter(b => b.status === 'pending' || !b.winner)
    .map(b => b.territoryId);

  const base = {
    v: V,
    n: campaign.name,
    tn: campaign.currentTurn,
    d: campaign.campaignDate?.displayString || null,
    iv: campaign.settings?.instantVPGains !== false ? 1 : 0,
    bc: (campaign.battles || []).filter(b => b.status !== 'pending' && b.winner).length,
  };

  if (campaign.cpSystemEnabled) {
    base.cp = 1;
    base.cU = campaign.combatPowerUSA || 0;
    base.cC = campaign.combatPowerCSA || 0;
    base.sp = {
      v: campaign.settings?.vpBase || 1,
      aE: campaign.settings?.baseAttackCostEnemy ?? 75,
      aN: campaign.settings?.baseAttackCostNeutral ?? 50,
      dF: campaign.settings?.baseDefenseCostFriendly ?? 25,
      dN: campaign.settings?.baseDefenseCostNeutral ?? 50,
    };
  }

  const tplKey = campaign.mapTemplate;
  const template = tplKey && tplKey !== 'custom' && CAMPAIGN_TEMPLATES[tplKey];

  // Template-based: owner string + sparse overrides
  if (template) {
    const fresh = template.create();
    const campaignMap = new Map(campaign.territories.map(t => [t.id, t]));
    const idToIndex = new Map(fresh.territories.map((t, i) => [t.id, i]));

    let o = '';
    const vp = {};  // index -> changed VP
    const ts = {};  // index -> [turnsRemaining, totalTurns, prevOwnerChar]

    fresh.territories.forEach((tmpl, i) => {
      const t = campaignMap.get(tmpl.id);
      if (!t) { o += 'N'; return; }

      o += O2C[t.owner] || 'N';

      const curVP = t.victoryPoints ?? t.pointValue ?? 0;
      const tplVP = tmpl.victoryPoints ?? tmpl.pointValue ?? 0;
      if (curVP !== tplVP) vp[i] = curVP;

      if (t.transitionState?.isTransitioning) ts[i] = encodeTransition(t.transitionState);
    });

    base.tpl = tplKey;
    base.o = o;
    if (Object.keys(vp).length) base.vp = vp;
    if (Object.keys(ts).length) base.ts = ts;
    if (pending.length) base.p = pending.map(id => idToIndex.get(id)).filter(i => i != null);

    return base;
  }

  // Custom map fallback: optimized full territory data
  base.territories = campaign.territories.map(t => {
    const entry = {
      id: t.id,
      name: t.name,
      owner: t.owner,
      victoryPoints: t.victoryPoints ?? t.pointValue ?? 0,
      adjacentTerritories: t.adjacentTerritories || [],
    };
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
  if (pending.length) base.pendingTerritoryIds = pending;

  return base;
};

/**
 * Normalize a decoded payload into the shape SharedMapView expects.
 */
const normalize = (raw, territories, pendingTerritoryIds) => ({
  name: raw.n ?? raw.name,
  turn: raw.tn ?? raw.turn,
  date: raw.d ?? raw.date,
  instantVP: raw.iv != null ? !!raw.iv : raw.instantVP,
  battleCount: raw.bc ?? raw.battleCount ?? 0,
  pendingCount: pendingTerritoryIds.length || undefined,
  cpEnabled: raw.cp ? true : (raw.cpEnabled || false),
  cpUSA: raw.cU ?? raw.cpUSA ?? 0,
  cpCSA: raw.cC ?? raw.cpCSA ?? 0,
  spSettings: raw.sp ? {
    vpBase: raw.sp.v,
    attackEnemy: raw.sp.aE,
    attackNeutral: raw.sp.aN,
    defenseFriendly: raw.sp.dF,
    defenseNeutral: raw.sp.dN,
  } : raw.spSettings,
  territories,
  pendingTerritoryIds,
});

/**
 * Reconstruct from template + owner string (v2 compact).
 */
const reconstructFromOwnerString = (payload) => {
  const template = CAMPAIGN_TEMPLATES[payload.tpl];
  if (!template) return null;

  const fresh = template.create();
  const vpOverrides = payload.vp || {};
  const tsOverrides = payload.ts || {};

  const territories = fresh.territories.map((t, i) => {
    const owner = C2O[payload.o[i]] || 'NEUTRAL';
    const result = { ...t, owner };
    if (vpOverrides[i] != null) {
      result.victoryPoints = vpOverrides[i];
      result.pointValue = vpOverrides[i];
    }
    if (tsOverrides[i]) result.transitionState = decodeTransition(tsOverrides[i]);
    return result;
  });

  const pendingTerritoryIds = (payload.p || []).map(i => fresh.territories[i]?.id).filter(Boolean);
  return normalize(payload, territories, pendingTerritoryIds);
};

/**
 * Reconstruct from template + td object (v2 legacy dict format).
 */
const reconstructFromTd = (payload) => {
  const template = CAMPAIGN_TEMPLATES[payload.tpl];
  if (!template) return null;

  const fresh = template.create();
  const territories = fresh.territories.map(t => {
    const dynamic = payload.td[t.id];
    if (!dynamic) return t;
    if (typeof dynamic === 'string') return { ...t, owner: C2O[dynamic] || 'NEUTRAL' };
    const result = { ...t, owner: C2O[dynamic.o] || 'NEUTRAL' };
    if (dynamic.vp != null) { result.victoryPoints = dynamic.vp; result.pointValue = dynamic.vp; }
    if (dynamic.ts) result.transitionState = { isTransitioning: true, turnsRemaining: dynamic.ts.r, totalTurns: dynamic.ts.t, previousOwner: C2O[dynamic.ts.p] || 'NEUTRAL' };
    return result;
  });

  return normalize(payload, territories, payload.pending || []);
};

export const encodeSharePayload = (payload) => compressToEncodedURIComponent(JSON.stringify(payload));

/**
 * Decode a compressed share string. Supports v1 (full), v2 td (dict), v2 o (owner string).
 */
export const decodeSharePayload = (encoded) => {
  try {
    const json = decompressFromEncodedURIComponent(encoded);
    if (!json) return null;
    const p = JSON.parse(json);
    if (!p?.v) return null;

    // V1: full territory data
    if (p.v === 1 && p.territories) return normalize(p, p.territories, p.pendingTerritoryIds || []);

    // V2 compact: template + owner string
    if (p.v === 2 && p.tpl && p.o) return reconstructFromOwnerString(p);

    // V2 legacy: template + td dict
    if (p.v === 2 && p.tpl && p.td) return reconstructFromTd(p);

    // V2 custom: full territory data
    if (p.v === 2 && p.territories) return normalize(p, p.territories, p.pendingTerritoryIds || []);

    return null;
  } catch {
    return null;
  }
};

export const generateShareUrl = (campaign) => {
  const encoded = encodeSharePayload(createSharePayload(campaign));
  return `${window.location.origin + window.location.pathname}#share=${encoded}`;
};

export const getShareFromUrl = () => {
  const hash = window.location.hash;
  if (!hash.startsWith('#share=')) return null;
  return decodeSharePayload(hash.slice(7));
};
