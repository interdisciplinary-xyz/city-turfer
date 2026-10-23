// The portal's one way out to sign-in, and the back/forward-cache guard, as plain functions over a
// query client and a location, so they run (and are tested) without React or a browser.
import type { QueryClient } from '@tanstack/react-query';

import { signInUrl } from './next-path';
import type { PortalApiContextValue } from './provider.constants';

/** The part of `window.location` the portal uses to leave. */
export type LeaveLocation = Pick<Location, 'pathname' | 'replace' | 'reload'>;

type QueryCache = Pick<QueryClient, 'cancelQueries' | 'clear'>;

/**
 * `leave(reason, { returnHere })`: clears the whole query cache, then replaces this history entry
 * with the sign-in page (validated `next` and `reason` via `signInUrl`). Acts once only: later
 * calls (several 401s in flight) do nothing.
 */
export function createLeave({
  queryClient,
  locale,
  location,
}: {
  queryClient: QueryCache;
  locale: string;
  /** Read only when leaving (the provider is also rendered at build time, without a window). */
  location: () => LeaveLocation;
}): PortalApiContextValue['leave'] {
  let leaving = false;
  return (reason, { returnHere = false } = {}) => {
    if (leaving) {
      return;
    }
    leaving = true;
    void queryClient.cancelQueries();
    queryClient.clear();
    const here = location();
    const next = returnHere ? here.pathname : null;
    here.replace(signInUrl(locale, { next, reason }));
  };
}

/**
 * The API client's 401 handler: leave and come back here after signing in again. "Your session
 * ended" only when there was one (`auth.invalid`); a first visit (`auth.missing`) gets no notice.
 */
export function leaveOnUnauthorized(leave: PortalApiContextValue['leave']): (code: string | null) => void {
  return (code) => leave(code === 'auth.invalid' ? 'expired' : null, { returnHere: true });
}

/**
 * A `pageshow` listener: a page restored from the back/forward cache still holds what it rendered,
 * so forget it and reload, and the session gate asks the API again (after a sign-out that ends on
 * the sign-in page, Back shows no data).
 */
export function reloadOnRestore({
  queryClient,
  location,
}: {
  queryClient: Pick<QueryClient, 'clear'>;
  location: Pick<LeaveLocation, 'reload'>;
}): (event: Pick<PageTransitionEvent, 'persisted'>) => void {
  return (event) => {
    if (event.persisted) {
      queryClient.clear();
      location.reload();
    }
  };
}
