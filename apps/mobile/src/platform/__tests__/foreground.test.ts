import { type AppStateLike, runWhenForeground } from '../foreground';

function fakeAppState(initial: string) {
  const listeners = new Set<(s: string) => void>();
  const a: { currentState: string; set(s: string): void; readonly listeners: number } & AppStateLike = {
    currentState: initial,
    addEventListener: (_type, l) => {
      listeners.add(l);
      return { remove: () => void listeners.delete(l) };
    },
    set(s) {
      a.currentState = s;
      listeners.forEach((l) => l(s));
    },
    get listeners() {
      return listeners.size;
    },
  };
  return a;
}

describe('runWhenForeground', () => {
  it('runs at once when the app is active', () => {
    const job = jest.fn();
    runWhenForeground(fakeAppState('active'), job);
    expect(job).toHaveBeenCalledTimes(1);
  });

  it.each(['background', 'inactive', 'unknown'])('waits while %s (headless launch), runs once on active', (s) => {
    const app = fakeAppState(s);
    const job = jest.fn();
    runWhenForeground(app, job);
    app.set('background');
    expect(job).not.toHaveBeenCalled();
    app.set('active');
    app.set('background');
    app.set('active');
    expect(job).toHaveBeenCalledTimes(1);
    expect(app.listeners).toBe(0);
  });

  it('can be cancelled (sign-out before the app came to the foreground)', () => {
    const app = fakeAppState('background');
    const job = jest.fn();
    const cancel = runWhenForeground(app, job);
    cancel();
    app.set('active');
    expect(job).not.toHaveBeenCalled();
    expect(app.listeners).toBe(0);
  });
});
