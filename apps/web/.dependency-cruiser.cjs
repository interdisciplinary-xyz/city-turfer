// The boundaries of apps/web, checked by `pnpm test` / `turbo run arch` over src, tools, server.mjs
// and next.config.ts. Negative control: tools/__tests__/dependency-cruiser.test.mjs.
//
// 1. Public/portal (docs/decisions/web-portal-2026-10-22.md): marketing code (the landing page, the
//    root and shared layouts, i18n, the marketing domains) never reaches the portal domains, the API
//    client or their libraries, so a signed-out visitor never downloads them.
// 2. Domains (docs/decisions/web-domains-2026-11-10.md): src/domains/* form a graph without cycles;
//    a domain imports only the domains DOMAIN_EDGES allows. src/lib is infrastructure: it imports no
//    domain and no route.

/** Domain → the domains it may import. Every folder in src/domains must be listed (even as []). */
const DOMAIN_EDGES = {
  ui: [],
  waitlist: ['ui'],
  homepage: ['ui'],
  layout: ['homepage', 'ui'],
  portal: ['ui'],
  auth: ['portal', 'ui'],
  account: ['portal', 'ui'],
  activities: ['portal', 'ui'],
};
const PORTAL_DOMAINS = ['portal', 'auth', 'account', 'activities'];
/** Every marketing domain but the light base `ui`: the portal never imports them (GSAP lives there). */
const MARKETING_DOMAINS = Object.keys(DOMAIN_EDGES).filter((d) => d !== 'ui' && !PORTAL_DOMAINS.includes(d));
/** What portal code, and the `ui` base it shares with the landing page, must never load. */
const gsap = '(^|/)node_modules/(gsap|@gsap/[^/]+)/';
/** A domain's light parts: its React-free `logic` entry, constants files and utils. */
const light = '^src/domains/[^/]+/(logic\\.ts$|utils/|(components|hooks)/[^/]+/[^/]+\\.constants\\.ts$)';

/** The portal's own code: its routes and its domains. Marketing code never imports it. */
const portal = `^src/(app/\\[locale\\]/account/|domains/(${PORTAL_DOMAINS.join('|')})/)`;
const portalLibraries = '(^|/)node_modules/(@tanstack/[^/]+|openapi-fetch|maplibre-gl)/';
/** The portal plus the API client it alone uses. */
const portalCode = `^src/(app/\\[locale\\]/account/|domains/(${PORTAL_DOMAINS.join('|')})/|lib/api/)`;
// Not portal code either: the dev server, the dev tools it loads and the Next config.
const site = '^(src/|tools/|server\\.mjs$|next\\.config\\.ts$)';

const domainRules = Object.entries(DOMAIN_EDGES).map(([domain, allowed]) => ({
  name: `domain-edges-${domain}`,
  severity: 'error',
  comment: allowed.length
    ? `src/domains/${domain} imports only ${allowed.join(', ')} (DOMAIN_EDGES).`
    : `src/domains/${domain} is the base leaf: it imports no other domain.`,
  from: { path: `^src/domains/${domain}/` },
  to: { path: '^src/domains/', pathNot: `^src/domains/(${[domain, ...allowed].join('|')})/` },
}));

module.exports = {
  forbidden: [
    {
      name: 'marketing-not-portal',
      severity: 'error',
      comment: 'Public pages, shared layouts, server.mjs, tools and next.config.ts never import the portal root.',
      from: { path: site, pathNot: portalCode },
      to: { path: portal },
    },
    {
      name: 'marketing-not-api-client',
      severity: 'error',
      comment:
        'Only the portal uses the API client (src/lib/api): public pages (and the dev server) make no API calls.',
      from: { path: site, pathNot: portalCode },
      to: { path: '^src/lib/api/' },
    },
    {
      name: 'portal-libraries-only-in-portal',
      severity: 'error',
      comment: 'TanStack Query, openapi-fetch and maplibre-gl load only on portal pages.',
      from: { path: '^src/', pathNot: portalCode },
      to: { path: portalLibraries },
    },
    {
      name: 'core-h3-only-in-portal',
      severity: 'error',
      comment: '@cityturfer/core/h3 (h3-js) is for the portal map only.',
      from: { path: '^src/', pathNot: portal },
      to: { path: '(^|/)packages/core/src/h3/|(^|/)node_modules/h3-js/' },
    },
    {
      name: 'no-core-districts',
      severity: 'error',
      comment:
        '@cityturfer/core/districts (OSM boundaries, ODbL) is an app-only entry: nothing in apps/web loads it, build tools included.',
      from: { pathNot: '(^|/)packages/core/src/districts/' },
      to: { path: '(^|/)packages/core/src/districts/|^@cityturfer/core/districts' },
    },
    {
      name: 'marketing-not-core',
      severity: 'error',
      comment:
        'Public pages never load @cityturfer/core: its formatters are for the portal (docs/plans/web-portal-history-2026-10-23.md, H4).',
      // tools/gen-turf-demo.mjs runs at build time only and writes plain numbers (turf-demo.data.json):
      // core and h3-js never reach the browser, so it is the one named exception.
      from: { path: site, pathNot: [portalCode, '^tools/gen-turf-demo\\.mjs$'] },
      to: { path: '(^|/)packages/core/', pathNot: '(^|/)packages/core/src/h3/' },
    },
    {
      name: 'portal-core-shared-kernel-only',
      severity: 'error',
      comment:
        'apps/web uses @cityturfer/core through its shared kernel only (and /h3 for the portal map), never the contexts.',
      from: { path: portalCode },
      to: { path: '(^|/)packages/core/src/', pathNot: '(^|/)packages/core/src/(shared-kernel|h3)/' },
    },
    {
      name: 'lib-is-infrastructure',
      severity: 'error',
      comment: 'src/lib (the API client, site URLs) is infrastructure: it never imports routes or domains.',
      from: { path: '^src/lib/' },
      to: { path: '^src/(app|domains)/' },
    },
    {
      name: 'domain-declared',
      severity: 'error',
      // Fires on a module that imports something (depcruise rules are about imports); a new domain
      // made only of leaf files would slip through, but every domain has an index.ts barrel that
      // re-exports its units, so a real one always trips it.
      comment: 'Every folder in src/domains is listed in DOMAIN_EDGES (and in the web-domains decision).',
      from: { path: '^src/domains/', pathNot: `^src/domains/(${Object.keys(DOMAIN_EDGES).join('|')})/` },
      to: {},
    },
    ...domainRules,
    {
      name: 'portal-no-gsap',
      severity: 'error',
      comment:
        'No GSAP or hero motion on portal pages (docs/decisions/web-portal-2026-10-22.md): portal code imports no marketing domain but ui (MARKETING_DOMAINS reach homepage, which loads GSAP).',
      from: { path: portalCode },
      // Stylesheets are fine: the portal layout loads the app header's CSS for its language switch.
      to: {
        path: `${gsap}|^src/domains/(${MARKETING_DOMAINS.join('|')})/`,
        pathNot: '\\.css$',
      },
    },
    {
      name: 'ui-no-gsap',
      severity: 'error',
      comment:
        'ui is the base the portal and the shared layout import whole (its barrel): it never loads GSAP, or every portal page would.',
      from: { path: '^src/domains/ui/' },
      to: { path: gsap },
    },
    {
      name: 'logic-is-light',
      severity: 'error',
      comment:
        "A domain's logic entry, constants and utils stay React-free: no components (.tsx), barrels, React, Next, next-intl, GSAP or TanStack (type-only imports are fine).",
      from: { path: light },
      to: {
        path: '\\.tsx$|^src/domains/[^/]+/(index\\.ts$|(components|hooks)/[^/]+/index\\.ts$)|(^|/)node_modules/(react|react-dom|next|next-intl|gsap|@gsap/[^/]+|@tanstack/[^/]+)/',
        dependencyTypesNot: ['type-only'],
      },
    },
    {
      name: 'not-to-unresolvable',
      severity: 'error',
      comment: 'Every import resolves: an unresolved one (a workspace package, a typo) slips past the rules above.',
      from: {},
      to: { couldNotResolve: true },
    },
    { name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    // Resolve workspace packages through package.json "exports" (@cityturfer/brand,
    // @interdisciplinary/dev-toolbar/<entry>, @cityturfer/core/h3), as apps/mobile does.
    enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'require', 'node', 'default'] },
    exclude: { path: '(^|/)__tests__/|\\.test\\.ts$' },
  },
};
