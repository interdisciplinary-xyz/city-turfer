import { Restore } from '../restore';

const item = (activityId: string, startedAt: number) => ({ activityId, startedAt, version: 1 });

describe('Restore', () => {
  it('starts once from the manifest, oldest first, and only continues afterwards', () => {
    const r = Restore.idle();
    const ordered = r.start([item('b', 2), item('c', 3), item('a', 2)], { cityId: 'pl-warsaw', chosenAt: 9 }, 100);
    expect(ordered.map((i) => i.activityId)).toEqual(['a', 'b', 'c']);
    expect(r.toState()).toMatchObject({ status: 'running', total: 3, done: 0, startedAt: 100 });
    expect(() => r.start([], null, 101)).toThrow('restore.running');
  });

  it('is finished only when nothing is left', () => {
    const r = Restore.idle();
    r.start([item('a', 1), item('b', 2)], null, 1);
    r.itemDone();
    expect(() => r.finish(1)).toThrow('restore.not-finished');
    r.itemDone();
    r.finish(0);
    expect(r.toState()).toMatchObject({ status: 'done', done: 2 });
    expect(() => r.itemDone()).toThrow('restore.not-running');
  });
});
