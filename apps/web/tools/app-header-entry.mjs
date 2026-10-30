// Dev only: bundled by app-header-assets.mjs into the script the local Storybook and Swagger pages
// load. Renders the site's header (the same AppHeaderView as /en and /branding, light like the
// website) into #app-header-root. The pages are English, so: EN marked, PL links to the Polish home
// page.
import mark from '@cityturfer/brand/svg/mark.svg';
import wordmark from '@cityturfer/brand/svg/wordmark-light.svg';
import { createElement as h, Fragment } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

import en from '../messages/en.json';
import { AppHeaderView } from '../src/app/[locale]/app-header/app-header-view';
import { WAITLIST } from '../src/app/waitlist-config';

const LOCALE = 'en';
const LOCALES = ['en', 'pl'];

/** Same markup as language-switcher.tsx, with plain links (no next-intl outside Next). */
const languages = h(
  'nav',
  { 'aria-label': en.language.label, className: 'lang' },
  LOCALES.map((l) =>
    l === LOCALE
      ? h('span', { key: l, 'aria-current': 'true', lang: l }, l.toUpperCase())
      : h('a', { key: l, href: `/${l}`, lang: l, hrefLang: l, 'aria-label': en.language[l] }, l.toUpperCase())
  )
);

const host = document.getElementById('app-header-root');
if (host) {
  const root = createRoot(host);
  // Synchronously, so the bar is there on first paint.
  flushSync(() => {
    root.render(
      h(AppHeaderView, {
        homeHref: `/${LOCALE}`,
        homeLabel: en.header.home,
        logo: h(
          Fragment,
          null,
          h('img', { className: 'app-header-mark', src: mark, alt: '', width: 32, height: 32 }),
          h('img', { className: 'app-header-wordmark', src: wordmark, alt: '', width: 90, height: 20 })
        ),
        waitlist: WAITLIST
          ? { href: `/${LOCALE}#waitlist`, label: en.header.waitlist, shortLabel: en.header.waitlistShort }
          : null,
        languages,
      })
    );
  });
}
