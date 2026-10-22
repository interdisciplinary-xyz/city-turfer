'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { type ReactNode, useEffect, useState } from 'react';

import { createPortalClient } from './client';
import { isPortalError } from './errors';
import { createLeave, leaveOnUnauthorized, reloadOnRestore } from './leave';
import { portalApi } from './portal-api';
import { MAX_READ_RETRIES, PortalApiContext, type PortalApiContextValue, STALE_MS } from './provider.constants';

/**
 * The portal's data layer, mounted by the portal root's own layout (never by the shared
 * `[locale]/layout.tsx`): one query client in memory only (never persisted), one API client, and
 * the single way out to sign-in.
 */
export function PortalApiProvider({ children }: { children: ReactNode }) {
  const locale = useLocale();
  const [value] = useState<PortalApiContextValue>(() => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: STALE_MS,
          retry: (failures, error) => isPortalError(error) && error.retryable && failures < MAX_READ_RETRIES,
        },
        mutations: { retry: false },
      },
    });
    const leave = createLeave({ queryClient, locale, location: () => window.location });
    const client = createPortalClient({ onUnauthorized: leaveOnUnauthorized(leave) });
    return { api: portalApi(client), queryClient, leave };
  });

  // A page restored from the back/forward cache still holds what it rendered: reload it, so the
  // session gate asks the API again (after a sign-out that ends on the sign-in page).
  useEffect(() => {
    const onPageShow = reloadOnRestore({ queryClient: value.queryClient, location: window.location });
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [value]);

  return (
    <PortalApiContext.Provider value={value}>
      <QueryClientProvider client={value.queryClient}>{children}</QueryClientProvider>
    </PortalApiContext.Provider>
  );
}
