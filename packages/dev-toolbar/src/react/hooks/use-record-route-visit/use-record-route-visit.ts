import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

import { recordRouteVisit } from '../../utils/route-map';

/**
 * Count a route-map visit on every pathname change (full loads included).
 * Lives in the always-mounted DevToolbar, so visits are recorded even with
 * the toolbar collapsed.
 */
export function useRecordRouteVisit(enabled: boolean): void {
  const pathname = usePathname();

  useEffect(() => {
    if (enabled) {
      recordRouteVisit(pathname);
    }
  }, [enabled, pathname]);
}
