import type { NextConfig } from 'next';

// Static showcase: no server code, no cookies, no third-party scripts. `next build` writes out/.
const config: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
  transpilePackages: ['@cityturfer/brand'],
  reactStrictMode: true,
  poweredByHeader: false,
  // Dev only: the portless URL (`pnpm run web:dev` -> https://cityturfer.local), incl. worktree subdomains.
  allowedDevOrigins: ['cityturfer.local', '*.cityturfer.local'],
};

export default config;
