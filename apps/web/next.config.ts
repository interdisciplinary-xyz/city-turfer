import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

import pkg from './package.json' with { type: 'json' };

const DEFAULT_PAGE_EXTENSIONS = ['tsx', 'ts', 'jsx', 'js'];

// Static showcase: no server code, no cookies, no third-party scripts. `next build` writes out/.
// The export applies to production builds only: in development the dev server (server.mjs) renders
// per request, so the dev toolbar can read the local-client header.
const config: NextConfig = {
  // `page.dev.tsx` files are routes in development only (src/app/branding: internal strategy, local
  // dev server). Production builds don't see them, so the route doesn't exist on Vercel.
  pageExtensions: [...DEFAULT_PAGE_EXTENSIONS, ...(process.env.NODE_ENV === 'production' ? [] : ['dev.tsx'])],
  ...(process.env.NODE_ENV === 'production' ? { output: 'export' as const } : {}),
  images: { unoptimized: true },
  transpilePackages: ['@cityturfer/brand', '@interdisciplinary/dev-toolbar'],
  reactStrictMode: true,
  // The portal's API client sends `CityTurfer-Client: web/<version>` (src/api/client.ts).
  env: { CITYTURFER_WEB_VERSION: pkg.version },
  poweredByHeader: false,
  // Dev only: the portless URL (`pnpm run web:dev` -> https://cityturfer.local), incl. worktree subdomains.
  allowedDevOrigins: ['cityturfer.local', '*.cityturfer.local'],
};

// next-intl: messages per locale (src/i18n/request.ts); routing in src/i18n/routing.ts.
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

export default withNextIntl(config);
