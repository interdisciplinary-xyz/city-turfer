import { scrubText } from './scrub-text';

/**
 * The shape of an error-tracking breadcrumb, typed structurally so core needs no SDK: a Sentry
 * `Breadcrumb` (any SDK) is assignable to it.
 */
export interface ScrubbableBreadcrumb {
  type?: string;
  category?: string;
  message?: string;
  level?: string;
  data?: { [key: string]: unknown };
  timestamp?: number;
}

/** Console output, network calls: their text and URLs may carry anything (coordinates, tokens). */
const DROPPED_CATEGORIES = new Set(['console', 'fetch', 'xhr', 'http']);
const DROPPED_TYPES = new Set(['http']);

const QUERY_OR_HASH = /[?#].*$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIGITS = /^\d+$/;
const LONG_HEX = /^[0-9a-f]{16,}$/i;

/**
 * A screen route without its values: no query or fragment, ids (UUIDs, numbers, long hex) as `:id`,
 * coordinates redacted. `/activity/3f2a…?from=map` → `/activity/:id`.
 */
export function routePattern(route: string): string {
  return scrubText(
    route
      .replace(QUERY_OR_HASH, '')
      .split('/')
      .map((s) => (UUID.test(s) || DIGITS.test(s) || LONG_HEX.test(s) ? ':id' : s))
      .join('/')
  );
}

/**
 * Before a breadcrumb is kept: console, fetch, XHR and HTTP breadcrumbs are dropped (null);
 * navigation keeps only the route patterns it moved between; every other breadcrumb keeps its
 * category, level and scrubbed message, without data.
 */
export function scrubBreadcrumb<B extends ScrubbableBreadcrumb>(breadcrumb: B): B | null {
  if (DROPPED_CATEGORIES.has(breadcrumb.category ?? '') || DROPPED_TYPES.has(breadcrumb.type ?? '')) {
    return null;
  }
  const out: B = { ...breadcrumb };
  delete out.data;
  if (breadcrumb.category === 'navigation') {
    const data: { [key: string]: unknown } = {};
    for (const key of ['from', 'to'] as const) {
      const value = breadcrumb.data?.[key];
      if (typeof value === 'string') {
        data[key] = routePattern(value);
      }
    }
    out.data = data;
    delete out.message;
    return out;
  }
  if (typeof out.message === 'string') {
    out.message = scrubText(out.message);
  }
  return out;
}
