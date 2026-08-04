import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('../index.css', import.meta.url), 'utf8');
const classic = fs.readFileSync(new URL('../theme-classic.css', import.meta.url), 'utf8');

/**
 * The faction pair is the only categorical colour scale in the app, so it has
 * to survive colour-vision deficiency. The old USA green / CSA tan measured
 * ΔE 6.2 (protan) and 13.7 (normal) against floors of 8 and 15. These guard
 * the replacement so a future palette tweak can't quietly regress it.
 */
const hexOf = (src: string, token: string, after = 0) => {
  const m = src.slice(after).match(new RegExp(`${token}:\\s*(#[0-9a-f]{6})`, 'i'));
  return m ? m[1].toLowerCase() : null;
};

// sRGB -> OKLab, then ΔE as plain Euclidean distance ×100 (matches the checker).
const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
function oklab(hex: string) {
  const r = lin(parseInt(hex.slice(1, 3), 16) / 255);
  const g = lin(parseInt(hex.slice(3, 5), 16) / 255);
  const b = lin(parseInt(hex.slice(5, 7), 16) / 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
const deltaE = (a: string, b: string) => {
  const [l1, a1, b1] = oklab(a);
  const [l2, a2, b2] = oklab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2) * 100;
};
/** Protanope simulation (Brettel/Viénot), enough to catch a red-green collapse. */
function protan(hex: string) {
  const r = lin(parseInt(hex.slice(1, 3), 16) / 255);
  const g = lin(parseInt(hex.slice(3, 5), 16) / 255);
  const b = lin(parseInt(hex.slice(5, 7), 16) / 255);
  const M = 0.15537241 * r + 0.75789446 * g + 0.08670142 * b;
  const S = 0.01775239 * r + 0.10944209 * g + 0.87256922 * b;
  const Lp = 1.05118294 * M - 0.05116099 * S;
  const back = (x: number) => {
    const v = Math.max(0, Math.min(1, x));
    const srgb = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
    return Math.round(srgb * 255).toString(16).padStart(2, '0');
  };
  const rr = 5.47221206 * Lp - 4.6419601 * M + 0.16963708 * S;
  const gg = -1.1252419 * Lp + 2.29317094 * M - 0.1678952 * S;
  const bb = 0.02980165 * Lp - 0.19318073 * M + 1.16364789 * S;
  return `#${back(rr)}${back(gg)}${back(bb)}`;
}

describe('faction palette', () => {
  const themes: [string, string, string][] = [
    ['modern light', hexOf(css, '--color-usa')!, hexOf(css, '--color-csa')!],
    ['modern dark', hexOf(css, '--color-usa', css.indexOf('.dark {'))!, hexOf(css, '--color-csa', css.indexOf('.dark {'))!],
    ['classic light', hexOf(classic, '--color-usa')!, hexOf(classic, '--color-csa')!],
    ['classic dark', hexOf(classic, '--color-usa', classic.indexOf('[data-theme="classic"].dark'))!,
      hexOf(classic, '--color-csa', classic.indexOf('[data-theme="classic"].dark'))!],
  ];

  it.each(themes)('%s defines both faction tokens', (_n, usa, csa) => {
    expect(usa).toMatch(/^#[0-9a-f]{6}$/);
    expect(csa).toMatch(/^#[0-9a-f]{6}$/);
  });

  it.each(themes)('%s separates USA from CSA for normal vision', (_n, usa, csa) => {
    expect(deltaE(usa, csa)).toBeGreaterThanOrEqual(15);
  });

  it.each(themes)('%s separates USA from CSA under protanopia', (_n, usa, csa) => {
    expect(deltaE(protan(usa), protan(csa))).toBeGreaterThanOrEqual(8);
  });

  it('keeps the UI accent distinct from the CSA hue', () => {
    // A selected tab must not read as "Confederate".
    expect(hexOf(css, '--color-accent')).not.toBe(hexOf(css, '--color-csa'));
  });

  it('gives the ticket stances their own ordinal ramp', () => {
    for (const src of [css, classic]) {
      expect(hexOf(src, '--color-stance-1')).toBeTruthy();
      expect(hexOf(src, '--color-stance-2')).toBeTruthy();
      expect(hexOf(src, '--color-stance-3')).toBeTruthy();
    }
  });
});
