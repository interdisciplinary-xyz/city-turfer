---
name: web-motion
description: >-
  "make the page feel alive", "animate the hero", jank, flash or layout shift on the landing page;
  any change to apps/web. The site's ground rules (static export, waitlist privacy, en/pl copy,
  stories, Vercel) and its GSAP motion: language, reduced motion, boot script, verifying motion.
---

# Web motion (apps/web)

The site's ground rules come first (they bind every change to `apps/web`, not only motion); the
motion rules follow. Both the `web-engineer` and the `mobile-reviewer` work from this file.

## Site ground rules

- **Static export** (`output: 'export'` in production): no API routes, server actions, cookies,
  analytics or third-party scripts. Nothing dev-only (dev toolbar, test URLs) and no secrets in
  `apps/web/out`.
- **Copy** lives in `apps/web/messages/en.json` and `pl.json` with identical keys; never hard-code
  user-facing text. Polish is a real translation, not a calque. The wording is the
  `brand-designer`'s; the `web-engineer` adds keys and wires them.
- **Waitlist = personal data.** The email goes straight to Brevo (EU) with double opt-in. Keep the
  required, unticked consent checkbox, the privacy note naming the controller and the removal
  contact (`NEXT_PUBLIC_WAITLIST_CONTROLLER`, `NEXT_PUBLIC_CONTACT_EMAIL`) and the honeypot; the
  form renders only when all its `NEXT_PUBLIC_*` variables are set. No extra fields, pixels or
  embeds.
- **Shared tokens:** colours and the brand name come from `@cityturfer/brand` (CSS variables from
  `cssVariables(SITE_SCHEME)` in `[locale]/layout.tsx`). The site is light, with no theme switch;
  maps and map images sit on a night panel (`DARK.bg` / `DARK.card`), with `wordmark.svg` there and
  `wordmark-light.svg` elsewhere. Text and lines use the `-text` / `-graphic` variables, never the
  raw `--glow`, `--walk`, `--run` or `--ride` (`brand-system` skill). A change in `packages/brand`
  also changes the mobile app.
- **Stories:** every component in `apps/web/src/app/[locale]/` has a story in
  `apps/storybook/src/stories/website/`, except pure motion wrappers (`hero-motion`) and dev-only
  pieces (`dev-toolbar-with-app`). Website pieces stay synchronous (`useTranslations`, not
  `await getTranslations`): Storybook cannot render async server components.
- **Accessibility:** real labels, visible focus, `prefers-reduced-motion` respected, no horizontal
  scroll from 320 px, text contrast on the light background (and on night map panels).
- **Hosting:** Vercel project `city-turfer-web`, root `apps/web`. `apps/web/vercel.json` holds the
  `/` → `/en` or `/pl` redirect and a `turbo-ignore` build skip: a new workspace dependency must
  appear in turbo's graph or deploys skip it. `NEXT_PUBLIC_*` values are build-time: set on Vercel
  (or an untracked `apps/web/.env.local`), never committed. The APK link follows
  `docs/operations/android-release.md`.

Read the general GSAP + React rules in the `gsap-react` skill first (useGSAP, scope, contextSafe,
cleanup, SSR). This skill adds what is specific to CityTurfer.

## Stack

- `gsap` + `@gsap/react` in `apps/web`. Register `useGSAP` once per module:
  `gsap.registerPlugin(useGSAP)`. No ScrollTrigger yet (the page is one screen).
- Motion lives in client components under `apps/web/src/app/[locale]/` (e.g. `hero-motion/`). Pages
  stay server components; they mark elements with `data-anim` and wrap them in the motion component,
  which passes its root ref as `scope`.
- The site is a **static export**: no GSAP during render, everything inside `useGSAP`.

## Motion language (brand)

The brand is the turf strength ramp: things **glow in**, they don't bounce.

- Eases: `expo.out` for entrances (`EASE` in `hero-motion.constants.ts`), `power3.out` for
  interactive follow (pointer), `sine.inOut` for ambient loops. No `back`, `elastic` or `bounce`.
- Durations: entrances 0.6–1.2 s, staggers 0.08–0.15 s, the whole entrance done in about 2 s.
  Ambient loops slow (≥ 5 s) and subtle (the headline ramp drifting).
- Order on load: mark → wordmark → headline lines → lede and calls to action → phones rise alongside
  (they start early, at 0.25 s).
- Animate **transform and opacity only** (`x`, `y`, `scale`, `rotate`, `autoAlpha`,
  `backgroundPosition` for the ramp). Never width, height, top/left or margins: no layout shift.
- Copy stays readable: never animate text letter by letter; lines rise by ≤ 0.5 em.

## No flash, no stuck content

- `MOTION_BOOT_SCRIPT` (inline in `<head>` of `[locale]/layout.tsx`) adds `.motion` to `<html>`
  before the first paint unless reduced motion is on; CSS hides `.motion [data-anim]`. GSAP reveals
  them with `autoAlpha` and adds `.motion-ready`. If the bundle never runs, the script removes
  `.motion` after 2.5 s, so nothing stays hidden.
- `<html suppressHydrationWarning>` exists only because of that class; don't add other client-only
  attributes to `<html>`.
- New animated element: give it `data-anim="<role>"` and add it to the timeline. An element with
  `data-anim` that no tween reveals stays invisible for 2.5 s; check the role name matches.

## Reduced motion and devices

- Wrap everything in `gsap.matchMedia()` with an `animate` condition
  (`prefers-reduced-motion: no-preference`). Without it: `gsap.set('[data-anim]', { autoAlpha: 1 })`
  and nothing moves (no loops either).
- Pointer effects (phone tilt) only for
  `(prefers-reduced-motion: no-preference) and (pointer: fine) and (min-width: 960px)`, through
  `gsap.quickTo`, handlers wrapped in `contextSafe` and removed in the matchMedia cleanup.
- Revert in cleanup: `mm.revert()` and remove `.motion-ready`.

## Verify

- `pnpm --filter @cityturfer/web lint && pnpm --filter @cityturfer/web typecheck && pnpm --filter @cityturfer/web build`,
  then look at it: `node apps/web/tools/viewports.mjs --paths /en,/pl` (sizes 320–1440 by default).
- **Headless Chrome advances animation frames far slower than real time**: screenshots catch
  entrances half-way. For layout checks render with `--reduced-motion` (everything visible at once);
  judge the motion itself in a real browser on https://cityturfer.local (`pnpm run web:dev`), also
  with the OS "Reduce motion" setting on.
- The production export must not change: no motion code in `out/` except the hero bundle; no
  third-party scripts. Check: `grep -rl "gsap" apps/web/out | head` (only the hero chunk) and
  `grep -rEl "https?://[^\"]*" apps/web/out --include=*.html` for unexpected external script `src`.
