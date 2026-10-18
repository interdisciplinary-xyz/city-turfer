import type { MetadataRoute } from 'next';

import { SITE_URL } from './site-url';

// Static export: generated once at build time.
export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${SITE_URL}/`, changeFrequency: 'monthly', priority: 1 }];
}
