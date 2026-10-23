// The account actions that end with leaving the portal: sign out, sign out everywhere, delete the
// account. Plain mutation options (no React), so the "leave only when it really happened" rule is
// unit-tested with TanStack's own MutationObserver.
//
// The rule: leave (clear everything, go to sign-in with a "you're signed out" / "erased" notice)
// only when the API confirmed it, or answered 401 (the session is already gone). On any other
// failure (offline, 5xx, 403 auth.csrf) stay: the cookie and the server session still live, and
// telling someone on a shared computer they're signed out would be false.
import type { MutationOptions, QueryClient } from '@tanstack/react-query';

import type { PortalError } from './errors';
import type { PortalApi } from './portal-api';
import type { PortalApiContextValue } from './provider.constants';
import type { SessionScope } from './schema';

type Deps = { api: PortalApi; leave: PortalApiContextValue['leave']; queryClient: QueryClient };

export const SESSIONS_KEY = ['sessions'] as const;

export function signOutMutation({
  api,
  leave,
}: Pick<Deps, 'api' | 'leave'>): MutationOptions<unknown, PortalError, void> {
  return {
    mutationFn: () => api.signOut(),
    onSuccess: () => leave('signed-out'),
    // 401 here is not handled by the client (sign-out is excluded): the session was already gone.
    onError: (error) => {
      if (error.code === 'signed-out') {
        leave('signed-out');
      }
    },
  };
}

export function revokeSessionsMutation({
  api,
  leave,
  queryClient,
}: Deps): MutationOptions<unknown, PortalError, SessionScope> {
  return {
    mutationFn: (scope) => api.revokeSessions(scope),
    onSuccess: (_data, scope) => {
      if (scope === 'all') {
        leave('signed-out');
        return undefined;
      }
      return queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
    },
    // A 401 goes to sign-in through the client's 401 handler; every other error stays on the page.
  };
}

export function deleteAccountMutation({
  api,
  leave,
}: Pick<Deps, 'api' | 'leave'>): MutationOptions<unknown, PortalError, void> {
  return {
    mutationFn: () => api.deleteAccount(),
    onSuccess: () => leave('deleted'),
    // A 401 goes to sign-in through the client's 401 handler; every other error stays on the page.
  };
}
