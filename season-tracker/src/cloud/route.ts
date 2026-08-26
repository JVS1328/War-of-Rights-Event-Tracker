/**
 * Where you are on the site, read out of the URL hash.
 *
 * Hash routing rather than paths, because the app is a static build served by
 * one index.html — a path route would 404 on a hard refresh without a rewrite
 * rule, and share links have always lived in the hash anyway.
 *
 *   #/                      the public directory: find your event
 *   #/e/<slug>              an event, on its default screen
 *   #/e/<slug>/<screen>     an event, on a named screen
 *   #/e/<slug>/<screen>/<season>   ...scoped to one season
 *   #/tools                 the balancer and splitter, no event needed
 *   #/admin                 the tracker, for whoever holds the admin pass
 *
 * Legacy share links (#s=, #share=) are left alone: App checks those first and
 * never asks this module about them.
 */

export type PublicScreen =
  | 'overview'
  | 'standings'
  | 'schedule'
  | 'roster'
  | 'playoffs'
  | 'ladder'
  | 'stats';

export const PUBLIC_SCREENS: { key: PublicScreen; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'standings', label: 'Standings' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'roster', label: 'Roster' },
  { key: 'playoffs', label: 'Playoffs' },
  { key: 'ladder', label: 'Elo ladder' },
  { key: 'stats', label: 'Player stats' },
];

const SCREEN_KEYS = new Set(PUBLIC_SCREENS.map((s) => s.key));

export type Route =
  | { kind: 'directory' }
  | { kind: 'event'; slug: string; screen: PublicScreen; season: string | null }
  | { kind: 'tools' }
  | { kind: 'admin' };

/** Read the current hash. Anything unrecognised lands on the directory. */
export function parseRoute(hash: string = window.location.hash): Route {
  const path = hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent).filter(Boolean);

  if (path[0] === 'admin') return { kind: 'admin' };
  if (path[0] === 'tools') return { kind: 'tools' };
  if (path[0] === 'e' && path[1]) {
    const screen = path[2] && SCREEN_KEYS.has(path[2] as PublicScreen)
      ? (path[2] as PublicScreen)
      : 'overview';
    return { kind: 'event', slug: path[1].toLowerCase(), screen, season: path[3] ?? null };
  }
  return { kind: 'directory' };
}

/** The hash for a route — what links on the site point at. */
export function hrefFor(route: Route): string {
  switch (route.kind) {
    case 'admin':
      return '#/admin';
    case 'tools':
      return '#/tools';
    case 'event': {
      const parts = ['e', route.slug, route.screen];
      if (route.season) parts.push(route.season);
      return `#/${parts.map(encodeURIComponent).join('/')}`;
    }
    default:
      return '#/';
  }
}

/** Go somewhere, leaving a history entry so Back works. */
export function navigate(route: Route): void {
  window.location.hash = hrefFor(route);
}
