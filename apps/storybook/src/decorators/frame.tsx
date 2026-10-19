import { cssVariables, THEMES } from '@cityturfer/brand';
import { ThemeProvider } from '@cityturfer/ui';
import { NextIntlClientProvider } from 'next-intl';
import { type CSSProperties, useLayoutEffect } from 'react';

import { type FrameProps, MESSAGES } from './frame.constants';

/**
 * Wraps every story: the colour scheme for @cityturfer/ui (ThemeProvider), the design tokens as
 * CSS variables on <html> (as apps/web's layout sets them), and the website's messages for the
 * chosen language.
 */
export function Frame({ scheme, locale, web, children }: FrameProps) {
  const effective = web ? 'dark' : scheme;

  useLayoutEffect(() => {
    const root = document.documentElement;
    const vars = cssVariables(effective);
    for (const [name, value] of Object.entries(vars)) {
      root.style.setProperty(name, value);
    }
    root.lang = locale;
    document.body.style.background = THEMES[effective].bg;
  }, [effective, locale]);

  const style: CSSProperties = { background: THEMES[effective].bg, color: THEMES[effective].text, padding: 16 };
  return (
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone='Europe/Warsaw'>
      <ThemeProvider scheme={effective}>
        <div style={style}>{children}</div>
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}
