import { describe, it, expect } from 'vitest';
import { parseRoute, hrefFor } from './route';

describe('parseRoute', () => {
  it('reads the directory from an empty or unknown hash', () => {
    expect(parseRoute('')).toEqual({ kind: 'directory' });
    expect(parseRoute('#/')).toEqual({ kind: 'directory' });
    expect(parseRoute('#/nonsense')).toEqual({ kind: 'directory' });
  });

  it('reads an event, defaulting to its overview', () => {
    expect(parseRoute('#/e/ssl')).toEqual({ kind: 'event', slug: 'ssl', screen: 'overview', season: null });
  });

  it('reads a named screen and a season scope', () => {
    expect(parseRoute('#/e/ssl/stats/sea_3')).toEqual({
      kind: 'event', slug: 'ssl', screen: 'stats', season: 'sea_3',
    });
  });

  it('falls back to the overview for a screen that does not exist', () => {
    expect(parseRoute('#/e/ssl/wharrgarbl')).toMatchObject({ screen: 'overview' });
  });

  it('lower-cases the slug, since that is how the database keys it', () => {
    expect(parseRoute('#/e/SSL')).toMatchObject({ slug: 'ssl' });
  });

  it('reads the tools and admin screens', () => {
    expect(parseRoute('#/tools')).toEqual({ kind: 'tools' });
    expect(parseRoute('#/admin')).toEqual({ kind: 'admin' });
  });

  it('round-trips through hrefFor', () => {
    for (const hash of ['#/', '#/tools', '#/admin', '#/e/ssl/standings', '#/e/ssl/stats/sea_3']) {
      expect(hrefFor(parseRoute(hash))).toBe(hash);
    }
  });
});
