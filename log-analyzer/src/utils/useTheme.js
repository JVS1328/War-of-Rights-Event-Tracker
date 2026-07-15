import { useState, useEffect, useCallback } from 'react';

// Theme is bootstrapped in index.html (before paint) onto
// document.documentElement.dataset.theme. This hook reads it, lets the UI
// toggle it, and persists the choice.

const KEY = 'woraat-theme';

function currentTheme() {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

export function useTheme() {
  const [theme, setTheme] = useState(currentTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(KEY, theme); } catch { /* ignore */ }
  }, [theme]);

  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);
  return { theme, toggle };
}
