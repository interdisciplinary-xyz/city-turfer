import { describe, expect, it } from 'vitest';

import { buildRouteInventory, matchRouteItem, normalizeRoutePath, patternToRegExp } from './route-inventory';

const INVENTORY = buildRouteInventory(
  {
    sitemapPaths: ['/', '/pl', '/pricing', '/pl/cennik', '/factors', '/knowledge/post-a', '/pl/knowledge/wpis-a'],
    filePatterns: ['/', '/[slug]', '/factors', '/knowledge/[slug]', '/u/[slug]', '/app/account', '/app/team/[teamId]'],
  },
  ['pl']
);

describe('patternToRegExp', () => {
  it('matches dynamic segments with and without a locale prefix', () => {
    const regex = patternToRegExp('/app/team/[teamId]', ['pl']);
    expect(regex.test('/app/team/abc')).toBe(true);
    expect(regex.test('/pl/app/team/abc')).toBe(true);
    expect(regex.test('/app/team')).toBe(false);
    expect(regex.test('/app/team/abc/extra')).toBe(false);
    expect(regex.test('/de/app/team/abc')).toBe(false);
  });

  it('treats catch-all segments as the rest of the path', () => {
    const regex = patternToRegExp('/docs/[...path]', []);
    expect(regex.test('/docs/a/b/c')).toBe(true);
  });
});

describe('buildRouteInventory', () => {
  it('lists sitemap pages plus coded routes the sitemap does not cover', () => {
    expect(INVENTORY.map((item) => item.key)).toEqual([
      '/',
      '/factors',
      '/knowledge/post-a',
      '/pl',
      '/pl/cennik',
      '/pl/knowledge/wpis-a',
      '/pricing',
      '/app/account',
      '/app/team/[teamId]',
      '/u/[slug]',
    ]);
  });
});

describe('matchRouteItem', () => {
  it('prefers exact sitemap pages, then falls back to patterns', () => {
    expect(matchRouteItem(INVENTORY, '/pricing/')?.key).toBe('/pricing');
    expect(matchRouteItem(INVENTORY, '/pl/u/jane')?.key).toBe('/u/[slug]');
    expect(matchRouteItem(INVENTORY, '/pl/app/account')?.key).toBe('/app/account');
  });

  it('returns null for a path the inventory does not know', () => {
    expect(matchRouteItem(INVENTORY, '/knowledge/draft-post')).toBeNull();
  });

  it('normalizes trailing slashes', () => {
    expect(normalizeRoutePath('/')).toBe('/');
    expect(normalizeRoutePath('/a/')).toBe('/a');
  });
});
