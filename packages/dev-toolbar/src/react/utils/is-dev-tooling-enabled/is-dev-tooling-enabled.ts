import { isLocalHostname } from '../is-local-hostname';

/**
 * The gate every dev-tool side effect shares: a development build, running
 * in a browser, on a local hostname.
 */
export function isDevToolingEnabled(): boolean {
  return (
    process.env.NODE_ENV === 'development' && typeof window !== 'undefined' && isLocalHostname(window.location.hostname)
  );
}
