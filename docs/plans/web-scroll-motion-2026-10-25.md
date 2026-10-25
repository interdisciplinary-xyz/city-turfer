---
status: proposed
verified: 2026-10-25
owner: founder
scope: ['apps/web/src/app/[locale]', .claude/skills/web-motion]
summary:
  Plan for GSAP ScrollTrigger reveals on the landing page below the hero (waitlist, how it works,
  your week, local-first, closing call to action) in the brand's glow-in language, with nothing
  hidden by CSS, a reduced-motion path, no layout shift and one small client bundle
---

# Scroll motion on the landing page (plan)

Status: **proposed**, for the founder to approve. Builds on #175 (the homepage in the app's pieces)
and #177 (plain headline). Rules: the `web-motion` and `gsap-react` skills.

## Goal

The homepage is now several screens long, but only the hero moves. As each section scrolls into view
it should **glow in** the way the app does: cards rise and fade in, the turf legend lights up tier
by tier, numbers count up, the Dashboard card assembles. Every effect is quiet, plays once, and
never blocks reading.

**Out of scope:** scroll-jacking, pinned storytelling sections, parallax backgrounds (the page is
flat dark on purpose), horizontal scroll, animating the portal or `/branding`.

## Motion map

All entrances use `expo.out`, take 0.6–0.9 s, stagger 0.08–0.12 s, and play **once** (`once: true`).
A section starts when its top passes about 85% of the viewport height (`start: 'top 85%'`).
Transform and opacity only.

| Section                | What moves                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Waitlist               | The title rises 16 px and fades in; the form row follows 0.1 s later. It is often visible at load on tall screens: the trigger then fires at once, right after the hero entrance.                                                                                                                                                                                                                                                                                           |
| How it works           | The eyebrow and title rise. The three cards rise 32 px in a 0.12 s stagger (`ScrollTrigger.batch`, so a card that enters late animates on its own). Inside each card, after it lands: card 1, the type chips arrive left to right and the Record button pulses once (scale 0.92 → 1 with its glow ring); card 2, `+0.12 km²` counts up from 0.00 and the cells line follows; card 3, the legend steps light up faint → blazing (`scaleX` 0 → 1 from the left, 0.1 s apart). |
| Your week              | The copy column rises. The Dashboard figure rises 40 px; inside it the stat values count up (43.64 km, 4 activities; the time stays static), the three activity rows slide up 12 px in a stagger, and the achievements bar fills (`scaleX` 0 → 9/20 from the left).                                                                                                                                                                                                         |
| Local-first            | The card rises; the three points follow in a 0.08 s stagger, each diamond bullet scaling in first.                                                                                                                                                                                                                                                                                                                                                                          |
| Closing call to action | The title and line rise; the pink button fades in last and its glow brightens once.                                                                                                                                                                                                                                                                                                                                                                                         |
| Hero phones (optional) | Desktop only, scrubbed: the two phones drift up to 40 px apart at different speeds as the hero scrolls away (`scrub: 0.5`), which reads as depth. It composes with the existing pointer tilt, which sits on the `.screens` parent. Leave it out if it feels busy.                                                                                                                                                                                                           |

The count-ups write numbers in the page's locale (`0,12` in Polish), and the final value is already
in the server-rendered HTML.

## Technical design

### One client component: `ScrollMotion`

- `apps/web/src/app/[locale]/scroll-motion/` (`scroll-motion.tsx` + `scroll-motion.constants.ts` for
  `START`, `STAGGER` and the role names). It wraps everything under the hero in `page.tsx`, and its
  root ref is the `useGSAP` scope, like `HeroMotion`. The page and the sections stay server
  components; `ScrollMotion` is the only new client code.
- `gsap.registerPlugin(useGSAP, ScrollTrigger)` (ScrollTrigger ships in the `gsap` package we
  already use; no new dependency, so the `turbo-ignore` graph is unchanged).
- Elements opt in with **`data-reveal="<role>"`** (for example `title`, `card`, `row`, `step`,
  `count`, `fill`), never the hero's `data-anim`.

### Nothing hidden by CSS

The hero hides `.motion [data-anim]` before the first paint and has a 2.5 s fail-safe. That can't
work for content far down the page, so `data-reveal` gets **no CSS rule at all**:

- the initial state is set in JS when the triggers are created
  (`gsap.set(..., { autoAlpha: 0, y })`). Those elements are below the fold at that moment, so there
  is no flash;
- anything already in view when the triggers are created (a tall screen showing the waitlist) fires
  at once;
- without JavaScript, with a failed bundle, in reader mode, in print and in find-in-page, all
  content is simply visible.

### Reduced motion and devices

- `gsap.matchMedia()` with `animate: '(prefers-reduced-motion: no-preference)'`. Without it, no
  triggers are created and nothing is set, so the page is the static one.
- Phone parallax only on `(min-width: 960px) and (pointer: fine)`, and never with reduced motion.
- Count-ups only with `animate`; the static number is the default.

### Timing with the hero and the page loader

- `ScrollTrigger.refresh()` after `PAGE_LOADED_EVENT` (fonts and layout settled), so trigger
  positions match the final layout. Until then the triggers are created but not refreshed.
- `ScrollTrigger.config({ ignoreMobileResize: true })` stops a recalculation each time the iOS
  address bar shows or hides.
- In-page links (`#waitlist`, header "Join the waitlist") keep working: only transforms move, so
  scroll positions don't change.

### Accessibility of the count-ups

The numbers count by writing `textContent` from `onUpdate`. The figure carries an `aria-label` with
the final value (the app's Stat does the same), so a screen reader never hears the partial numbers.
The legend and the progress bar keep their `role`, label and `aria-value*`.

### Cleanup

`mm.revert()` in the `useGSAP` cleanup kills every trigger and restores inline styles; HMR and route
changes leave nothing behind.

### Bundle

ScrollTrigger adds about 12–15 KB gzipped to the homepage's client JavaScript. Check the build
output (the `/[locale]` route's first-load JS) before and after; the budget is **≤ +20 KB**. Both
motion components should share one gsap chunk.

## Files

| File                                                     | Change                                                                |
| -------------------------------------------------------- | --------------------------------------------------------------------- |
| `apps/web/src/app/[locale]/scroll-motion/*` (new)        | The component and its constants                                       |
| `apps/web/src/app/[locale]/page.tsx`                     | Wrap the sections after the hero in `<ScrollMotion>`                  |
| `apps/web/src/app/[locale]/home-sections/*.tsx`          | `data-reveal` roles; `data-count` (final value, decimals) on numbers  |
| `apps/web/src/app/[locale]/waitlist-form/*` / `page.tsx` | `data-reveal` on the waitlist title and form row                      |
| `apps/web/src/app/[locale]/home-sections/*.css`          | `transform-origin: left` on the legend steps and the progress fill    |
| `.claude/skills/web-motion/SKILL.md`                     | ScrollTrigger is in the stack; the `data-reveal` rule; updated checks |

No change to `packages/brand`, `packages/ui` or the app. No new copy.

## Slices

1. **Reveal frame:** `ScrollMotion` with matchMedia, the refresh on page load, and section and card
   reveals (title, cards, figure, points, call to action). Reviewable on its own; most of the
   effect.
2. **App details:** chips and Record pulse, legend lighting, achievements fill, the activity row
   stagger.
3. **Count-ups:** turf gained and the week stats, locale-aware, with the `aria-label`s.
4. **Optional parallax:** the hero phones, behind its own decision after slices 1–3 are seen.
5. **Harness:** the `web-motion` skill update; the production check now allows gsap in the hero and
   scroll-motion chunks.

Owner: `web-engineer` builds. `brand-designer` judges the motion feel in a real browser after slices
1 and 2. `mobile-reviewer` reviews before each PR. One PR per slice into the active scope, or slices
1–3 together if they stay small.

## Acceptance criteria

- With JavaScript off, or with reduced motion on, every section is fully visible at load and nothing
  moves.
- Each section animates once on the way down; scrolling back up doesn't replay it.
- No layout shift: Lighthouse CLS stays at 0 on /en at 390 and 1440, and the page's height doesn't
  change while animating.
- Content already in view on load (the waitlist on a tall screen) shows within the hero entrance,
  never as an empty gap.
- Count-ups end on exactly the server-rendered value in en and pl; screen readers announce only the
  final value.
- `#waitlist` links land on the form with the header offset, before and after the reveal.
- 320 px: no horizontal scroll during any animation (the 40 px rises are vertical only).
- First-load JS on `/[locale]` grows by ≤ 20 KB gzipped; there are no third-party scripts, and the
  static export (`apps/web/out`) contains gsap only in the motion chunks.

## Verification

- Gate: `TURBO_FORCE=true pnpm run ci:quality`.
- Layout: `node apps/web/tools/viewports.mjs --paths /en,/pl` with `--reduced-motion` (headless
  Chrome is too slow to judge motion).
- Motion itself: a real browser on https://cityturfer.local, scrolling at normal and fast speed,
  then again with the OS "Reduce motion" setting on, and once with JavaScript disabled.
- Lighthouse (mobile and desktop) on the production build, for CLS and Total Blocking Time.

## Open questions for the founder

1. **Count-ups on example data:** they draw the eye to numbers that are examples (labelled as such).
   Keep them, or count only the turf gain?
2. **Phone parallax (slice 4):** try it, or keep the hero still?
3. **Replay:** once per visit (proposed), or replay each time a section re-enters from below?

## Estimate

Slices 1–3: about a day of build and review, plus a real-browser pass. Slice 4: half a day if
approved.
