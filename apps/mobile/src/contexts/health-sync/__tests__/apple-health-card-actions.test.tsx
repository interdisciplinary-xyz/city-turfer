import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import { DomainError } from '@/shared-kernel';

import type { HealthSyncStatus, ImportReport } from '../contract';
import { AppleHealthCard } from '../ui/apple-health-card';

// Plain host components stand in for React Native and the design system (node test environment):
// the card's async-request behaviour (loading, toasts, reports) is what is checked here.
jest.mock('react-native', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const host = (name: string) => (props: Record<string, unknown>) =>
    createElement(name, props, props.children as never);
  return {
    View: host('View'),
    Text: host('Text'),
    Switch: host('Switch'),
    Platform: { OS: 'ios' },
    StyleSheet: { create: <S,>(s: S) => s },
  };
});
jest.mock('@/ui-kit/components', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const host = (name: string) => (props: Record<string, unknown>) =>
    createElement(name, props, props.children as never);
  return { Button: host('Button'), Card: host('Card') };
});
jest.mock('@/ui-kit/theme', () => ({
  usePalette: () => ({ text: 'text', muted: 'muted', border: 'border', card: 'card', danger: 'danger' }),
}));
jest.mock('@/i18n', () => ({
  useT: (ns: 'health') => jest.requireActual('@/i18n/translator').translator(ns, 'en'),
}));
const mockShow = jest.fn();
const mockReport = jest.fn();
jest.mock('@/ui-kit/toast-provider', () => ({
  useToast: () => ({ show: mockShow, reporter: { report: mockReport } }),
}));
const mockSync = {
  status: null as HealthSyncStatus | null,
  progress: null as number | null,
  connect: jest.fn(),
  disconnect: jest.fn(),
  importNow: jest.fn(),
  setDirections: jest.fn(),
};
jest.mock('../ui/hooks', () => ({ useHealthSync: () => mockSync }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const report = (imported: number): ImportReport => ({ at: 0, imported, duplicates: 0, withoutRoute: 0, skipped: 0 });

const connected = (over: Partial<HealthSyncStatus> = {}): HealthSyncStatus =>
  ({
    available: true,
    connected: true,
    importEnabled: true,
    exportEnabled: false,
    importing: false,
    lastImport: report(2),
    ...over,
  }) as HealthSyncStatus;

function render(): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(<AppleHealthCard />);
  });
  return tree;
}

const byId = (tree: ReactTestRenderer, testID: string): ReactTestInstance =>
  tree.root.find((n) => typeof n.type === 'string' && n.props.testID === testID);

/** A promise settled from outside, to look at the card while the work runs. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

beforeEach(() => {
  mockShow.mockClear();
  mockReport.mockClear();
  mockSync.status = connected();
  mockSync.progress = null;
  mockSync.connect.mockReset().mockResolvedValue(report(0));
  mockSync.disconnect.mockReset().mockResolvedValue(undefined);
  mockSync.importNow.mockReset().mockResolvedValue(report(3));
  mockSync.setDirections.mockReset().mockResolvedValue(undefined);
});

describe('AppleHealthCard: async actions', () => {
  it('Import now: busy while it runs, then a toast with how many were added', async () => {
    const work = deferred<ImportReport | null>();
    mockSync.importNow.mockReturnValue(work.promise);
    const tree = render();
    act(() => byId(tree, 'health-import-now').props.onPress());
    expect(byId(tree, 'health-import-now').props.busy).toBe(true);
    expect(byId(tree, 'health-disconnect').props.disabled).toBe(true);
    await act(async () => {
      work.resolve(report(3));
      await work.promise;
    });
    expect(byId(tree, 'health-import-now').props.busy).toBe(false);
    expect(byId(tree, 'health-disconnect').props.disabled).toBe(false);
    expect(mockShow).toHaveBeenCalledWith({
      variant: 'success',
      message: { key: 'health.toast.imported', values: { count: 3 } },
    });
    expect(mockReport).not.toHaveBeenCalled();
  });

  it('Import now that did not run (switched off, background): no toast', async () => {
    mockSync.importNow.mockResolvedValue(null);
    const tree = render();
    await act(async () => byId(tree, 'health-import-now').props.onPress());
    expect(mockShow).not.toHaveBeenCalled();
  });

  it('a double tap imports once', async () => {
    const work = deferred<ImportReport | null>();
    mockSync.importNow.mockReturnValue(work.promise);
    const tree = render();
    act(() => {
      byId(tree, 'health-import-now').props.onPress();
      byId(tree, 'health-import-now').props.onPress();
    });
    await act(async () => {
      work.resolve(report(1));
      await work.promise;
    });
    expect(mockSync.importNow).toHaveBeenCalledTimes(1);
  });

  it('an unexpected failure is reported with area and code only, and shows the Health message, never its text', async () => {
    const failure = new Error('HKErrorDomain code 5: workout 1A2B at 54.35,18.64');
    mockSync.importNow.mockRejectedValue(failure);
    const tree = render();
    await act(async () => byId(tree, 'health-import-now').props.onPress());
    expect(mockReport).toHaveBeenCalledTimes(1);
    expect(mockReport).toHaveBeenCalledWith(failure, { area: 'health-sync', code: 'import-now' });
    expect(mockShow).toHaveBeenCalledWith({ variant: 'error', message: 'health.errors.generic' });
    expect(byId(tree, 'health-import-now').props.busy).toBe(false);
  });

  it('a known Health Sync refusal is expected: its message, no report', async () => {
    mockSync.status = connected({ connected: false });
    mockSync.connect.mockRejectedValue(new DomainError('health.unavailable'));
    const tree = render();
    await act(async () => byId(tree, 'health-connect').props.onPress());
    expect(mockReport).not.toHaveBeenCalled();
    expect(mockShow).toHaveBeenCalledWith({ variant: 'error', message: 'health.errors.unavailable' });
  });

  it('Connect and the switches show their result on the card: no success toast', async () => {
    mockSync.status = connected({ connected: false });
    let tree = render();
    await act(async () => byId(tree, 'health-connect').props.onPress());
    expect(mockSync.connect).toHaveBeenCalledTimes(1);

    mockSync.status = connected();
    tree = render();
    await act(async () => byId(tree, 'health-import-switch').props.onValueChange(false));
    await act(async () => byId(tree, 'health-export-switch').props.onValueChange(true));
    expect(mockSync.setDirections).toHaveBeenNthCalledWith(1, { importEnabled: false });
    expect(mockSync.setDirections).toHaveBeenNthCalledWith(2, { exportEnabled: true });
    expect(mockShow).not.toHaveBeenCalled();
  });

  it('a failed switch is reported under set-directions and explained', async () => {
    mockSync.setDirections.mockRejectedValue(new Error('SQLITE_BUSY'));
    const tree = render();
    await act(async () => byId(tree, 'health-export-switch').props.onValueChange(true));
    expect(mockReport).toHaveBeenCalledWith(expect.any(Error), { area: 'health-sync', code: 'set-directions' });
    expect(mockShow).toHaveBeenCalledWith({ variant: 'error', message: 'health.errors.generic' });
  });

  it('Disconnect: a success toast', async () => {
    const tree = render();
    await act(async () => byId(tree, 'health-disconnect').props.onPress());
    expect(mockSync.disconnect).toHaveBeenCalledTimes(1);
    expect(mockShow).toHaveBeenCalledWith({ variant: 'success', message: 'health.toast.disconnected' });
  });

  it('the switches are announced as switches with their state', () => {
    mockSync.status = connected({ importEnabled: true, exportEnabled: false });
    const tree = render();
    const imp = byId(tree, 'health-import-switch');
    const exp = byId(tree, 'health-export-switch');
    expect(imp.props.accessibilityRole).toBe('switch');
    expect(imp.props.accessibilityState).toEqual({ checked: true, disabled: false });
    expect(imp.props.accessibilityLabel).toBe('Import workouts from Apple Health');
    expect(exp.props.accessibilityRole).toBe('switch');
    expect(exp.props.accessibilityState).toEqual({ checked: false, disabled: false });
  });
});
