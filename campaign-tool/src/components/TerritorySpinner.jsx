import { useState, useEffect, useRef } from 'react';
import { RotateCw, MapPin, Check, X } from 'lucide-react';

/**
 * TerritorySpinner - Animated roulette for selecting battle territory.
 * Mirrors CommanderSpinner UX: random spin + manual "Pick" dropdown.
 */
const TerritorySpinner = ({ territories, selectedTerritoryId, onSelect, disabled = false }) => {
  const [spinning, setSpinning] = useState(false);
  const [displayName, setDisplayName] = useState(null);
  const spinIntervalRef = useRef(null);

  const selected = territories.find(t => t.id === selectedTerritoryId) || null;

  const spin = () => {
    if (territories.length === 0 || spinning || disabled) return;

    setSpinning(true);
    let iterations = 0;
    const maxIterations = 20 + Math.floor(Math.random() * 10);

    if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);

    spinIntervalRef.current = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * territories.length);
      setDisplayName(territories[randomIndex].name);
      iterations++;

      if (iterations >= maxIterations) {
        clearInterval(spinIntervalRef.current);
        const finalIndex = Math.floor(Math.random() * territories.length);
        const result = territories[finalIndex];
        setDisplayName(result.name);
        setSpinning(false);
        onSelect(result.id);
      }
    }, 50 + (iterations * 5));
  };

  useEffect(() => {
    return () => {
      if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
    };
  }, []);

  const getOwnerColor = (owner) => {
    if (owner === 'USA') return 'text-blue-400';
    if (owner === 'CSA') return 'text-red-400';
    return 'text-slate-400';
  };

  const getOwnerBadge = (owner) => {
    if (owner === 'USA') return 'bg-blue-900/50 text-blue-300';
    if (owner === 'CSA') return 'bg-red-900/50 text-red-300';
    return 'bg-slate-700 text-slate-400';
  };

  return (
    <div>
      {/* Spinner Display */}
      <div className={`bg-slate-800 rounded-lg p-3 mb-3 min-h-[60px] flex items-center justify-center border-2 ${
        spinning ? 'border-amber-500' : selected ? 'border-green-500' : 'border-slate-600'
      } transition-colors`}>
        {selected && !spinning ? (
          <div className="flex items-center gap-2">
            <Check className="w-5 h-5 text-green-400" />
            <span className="text-white font-bold">{selected.name}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${getOwnerBadge(selected.owner)}`}>
              {selected.owner}
            </span>
            <span className="text-green-400 text-xs font-semibold">{selected.victoryPoints} VP</span>
          </div>
        ) : spinning ? (
          <div className="flex items-center gap-2">
            <RotateCw className="w-5 h-5 text-amber-400 animate-spin" />
            <span className="text-amber-400 font-semibold animate-pulse">
              {displayName || '...'}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-slate-500">
            <MapPin className="w-5 h-5" />
            <span>Spin or pick a territory</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        {selected && !spinning ? (
          <button
            onClick={() => onSelect('')}
            disabled={disabled}
            className="flex-1 px-3 py-2 rounded font-semibold transition flex items-center justify-center gap-2 bg-slate-600 hover:bg-slate-500 text-white"
          >
            <X className="w-4 h-4" />
            Change
          </button>
        ) : (
          <button
            onClick={spin}
            disabled={spinning || disabled || territories.length === 0}
            className={`flex-1 px-3 py-2 rounded font-semibold transition flex items-center justify-center gap-2 ${
              spinning || disabled || territories.length === 0
                ? 'bg-slate-600 cursor-not-allowed opacity-50 text-slate-400'
                : 'bg-amber-600 hover:bg-amber-700 text-white'
            }`}
          >
            <RotateCw className={`w-4 h-4 ${spinning ? 'animate-spin' : ''}`} />
            {spinning ? 'Spinning...' : 'Spin'}
          </button>
        )}

        {/* Manual Pick */}
        {!selected && !spinning && territories.length > 0 && !disabled && (
          <select
            onChange={(e) => onSelect(e.target.value)}
            value=""
            className="px-2 py-2 rounded bg-slate-700 border border-slate-600 text-white text-sm cursor-pointer hover:bg-slate-600 transition"
          >
            <option value="" disabled>Pick</option>
            {territories.map(t => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.owner}) - {t.victoryPoints} VP
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
};

export default TerritorySpinner;
