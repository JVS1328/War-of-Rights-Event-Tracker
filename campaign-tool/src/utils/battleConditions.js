/**
 * Battle Conditions System
 * Weather and time of day rolls for battles
 */

/**
 * Weather conditions based on d10 roll
 */
export const WEATHER_CONDITIONS = {
  CLEAR: {
    id: 'clear',
    name: 'Clear Skies',
    description: 'Sunny days and moonlit nights',
    range: [1, 5]
  },
  RAIN: {
    id: 'rain',
    name: 'Tempered Rainstorm',
    description: 'Nothing too crazy that will cause clientside gameplay issues',
    range: [6, 9]
  },
  INCLEMENT: {
    id: 'inclement',
    name: 'Inclement Weather',
    description: 'Rain is cranked up to max - mud, blood, and 20 frames a second',
    range: [10, 10]
  }
};

/**
 * Time of day conditions based on d10 roll
 */
export const TIME_CONDITIONS = {
  DAWN: {
    id: 'dawn',
    name: 'Dawn',
    description: 'Early morning light',
    range: [1, 3]
  },
  STANDARD: {
    id: 'standard',
    name: 'Standard',
    description: 'Standard time of day for the map',
    range: [4, 7]
  },
  DUSK: {
    id: 'dusk',
    name: 'Dusk',
    description: 'Evening twilight',
    range: [8, 9]
  },
  NIGHT: {
    id: 'night',
    name: 'Pitch Black Night',
    description: 'Night time battle',
    range: [10, 10]
  }
};

/**
 * Roll a d10 (1-10)
 * @returns {number} Roll result 1-10
 */
export function rollD10() {
  return Math.floor(Math.random() * 10) + 1;
}

/**
 * Get weather condition from roll
 * @param {number} roll - d10 roll (1-10)
 * @returns {Object} Weather condition object
 */
export function getWeatherFromRoll(roll) {
  if (roll >= 1 && roll <= 5) return WEATHER_CONDITIONS.CLEAR;
  if (roll >= 6 && roll <= 9) return WEATHER_CONDITIONS.RAIN;
  return WEATHER_CONDITIONS.INCLEMENT;
}

/**
 * Get time condition from roll
 * @param {number} roll - d10 roll (1-10)
 * @returns {Object} Time condition object
 */
export function getTimeFromRoll(roll) {
  if (roll >= 1 && roll <= 3) return TIME_CONDITIONS.DAWN;
  if (roll >= 4 && roll <= 7) return TIME_CONDITIONS.STANDARD;
  if (roll >= 8 && roll <= 9) return TIME_CONDITIONS.DUSK;
  return TIME_CONDITIONS.NIGHT;
}

/**
 * Roll for battle conditions (both weather and time)
 * @returns {Object} { weather: { roll, condition }, time: { roll, condition } }
 */
export function rollBattleConditions() {
  const weatherRoll = rollD10();
  const timeRoll = rollD10();

  return {
    weather: {
      roll: weatherRoll,
      condition: getWeatherFromRoll(weatherRoll)
    },
    time: {
      roll: timeRoll,
      condition: getTimeFromRoll(timeRoll)
    }
  };
}
