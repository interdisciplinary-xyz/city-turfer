'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { type ReactNode, useEffect, useState } from 'react';

import { createPortalClient } from './client';
import { createLeave, leaveOnUnauthorized, reloadOnRestore } from './leave';
import { portalApi } from './portal-api';
import { portalErrorReporter } from './portal-error-reporter';
import { PortalApiContext, type PortalApiContextValue } from './provider.constants';
import { createPortalQueryClient } from './query-client';

/**
 * The portal's data layer, mounted by the portal root's own layout (never by the shared
 * `[locale]/layout.tsx`): one query client in memory only (never persisted), one API client, the
 * single way out to sign-in, and the error reporter (unexpected errors only, scrubbed; off unless
 * the production build has a DSN).
 */
export function PortalApiProvider({ children }: { children: ReactNode }) {
  const locale = useLocale();
  const [value] = useState<PortalApiContextValue>(() => {
    const queryClient = createPortalQueryClient(portalErrorReporter.report);
    const leave = createLeave({ queryClient, locale, location: () => window.location });
    const client = createPortalClient({ onUnauthorized: leaveOnUnauthorized(leave) });
    return { api: portalApi(client), queryClient, leave };
  });

  // Starts error reporting once, on the portal only; stops it if the portal root ever unmounts
  // (a client-side move to a public page), so no public page runs the SDK.
  useEffect(() => portalErrorReporter.start(), []);

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
