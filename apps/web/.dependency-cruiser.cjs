// The public/portal boundary of apps/web (`web-portal` skill): marketing code (the landing page,
// the root and shared layouts, i18n) never reaches the portal, its API client or its libraries, so
// a signed-out visitor never downloads them. Runs in `pnpm test` / `turbo run arch`.
const portal = '^src/app/\\[locale\\]/account/';
const portalLibraries = '(^|/)node_modules/(@tanstack/[^/]+|openapi-fetch|maplibre-gl)/';
const notPortal = '^src/(app/\\[locale\\]/account/|api/)';

module.exports = {
  forbidden: [
    {
      name: 'marketing-not-portal',
      severity: 'error',
      comment: 'Public pages and shared layouts never import the portal root (src/app/[locale]/account).',
      from: { path: '^src/', pathNot: notPortal },
      to: { path: portal },
    },
    {
      name: 'marketing-not-api-client',
      severity: 'error',
      comment: 'Only the portal root uses the API client (src/api): public pages make no API calls.',
      from: { path: '^src/', pathNot: notPortal },
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
      name: 'api-client-is-a-leaf',
      severity: 'error',
      comment: 'src/api is the data layer: it never imports pages or components.',
      from: { path: '^src/api/' },
      to: { path: '^src/app/' },
    },
    {
      name: 'portal-no-gsap',
      severity: 'error',
      comment: 'No GSAP or hero motion on portal pages (web-portal skill).',
      from: { path: notPortal },
      to: { path: '(^|/)node_modules/(gsap|@gsap/[^/]+)/|^src/app/\\[locale\\]/hero-motion/hero-motion\\.tsx$' },
    },
    { name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    exclude: { path: '(^|/)__tests__/|\\.test\\.ts$' },
  },
};
