/**
 * A file path to compare: no `file://` scheme, no iOS `/private` prefix (on a device
 * NSTemporaryDirectory() is /private/var/mobile/…, while Expo's paths say /var/mobile/…; /var is a
 * link to /private/var), no `.` / `..` segments.
 */
export function normalisePath(uriOrPath: string): string {
  let p = uriOrPath.replace(/^file:\/\//, '');
  try {
    p = decodeURI(p);
  } catch {
    // keep as is
  }
  p = p.replace(/^\/private(?=\/var\/)/, '');
  const out: string[] = [];
  for (const part of p.split('/')) {
    if (part === '..') {
      out.pop();
    } else if (part !== '.' && part !== '') {
      out.push(part);
    }
  }
  return `/${out.join('/')}`;
}

/**
 * Our temp folders from the app's cache and document folders: the cache (the picker's copies,
 * view-shot on Android), the iOS container's tmp (view-shot on iOS) and the app's external cache on
 * Android (view-shot's fallback).
 */
export function tempRoots(cacheUri: string, documentUri: string): string[] {
  const cache = normalisePath(cacheUri);
  const container = normalisePath(`${normalisePath(documentUri)}/..`);
  const pkg = cache.match(/\/([^/]+)\/cache$/)?.[1];
  return [cache, `${container}/tmp`, ...(pkg ? [`/storage/emulated/0/Android/data/${pkg}/cache`] : [])];
}

/** Whether `uri` is a file inside one of `roots` (never a root itself, never outside via `..`). */
export function isInside(uri: string, roots: readonly string[]): boolean {
  const p = normalisePath(uri);
  return roots.some((root) => p.startsWith(`${root}/`));
}
