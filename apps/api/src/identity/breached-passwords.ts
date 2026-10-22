import { createHash } from 'node:crypto';

/**
 * Port: is this password in a known data breach (AC3)? Adapters: `HibpBreachedPasswords`
 * (production), `FakeBreachedPasswords` (tests and the local dev server: no network). Nothing here
 * logs the password, its hash or the hash prefix.
 */
export interface BreachedPasswords {
  /** True when the password is known to be breached; false when it is not, or the check failed. */
  isBreached(password: string): Promise<boolean>;
}

/** The HIBP range API's time budget: a slow answer fails open. */
export const BREACH_CHECK_TIMEOUT_MS = 1500;

/**
 * Have I Been Pwned "Pwned Passwords" range API (k-anonymity): only the first 5 hex characters of
 * the password's SHA-1 leave the server, and `Add-Padding` makes every answer about the same size.
 * Keyless. Fails open (timeout, network, non-200): a breach check must never lock anyone out.
 * https://haveibeenpwned.com/API/v3#PwnedPasswords
 */
export class HibpBreachedPasswords implements BreachedPasswords {
  constructor(
    private readonly fetchFn: typeof fetch = fetch,
    /** Called when the check could not run (no data passed: never the password or its hash). */
    private readonly onSkipped: () => void = () => undefined
  ) {}

  async isBreached(password: string): Promise<boolean> {
    const sha1 = createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);
    try {
      const res = await this.fetchFn(`https://api.pwnedpasswords.com/range/${prefix}`, {
        headers: { 'Add-Padding': 'true', 'User-Agent': 'CityTurfer-API' },
        signal: AbortSignal.timeout(BREACH_CHECK_TIMEOUT_MS),
      });
      if (!res.ok) {
        this.onSkipped();
        return false;
      }
      const body = await res.text();
      for (const line of body.split('\n')) {
        const [candidate, count] = line.trim().split(':');
        // Padding lines carry a count of 0: not breached.
        if (candidate === suffix && Number(count) > 0) {
          return true;
        }
      }
      return false;
    } catch {
      this.onSkipped();
      return false;
    }
  }
}

/** Tests and the local dev server: breached means "in this list". */
export class FakeBreachedPasswords implements BreachedPasswords {
  constructor(private readonly breached: readonly string[] = DEV_BREACHED_PASSWORDS) {}

  isBreached(password: string): Promise<boolean> {
    return Promise.resolve(this.breached.includes(password));
  }
}

/** Well-known breached passwords the local dev server refuses (so the breached path can be tried). */
export const DEV_BREACHED_PASSWORDS: readonly string[] = ['password1234', 'correcthorsebatterystaple'];
