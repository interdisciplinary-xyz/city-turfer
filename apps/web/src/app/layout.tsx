import './globals.css';

import { DARK, NAME, PROMO, TAGLINE, TIER_COLOR, TYPE_COLOR } from '@cityturfer/brand';
import mark from '@cityturfer/brand/svg/mark.svg';
import type { Metadata, Viewport } from 'next';
import type { CSSProperties, ReactNode } from 'react';

export const metadata: Metadata = {
  title: `${NAME} — ${TAGLINE}`,
  description: PROMO,
  icons: { icon: mark.src, apple: mark.src },
  openGraph: { title: NAME, description: PROMO, type: 'website' },
};

export const viewport: Viewport = { themeColor: DARK.bg, colorScheme: 'dark' };

/** Brand tokens from @cityturfer/brand as CSS variables, so globals.css never hard-codes a hex. */
const tokens = {
  '--night': DARK.bg,
  '--night-raised': DARK.card,
  '--text': DARK.text,
  '--muted': DARK.muted,
  '--border': DARK.border,
  '--faint': TIER_COLOR.faint,
  '--glow': TIER_COLOR.glowing,
  '--strong': TIER_COLOR.strong,
  '--blazing': TIER_COLOR.blazing,
  '--walk': TYPE_COLOR.walk,
  '--run': TYPE_COLOR.run,
  '--ride': TYPE_COLOR.cycle,
} as CSSProperties;

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Dev toolbar: development build + a request from this machine only. Both imports are dynamic
  // and sit inside the NODE_ENV branch, which the production build compiles to `if (false)` and
  // drops, so neither the package, the adapter nor its CSS reaches the static export.
  let devToolbar: ReactNode = null;
  if (process.env.NODE_ENV === 'development') {
    const { shouldRenderDevToolbar } = await import('@interdisciplinary/dev-toolbar/next');
    if (await shouldRenderDevToolbar()) {
      const { DevToolbarWithApp } = await import('./dev-toolbar-with-app');
      devToolbar = <DevToolbarWithApp />;
    }
  }

  return (
    <html lang='en' style={tokens}>
      <body>
        {children}
        {devToolbar}
      </body>
    </html>
  );
}
