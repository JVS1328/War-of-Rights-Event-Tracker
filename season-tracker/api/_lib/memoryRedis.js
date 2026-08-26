/**
 * An in-memory stand-in for Upstash, good enough for the handful of commands
 * api/_lib/store.js issues. The dev server installs it when no real database is
 * configured, so the site runs end to end on a laptop with nothing provisioned.
 * It forgets everything when the process exits, which is the point.
 */
export function createMemoryRedis() {
  const strings = new Map();
  const sets = new Map();
  const hashes = new Map();

  return {
    async set(key, value) { strings.set(key, value); return 'OK'; },
    async get(key) { return strings.has(key) ? strings.get(key) : null; },
    async mget(...keys) { return keys.map((k) => (strings.has(k) ? strings.get(k) : null)); },
    async del(...keys) {
      let removed = 0;
      for (const key of keys) {
        if (strings.delete(key)) removed += 1;
        if (hashes.delete(key)) removed += 1;
      }
      return removed;
    },
    async sadd(key, ...members) {
      const set = sets.get(key) ?? new Set();
      members.forEach((m) => set.add(m));
      sets.set(key, set);
      return members.length;
    },
    async srem(key, ...members) {
      const set = sets.get(key) ?? new Set();
      members.forEach((m) => set.delete(m));
      sets.set(key, set);
      return members.length;
    },
    async smembers(key) { return [...(sets.get(key) ?? [])]; },
    async hset(key, obj) {
      const hash = hashes.get(key) ?? new Map();
      for (const [field, value] of Object.entries(obj)) hash.set(field, value);
      hashes.set(key, hash);
      return Object.keys(obj).length;
    },
    async hgetall(key) {
      const hash = hashes.get(key);
      return hash ? Object.fromEntries(hash) : null;
    },
    async hdel(key, ...fields) {
      const hash = hashes.get(key) ?? new Map();
      fields.forEach((f) => hash.delete(f));
      return fields.length;
    },
    async hlen(key) { return hashes.get(key)?.size ?? 0; },
  };
}
