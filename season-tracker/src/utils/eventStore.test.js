import { describe, it, expect } from 'vitest';
import {
  makeDefaultBalancerSettings,
  makeDefaultSeason,
  migrateLegacyFlatToV2,
  makeDefaultEvent,
  addSeasonToActiveEvent,
  getActiveSeason,
  openOnLatestSeason,
  removeActiveSeason,
  setActiveEvent,
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

// An event whose seasons arrived out of order: Season 4's file was imported
// after Season 5's, so array order names the wrong season as the newest.
const outOfOrderState = () => {
  const seasons = ['Season 2', 'Season 3', 'Season 5', 'Season 4'].map(name =>
    makeDefaultSeason({ name }),
  );
  const event = makeDefaultEvent({ seasons });
  return {
    state: { schemaVersion: 2, activeEventId: event.id, activeSeasonId: null, events: [event] },
    seasons,
  };
};

describe('which season the app opens on', () => {
  it('opens on the most recent season, not the last one imported', () => {
    const { state, seasons } = outOfOrderState();
    const opened = openOnLatestSeason({ ...state, activeSeasonId: seasons[3].id });
    expect(getActiveSeason(opened).name).toBe('Season 5');
  });

  it('leaves an event with no seasons alone', () => {
    const event = makeDefaultEvent({ seasons: [] });
    const state = { schemaVersion: 2, activeEventId: event.id, activeSeasonId: null, events: [event] };
    expect(openOnLatestSeason(state)).toEqual(state);
  });

  it('falls back to the most recent season when the active id is stale', () => {
    const { state } = outOfOrderState();
    expect(getActiveSeason({ ...state, activeSeasonId: 'gone' }).name).toBe('Season 5');
  });

  it('lands on the most recent season when switching events', () => {
    const { state } = outOfOrderState();
    const other = makeDefaultEvent({ name: 'Other', seasons: [makeDefaultSeason()] });
    const twoEvents = { ...state, events: [...state.events, other] };
    const switched = setActiveEvent(setActiveEvent(twoEvents, other.id), state.events[0].id);
    expect(getActiveSeason(switched).name).toBe('Season 5');
  });

  it('drops back to the most recent survivor when a season is removed', () => {
    const { state, seasons } = outOfOrderState();
    const after = removeActiveSeason({ ...state, activeSeasonId: seasons[2].id }); // remove Season 5
    expect(getActiveSeason(after).name).toBe('Season 4');
  });
});

describe('naming a new season', () => {
  it('continues the numbering instead of counting the seasons', () => {
    const seasons = ['Season 2', 'Season 3', 'Season 4'].map(name => makeDefaultSeason({ name }));
    const event = makeDefaultEvent({ seasons });
    const state = { schemaVersion: 2, activeEventId: event.id, activeSeasonId: seasons[2].id, events: [event] };
    expect(getActiveSeason(addSeasonToActiveEvent(state)).name).toBe('Season 5');
  });
});
