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
summary: >-
  The website and portal go light (WEB_SCHEME = 'light', day wordmark, white header via
  HEADER_SCHEME) so the app's dark screens stand out; the hero phones keep the app's dark scheme
  (APP_SCHEME), and so does every turf piece (legend, gain, dashboard, Record disc: night panels);
  Swagger, Storybook and the app stay on SITE_SCHEME (dark). Narrows brand-dark-site-2026-10-25 to
  those surfaces. Status proposed; merging the PR that carries it accepts it.
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
  looks the same on the light site and on the dark dev pages (Swagger, Storybook) that reuse it: the
  dev header (`apps/web/tools/app-header-assets.mjs`) brings no variables of its own and is opaque
  `var(--card)`, white. The portal header is white too.
- **`APP_SCHEME` is `'dark'`**: coded prototypes of app screens (the hero phones) scope the dark
  variables to themselves (`PHONE_VARIABLES` in `hero-screens.constants.ts`), so they look like the
  app. The sections below the hero, written in the app's pieces, follow the page (light cards),
  except every piece that draws turf tiers: the TurfLegend, the gain card, the dashboard card, the
  Record disc and any similar mock-up are **night panels** (`APP_VARIABLES` in
  `home-sections.constants.ts`, same mechanism as `PHONE_VARIABLES`). On the light page strong is
  1.8:1 and blazing 1.1:1, so the brightest tier would vanish. The Record dot is white on pink, as
  in the app.
- **`SITE_SCHEME` stays `'dark'`** for Swagger, Storybook's UI, app component stories and the
  internal `/branding` page. Website stories render in `WEB_SCHEME`
  (`apps/storybook/src/decorators/frame.tsx`).
- The day wordmark is used by the hero, the header and the portal header.

## Consequences

- **Merging this PR accepts the decision** (the file stays `proposed` until the founder flips it).
  The same PR updates the rulebook: `CLAUDE.md` (Web bullet), the skills `brand-system` (source of
  truth, the four scheme constants table, logo, checklist), `brand-surfaces`, `web-motion`,
  `design-system`, the `brand-designer` agent, `brand-foundations-2026-10-20.md`,
  `brand-dark-site-2026-10-25.md` (website and portal part superseded, banner and summary; it stays
  `canonical` because it still holds for Swagger, Storybook and the app), the `SITE_SCHEME`, `LIGHT`
  and `DARK` doc comments, `tools/brand/surfaces.mjs` (`scheme: 'web'` for web and portal) and
  `tools/brand-audit.mjs` (knows `WEB_SCHEME`, `HEADER_SCHEME`, `APP_SCHEME`).
- Contrast: `packages/brand/src/__tests__/contrast.test.ts` reads `WEB_SCHEME`, `APP_SCHEME` and
  `SITE_SCHEME` separately. The pink button hover mixes toward `--blazing` (about 6.1:1 in all
  three; toward `--text` it was 4.29:1 on light).
- `SITE_SCHEME` keeps its name although it no longer means "the site"; renaming it (for example
  `TOOLS_SCHEME`) is left to the founder. The brand-system skill documents the four constants.
- The social image `apps/web/public/og-image.png` stays the dark artwork (founder's call).
- `apps/web/tools/__tests__/site-theme.test.mjs` pins the scheme names, the light colour scheme, the
  dark phones and the day wordmark.
- Open: the page background is the light theme's `bg` (`#F6F7FB`, a cool off-white), with white
  cards and header; a pure white page would need the cards to rely on borders alone.
