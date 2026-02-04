import { useState, useEffect, useRef } from 'react';
import { RotateCw, User, Check, ChevronDown } from 'lucide-react';

/**
 * CommanderSpinner - Animated roulette for selecting battle commanders
 *
 * Features:
 * - Visual spinning animation OR manual dropdown selection
 * - Pool management (selected commanders removed until pool empty, then reset)
 * - Shows both USA and CSA spinners side by side
 */
const CommanderSpinner = ({
  regiments,
  commanderPool,
  onSelect,
  selectedCommanders,
  disabled = false
}) => {
  const [spinning, setSpinning] = useState({ USA: false, CSA: false });
  const [displayName, setDisplayName] = useState({ USA: null, CSA: null });
  const spinIntervalRef = useRef({ USA: null, CSA: null });

  // Get available regiments for each side
  const getAvailableRegiments = (side) => {
    const pool = commanderPool?.[side] || [];
    const sideRegiments = regiments?.[side] || [];

    // If pool is empty, all regiments are available (reset)
    if (pool.length === 0) {
      return sideRegiments;
    }

    // Otherwise, only regiments in the pool are available
    return sideRegiments.filter(r => pool.includes(r.id));
  };

  const spin = (side) => {
    const available = getAvailableRegiments(side);
    if (available.length === 0 || spinning[side] || disabled) return;

    setSpinning({ ...spinning, [side]: true });

    let iterations = 0;
    const maxIterations = 20 + Math.floor(Math.random() * 10); // 20-30 iterations

    // Clear any existing interval
    if (spinIntervalRef.current[side]) {
      clearInterval(spinIntervalRef.current[side]);
    }

    spinIntervalRef.current[side] = setInterval(() => {
      // Pick a random regiment to display
      const randomIndex = Math.floor(Math.random() * available.length);
      setDisplayName(prev => ({ ...prev, [side]: available[randomIndex].name }));

      iterations++;

      if (iterations >= maxIterations) {
        clearInterval(spinIntervalRef.current[side]);

        // Final selection
        const finalIndex = Math.floor(Math.random() * available.length);
        const selected = available[finalIndex];

        setDisplayName(prev => ({ ...prev, [side]: selected.name }));
        setSpinning(prev => ({ ...prev, [side]: false }));

        // Notify parent
        onSelect(side, selected);
      }
    }, 50 + (iterations * 5)); // Gradually slow down
  };

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (spinIntervalRef.current.USA) clearInterval(spinIntervalRef.current.USA);
      if (spinIntervalRef.current.CSA) clearInterval(spinIntervalRef.current.CSA);
    };
  }, []);

  const renderSpinner = (side) => {
    const sideRegiments = regiments?.[side] || [];
    const available = getAvailableRegiments(side);
    const isSpinning = spinning[side];
    const selected = selectedCommanders?.[side];
    const poolSize = commanderPool?.[side]?.length || 0;
    const isUSA = side === 'USA';

    const bgColor = isUSA ? 'bg-blue-900/30' : 'bg-red-900/30';
    const borderColor = isUSA ? 'border-blue-700' : 'border-red-700';
    const textColor = isUSA ? 'text-blue-400' : 'text-red-400';
    const buttonColor = isUSA ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700';

    if (sideRegiments.length === 0) {
      return (
        <div className={`${bgColor} rounded-lg p-4 border ${borderColor}`}>
          <div className={`font-semibold ${textColor} mb-2 text-sm`}>{side} Commander</div>
          <div className="text-slate-500 text-xs italic">No regiments configured</div>
          <div className="text-slate-600 text-xs mt-1">Add regiments in Settings</div>
        </div>
      );
    }

    return (
      <div className={`${bgColor} rounded-lg p-4 border ${borderColor}`}>
        <div className="flex justify-between items-center mb-3">
          <div className={`font-semibold ${textColor} text-sm`}>{side} Commander</div>
          <div className="text-xs text-slate-500">
            {poolSize === 0 ? sideRegiments.length : poolSize}/{sideRegiments.length} available
          </div>
        </div>

        {/* Spinner Display */}
        <div className={`bg-slate-800 rounded-lg p-3 mb-3 min-h-[60px] flex items-center justify-center border-2 ${
          isSpinning ? 'border-amber-500' : selected ? 'border-green-500' : 'border-slate-600'
        } transition-colors`}>
          {selected ? (
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-green-400" />
              <span className="text-white font-bold">{selected.name}</span>
            </div>
          ) : isSpinning ? (
            <div className="flex items-center gap-2">
              <RotateCw className="w-5 h-5 text-amber-400 animate-spin" />
              <span className="text-amber-400 font-semibold animate-pulse">
                {displayName[side] || '...'}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-500">
              <User className="w-5 h-5" />
              <span>Click to spin</span>
            </div>
          )}
        </div>

        {/* Spin Button and Manual Select */}
        <div className="flex gap-2">
          <button
            onClick={() => spin(side)}
            disabled={isSpinning || selected || disabled || available.length === 0}
            className={`flex-1 px-3 py-2 rounded font-semibold transition flex items-center justify-center gap-2 ${
              isSpinning || selected || disabled || available.length === 0
                ? 'bg-slate-600 cursor-not-allowed opacity-50 text-slate-400'
                : `${buttonColor} text-white`
            }`}
          >
            <RotateCw className={`w-4 h-4 ${isSpinning ? 'animate-spin' : ''}`} />
            {selected ? 'Selected' : isSpinning ? 'Spinning...' : 'Spin'}
          </button>

          {/* Manual Selection Dropdown */}
          {!selected && !isSpinning && available.length > 0 && !disabled && (
            <select
              onChange={(e) => {
                const regiment = available.find(r => r.id === e.target.value);
                if (regiment) onSelect(side, regiment);
              }}
              value=""
              className="px-2 py-2 rounded bg-slate-700 border border-slate-600 text-white text-sm cursor-pointer hover:bg-slate-600 transition"
            >
              <option value="" disabled>Pick</option>
              {available.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      {renderSpinner('USA')}
      {renderSpinner('CSA')}
    </div>
  );
};

export default CommanderSpinner;
