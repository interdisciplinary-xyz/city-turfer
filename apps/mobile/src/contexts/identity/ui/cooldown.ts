import { type AccountRefusal, COOLDOWN_CHECK_MS } from './account-settings.constants';

/** Epoch ms until which a rate limit asks us to wait (its Retry-After); 0: no wait. */
export function waitUntilAfter(f: AccountRefusal, now: number): number {
  return f.kind === 'rate-limited' && f.retryAfterS && f.retryAfterS > 0 ? now + f.retryAfterS * 1000 : 0;
}

/**
 * Calls `onOver` once `waitUntil` has passed. Checked again at least every `COOLDOWN_CHECK_MS`:
 * timers don't run while the app is in the background, so one long timer could fire far too late.
 * Returns the cancel function (for an effect's cleanup).
 */
export function watchCooldown(waitUntil: number, onOver: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const check = () => {
    const left = waitUntil - Date.now();
    if (left <= 0) {
      timer = null;
      onOver();
      return;
    }
    timer = setTimeout(check, Math.min(left, COOLDOWN_CHECK_MS));
  };
  check();
  return () => {
    if (timer) {
      clearTimeout(timer);
    }
  };
}
