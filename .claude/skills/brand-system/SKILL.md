---
name: brand-system
description:
  CityTurfer brand rules and assets — name usage, tagline and voice, colour tokens (the turf
  strength ramp), typography, logo/app-icon construction, splash, store copy, and how to regenerate
  icon PNGs from SVG with tools/brand/render-assets.mjs. Use whenever writing user-facing copy,
  designing or restyling a screen, touching app icons/splash/app name, preparing App Store / Play
  listings or marketing material, or when someone asks "is this on-brand?".
---

# CityTurfer brand system

**CityTurfer** — _Surf your city. Own your streets._ Every walk, run and ride claims the streets you
cover; the turf glows brighter the more often you come back, and it's yours for good.

## Name

- **CityTurfer (one word, two capitals)**: Cityturfer, City Turfer, CITYTURFER, City-Turfer
- **"your turf", "claim", "glow", "streets you own"**: "territory" (internal/code term only),
  "score", "points", "conquer" (too aggressive)

- Users are **Turfers**. Their claimed area is **turf**; one hexagon is a **cell**.
- Use the ubiquitous language from `docs/poc-plan.md` §2 in UI copy (Walk / Run / Ride, Turf, Cell,
  Strength tiers).
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

| Token                   | Hex                               | Use                                                  |
| ----------------------- | --------------------------------- | ---------------------------------------------------- |
| `night`                 | `#0B0D12`                         | Primary background (Turf map, sign-in, splash, icon) |
| `night-raised`          | `#151924`                         | Cards on dark                                        |
| `faint`                 | `#7B2FF7`                         | Turf tier 1, gradient start                          |
| `glow` (accent)         | `#F72FA8`                         | Primary accent: buttons, selection, links            |
| `strong`                | `#FFB02E`                         | Turf tier 3, highlights                              |
| `blazing`               | `#FFF3C4`                         | Turf tier 4, logotype "City", headline on dark       |
| `walk` / `run` / `ride` | `#2BD48B` / `#FF8A3D` / `#3DB8FF` | Activity type colours only                           |

Gradient **Ramp** = `faint → glow → strong → blazing`, always running from bottom-left to top-right
(movement "up" into white-hot). Never use the ramp for errors; errors use `#E5484D`/`#FF6369`.
Tokens live in `src/constants/colors.ts` (`TIER_COLOR`, `ACCENT`, `LIGHT`, `DARK`, `TYPE_COLOR`;
`usePalette()` in `src/ui-kit/theme.ts`) — reference those, never hard-code hex in components.

## Typography

System fonts (SF Pro on iOS, Roboto on Android) — no custom font download in the PoC.

- Display / logotype: weight 900, tight letter-spacing (−2% to −4%).
- Numbers (distances, times, areas): weight 800, `fontVariant: ['tabular-nums']`.
- Labels: 12–13 pt, weight 600–700, uppercase, letter-spacing 0.8–1.

## Logo

- **Mark** (`assets/brand/mark.svg`): a claimed turf cell (hexagon, `glow` outline) with a street
  riding through it like a wave, coloured with the Ramp and ending in a white-hot "you are here"
  point at the crest. Faint city grid inside the cell.
- **Wordmark** (`assets/brand/wordmark.svg`): "City" weight 500 in `blazing` + "Turfer" weight 900
  in the Ramp. On light backgrounds use `night` for "City".
- Clear space ≥ ½ hexagon side around the mark. Don't recolour the hexagon, rotate the mark, put it
  on busy photos, or add drop shadows.
- Android themed icon: `mark-monochrome.svg` (single colour, no glow). Adaptive foreground:
  `mark-foreground.svg` (art inside the 66% safe zone).

## Assets pipeline

```bash
node tools/brand/render-assets.mjs           # SVG → PNG into assets/brand/out/ (headless Chrome + sips)
node tools/brand/render-assets.mjs --check   # list targets
```

Icons and splash are **native**: they change the runtime fingerprint, so OTA updates stop matching
installed builds. Apply them only together with a native reinstall: copy `assets/brand/out/*` into
`assets/`, set `expo.name`, rebuild, reinstall, then publish OTA updates for the new runtime.

## Store copy (draft)

- **Name:** CityTurfer · **Subtitle (30):** Surf your city. Own its streets.
- **Promo:** Walk, run or ride — every street you cover becomes your turf. Come back and watch it
  glow.
- **Keywords:** walking, running, cycling, GPS tracker, route map, city explorer, heatmap,
  territory, streets

## Review checklist ("is this on-brand?")

1. Name spelled CityTurfer; internal terms not leaking into copy.
2. Colours from tokens; accent = `glow`; Ramp direction correct; Turf map dark.
3. Numbers tabular and concrete; no guilt or casino language.
4. Works in light and dark (except screens that are always dark: Turf map, sign-in, splash).
