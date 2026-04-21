// Win conditions: 10 VP (capitals = 2, wipes = 2). Check at end of month.

export const checkGrandVictory = (campaign) => {
  const { vpToWin } = campaign.settings;
  const usa = campaign.factions.USA.vp;
  const csa = campaign.factions.CSA.vp;
  if (usa >= vpToWin && usa > csa) {
    return { winner: 'USA', usa, csa, type: 'Victory Points Threshold' };
  }
  if (csa >= vpToWin && csa > usa) {
    return { winner: 'CSA', usa, csa, type: 'Victory Points Threshold' };
  }
  if (usa >= vpToWin && csa >= vpToWin && usa === csa) {
    return { winner: 'DRAW', usa, csa, type: 'Simultaneous Victory' };
  }
  return null;
};

export const victoriesUnlockSpecial = (victoryCount, specialsEarned, victoriesPerSpecial) => {
  const tier = Math.floor(victoryCount / victoriesPerSpecial);
  return tier > specialsEarned;
};
