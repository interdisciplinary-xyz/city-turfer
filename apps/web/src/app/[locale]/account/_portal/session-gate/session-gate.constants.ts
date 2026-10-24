import type { ReactNode } from 'react';

import type { PortalError } from '@/api/errors';
import type { Locale } from '@/i18n/routing';

export type SessionGateProps = { locale: Locale; children: ReactNode };

/** The gate's body: its props plus the page's query (null in the static HTML, before hydration). */
export type GateBodyProps = SessionGateProps & { search: URLSearchParams | null };

/**
 * What the gate shows:
 * - `page`: the signed-in page, whenever `/v1/me` has answered once; `refreshFailed` is the error
 *   of a later background refetch (the page stays, with a small notice);
 * - `leaving`: a 401, on its way to sign-in (the client clears the cache, so nothing personal stays);
 * - `unreachable`: no answer yet and the backup can't be reached ("check your connection");
 * - `error`: no answer yet and any other error (429, 500, …): its own message and wait;
 * - `checking`: the first answer is on its way.
 */
export type GateView =
  | { kind: 'page'; refreshFailed: PortalError | null }
  | { kind: 'leaving' }
  | { kind: 'unreachable'; error: PortalError }
  | { kind: 'error'; error: PortalError }
  | { kind: 'checking' };

/** The `/v1/me` query as the gate reads it (TanStack Query keeps `data` after a failed refetch). */
export type GateQuery = { hasData: boolean; error: PortalError | null };

export function gateView({ hasData, error }: GateQuery): GateView {
  if (error?.code === 'signed-out') {
    return { kind: 'leaving' };
  }
  if (hasData) {
    return { kind: 'page', refreshFailed: error };
  }
  if (error) {
    return error.unreachable ? { kind: 'unreachable', error } : { kind: 'error', error };
  }
  return { kind: 'checking' };
}
