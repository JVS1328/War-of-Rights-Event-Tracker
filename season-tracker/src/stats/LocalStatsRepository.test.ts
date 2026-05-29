import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { LocalStatsRepository } from './LocalStatsRepository';
import { parseScoreboard } from './parseScoreboard';

const CSV = (winner: string) => `round_start_time,16:00:00
round_end_time,16:30:00
map,DrillCamp
mode,Skirmish
area,Meadow
winner,${winner}

name,team,kills,deaths,kd,deaths_in_form,deaths_skirm,deaths_oob,steam_id
[51stNY]Joe,1,3,1,3.00,1,0,0,76561198000000001
`;

let dbCounter = 0;
function freshRepo() {
  dbCounter += 1;
  return new LocalStatsRepository(`wor-stats-test-${dbCounter}`);
}

describe('LocalStatsRepository — scoreboards', () => {
  it('saves and retrieves a scoreboard scoped to an event', async () => {
    const repo = freshRepo();
    const sb = parseScoreboard(CSV('CSA'), 'scoreboard_20260527_160000.csv');
    const id = await repo.saveScoreboard('event-1', sb);

    const stored = await repo.getScoreboard(id);
    expect(stored).not.toBeNull();
    expect(stored!.eventId).toBe('event-1');
    expect(stored!.scoreboard.meta.winner).toBe('CSA');
    expect(stored!.scoreboard.players).toHaveLength(1);
  });

  it('lists scoreboard summaries for an event, newest first', async () => {
    const repo = freshRepo();
    await repo.saveScoreboard('e', parseScoreboard(CSV('USA'), 'scoreboard_20260101_120000.csv'));
    await repo.saveScoreboard('e', parseScoreboard(CSV('CSA'), 'scoreboard_20260102_120000.csv'));
    await repo.saveScoreboard('other', parseScoreboard(CSV('USA'), 'scoreboard_20260103_120000.csv'));

    const list = await repo.listScoreboards({ eventId: 'e' });
    expect(list).toHaveLength(2);
    expect(list[0].sourceFilename).toBe('scoreboard_20260102_120000.csv'); // newest first
    expect(list[0]).toMatchObject({ map: 'DrillCamp', mode: 'Skirmish', winner: 'CSA' });
  });

  it('dedupes by filename within an event (re-import overwrites)', async () => {
    const repo = freshRepo();
    await repo.saveScoreboard('e', parseScoreboard(CSV('USA'), 'scoreboard_20260101_120000.csv'));
    await repo.saveScoreboard('e', parseScoreboard(CSV('CSA'), 'scoreboard_20260101_120000.csv'));

    const list = await repo.listScoreboards({ eventId: 'e' });
    expect(list).toHaveLength(1);
    const stored = await repo.getScoreboard(list[0].id);
    expect(stored!.scoreboard.meta.winner).toBe('CSA'); // latest wins
  });

  it('deletes a scoreboard', async () => {
    const repo = freshRepo();
    const id = await repo.saveScoreboard('e', parseScoreboard(CSV('USA'), 'scoreboard_20260101_120000.csv'));
    await repo.deleteScoreboard(id);
    expect(await repo.getScoreboard(id)).toBeNull();
    expect(await repo.listScoreboards({ eventId: 'e' })).toHaveLength(0);
  });

  it('records an optional week/round binding', async () => {
    const repo = freshRepo();
    const id = await repo.saveScoreboard(
      'e',
      parseScoreboard(CSV('USA'), 'scoreboard_20260101_120000.csv'),
      { weekId: 'week-3', round: 2 },
    );
    const stored = await repo.getScoreboard(id);
    expect(stored!.binding).toEqual({ weekId: 'week-3', round: 2 });
  });
});

describe('LocalStatsRepository — regiment assignments', () => {
  it('persists per-event assignments keyed by steam id', async () => {
    const repo = freshRepo();
    await repo.setRegimentAssignment('e', '76561198000000001', '51stNY');
    await repo.setRegimentAssignment('e', '76561198000000002', '20thGA');

    const map = await repo.getRegimentAssignments('e');
    expect(map).toEqual({ '76561198000000001': '51stNY', '76561198000000002': '20thGA' });
  });

  it('scopes assignments to their event', async () => {
    const repo = freshRepo();
    await repo.setRegimentAssignment('e1', '76561198000000001', '51stNY');
    await repo.setRegimentAssignment('e2', '76561198000000001', '7thMI');

    expect(await repo.getRegimentAssignments('e1')).toEqual({ '76561198000000001': '51stNY' });
    expect(await repo.getRegimentAssignments('e2')).toEqual({ '76561198000000001': '7thMI' });
  });

  it('bulk-sets assignments', async () => {
    const repo = freshRepo();
    await repo.setRegimentAssignments('e', { a: 'X', b: 'Y' });
    expect(await repo.getRegimentAssignments('e')).toEqual({ a: 'X', b: 'Y' });
  });
});

describe('LocalStatsRepository — regiment aliases (rename/merge)', () => {
  it('defaults to an empty map and persists per-event aliases', async () => {
    const repo = freshRepo();
    expect(await repo.getRegimentAliases('e')).toEqual({});
    await repo.setRegimentAliases('e', { '20THGA': '51STNY', OLD: 'New Name' });
    expect(await repo.getRegimentAliases('e')).toEqual({ '20THGA': '51STNY', OLD: 'New Name' });
  });

  it('scopes aliases to their event', async () => {
    const repo = freshRepo();
    await repo.setRegimentAliases('e1', { A: 'B' });
    await repo.setRegimentAliases('e2', { C: 'D' });
    expect(await repo.getRegimentAliases('e1')).toEqual({ A: 'B' });
    expect(await repo.getRegimentAliases('e2')).toEqual({ C: 'D' });
  });

  it('overwrites the whole map on set (so removals stick)', async () => {
    const repo = freshRepo();
    await repo.setRegimentAliases('e', { A: 'B', C: 'D' });
    await repo.setRegimentAliases('e', { A: 'B' }); // C→D removed
    expect(await repo.getRegimentAliases('e')).toEqual({ A: 'B' });
  });
});

describe('LocalStatsRepository — portable stats bundle', () => {
  it('exports every scoreboard + assignments for an event, event-agnostic', async () => {
    const repo = freshRepo();
    await repo.saveScoreboard('src', parseScoreboard(CSV('USA'), 'scoreboard_20260101_120000.csv'), { weekId: 'w1', round: 1 });
    await repo.saveScoreboard('src', parseScoreboard(CSV('CSA'), 'scoreboard_20260102_120000.csv'));
    await repo.setRegimentAssignment('src', '76561198000000001', '51stNY');
    await repo.setRegimentAliases('src', { '20THGA': '51STNY' });
    await repo.saveScoreboard('other', parseScoreboard(CSV('USA'), 'scoreboard_20260103_120000.csv'));

    const bundle = await repo.exportEventStats('src');
    expect(bundle.scoreboards).toHaveLength(2);
    expect(bundle.scoreboards.map((s) => s.sourceFilename).sort()).toEqual([
      'scoreboard_20260101_120000.csv',
      'scoreboard_20260102_120000.csv',
    ]);
    expect(bundle.scoreboards.some((s) => s.binding?.weekId === 'w1')).toBe(true);
    expect(bundle.assignments).toEqual({ '76561198000000001': '51stNY' });
    expect(bundle.aliases).toEqual({ '20THGA': '51STNY' });
  });

  it('imports a bundle under a target event, re-keyed and isolated from the source', async () => {
    const repo = freshRepo();
    await repo.saveScoreboard('src', parseScoreboard(CSV('CSA'), 'scoreboard_20260101_120000.csv'), { weekId: 'w1', round: 2 });
    await repo.setRegimentAssignment('src', '76561198000000001', '51stNY');
    await repo.setRegimentAliases('src', { '20THGA': '51STNY' });
    const bundle = await repo.exportEventStats('src');

    const count = await repo.importEventStats('dst', bundle);
    expect(count).toBe(1);
    expect(await repo.getRegimentAliases('dst')).toEqual({ '20THGA': '51STNY' });

    const list = await repo.listScoreboards({ eventId: 'dst' });
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('dst::scoreboard_20260101_120000.csv');
    const stored = await repo.getScoreboard(list[0].id);
    expect(stored!.eventId).toBe('dst');
    expect(stored!.binding).toEqual({ weekId: 'w1', round: 2 });
    expect(stored!.scoreboard.meta.winner).toBe('CSA');
    expect(await repo.getRegimentAssignments('dst')).toEqual({ '76561198000000001': '51stNY' });

    // Source event remains intact.
    expect(await repo.listScoreboards({ eventId: 'src' })).toHaveLength(1);
  });

  it('round-trips through the pure bundle helpers (export = build of stored)', async () => {
    const repo = freshRepo();
    await repo.saveScoreboard('e', parseScoreboard(CSV('USA'), 'scoreboard_20260101_120000.csv'));
    const bundle = await repo.exportEventStats('e');
    await repo.importEventStats('clone', bundle);
    const clone = await repo.exportEventStats('clone');
    expect(clone.scoreboards).toEqual(bundle.scoreboards);
    expect(clone.assignments).toEqual(bundle.assignments);
  });
});
