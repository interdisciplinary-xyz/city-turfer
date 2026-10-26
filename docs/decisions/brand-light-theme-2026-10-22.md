---
status: superseded
verified: 2026-10-25
owner: founder
scope: [packages/brand/src, packages/brand/svg]
summary:
  Superseded by brand-dark-site-2026-10-25.md (the site is dark again, like the app). The website,
  Swagger and Storybook switch to a light theme (SITE_SCHEME) while the app and every map stay dark;
  the AA light palette, its new tokens and ratios, night labels on pink buttons
---

# Light theme for the website (v0.10.0)

> **Superseded (2026-10-25):** the founder made the app the source of truth, and the website,
> portal, Swagger and Storybook went back to dark (`SITE_SCHEME = 'dark'`):
> `docs/decisions/brand-dark-site-2026-10-25.md`. The `LIGHT` palette below still exists (the
> admin's light mode). Kept as the record of v0.10.0–v0.11.0.

## Decision

The founder approved moving the **website, Swagger and Storybook from dark to light**. There is no
theme switch: each surface has one scheme.

- **The app stays dark.** `DARK`, `THEMES.dark`, `TIER_COLOR`, `TYPE_COLOR`, `ON_ACCENT` and
  `ON_TIER` keep their values. The app reads them at runtime, so any change would reach phones over
  OTA; `packages/brand/src/__tests__/tokens.test.ts` pins them, and pins every CSS variable
  `cssVariables('dark')` emitted before this change.
- **Maps stay on night.** The Turf Map, route maps and any map image on the website sit on a night
  panel (`DARK.bg` / `DARK.card`), even inside a light page. The tier colours glow on night and only
  there.
- **`SITE_SCHEME`** (`packages/brand/src/tokens.ts`, `'light'`) is the one place that says which
  scheme the website, Swagger and Storybook use. They call `cssVariables(SITE_SCHEME)`; nothing else
  names a scheme for them. The app ignores it.

This supersedes the "website is dark" parts of `docs/decisions/brand-foundations-2026-10-20.md` and
closes its open light-theme contrast fixes.

## The light palette

The brand fills (glow, strong, the activity colours) are tuned to glow on night and fail on white.
Rather than darken the brand, the light theme gets its own **text** and **graphic** variants, and
the fill stays the same everywhere. `Palette` is shared by both themes, so every new key also exists
in `DARK`, set to the dark value already in use (nothing in the app changes).

Ratios are WCAG 2.2, computed with `contrastRatio()` (`packages/brand/src/contrast.ts`) against
`LIGHT.bg` `#F6F7FB` / `LIGHT.card` `#FFFFFF`. Text needs 4.5:1; graphics and UI edges 3:1.

| Token (`LIGHT.`)               | CSS                | Light     | Ratio bg / card  | `DARK` value          | Use                                   |
| ------------------------------ | ------------------ | --------- | ---------------- | --------------------- | ------------------------------------- |
| `muted` (changed)              | `--muted`          | `#5A6375` | 5.6 / 6.0        | `#9AA3B5` (unchanged) | Secondary text                        |
| `danger` (changed)             | `--danger`         | `#C92A33` | 5.1 / 5.4        | `#FF6369` (unchanged) | Errors as text; white label 5.4:1     |
| `accentText`                   | `--accent-text`    | `#C2127F` | 5.3 / 5.7        | `#F72FA8` (glow)      | Links and pink text                   |
| `onAccent`                     | `--on-accent`      | `#0B0D12` | 5.5 on glow      | `#FFFFFF`             | Label on a glow fill (pink buttons)   |
| `borderControl`                | `--border-control` | `#848DA0` | 3.1 / 3.3        | `#9AA3B5` (7.7 / 6.9) | Edges of inputs and buttons           |
| `strongText`                   | `--strong-text`    | `#9A5B00` | 5.1 / 5.4        | `#FFB02E` (strong)    | The strong tier as text               |
| `walkText`                     | `--walk-text`      | `#0F7A4F` | 5.0 / 5.4        | `#2BD48B` (walk)      | Walk as text                          |
| `runText`                      | `--run-text`       | `#B84E0A` | 4.8 / 5.1        | `#FF8A3D` (run)       | Run as text                           |
| `cycleText`                    | `--ride-text`      | `#0B6FA8` | 5.1 / 5.5        | `#3DB8FF` (ride)      | Ride as text                          |
| `walkGraphic`                  | `--walk-graphic`   | `#169E63` | 3.2 / 3.4        | `#2BD48B` (walk)      | Walk lines, icons, dots               |
| `runGraphic`                   | `--run-graphic`    | `#E0661A` | 3.2 / 3.5        | `#FF8A3D` (run)       | Run lines, icons, dots                |
| `cycleGraphic`                 | `--ride-graphic`   | `#1C8FD6` | 3.3 / 3.5        | `#3DB8FF` (ride)      | Ride lines, icons, dots               |
| `bg`, `card`, `text`, `border` | unchanged          |           | text 17.7 / 18.9 |                       | `border` stays for hairlines/dividers |

`--on-glow` follows `onAccent` (night on light, white on dark). The raw fills `--accent`, `--glow`,
`--strong`, `--walk`, `--run`, `--ride` are the same in both schemes: on a light surface use them
only as fills, and draw text and lines through the `-text` / `-graphic` variants. The code says
`cycle`, the CSS and the UI say `ride`, as everywhere else.

`packages/brand/src/__tests__/contrast.test.ts` checks every pair above. Its `KNOWN_FAILURES` still
lists the raw fills on light surfaces (glow 3.3–3.5:1, activity colours 1.8–2.4:1) so nobody uses
them there by mistake, plus the two app-side pairs below.

## Pink buttons: night label, same pink

The accent fill stays `#F72FA8` (the brand glow). On light, its label is **night** (`#0B0D12`,
5.5:1), not white (3.5:1, an AA fail). A deeper pink with a white label (`#C8137F`) was the other
option; the founder chose to keep the glow itself. The app keeps its white label for now
(`ON_ACCENT`; a known failure, unchanged so the app does not shift), as do the glow tier chip
(`ON_TIER.glowing`) and the white label on the dark danger fill.

## Wordmark

`packages/brand/svg/wordmark-light.svg` on light surfaces ("CITY" night 18:1, "TURFER" faint 5.5:1 →
glow 3.3:1, display size so 3:1 applies); `packages/brand/svg/wordmark.svg` on night panels,
including maps embedded in a light page. Both stay generated by
`packages/brand/scripts/outline-wordmark.py`.

## Follows later

- The website, Swagger skin and Storybook adopt `SITE_SCHEME` on their own branches (they read the
  variables above; no hex in either app). Done in v0.10.0: `apps/web/src/app/globals.css`,
  `apps/api/src/spec.ts`, `apps/storybook/.storybook/preview.tsx`.
- The OG image (`packages/brand/templates/og-image.html`) and the store screenshots
  (`packages/brand/templates/store-screenshot.html`) stay dark until they are redesigned; store
  screenshots show the app, which is dark.
- The `brand-system` skill's colour table gains these tokens with the harness branch. Done.
