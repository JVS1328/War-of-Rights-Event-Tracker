import { useState } from 'react';
import { X, Layers, RotateCcw } from 'lucide-react';
import { CARD_LIBRARY, getCardById } from '../data/starterCards';
import { reshuffle } from '../utils/cardRules';

const DECK_LABELS = {
  battle: 'Battle Deck',
  special: 'Special Deck',
  event: 'Event Deck',
  weather: 'Weather',
  time: 'Time of Day',
  terrainFields: 'Terrain — Fields',
  terrainWoods: 'Terrain — Woods',
  terrainUrban: 'Terrain — Urban',
  terrainRiver: 'Terrain — River',
  terrainForts: 'Terrain — Forts',
  terrainCities: 'Terrain — Cities',
  terrainConquest: 'Terrain — Conquest'
};

const DeckViewer = ({ campaign, onUpdate, onClose }) => {
  const [selected, setSelected] = useState('battle');
  const deck = campaign.decks[selected];

  const reshuffleDeck = () => {
    const next = reshuffle(deck);
    onUpdate({ ...campaign, decks: { ...campaign.decks, [selected]: next } });
  };

  const renderCard = (id) => {
    const lib = CARD_LIBRARY[selected];
    if (lib) {
      const c = getCardById(selected, id);
      return c ? (
        <div key={id} className="bg-slate-700 rounded px-3 py-2 mb-1">
          <div className="text-amber-300 font-semibold text-sm">{c.name}</div>
          {c.text && <div className="text-slate-300 text-xs">{c.text}</div>}
        </div>
      ) : null;
    }
    return (
      <div key={id} className="bg-slate-700 rounded px-3 py-1 mb-1 text-sm text-slate-200">
        {id}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg border border-slate-700 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-xl font-bold text-amber-400 flex items-center gap-2">
            <Layers className="w-5 h-5" /> Decks
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-56 bg-slate-900 border-r border-slate-700 overflow-y-auto">
            {Object.keys(campaign.decks).map(k => (
              <button
                key={k}
                onClick={() => setSelected(k)}
                className={`w-full text-left px-3 py-2 text-sm border-b border-slate-800 ${selected === k ? 'bg-slate-700 text-amber-400' : 'text-slate-300 hover:bg-slate-800'}`}
              >
                {DECK_LABELS[k] || k}
                <span className="float-right text-xs text-slate-500">
                  {campaign.decks[k].draw.length}/{campaign.decks[k].draw.length + campaign.decks[k].discard.length}
                </span>
              </button>
            ))}
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <div>
                <div className="text-lg font-bold text-white">{DECK_LABELS[selected]}</div>
                <div className="text-xs text-slate-400">
                  Draw: {deck.draw.length} · Discard: {deck.discard.length}
                </div>
              </div>
              <button
                onClick={reshuffleDeck}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-sm flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" /> Reshuffle
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="mb-4">
                <h3 className="text-xs text-slate-400 uppercase tracking-wide mb-1">Draw Pile</h3>
                {deck.draw.length === 0 ? (
                  <div className="text-slate-500 italic text-sm">Empty.</div>
                ) : (
                  deck.draw.map(id => renderCard(id))
                )}
              </div>
              <div>
                <h3 className="text-xs text-slate-400 uppercase tracking-wide mb-1">Discard</h3>
                {deck.discard.length === 0 ? (
                  <div className="text-slate-500 italic text-sm">Empty.</div>
                ) : (
                  deck.discard.map(id => renderCard(id))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeckViewer;
