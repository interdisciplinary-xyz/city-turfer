import { usePathname } from 'next/navigation';

import { useRequestLog } from '../../../../hooks/use-request-log';
import type { RequestLogScope, RequestLogSourceFilter } from '../../request-logger.constants';
import { countDuplicates, filterRequestLog, summarizeRequestLog } from '../../request-logger.utils';

/** The live request log, filtered and totalled for the current view. */
export function useLiveRequests(scope: RequestLogScope, source: RequestLogSourceFilter) {
  const pathname = usePathname();
  const entries = useRequestLog();
  const visible = filterRequestLog(entries, scope, pathname, source);
  return {
    pathname,
    visible,
    summary: summarizeRequestLog(visible),
    duplicates: countDuplicates(visible),
  };
}
