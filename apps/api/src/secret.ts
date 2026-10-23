import { createHash, timingSafeEqual } from 'node:crypto';

const digest = (s: string) => createHash('sha256').update(s).digest();

/**
 * Whether a presented value equals a configured secret, in constant time: both sides are hashed to
 * 32 bytes first, so neither length nor content leaks. A missing value or secret never matches.
 * The one comparison for every shared secret (the cron bearer, the website edge header).
 */
export function secretMatches(value: string | undefined, secret: string | null): boolean {
  if (!secret) {
    return false;
  }
  return timingSafeEqual(digest(value ?? ''), digest(secret)) && value !== undefined;
}
