import { missingOnPhone, Restore, worthOffering } from '../restore';

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

describe('what a restore brings back', () => {
  const manifest = [item('on-phone', 1), item('deleted-here', 2), item('new-1', 3), item('new-2', 4)];

  it('only what the phone lacks and did not delete', () => {
    const missing = missingOnPhone(
      manifest,
      new Set(['on-phone', 'local-only']),
      new Set(['on-phone', 'deleted-here'])
    );
    expect(missing.map((i) => i.activityId)).toEqual(['new-1', 'new-2']);
  });

  it('is offered while something is not declined', () => {
    const missing = [item('new-1', 3), item('new-2', 4)];
    expect(worthOffering(missing, new Set())).toBe(true);
    expect(worthOffering(missing, new Set(['new-1']))).toBe(true);
    expect(worthOffering(missing, new Set(['new-1', 'new-2']))).toBe(false);
    expect(worthOffering([], new Set())).toBe(false);
  });

  it('can start again after a finished restore (the always-available action)', () => {
    const r = Restore.idle();
    r.start([item('a', 1)], null, 1);
    r.itemDone();
    r.finish(0);
    expect(r.start([item('b', 2)], null, 2).map((i) => i.activityId)).toEqual(['b']);
    expect(r.toState()).toMatchObject({ status: 'running', total: 1, done: 0 });
  });
});
