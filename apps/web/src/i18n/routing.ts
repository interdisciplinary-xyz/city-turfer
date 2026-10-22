import { defineRouting } from 'next-intl/routing';

/**
 * Landing page languages. Every locale is a URL prefix (`/en`, `/pl`): the site is a static export,
 * so there is no middleware to negotiate the language; `/` redirects to the default, and Vercel
 * sends Polish browsers to `/pl` (vercel.json). Add a language here + `messages/<locale>.json`.
 */
export const routing = defineRouting({
  locales: ['en', 'pl'],
  defaultLocale: 'en',
  localePrefix: 'always',
  // No NEXT_LOCALE cookie when the visitor switches language: the site sets no cookies (nothing
  // reads it anyway: the static export has no middleware), and the portal's only cookie is the session.
  localeCookie: false,
});

export type Locale = (typeof routing.locales)[number];
