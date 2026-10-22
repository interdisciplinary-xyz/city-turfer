import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { withPayload } from '@payloadcms/next/withPayload';
import type { NextConfig } from 'next';

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Staff only: nothing here is for search engines or for framing by another site.
const SECURITY_HEADERS = [
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
];

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Plain TS source (tokens, copy) and SVG logos.
  transpilePackages: ['@cityturfer/brand'],
  // The hoisted node_modules live at the repo root.
  turbopack: { root: path.resolve(dirname, '../..') },
  // Dev only: the portless URL (`pnpm --filter @cityturfer/admin dev` -> https://admin.cityturfer.local).
  allowedDevOrigins: ['admin.cityturfer.local', '*.admin.cityturfer.local'],
  headers: async () => [{ source: '/:path*', headers: SECURITY_HEADERS }],
  // Admin is the whole app: the root goes to the panel.
  redirects: async () => [{ source: '/', destination: '/admin', permanent: false }],
};

export default withPayload(config, { devBundleServerPackages: false });
