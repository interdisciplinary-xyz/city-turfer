/**
 * Every place a person sees the CityTurfer brand, in one list. `pnpm run audit:brand` checks it
 * against the code and `pnpm run brand:snapshot` screenshots the surfaces that have a URL, so a
 * branding change can be compared across all of them at once (the `brand-surfaces` skill).
 *
 * Fields:
 *   id, name   stable key and human name
 *   scheme     'dark' (always dark: the app, every map), 'site' (follows SITE_SCHEME, dark since
 *              v0.12.0: website, portal, Swagger, Storybook) or 'both' (maps both schemes because
 *              the host switches them: the admin follows Payload's own light/dark toggle)
 *   owner      the agent that changes this surface (.claude/agents/<owner>.md)
 *   status     'live' | 'dev' (local only) | 'paused' (not deployed, not unified yet)
 *   theme      files that turn brand tokens into this surface's colours, or [] when it has none; on a
 *              'site' or 'both' surface each one must draw from the brand in code (audit:brand)
 *   fonts      files that load the brand typefaces here, or [] when it uses none
 *   logo       files that place the mark / wordmark / favicon / icon here
 *   copy       files with this surface's user-facing words (product name, taglines, titles)
 *   snapshot   how to screenshot it: { base: 'web' | 'api', paths, sizes } or { ios: true }
 *   note       what is known to differ (kept until the plan fixes it)
 *
 * All paths are repo-root relative. The source every surface draws from is `packages/brand`.
 */

/** Phone and desktop widths every web surface is captured at. */
export const WEB_SIZES = ['390x844', '1440x900'];

/** @type {readonly Surface[]} */
export const SURFACES = [
  {
    id: 'mobile',
    name: 'Mobile app (iOS, Android)',
    scheme: 'dark',
    owner: 'mobile-ui-engineer',
    status: 'live',
    theme: ['apps/mobile/src/constants/colors.ts', 'apps/mobile/src/ui-kit/theme.ts', 'packages/ui/src/index.ts'],
    fonts: ['apps/mobile/app.json'],
    logo: ['apps/mobile/app.json', 'apps/mobile/assets/icon.png', 'apps/mobile/assets/splash-icon.png'],
    copy: ['apps/mobile/messages/en', 'apps/mobile/messages/pl'],
    snapshot: { ios: true },
  },
  {
    id: 'web',
    name: 'Website (public pages)',
    scheme: 'site',
    owner: 'web-engineer',
    status: 'live',
    theme: [
      'apps/web/src/app/[locale]/layout.tsx',
      'apps/web/src/app/globals.css',
      'apps/web/src/app/[locale]/home-sections/home-sections.css',
    ],
    fonts: ['apps/web/src/app/fonts.ts'],
    logo: ['apps/web/src/app/[locale]/layout.tsx', 'apps/web/public/og-image.png'],
    copy: ['apps/web/messages/en.json', 'apps/web/messages/pl.json'],
    snapshot: { base: 'web', paths: ['/en', '/pl'], sizes: WEB_SIZES },
  },
  {
    id: 'portal',
    name: 'Web portal (signed in)',
    scheme: 'site',
    owner: 'portal-engineer',
    status: 'live',
    // Under [locale]/layout.tsx, so globals.css applies; account/layout.tsx adds portal.css.
    theme: ['apps/web/src/app/globals.css', 'apps/web/src/app/[locale]/account/portal.css'],
    fonts: ['apps/web/src/app/fonts.ts'],
    logo: ['apps/web/src/app/[locale]/app-header'],
    copy: ['apps/web/messages/en.json', 'apps/web/messages/pl.json'],
    snapshot: { base: 'web', paths: ['/en/account'], sizes: WEB_SIZES },
    note: 'Signed out it shows the sign-in form; sign in first for the history pages.',
  },
  {
    id: 'branding',
    name: 'Brand book (/branding, dev only)',
    scheme: 'site',
    owner: 'brand-designer',
    status: 'dev',
    // Outside [locale], so not globals.css: the page sets cssVariables(SITE_SCHEME) and branding.css.
    theme: ['apps/web/src/app/branding/page.dev.tsx', 'apps/web/src/app/branding/branding.css'],
    fonts: ['apps/web/src/app/fonts.ts'],
    logo: ['apps/web/src/app/branding'],
    copy: ['apps/web/src/app/branding'],
    snapshot: { base: 'web', paths: ['/branding'], sizes: WEB_SIZES },
  },
  {
    id: 'swagger-dev',
    name: 'Swagger, dev (cityturfer.local/swagger)',
    scheme: 'site',
    owner: 'web-engineer',
    status: 'dev',
    theme: ['apps/web/tools/swagger-brand.mjs', 'apps/web/tools/swagger-theme.css'],
    fonts: ['apps/web/tools/swagger-theme.css'],
    logo: ['apps/web/tools/swagger-route.mjs'],
    copy: ['apps/web/tools/swagger-route.mjs', 'apps/api/src/guide.ts', 'apps/api/src/spec.ts'],
    snapshot: { base: 'web', paths: ['/swagger'], sizes: WEB_SIZES },
  },
  {
    id: 'swagger-api',
    name: 'Swagger, served by the API (/swagger on city-turfer-api)',
    scheme: 'site',
    owner: 'api-engineer',
    status: 'live',
    theme: [],
    fonts: [],
    logo: [],
    copy: ['apps/api/src/app.ts', 'apps/api/src/guide.ts', 'apps/api/src/spec.ts'],
    snapshot: { base: 'api', paths: ['/swagger'], sizes: WEB_SIZES },
    note: 'Stock Swagger UI: only the title is ours. The branded skin exists only in the dev page.',
  },
  {
    id: 'storybook',
    name: 'Storybook (design system)',
    scheme: 'site',
    owner: 'mobile-ui-engineer',
    status: 'dev',
    theme: ['apps/storybook/.storybook/theme.ts', 'apps/storybook/.storybook/preview.tsx'],
    fonts: ['apps/storybook/.storybook/preview-head.html', 'apps/storybook/.storybook/manager-head.html'],
    logo: ['apps/storybook/.storybook/theme.ts', 'apps/storybook/.storybook/main.ts'],
    copy: ['apps/storybook/.storybook/manager-head.html'],
    snapshot: { base: 'web', paths: ['/storybook/'], sizes: ['1440x900'] },
  },
  {
    id: 'assets',
    name: 'Rendered assets (icon, splash, social image, store screenshots)',
    scheme: 'dark',
    owner: 'brand-designer',
    status: 'live',
    theme: ['packages/brand/templates/og-image.html', 'packages/brand/templates/store-screenshot.html'],
    fonts: ['packages/brand/templates/og-image.html', 'packages/brand/templates/store-screenshot.html'],
    logo: ['packages/brand/svg', 'apps/mobile/tools/brand/render-assets.mjs'],
    copy: ['packages/brand/src/copy.ts'],
    snapshot: null,
  },
  {
    id: 'admin',
    name: 'Admin portal (Payload)',
    scheme: 'both',
    // No admin agent yet; the theme mapping is brand-designer's (apps/admin/src/app/(payload)/custom.scss).
    owner: 'brand-designer',
    status: 'paused',
    theme: [
      'apps/admin/src/brand/theme.ts',
      'apps/admin/src/brand/brand-theme.constants.ts',
      'apps/admin/src/brand/brand-theme.tsx',
    ],
    fonts: ['apps/admin/src/brand/fonts.ts'],
    logo: ['apps/admin/src/brand/logo.tsx', 'apps/admin/src/brand/icon.tsx', 'apps/admin/src/payload.config.ts'],
    copy: ['apps/admin/src/payload.config.ts'],
    snapshot: null,
    note: "Maps brand tokens onto Payload's variables in both of Payload's schemes (staff can switch); not deployed.",
  },
];

/**
 * @typedef {object} Surface
 * @property {string} id
 * @property {string} name
 * @property {'dark' | 'site' | 'both'} scheme
 * @property {string} owner
 * @property {'live' | 'dev' | 'paused'} status
 * @property {string[]} theme
 * @property {string[]} fonts
 * @property {string[]} logo
 * @property {string[]} copy
 * @property {{ base: 'web' | 'api', paths: string[], sizes: string[] } | { ios: true } | null} snapshot
 * @property {string} [note]
 */
