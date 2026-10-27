---
name: brand-system
description: >-
  Use for "is this on-brand?", user-facing copy, a colour or font, restyling a screen, app icon,
  splash, store listing, screenshots or social image. CityTurfer name, voice, colour tokens (turf
  ramp), typefaces (Big Shoulders Display, Barlow; Anton wordmark), logo, WCAG contrast,
  render-assets.mjs.
---

# CityTurfer brand system

**CityTurfer** — _Surf your city. Own your streets._ Every walk, run and ride claims the streets you
cover; the turf glows brighter the more often you come back, and it's yours for good.

Why the brand is shaped this way (positioning, personality, typeface choice, contrast fixes):
`docs/decisions/brand-foundations-2026-10-20.md`; the dark website, like the app:
`docs/decisions/brand-dark-site-2026-10-25.md`.

## Positioning

One promise for three audiences: **city explorers** (collect your city street by street), **runners
and cyclists** (variety, a reason for new routes), **everyday movers** (a quiet reward for walks and
commutes). Copy speaks to all three; a channel may lead with one. Against performance trackers
(Strava, Garmin) we don't rank anyone; against street-completion apps (CityStrides, Wandrer) we
reward coming back, not only ticking off new streets; and routes stay on the phone.

Pillars: **Your streets** (ownership is permanent) · **The glow** (repetition is rewarded, visibly)
· **Yours alone** (local-first, no tracking).

## Name

- **Do:** write **CityTurfer** (one word, two capitals). **Don't:** Cityturfer, City Turfer,
  CITYTURFER, City-Turfer.
- **Do:** say "your turf", "claim", "glow", "streets you own". **Don't:** "territory" (internal/code
  term only), "score", "points", "conquer" (too aggressive).
- Users are **Turfers**. Their claimed area is **turf**; one hexagon is a **cell**.
- **Polish:** turf is **terytorium** (founder decision, 2026-10-24: "Twoje terytorium", "Mapa
  terytorium"); the "territory" ban above is for English only. Glossary in the `mobile-i18n` skill.
- Use the ubiquitous language from `docs/poc-plan.md` §2 in UI copy (Walk / Run / Ride, Turf, Cell,
  Strength tiers). The UI says **Ride**; code, tokens and data say `cycle` (`TYPE_COLOR.cycle`, CSS
  `--ride`). Change the label, never the identifier.
- Internal identifiers stay as they are: bundle id `com.turftrack.poc`, Expo slug `turftrack`
  (changing them breaks installs, data and OTA updates).

## Voice & tone

Confident, playful, outdoorsy; never preachy about fitness, never gamified-casino.

- Short, active sentences. Second person. Celebrate what the user did, in concrete numbers ("+0.12
  km² new turf · 340 cells reinforced").
- No guilt ("You haven't moved today!"), no fake urgency, no leaderboards language in the PoC
  (single user).
- Privacy is part of the brand: "Your routes stay on your phone."

Taglines (in order of preference): **"Surf your city. Own your streets."** · "Walk it. Run it. Ride
it. Own it." · "Every street you cover becomes yours."

## Colour tokens

The brand palette **is** the turf strength ramp — the app's core mechanic is the brand.

Brand names (left) are what people say; code names are what you import (`@cityturfer/brand`), CSS
names what the website uses.

| Brand name     | Code                                  | CSS                        | Hex                           | Use                                                  |
| -------------- | ------------------------------------- | -------------------------- | ----------------------------- | ---------------------------------------------------- |
| `night`        | `DARK.bg`                             | `--bg` (dark)              | `#0B0D12`                     | Background of the app, every map panel, splash, icon |
| `night-raised` | `DARK.card`                           | `--card` (dark)            | `#151924`                     | Cards on night                                       |
| `faint`        | `TIER_COLOR.faint`                    | `--faint`                  | `#7B2FF7`                     | Turf tier 1, gradient start                          |
| `glow`         | `TIER_COLOR.glowing`, `ACCENT`        | `--glow`, `--accent`       | `#F72FA8`                     | Tier 2; accent fill: buttons, selection              |
| `strong`       | `TIER_COLOR.strong`                   | `--strong`                 | `#FFB02E`                     | Turf tier 3, highlights                              |
| `blazing`      | `TIER_COLOR.blazing`                  | `--blazing`                | `#FFF3C4`                     | Turf tier 4, the end of the Ramp in "TURFER"         |
| Ramp           | `RAMP`                                | `--ramp-stops`             | the four tiers                | Gradient, in tier order                              |
| walk/run/ride  | `TYPE_COLOR.walk` / `.run` / `.cycle` | `--walk`/`--run`/`--ride`  | `#2BD48B`/`#FF8A3D`/`#3DB8FF` | Activity type fills only                             |
| on-accent      | `ON_ACCENT` (app), `WEB_ON_ACCENT`    | `--on-accent`, `--on-glow` | white (app) / `#0B0D12` (web) | Label on `glow` fills                                |
| on-tier        | `ON_TIER.<tier>`                      | (app only)                 | white / `#0B0D12`             | Text on a tier fill (white on faint/glowing)         |
| on-light       | `ON_LIGHT`, `ON_TYPE_COLOR.<type>`    | `--on-type`                | `#0B0D12`                     | Text on light fills and activity colours             |

The raw fills (`--accent`, `--glow`, `--strong`, `--walk`, `--run`, `--ride`) are the same in both
schemes and tuned to glow on night. So is the web's pink label: `cssVariables()` emits
`WEB_ON_ACCENT` (`#0B0D12`, 5.5:1) for `--on-accent` and `--on-glow` in both schemes, never
`<theme>.onAccent`; the app keeps `DARK.onAccent` white (3.5:1). Themes (`THEMES.dark` = `DARK`,
`THEMES.light` = `LIGHT`) share one `Palette` type, so every key exists in both; `DARK` repeats the
brand fill where `LIGHT` needs its own AA variant:

| `Palette` key                                 | CSS                                                   | `LIGHT`                           | `DARK`    | Use                                 |
| --------------------------------------------- | ----------------------------------------------------- | --------------------------------- | --------- | ----------------------------------- |
| `bg`                                          | `--bg`                                                | `#F6F7FB`                         | `#0B0D12` | Page background                     |
| `card`                                        | `--card`                                              | `#FFFFFF`                         | `#151924` | Cards, panels                       |
| `text`                                        | `--text`                                              | `#0E1116`                         | `#EEF1F7` | Body text                           |
| `muted`                                       | `--muted`                                             | `#5A6375`                         | `#9AA3B5` | Secondary text                      |
| `border`                                      | `--border`                                            | `#E3E6EE`                         | `#242A38` | Hairlines and dividers              |
| `danger`                                      | `--danger`                                            | `#C92A33`                         | `#FF6369` | Errors                              |
| `accentText`                                  | `--accent-text`                                       | `#C2127F`                         | `#F72FA8` | Pink as text and links              |
| `onAccent`                                    | app only; the web's `--on-accent` is `WEB_ON_ACCENT`  | `#0B0D12`                         | `#FFFFFF` | Label on a `glow` fill in the app   |
| `borderControl`                               | `--border-control`                                    | `#848DA0`                         | `#9AA3B5` | Edges of inputs and buttons (≥ 3:1) |
| `strongText`                                  | `--strong-text`                                       | `#9A5B00`                         | `#FFB02E` | The strong tier as text             |
| `walkText` / `runText` / `cycleText`          | `--walk-text` / `--run-text` / `--ride-text`          | `#0F7A4F` / `#B84E0A` / `#0B6FA8` | the fills | Activity colours as text            |
| `walkGraphic` / `runGraphic` / `cycleGraphic` | `--walk-graphic` / `--run-graphic` / `--ride-graphic` | `#169E63` / `#E0661A` / `#1C8FD6` | the fills | Activity lines, icons, dots         |

**The app is the source of truth, one scheme everywhere, no theme switch.** The app is dark
(`userInterfaceStyle: "dark"` in `apps/mobile/app.json`, so `usePalette()` returns `DARK`), and so
is every map. The website, portal, Swagger and Storybook are **dark too**, in the app's palette:
`SITE_SCHEME` (`packages/brand/src/tokens.ts`, `'dark'`) is the one place that says so, and they
call `cssVariables(SITE_SCHEME)`; never name a scheme there. Pink fills on the web carry a night
label (`WEB_ON_ACCENT`, 5.5:1) where the app still draws white (3.5:1). (Swagger: the dev page does;
the API's own `/swagger` is still stock, see the `brand-surfaces` skill for every surface and its
state.) Draw text through the `-text` variants and lines through the `-graphic` variants (on dark
they equal the brand colours; on a light surface they are the AA variants). Why:
`docs/decisions/brand-dark-site-2026-10-25.md`, which replaces the light site of
`docs/decisions/brand-light-theme-2026-10-22.md`.

Gradient **Ramp** = `faint → glow → strong → blazing`, always running from bottom-left to top-right
(movement "up" into white-hot). Never use the ramp for errors; errors use `danger`. Tokens live in
`packages/brand/src/colors.ts`; `apps/mobile/src/constants/colors.ts` re-exports `ACCENT`, `DARK`,
`LIGHT`, `ON_ACCENT`, `ON_LIGHT`, `ON_TIER`, `ON_TYPE_COLOR`, `RAMP`, `TIER_COLOR`, `TYPE_COLOR` and
`FONT_FAMILY`, `DISPLAY_CASE`, `DISPLAY_TRACKING` (never add a token there); `usePalette()` comes
from `@cityturfer/ui`, re-exported by `apps/mobile/src/ui-kit/theme.ts`. Reference those, never
hard-code hex in components or native config written from TS (e.g. the Android tracking
notification's `notificationColor` takes `ACCENT`). Spacing (`SPACE`), radii (`RADIUS`), type
(`FONT_SIZE`, `FONT_WEIGHT`, `LABEL_TRACKING`) and the tier order (`TIER_ORDER`) live in
`packages/brand/src/tokens.ts`; tier names users see (`TIER_LABEL`: Faint, Glowing, Strong, Blazing)
in `copy.ts`. The website gets every token as a CSS variable from `cssVariables(SITE_SCHEME)`
(`--bg`, `--card`, `--accent-text`, `--walk-graphic`, `--space-lg`, `--radius-panel`, `--font-hero`,
`--font-weight-black`, `--label-tracking`…). Components and Storybook: the `design-system` skill.

## Typography

**Street Plate** (`docs/decisions/brand-typography-2026-10-22.md`): Big Shoulders Display for
headings, Barlow Semi Condensed for numbers, Barlow for body text on the web; the app's body and
labels stay on the system font (SF Pro, Roboto). All SIL OFL. Files in `packages/brand/fonts/` (cut
by `packages/brand/scripts/make-fonts.py`), names in `FONT_FAMILY` and `BODY_FONT_FAMILY`
(`packages/brand/src/tokens.ts`), web variables `--font-family-display`, `--font-family-numeric`,
`--font-family-body`, `--display-case`, `--display-tracking`.

- Display (`FONT_FAMILY.display`, Big Shoulders Display Black): hero, screen and section titles.
  Always in capitals (`DISPLAY_CASE`) with `DISPLAY_TRACKING` (0.4), never negative tracking; it is
  condensed, so set it about a quarter larger than a regular face and keep line height near 0.92.
- Numbers (`FONT_FAMILY.numeric`, Barlow Semi Condensed ExtraBold): distances, times, areas, with
  tabular figures (`fontVariant: ['tabular-nums']` / `font-variant-numeric: tabular-nums`).
- Body (web only): Barlow 400/500/600/700 (`BODY_FONT_FAMILY`), self-hosted; never bundled in the
  app.
- Tagline (web only): Barlow Semi Condensed Black Italic (`TAGLINE_FONT_FAMILY`,
  `--font-family-tagline`), sentence case, for "Surf your city. Own your streets." in the hero, on
  /branding and in the social image. Its slant sets it apart from the upright capitals of the
  wordmark and headings.
- Wordmark: Anton (OFL, `packages/brand/fonts/Anton-Regular.ttf`), only as outlines in the logo SVGs
  (Logo, below). Never set text in Anton, never bundle it in the app or load it on the web.
- The weight is part of each font: never add `fontWeight` (Android falls back to the system font)
  and on the web use `font-weight: normal` + `font-synthesis: none`.
- Labels: 12–13 pt system font, weight 600–700, uppercase, letter-spacing `LABEL_TRACKING` (0.8).
- Fonts are bundled natively (`expo-font` plugin in `apps/mobile/app.json`): a new font or file
  changes the runtime fingerprint and needs a reinstall.

## Logo

- **Mark** (`packages/brand/svg/mark.svg`): a claimed turf cell (hexagon, `glow` outline) with a
  street riding through it like a wave, coloured with the Ramp and ending in a white-hot "you are
  here" point at the crest. Faint city grid inside the cell.
- **Wordmark**: outlined Anton in capitals (the wordmark's own face, founder decision 2026-10-27;
  headlines stay Big Shoulders Display), "CITY" + "TURFER", tracking 0.03 em (the colour change
  keeps the two words apart; in running text the name is still spelled CityTurfer). Its proportions
  are 815 × 182 (about 4.49 : 1; `wordmark.png` 898 × 200), so a 20 px high wordmark is 90 px wide.
  `packages/brand/svg/wordmark.svg` on night surfaces: the app, splash, maps, the website, portal,
  Swagger and Storybook ("CITY" white, "TURFER" in the Ramp);
  `packages/brand/svg/wordmark-light.svg` only on light surfaces (the admin's light mode, print:
  "CITY" `night`, "TURFER" faint → glow, the part of the Ramp that holds on white). Both are
  generated by `packages/brand/scripts/outline-wordmark.py`: never edit them by hand.
- Clear space ≥ ½ hexagon side around the mark. Don't recolour the hexagon, rotate the mark, put it
  on busy photos, or add drop shadows.
- Android themed icon: `packages/brand/svg/mark-monochrome.svg` (single colour, no glow). Adaptive
  foreground: `mark-foreground.svg` (art inside the 66% safe zone).

## Visual language

- **The map is the hero.** Product imagery is the real Turf Map: dark, desaturated basemap with the
  turf as the only colour, on night, like the website around it. Tier colours mean turf, activity
  colours mean tracks, nothing else.
- **Motif**: the hexagon cell and the street-wave from the mark. No mascot or characters.
- **Photos** (marketing only): city streets at dusk or night, human scale, people from behind or far
  away; no stock fitness bodies, no recognisable person next to a route.
- **Icons**: SF Symbols (`expo-symbols`), outline by default, filled when selected.
- **Motion: things glow up, they don't bounce.** UI 150–250 ms ease-out; celebrations 600–900 ms
  brightening along the Ramp; light haptic on a claim; always honour reduce motion.

## Accessibility

WCAG 2.2 AA: 4.5:1 body text, 3:1 large text (≥ 24 px or ≥ 18.5 px bold), icons and UI boundaries.
Check a pair with `contrastRatio(fg, bg)` from `@cityturfer/brand`
(`packages/brand/src/contrast.ts`). `packages/brand/src/__tests__/contrast.test.ts` covers every
pairing the apps draw: each light `-text` / `-graphic` variant on `LIGHT.bg` and `LIGHT.card`, and
the site's own pairs read from `cssVariables(SITE_SCHEME)` (night label on glow 5.49, the primary
button hover `color-mix(in srgb, var(--glow) 86%, var(--text))` 6.06, accent text and the glow disc
on card 4.95, glow on border 4.05, the faint legend step on bg 3.32). Its `KNOWN_FAILURES` are what
remains:

- **Live in the app (dark):** white on glow (`ON_ACCENT`, 3.5:1) and the same pair on the glow tier
  chip (`ON_TIER.glowing`), plus white on the dark `danger` fill (2.9:1). Kept so the app does not
  shift; fixing them changes the app.
- **Guards, not bugs:** the raw fills on light surfaces (glow 3.3–3.5:1, walk/run/ride 1.8–2.4:1). A
  light surface (the admin's light mode) never draws them as text or lines; it uses `accentText` and
  the `-text` / `-graphic` variants. They stay listed so nobody reaches for them on light by
  mistake.

Fixing one means removing it from the list (the test fails on an entry that passes).

## Assets pipeline

```bash
node apps/mobile/tools/brand/render-assets.mjs              # everything below (headless Chrome + sips)
node apps/mobile/tools/brand/render-assets.mjs --check      # list targets
node apps/mobile/tools/brand/render-assets.mjs store og     # only outputs whose path contains a word
```

- Icons, splash, favicon, wordmark PNGs → `apps/mobile/assets/brand/out/`. The app's sign-in screen
  loads `wordmark.png` (not the SVG), so **after changing a wordmark SVG, re-render**
  `render-assets.mjs wordmark.png og-image` or the app and the share image keep the old logo.
- Social image (1200×630) → `apps/web/public/og-image.png`, from
  `packages/brand/templates/og-image.html`.
- Store screenshots, App Store 6.9" (1290×2796) and Play (1080×2340) →
  `apps/mobile/assets/brand/out/store/`, from `packages/brand/templates/store-screenshot.html`. They
  frame the screens in `apps/web/public/screens/`; recapture those from a current build at full
  resolution before submitting.
- Templates and SVGs can't import tokens; `packages/brand/src/__tests__/asset-colors.test.ts` fails
  on any hex that isn't a token or a listed art-only shade. Fast loop after a token, SVG or template
  edit: `pnpm --filter @cityturfer/brand test:unit` (asset colours, contrast, tokens).

`apps/mobile/assets/brand/out/` is a staging area; `apps/mobile/app.json` reads the copies in
`apps/mobile/assets/` (today identical to the staged ones). Icons and splash are **native**: they
change the runtime fingerprint, so OTA updates stop matching installed builds. Apply them only
together with a native reinstall: copy just the changed files that `app.json` references
(`icon.png`, `android-icon-foreground.png`, `android-icon-background.png`,
`android-icon-monochrome.png`, `splash-icon.png`) from `assets/brand/out/` into
`apps/mobile/assets/` (never `out/*`: wordmarks and `store/` don't belong there), rebuild,
reinstall, then publish OTA updates for the new runtime.

## Store copy (draft)

- **Name:** CityTurfer · **Subtitle (27/30 chars):** Own every street you cover. (The main tagline
  is 33 chars, too long for the App Store's 30.)
- **Promo:** Walk, run or ride — every street you cover becomes your turf. Come back and watch it
  glow.
- **Keywords:** walking, running, cycling, GPS tracker, route map, city explorer, heatmap,
  territory, streets

## Review checklist ("is this on-brand?")

1. Name spelled CityTurfer; internal terms not leaking into copy.
2. Colours from tokens; accent = `glow`; Ramp direction correct.
3. Numbers tabular and concrete; no guilt or casino language.
4. Right scheme for the surface: the website, portal, Swagger and Storybook follow `SITE_SCHEME`
   (dark, `cssVariables(SITE_SCHEME)`, never a named scheme); the app and every map are dark (`DARK`
   via `usePalette()`). Text goes through `accentText`, `strongText`, `<type>Text`; on a light
   surface the Ramp, `blazing` and the raw fills are never text.
5. Type: brand faces only through `FONT_FAMILY` / the `--font-family-*` variables, never with
   `fontWeight`; display text in capitals (`DISPLAY_CASE`).
6. New colour pairs meet the contrast minimums (or are knowingly listed in `KNOWN_FAILURES`).
7. Copy fits all three audiences and the personality: confident, playful, outdoorsy, private.
