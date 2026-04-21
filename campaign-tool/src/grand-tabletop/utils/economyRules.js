// Economy rules: monthly income, replenishment, capture payouts.

import { getCityByHex } from '../data/defaultBoard';

export const monthlyIncome = (campaign, eventEffects = {}) => {
  const { settings, board } = campaign;
  const usaMult = eventEffects.usaIncomeMultiplier ?? 1;
  const csaMult = eventEffects.csaIncomeMultiplier ?? 1;

  let usaMoney = 0, usaMP = 0, csaMoney = 0, csaMP = 0;
  for (const city of board.cities) {
    if (city.owner === 'USA') {
      usaMoney += settings.cityIncomeMoney * usaMult;
      usaMP += settings.cityIncomeManpower * usaMult;
    } else if (city.owner === 'CSA') {
      csaMoney += settings.cityIncomeMoney * csaMult;
      csaMP += settings.cityIncomeManpower * csaMult;
    }
  }

  return {
    USA: { money: Math.round(usaMoney), manpower: Math.round(usaMP) },
    CSA: { money: Math.round(csaMoney), manpower: Math.round(csaMP) }
  };
};

export const applyMonthlyIncome = (campaign, eventEffects = {}) => {
  const income = monthlyIncome(campaign, eventEffects);
  return {
    ...campaign,
    factions: {
      USA: {
        ...campaign.factions.USA,
        money: campaign.factions.USA.money + income.USA.money,
        manpower: campaign.factions.USA.manpower + income.USA.manpower
      },
      CSA: {
        ...campaign.factions.CSA,
        money: campaign.factions.CSA.money + income.CSA.money,
        manpower: campaign.factions.CSA.manpower + income.CSA.manpower
      }
    }
  };
};

export const canReplenish = (campaign, unitId) => {
  const unit = campaign.units.find(u => u.id === unitId);
  if (!unit || unit.wiped) return { ok: false, reason: 'Unit not available' };
  const city = getCityByHex(campaign.board, unit.hexKey);
  if (!city) return { ok: false, reason: 'Must be in a city or fort to replenish' };
  if (city.owner !== unit.faction) return { ok: false, reason: 'City must be friendly' };
  const { replenishCost, replenishManpowerCost } = campaign.settings;
  const faction = campaign.factions[unit.faction];
  if (faction.money < replenishCost) return { ok: false, reason: 'Insufficient funds' };
  if (faction.manpower < replenishManpowerCost) return { ok: false, reason: 'Insufficient manpower pool' };
  return { ok: true };
};

export const executeReplenish = (campaign, unitId) => {
  const check = canReplenish(campaign, unitId);
  if (!check.ok) return { campaign, error: check.reason };
  const { replenishCost, replenishManpowerCost, replenishSoldiers } = campaign.settings;
  const unit = campaign.units.find(u => u.id === unitId);
  const side = unit.faction;
  const newFactions = {
    ...campaign.factions,
    [side]: {
      ...campaign.factions[side],
      money: campaign.factions[side].money - replenishCost,
      manpower: campaign.factions[side].manpower - replenishManpowerCost
    }
  };
  const newUnits = campaign.units.map(u =>
    u.id === unitId
      ? { ...u, manpower: u.manpower + replenishSoldiers, remainingMP: 0, turnActedThisDraw: true }
      : u
  );
  return { campaign: { ...campaign, factions: newFactions, units: newUnits }, error: null };
};

export const canSetGarrison = (campaign, unitId, amount) => {
  const unit = campaign.units.find(u => u.id === unitId);
  if (!unit) return { ok: false, reason: 'Unit not found' };
  const city = getCityByHex(campaign.board, unit.hexKey);
  if (!city) return { ok: false, reason: 'Must be at a city or fort' };
  if (city.owner !== unit.faction) return { ok: false, reason: 'City must be friendly' };
  if (amount < 0) return { ok: false, reason: 'Amount must be positive' };
  if (city.garrison + amount > campaign.settings.garrisonMax) {
    return { ok: false, reason: `Garrison max is ${campaign.settings.garrisonMax}` };
  }
  if (unit.manpower - amount < 500) {
    return { ok: false, reason: 'Cannot reduce token below 500 manpower' };
  }
  return { ok: true };
};

export const executeSetGarrison = (campaign, unitId, amount) => {
  const check = canSetGarrison(campaign, unitId, amount);
  if (!check.ok) return { campaign, error: check.reason };
  const unit = campaign.units.find(u => u.id === unitId);
  const city = getCityByHex(campaign.board, unit.hexKey);
  const newCities = campaign.board.cities.map(c =>
    c.id === city.id ? { ...c, garrison: c.garrison + amount } : c
  );
  const newUnits = campaign.units.map(u =>
    u.id === unitId
      ? { ...u, manpower: u.manpower - amount, remainingMP: 0, turnActedThisDraw: true }
      : u
  );
  return {
    campaign: {
      ...campaign,
      board: { ...campaign.board, cities: newCities },
      units: newUnits
    },
    error: null
  };
};
