---
status: canonical
verified: 2026-10-23
owner: founder
scope: [packages/brand, apps/mobile/tools/brand, apps/web/src/app, .claude/skills/brand-system]
summary:
  Brand foundations (positioning for three audiences, personality, pillars), Archivo as the brand
  typeface (superseded by brand-typography-2026-10-22), visual language beyond colour, WCAG contrast
  rules with the open palette fixes, and the asset set (outlined wordmarks, social image, store
  screenshots)
---

# Brand foundations (v0.8.0)

Until now the brand was rules only: name, colours, logo. This adds the strategy those rules serve, a
typeface, a visual language and an accessibility bar. The day-to-day rules live in the
`brand-system` skill (`.claude/skills/brand-system/SKILL.md`); this file records why.

## Positioning (draft for founder review)

Which frame leads is still an open product test (`docs/product/strategy.md` §4, options A–C). The
brand stays compatible with all three: the three audiences below are those frames' customers, and
the copy rules work for each. When the test picks a winner, lead with it here and in the skill.

**For** people who move through a city on foot or by bike, **CityTurfer** is the activity tracker
that turns every street you cover into **turf that is yours for good**, and makes it glow brighter
each time you come back. **Unlike** performance trackers (Strava, Garmin Connect), it doesn't rank
you against anyone; **unlike** street-completion apps (CityStrides, Wandrer), it rewards returning
to the streets you love, not only ticking off new ones. **And** your routes never leave your phone.

One promise, three audiences. Every piece of copy speaks to all three; a channel may lead with one.

| Audience             | What they want                                  | Lead with                                           |
| -------------------- | ----------------------------------------------- | --------------------------------------------------- |
| City explorers       | Know and "collect" their city, street by street | "Every street you cover becomes yours."             |
| Runners and cyclists | Variety and a reason to try new routes          | "Walk it. Run it. Ride it. Own it."                 |
| Everyday movers      | A quiet reward for walks, commutes, dog walks   | "Your turf glows brighter each time you come back." |

## Personality

| We are                                         | We are not                                           |
| ---------------------------------------------- | ---------------------------------------------------- |
| **Confident**: short, direct, concrete numbers | Boastful, hype ("insane", "crush it")                |
| **Playful**: turf, glow, surfing the city      | Gamified-casino: streaks you lose, loot, guilt       |
| **Outdoorsy**: streets, dusk, real places      | Gym culture: bodies, calories first, no pain no gain |
| **Private by default**: your phone, your data  | Social pressure: leaderboards, followers             |

Brand pillars: **Your streets** (ownership is permanent), **The glow** (repetition is rewarded,
visibly), **Yours alone** (local-first, no tracking).

## Typography: Archivo

> **Superseded (2026-10-22):** the brand type is now Big Shoulders Display + Barlow ("Street
> Plate"), `docs/decisions/brand-typography-2026-10-22.md`. The wordmark is redrawn in Big Shoulders
> Display too.

Decision: **Archivo** (Omnibus-Type, SIL Open Font License) for display and numbers; system fonts
(SF Pro, Roboto) for body text and labels.

- `ArchivoExpanded-Black` (width 125, weight 900): wordmark, hero, screen titles.
- `Archivo-ExtraBold` (width 100, weight 800): big numbers, always with tabular figures.

Why Archivo: a grotesk with real width variants, so one family gives a wide athletic display face
and a compact number face; tabular figures for stats; Latin Extended for Polish; free to bundle in
the app and self-host on the web. Space Grotesk (no 900 weight) and Unbounded (too loud for numbers)
were the alternatives.

How: `packages/brand/scripts/make-fonts.py` cuts the two static fonts from the Google Fonts variable
font (React Native has no variable-font support), subset to Latin + Latin Extended-A (TTF ~63 KB,
WOFF2 ~16 KB each). The PostScript name equals the file name, so the same `FONT_FAMILY` token works
on iOS, Android and the web. Tokens: `FONT_FAMILY`, `SYSTEM_FONT_STACK` and the `--font-family-*`
CSS variables in `packages/brand/src/tokens.ts`.

Consequences: the app bundles the fonts with the `expo-font` config plugin, which **changes the
runtime fingerprint** (native rebuild and reinstall; old builds stop matching OTA updates). The web
loads them with `next/font/local` (self-hosted, display face preloaded). The wordmark is outlined
(`packages/brand/scripts/outline-wordmark.py`), so it no longer depends on the viewer's fonts.

## Visual language

- **Map is the hero.** Product imagery is the real Turf Map: dark basemap, turf glowing on it. The
  basemap stays desaturated so the turf is the only colour on screen. On the light website, maps and
  map imagery still sit on night panels (`docs/decisions/brand-light-theme-2026-10-22.md`). Since
  v0.12.0 the website is dark like the app, so maps sit on the page's own night
  (`docs/decisions/brand-dark-site-2026-10-25.md`). Tier colours mean turf only; activity colours
  mean tracks only.
- **Motif.** The hexagon cell and the street-wave from the mark are the building blocks for
  illustration, empty states and patterns. No mascot, no characters.
- **Photography** (marketing only, optional): city streets at dusk or night, human scale, people
  from behind or far away. Never stock fitness bodies, never a recognisable person next to a route
  (privacy is part of the brand).
- **Icons.** SF Symbols on iOS (`expo-symbols`); Android falls back to text glyphs today, and
  Material Symbols in the same outline style are the target. Outline by default, filled when
  selected; one weight per screen.
- **Motion: things glow up, they don't bounce.** UI transitions 150–250 ms ease-out; celebrations
  (new turf, achievements) 600–900 ms brightening along the Ramp; a light haptic on a claim. Always
  honour reduce motion. Website specifics: the `web-motion` skill.

## Accessibility

WCAG 2.2 AA: 4.5:1 for body text, 3:1 for large text, icons and UI boundaries.
`packages/brand/src/contrast.ts` computes it; `packages/brand/src/__tests__/contrast.test.ts` checks
every pairing the apps draw and lists today's failures explicitly, so none can be added silently and
a fixed one must be removed from the list.

**Update 2026-10-22:** the website, Swagger and Storybook moved to a light theme while the app and
every map stay dark. The light-theme rows below are closed by new light tokens (`LIGHT.accentText`,
`LIGHT.<type>Text` / `<type>Graphic`, a deeper `LIGHT.danger`, a night `LIGHT.onAccent` on the
unchanged glow fill); values, ratios and the reasoning are in
`docs/decisions/brand-light-theme-2026-10-22.md`. The app-side rows (white on glow, white on the
dark danger fill) stay open: the app's dark tokens did not change.

Failures as of 2026-10-20 and the suggested fixes (kept as the record; see the update above):

| Pair                                     | Today     | Suggested fix                                                |
| ---------------------------------------- | --------- | ------------------------------------------------------------ |
| White label on the glow accent (buttons) | 3.5:1     | Night label on glow (5.5:1), or white on `#C8137F` (5.4:1)   |
| Glow as text/links on light theme        | 3.3:1     | Light-theme accent text `#C8137F` (5.1:1)                    |
| Danger on light theme                    | 3.7:1     | `#CF2F35` (4.8:1)                                            |
| Walk / run / ride lines on light         | 1.8–2.4:1 | Light-map variants `#14935C`, `#C85A12`, `#1477B8` (≥ 3.6:1) |
| White label on danger (Hold to finish)   | 2.9–3.9:1 | Needs a deeper danger fill token; decide with the accent fix |

## Assets

All rendered by `apps/mobile/tools/brand/render-assets.mjs` with headless Chrome:

- `packages/brand/svg/wordmark.svg` (dark backgrounds) and `wordmark-light.svg` (light: "CITY" in
  night, "TURFER" in faint → glow, the part of the Ramp that holds on white; both redrawn in Big
  Shoulders Display, `docs/decisions/brand-typography-2026-10-22.md`). Since the light website,
  `wordmark-light.svg` is the site's wordmark and `wordmark.svg` is for night panels
  (`docs/decisions/brand-light-theme-2026-10-22.md`). Since the dark website (v0.12.0) the site
  draws `wordmark.svg` again, with a white "CITY", and `wordmark-light.svg` is for light surfaces
  only, such as the admin's light mode and print (`docs/decisions/brand-dark-site-2026-10-25.md`).
- `apps/web/public/og-image.png`: 1200×630 social image from
  `packages/brand/templates/og-image.html`.
- `apps/mobile/assets/brand/out/store/`: App Store 6.9" (1290×2796) and Google Play (1080×2340)
  screenshots from `packages/brand/templates/store-screenshot.html`. They frame the screenshots in
  `apps/web/public/screens/`, which are 720 px wide and predate the brand fonts: recapture them at
  full resolution from a build with the new fonts before submitting.

`packages/brand/src/__tests__/asset-colors.test.ts` keeps the hex values in SVGs and templates in
sync with the tokens.
