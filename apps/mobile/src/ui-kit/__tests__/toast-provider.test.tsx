import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import { ToastProvider, useToast } from '../toast-provider';
import type { ToastApi } from '../toast-provider.constants';

// Plain host components stand in for React Native and the design system (node test environment).
const mockAnnounce = jest.fn();
const mockPlatform = { OS: 'ios' };
jest.mock('react-native', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const host = (name: string) => (props: Record<string, unknown>) =>
    createElement(name, props, props.children as never);
  class Value {
    current: number;
    constructor(start: number) {
      this.current = start;
    }
    setValue(next: number) {
      this.current = next;
    }
  }
  return {
    View: host('View'),
    Animated: {
      View: host('AnimatedView'),
      Value,
      timing: (value: Value, config: { toValue: number }) => ({ start: () => value.setValue(config.toValue) }),
    },
    AccessibilityInfo: {
      announceForAccessibility: (m: string) => mockAnnounce(m),
      isReduceMotionEnabled: () => Promise.resolve(false),
    },
    get Platform() {
      return mockPlatform;
    },
    StyleSheet: { create: <S,>(s: S) => s },
  };
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 47, bottom: 0 }) }));
jest.mock('react-native-screens', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  return {
    FullWindowOverlay: (p: { children: unknown }) => createElement('FullWindowOverlay', null, p.children as never),
  };
});
jest.mock('@cityturfer/ui', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  return { Toast: (props: Record<string, unknown>) => createElement('Toast', props) };
});
jest.mock('@/i18n', () => ({
  translator: (ns: 'common') => jest.requireActual('@/i18n/translator').translator(ns, 'en'),
}));

/** A mocked host element by name (the mocks render plain string elements). */
const isHost = (n: ReactTestInstance, name: string) => (n.type as unknown) === name;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const reporter = { report: jest.fn() };

function mount() {
  let api: ToastApi | undefined;
  function Grab() {
    api = useToast();
    return null;
  }
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(
      <ToastProvider reporter={reporter}>
        <Grab />
      </ToastProvider>
    );
  });
  return { api: () => api!, tree: tree! };
}

const toasts = (tree: ReactTestRenderer): ReactTestInstance[] => tree.root.findAll((n) => isHost(n, 'Toast'));

beforeEach(() => {
  jest.useFakeTimers();
  mockAnnounce.mockClear();
  mockPlatform.OS = 'ios';
});
afterEach(() => jest.useRealTimers());

describe('ToastProvider', () => {
  it('shows a toast worded in the app language and hands out the reporter', () => {
    const h = mount();
    expect(h.api().reporter).toBe(reporter);
    act(() => h.api().show({ variant: 'success', message: 'activity.toast.deleted' }));
    const [toast] = toasts(h.tree);
    expect(toast.props).toMatchObject({
      variant: 'success',
      message: 'Activity deleted.',
      testID: 'toast-success',
      dismissHint: 'Closes the message',
    });
  });

  it('words a message with its values', () => {
    const h = mount();
    act(() => h.api().show({ variant: 'success', message: { key: 'common.activities', values: { count: 3 } } }));
    expect(toasts(h.tree)[0].props.message).toBe('3 activities');
  });

  it('VoiceOver hears it on iOS; Android reads the live region instead (never twice)', () => {
    const h = mount();
    act(() => h.api().show({ variant: 'error', message: 'common.toast.error.offline' }));
    expect(mockAnnounce).toHaveBeenCalledWith('No connection. Try again when you’re online.');

    mockPlatform.OS = 'android';
    mockAnnounce.mockClear();
    const a = mount();
    act(() => a.api().show({ variant: 'error', message: 'common.toast.error.generic' }));
    expect(mockAnnounce).not.toHaveBeenCalled();
    expect(a.tree.root.findAll((n) => isHost(n, 'FullWindowOverlay'))).toHaveLength(0);
  });

  it('sits under the status bar, over modals on iOS', () => {
    const h = mount();
    act(() => h.api().show({ variant: 'success', message: 'activity.toast.deleted' }));
    expect(h.tree.root.findAll((n) => isHost(n, 'FullWindowOverlay'))).toHaveLength(1);
    const layer = h.tree.root.find((n) => isHost(n, 'View') && n.props.pointerEvents === 'box-none');
    expect(layer.props.style[1]).toEqual({ paddingTop: 47 + 8 });
  });

  it('one at a time, in order; each closes by itself (errors stay longer)', () => {
    const h = mount();
    act(() => {
      h.api().show({ variant: 'error', message: 'common.toast.error.generic' });
      h.api().show({ variant: 'success', message: 'activity.toast.deleted' });
    });
    expect(toasts(h.tree).map((t) => t.props.variant)).toEqual(['error']);
    act(() => jest.advanceTimersByTime(3000));
    expect(toasts(h.tree).map((t) => t.props.variant)).toEqual(['error']);
    act(() => jest.advanceTimersByTime(2000));
    expect(toasts(h.tree).map((t) => t.props.message)).toEqual(['Activity deleted.']);
    act(() => jest.advanceTimersByTime(3000));
    expect(toasts(h.tree)).toHaveLength(0);
  });

  it('a tap closes it and the next one shows', () => {
    const h = mount();
    act(() => {
      h.api().show({ variant: 'success', message: 'activity.toast.deleted' });
      h.api().show({ variant: 'success', message: 'account.toast.nameSaved' });
    });
    act(() => toasts(h.tree)[0].props.onDismiss());
    expect(toasts(h.tree)[0].props.message).toBe('Name saved.');
  });

  it('the same message is not queued twice, and the queue stays short', () => {
    const h = mount();
    act(() => {
      h.api().show({ variant: 'error', message: 'common.toast.error.generic' });
      h.api().show({ variant: 'error', message: 'common.toast.error.generic' });
    });
    act(() => jest.advanceTimersByTime(5000));
    expect(toasts(h.tree)).toHaveLength(0);

    act(() => {
      h.api().show({ variant: 'success', message: 'activity.toast.deleted' }); // on screen
      h.api().show({ variant: 'success', message: 'account.toast.nameSaved' }); // dropped (oldest waiting)
      h.api().show({ variant: 'success', message: 'backup.toast.backedUp' });
      h.api().show({ variant: 'success', message: 'backup.toast.restored' });
      h.api().show({ variant: 'success', message: 'backup.toast.linked' });
    });
    const seen: string[] = [];
    for (let i = 0; i < 5; i++) {
      const [t] = toasts(h.tree);
      if (t) {
        seen.push(t.props.message);
      }
      act(() => jest.advanceTimersByTime(3000));
    }
    expect(seen).toEqual([
      'Activity deleted.',
      'Backup finished. Your activities are safe in the cloud.',
      'Restore finished.',
      'Backup is on for this phone.',
    ]);
  });

  it('useToast outside the provider is a programming error', () => {
    function Lost() {
      useToast();
      return null;
    }
    const errors = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => act(() => void create(<Lost />))).toThrow('useToast outside ToastProvider');
    errors.mockRestore();
  });
});
