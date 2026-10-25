---
status: proposed
verified: 2026-10-25
owner: founder
scope:
  [
    tools/brand,
    tools/brand-audit.mjs,
    packages/brand,
    apps/web,
    apps/api/src/app.ts,
    apps/storybook/.storybook,
    apps/mobile/src,
  ]
summary:
  Where the app, website, portal, Swagger, Storybook and assets diverge from packages/brand and from
  each other on 2026-10-25; the input for the branding unification plan, ranked
---

# Brand inventory (2026-10-25)

Input for the branding unification plan. Made on `scope/v0.12.0` by brand-designer (read-only), from
`pnpm run audit:brand` and from `pnpm run brand:snapshot`. The surfaces and tools are described in
the `brand-surfaces` skill. Line numbers are from that day; check them again before acting.

**Clean already:**

- every logo comes from `packages/brand/svg`, in the right light or dark variant;
- no brand hex outside `packages/brand` (only `apps/mobile/app.json`, which can't import);
- no misspelt name and no "territory" in English UI; Polish says "terytorium" in the app and on the
  site;
- the app's display text uses `DISPLAY_CASE` and `DISPLAY_TRACKING`.

## High

1. **Swagger served by the API is unbranded.** `apps/api/src/app.ts` calls `swaggerUI({ title })`
   with its defaults:
   - no brand variables, skin, fonts, favicon or wordmark;
   - assets load unpinned from a CDN (`@hono/swagger-ui` 0.6.1), while dev serves pinned local
     `swagger-ui-dist`;
   - the only thing it shares with the dev page is `SWAGGER_UI_OPTIONS` (`apps/api/src/spec.ts`).

   Direction: serve the dev skin and markup from the API, with self-hosted, pinned assets.

2. **Portal headings are not in display case.** `apps/web/src/app/[locale]/account/portal.css`:
   `.portal-title` and `.portal-card-title` have no `var(--display-case)` /
   `var(--display-tracking)`, and `.portal-month-title` uses `capitalize`. Direction: one shared
   display-heading rule.
3. **The Turf Map heatmap hard-codes the faint tier with alpha.**
   `apps/mobile/src/contexts/territory/ui/layers.tsx` uses `rgba(123,47,247,0.55)`. Known drift in
   `tools/brand/known-drift.mjs`. Direction: a brand helper for a token with alpha.
4. **Three primary buttons.**
   - The app `Button` (`packages/ui/src/button/button.tsx`): pink, `RADIUS.control`.
   - The landing store button: a pink pill (`999px`) with a glow.
   - The portal primary: a black pill.

   Direction: one primary-button spec per scheme.

5. **Two ramps on light surfaces.**
   - The site's `--ramp` (`apps/web/src/app/globals.css`, repeated in the branding CSS) runs faint →
     accent-text.
   - The Swagger skin (`apps/web/tools/swagger-theme.css`) uses the full `--ramp-stops`, blazing
     included.

   Direction: a light-ramp token in `cssVariables()`.

## Medium

6. **Fonts are loaded five ways:** `next/font` on the web and in admin, hand-written `@font-face` in
   Storybook's head files and in the Swagger skin, and the templates.
   - Storybook's manager head lacks Barlow Medium.
   - Storybook and Swagger lack the tagline face, so hero stories show a fallback.

   Direction: generate the `@font-face` CSS from brand.

7. **Family stacks and the mono stack are restated** in CSS (`globals.css`, the branding page, the
   app header, Storybook's `theme.ts`, the Swagger skin). There is no mono token.
8. **Size and radius literals:**
   - Storybook `appBorderRadius: 12` (not a `RADIUS` value);
   - `999px` instead of `--radius-full`;
   - body text 17 px on the site and 16 px in Swagger;
   - the mark corner radius (23 % on the web, 8 px in Storybook);
   - about 80 `fontSize` / `borderRadius` numbers in the app.
9. **Label tracking** on the web uses `em` values, not `LABEL_TRACKING`, and one hero line has
   negative tracking.
10. **Focus rings differ:** Swagger uses raw glow on light; the site and portal use accent-text or
    text.
11. **`packages/brand/src/copy.ts` is mostly unused.**
    - The taglines and promo are restated in the web and app catalogues, and the tier labels in the
      app catalogue.
    - Decide which is the source and which is checked.
12. **Page titles differ by surface:**
    - "CityTurfer — …" on the landing page, "… — CityTurfer" in the portal, "Branding · CityTurfer"
      on the brand page;
    - "CityTurfer API" written in three places, and "CityTurfer design system" for Storybook.
13. **The dev Swagger shows the logo twice:** the site header and the `ct-header` (seen on the
    snapshot). Its tagline is English only.
14. **Activity rows and totals look different in the portal and in the app.** Share a spec and
    tokens; `packages/ui` can't render on the website.
15. **The Apple touch icon is an SVG** (`apps/web/src/app/[locale]/layout.tsx`). iOS ignores SVG
    touch icons. Not checked against current Apple docs.

## Low

16. `apps/mobile/app.json` repeats `DARK.bg`. A check against the token would do.
17. The social image template is dark while the site is light. It may be right under the night-panel
    rule; it needs eyes.
18. Showcase stories use literal sizes, and the typography story lacks the tagline face.
19. The OpenAPI tag "Territory" is developer-facing, which is acceptable. The store keyword
    "territory" is on purpose.
20. Admin (paused) is already wired to brand. Only the title separator and its duplicate font loader
    are left.

## Docs drift

- The brand-system skill and `docs/decisions/brand-light-theme-2026-10-22.md` said Swagger uses
  `cssVariables(SITE_SCHEME)`. Only the dev page does.
- The design-system skill's story folders miss `portal/`.
- `apps/web/tools/app-header-assets.mjs` mentions a dark Swagger skin.
- `copy.ts` claims it is shared by the app and the site.

## Candidates for audit:brand rules

These come after the plan decides:

- px or em literals where a token exists, and `999px`;
- display-face rules without display case and tracking;
- every face a surface's CSS uses must be loaded there;
- `--ramp-stops` and raw fills as text, lines or outlines on light;
- taglines and promo out of sync with `copy.ts`;
- one page-title format;
- `app.json` colours equal to tokens;
- the API's Swagger HTML carries the skin and no CDN URLs.
