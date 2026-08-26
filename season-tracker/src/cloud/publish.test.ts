import { describe, it, expect } from 'vitest';
import { eventFromExport, seasonRefsOf, registryUnitsOf, appStateForEvent } from './publish';
import type { TrackerEvent } from './publish';

// Everything the suite has ever written to disk has to come back in. These are
// the shapes: a v2 event export, a whole-app export, and the flat season files
// that predate events existing at all.

const scoreboardBundle = {
  v: 1,
  scoreboards: [{ sourceFilename: 'r1.csv', scoreboard: { sourceFilename: 'r1.csv' } }],
  assignments: { '76561198000000001': '1stTX' },
  aliases: {},
};

describe('eventFromExport', () => {
  it('reads a v2 event export', () => {
    const { event, stats } = eventFromExport({
      schemaVersion: 2,
      kind: 'event',
      event: { id: 'evt_1', name: 'SSL', seasons: [{ id: 's1', name: 'Season 1' }] },
      stats: scoreboardBundle,
    });
    expect(event.name).toBe('SSL');
    expect(event.seasons).toHaveLength(1);
    expect(stats?.scoreboards).toHaveLength(1);
  });

  it('reads a whole-app export, taking the event that was active', () => {
    const { event } = eventFromExport({
      schemaVersion: 2,
      activeEventId: 'evt_2',
      events: [
        { id: 'evt_1', name: 'Old', seasons: [] },
        { id: 'evt_2', name: 'Current', seasons: [] },
      ],
    });
    expect(event.name).toBe('Current');
  });

  it('migrates a flat season file from before events existed', () => {
    const { event } = eventFromExport({
      units: ['1stTX', '2ndSC'],
      nonTokenUnits: ['2ndSC'],
      weeks: [{ id: 1, name: 'Night 1', teamA: ['1stTX'], teamB: ['2ndSC'] }],
      pointSystem: { winLead: 5 },
    });
    expect(event.seasons).toHaveLength(1);
    expect(event.seasons[0].units).toEqual(['1stTX', '2ndSC']);
    expect(event.seasons[0].pointSystem?.winLead).toBe(5);
    // Every unit named anywhere ends up in the event registry, which is what
    // the stats screens resolve regiment tags against.
    expect(registryUnitsOf(event).sort()).toEqual(['1stTX', '2ndSC']);
  });

  it('carries an attached stats bundle through every shape', () => {
    const flat = eventFromExport({ units: [], weeks: [], stats: scoreboardBundle });
    expect(flat.stats?.assignments['76561198000000001']).toBe('1stTX');
  });

  it('reports no stats rather than a broken bundle', () => {
    expect(eventFromExport({ units: [], weeks: [], stats: { nonsense: true } }).stats).toBeNull();
  });

  it('refuses a file that is not an export at all', () => {
    expect(() => eventFromExport({ hello: 'world' })).toThrow(/not a season or event export/);
    expect(() => eventFromExport(null)).toThrow(/not a season or event export/);
    expect(() => eventFromExport({ kind: 'event', event: { id: 'x', name: 'y' } })).toThrow(/no seasons/);
  });
});

describe('what the database is told about an event', () => {
  const event: TrackerEvent = {
    id: 'evt_1',
    name: 'SSL',
    unitRegistry: { '1sttx': { name: '1stTX' }, '2ndsc': { name: '2ndSC' } },
    seasons: [
      { id: 's1', name: 'Season 1', weeks: [{ id: 11, name: 'Night 1' }, { id: 12, name: 'Night 2' }] },
      { id: 's2', name: 'Season 2', weeks: [] },
    ],
  };

  it('describes each season by the nights in it, as strings', () => {
    expect(seasonRefsOf(event)).toEqual([
      { id: 's1', name: 'Season 1', weekIds: ['11', '12'] },
      { id: 's2', name: 'Season 2', weekIds: [] },
    ]);
  });

  it('lists the registry by name', () => {
    expect(registryUnitsOf(event).sort()).toEqual(['1stTX', '2ndSC']);
  });

  it('wraps an event in the app state the Elo engine expects', () => {
    const state = appStateForEvent(event);
    expect(state).toMatchObject({ schemaVersion: 2, activeEventId: 'evt_1', activeSeasonId: 's1' });
    expect(state.events).toEqual([event]);
  });
});
