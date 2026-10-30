---
status: proposed
verified: 2026-10-29
owner: founder
scope:
  [
    packages/brand/src/tokens.ts,
    'apps/web/src/app/[locale]',
    apps/web/src/app/globals.css,
    apps/storybook/src/decorators,
  ]
summary:
  The website and portal go light (WEB_SCHEME = 'light', day wordmark, white header via
  HEADER_SCHEME) so the app's dark screens stand out; the hero phones keep the app's dark scheme
  (APP_SCHEME); Swagger, Storybook and the app stay on SITE_SCHEME (dark). Narrows
  brand-dark-site-2026-10-25 to those surfaces.
---

# Light website, dark app screens (v0.14.0)

## Decision

The founder asked (2026-10-29) for a white header with dark text, then for the whole website to be
light, "to expose the prototype screens more". The dark app screens on the landing page read as the
product when the page around them is light.

- **`WEB_SCHEME` is `'light'`** (`packages/brand/src/tokens.ts`): the landing page and the signed-in
  portal (`apps/web/src/app/[locale]/layout.tsx` sets `cssVariables(WEB_SCHEME)`, `themeColor` and
  `colorScheme`; `globals.css` declares `color-scheme: light`). The palette is the existing `LIGHT`
  (light since v0.10.0 until 2026-10-25, so every component already has AA light values).
- **`HEADER_SCHEME` is `'light'`**: the sticky header scopes the light variables to itself and its
  bar is the light card colour (`#FFFFFF`), solid, with the day wordmark (`wordmark-light.svg`). It
  looks the same on the light site and on the dark dev pages (Swagger, Storybook) that reuse it.
- **`APP_SCHEME` is `'dark'`**: coded prototypes of app screens (the hero phones) scope the dark
  variables to themselves (`PHONE_VARIABLES` in `hero-screens.constants.ts`), so they look like the
  app. The sections below the hero, written in the app's pieces, follow the page (light cards).
- **`SITE_SCHEME` stays `'dark'`** for Swagger, Storybook's UI, app component stories and the
  internal `/branding` page. Website stories render in `WEB_SCHEME`
  (`apps/storybook/src/decorators/frame.tsx`).
- The day wordmark is used by the hero, the header and the portal header.

## Consequences

- `docs/decisions/brand-dark-site-2026-10-25.md` still holds for Swagger, Storybook and the app; its
  website part is replaced here once this is accepted.
- `apps/web/tools/__tests__/site-theme.test.mjs` pins the scheme names, the light colour scheme, the
  dark phones and the day wordmark.
- Open: the page background is the light theme's `bg` (`#F6F7FB`, a cool off-white), with white
  cards and header; a pure white page would need the cards to rely on borders alone.
