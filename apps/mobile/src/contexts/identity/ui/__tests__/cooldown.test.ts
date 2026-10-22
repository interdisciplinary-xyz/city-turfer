import { COOLDOWN_CHECK_MS } from '../account-settings.constants';
import { waitUntilAfter, watchCooldown } from '../cooldown';

const T0 = Date.UTC(2026, 9, 22, 12);

describe('Retry-After cooldown', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(T0);
  });
  afterEach(() => jest.useRealTimers());

  it('only a rate limit with a positive Retry-After starts a wait', () => {
    expect(waitUntilAfter({ kind: 'rate-limited', retryAfterS: 150 }, T0)).toBe(T0 + 150_000);
    expect(waitUntilAfter({ kind: 'rate-limited', retryAfterS: null }, T0)).toBe(0);
    expect(waitUntilAfter({ kind: 'rate-limited', retryAfterS: 0 }, T0)).toBe(0);
    expect(waitUntilAfter({ kind: 'offline' }, T0)).toBe(0);
  });

  it('waiting → cleared once Retry-After has passed, re-checked every minute on the way', () => {
    const over = jest.fn();
    watchCooldown(waitUntilAfter({ kind: 'rate-limited', retryAfterS: 150 }, Date.now()), over);
    expect(jest.getTimerCount()).toBe(1);
    jest.advanceTimersByTime(COOLDOWN_CHECK_MS);
    jest.advanceTimersByTime(COOLDOWN_CHECK_MS);
    expect(over).not.toHaveBeenCalled();
    jest.advanceTimersByTime(29_999);
    expect(over).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(over).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('back from the background long after the wait: cleared at the next minute check, not an hour later', () => {
    const over = jest.fn();
    watchCooldown(T0 + 3_600_000, over);
    // The app sleeps: the clock moves on but no timer runs.
    jest.setSystemTime(T0 + 2 * 3_600_000);
    jest.advanceTimersByTime(COOLDOWN_CHECK_MS);
    expect(over).toHaveBeenCalledTimes(1);
  });

  it('a wait already over clears at once; cancelling stops the checks', () => {
    const over = jest.fn();
    watchCooldown(T0 - 1, over);
    expect(over).toHaveBeenCalledTimes(1);
    const later = jest.fn();
    const cancel = watchCooldown(T0 + 10_000, later);
    cancel();
    jest.advanceTimersByTime(20_000);
    expect(later).not.toHaveBeenCalled();
  });
});
