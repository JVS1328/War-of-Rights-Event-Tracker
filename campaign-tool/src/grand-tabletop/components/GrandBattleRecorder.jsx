import { useState, useMemo, useEffect } from 'react';
import { X, Swords, Shuffle, Dice6 } from 'lucide-react';
import { getCardById, TERRAIN_DECKS } from '../data/starterCards';
import { drawN, drawTop, discardCard } from '../utils/cardRules';
import { resolveTerrainDeckKey, maybeTriggerConquest, isConquestTerrain, coinFlip } from '../utils/conquestRules';
import { getCityByHex, TERRAIN } from '../data/defaultBoard';

const GrandBattleRecorder = ({ campaign, attackerId, defenderId, targetHex, onResolve, onCancel }) => {
  const attacker = campaign.units.find(u => u.id === attackerId);
  const defender = campaign.units.find(u => u.id === defenderId);
  const targetCity = getCityByHex(campaign.board, targetHex);
  const targetTerrain = campaign.board.hexes[targetHex]?.terrain || TERRAIN.FIELD;

  const [step, setStep] = useState('conquest');
  const [conquestRoll, setConquestRoll] = useState(null);
  const [isConquest, setIsConquest] = useState(false);
  const [conquestCoin, setConquestCoin] = useState(null);
  const [mapOptions, setMapOptions] = useState([]);
  const [bannedMap, setBannedMap] = useState(null);
  const [chosenMap, setChosenMap] = useState(null);
  const [weatherCardId, setWeatherCardId] = useState(null);
  const [timeCardId, setTimeCardId] = useState(null);
  const [winner, setWinner] = useState('');
  const [attackerCas, setAttackerCas] = useState(0);
  const [defenderCas, setDefenderCas] = useState(0);
  const [activeBattleCards, setActiveBattleCards] = useState({ attacker: null, defender: null });

  const doConquestRoll = () => {
    if (targetCity || !isConquestTerrain(targetTerrain)) {
      setStep('mapDraw');
      return;
    }
    const { conquest, roll } = maybeTriggerConquest(targetTerrain, targetCity, campaign.settings.conquestRollThreshold);
    setConquestRoll(roll);
    setIsConquest(conquest);
    if (conquest) {
      setConquestCoin(coinFlip());
    }
    setStep('mapDraw');
  };

  const drawMaps = () => {
    let deckKey;
    if (isConquest) {
      deckKey = 'terrainConquest';
    } else {
      deckKey = resolveTerrainDeckKey(targetTerrain, targetCity);
    }
    const deck = campaign.decks[deckKey];
    const { cards } = drawN(deck, 3);
    setMapOptions(cards);
    setStep('pickBan');
  };

  const confirmBan = () => {
    setStep('pick');
  };

  const confirmPick = (map) => {
    setChosenMap(map);
    setStep('weatherTime');
    const { card: wc } = drawTop(campaign.decks.weather);
    const { card: tc } = drawTop(campaign.decks.time);
    setWeatherCardId(wc);
    setTimeCardId(tc);
  };

  const confirmResult = () => {
    if (!winner) return alert('Pick a winner.');
    onResolve({
      id: `battle-${Date.now()}`,
      turn: campaign.turn.turnNumber,
      attackerUnitId: attackerId,
      defenderUnitId: defenderId,
      targetHex,
      mapName: chosenMap,
      weatherCardId,
      timeCardId,
      conquestRoll,
      isConquest,
      conquestCoin,
      winner,
      casualties: {
        attacker: Number(attackerCas) || 0,
        defender: Number(defenderCas) || 0
      },
      battleCards: activeBattleCards,
      reinforcingUnitIds: []
    });
  };

  const weatherCard = weatherCardId ? getCardById('weather', weatherCardId) : null;
  const timeCard = timeCardId ? getCardById('time', timeCardId) : null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg border border-slate-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-xl font-bold text-amber-400 flex items-center gap-2">
            <Swords className="w-5 h-5" /> Battle Resolution
          </h2>
          <button onClick={onCancel} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 border-b border-slate-700 text-sm space-y-1">
          <div><span className="text-slate-400">Attacker:</span> <span className={attacker.faction === 'USA' ? 'text-blue-400' : 'text-red-400'}>{attacker.faction} / {attacker.name}</span> ({attacker.manpower} men, F{attacker.fatigue})</div>
          {defender ? (
            <div><span className="text-slate-400">Defender:</span> <span className={defender.faction === 'USA' ? 'text-blue-400' : 'text-red-400'}>{defender.faction} / {defender.name}</span> ({defender.manpower} men, F{defender.fatigue})</div>
          ) : (
            <div><span className="text-slate-400">Target:</span> Unoccupied {targetCity ? `${targetCity.name} (${targetCity.kind})` : 'hex'}</div>
          )}
          <div><span className="text-slate-400">Hex:</span> {targetHex} · Terrain: {targetTerrain}{targetCity ? ` · ${targetCity.kind}: ${targetCity.name}` : ''}</div>
          {campaign.turn.winter && <div className="text-blue-300 italic">Winter: attacker +{campaign.settings.winterAttritionPct}% casualties</div>}
        </div>

        <div className="p-4 space-y-4">
          {step === 'conquest' && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-amber-400 uppercase">Step 1 — Conquest roll</h3>
              {!targetCity && isConquestTerrain(targetTerrain) ? (
                <>
                  <p className="text-slate-300 text-sm">
                    This is a {targetTerrain} hex. Roll D20 — if ≤ {campaign.settings.conquestRollThreshold}, conquest deck is used.
                  </p>
                  <button
                    onClick={doConquestRoll}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded flex items-center gap-2"
                  >
                    <Dice6 className="w-4 h-4" /> Roll D20
                  </button>
                </>
              ) : (
                <>
                  <p className="text-slate-300 text-sm">
                    Conquest roll not applicable ({targetCity ? 'city/fort battle' : 'river/water'}).
                  </p>
                  <button
                    onClick={() => setStep('mapDraw')}
                    className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded"
                  >
                    Continue
                  </button>
                </>
              )}
            </div>
          )}

          {step === 'mapDraw' && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-amber-400 uppercase">Step 2 — Draw maps</h3>
              {conquestRoll != null && (
                <div className="text-sm text-slate-300">
                  Conquest roll: <span className="font-bold text-amber-400">{conquestRoll}</span> — {isConquest ? 'CONQUEST' : 'Normal terrain deck'}
                </div>
              )}
              {isConquest && (
                <div className="text-sm text-slate-300">
                  Coin flip: <span className="font-bold text-amber-400">{conquestCoin}</span>
                  {conquestCoin === 'tails' && ' — teams play opposite factions on the WoR map'}
                </div>
              )}
              <button
                onClick={drawMaps}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded flex items-center gap-2"
              >
                <Shuffle className="w-4 h-4" /> Draw 3 maps
              </button>
            </div>
          )}

          {step === 'pickBan' && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-amber-400 uppercase">Step 3 — Defender bans 1</h3>
              <div className="grid grid-cols-3 gap-2">
                {mapOptions.map(m => (
                  <button
                    key={m}
                    onClick={() => { setBannedMap(m); confirmBan(); }}
                    className="px-3 py-3 bg-slate-700 hover:bg-red-700 text-white rounded text-sm font-semibold"
                  >
                    {m}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-400">Defender clicks to ban.</p>
            </div>
          )}

          {step === 'pick' && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-amber-400 uppercase">Step 4 — Attacker picks 1</h3>
              <div className="text-xs text-slate-400">Banned: {bannedMap}</div>
              <div className="grid grid-cols-2 gap-2">
                {mapOptions.filter(m => m !== bannedMap).map(m => (
                  <button
                    key={m}
                    onClick={() => confirmPick(m)}
                    className="px-3 py-3 bg-slate-700 hover:bg-green-700 text-white rounded text-sm font-semibold"
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 'weatherTime' && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-amber-400 uppercase">Step 5 — Weather & Time</h3>
              <div className="bg-slate-900 rounded p-3 text-sm space-y-1">
                <div><span className="text-slate-400">Map:</span> <span className="text-amber-300 font-semibold">{chosenMap}</span></div>
                <div><span className="text-slate-400">Weather:</span> <span className="text-cyan-300">{weatherCard?.name}</span></div>
                <div><span className="text-slate-400">Time:</span> <span className="text-purple-300">{timeCard?.name}</span></div>
              </div>
              <button
                onClick={() => setStep('result')}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded"
              >
                Continue to result
              </button>
            </div>
          )}

          {step === 'result' && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-amber-400 uppercase">Step 6 — Enter result</h3>
              <div>
                <label className="text-xs text-slate-400 uppercase">Winner</label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  <button
                    onClick={() => setWinner('attacker')}
                    className={`px-3 py-2 rounded text-sm ${winner === 'attacker' ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                  >
                    Attacker ({attacker.faction})
                  </button>
                  <button
                    onClick={() => setWinner('defender')}
                    className={`px-3 py-2 rounded text-sm ${winner === 'defender' ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                  >
                    Defender {defender ? `(${defender.faction})` : '(unoccupied)'}
                  </button>
                  {isConquest && (
                    <button
                      onClick={() => setWinner('draw')}
                      className={`px-3 py-2 rounded text-sm ${winner === 'draw' ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                    >
                      Draw
                    </button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs text-slate-400 uppercase">Attacker Casualties</span>
                  <input
                    type="number"
                    value={attackerCas}
                    onChange={e => setAttackerCas(e.target.value)}
                    className="w-full mt-1 px-2 py-1.5 bg-slate-700 text-white rounded"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-slate-400 uppercase">Defender Casualties</span>
                  <input
                    type="number"
                    value={defenderCas}
                    onChange={e => setDefenderCas(e.target.value)}
                    className="w-full mt-1 px-2 py-1.5 bg-slate-700 text-white rounded"
                  />
                </label>
              </div>
              <p className="text-xs text-slate-400">
                The rules engine will apply fatigue, ambush, winter, garrison pre-damage, reinforcement, and retreat automatically.
              </p>

              <button
                onClick={confirmResult}
                className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-semibold"
              >
                Resolve Battle
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GrandBattleRecorder;
