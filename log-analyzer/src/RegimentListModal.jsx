import React, { useState, useEffect } from 'react';
import { X, Users } from 'lucide-react';

const RegimentListModal = ({ isOpen, mode = 'import', onApply, onSkip }) => {
  const [text, setText] = useState('');
  const [applyMode, setApplyMode] = useState('replace');

  useEffect(() => {
    if (isOpen) {
      setText('');
      setApplyMode('replace');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isPostImport = mode === 'post';
  const skipLabel = isPostImport ? 'Cancel' : 'Skip';
  const title = isPostImport ? 'Group by Regiment List' : 'Regiment List (optional)';
  const subtitle = isPostImport
    ? 'Re-group already-loaded rounds against an explicit regiment list.'
    : 'Provide an explicit list of regiments to group players by, instead of auto-detecting from names.';

  const handleApply = () => {
    if (!text.trim()) {
      onSkip();
      return;
    }
    onApply(text, applyMode);
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <h2 className="text-xl font-bold text-amber-400 flex items-center gap-2">
            <Users className="w-5 h-5" />
            {title}
          </h2>
          <button
            onClick={onSkip}
            className="p-1 text-slate-400 hover:text-white transition"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-slate-300 text-sm leading-relaxed">{subtitle}</p>

          <div>
            <label className="block text-slate-300 text-sm font-semibold mb-2">
              Regiments (one per line)
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={10}
              placeholder={`3rdCB\nMSG\nII Corps = II-\n23rdNYV = 23rdNYV, 23rd_NYV`}
              className="w-full bg-slate-900 border border-slate-600 rounded p-3 text-slate-100 font-mono text-sm focus:outline-none focus:border-amber-500"
              spellCheck={false}
              autoFocus
            />
            <div className="text-slate-400 text-xs mt-2 leading-relaxed">
              <div className="font-semibold text-slate-300 mb-1">Syntax</div>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Plain line — label and match pattern are the same: <code className="text-amber-300">3rdCB</code></li>
                <li>Aliased line — label on the left, comma-separated patterns on the right: <code className="text-amber-300">II Corps = II-</code></li>
                <li>Matching is case-insensitive substring with delimiter boundaries (brackets, dots, hyphens, spaces, etc.)</li>
                <li>When multiple patterns match, the longest match wins</li>
                <li>Spaces and certain suffixes are stripped from labels for grouping (e.g., <code className="text-amber-300">II Corps</code> becomes <code className="text-amber-300">IICorps</code>)</li>
              </ul>
            </div>
          </div>

          <div>
            <div className="text-slate-300 text-sm font-semibold mb-2">Mode</div>
            <div className="space-y-2">
              <label className="flex items-start gap-3 cursor-pointer p-2 rounded hover:bg-slate-700/50">
                <input
                  type="radio"
                  name="regimentMode"
                  value="replace"
                  checked={applyMode === 'replace'}
                  onChange={() => setApplyMode('replace')}
                  className="mt-1"
                />
                <div className="text-sm">
                  <div className="text-slate-200 font-semibold">Replace auto-detection (default)</div>
                  <div className="text-slate-400">Players that don't match any list entry go to UNTAGGED.</div>
                </div>
              </label>
              <label className="flex items-start gap-3 cursor-pointer p-2 rounded hover:bg-slate-700/50">
                <input
                  type="radio"
                  name="regimentMode"
                  value="augment"
                  checked={applyMode === 'augment'}
                  onChange={() => setApplyMode('augment')}
                  className="mt-1"
                />
                <div className="text-sm">
                  <div className="text-slate-200 font-semibold">Augment auto-detection</div>
                  <div className="text-slate-400">List matches first, then fall back to auto-detection (or existing assignments) for the rest.</div>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 p-5 border-t border-slate-700">
          <button
            onClick={onSkip}
            className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded transition font-semibold"
          >
            {skipLabel}
          </button>
          <button
            onClick={handleApply}
            disabled={!text.trim()}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded transition font-semibold"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};

export default RegimentListModal;
