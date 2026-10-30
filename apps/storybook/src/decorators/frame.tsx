import { cssVariables, DARK, SITE_SCHEME, THEMES, WEB_SCHEME } from '@cityturfer/brand';
import { ThemeProvider } from '@cityturfer/ui';
import { NextIntlClientProvider } from 'next-intl';
import { type CSSProperties, useLayoutEffect } from 'react';

import { PAGE_LOADED_CLASS, PAGE_LOADED_EVENT } from '../../../web/src/app/[locale]/page-loader/page-loader.constants';
import { type FrameProps, MESSAGES, type NightPanelProps } from './frame.constants';

/**
 * Wraps every story in its scheme (no theme switch): website stories in WEB_SCHEME (light, like
 * apps/web), every other story in SITE_SCHEME (dark, like the app). It sets the
 * palette for @cityturfer/ui (ThemeProvider), the design tokens as CSS variables on <html> (as
 * apps/web's layout sets them), and the website's messages for the chosen language.
 */
export function Frame({ locale, web, pageLoaded = true, children }: FrameProps) {
  const scheme = web ? WEB_SCHEME : SITE_SCHEME;
  const theme = THEMES[scheme];

  useLayoutEffect(() => {
    const root = document.documentElement;
    const vars = cssVariables(scheme);
    for (const [name, value] of Object.entries(vars)) {
      root.style.setProperty(name, value);
    }
    root.lang = locale;
    document.body.style.background = theme.bg;
  }, [locale, scheme, theme.bg]);

  // Storybook never runs the site's LOADER_BOOT_SCRIPT; without this the hero stays paused and hidden.
  useLayoutEffect(() => {
    // pageLoaded false: leave the class alone, the story (PageLoader) owns it.
    if (!web || !pageLoaded) {
      return;
    }
    const root = document.documentElement;
    root.classList.add(PAGE_LOADED_CLASS);
    window.dispatchEvent(new Event(PAGE_LOADED_EVENT));
    return () => root.classList.remove(PAGE_LOADED_CLASS);
  }, [web, pageLoaded]);

  const style: CSSProperties = { background: theme.bg, color: theme.text, padding: 16 };
  return (
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone='Europe/Warsaw'>
      <ThemeProvider scheme={scheme}>
        <div style={style}>{children}</div>
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}

/**
 * A night panel inside the page, for map pieces (Turf Map, a legend over a map): maps stay
 * dark everywhere, and the tier colours glow only on night. Everything inside gets the dark palette.
 */
export function NightPanel({ children }: NightPanelProps) {
  const style: CSSProperties = { background: DARK.bg, color: DARK.text, padding: 16, borderRadius: 16 };
  return (
    <ThemeProvider scheme='dark'>
      <div style={style}>{children}</div>
    </ThemeProvider>
  );
}
