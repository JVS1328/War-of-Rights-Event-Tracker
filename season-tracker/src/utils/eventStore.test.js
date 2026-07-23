import { describe, it, expect } from 'vitest';
import {
  makeDefaultBalancerSettings,
  makeDefaultSeason,
  migrateLegacyFlatToV2,
} from './eventStore';

describe('balancer settings — post-season skill weight', () => {
  it('defaults the skill-based post-season weight to 0 (off)', () => {
    expect(makeDefaultBalancerSettings().postSeasonSkillWeight).toBe(0);
  });

  it('is present on a fresh season so it is per-season configurable', () => {
    expect(makeDefaultSeason().balancerSettings.postSeasonSkillWeight).toBe(0);
  });

  it('back-fills the weight when migrating legacy data that predates it', () => {
    const legacy = { balancerSettings: { teammateWeight: 2 } }; // no skill weight
    const v2 = migrateLegacyFlatToV2(legacy);
    const season = v2.events[0].seasons[0];
    expect(season.balancerSettings.postSeasonSkillWeight).toBe(0);
    expect(season.balancerSettings.teammateWeight).toBe(2); // preserved
  });
});
