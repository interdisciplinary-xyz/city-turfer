import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { withPayload } from '@payloadcms/next/withPayload';
import type { NextConfig } from 'next';

import { ADMIN_BASE_PATH } from './src/admin-path';
import { SECURITY_HEADER_SOURCE, securityHeaders } from './src/security-headers';

const dirname = path.dirname(fileURLToPath(import.meta.url));

const dev = process.env.NODE_ENV !== 'production';

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Plain TS source (tokens, copy) and SVG logos.
  transpilePackages: ['@cityturfer/brand'],
  // The hoisted node_modules live at the repo root.
  turbopack: { root: path.resolve(dirname, '../..') },
  // Everything under /admin (src/admin-path.ts): the panel is the basePath's root.
  basePath: ADMIN_BASE_PATH,
  // Dev only: the website's dev server proxies https://cityturfer.local/admin here.
  allowedDevOrigins: ['cityturfer.local', '*.cityturfer.local'],
  headers: async () => [{ source: SECURITY_HEADER_SOURCE, headers: securityHeaders(dev) }],
};

export default withPayload(config, { devBundleServerPackages: false });
