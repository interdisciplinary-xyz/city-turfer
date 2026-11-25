// The portal's query client: memory only (never persisted), reads retried only when the backup
// can't be reached, and every failed query or mutation offered to the error reporter, which keeps
// only the unexpected ones (error-reports.ts `isUnexpected`). The user still sees each error inline,
// in their words, from the hook's `error`.
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';

import type { ErrorReporter } from './error-reports';
import { isPortalError } from './errors';
import { MAX_READ_RETRIES, STALE_MS } from './provider.constants';

export function createPortalQueryClient(report: ErrorReporter['report']): QueryClient {
  return new QueryClient({
    // Called once per failed fetch, after the retries; a background refetch that fails again is a new report
    // only if it is a new error object (each fetch throws its own).
    queryCache: new QueryCache({
      onError: (error, query) => report(error, { source: 'query', key: query.queryKey }),
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _result, mutation) =>
        report(error, { source: 'mutation', key: mutation.options.mutationKey }),
    }),
    defaultOptions: {
      queries: {
        staleTime: STALE_MS,
        retry: (failures, error) => isPortalError(error) && error.retryable && failures < MAX_READ_RETRIES,
      },
      mutations: { retry: false },
    },
  });
}
