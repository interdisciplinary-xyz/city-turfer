import localFont from 'next/font/local';

/** The brand display face, self-hosted from @cityturfer/brand (no third-party request), as in apps/web. */
export const displayFont = localFont({
  src: '../../../../packages/brand/fonts/ArchivoExpanded-Black.woff2',
  display: 'swap',
  preload: true,
  fallback: ['-apple-system', 'BlinkMacSystemFont', 'Roboto', 'Arial', 'sans-serif'],
});
