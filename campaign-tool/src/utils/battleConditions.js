/**
 * Battle Conditions System
 * Weather and time of day rolls for battles
 *
 * Uses weighted random selection (same pattern as terrain rolls).
 * Weights are configurable in campaign settings.
 */

/**
 * Weather condition definitions (metadata only - weights are separate)
 */
export const WEATHER_CONDITIONS = {
  clear: {
    id: 'clear',
    name: 'Clear Skies',
    description: 'Sunny days and moonlit nights'
  },
  rain: {
    id: 'rain',
    name: 'Tempered Rainstorm',
    description: 'Nothing too crazy that will cause clientside gameplay issues'
  },
  inclement: {
    id: 'inclement',
    name: 'Inclement Weather',
    description: 'Rain is cranked up to max - mud, blood, and 20 frames a second'
  }
};

/**
 * Time of day condition definitions (metadata only - weights are separate)
 */
export const TIME_CONDITIONS = {
  dawn: {
    id: 'dawn',
    name: 'Dawn',
    description: 'Early morning light'
  },
  standard: {
    id: 'standard',
    name: 'Standard',
    description: 'Standard time of day for the map'
  },
  dusk: {
    id: 'dusk',
    name: 'Dusk',
    description: 'Evening twilight'
  },
  night: {
    id: 'night',
    name: 'Pitch Black Night',
    description: 'Night time battle'
  }
};

/**
 * Default weights matching the original d10 ranges:
 * Clear 1-5 (5), Rain 6-9 (4), Inclement 10 (1)
 */
export const DEFAULT_WEATHER_WEIGHTS = {
  clear: 5,
  rain: 4,
  inclement: 1
};

/**
 * Default weights matching the original d10 ranges:
 * Dawn 1-3 (3), Standard 4-7 (4), Dusk 8-9 (2), Night 10 (1)
 */
export const DEFAULT_TIME_WEIGHTS = {
  dawn: 3,
  standard: 4,
  dusk: 2,
  night: 1
};

/**
 * Weighted random selection from a conditions map.
 * Reuses the same pattern as terrain rolls.
 *
 * @param {Object} conditionDefs - e.g. WEATHER_CONDITIONS or TIME_CONDITIONS
 * @param {Object} weights - e.g. { clear: 5, rain: 4, inclement: 1 }
 * @returns {{ condition: Object, weight: number, total: number }}
 */
function rollWeighted(conditionDefs, weights) {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  if (total === 0 || entries.length === 0) {
    // Fallback: return first condition
    const firstId = Object.keys(conditionDefs)[0];
    return { condition: conditionDefs[firstId], weight: 0, total: 0 };
  }

  const roll = Math.random() * total;
  let cumulative = 0;
  for (const [id, weight] of entries) {
    cumulative += weight;
    if (roll < cumulative) {
      return { condition: conditionDefs[id], weight, total };
    }
  }
  // Fallback
  const lastEntry = entries[entries.length - 1];
  return { condition: conditionDefs[lastEntry[0]], weight: lastEntry[1], total };
}

/**
 * Roll for weather condition
 * @param {Object} [customWeights] - Custom weights from campaign settings
 * @returns {{ condition: Object, weight: number, total: number }}
 */
export function rollWeatherCondition(customWeights) {
  const weights = customWeights || DEFAULT_WEATHER_WEIGHTS;
  return rollWeighted(WEATHER_CONDITIONS, weights);
}

/**
 * Roll for time of day condition
 * @param {Object} [customWeights] - Custom weights from campaign settings
 * @returns {{ condition: Object, weight: number, total: number }}
 */
export function rollTimeCondition(customWeights) {
  const weights = customWeights || DEFAULT_TIME_WEIGHTS;
  return rollWeighted(TIME_CONDITIONS, weights);
}

/**
 * @deprecated Use rollWeatherCondition and rollTimeCondition separately
 * Kept for backwards compatibility
 */
export function rollBattleConditions(weatherWeights, timeWeights) {
  return {
    weather: rollWeatherCondition(weatherWeights),
    time: rollTimeCondition(timeWeights)
  };
}
