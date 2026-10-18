import { DEV_PATH_PREFIX } from '../../../protocol.js';

/**
 * Whether the dev request logger should record a request to `url`.
 *
 * Skips framework traffic that would drown the API calls: Next's static
 * chunks + dev overlay (`/_next/`, `/__nextjs*`), RSC navigation payloads
 * (`?_rsc=`), HMR updates, the logger's own server poll (`/__dev/`), and
 * non-network schemes (`data:`, `blob:`).
 */
export function shouldLogRequest(url: URL): boolean {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return false;
  }
  if (
    url.pathname.startsWith('/_next/') ||
    url.pathname.startsWith('/__nextjs') ||
    url.pathname.startsWith(DEV_PATH_PREFIX)
  ) {
    return false;
  }
  if (url.searchParams.has('_rsc') || url.pathname.includes('.hot-update.')) {
    return false;
  }
  return true;
}
