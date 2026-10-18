import type { RouteInventoryItem, RouteInventoryResponse } from './route-inventory.constants';

/** `/pricing/` → `/pricing`; the root stays `/`. */
export const normalizeRoutePath = (path: string): string =>
  path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * `/app/team/[teamId]` → a RegExp matching it under any non-default locale
 * prefix (`/pl/app/team/abc`) as well as unprefixed (`localePrefix:
 * 'as-needed'`). `[x]` matches one segment, `[...x]` / `[[...x]]` the rest.
 */
export function patternToRegExp(pattern: string, localePrefixes: readonly string[]): RegExp {
  const body = pattern
    .split('/')
    .filter(Boolean)
    .map((segment) => {
      if (/^\[\[?\.\.\./.test(segment)) {
        return '(?:/.+)?';
      }
      if (/^\[.+\]$/.test(segment)) {
        return '/[^/]+';
      }
      return `/${escapeRegExp(segment)}`;
    })
    .join('');
  const prefixes = localePrefixes.map((p) => `/${escapeRegExp(p)}`).join('|');
  const prefix = prefixes ? `(?:${prefixes})?` : '';
  return new RegExp(`^${prefix}${body || ''}/?$`);
}

const dynamicSegmentCount = (pattern: string) => (pattern.match(/\[/g) ?? []).length;

/**
 * The route checklist: every sitemap URL, plus each coded route the sitemap
 * doesn't already cover (a dynamic route with ANY sitemap URL under it —
 * `/knowledge/[slug]`, the CMS `/[slug]` — is represented by those URLs, so
 * it isn't counted again).
 */
export function buildRouteInventory(
  { sitemapPaths, filePatterns }: RouteInventoryResponse,
  localePrefixes: readonly string[]
): RouteInventoryItem[] {
  const pages = [...new Set(sitemapPaths.map(normalizeRoutePath))];
  const pageSet = new Set(pages);
  const items: RouteInventoryItem[] = pages.map((key) => ({
    key,
    kind: 'page',
  }));

  for (const pattern of new Set(filePatterns.map(normalizeRoutePath))) {
    const regex = patternToRegExp(pattern, localePrefixes);
    const isStatic = dynamicSegmentCount(pattern) === 0;
    const covered = isStatic ? pageSet.has(pattern) : pages.some((page) => regex.test(page));
    if (!covered) {
      items.push({ key: pattern, kind: 'pattern', regex });
    }
  }

  // Most specific first, so matching can take the first hit.
  return items.sort((a, b) => {
    if (a.kind !== b.kind) {
      return a.kind === 'page' ? -1 : 1;
    }
    const byDynamic = dynamicSegmentCount(a.key) - dynamicSegmentCount(b.key);
    return byDynamic !== 0 ? byDynamic : a.key.localeCompare(b.key);
  });
}

/** The inventory item a visited path belongs to, or `null` if unlisted. */
export function matchRouteItem(items: readonly RouteInventoryItem[], path: string): RouteInventoryItem | null {
  const normalized = normalizeRoutePath(path);
  return (
    items.find((item) => (item.kind === 'page' ? item.key === normalized : (item.regex?.test(normalized) ?? false))) ??
    null
  );
}
