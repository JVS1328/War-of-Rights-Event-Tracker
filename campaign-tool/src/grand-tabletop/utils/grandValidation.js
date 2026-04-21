// Validation and import/export for grand-tabletop campaigns.

export const GRAND_CAMPAIGN_VERSION = '1.0';

export const isGrandCampaign = (obj) =>
  obj && typeof obj === 'object' && obj.campaignType === 'grand-tabletop';

export const validateGrandCampaign = (data) => {
  if (!isGrandCampaign(data)) return { ok: false, error: 'Not a grand-tabletop campaign' };
  const required = ['settings', 'board', 'factions', 'units', 'turn', 'decks'];
  for (const k of required) {
    if (!(k in data)) return { ok: false, error: `Missing field: ${k}` };
  }
  if (!data.board.hexes || !data.board.cities) {
    return { ok: false, error: 'Board must have hexes and cities' };
  }
  if (!data.factions.USA || !data.factions.CSA) {
    return { ok: false, error: 'Factions must include USA and CSA' };
  }
  return { ok: true };
};

export const prepareGrandExport = (campaign) => ({
  ...campaign,
  exportedAt: new Date().toISOString()
});
