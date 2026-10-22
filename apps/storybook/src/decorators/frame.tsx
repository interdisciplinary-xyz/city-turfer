import { cssVariables, THEMES } from '@cityturfer/brand';
import { ThemeProvider } from '@cityturfer/ui';
import { NextIntlClientProvider } from 'next-intl';
import { type CSSProperties, useLayoutEffect } from 'react';

import { PAGE_LOADED_CLASS, PAGE_LOADED_EVENT } from '../../../web/src/app/[locale]/page-loader/page-loader.constants';
import { type FrameProps, MESSAGES } from './frame.constants';

/**
 * Wraps every story: the colour scheme for @cityturfer/ui (ThemeProvider), the design tokens as
 * CSS variables on <html> (as apps/web's layout sets them), and the website's messages for the
 * chosen language.
 */
export function Frame({ scheme, locale, web, pageLoaded = true, children }: FrameProps) {
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

  // Storybook never runs the site's LOADER_BOOT_SCRIPT; without this the hero stays paused and hidden.
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (!web || !pageLoaded) {
      root.classList.remove(PAGE_LOADED_CLASS);
      return;
    }
    root.classList.add(PAGE_LOADED_CLASS);
    window.dispatchEvent(new Event(PAGE_LOADED_EVENT));
  }, [web, pageLoaded]);

  const style: CSSProperties = { background: THEMES[effective].bg, color: THEMES[effective].text, padding: 16 };
  return (
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone='Europe/Warsaw'>
      <ThemeProvider scheme={effective}>
        <div style={style}>{children}</div>
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}
