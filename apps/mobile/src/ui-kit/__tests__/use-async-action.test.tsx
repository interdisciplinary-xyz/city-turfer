import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { DomainError } from '@/shared-kernel';

import { ExpectedFailure } from '../classify-error';
import { useAsyncAction } from '../use-async-action';
import type { AsyncAction, AsyncActionOptions } from '../use-async-action.constants';

const mockShow = jest.fn();
const mockReport = jest.fn();
jest.mock('../toast-provider', () => ({
  useToast: () => ({ show: mockShow, reporter: { report: mockReport } }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Renders the hook; `current()` is its latest return value, `loading` every isLoading it rendered. */
function mount<T>(options: AsyncActionOptions<T>) {
  let latest: AsyncAction<T> | undefined;
  const loading: boolean[] = [];
  function Probe() {
    latest = useAsyncAction(options);
    loading.push(latest.isLoading);
    return null;
  }
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(<Probe />);
  });
  return { current: () => latest!, loading, tree: tree! };
}

/** A promise settled from outside, to look at the hook while the work runs. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  mockShow.mockClear();
  mockReport.mockClear();
});

describe('useAsyncAction', () => {
  it('try: loading on while the work runs, off after; a success toast only with successKey', async () => {
    const h = mount<number>({ area: 'cloud-backup', successKey: 'backup.toast.backedUp' });
    const work = deferred<number>();
    let pending!: Promise<unknown>;
    act(() => {
      pending = h.current().run(() => work.promise);
    });
    expect(h.current().isLoading).toBe(true);
    await act(async () => {
      work.resolve(7);
      await pending;
    });
    expect(await pending).toEqual({ status: 'done', value: 7 });
    expect(h.current().isLoading).toBe(false);
    expect(mockShow).toHaveBeenCalledTimes(1);
    expect(mockShow).toHaveBeenCalledWith({ variant: 'success', message: 'backup.toast.backedUp' });
    expect(mockReport).not.toHaveBeenCalled();
  });

  it('no successKey: no toast at all', async () => {
    const h = mount<void>({ area: 'settings' });
    await act(async () => {
      await h.current().run(async () => undefined);
    });
    expect(mockShow).not.toHaveBeenCalled();
    expect(h.current().isLoading).toBe(false);
  });

  it('a successKey function decides from the result (null: no toast)', async () => {
    const h = mount<{ kind: string }>({
      area: 'cloud-backup',
      successKey: (r) => (r.kind === 'done' ? { key: 'common.activities', values: { count: 2 } } : null),
    });
    await act(async () => {
      await h.current().run(async () => ({ kind: 'skipped' }));
    });
    expect(mockShow).not.toHaveBeenCalled();
    await act(async () => {
      await h.current().run(async () => ({ kind: 'done' }));
    });
    expect(mockShow).toHaveBeenCalledWith({
      variant: 'success',
      message: { key: 'common.activities', values: { count: 2 } },
    });
  });

  it('catch, unexpected: exactly one report with the area and code, then the generic error toast', async () => {
    const h = mount<void>({ area: 'activity-log', code: 'delete-activity', successKey: 'activity.toast.deleted' });
    const bug = new TypeError('undefined is not an object');
    let outcome: unknown;
    await act(async () => {
      outcome = await h.current().run(async () => {
        throw bug;
      });
    });
    expect(mockReport).toHaveBeenCalledTimes(1);
    expect(mockReport).toHaveBeenCalledWith(bug, { area: 'activity-log', code: 'delete-activity' });
    expect(mockShow).toHaveBeenCalledTimes(1);
    expect(mockShow).toHaveBeenCalledWith({ variant: 'error', message: 'common.toast.error.generic' });
    expect(outcome).toMatchObject({ status: 'failed', error: bug, kind: { expected: false } });
    // finally: loading off after a throw
    expect(h.current().isLoading).toBe(false);
  });

  it('never reports the same error twice, even through two actions', async () => {
    const a = mount<void>({ area: 'a' });
    const b = mount<void>({ area: 'b' });
    const bug = new Error('once');
    await act(async () => {
      await a.current().run(async () => {
        throw bug;
      });
      await b.current().run(async () => {
        throw bug;
      });
    });
    expect(mockReport).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['offline', new TypeError('Network request failed'), 'common.toast.error.offline'],
    ['a broken rule', new DomainError('backup.on'), 'common.toast.error.generic'],
    ['a stated failure', new ExpectedFailure('share.error.share'), 'share.error.share'],
  ])('catch, expected (%s): no report, its message', async (_name, error, message) => {
    const h = mount<void>({ area: 'cloud-backup' });
    await act(async () => {
      await h.current().run(async () => {
        throw error;
      });
    });
    expect(mockReport).not.toHaveBeenCalled();
    expect(mockShow).toHaveBeenCalledWith({ variant: 'error', message });
    expect(h.current().isLoading).toBe(false);
  });

  it('isExpected widens the rule: shown, not reported', async () => {
    const h = mount<void>({ area: 'x', isExpected: (e) => (e as Error).message === 'known' });
    await act(async () => {
      await h.current().run(async () => {
        throw new Error('known');
      });
    });
    expect(mockReport).not.toHaveBeenCalled();
    expect(mockShow).toHaveBeenCalledWith({ variant: 'error', message: 'common.toast.error.generic' });
  });

  it('errorKey: a key replaces the generic message; a function maps; null keeps the error inline', async () => {
    const keyed = mount<void>({ area: 'x', errorKey: 'info.settingNotSaved' });
    await act(async () => {
      await keyed.current().run(async () => {
        throw new Error('disk');
      });
    });
    expect(mockShow).toHaveBeenLastCalledWith({ variant: 'error', message: 'info.settingNotSaved' });

    const mapped = mount<void>({
      area: 'x',
      errorKey: (_e, kind) => (kind.expected && kind.reason === 'domain' ? 'errors.backupAction.on' : undefined),
    });
    await act(async () => {
      await mapped.current().run(async () => {
        throw new DomainError('backup.on');
      });
    });
    expect(mockShow).toHaveBeenLastCalledWith({ variant: 'error', message: 'errors.backupAction.on' });

    mockShow.mockClear();
    mockReport.mockClear();
    const inline = mount<void>({ area: 'identity', errorKey: null });
    let outcome: unknown;
    await act(async () => {
      outcome = await inline.current().run(async () => {
        throw new Error('crash');
      });
    });
    expect(mockShow).not.toHaveBeenCalled();
    expect(mockReport).toHaveBeenCalledTimes(1); // still reported: inline forms keep the standard
    expect(outcome).toMatchObject({ status: 'failed', message: null });
  });

  it('runs once at a time: a second tap while the first runs does nothing', async () => {
    const h = mount<void>({ area: 'x' });
    const work = deferred<void>();
    const second = jest.fn(async () => undefined);
    let first!: Promise<unknown>;
    let again: unknown;
    await act(async () => {
      first = h.current().run(() => work.promise);
      again = await h.current().run(second);
    });
    expect(again).toEqual({ status: 'busy' });
    expect(second).not.toHaveBeenCalled();
    await act(async () => {
      work.resolve();
      await first;
    });
    expect(h.current().isLoading).toBe(false);
  });

  it('safe when the screen has gone: the toast still shows, no state is set', async () => {
    const h = mount<void>({ area: 'x', successKey: 'activity.toast.deleted' });
    const work = deferred<void>();
    let pending!: Promise<unknown>;
    act(() => {
      pending = h.current().run(() => work.promise);
    });
    const errors = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    act(() => h.tree.unmount());
    await act(async () => {
      work.resolve();
      await pending;
    });
    expect(mockShow).toHaveBeenCalledWith({ variant: 'success', message: 'activity.toast.deleted' });
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it('finally after a throw from the success path too (loading never sticks)', async () => {
    mockShow.mockImplementationOnce(() => {
      throw new Error('toast broke');
    });
    const h = mount<void>({ area: 'x', successKey: 'activity.toast.deleted' });
    await act(async () => {
      await h.current().run(async () => undefined);
    });
    expect(h.current().isLoading).toBe(false);
    expect(h.loading.at(-1)).toBe(false);
  });
});
