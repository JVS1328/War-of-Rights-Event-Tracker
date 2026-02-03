// Core campaign mechanics and logic
import {
  calculateBattleCPCost
} from './cpSystem';
import { isTerritorySupplied } from './supplyLines';

/**
 * Process battle result and update campaign state
 * Handles territory ownership changes and CP system
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
  
  // Determine defender (could be NEUTRAL)
  const defender = battle.attacker === 'USA' ?
    (previousOwner === 'CSA' ? 'CSA' : 'NEUTRAL') :
    (previousOwner === 'USA' ? 'USA' : 'NEUTRAL');

  // === CP SYSTEM PROCESSING (if enabled) ===
  let cpCostAttacker = 0;
  let cpCostDefender = 0;
  
  if (campaign.cpSystemEnabled) {
    // Check if manual CP loss was provided
    if (battle.manualCPLoss) {
      // Manual mode: use provided CP values
      cpCostAttacker = battle.manualCPLoss.attacker || 0;
      cpCostDefender = battle.manualCPLoss.defender || 0;
    } else {
      // Auto mode: calculate CP costs
      const attackerCasualties = battle.casualties?.[battle.attacker] || 0;
      const defenderCasualties = battle.casualties?.[defender] || 0;

      // Check if defending territory is isolated (no adjacent friendly territories)
      const isDefenderIsolated = defender !== 'NEUTRAL' &&
        previousOwner === defender &&
        !isTerritorySupplied(territory, campaign.territories);

      const cpResult = calculateBattleCPCost({
        territoryPointValue: territory.pointValue || territory.victoryPoints || 10,
        territoryOwner: previousOwner,
        attacker: battle.attacker,
        winner: battle.winner,
        attackerCasualties,
        defenderCasualties,
        abilityActive: battle.abilityUsed === battle.attacker,
        isDefenderIsolated
      });

      cpCostAttacker = cpResult.attackerLoss;
      cpCostDefender = cpResult.defenderLoss;
    }

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

  // Calculate VP gained from territory capture (if ownership changed)
  const territoryVP = territory.victoryPoints || territory.pointValue || 0;

  // Handle failed attacks on neutral territories
  const failedNeutralAttackToEnemy = campaign.settings?.failedNeutralAttackToEnemy !== false;
  const usaAbilityActive = battle.abilityUsed === 'USA';
  let finalWinner = battle.winner;

  if (previousOwner === 'NEUTRAL' && battle.winner !== battle.attacker) {
    // Attacker lost against neutral territory
    // Special Orders 191 (USA ability): Failed attacks keep territory neutral
    if (usaAbilityActive && battle.attacker === 'USA') {
      // USA ability active: keep neutral regardless of setting
      finalWinner = 'NEUTRAL';
      battle.winner = 'NEUTRAL';
    } else if (failedNeutralAttackToEnemy) {
      // Setting ON: transfer to enemy
      const enemy = battle.attacker === 'USA' ? 'CSA' : 'USA';
      finalWinner = enemy;
      battle.winner = enemy;
    } else {
      // Setting OFF: keep neutral
      finalWinner = 'NEUTRAL';
      battle.winner = 'NEUTRAL';
    }
  }

  const ownershipChanged = previousOwner !== finalWinner;

  // Update territory ownership
  territory.owner = finalWinner;

  // Create updated campaign
  const updatedCampaign = { ...campaign };

  // === VP CAPTURE SYSTEM ===
  const instantVPGains = campaign.settings?.instantVPGains !== false; // Default to true

  if (ownershipChanged) {
    if (instantVPGains) {
      // INSTANT MODE: Award VP immediately
      battle.victoryPointsAwarded = territoryVP;

      // Clear any existing transition state
      delete territory.transitionState;
    } else {
      // GRADUAL MODE: Enter transition state, no VP awarded yet
      battle.victoryPointsAwarded = 0;
      const transitionTurns = campaign.settings?.captureTransitionTurns || 2;

      territory.transitionState = {
        isTransitioning: true,
        turnsRemaining: transitionTurns,
        totalTurns: transitionTurns,
        previousOwner: previousOwner,
        capturedOnTurn: battle.turn
      };
    }
  } else {
    // No ownership change (shouldn't happen, but handle it)
    battle.victoryPointsAwarded = 0;
  }

  // Update battle record with CP data
  battle.cpCostAttacker = cpCostAttacker;
  battle.cpCostDefender = cpCostDefender;
  battle.defender = defender;

  // === UPDATE VP BASED ON TERRITORY OWNERSHIP ===
  // Recalculate VP totals from all territories
  let usaVP = 0;
  let csaVP = 0;

  campaign.territories.forEach(t => {
    const vp = t.victoryPoints || t.pointValue || 0;

    // Only count VP if:
    // 1. Instant VP mode, OR
    // 2. Gradual mode AND territory is not transitioning
    const shouldCountVP = instantVPGains || !t.transitionState?.isTransitioning;

    if (shouldCountVP) {
      if (t.owner === 'USA') {
        usaVP += vp;
      } else if (t.owner === 'CSA') {
        csaVP += vp;
      }
    }
  });

  updatedCampaign.victoryPointsUSA = usaVP;
  updatedCampaign.victoryPointsCSA = csaVP;

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
  if (!territory.captureHistory) {
    territory.captureHistory = [];
  }
  territory.captureHistory.push({
    turn: battle.turn,
    owner: battle.winner,
    battleId: battle.id
  });

  // === HANDLE ABILITY COOLDOWN ===
  if (battle.abilityUsed) {
    const abilityCooldown = campaign.settings?.abilityCooldown || 2;

    // Ensure abilities object exists in updatedCampaign
    if (!updatedCampaign.abilities) {
      updatedCampaign.abilities = {
        USA: { name: 'Special Orders 191', cooldown: 0, lastUsedTurn: null },
        CSA: { name: 'Valley Supply Lines', cooldown: 0, lastUsedTurn: null }
      };
    }

    // Set cooldown for the ability that was used
    updatedCampaign.abilities[battle.abilityUsed] = {
      ...updatedCampaign.abilities[battle.abilityUsed],
      cooldown: abilityCooldown,
      lastUsedTurn: battle.turn
    };
  }

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

  // VP from territory ownership only
  campaign.territories.forEach(territory => {
    const vp = territory.victoryPoints || territory.pointValue || 0;
    if (territory.owner === 'USA') {
      usaVP += vp;
    } else if (territory.owner === 'CSA') {
      csaVP += vp;
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

/**
 * Process territory capture transitions at turn end
 * Decrements transition timers and awards VP when complete
 *
 * @param {Object} campaign - Current campaign state
 * @returns {Object} Updated campaign with progressed transitions
 */
export const processTransitioningTerritories = (campaign) => {
  const instantVPGains = campaign.settings?.instantVPGains !== false;

  // If instant VP mode, no transitions to process
  if (instantVPGains) {
    return campaign;
  }

  const updatedCampaign = { ...campaign };
  const transitionEvents = [];
  let vpChanges = { USA: 0, CSA: 0 };

  // Process each territory's transition state
  campaign.territories.forEach(territory => {
    if (territory.transitionState?.isTransitioning) {
      const transition = territory.transitionState;

      // Decrement turns remaining
      transition.turnsRemaining -= 1;

      // Check if transition is complete
      if (transition.turnsRemaining <= 0) {
        // Award VP to the current owner
        const territoryVP = territory.victoryPoints || territory.pointValue || 0;

        if (territory.owner === 'USA') {
          vpChanges.USA += territoryVP;
        } else if (territory.owner === 'CSA') {
          vpChanges.CSA += territoryVP;
        }

        // Log transition completion
        transitionEvents.push({
          territoryId: territory.id,
          territoryName: territory.name,
          owner: territory.owner,
          vpAwarded: territoryVP,
          turn: campaign.currentTurn
        });

        // Clear transition state
        delete territory.transitionState;
      }
    }
  });

  // Recalculate VP totals
  let usaVP = 0;
  let csaVP = 0;

  campaign.territories.forEach(t => {
    const vp = t.victoryPoints || t.pointValue || 0;
    const shouldCountVP = !t.transitionState?.isTransitioning;

    if (shouldCountVP) {
      if (t.owner === 'USA') {
        usaVP += vp;
      } else if (t.owner === 'CSA') {
        csaVP += vp;
      }
    }
  });

  updatedCampaign.victoryPointsUSA = usaVP;
  updatedCampaign.victoryPointsCSA = csaVP;

  // Store transition events for logging/history
  if (transitionEvents.length > 0) {
    updatedCampaign.lastTransitionEvents = transitionEvents;
  }

  return updatedCampaign;
};