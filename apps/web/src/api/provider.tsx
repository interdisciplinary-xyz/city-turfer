'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { type ReactNode, useEffect, useState } from 'react';

import { createPortalClient } from './client';
import { isPortalError } from './errors';
import { signInUrl } from './next-path';
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
    let leaving = false;
    const leave: PortalApiContextValue['leave'] = (reason, { returnHere = false } = {}) => {
      if (leaving) {
        return;
      }
      leaving = true;
      void queryClient.cancelQueries();
      queryClient.clear();
      const next = returnHere ? window.location.pathname : null;
      window.location.replace(signInUrl(locale, { next, reason }));
    };
    // "Your session ended" only when there was one; a first visit (`auth.missing`) gets no notice.
    const client = createPortalClient({
      onUnauthorized: (code) => leave(code === 'auth.invalid' ? 'expired' : null, { returnHere: true }),
    });
    return { api: portalApi(client), queryClient, leave };
  });

  // A page restored from the back/forward cache still holds what it rendered: reload it, so the
  // session gate asks the API again (after a sign-out that ends on the sign-in page).
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        value.queryClient.clear();
        window.location.reload();
      }
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [value]);

  return (
    <PortalApiContext.Provider value={value}>
      <QueryClientProvider client={value.queryClient}>{children}</QueryClientProvider>
    </PortalApiContext.Provider>
  );
}
