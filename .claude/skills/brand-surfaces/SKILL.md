---
name: brand-surfaces
description: >-
  One brand across the app, website, portal, Swagger, Storybook and assets: the surface map, who
  owns each, audit:brand, brand:snapshot, known drift. Use for "unify the branding", "Swagger looks
  different", "make X match the app", or a brand change that touches more than one surface.
---

# Brand surfaces

What the brand **is** (name, voice, colours, type, logo) is the `brand-system` skill; how tokens
reach code is the `design-system` skill. This skill is about keeping every place a person sees
CityTurfer in step with `packages/brand`, and about changing several surfaces at once.

## The map

`tools/brand/surfaces.mjs` lists every surface: scheme, owner agent, status and the files that carry
its theme, fonts, logo and copy. It is the source; this table is a summary. `site` means the surface
follows `SITE_SCHEME`: dark since v0.12.0, the app's palette (the app is the source of truth,
`docs/decisions/brand-dark-site-2026-10-25.md`). `both` means the host switches schemes itself and
the surface maps both (the admin follows Payload's own light/dark toggle). brand-designer keeps the
map and the known drift; the audit and snapshot code is harness-engineer's.

| Surface       | Scheme | Owner                | Brand comes in through                                                                 |
| ------------- | ------ | -------------------- | -------------------------------------------------------------------------------------- |
| `mobile`      | dark   | `mobile-ui-engineer` | `usePalette()` + `@cityturfer/ui`; fonts and icons are native (`apps/mobile/app.json`) |
| `web`         | site   | `web-engineer`       | `cssVariables(SITE_SCHEME)` in the layout, `next/font` (`apps/web/src/app/fonts.ts`)   |
| `portal`      | site   | `portal-engineer`    | the website's variables and fonts, plus `account/portal.css`                           |
| `branding`    | site   | `brand-designer`     | `/branding`, dev only: the living brand book                                           |
| `swagger-dev` | site   | `web-engineer`       | `apps/web/tools/swagger-brand.mjs` + `swagger-theme.css` (dev page)                    |
| `swagger-api` | site   | `api-engineer`       | nothing yet: stock `@hono/swagger-ui` (`apps/api/src/app.ts`)                          |
| `storybook`   | site   | `mobile-ui-engineer` | `.storybook/theme.ts` from tokens; `@font-face` by hand in `*-head.html`               |
| `assets`      | dark   | `brand-designer`     | `packages/brand/templates` + `render-assets.mjs` (icon, splash, OG, store shots)       |
| `admin`       | both   | `brand-designer`     | paused: `apps/admin/src/brand/` maps tokens onto Payload's two schemes                 |

A new surface (a page, a tool UI, an e-mail) gets an entry in the manifest in the same PR; the audit
then checks it.

## The tools

```bash
pnpm run audit:brand                      # in ci:quality: errors fail, warnings and known drift are listed
pnpm run audit:brand -- --json            # findings for a plan or a script
pnpm run brand:snapshot                   # every surface with a URL, phone + desktop, plus the booted simulator
pnpm run brand:snapshot -- --only web,swagger-api --out <dir>
```

- **audit:brand** (`tools/brand-audit.mjs`) checks the mechanical rules: brand colours as hex
  (`#RRGGBB` and `#RRGGBBAA`) or `rgb()` channels (comma or space syntax) outside `packages/brand`,
  a scheme picked by name (`cssVariables('light')`, `THEMES.dark`, and in site code the `DARK` /
  `LIGHT` palettes imported directly), `@font-face` families and files that aren't the brand's, the
  name's spelling (the old product name included), "territory", "score", "points" and "conquer" in
  English catalogues, drifted logo copies, and the manifest itself (files exist, owners are agents,
  and every theme file of a `site` or `both` surface draws from the brand in its code, not in a
  comment, or imports a theme file of the same surface).
- **Known drift** (`tools/brand/known-drift.mjs`): accepted findings, each with a reason and a
  `count` (default 1); `todo: true` marks what the plan should fix. One occurrence more than the
  count is an error, and so is an entry matching fewer: fixing one means lowering the count or
  deleting the entry, so the list can't hide a regression.
- **brand:snapshot** (`tools/brand/snapshot.mjs`) writes PNGs and a neutral `index.html` contact
  sheet to a temp folder, one subfolder per surface, `<path>-<w>x<h>-reduced.png` (every still uses
  reduced motion). Reusing `--out` is safe: each run first deletes the stills it replaces in a
  surface's folder (only names the tool writes). It needs `pnpm run web:dev` (and a Storybook static
  build for `/storybook`) and the API on :8787. Pages that refuse frames (the API sends
  `X-Frame-Options`) are captured directly, at least 500 px wide. Surfaces that don't answer are
  skipped, never shot as error pages. App screenshots can show routes: keep them local, never commit
  or upload them.

## Changing the brand across surfaces

1. **Token first.** A new value goes into `packages/brand` (`colors.ts`, `tokens.ts`, `copy.ts`)
   with its contrast pair in `contrast.test.ts` (brand-designer). Every surface then reads it: CSS
   variables via `cssVariables()`, RN via `usePalette()` and the token exports, Swagger and
   Storybook from the same module. Never restate it per surface.
2. **One owner per surface.** Hand each surface to its owner from the map; a change spanning many
   starts with rn-architect only when it also crosses the app and the API.
3. **Before and after.** `pnpm run brand:snapshot -- --out <before>` on the base, then again on the
   branch; compare the two contact sheets. Every surface must look like one family with the app.
4. **Gate.** `pnpm run audit:brand`, `pnpm --filter @cityturfer/brand test:unit`, then the owners'
   checks (the `verify-change` skill). A Storybook or packages/ui change: check the fingerprint (the
   `design-system` skill).
5. **OTA vs native.** Web, Swagger, Storybook and JS in the app ship without a reinstall; fonts,
   icons, splash and `app.json` colours are native and change the runtime fingerprint.

## What the audit can't see

Use the contact sheet for these: display text in capitals with `DISPLAY_TRACKING` on every surface,
one primary-button look per scheme, the same label tracking, focus rings in `accentText`, the full
Ramp where the app draws it, titles in the same format, and the app next to the portal showing the
same concepts (stat tiles, activity rows, type colours, tier legend) the same way. `@cityturfer/ui`
renders on the web only inside Storybook, so the website shares tokens and a spec with the app, not
components.

## Where we are

The first inventory (2026-10-25) is `docs/quality/brand-inventory-2026-10-25.md`; the plan builds on
it.
