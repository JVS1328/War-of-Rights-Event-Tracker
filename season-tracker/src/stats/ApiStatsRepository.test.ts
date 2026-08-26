import { describe, it, expect, beforeEach, vi } from 'vitest';

// The repository is exercised against the real API router, with only Upstash
// faked out. That way a change to either side of the wire — a renamed field, a
// moved route — fails here rather than in production.
const { strings, sets, hashes } = vi.hoisted(() => ({
  strings: new Map<string, string>(),
  sets: new Map<string, Set<string>>(),
  hashes: new Map<string, Map<string, string>>(),
}));

vi.mock('@upstash/redis', () => ({
  Redis: class {
    async set(key: string, value: string) { strings.set(key, value); return 'OK'; }
    async get(key: string) { return strings.has(key) ? strings.get(key) : null; }
    async mget(...keys: string[]) { return keys.map((k) => strings.get(k) ?? null); }
    async del(...keys: string[]) {
      keys.forEach((k) => { strings.delete(k); hashes.delete(k); });
      return keys.length;
    }
    async sadd(key: string, ...members: string[]) {
      const set = sets.get(key) ?? new Set<string>();
      members.forEach((m) => set.add(m));
      sets.set(key, set);
      return members.length;
    }
    async srem(key: string, ...members: string[]) {
      const set = sets.get(key) ?? new Set<string>();
      members.forEach((m) => set.delete(m));
      sets.set(key, set);
      return members.length;
    }
    async smembers(key: string) { return [...(sets.get(key) ?? [])]; }
    async hset(key: string, obj: Record<string, string>) {
      const hash = hashes.get(key) ?? new Map<string, string>();
      Object.entries(obj).forEach(([f, v]) => hash.set(f, v));
      hashes.set(key, hash);
      return Object.keys(obj).length;
    }
    async hgetall(key: string) {
      const hash = hashes.get(key);
      return hash ? Object.fromEntries(hash) : null;
    }
    async hdel(key: string, ...fields: string[]) {
      fields.forEach((f) => hashes.get(key)?.delete(f));
      return fields.length;
    }
    async hlen(key: string) { return hashes.get(key)?.size ?? 0; }
  },
}));

const { default: handler } = await import('../../api/_lib/router.js');
const { ApiStatsRepository } = await import('./ApiStatsRepository');
const { setAdminToken, clearAdminToken } = await import('../cloud/session');
const { OVERALL_SCOPE } = await import('./statsBundle');
import type { Scoreboard } from './types';

const TOKEN = 'owner-token-that-is-long-enough';

/** Route fetch() straight into the serverless handler. */
const fakeFetch = async (url: string, init?: RequestInit) => {
  const [path, search = ''] = String(url).replace('/api/db', '').split('?');
  const query: Record<string, string> = Object.fromEntries(new URLSearchParams(search));
  const req = {
    method: init?.method ?? 'GET',
    url,
    body: init?.body ? JSON.parse(String(init.body)) : undefined,
    query: { ...query, path: path.split('/').filter(Boolean) },
    headers: (init?.headers ?? {}) as Record<string, string>,
  };
  let status = 200;
  let payload: unknown = null;
  const res = {
    status(code: number) { status = code; return res; },
    json(obj: unknown) { payload = obj; return res; },
  };
  await handler(req, res);
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload),
    json: async () => payload,
  } as Response;
};

const scoreboard = (filename: string, recordedAt: string): Scoreboard => ({
  sourceFilename: filename,
  recordedAt,
  meta: {
    roundStartTime: null, roundEndTime: null, roundDurationS: null,
    map: 'Bloody Lane', mode: 'Skirmish', area: null, winner: 'USA',
    popNow: null, popRoundStart: null, popRoundPeak: null, popRoundMax: null, popRoundEnd: null,
    moraleUsa: null, moraleCsa: null,
    casualties: {
      USA: { total: 0, inForm: 0, skirm: 0, oob: 0 },
      CSA: { total: 0, inForm: 0, skirm: 0, oob: 0 },
    },
    deathsByWeapon: { USA: {}, CSA: {} },
  },
  players: [{
    name: '1stTX Pvt. Smith', team: 'USA', kills: 3, deaths: 1, kd: 3,
    deathsInForm: 1, deathsSkirm: 0, deathsOob: 0, steamId: '76561198000000001',
  }],
  kills: [],
  joinLeaves: [],
} as unknown as Scoreboard);

let repo: InstanceType<typeof ApiStatsRepository>;

beforeEach(async () => {
  strings.clear();
  sets.clear();
  hashes.clear();
  process.env.UPSTASH_REDIS_REST_URL = 'http://localhost';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
  process.env.WOR_ADMIN_TOKEN = TOKEN;
  vi.stubGlobal('fetch', fakeFetch);
  vi.stubGlobal('localStorage', {
    store: new Map<string, string>(),
    getItem(k: string) { return this.store.get(k) ?? null; },
    setItem(k: string, v: string) { this.store.set(k, v); },
    removeItem(k: string) { this.store.delete(k); },
  });
  setAdminToken(TOKEN);
  repo = new ApiStatsRepository();

  // Every test needs an event to file rounds under.
  await fakeFetch('/api/db/events', {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ slug: 'ssl', name: 'SSL', published: true }),
  });
});

describe('ApiStatsRepository', () => {
  it('saves a round and reads it back whole', async () => {
    const id = await repo.saveScoreboard('ssl', scoreboard('r1.csv', '2026-01-01T00:00:00Z'));
    expect(id).toBe('ssl::r1.csv');

    repo.invalidate();
    const stored = await repo.getScoreboard(id);
    expect(stored?.scoreboard.players[0].steamId).toBe('76561198000000001');
  });

  it('lists rounds newest first without loading their killfeeds', async () => {
    await repo.saveScoreboard('ssl', scoreboard('old.csv', '2026-01-01T00:00:00Z'));
    await repo.saveScoreboard('ssl', scoreboard('new.csv', '2026-02-01T00:00:00Z'));

    repo.invalidate();
    const list = await repo.listScoreboards({ eventId: 'ssl' });
    expect(list.map((s) => s.sourceFilename)).toEqual(['new.csv', 'old.csv']);
    expect(list[0].map).toBe('Bloody Lane');
  });

  it('keeps a round’s binding to a night', async () => {
    await repo.saveScoreboard('ssl', scoreboard('r1.csv', '2026-01-01T00:00:00Z'), { weekId: 'w1', round: 1 });
    repo.invalidate();
    const all = await repo.readAllScoreboards('ssl');
    expect(all[0].binding).toEqual({ weekId: 'w1', round: 1 });
  });

  it('deletes a round', async () => {
    const id = await repo.saveScoreboard('ssl', scoreboard('r1.csv', '2026-01-01T00:00:00Z'));
    await repo.deleteScoreboard(id);
    expect(await repo.readAllScoreboards('ssl')).toEqual([]);
  });

  it('round-trips season-scoped pins and aliases', async () => {
    await repo.setRegimentAssignmentScoped('ssl', 's2', '76561198000000001', '2ndSC');
    await repo.setRegimentAssignment('ssl', '76561198000000001', '1stTX');

    const scoped = await repo.getRegimentAssignmentsScoped('ssl');
    expect(scoped.s2['76561198000000001']).toBe('2ndSC');
    expect(scoped[OVERALL_SCOPE]['76561198000000001']).toBe('1stTX');

    await repo.setRegimentAliases('ssl', { '1stTx': '1stTX' });
    expect(await repo.getRegimentAliases('ssl')).toEqual({ '1stTx': '1stTX' });
  });

  it('a flat alias write leaves season scopes alone', async () => {
    await repo.setRegimentAliasesScoped('ssl', { s2: { a: 'b' } });
    await repo.setRegimentAliases('ssl', { c: 'd' });
    expect(await repo.getRegimentAliasesScoped('ssl')).toEqual({ s2: { a: 'b' }, [OVERALL_SCOPE]: { c: 'd' } });
  });

  it('exports a bundle and imports it back into another event', async () => {
    await repo.saveScoreboard('ssl', scoreboard('r1.csv', '2026-01-01T00:00:00Z'), { weekId: 'w1', round: 1 });
    await repo.setRegimentAssignment('ssl', '76561198000000001', '1stTX');

    const bundle = await repo.exportEventStats('ssl', ['1stTX'], [{ id: 's1', name: 'Season 1', weekIds: ['w1'] }]);
    expect(bundle.scoreboards).toHaveLength(1);

    await fakeFetch('/api/db/events', {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ slug: 'snf', name: 'SNF', published: true }),
    });
    expect(await repo.importEventStats('snf', bundle)).toBe(1);

    const copied = await repo.readAllScoreboards('snf');
    expect(copied).toHaveLength(1);
    expect(copied[0].id).toBe('snf::r1.csv');
    expect(copied[0].binding).toEqual({ weekId: 'w1', round: 1 });
  });

  it('reads fine for a visitor but refuses their writes', async () => {
    await repo.saveScoreboard('ssl', scoreboard('r1.csv', '2026-01-01T00:00:00Z'));

    clearAdminToken();
    const visitor = new ApiStatsRepository();
    expect(await visitor.readAllScoreboards('ssl')).toHaveLength(1);

    await expect(
      visitor.saveScoreboard('ssl', scoreboard('r2.csv', '2026-01-02T00:00:00Z')),
    ).rejects.toThrow(/owner token/);
  });

  it('reports a 404 for an event that is not published', async () => {
    clearAdminToken();
    const visitor = new ApiStatsRepository();
    await expect(visitor.readAllScoreboards('nope')).rejects.toThrow(/Not found/);
  });
});
