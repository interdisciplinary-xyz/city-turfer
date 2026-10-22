---
name: brand-system
description: >-
  "is this on-brand?", user-facing copy, choosing a colour or font, restyling a screen, app icon,
  splash, store listing or screenshots, social image. CityTurfer name, voice, colour tokens (turf
  Ramp), Archivo, logo, WCAG contrast and rendering assets with render-assets.mjs.
---

# CityTurfer brand system

**CityTurfer** — _Surf your city. Own your streets._ Every walk, run and ride claims the streets you
cover; the turf glows brighter the more often you come back, and it's yours for good.

Why the brand is shaped this way (positioning, personality, typeface choice, contrast fixes):
`docs/decisions/brand-foundations-2026-10-20.md`.

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

| Brand name     | Code                                  | CSS                       | Hex                           | Use                                           |
| -------------- | ------------------------------------- | ------------------------- | ----------------------------- | --------------------------------------------- |
| `night`        | `DARK.bg`                             | `--bg`                    | `#0B0D12`                     | Background (whole app, website, splash, icon) |
| `night-raised` | `DARK.card`                           | `--card`                  | `#151924`                     | Cards on dark                                 |
| `faint`        | `TIER_COLOR.faint`                    | `--faint`                 | `#7B2FF7`                     | Turf tier 1, gradient start                   |
| `glow`         | `TIER_COLOR.glowing`, `ACCENT`        | `--glow`, `--accent`      | `#F72FA8`                     | Tier 2; accent: buttons, selection, links     |
| `strong`       | `TIER_COLOR.strong`                   | `--strong`                | `#FFB02E`                     | Turf tier 3, highlights                       |
| `blazing`      | `TIER_COLOR.blazing`                  | `--blazing`               | `#FFF3C4`                     | Turf tier 4, logotype "City", headline        |
| Ramp           | `RAMP`                                | `--ramp-stops`            | the four tiers                | Gradient, in tier order                       |
| walk/run/ride  | `TYPE_COLOR.walk` / `.run` / `.cycle` | `--walk`/`--run`/`--ride` | `#2BD48B`/`#FF8A3D`/`#3DB8FF` | Activity type colours only                    |
| on-accent      | `ON_ACCENT`                           | `--on-accent`             | `#FFFFFF`                     | Label on `glow` fills (known contrast fail)   |
| on-tier        | `ON_TIER.<tier>`                      | `--on-glow`               | white / `#0B0D12`             | Text on a tier fill (white on faint/glowing)  |
| on-light       | `ON_LIGHT`, `ON_TYPE_COLOR.<type>`    | `--on-type`               | `#0B0D12`                     | Text on light fills and activity colours      |

Themes (`THEMES.dark` = `DARK`, `THEMES.light` = `LIGHT`) use semantic names; CSS `--bg`, `--card`,
`--text`, `--muted`, `--border`, `--danger`:

| Theme   | `bg`      | `card`    | `text`    | `muted`   | `border`  | `danger`  |
| ------- | --------- | --------- | --------- | --------- | --------- | --------- |
| `DARK`  | `#0B0D12` | `#151924` | `#EEF1F7` | `#9AA3B5` | `#242A38` | `#FF6369` |
| `LIGHT` | `#F6F7FB` | `#FFFFFF` | `#0E1116` | `#5C6577` | `#E3E6EE` | `#E5484D` |

**The app is always dark** (`userInterfaceStyle: "dark"` in `apps/mobile/app.json`, so
`usePalette()` returns `DARK`), and so is the website (`cssVariables('dark')`). `LIGHT` stays for
Storybook and a possible light mode later; its contrast failures matter only then.

Gradient **Ramp** = `faint → glow → strong → blazing`, always running from bottom-left to top-right
(movement "up" into white-hot). Never use the ramp for errors; errors use `danger`. Tokens live in
`packages/brand/src/colors.ts`; `apps/mobile/src/constants/colors.ts` re-exports `ACCENT`, `DARK`,
`LIGHT`, `ON_ACCENT`, `ON_LIGHT`, `ON_TIER`, `ON_TYPE_COLOR`, `RAMP`, `TIER_COLOR`, `TYPE_COLOR` and
`FONT_FAMILY` (never add a token there); `usePalette()` comes from `@cityturfer/ui`, re-exported by
`apps/mobile/src/ui-kit/theme.ts`. Reference those, never hard-code hex in components or native
config written from TS (e.g. the Android tracking notification's `notificationColor` takes
`ACCENT`). Spacing (`SPACE`), radii (`RADIUS`), type (`FONT_SIZE`, `FONT_WEIGHT`, `LABEL_TRACKING`)
and the tier order (`TIER_ORDER`) live in `packages/brand/src/tokens.ts`; tier names users see
(`TIER_LABEL`: Faint, Glowing, Strong, Blazing) in `copy.ts`. The website gets every token as a CSS
variable from `cssVariables('dark')` (`--bg`, `--card`, `--glow`, `--walk`, `--space-lg`,
`--radius-panel`, `--font-hero`, `--font-weight-black`, `--label-tracking`…). Components and
Storybook: the `design-system` skill.

## Typography

**Archivo** (SIL OFL) for display and numbers, system fonts (SF Pro, Roboto) for body and labels.
Files in `packages/brand/fonts/` (cut by `packages/brand/scripts/make-fonts.py`), names in
`FONT_FAMILY` (`packages/brand/src/tokens.ts`), web variables `--font-family-display`,
`--font-family-numeric`, `--font-family-body`.

- Display (`FONT_FAMILY.display`, Archivo Expanded Black): wordmark, hero, screen titles. Wide: use
  sparingly, letter-spacing −2% to −4%, check long Polish lines at 320–375 px.
- Numbers (`FONT_FAMILY.numeric`, Archivo ExtraBold): distances, times, areas, with tabular figures
  (`fontVariant: ['tabular-nums']` / `font-variant-numeric: tabular-nums`).
- The weight is part of each font: never add `fontWeight` (Android falls back to the system font)
  and on the web use `font-weight: normal` + `font-synthesis: none`.
- Labels: 12–13 pt system font, weight 600–700, uppercase, letter-spacing `LABEL_TRACKING` (0.8).
- Fonts are bundled natively (`expo-font` plugin in `apps/mobile/app.json`): a new font or file
  changes the runtime fingerprint and needs a reinstall.

## Logo

- **Mark** (`packages/brand/svg/mark.svg`): a claimed turf cell (hexagon, `glow` outline) with a
  street riding through it like a wave, coloured with the Ramp and ending in a white-hot "you are
  here" point at the crest. Faint city grid inside the cell.
- **Wordmark**: outlined Archivo Expanded, "City" Medium + "Turfer" Black.
  `packages/brand/svg/wordmark.svg` for dark backgrounds ("City" `blazing`, "Turfer" in the Ramp);
  `packages/brand/svg/wordmark-light.svg` for light ones ("City" `night`, "Turfer" faint → glow, the
  part of the Ramp that holds on white). Both are generated by
  `packages/brand/scripts/outline-wordmark.py`: never edit them by hand.
- Clear space ≥ ½ hexagon side around the mark. Don't recolour the hexagon, rotate the mark, put it
  on busy photos, or add drop shadows.
- Android themed icon: `packages/brand/svg/mark-monochrome.svg` (single colour, no glow). Adaptive
  foreground: `mark-foreground.svg` (art inside the 66% safe zone).

## Visual language

- **The map is the hero.** Product imagery is the real Turf Map: dark, desaturated basemap with the
  turf as the only colour. Tier colours mean turf, activity colours mean tracks, nothing else.
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
pairing the apps draw; its `KNOWN_FAILURES` list is the open palette work (white on glow buttons,
glow and danger as text on light, activity colours on light), with suggested fixes in the decision
doc. Fixing one means removing it from the list. Only white on glow is live today (the app and the
website are dark-only); the light-theme failures bite once a light mode ships.

## Assets pipeline

```bash
node apps/mobile/tools/brand/render-assets.mjs              # everything below (headless Chrome + sips)
node apps/mobile/tools/brand/render-assets.mjs --check      # list targets
node apps/mobile/tools/brand/render-assets.mjs store og     # only outputs whose path contains a word
```

- Icons, splash, favicon, wordmark PNGs → `apps/mobile/assets/brand/out/`.
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
4. Built for dark (`DARK` via `usePalette()`, never a hard-coded scheme); shared components also
   render in Storybook's light theme.
5. Type: Archivo only for display and numbers, via `FONT_FAMILY`, never with `fontWeight`.
6. New colour pairs meet the contrast minimums (or are knowingly listed in `KNOWN_FAILURES`).
7. Copy fits all three audiences and the personality: confident, playful, outdoorsy, private.
