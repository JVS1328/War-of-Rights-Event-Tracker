import { DEFAULT_TERRAIN_GROUPS, MAPS_BY_MAPSET } from '../../data/territories';

export const BATTLE_CARDS = [
  { id: 'b-first-attack',   name: 'First Attack',       text: 'Battle is fought at Dawn. Overrides the Time card.',        effect: { overrideTime: 'dawn' } },
  { id: 'b-entrenched',     name: 'Entrenched',         text: 'Defender inflicts +10% casualties.',                       effect: { casPctAgainstAttacker: 10 } },
  { id: 'b-ambush',         name: 'Ambush',             text: 'Attacker inflicts +10% casualties.',                       effect: { casPctAgainstDefender: 10 } },
  { id: 'b-low-morale',     name: 'Low Morale',         text: 'Holder gains +1 fatigue immediately.',                     effect: { fatigue: 1 } },
  { id: 'b-high-morale',    name: 'High Morale',        text: 'Holder clears all fatigue.',                               effect: { clearFatigue: true } },
  { id: 'b-dug-in',         name: 'Dug In',             text: 'Defender takes -10% casualties this battle.',              effect: { defenderCasReduction: 10 } },
  { id: 'b-reckless-charge',name: 'Reckless Charge',    text: 'Attacker takes +15% casualties but wins ties.',            effect: { attackerCasExtra: 15, winTies: true } },
  { id: 'b-flanking-march', name: 'Flanking March',     text: 'Holder picks the map outright.',                           effect: { pickMap: true } },
  { id: 'b-rain-soaked',    name: 'Rain Soaked',        text: 'Force Weather to Inclement.',                              effect: { overrideWeather: 'inclement' } },
  { id: 'b-clear-skies',    name: 'Clear Skies',        text: 'Force Weather to Clear.',                                  effect: { overrideWeather: 'clear' } },
  { id: 'b-reinforced',     name: 'Reinforced',         text: 'Adjacent friendly token shares 20% extra casualties.',     effect: { reinforceShareBonus: 0.2 } },
  { id: 'b-broken-lines',   name: 'Broken Lines',       text: 'Losing side retreats 6 hexes instead of 4.',               effect: { retreatExtra: 2 } },
  { id: 'b-iron-discipline',name: 'Iron Discipline',    text: 'Ignore fatigue casualties this battle.',                   effect: { ignoreFatigue: true } },
  { id: 'b-fog-of-war',     name: 'Fog of War',         text: 'Both sides take 5% fewer casualties.',                     effect: { allCasReduction: 5 } },
  { id: 'b-artillery',      name: 'Artillery Barrage',  text: 'Garrison bonus doubled this battle.',                      effect: { garrisonMultiplier: 2 } }
];

export const SPECIAL_CARDS = [
  { id: 's-rails',          name: 'Rails',              text: 'Holder may continue their turn after disembarking a train.', effect: { rails: true } },
  { id: 's-new-rails',      name: 'New Rails',          text: 'Holder may attack from a train (single use).',              effect: { newRails: true, singleUse: true } },
  { id: 's-forced-march',   name: 'Forced March',       text: 'Holder gains +1 movement point this turn.',                 effect: { bonusMP: 1 } },
  { id: 's-veteran',        name: 'Veteran Troops',     text: 'Holder ignores fatigue in their next battle.',              effect: { skipFatigue: 1 } },
  { id: 's-quartermaster',  name: 'Quartermaster',      text: 'Holder replenishes at half cost once.',                     effect: { halfReplenish: 1 } },
  { id: 's-scout',          name: 'Scout',              text: 'Holder sees enemy token manpower exactly.',                 effect: { revealEnemy: true } },
  { id: 's-bayonet',        name: 'Fix Bayonets',       text: 'Holder inflicts +15% casualties in next attack.',           effect: { nextAttackBonus: 15 } },
  { id: 's-iron-brigade',   name: 'Iron Brigade',       text: 'Holder takes -15% casualties in next defense.',             effect: { nextDefenseReduction: 15 } },
  { id: 's-munitions',      name: 'Fresh Munitions',    text: 'Faction gains $500.',                                       effect: { money: 500 } },
  { id: 's-recruit-drive',  name: 'Recruitment Drive',  text: 'Faction gains 500 manpower to the pool.',                   effect: { manpower: 500 } },
  { id: 's-spy',            name: 'Spy Network',        text: 'View opposing faction hand.',                               effect: { viewHand: true } },
  { id: 's-cavalry',        name: 'Cavalry Raid',       text: 'Enemy token takes 100 casualties immediately.',             effect: { enemyCasualties: 100 } }
];

export const EVENT_CARDS = [
  { id: 'e-hard-winter',    name: 'Hard Winter',        text: 'Attacker casualties +10% this month.',                     duration: 'month', effect: { extraWinterPct: 10 } },
  { id: 'e-draft-call',     name: 'Draft Call',         text: 'Both sides gain 1000 manpower.',                           duration: 'instant', effect: { bothManpower: 1000 } },
  { id: 'e-disease',        name: 'Camp Disease',       text: 'Each token loses 100 manpower.',                            duration: 'instant', effect: { everyTokenCas: 100 } },
  { id: 'e-financial-panic',name: 'Financial Panic',    text: 'Both sides lose $1000.',                                   duration: 'instant', effect: { bothMoney: -1000 } },
  { id: 'e-foreign-aid',    name: 'Foreign Aid',        text: 'Both sides gain $1500.',                                   duration: 'instant', effect: { bothMoney: 1500 } },
  { id: 'e-railroad-strike',name: 'Railroad Strike',    text: 'No train movement this month.',                            duration: 'month', effect: { noTrains: true } },
  { id: 'e-flood',          name: 'Flood',              text: 'River movement costs doubled this month.',                 duration: 'month', effect: { riverCostMultiplier: 2 } },
  { id: 'e-clear-roads',    name: 'Clear Roads',        text: 'March hex/MP +1 this month.',                              duration: 'month', effect: { marchBonus: 1 } },
  { id: 'e-desertion',      name: 'Desertion',          text: 'Each faction loses 500 manpower from the pool.',           duration: 'instant', effect: { bothPoolManpower: -500 } },
  { id: 'e-sickness',       name: 'Sickness in Camp',   text: 'All tokens gain +1 fatigue.',                              duration: 'instant', effect: { allFatigue: 1 } },
  { id: 'e-propaganda',     name: 'Propaganda Victory', text: 'Side with more cities gains +1 victory.',                  duration: 'instant', effect: { majorityCitiesVictory: 1 } },
  { id: 'e-emancipation',   name: 'Emancipation',       text: 'USA gains +1 VP.',                                         duration: 'instant', effect: { vp: { USA: 1 } } },
  { id: 'e-blockade',       name: 'Naval Blockade',     text: 'CSA city income halved this month.',                       duration: 'month', effect: { csaIncomeMultiplier: 0.5 } },
  { id: 'e-smuggling',      name: 'Smuggling Run',      text: 'CSA gains $750.',                                          duration: 'instant', effect: { money: { CSA: 750 } } },
  { id: 'e-industrial',     name: 'Industrial Output',  text: 'USA city income doubled this month.',                      duration: 'month', effect: { usaIncomeMultiplier: 2 } }
];

export const TERRAIN_DECKS = {
  fields: DEFAULT_TERRAIN_GROUPS.Farmlands.slice(),
  woods: DEFAULT_TERRAIN_GROUPS.Wooded.slice(),
  urban: DEFAULT_TERRAIN_GROUPS.Urban.slice(),
  river: ['Burnside\'s Bridge', 'Pry Ford', 'River Crossing', 'Shenandoah Street', 'Crossley Creek', 'Limestone Bridge', 'Waterways'],
  forts: ['Maryland Heights', 'Bolivar Heights Redoubt', 'Bolivar Heights Camp', 'School House Ridge', 'Fort Monroe', 'Harpers Ferry Graveyard'],
  cities: MAPS_BY_MAPSET['Harpers Ferry'].concat(['Downtown', 'High Street', 'Washington Street', 'Shenandoah Street']),
  conquest: [
    ...MAPS_BY_MAPSET['Antietam Conquest'],
    ...MAPS_BY_MAPSET['Drill Camp Conquest'],
    ...MAPS_BY_MAPSET['Harpers Ferry Conquest'],
    ...MAPS_BY_MAPSET['South Mountain Conquest']
  ]
};

const mkDeck = (cards) => ({
  draw: cards.map(c => c.id),
  discard: []
});

const mkStringDeck = (strings) => ({
  draw: strings.slice(),
  discard: []
});

export const DEFAULT_WEATHER = [
  { id: 'w-clear',     name: 'Clear Skies',        weather: 'clear' },
  { id: 'w-clear-2',   name: 'Clear Skies',        weather: 'clear' },
  { id: 'w-clear-3',   name: 'Clear Skies',        weather: 'clear' },
  { id: 'w-clear-4',   name: 'Clear Skies',        weather: 'clear' },
  { id: 'w-clear-5',   name: 'Clear Skies',        weather: 'clear' },
  { id: 'w-rain-1',    name: 'Tempered Rainstorm', weather: 'rain'  },
  { id: 'w-rain-2',    name: 'Tempered Rainstorm', weather: 'rain'  },
  { id: 'w-rain-3',    name: 'Tempered Rainstorm', weather: 'rain'  },
  { id: 'w-rain-4',    name: 'Tempered Rainstorm', weather: 'rain'  },
  { id: 'w-inclement', name: 'Inclement Weather',  weather: 'inclement' }
];

export const DEFAULT_TIME = [
  { id: 't-dawn-1',     name: 'Dawn',               time: 'dawn' },
  { id: 't-dawn-2',     name: 'Dawn',               time: 'dawn' },
  { id: 't-dawn-3',     name: 'Dawn',               time: 'dawn' },
  { id: 't-standard-1', name: 'Standard',           time: 'standard' },
  { id: 't-standard-2', name: 'Standard',           time: 'standard' },
  { id: 't-standard-3', name: 'Standard',           time: 'standard' },
  { id: 't-standard-4', name: 'Standard',           time: 'standard' },
  { id: 't-dusk-1',     name: 'Dusk',               time: 'dusk' },
  { id: 't-dusk-2',     name: 'Dusk',               time: 'dusk' },
  { id: 't-night',      name: 'Pitch Black Night',  time: 'night' }
];

export const createStarterDecks = () => ({
  battle:   mkDeck(BATTLE_CARDS),
  special:  mkDeck(SPECIAL_CARDS),
  event:    mkDeck(EVENT_CARDS),
  weather:  mkDeck(DEFAULT_WEATHER),
  time:     mkDeck(DEFAULT_TIME),
  terrainFields:   mkStringDeck(TERRAIN_DECKS.fields),
  terrainWoods:    mkStringDeck(TERRAIN_DECKS.woods),
  terrainUrban:    mkStringDeck(TERRAIN_DECKS.urban),
  terrainRiver:    mkStringDeck(TERRAIN_DECKS.river),
  terrainForts:    mkStringDeck(TERRAIN_DECKS.forts),
  terrainCities:   mkStringDeck(TERRAIN_DECKS.cities),
  terrainConquest: mkStringDeck(TERRAIN_DECKS.conquest)
});

export const CARD_LIBRARY = {
  battle:  BATTLE_CARDS,
  special: SPECIAL_CARDS,
  event:   EVENT_CARDS,
  weather: DEFAULT_WEATHER,
  time:    DEFAULT_TIME
};

export const getCardById = (deckKey, id) => {
  const lib = CARD_LIBRARY[deckKey];
  if (!lib) return null;
  return lib.find(c => c.id === id) || null;
};
