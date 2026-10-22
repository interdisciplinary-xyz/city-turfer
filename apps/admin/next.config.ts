import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { withPayload } from '@payloadcms/next/withPayload';
import type { NextConfig } from 'next';

import { ROOT_REDIRECT, SECURITY_HEADER_SOURCE, securityHeaders } from './src/security-headers';

const dirname = path.dirname(fileURLToPath(import.meta.url));

const dev = process.env.NODE_ENV !== 'production';

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Plain TS source (tokens, copy) and SVG logos.
  transpilePackages: ['@cityturfer/brand'],
  // The hoisted node_modules live at the repo root.
  turbopack: { root: path.resolve(dirname, '../..') },
  // Dev only: the portless URL (`pnpm --filter @cityturfer/admin dev` -> https://admin.cityturfer.local).
  allowedDevOrigins: ['admin.cityturfer.local', '*.admin.cityturfer.local'],
  headers: async () => [{ source: SECURITY_HEADER_SOURCE, headers: securityHeaders(dev) }],
  redirects: async () => [ROOT_REDIRECT],
};

export default withPayload(config, { devBundleServerPackages: false });
