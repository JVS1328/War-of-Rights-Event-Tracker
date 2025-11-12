// Core campaign mechanics and logic
import {
  calculateBattleCPCost
} from './cpSystem';

/**
 * Process battle result and update campaign state
 * Handles both legacy VP system and new CP system
 *
 * @param {Object} campaign - Current campaign state
 * @param {Object} battle - Battle data to process
 * @returns {Object} Updated campaign state
 */
export const processBattleResult = (campaign, battle) => {
  const territory = campaign.territories.find(t => t.id === battle.territoryId);
  if (!territory) return campaign;

  // Store previous owner for CP calculations
  const previousOwner = territory.owner;
  const defenseSuccessful = battle.winner !== battle.attacker;
  
  // Determine defender (could be NEUTRAL)
  const defender = battle.attacker === 'USA' ?
    (previousOwner === 'CSA' ? 'CSA' : 'NEUTRAL') :
    (previousOwner === 'USA' ? 'USA' : 'NEUTRAL');

  // === CP SYSTEM PROCESSING (if enabled) ===
  let cpCostAttacker = 0;
  let cpCostDefender = 0;
  
  if (campaign.cpSystemEnabled) {
    // Get casualties from battle
    const attackerCasualties = battle.casualties?.[battle.attacker] || 0;
    const defenderCasualties = battle.casualties?.[defender] || 0;

    // Calculate CP costs using the new system
    const cpResult = calculateBattleCPCost({
      territoryPointValue: territory.pointValue || territory.victoryPoints || 10,
      territoryOwner: previousOwner,
      attacker: battle.attacker,
      winner: battle.winner,
      attackerCasualties,
      defenderCasualties
    });

    cpCostAttacker = cpResult.attackerLoss;
    cpCostDefender = cpResult.defenderLoss;

    // Validate CP availability (should have been checked in UI, but validate here)
    const attackerCP = battle.attacker === 'USA' ? campaign.combatPowerUSA : campaign.combatPowerCSA;
    const defenderCP = defender === 'USA' ? campaign.combatPowerUSA :
                       defender === 'CSA' ? campaign.combatPowerCSA : 0;

    if (attackerCP < cpCostAttacker) {
      console.warn(`Insufficient CP for attacker. Required: ${cpCostAttacker}, Available: ${attackerCP}`);
      // Allow battle but cap cost at available CP
      cpCostAttacker = Math.max(0, attackerCP);
    }

    if (defender !== 'NEUTRAL' && defenderCP < cpCostDefender) {
      console.warn(`Insufficient CP for defender. Required: ${cpCostDefender}, Available: ${defenderCP}`);
      cpCostDefender = Math.max(0, defenderCP);
    }
  }

  // Update territory ownership
  territory.owner = battle.winner;

  // === LEGACY VP SYSTEM (backward compatibility) ===
  let vpAwarded = campaign.settings.victoryPointsPerBattle;
  
  // Add territory VP value if territory changed hands
  if (previousOwner !== battle.winner) {
    vpAwarded += territory.victoryPoints || territory.pointValue || 0;
  }
  
  // Capital bonus
  if (territory.isCapital) {
    vpAwarded = Math.floor(vpAwarded * campaign.settings.capitalBonusMultiplier);
  }

  // Update battle record with both VP and CP data
  battle.victoryPointsAwarded = vpAwarded;
  battle.cpCostAttacker = cpCostAttacker;
  battle.cpCostDefender = cpCostDefender;
  battle.defender = defender;

  // Create updated campaign
  const updatedCampaign = { ...campaign };
  
  // Update legacy VPs
  if (battle.winner === 'USA') {
    updatedCampaign.victoryPointsUSA += vpAwarded;
  } else {
    updatedCampaign.victoryPointsCSA += vpAwarded;
  }

  // === DEDUCT CP (if enabled) ===
  if (campaign.cpSystemEnabled) {
    // Deduct attacker CP
    if (battle.attacker === 'USA') {
      updatedCampaign.combatPowerUSA = Math.max(0, campaign.combatPowerUSA - cpCostAttacker);
    } else {
      updatedCampaign.combatPowerCSA = Math.max(0, campaign.combatPowerCSA - cpCostAttacker);
    }

    // Deduct defender CP (if not NEUTRAL)
    if (defender === 'USA') {
      updatedCampaign.combatPowerUSA = Math.max(0, campaign.combatPowerUSA - cpCostDefender);
    } else if (defender === 'CSA') {
      updatedCampaign.combatPowerCSA = Math.max(0, campaign.combatPowerCSA - cpCostDefender);
    }

    // Add CP history entries
    const cpHistory = [...(campaign.cpHistory || [])];
    
    // Attacker CP history
    cpHistory.push({
      turn: battle.turn,
      date: battle.date,
      action: `Battle: ${territory.name} (Attacker)`,
      side: battle.attacker,
      cpChange: -cpCostAttacker,
      newBalance: battle.attacker === 'USA' ? updatedCampaign.combatPowerUSA : updatedCampaign.combatPowerCSA,
      battleId: battle.id
    });

    // Defender CP history (if not NEUTRAL)
    if (defender !== 'NEUTRAL') {
      cpHistory.push({
        turn: battle.turn,
        date: battle.date,
        action: `Battle: ${territory.name} (Defender)`,
        side: defender,
        cpChange: -cpCostDefender,
        newBalance: defender === 'USA' ? updatedCampaign.combatPowerUSA : updatedCampaign.combatPowerCSA,
        battleId: battle.id
      });
    }

    updatedCampaign.cpHistory = cpHistory;
  }

  // Add to battle history
  updatedCampaign.battles = [...campaign.battles, battle];

  // Update territory capture history
  territory.captureHistory.push({
    turn: battle.turn,
    owner: battle.winner,
    battleId: battle.id
  });

  return updatedCampaign;
};

export const canAttackTerritory = (campaign, territoryId, attacker) => {
  const territory = campaign.territories.find(t => t.id === territoryId);
  if (!territory) return false;

  // Can't attack own territory
  if (territory.owner === attacker) return false;

  // If adjacent attack required, check adjacency
  if (campaign.settings.requireAdjacentAttack) {
    const ownedTerritories = campaign.territories
      .filter(t => t.owner === attacker)
      .map(t => t.id);
    
    // Check if any owned territory is adjacent to target
    return territory.adjacentTerritories.some(adjId => 
      ownedTerritories.includes(adjId)
    );
  }

  return true; // Can attack any territory
};

export const calculateVictoryPoints = (campaign) => {
  let usaVP = 0;
  let csaVP = 0;

  // VP from battles
  campaign.battles.forEach(battle => {
    if (battle.winner === 'USA') {
      usaVP += battle.victoryPointsAwarded || 0;
    } else {
      csaVP += battle.victoryPointsAwarded || 0;
    }
  });

  return { usaVP, csaVP };
};

export const getTerritoryStats = (campaign) => {
  const stats = {
    USA: { count: 0, totalVP: 0, capitals: 0 },
    CSA: { count: 0, totalVP: 0, capitals: 0 },
    NEUTRAL: { count: 0, totalVP: 0, capitals: 0 }
  };

  campaign.territories.forEach(territory => {
    const owner = territory.owner;
    stats[owner].count++;
    stats[owner].totalVP += territory.victoryPoints;
    if (territory.isCapital) {
      stats[owner].capitals++;
    }
  });

  return stats;
};