import { createHash, timingSafeEqual } from 'node:crypto';

import type { AuthVerifier, Principal } from '../deps';

/**
 * Device-token auth (stopgap until Better Auth, docs/decisions/api-device-tokens-2026-10-20.md).
 * `API_TOKENS` is a JSON object mapping sha256(token) in hex to a user id, or to
 * `{ "userId": …, "email": …, "displayName": … }`. Only hashes are configured; the token itself
 * lives on the device. Rotation: add the new hash, update the device, remove the old hash.
 */

interface TokenEntry {
  hash: Buffer;
  userId: string;
  email: string | null;
  displayName: string | null;
}

const HASH = /^[0-9a-f]{64}$/;
const USER_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** Parses API_TOKENS. Malformed entries are skipped (and counted), never echoed: they are secrets. */
export function parseApiTokens(raw: string | undefined): { entries: TokenEntry[]; skipped: number } {
  if (!raw?.trim()) {
    return { entries: [], skipped: 0 };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { entries: [], skipped: 1 };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { entries: [], skipped: 1 };
  }
  const entries: TokenEntry[] = [];
  let skipped = 0;
  for (const [key, value] of Object.entries(parsed)) {
    const hash = key.toLowerCase();
    const v = typeof value === 'string' ? { userId: value } : (value as Record<string, unknown> | null);
    const userId = v?.userId;
    if (!HASH.test(hash) || typeof userId !== 'string' || !USER_ID.test(userId)) {
      skipped++;
      continue;
    }
    entries.push({
      hash: Buffer.from(hash, 'hex'),
      userId,
      email: typeof v?.email === 'string' ? v.email : null,
      displayName: typeof v?.displayName === 'string' ? v.displayName : null,
    });
  }
  return { entries, skipped };
}

/** Verifies bearer tokens against the configured hashes, comparing every entry in constant time. */
export function deviceTokenAuth(entries: readonly TokenEntry[]): AuthVerifier {
  return {
    verify(token) {
      const digest = createHash('sha256').update(token, 'utf8').digest();
      let found: TokenEntry | null = null;
      for (const entry of entries) {
        // No early exit: the time taken does not depend on which entry (if any) matches.
        if (timingSafeEqual(digest, entry.hash) && !found) {
          found = entry;
        }
      }
      const principal: Principal | null = found
        ? {
            userId: found.userId,
            verified: true,
            profile: { email: found.email, displayName: found.displayName },
          }
        : null;
      return Promise.resolve(principal);
    },
  };
}
