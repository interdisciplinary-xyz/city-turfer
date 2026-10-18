/** Raw inventory served by `@interdisciplinary/dev-toolbar/node` (`route-inventory.js`). */
export type RouteInventoryResponse = {
  sitemapPaths: string[];
  filePatterns: string[];
};

export type RouteInventoryItem = {
  /** Stable id: the concrete path (`page`) or the pattern (`pattern`). */
  key: string;
  /**
   * `page`    — a concrete URL from the sitemap (CMS page, post, style page).
   * `pattern` — a coded route the sitemap doesn't list; matches any locale
   *             and any value of its dynamic segments.
   */
  kind: 'page' | 'pattern';
  /** Only for `pattern` items. */
  regex?: RegExp;
};
