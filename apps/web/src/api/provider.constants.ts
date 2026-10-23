import type { QueryClient } from '@tanstack/react-query';
import { createContext } from 'react';

import type { SignInReason } from './next-path';
import type { PortalApi } from './portal-api';

export type LeaveOptions = {
  /** Come back to the current portal page after signing in again (a lost session). */
  returnHere?: boolean;
};

export type PortalApiContextValue = {
  api: PortalApi;
  queryClient: QueryClient;
  /**
   * Forget everything and go to sign-in: clears the whole query cache, then a full page load
   * (`location.replace`), so no personal data survives in memory or in this history entry.
   */
  leave: (reason: SignInReason | null, options?: LeaveOptions) => void;
};

export const PortalApiContext = createContext<PortalApiContextValue | null>(null);

/** Reads go stale after this long (ms); a window refocus re-checks them, which also re-checks the session. */
export const STALE_MS = 30_000;

/** At most this many automatic retries of a read, and only for `unreachable` / `storage.unavailable`. */
export const MAX_READ_RETRIES = 2;
