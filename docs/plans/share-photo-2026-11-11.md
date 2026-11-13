---
status: proposed
verified: 2026-11-11
owner: founder
scope:
  [
    apps/mobile/src/app/activity,
    apps/mobile/src/app/(tabs)/record.tsx,
    packages/core/src/contexts/territory,
    apps/mobile/src/contexts/activity-log/ui,
    packages/ui/src,
    apps/mobile/messages,
  ]
summary: >-
  Share photo after an activity: the Turfer takes or picks a photo, the app lays the activity's
  stats over it (Garmin-style story card) and hands the image to the system share sheet. No map, no
  coordinates.
---

# Share photo (activity share card)

Founder request (2026-11-11): after each activity, take a photo with the camera or pick one from the
library, overlay the activity details and share the image to social media. Reference: a Garmin
Connect story card (stats top left, activity name, date and place at the bottom, brand mark on the
side, 9:16).

## Why

The product docs list sharing as the cheapest growth loop (`docs/product/market-landscape.md`,
`docs/product/strategy.md` "Next": share image; discovery board A9) but held it back for privacy: a
map reveals home (risk R8 in `docs/poc-plan.md`). A **photo card with numbers and no map** gives the
loop without that risk, so it can ship before privacy zones. A turf-map share image stays a later,
separate feature.

## Rules (v1)

| Question     | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Name         | **Share photo** / **Udostępnij zdjęcie**; the image is a **share card** (ubiquitous language: Share Card)                                                                                                                                                                                                                                                                                                                                                                           |
| Entry points | (1) "Share photo" button on the activity screen (`activity/[id].tsx`), for every activity, including past ones from History; (2) **"Share a photo?" prompt right after Finish** (founder, 2026-11-11), see below                                                                                                                                                                                                                                                                    |
| After Finish | Record lands on the activity screen with `justFinished=1`; a dismissible card above the stats offers **Take photo** / **Choose from library** / **Not now**. Shown once per finished activity, never when an activity is opened from History. **Don't ask again** hides it for good for that user (the button stays)                                                                                                                                                                |
| Photo source | Camera or library (one action sheet). Library uses the system picker (PHPicker / Android Photo Picker): no library permission needed. Camera asks for camera permission on first use only                                                                                                                                                                                                                                                                                           |
| Format       | 9:16 only, rendered at 1080×1920, as in the reference (Instagram / Facebook / WhatsApp stories) (founder, 2026-11-11)                                                                                                                                                                                                                                                                                                                                                               |
| Photo fit    | Cover-crop, centred. Pan / zoom is "later"                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Stats shown  | Distance, moving time, average pace (walk, run) or speed (cycle), exactly as on the activity screen (`formatDistance`, `formatDuration`, `formatPaceOrSpeed`), in the app language                                                                                                                                                                                                                                                                                                  |
| Turf line    | "+N new turf cells" from the activity's claim (`useClaim`), when N > 0: the one thing Garmin or Strava can't show. Toggle, on by default                                                                                                                                                                                                                                                                                                                                            |
| Title block  | Type icon + activity name; date and start time (`formatDate`)                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Place        | Three-way choice, **Off** by default: **Off** / **City** ("Gdańsk") / **District** ("Oliwa, Gdańsk"; the reference shows "@ Nowe Miasteczko") (founder, 2026-11-11). Text only. The district is the one holding most of the activity's points, found on the phone; with no district data for that city, District falls back to City, and with no known city both options are hidden                                                                                                 |
| Brand mark   | CityTurfer wordmark, always the night (white, outlined) variant on the scrim (`apps/mobile/assets/brand/out/wordmark.png`), small, bottom right                                                                                                                                                                                                                                                                                                                                     |
| Legibility   | `DARK.text` with a soft shadow over dark scrims (0.6 plateau, see Card design), so stats read on any photo, white ones included                                                                                                                                                                                                                                                                                                                                                     |
| Layouts      | Two presets: stats top left (as the reference) and stats bottom. One tap switches                                                                                                                                                                                                                                                                                                                                                                                                   |
| Output       | System share sheet (`expo-sharing`): Instagram, Facebook, WhatsApp, Messenger, Save Image, AirDrop… whatever the phone offers. Direct "Share to Instagram Stories" is later (founder, 2026-11-11)                                                                                                                                                                                                                                                                                   |
| Privacy      | No map, route, start/end point or coordinates on the card. The output is a fresh render, so the source photo's EXIF (incl. its GPS) is **not** carried over. The photo and card are never stored in SQLite, backed up or uploaded. Temp files: the photo copy is deleted when replaced or when the share screen closes; the card right after sharing on iOS, while on Android it stays and is swept once older than an hour (see Temp files below). No analytics on what was shared |
| Apple Health | Works for imported activities too (they are Activities); no Health data beyond what the activity screen already shows                                                                                                                                                                                                                                                                                                                                                               |
| Out of scope | Map / route on the card, turf-map image, video, stickers, filters, pan/zoom, 4:5 and 1:1 formats, Instagram Stories deep link (later; needs `react-native-share` + a Facebook App ID), web portal share, saving the photo with the activity                                                                                                                                                                                                                                         |

## Card design

By brand-designer (2026-11-11). Every size is in **units of a 1080 × 1920 canvas**. `ShareOverlay`
multiplies each unit by `k = width / 1080` (sizes, font sizes, line heights, letter spacing, shadow
radius): no `transform: scale`, so text stays crisp in the preview and in the capture. Colours by
token name from `@cityturfer/brand`, no hex. Fonts are only the two the app bundles (`expo-font` in
`apps/mobile/app.json`): `FONT_FAMILY.numeric`, `FONT_FAMILY.display`; labels and the meta lines use
the system font. Never set `fontWeight` on a brand face.

### Frame

| Item        | Value                                                                                                                                                                                                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Safe area   | Content only between y = 250 and y = 1620 (stories UIs cover the top 250 and bottom 300); side margins 72 (content x 72…1008)                                                                                                                                             |
| Photo       | Cover-crop, centred, full canvas; behind it a `DARK.bg` fill (shows while the photo loads)                                                                                                                                                                                |
| Text colour | `DARK.text` for every word and the type icon (near-white, the app's own text colour)                                                                                                                                                                                      |
| Text shadow | `textShadowColor` = `DARK.bg` at 55 % alpha, offset (0, 2), radius 12 on every text; a soft halo, not an outline                                                                                                                                                          |
| Wordmark    | `wordmark.png` (white, 898 × 200) as an image-source prop; height 40, width 180; bottom right: right edge x = 1008, bottom edge on the meta block's last baseline. Always on a scrim plateau, never on bare photo; no shadow (logo rule), no tint, never the day wordmark |
| Type icon   | A render prop `renderTypeIcon(size, color)` (the app passes its `ActivitySymbol`; Storybook a glyph): size 56, colour `DARK.text`, 20 left of the title, centred on its first line. Not the type colour: walk/run/ride fills fail on a bright photo                       |
| Turf marker | Decorative dot before the turf line: 22 × 22 circle, `TIER_COLOR.glowing`, `shadowColor` `TIER_COLOR.glowing`, radius 14, opacity 0.9 (it glows); 16 gap. The words stay `DARK.text`: tier colours mean turf, and glow text on a light photo is 1.4 : 1                   |
| No          | Ramp gradients, tier-coloured text, the hexagon mark, a vertical side tab (that is Garmin's), borders or cards behind text                                                                                                                                                |

### Type

| Element                                  | Font                  | Size / line height | Other                                                                                                    |
| ---------------------------------------- | --------------------- | ------------------ | -------------------------------------------------------------------------------------------------------- |
| Stat label (`card.distance`…)            | system                | 34 / 40            | `FONT_WEIGHT.bold`, uppercase, letter spacing 2.4                                                        |
| Stat value, layout top                   | `FONT_FAMILY.numeric` | 120 / 120          | `tabular-nums`, 1 line                                                                                   |
| Stat unit, layout top (`km`, `/km`)      | `FONT_FAMILY.numeric` | 48 / 48            | 10 after the value, row `alignItems: 'baseline'`; time has none                                          |
| Stat value / unit / label, layout bottom | as above              | 88 / 88 · 36 · 30  | the three stats in one row, gap 48, label above each value                                               |
| Turf line (`card.turfCells`)             | `FONT_FAMILY.numeric` | 44 / 48            | `tabular-nums`, after the turf dot                                                                       |
| Title (activity name)                    | `FONT_FAMILY.display` | 72 / 66 (0.92)     | `DISPLAY_CASE`, `DISPLAY_TRACKING` × 3 = 1.2, max 2 lines, ellipsis; max width 708 (clears the wordmark) |
| Meta lines (`card.when`, place)          | system                | 34 / 42            | `FONT_WEIGHT.semibold`; place on its own line under `when`                                               |

Stat value and unit arrive formatted; values may grow (`1:34:44`, `102,35 km`): one line,
`adjustsFontSizeToFit` with `minimumFontScale` 0.8.

### Layouts

**Top** (default, like the reference): stats stack from y = 280: label, 4 gap, value; 36 between
stats; the turf line 32 below the last value. Title block bottom-left, its last meta line ending at
y = 1620: icon + title, 14 gap, `when`, place.

**Bottom**: everything in the bottom third, ending at y = 1620, from the top down: stats row (y ≈
1290), 28 gap, turf line, 36 gap, icon + title, 14 gap, `when`, place. With the place line or a
two-line title the block grows upwards; the bottom edge never moves.

```
 TOP                                       BOTTOM
┌──────────────────────────────┐          ┌──────────────────────────────┐
│ ░░░░ top scrim plateau ░░░░░ │ 0        │                              │
│ ··········· 250 ············ │          │ ··········· 250 ············ │
│ DISTANCE                     │ 280      │                              │
│ 5.74 km                      │          │            photo             │
│ MOVING TIME                  │          │                              │
│ 34:44                        │          │ ░░░░ bottom scrim fade ░░░░░ │ 1000
│ AVG PACE                     │          │ ░░░░ plateau ░░░░░░░░░░░░░░░ │ 1240
│ 6:03 /km                     │          │ DISTANCE  MOVING TIME  AVG…  │ 1290
│ ● +128 new turf cells        │ ≈ 900    │ 5.74 km   34:44   6:03 /km   │
│ ░░░░ fade ░░░░░░░░░░░░░░░░░░ │ 920–1160 │ ● +128 new turf cells        │
│            photo             │          │ 🏃 OLIWA PARK RUN            │
│ ░░░░ bottom scrim ░░░░░░░░░░ │ 1240     │ 9 Nov 2026 · 17:36           │
│ 🏃 OLIWA PARK RUN            │          │ Oliwa, Gdańsk     CITYTURFER │ 1620
│ 9 Nov 2026 · 17:36           │          │ ··········· 300 ············ │
│ Oliwa, Gdańsk     CITYTURFER │ 1620     │                              │
│ ··········· 300 ············ │          │                              │
└──────────────────────────────┘ 1920     └──────────────────────────────┘
```

### Scrims (plain Views, no gradient library)

A scrim is one **plateau** View (`DARK.bg`, `opacity` 0.6) plus a **fade** of 12 bands, each 20
tall, `DARK.bg` with `opacity = 0.6 × (1 − (i + 0.5) / 12)` for band i = 0 (next to the plateau) …
11: 0.575, 0.525, 0.475, 0.425, 0.375, 0.325, 0.275, 0.225, 0.175, 0.125, 0.075, 0.025. Twelve small
steps of 0.05 keep banding invisible on a smooth sky; `pointerEvents="none"`.

| Layout | Top scrim                                  | Bottom scrim                                |
| ------ | ------------------------------------------ | ------------------------------------------- |
| Top    | plateau y 0…920, fade 920…1160 (downwards) | fade 1240…1480 (upwards), plateau 1480…1920 |
| Bottom | none                                       | fade 1000…1240 (upwards), plateau 1240…1920 |

If the stack grows (place line, two-line title), the plateau grows with it so every text sits on it:
plateau edge = content edge + 20.

### Legibility (worst case: a white photo)

`DARK.bg` at 0.6 over white is about `#6D6E71`; computed with `contrastRatio()`: `DARK.text` on it
**4.51 : 1** (body-text minimum, before the shadow), the white wordmark about 5 : 1. On a dark photo
the text is up to 17.2 : 1 (`DARK.text` on `DARK.bg`). A lighter plateau looks more like the
reference but fails: 0.5 → 3.2 : 1, 0.4 → 2.4 : 1. Tier colours over the same scrim: glowing 1.4,
strong 2.8, which is why the turf words stay `DARK.text`. Storybook checks: white, dark and busy
photo, both layouts, en + pl, longest values (`1:34:44`, `102,35 km`), a two-line Polish title.

## Design

### Dependencies (native: new dev build, not OTA)

| Package                  | Why                                                                                                   |
| ------------------------ | ----------------------------------------------------------------------------------------------------- |
| `expo-image-picker`      | Camera capture + system photo picker; config plugin adds `NSCameraUsageDescription`, Android `CAMERA` |
| `react-native-view-shot` | Renders the composed card `View` to a 1080×1920 JPEG                                                  |
| `expo-sharing`           | Hands the file to the system share sheet                                                              |
| `expo-file-system`       | Deletes the temp files and sweeps old Android cards (GPX export will reuse it)                        |

Add with `pnpm -C apps/mobile exec expo install …`. All four change the runtime fingerprint, so the
feature ships in a new build (iOS dev build + Android APK), never as an OTA update. Update the
"Export" line of `CLAUDE.md` (expo-file-system and expo-sharing now installed). Alternative
considered: `@shopify/react-native-skia` to draw the card; rejected for v1 (large binary, our fonts
and `@cityturfer/ui` already render in plain Views, and view-shot captures exactly what the preview
shows).

Usage strings: English only for now, like the location and Health prompts; Polish comes with the
native-strings release (decision L10 in `docs/decisions/mobile-i18n-2026-10-23.md`). E.g. camera:
"CityTurfer uses the camera to take a photo for your activity's share card. The photo stays on your
phone until you share it."

### Temp files

The picker's photo copy and the rendered card are ours, in the app's cache; `TempFiles` deletes only
files inside our temp folders. The **card** follows the `CardFiles` policy, chosen per platform in
`ExpoCardFiles` (Share Photo infrastructure):

- **iOS:** `shareAsync` resolves once the chosen action has finished, so the card is deleted right
  after sharing. Nothing to sweep.
- **Android:** `shareAsync` (expo-sharing 57) resolves when the chooser returns, not when the target
  has read the `content://` URI: Quick Share, Bluetooth, Drive, Gmail or Instagram (its own task)
  may still be reading it. So the shared card stays, named `cityturfer-share-card<digits>.jpg`
  (`cardFileName`), and a sweep deletes our cards older than **one hour** (`CARD_KEEP_MS`: slow
  uploads and transfers fit with room to spare; a leftover is about 1 MB of cache the OS may clear
  anyway) at app launch and on each return to the foreground (`useCardSweep` in the root layout),
  when the share screen opens and before each capture. Never when the screen closes: a background
  transfer may still be reading the card. The card is captured to base64 and written to the app's
  **internal** cache: a view-shot tmpfile may land in the external cache, which apps holding storage
  permission can read on Android 9 and older. The sweep lists the app's internal and external cache
  folders and deletes only files with that prefix.
- **Failures** (render failed, no share sheet, the sheet threw): the card is deleted at once on both
  platforms; no target has it.

Android permissions: `app.json` blocks `READ_EXTERNAL_STORAGE` (merged in by expo-file-system and
expo-image-picker) and `RECORD_AUDIO`: the library uses the Photo Picker and the card is written to
the app's own cache. `WRITE_EXTERNAL_STORAGE` stays (both libraries declare it with
`maxSdkVersion="32"`, so Android 13 and later never see it): on Android 7–9 (API < 29)
expo-image-picker's `launchCameraAsync` asks for it together with `CAMERA` and fails unless both are
granted, so blocking it made Take photo fail silently there.

### Place of an activity (Territory, `packages/core`)

New query in Territory's application layer, `GetActivityPlace`
(`container.territory.activityPlace`): activity id →
`{ city: CityView | null; district: string | null }`; the app hook `useActivityPlace` translates the
city name. It reads the activity's Track Points, finds the city from the city catalogue and, where
districts are bundled, the district holding most points with the existing `assignToDistricts` /
`districtContains` in `packages/core/src/contexts/territory/domain/district.ts`. Pure maths on the
phone; the result is only ever shown on the card the Turfer chose to share, never logged, stored or
sent. Unit tests with Gdańsk demo routes (`apps/mobile/src/dev/gdansk-demo.ts`): the Oliwa Park
route names Oliwa; a route outside any bundled city gives no place.

### New app context `apps/mobile/src/contexts/share-photo`

App-only (device feature, like Recording and Health Sync); besides `ActivityPlace` above, nothing in
`packages/core`, no migration, no API change. The "Don't ask again" flag is a per-user key in
`expo-secure-store`, like the achievements onboarding dismissal
(`apps/mobile/src/contexts/achievements/infrastructure/onboarding-dismissal.ts`).

- **domain/** (pure, unit-tested): `ShareCardContent` built by
  `shareCardContent(activity, claim, options)` →
  `{ title, typeIcon, stats: [{label, value, unit}], turfCells?, when, place?, layout }`. Holds the
  rules above: which stats per activity type, turf line only when > 0, place per the Off / City /
  District choice with its fallbacks. Formatting is injected (formatters + `t`) so the domain
  imports no React or i18n.
- **application/**: `ComposeShareCard` (activity id + options → content, reads Activity Log and
  Territory through their `index.ts`) and `ShareCardImage` port flow: pick photo → render → share →
  clean up.
- **infrastructure/** (ports → adapters): `PhotoSource` (`expo-image-picker`: `takePhoto()`,
  `pickPhoto()`, both returning `{ uri, width, height } | 'cancelled' | 'denied'`), `CardRenderer`
  (`react-native-view-shot` `captureRef`, 1080×1920 JPEG q 0.9), `ShareTarget` (`expo-sharing`),
  `TempFiles` (`expo-file-system`). Fakes for Jest.
- **ui/**: `share-photo-view.tsx` (preview + controls), `use-share-photo.ts`, `.constants.ts` files
  for types and constants (lint rule).
- **index.ts**: what the activity screen needs (`SharePhotoButton`).

### Overlay component in `@cityturfer/ui`

`packages/ui/src/share-overlay`: `ShareOverlay` takes ready-made strings (no formatting, no i18n, no
native code), draws scrims, stat stack, title block and wordmark at a fixed 1080×1920 design size
scaled to its container. Stories in `apps/storybook` with sample photos (light, dark, busy) and both
layouts, en + pl. Fonts: `FONT_FAMILY.numeric` for values, `FONT_FAMILY.display` for the title (both
bundled already). Colours and wordmark from `@cityturfer/brand`; no hard-coded hex. Fingerprint
check after the change (`design-system` skill).

### Screen and flow

New modal route `share-photo/[id]` in `apps/mobile/src/app/share-photo` (full-screen, dark):

1. Activity screen → **Share photo** → action sheet: **Take photo** / **Choose from library** /
   Cancel. Or, right after Finish, the same two choices straight from the "Share a photo?" card.
2. Picker returns → share screen shows the live card preview (photo + `ShareOverlay`), controls
   under it: layout, turf line, place (Off / City / District). **Change photo** re-opens the sheet.
3. **Share** → sweep old cards (Android) → render off-screen at 1080×1920 → share sheet → on close
   delete the card (iOS; on Android it stays for the sweep, see Temp files).
4. Cancel at any step returns to the activity screen; nothing is saved.
5. Camera permission denied → short explainer with "Open Settings" and "Choose from library".

test IDs: `share-photo`, `share-photo-camera`, `share-photo-library`, `share-card-preview`,
`share-toggle-layout`, `share-toggle-turf`, `share-place-off`, `share-place-city`,
`share-place-district`, `share-photo-send`, `share-photo-change`, `share-prompt`,
`share-prompt-camera`, `share-prompt-library`, `share-prompt-dismiss`, `share-prompt-never`.

`apps/mobile/src/app/(tabs)/record.tsx` pushes `/activity/${id}?justFinished=1`; the activity screen
shows the prompt only with that param and while the per-user flag is unset.

### i18n

New namespace `share` in `apps/mobile/messages/{en,pl}/share.json`: button, action sheet, toggles,
permission explainer, card labels (en "DISTANCE", "MOVING TIME", "AVG PACE", "AVG SPEED"; pl
"DYSTANS", "CZAS W RUCHU", "ŚR. TEMPO", "ŚR. PRĘDKOŚĆ"), "+{cells, plural, …} new turf cells" with
full Polish plurals. The card uses the app language. `audit:i18n` must pass; Polish wording per the
`mobile-i18n` glossary, copy reviewed by brand-designer.

## Work plan

Branch `feat/share-photo` → `scope/v0.16.0` (v0.15.0 is in release). Owners are the project agents.

| #   | Step                                                                                                                       | Owner                |
| --- | -------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| 1   | Card design: layout presets, scrims, sizes, copy en/pl, wordmark use                                                       | brand-designer       |
| 2   | Install the 4 packages, config plugin + usage strings, new iOS dev build + Android build                                   | mobile-ui-engineer   |
| 3a  | `ActivityPlace` query in Territory (core), tests on Gdańsk demo routes                                                     | location-engineer    |
| 3   | `share-photo` context: domain + application + ports, fakes, Jest tests                                                     | mobile-ui-engineer   |
| 4   | `ShareOverlay` in `@cityturfer/ui` + stories, fingerprint check                                                            | mobile-ui-engineer   |
| 5   | Share screen, action sheet, permission explainer, button + after-Finish prompt on the activity screen, i18n                | mobile-ui-engineer   |
| 6   | Tests: Jest, Maestro flow (library pick on the simulator's sample photos), device check                                    | mobile-test-engineer |
| 7   | Review (privacy, DDD boundaries, native vs OTA), then `ci:quality`                                                         | mobile-reviewer      |
| 8   | Docs: this plan → canonical, product brief / strategy note that photo sharing shipped without a map, CLAUDE.md Export line | docs-engineer        |

Rough size: 4–5 days of work, most of it in steps 3a and 4–6.

## Acceptance criteria

1. From any activity (just finished or from History), **Share photo** offers camera and library.
   Right after Finish the "Share a photo?" card shows once for that activity; Not now hides it,
   Don't ask again hides it for every later activity of that user; it never shows from History.
2. Picking from the library needs no photo-library permission prompt; camera asks once, and a denial
   shows a way to Settings and a way to the library instead.
3. The preview shows the photo filling 9:16 with distance, moving time and pace (walk, run) or speed
   (cycle), name, type icon, date and time, matching the activity screen's numbers exactly.
4. "+N new turf cells" shows when the activity claimed new cells, hidden when N = 0 or toggled off.
5. Place is Off by default; City shows the city name, District shows "district, city" (the Gdańsk
   Oliwa Park demo walk reads "Oliwa, Gdańsk"); District falls back to City where no district data
   exists. No map, route or coordinates anywhere on the card.
6. **Share** opens the system share sheet with a 1080×1920 JPEG; Instagram (story/post), WhatsApp
   and Save Image work on a real iPhone and an Android phone.
7. The shared JPEG carries no GPS EXIF (checked with `exiftool` on a saved copy).
8. Nothing is written to SQLite, backup queue or API; the photo copy is gone when the screen closes,
   the card when the sheet closes (iOS) or at the first sweep after an hour (Android).
9. Card text is in the app language (en, pl) with correct Polish plurals; `audit:i18n` passes.
10. Text stays readable on a white photo and on a dark photo (scrims), checked in Storybook.
11. `pnpm run ci:quality` passes; Maestro flow `share-photo.yaml` passes on the iOS Simulator.

## Risks

- **Native change:** all testers need a new build; plan it with a release, not an OTA.
- **Camera on simulator:** iOS Simulator has no camera; camera path is checked on a device only
  (`mobile-testing` skill). Maestro covers the library path.
- **Large photos:** 48 MP images can be slow; pick with `quality` < 1 and let view-shot downscale to
  the 1080×1920 target.
- **Fonts in capture:** view-shot captures rendered Views, so bundled fonts work; verify on Android
  (custom fonts in off-screen views).
- **Place leak:** a district name, repeated across many shared walks, narrows down where someone
  lives. Mitigation: Off by default, chosen per card, never remembered between cards.
- **Prompt fatigue:** a card after every Finish can feel pushy. Not now is one tap and Don't ask
  again turns it off; watch tester feedback.

## Founder decisions (2026-11-11)

1. Card format: 9:16 only, as in the reference.
2. Place label: both City and District, chosen per card, Off by default.
3. After Finish: yes, a "Share a photo?" prompt as well as the button.
4. Direct "Share to Instagram Stories" button: later.
