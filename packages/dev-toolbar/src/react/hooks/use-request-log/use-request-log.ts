import { useSyncExternalStore } from 'react';

import {
  getRequestLogServerSnapshot,
  getRequestLogSnapshot,
  installRequestLog,
  type RequestLogEntry,
  subscribeRequestLog,
} from '../../utils/request-log';

// Installed at module load, not in an effect: DevToolbar renders after the
// page, and React runs the page's effects first — an effect-time install
// would miss every request a page fires on mount. No-op in production and
// off localhost.
if (typeof window !== 'undefined') {
  installRequestLog();
}

export function useRequestLog(): readonly RequestLogEntry[] {
  return useSyncExternalStore(subscribeRequestLog, getRequestLogSnapshot, getRequestLogServerSnapshot);
}
