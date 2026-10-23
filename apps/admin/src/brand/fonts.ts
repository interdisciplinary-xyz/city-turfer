import localFont from 'next/font/local';

/** Brand typefaces, self-hosted from @cityturfer/brand (no third-party request), as in apps/web. */
export const displayFont = localFont({
  src: '../../../../packages/brand/fonts/BigShouldersDisplay-Black.woff2',
  display: 'swap',
  preload: true,
  fallback: ['-apple-system', 'BlinkMacSystemFont', 'Roboto', 'Arial', 'sans-serif'],
});

/** Body text, as on the website: four static weights, no synthesis. */
export const bodyFont = localFont({
  src: [
    { path: '../../../../packages/brand/fonts/Barlow-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../../../../packages/brand/fonts/Barlow-Medium.woff2', weight: '500', style: 'normal' },
    { path: '../../../../packages/brand/fonts/Barlow-SemiBold.woff2', weight: '600', style: 'normal' },
    { path: '../../../../packages/brand/fonts/Barlow-Bold.woff2', weight: '700', style: 'normal' },
  ],
  display: 'swap',
  preload: true,
  fallback: ['-apple-system', 'BlinkMacSystemFont', 'Roboto', 'Arial', 'sans-serif'],
});
