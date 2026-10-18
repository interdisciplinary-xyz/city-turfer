/**
 * The site's absolute origin, for the sitemap. The domain is still open, so: an explicit
 * NEXT_PUBLIC_SITE_URL, else Vercel's production URL (set at build time on Vercel), else local.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:3000');
