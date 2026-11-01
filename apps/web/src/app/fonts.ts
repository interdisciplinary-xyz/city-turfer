import localFont from 'next/font/local';

/**
 * Brand typefaces, self-hosted from @cityturfer/brand (no third-party request). The weight is part
 * of each font, so CSS uses them with `font-weight: normal` and `font-synthesis: none`.
 * Each exposes a CSS variable that globals.css puts in front of the brand `--font-family-*` stack.
 */
export const displayFont = localFont({
  src: '../../../../packages/brand/fonts/BigShouldersDisplay-Black.woff2',
  variable: '--face-display',
  display: 'swap',
  preload: true,
  fallback: ['-apple-system', 'BlinkMacSystemFont', 'Roboto', 'Arial', 'sans-serif'],
});

export const numericFont = localFont({
  src: '../../../../packages/brand/fonts/BarlowSemiCondensed-ExtraBold.woff2',
  variable: '--face-numeric',
  display: 'swap',
  preload: false,
  fallback: ['-apple-system', 'BlinkMacSystemFont', 'Roboto', 'Arial', 'sans-serif'],
});

/**
 * Body text on the web (the app uses the system font). Three static weights, no synthesis: the site's CSS
 * uses 400, 600 and 700 (and 800 for card titles, which maps to 700); nothing asks for 500, so Medium is
 * not shipped or preloaded (-27 KB). Next preloads every file of a font with `preload: true`; all three are
 * on the first screen (body, nav and chips, buttons).
 */
export const bodyFont = localFont({
  src: [
    { path: '../../../../packages/brand/fonts/Barlow-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../../../../packages/brand/fonts/Barlow-SemiBold.woff2', weight: '600', style: 'normal' },
    { path: '../../../../packages/brand/fonts/Barlow-Bold.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--face-body',
  display: 'swap',
  preload: true,
  fallback: ['-apple-system', 'BlinkMacSystemFont', 'Roboto', 'Arial', 'sans-serif'],
});

/** The hero tagline: Barlow Semi Condensed Black Italic, sentence case (TAGLINE_FONT_FAMILY). */
export const taglineFont = localFont({
  src: '../../../../packages/brand/fonts/BarlowSemiCondensed-BlackItalic.woff2',
  variable: '--face-tagline',
  display: 'swap',
  preload: true,
  fallback: ['-apple-system', 'BlinkMacSystemFont', 'Roboto', 'Arial', 'sans-serif'],
});
