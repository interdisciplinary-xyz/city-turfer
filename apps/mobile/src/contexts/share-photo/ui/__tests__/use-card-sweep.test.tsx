import { act, create } from 'react-test-renderer';

import { createSharePhotoApi } from '../../index';
import { fakeSharePhotoDeps } from '../../test-support/fakes';
import { sweepWhenActive, useCardSweep } from '../use-card-sweep';

/** A fake AppState: the current state and the 'change' listeners. */
function fakeAppState(initial: string) {
  const listeners = new Set<(s: string) => void>();
  const app = {
    currentState: initial,
    addEventListener: (_type: 'change', fn: (s: string) => void) => {
      listeners.add(fn);
      return { remove: () => listeners.delete(fn) };
    },
    go(state: string) {
      app.currentState = state;
      listeners.forEach((fn) => fn(state));
    },
    get listening() {
      return listeners.size;
    },
  };
  return app;
}

const mockAppState = fakeAppState('active');
jest.mock('react-native', () => ({
  get AppState() {
    return mockAppState;
  },
}));

const mockFake = fakeSharePhotoDeps({ keepShared: true });
const mockApi = createSharePhotoApi(mockFake.deps);
jest.mock('../share-photo-api', () => ({
  get sharePhoto() {
    return mockApi;
  },
}));

describe('sweepWhenActive', () => {
  it('sweeps at launch in the foreground and on each return to the app', () => {
    const app = fakeAppState('active');
    const sweep = jest.fn();
    sweepWhenActive(app, sweep);
    expect(sweep).toHaveBeenCalledTimes(1);
    app.go('background');
    app.go('active');
    app.go('inactive');
    app.go('active');
    expect(sweep).toHaveBeenCalledTimes(3);
  });

  it('sweeps nothing on a headless launch until the app is opened', () => {
    const app = fakeAppState('background');
    const sweep = jest.fn();
    sweepWhenActive(app, sweep);
    expect(sweep).not.toHaveBeenCalled();
    app.go('active');
    expect(sweep).toHaveBeenCalledTimes(1);
  });

  it('stops listening once removed', () => {
    const app = fakeAppState('active');
    const sweep = jest.fn();
    const stop = sweepWhenActive(app, sweep);
    stop();
    expect(app.listening).toBe(0);
    app.go('active');
    expect(sweep).toHaveBeenCalledTimes(1);
  });
});

function Root() {
  useCardSweep();
  return null;
}

describe('useCardSweep', () => {
  it('runs the SweepCards use case at mount and on return to the foreground, until unmounted', async () => {
    mockFake.log.length = 0;
    let root!: ReturnType<typeof create>;
    await act(async () => {
      root = create(<Root />);
    });
    expect(mockFake.log).toEqual(['sweep']);
    await act(async () => {
      mockAppState.go('background');
      mockAppState.go('active');
    });
    expect(mockFake.log).toEqual(['sweep', 'sweep']);
    await act(async () => {
      root.unmount();
    });
    mockAppState.go('active');
    expect(mockFake.log).toEqual(['sweep', 'sweep']);
    expect(mockAppState.listening).toBe(0);
  });

  it('a failed sweep never throws into the app', async () => {
    mockFake.state.sweepFails = true;
    let root!: ReturnType<typeof create>;
    await act(async () => {
      root = create(<Root />);
    });
    await act(async () => {
      root.unmount();
    });
    mockFake.state.sweepFails = false;
  });
});
