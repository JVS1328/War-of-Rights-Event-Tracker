// Theme persistence + application. Two independent axes:
//   • family — 'modern' (compact terminal aesthetic) | 'classic' (larger,
//     rounded, sans-serif, easier-to-read; styled after the log-analyzer).
//     Applied via the `data-theme` attribute on <html>; the CSS overrides for
//     classic live in index.css.
//   • mode — 'light' | 'dark', applied via the `.dark` class on <html>.
//
// Both are bootstrapped before paint by the inline script in index.html, so
// these helpers stay in sync with whatever that script already applied. The
// `theme` localStorage key + `.dark` class are the same ones the tracker's
// existing dark toggle uses, so the two stay compatible.

export type ThemeFamily = 'modern' | 'classic';
export type ThemeMode = 'light' | 'dark';

const FAMILY_KEY = 'themeFamily';
const MODE_KEY = 'theme';

export function getThemeFamily(): ThemeFamily {
  return localStorage.getItem(FAMILY_KEY) === 'classic' ? 'classic' : 'modern';
}

export function applyThemeFamily(family: ThemeFamily): void {
  document.documentElement.setAttribute('data-theme', family);
  localStorage.setItem(FAMILY_KEY, family);
}

export function getThemeMode(): ThemeMode {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function applyThemeMode(mode: ThemeMode): void {
  document.documentElement.classList.toggle('dark', mode === 'dark');
  localStorage.setItem(MODE_KEY, mode);
}
