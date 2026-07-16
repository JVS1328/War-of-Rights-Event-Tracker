import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { pickEnv } from './share.js';

// The exact var set a Vercel + Upstash integration creates.
const INTEGRATION = [
  'upstash_KV_REST_API_URL',
  'upstash_KV_REST_API_TOKEN',
  'upstash_KV_REST_API_READ_ONLY_TOKEN',
  'upstash_KV_URL',
  'upstash_REDIS_URL',
];
const CANONICAL = ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'REDIS_URL', 'KV_URL'];

describe('pickEnv — resolves Vercel storage-integration prefixes', () => {
  const saved = {};
  beforeEach(() => {
    for (const k of [...INTEGRATION, ...CANONICAL]) { saved[k] = process.env[k]; delete process.env[k]; }
  });
  afterEach(() => {
    for (const k of [...INTEGRATION, ...CANONICAL]) {
      if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
    }
  });

  it('selects the prefixed REST url + read-write token, not the read-only one', () => {
    process.env.upstash_KV_REST_API_URL = 'https://db.upstash.io';
    process.env.upstash_KV_REST_API_TOKEN = 'rw-token';
    process.env.upstash_KV_REST_API_READ_ONLY_TOKEN = 'ro-token';
    process.env.upstash_KV_URL = 'rediss://db';
    process.env.upstash_REDIS_URL = 'rediss://db';

    expect(pickEnv('UPSTASH_REDIS_REST_URL', 'KV_REST_API_URL')).toBe('https://db.upstash.io');
    const token = pickEnv('UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_TOKEN');
    expect(token).toBe('rw-token');
    expect(token).not.toBe('ro-token');
  });

  it('returns undefined when only the read-only token exists', () => {
    process.env.upstash_KV_REST_API_READ_ONLY_TOKEN = 'ro-token';
    expect(pickEnv('UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_TOKEN')).toBeUndefined();
  });

  it('prefers an exact (unprefixed) name over a suffix match', () => {
    process.env.KV_REST_API_URL = 'exact';
    process.env.upstash_KV_REST_API_URL = 'prefixed';
    expect(pickEnv('UPSTASH_REDIS_REST_URL', 'KV_REST_API_URL')).toBe('exact');
  });

  it('resolves a prefixed TCP url for the node-redis fallback', () => {
    process.env.upstash_REDIS_URL = 'rediss://db:6379';
    expect(pickEnv('REDIS_URL', 'KV_URL')).toBe('rediss://db:6379');
  });
});
