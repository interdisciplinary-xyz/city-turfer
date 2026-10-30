// The public/portal boundary of apps/web (docs/decisions/web-portal-2026-10-22.md): marketing code
// (the landing page, the root and shared layouts, i18n) never reaches the portal, its API client or
// its libraries, so a signed-out visitor never downloads them. Runs in `pnpm test` / `turbo run arch`
// over src, server.mjs and next.config.ts. Negative control: tools/__tests__/dependency-cruiser.test.mjs.
const portal = '^src/app/\\[locale\\]/account/';
const portalLibraries = '(^|/)node_modules/(@tanstack/[^/]+|openapi-fetch|maplibre-gl)/';
const notPortal = '^src/(app/\\[locale\\]/account/|api/)';
// Not portal code either: the dev server, the dev tools it loads and the Next config.
const site = '^(src/|tools/|server\\.mjs$|next\\.config\\.ts$)';

module.exports = {
  forbidden: [
    {
      name: 'marketing-not-portal',
      severity: 'error',
      comment: 'Public pages, shared layouts, server.mjs, tools and next.config.ts never import the portal root.',
      from: { path: site, pathNot: notPortal },
      to: { path: portal },
    },
    {
      name: 'marketing-not-api-client',
      severity: 'error',
      comment:
        'Only the portal root uses the API client (src/api): public pages (and the dev server) make no API calls.',
      from: { path: site, pathNot: notPortal },
      to: { path: '^src/api/' },
    },
    {
      name: 'portal-libraries-only-in-portal',
      severity: 'error',
      comment: 'TanStack Query, openapi-fetch and maplibre-gl load only on portal pages.',
      from: { path: '^src/', pathNot: notPortal },
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
      name: 'marketing-not-core',
      severity: 'error',
      comment:
        'Public pages never load @cityturfer/core: its formatters are for the portal (docs/plans/web-portal-history-2026-10-23.md, H4).',
      // tools/gen-turf-demo.mjs runs at build time only and writes plain numbers (turf-demo.data.json):
      // core and h3-js never reach the browser, so it is the one named exception.
      from: { path: site, pathNot: [notPortal, '^tools/gen-turf-demo\\.mjs$'] },
      to: { path: '(^|/)packages/core/', pathNot: '(^|/)packages/core/src/h3/' },
    },
    {
      name: 'portal-core-shared-kernel-only',
      severity: 'error',
      comment:
        'apps/web uses @cityturfer/core through its shared kernel only (and /h3 for the portal map), never the contexts.',
      from: { path: notPortal },
      to: { path: '(^|/)packages/core/src/', pathNot: '(^|/)packages/core/src/(shared-kernel|h3)/' },
    },
    {
      name: 'api-client-is-a-leaf',
      severity: 'error',
      comment: 'src/api is the data layer: it never imports pages or components.',
      from: { path: '^src/api/' },
      to: { path: '^src/app/' },
    },
    {
      name: 'portal-no-gsap',
      severity: 'error',
      comment: 'No GSAP or hero motion on portal pages (docs/decisions/web-portal-2026-10-22.md).',
      from: { path: notPortal },
      to: { path: '(^|/)node_modules/(gsap|@gsap/[^/]+)/|^src/app/\\[locale\\]/hero-motion/hero-motion\\.tsx$' },
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
