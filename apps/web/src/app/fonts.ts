import localFont from 'next/font/local';

/**
 * Brand typefaces, self-hosted from @cityturfer/brand (no third-party request). The weight is part
 * of each font, so CSS uses them with `font-weight: normal` and `font-synthesis: none`.
 * Each exposes a CSS variable that globals.css puts in front of the brand `--font-family-*` stack.
 */
export const displayFont = localFont({
  src: '../../../../packages/brand/fonts/ArchivoExpanded-Black.woff2',
  variable: '--face-display',
  display: 'swap',
  preload: true,
  fallback: ['-apple-system', 'BlinkMacSystemFont', 'Roboto', 'Arial', 'sans-serif'],
});

export const numericFont = localFont({
  src: '../../../../packages/brand/fonts/Archivo-ExtraBold.woff2',
  variable: '--face-numeric',
  display: 'swap',
  preload: false,
  fallback: ['-apple-system', 'BlinkMacSystemFont', 'Roboto', 'Arial', 'sans-serif'],
});
