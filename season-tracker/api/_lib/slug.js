// A public event is addressed by a slug — the thing a visitor "punches in" on
// the public stats page — so it has to be short, memorable and safe to drop
// into a Redis key and a URL without escaping.

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,47}$/;

/** True when `value` is a well-formed event slug. */
export function isSlug(value) {
  return typeof value === 'string' && SLUG_RE.test(value);
}

/**
 * Best-effort slug for a human event name ("SSL Season 3" -> "ssl-season-3").
 * Returns '' when nothing usable survives, which callers treat as "ask the
 * owner to pick one" rather than inventing a key.
 */
export function slugify(name) {
  const base = String(name ?? '')
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/, '');
  if (!base) return '';
  // A single character can't satisfy SLUG_RE (which wants 2-48), so pad rather
  // than reject — "S" still yields something usable.
  return base.length === 1 ? `${base}-event` : base;
}

/**
 * Scoreboard ids arrive from the client as `${eventId}::${sourceFilename}`.
 * They land in a Redis key, so bound the length and refuse control characters;
 * requiring the event's own prefix keeps one event's writes out of another's
 * keyspace even if a caller gets creative.
 */
export function isScoreboardId(id, slug) {
  if (typeof id !== 'string') return false;
  if (id.length < 3 || id.length > 400) return false;
  for (let i = 0; i < id.length; i += 1) {
    const code = id.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return false;
  }
  return id.startsWith(`${slug}::`);
}
