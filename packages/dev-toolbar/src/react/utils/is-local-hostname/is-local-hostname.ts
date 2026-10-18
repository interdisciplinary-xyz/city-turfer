/**
 * Hostnames the dev toolbar may render on. `.local` covers the Portless
 * dev hosts (e.g. `myapp.local`) that the host's dev server proxies
 * to localhost.
 */
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

export function isLocalHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return LOCAL_HOSTNAMES.has(host) || host.endsWith('.localhost') || host.endsWith('.local');
}
