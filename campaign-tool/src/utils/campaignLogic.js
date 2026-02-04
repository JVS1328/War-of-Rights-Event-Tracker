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

  // Determine territory-based defender (could be NEUTRAL for territory ownership)
  const territoryDefender = battle.attacker === 'USA' ?
    (previousOwner === 'CSA' ? 'CSA' : 'NEUTRAL') :
    (previousOwner === 'USA' ? 'USA' : 'NEUTRAL');

  // Opposing team is always the other faction (never NEUTRAL) - used for SP tracking
  const opposingTeam = battle.attacker === 'USA' ? 'CSA' : 'USA';

  // === CP SYSTEM PROCESSING (if enabled) ===
  let cpCostAttacker = 0;
  let cpCostDefender = 0;  // Cost for the opposing team (whoever shows up to fight)

  if (campaign.cpSystemEnabled) {
    // Check if manual CP loss was provided
    if (battle.manualCPLoss) {
      // Manual mode: use provided CP values
      cpCostAttacker = battle.manualCPLoss.attacker || 0;
      cpCostDefender = battle.manualCPLoss.defender || 0;
    } else {
      // Auto mode: calculate CP costs
      const attackerCasualties = battle.casualties?.[battle.attacker] || 0;
      const opposingCasualties = battle.casualties?.[opposingTeam] || 0;
      const totalCasualties = attackerCasualties + opposingCasualties;

      // Check if defending territory is isolated (no adjacent friendly territories)
      const isDefenderIsolated = territoryDefender !== 'NEUTRAL' &&
        previousOwner === territoryDefender &&
        !isTerritorySupplied(territory, campaign.territories);

      // Build baseCosts from campaign settings
      const baseCosts = {
        attackEnemy: campaign.settings?.baseAttackCostEnemy ?? 75,
        attackNeutral: campaign.settings?.baseAttackCostNeutral ?? 50,
        defenseFriendly: campaign.settings?.baseDefenseCostFriendly ?? 25,
        defenseNeutral: campaign.settings?.baseDefenseCostNeutral ?? 50
      };

      const cpResult = calculateBattleCPCost({
        territoryPointValue: territory.pointValue || territory.victoryPoints || 10,
        territoryOwner: previousOwner,
        attacker: battle.attacker,
        winner: battle.winner,
        attackerCasualties,
        defenderCasualties: opposingCasualties,
        abilityActive: battle.abilityUsed === battle.attacker,
        isDefenderIsolated,
        baseCosts
      });

      cpCostAttacker = cpResult.attackerLoss;

      // For defender SP cost: use calculated value if territory owned, otherwise calculate for neutral
      if (previousOwner !== 'NEUTRAL') {
        cpCostDefender = cpResult.defenderLoss;
      } else {
        // Neutral territory: opposing team still has SP costs (base from settings, scaled by VP and casualties)
        if (totalCasualties > 0) {
          const vpBase = campaign.settings?.vpBase || 1;
          const vpMultiplier = (territory.pointValue || territory.victoryPoints || 1) / vpBase;
          const casualtyRatio = opposingCasualties / totalCasualties;
          const baseDefenseNeutral = campaign.settings?.baseDefenseCostNeutral ?? 50;
          cpCostDefender = Math.round(baseDefenseNeutral * vpMultiplier * casualtyRatio);
        }
      }
    }

    // Validate CP availability (should have been checked in UI, but validate here)
    const attackerCP = battle.attacker === 'USA' ? campaign.combatPowerUSA : campaign.combatPowerCSA;
    const opposingCP = opposingTeam === 'USA' ? campaign.combatPowerUSA : campaign.combatPowerCSA;

    if (attackerCP < cpCostAttacker) {
      console.warn(`Insufficient CP for attacker. Required: ${cpCostAttacker}, Available: ${attackerCP}`);
      cpCostAttacker = Math.max(0, attackerCP);
    }

    if (opposingCP < cpCostDefender) {
      console.warn(`Insufficient CP for defender. Required: ${cpCostDefender}, Available: ${opposingCP}`);
      cpCostDefender = Math.max(0, opposingCP);
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
  battle.defender = opposingTeam;

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

    // Deduct opposing team CP (they always show up to fight)
    if (opposingTeam === 'USA') {
      updatedCampaign.combatPowerUSA = Math.max(0, campaign.combatPowerUSA - cpCostDefender);
    } else {
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

    // Defender CP history (opposing team always has SP costs)
    cpHistory.push({
      turn: battle.turn,
      date: battle.date,
      action: `Battle: ${territory.name} (Defender)`,
      side: opposingTeam,
      cpChange: -cpCostDefender,
      newBalance: opposingTeam === 'USA' ? updatedCampaign.combatPowerUSA : updatedCampaign.combatPowerCSA,
      battleId: battle.id
    });

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

  // === HANDLE COMMANDER SYSTEM ===
  if (battle.commanders) {
    // Initialize regiment structures if needed
    if (!updatedCampaign.regimentStats) {
      updatedCampaign.regimentStats = {};
    }
    if (!updatedCampaign.commanderPool) {
      updatedCampaign.commanderPool = { USA: [], CSA: [] };
    }

    // Calculate VP change for each side
    const vpGainedUSA = ownershipChanged && battle.winner === 'USA' ? territoryVP : 0;
    const vpGainedCSA = ownershipChanged && battle.winner === 'CSA' ? territoryVP : 0;
    const vpLostUSA = ownershipChanged && previousOwner === 'USA' ? territoryVP : 0;
    const vpLostCSA = ownershipChanged && previousOwner === 'CSA' ? territoryVP : 0;

    // Process each side's commander
    ['USA', 'CSA'].forEach(side => {
      const commander = battle.commanders[side];
      if (!commander) return;

      const regimentId = commander.id;

      // Initialize stats for this regiment if needed
      if (!updatedCampaign.regimentStats[regimentId]) {
        updatedCampaign.regimentStats[regimentId] = {
          wins: 0,
          losses: 0,
          casualties: 0,
          spLost: 0,
          vpGained: 0,
          vpLost: 0,
          battles: []
        };
      }

      const stats = updatedCampaign.regimentStats[regimentId];
      const isWinner = battle.winner === side;
      const sideCasualties = battle.casualties?.[side] || 0;
      const sideSpLost = side === battle.attacker ? cpCostAttacker : cpCostDefender;
      const sideVpGained = side === 'USA' ? vpGainedUSA : vpGainedCSA;
      const sideVpLost = side === 'USA' ? vpLostUSA : vpLostCSA;

      // Update stats
      if (isWinner) {
        stats.wins += 1;
      } else {
        stats.losses += 1;
      }
      stats.casualties += sideCasualties;
      stats.spLost += sideSpLost;
      stats.vpGained += sideVpGained;
      stats.vpLost += sideVpLost;

      // Add battle to regiment history
      stats.battles.push({
        battleId: battle.id,
        turn: battle.turn,
        territoryName: territory.name,
        mapName: battle.mapName,
        role: side === battle.attacker ? 'Attacker' : 'Defender',
        won: isWinner,
        casualties: sideCasualties,
        spLost: sideSpLost,
        vpGained: sideVpGained,
        vpLost: sideVpLost
      });

      // Remove commander from pool
      const pool = updatedCampaign.commanderPool[side] || [];
      updatedCampaign.commanderPool[side] = pool.filter(id => id !== regimentId);

      // Reset pool if empty
      const regiments = updatedCampaign.regiments?.[side] || [];
      if (updatedCampaign.commanderPool[side].length === 0 && regiments.length > 0) {
        updatedCampaign.commanderPool[side] = regiments.map(r => r.id);
      }
    });
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