import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

// Static showcase: no server code, no cookies, no third-party scripts. `next build` writes out/.
// The export applies to production builds only: in development the dev server (server.mjs) renders
// per request, so the dev toolbar can read the local-client header.
const config: NextConfig = {
  ...(process.env.NODE_ENV === 'production' ? { output: 'export' as const } : {}),
  images: { unoptimized: true },
  transpilePackages: ['@cityturfer/brand', '@interdisciplinary/dev-toolbar'],
  reactStrictMode: true,
  poweredByHeader: false,
  // Dev only: the portless URL (`pnpm run web:dev` -> https://cityturfer.local), incl. worktree subdomains.
  allowedDevOrigins: ['cityturfer.local', '*.cityturfer.local'],
};

// next-intl: messages per locale (src/i18n/request.ts); routing in src/i18n/routing.ts.
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

export default withNextIntl(config);
