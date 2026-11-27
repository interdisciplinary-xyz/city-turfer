'use client';

import { useEffect } from 'react';

import { RenderError } from '@/domains/portal';
import { portalErrorReporter } from '@/lib/api/portal-error-reporter';

/**
 * The portal's error boundary (Next `error.tsx`): wraps every page under the portal root, inside
 * its layout (copy and query client stay). A render crash is reported (unexpected by definition;
 * scrubbed, once per error) and the visitor sees the generic error copy with a retry. Public pages
 * have no boundary of their own here and never load the reporter.
 */
export default function AccountError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    portalErrorReporter.report(error, { source: 'render' });
  }, [error]);
  return <RenderError onRetry={retry} />;
}
