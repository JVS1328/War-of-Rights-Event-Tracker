// Theme switcher used in both the main tracker header and the read-only
// shared-stats header. Two controls:
//   • a Modern | Classic segmented switch (theme family)
//   • an optional light/dark toggle (hidden where a page already has one)
// Both persist via the helpers in utils/theme and apply instantly to <html>.
import { useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import {
  getThemeFamily,
  applyThemeFamily,
  getThemeMode,
  applyThemeMode,
  type ThemeFamily,
  type ThemeMode,
} from '../utils/theme';

const FAMILY_LABEL: Record<ThemeFamily, string> = {
  modern: 'Modern',
  classic: 'Classic',
};
const FAMILY_HINT: Record<ThemeFamily, string> = {
  modern: 'Compact terminal theme',
  classic: 'Larger, rounded, easier-to-read theme',
};

export function ThemeControls({ showMode = true }: { showMode?: boolean }) {
  const [family, setFamily] = useState<ThemeFamily>(() => getThemeFamily());
  const [mode, setMode] = useState<ThemeMode>(() => getThemeMode());

  const chooseFamily = (f: ThemeFamily) => {
    setFamily(f);
    applyThemeFamily(f);
  };
  const toggleMode = () => {
    const next: ThemeMode = mode === 'dark' ? 'light' : 'dark';
    setMode(next);
    applyThemeMode(next);
  };

  return (
    <div className="flex items-center gap-2 shrink-0">
      <div
        className="seg"
        role="group"
        aria-label="Theme"
      >
        {(['modern', 'classic'] as ThemeFamily[]).map((f) => (
          <button
            key={f}
            onClick={() => chooseFamily(f)}
            title={FAMILY_HINT[f]}
            aria-pressed={family === f}

          >
            {FAMILY_LABEL[f]}
          </button>
        ))}
      </div>
      {showMode && (
        <button
          onClick={toggleMode}
          className="gh"
          title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {mode === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      )}
    </div>
  );
}
