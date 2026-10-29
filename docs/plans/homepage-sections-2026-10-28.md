---
status: proposed
verified: 2026-10-28
owner: founder
scope:
  [
    'apps/web/src/app/[locale]',
    apps/web/messages,
    apps/web/tools,
    apps/web/e2e,
    apps/storybook/src/stories,
    packages/core/src/demo,
  ]
summary:
  Plan for the landing page's sections, top to bottom, presenting CityTurfer as an honest early
  prototype that recruits testers; a street-glow demo built from the Gdańsk demo data, audience,
  highlights, comparison, status, FAQ and a tester call, in six slices
---

# Homepage sections (plan)

Status: **proposed; slices 1–4 built** on `feat/web-homepage` (2026-10-28) with the recommended
answer to every decision below (D1 yes, D3 yes, D6 no, D7 yes, D8 no). The copy is a draft until
`brand-designer` and the founder sign it off (D4). Slice 5 (tester form) waits for D2, D5 and the
Brevo fields; slice 6 waits for the scroll-motion plan. Differences from the text below:

- the demo history spans four months, so beat 2 says "four months" rather than two;
- city cells are drawn as round dots, which halves the page weight at that scale;
- the tiers come at 1, 2, 4 and 7 visits, from the formula;
- the generator runs under `tsx` and writes JSON, which `pnpm test:unit` checks with `--check`;
- the hero's call to action is unchanged, so there's no "Become a tester" button until slice 5;
- "How it works" is unchanged.

It came out of a brainstorm with `product-manager`, `brand-designer`, `web-engineer` and
`mobile-ui-engineer` (2026-10-28). Rules: the `web-motion` skill (static export, no cookies, en/pl,
stories), `brand-system`, `brand-surfaces`, `product-knowledge` (promise checks). Owners:
`web-engineer` builds, `brand-designer` writes copy and signs off the look, `product-manager` checks
every claim, `mobile-reviewer` reviews each PR.

Related plans, both still proposed:

- the hero city map plan (`hero-city-map-2026-10-28.md` in docs/plans, being written in parallel)
  puts a street map behind the hero. It is compatible with this plan and can ship before or after
  it.
- `docs/plans/web-scroll-motion-2026-10-25.md` adds reveals to the sections. Its "no pinned
  sections" rule stands, so the street demo below **plays when it comes into view** and never pins
  the page.

## Goal

A first-time visitor understands in ten seconds what turf is, sees why it feels good to come back to
the same streets, trusts what happens to their routes, knows this is an **early prototype**, and
does one thing: becomes a tester or joins the waitlist.

The page is a prototype page, not a launch page. It recruits testers for the founder's interviews
(the open assumptions A1, A3–A6 in `docs/product/discovery-board.md`).

**Out of scope:** the portal (`/[locale]/account`), `/branding`, live map tiles or MapLibre on the
page, analytics or any third-party script, an iOS download, pricing.

## Who visits and what they must believe

The likely visitor is a city walker in Poland, on an iPhone, who repeats the same streets every week
and prefers private to social (`docs/product/icp.md`; an assumption, since the evidence log is still
empty). Visitors from running clubs or Reddit probably know Strava or CityStrides.

To act, they must believe:

1. their usual streets add up to something (the glow), which sections 3 and 4 show;
2. their routes stay theirs, which section 9 covers;
3. it's an honest early prototype that's worth trying, which the hero badge and section 10 cover.

## Ground rules for every section

- **Static and private:** server-rendered by default, no cookies, no storage, no requests outside
  our own origin (`apps/web/tools/check-export.mjs`). The one exception stays the Brevo form post.
- **Both languages:** every string goes in `apps/web/messages/en.json` and `pl.json`. Polish copy
  comes from `brand-designer` using the `mobile-i18n` glossary, and `audit:i18n` must pass.
- **Brand:** colours only from `@cityturfer/brand` CSS variables, headings in Big Shoulders
  capitals, turf ramp only for turf. Avoid leaderboard words ("conquer", "beat", "rank", streaks)
  and anything implying turf fades.
- **Components:** one component per section in `home-sections/` (split into files once it passes
  ~300 lines). Types and constants live in `*.constants.ts`, and every section gets a Storybook
  story.
- **Accessibility:** one `h1` (the hero), one `h2` per section with `aria-labelledby`. Decorative
  visuals are `aria-hidden`, and data visuals get `role="img"` plus a text alternative. WCAG AA in
  axe (`apps/web/e2e/landing.spec.ts`).
- **Motion:** only through the scroll-motion plan's `ScrollMotion` and `gsap.matchMedia`. With
  reduced motion or without JavaScript, the final state shows.
- **Promise check:** every claim is checked against code by `product-manager` before merge (list
  below).

### Claims we must not make (checked in code on 2026-10-28)

| Claim                                   | Why not                                                                                 |
| --------------------------------------- | --------------------------------------------------------------------------------------- |
| "No account needed"                     | `apps/mobile/src/app/sign-in.tsx` gates the app                                         |
| "Nothing leaves your phone"             | map tiles, gap routing and opt-in backup send data (`docs/product/launch-readiness.md`) |
| "Works on Android" / Android background | only run on the emulator; A3 is open                                                    |
| "On the App Store" / iOS download       | no TestFlight yet                                                                       |
| Apple Health on Android                 | HealthKit is iOS only, with no Health Connect                                           |
| "Never loses a run"                     | kill recovery is tested on a simulator and one iPhone only                              |
| City coverage %, sharing, GPX export    | not built                                                                               |
| User counts, testimonials, ratings      | none exist                                                                              |
| Gap routing as a feature                | PoC on the public FOSSGIS router; not for promotion                                     |

## Page outline

Top to bottom. **E** = exists today, **R** = revise, **N** = new.

| #   | Section                    | State | Priority | Effort | Slice |
| --- | -------------------------- | ----- | -------- | ------ | ----- |
| 1   | Hero                       | R     | must     | S      | 1     |
| 2   | Waitlist strip             | E     | must     | –      | –     |
| 3   | One street, four visits    | N     | must     | L      | 2     |
| 4   | How it works               | R     | must     | S      | 2     |
| 5   | Who it's for               | N     | must     | S      | 3     |
| 6   | Highlights                 | N     | should   | M      | 3     |
| 7   | Your week                  | E     | could    | –      | –     |
| 8   | How it differs             | N     | should   | S      | 3     |
| 9   | Yours alone                | R     | must     | S      | 1     |
| 10  | Where it stands            | N     | must     | S      | 1     |
| 11  | FAQ                        | N     | should   | S–M    | 4     |
| 12  | Become a tester + waitlist | R     | must     | S–M    | 5     |
| 13  | Footer                     | N     | must     | S      | 1     |

That's 13 blocks, so the page is long. Each new section is capped at one screen on a 390 px phone.
If the page feels long in review, cut 7, then 8, in that order.

---

### 1. Hero (revise)

- **Purpose:** what it is, who it's for, and that it's early.
- **Keep:** "Surf your city. Own your streets." with the ramp, the lede, the two coded phone screens
  (`hero-screens`), and the existing motion.
- **Add:**
  - a small **"Early prototype"** badge above the tagline, a pill in `--muted` and not the ramp.
    Key: `hero.badge`;
  - a sub-line that sets the scene, for example "For people who walk, run or ride the same streets
    every week." Key: `hero.audience`;
  - a primary button, "Become a tester", linking to `#tester`, and a secondary one, "Join the
    waitlist" (`#waitlist`), replacing the current waitlist-only call.
- **Download:** keep `StoreButtons` hidden (`NEXT_PUBLIC_ANDROID_APK_URL` unset) until decision D6.
  When it is shown, the note reads "Beta APK · not yet tested on Android phones".
- **Files:** `hero-copy/`, `messages/*.json`, the page story.
- **Accept:** the badge is visible at 390 px without scrolling, and the hero's LCP doesn't get
  worse.

### 2. Waitlist strip (exists, unchanged)

It stays right under the hero, as today. It gets the waitlist question from slice 5.

### 3. One street, four visits (new, the centrepiece)

- **Purpose:** show the glow mechanic without words, using honest numbers from the real rules.
- **Story, two beats:**
  1. **One street.** A short stretch of a real Gdańsk street from the demo history, drawn as its H3
     cells (res 11, about 50 m). Four steps light it Faint → Glowing → Strong → Blazing. Each step
     shows the tier name and the visit count that produces it.
  2. **Your city after two months.** It zooms out to the whole demo history: a glowing home
     neighbourhood with faint branches, plus a total line such as "4.1 km² · 1,530 cells", computed
     and not hand-written. This replaces the separate "before/after" section from the brainstorm.
- **Interaction, with no pinning or scroll-jacking:** when the section enters the viewport it plays
  once (about 4 s). Below the figure, four step buttons (the tier names) and a "Replay" button let
  the visitor scrub by hand. They are real `<button>`s with `aria-pressed`. With reduced motion or
  without JavaScript, beat 2 shows statically with all four tiers visible.
- **Data, built at build time and committed:**
  - New tool `apps/web/tools/gen-turf-demo.mjs` (with a test in `apps/web/tools/__tests__/`). It
    reads `planGdanskDemo` / `GDANSK_ROUTES` from `@cityturfer/core/demo`, turns tracks into cells
    with `@cityturfer/core/h3`, and computes strength with the **territory domain's own formula**
    from `@cityturfer/core/territory`. The page can therefore never show a tier the app wouldn't.
  - The visit counts per tier come out of the formula, not a hand-picked 1/3/6/12.
  - It picks the street as the most-repeated stretch in the demo, about 600 m, and pins it by route
    id so the output is stable.
  - The output is `apps/web/src/app/[locale]/turf-demo/turf-demo.data.ts`: hex polygons projected to
    a 1000 × 640 viewBox, rounded to 1 decimal, with the tier per step. Budget: ≤ 30 KB gzipped,
    checked by the test. h3-js never reaches the browser.
  - Spike question: can a `.mjs` tool import core's TS source directly, or does it need the runner
    the API's dev scripts use? Settle this in the slice-2 spike.
- **Drawing:**
  - inline SVG in a server component (`turf-demo.tsx`), so the final frame is in the HTML;
  - a client component (`turf-demo-motion.tsx`) only animates `fill-opacity` / class swaps per step;
  - tier fills are `var(--turf-*)`, glow uses layered opacity rather than `feGaussianBlur` (Safari
    cost), and a fixed `aspect-ratio` prevents CLS;
  - streets under the cells are optional: reuse the hero-city-map generator's Gdańsk layer if that
    plan ships first, otherwise cells only.
- **Copy (draft, en):**
  - eyebrow "Turf strength", title "COME BACK. IT GLOWS.";
  - step captions "1st visit · Faint", "{n} visits · Glowing", and so on;
  - beat 2: "Two months of walks in Gdańsk";
  - caption "Example data from our demo account." (required, D3).
- **Accessibility:** `role="img"` with an `aria-label` that tells the story ("A street in Gdańsk
  glows brighter with each visit: Faint after 1, Glowing after {n}…"), and the step buttons announce
  the tier.
- **Files:**
  - new: `turf-demo/` (`turf-demo.tsx`, `turf-demo-motion.tsx`, `turf-demo.constants.ts`,
    `turf-demo.data.ts`, `turf-demo.css`, `index.ts`);
  - new: `apps/web/tools/gen-turf-demo.mjs` and its test;
  - changed: `page.tsx`, `messages/*.json`;
  - new: a story with three states (play, reduced motion, each step).
- **Accept:**
  - the tier per step matches `@cityturfer/core/territory` for the same visits (the test runs the
    domain function);
  - no request outside our origin;
  - the data file is ≤ 30 KB gzipped;
  - CLS is unchanged, and it works with JavaScript off;
  - the step buttons work by keyboard;
  - it plays at most once without interaction.

### 4. How it works (revise lightly)

- Keep the three cards: record → turf gained → glow.
- Change card 3 so it points to section 3 rather than repeating it: the legend stays, and the body
  becomes "Every return makes a street brighter. Nothing fades." Cut the duplicate sentence.
- Check the "about 50 m" figure against res 11 (edge length about 25 m, so about 50 m across), and
  keep it.

### 5. Who it's for (new)

- **Purpose:** let visitors self-qualify, and say plainly who it isn't for.
- **Layout:** three cards in the Walk / Run / Ride type colours, each with an everyday scene, then a
  short "Not for you if…" line.
- **Copy (draft, en):**
  - title "WALK IT. RUN IT. RIDE IT.";
  - Walk: "The commute, the dog, the long way home.";
  - Run: "The loop you know, and the turn you've never taken.";
  - Ride: "Sunday rides that slowly fill in the map.";
  - "Not for you if you want leaderboards, crews or training zones. CityTurfer is just you and your
    streets."
- **Files:** `home-sections/audience.tsx`, messages, a story.

### 6. Highlights (new)

- **Purpose:** prove it's a real, working app, in a grid of 4–5 tiles. Each tile is a coded
  recreation (like `hero-screens`), not a screenshot. That avoids keeping images in two languages up
  to date, and it can reuse `@cityturfer/ui` patterns.
- **Tiles, in "wow" order:**
  1. **Turf gained:** the after-recording card "+0.12 km² · 18 new cells · 7 reinforced" (from
     `territory/ui/turf-gained-card.tsx`).
  2. **Records in your pocket:** live stats, auto-pause, "hold to finish", and "keeps recording with
     the screen off (iPhone)".
  3. **Apple Health import:** "Your past Apple Watch walks become turf on day one." Tagged
     **iPhone**, under decision D7.
  4. **Achievements:** a few badges and "There's no streak to keep."
  5. **Your city:** the Home City picker; the map opens on your city.
- **Platform tags:** each tile carries "iPhone" / "iPhone & Android" where it differs, taken from
  the promise table.
- **Files:** `home-sections/highlights.tsx` plus a constants file, messages, a story.
- **Accept:** `product-manager` signs off every tile's claim against the files listed in the
  brainstorm.

### 7. Your week (exists, unchanged)

It moves below the highlights. It's the first section to cut if the page is too long.

### 8. How it differs (new)

- **Purpose:** positioning for visitors who already use Strava or CityStrides. Calm and factual,
  with no "better than".
- **Layout:** three short rows, not a feature-matrix table, because a matrix invites "they have X"
  arguments.
  - "Repeats count": most apps count a street once; here every return makes it brighter.
  - "Nothing fades": your turf never decays, however long you're away.
  - "Private by default": no feed, no followers, no public profile.
- No competitor logos. Mention competitors by name only if decision D8 says yes.
- **Files:** `home-sections/differs.tsx`, messages.

### 9. Yours alone (revise)

- **Fix the overclaim:** keep the headline "Your phone keeps the original" and do not adopt "Your
  routes stay on your phone".
- **Points (draft, en):**
  1. Your activities are stored on your phone, in the app.
  2. Cloud backup stays off until you turn it on. Turn it off and our copy is deleted.
  3. What does leave the phone: map tiles for the area you view (OpenFreeMap), and, if you allow it,
     a gap-fill request with two rounded points (as in `launch-readiness.md`).
  4. You need an account for now; it's how backup and the web portal know it's you.
  5. This website sets no cookies and loads no trackers.
- **Gate:** `data-privacy-reviewer` reads the final wording. Link the privacy policy once it exists
  (D5).

### 10. Where it stands (new)

- **Purpose:** honesty, and it sets expectations for testers.
- **Layout:** three columns: **Works today**, **Being tested**, **Not yet**.
  - Works today (iPhone): recording with the screen off, turf map, history and stats, achievements,
    Apple Health import/export, English and Polish.
  - Being tested: the Android APK on real phones, battery use on long outings, opt-in cloud backup.
  - Not yet: App Store release, GPX export, sharing.
- The content is a typed list in `where-it-stands.constants.ts`, so it's one place to update per
  release. The `docs-engineer` "update all docs" pass checks it against the version.
- **Files:** `home-sections/where-it-stands.tsx`, constants, messages, a story.

### 11. FAQ (new)

- **Format:** native `<details>/<summary>` with no JavaScript, 6–8 questions.
  - Is it free? "Free while in testing."
  - Does it drain my battery?
  - Do I need an account?
  - Can I delete my data?
  - Android?
  - Does it work without Apple Watch?
  - Which cities? "Anywhere with streets; the map opens on your Home City."
- **SEO:** `FAQPage` JSON-LD, generated from the same message keys, so the visible text and the JSON
  never drift (a unit test compares them).
- **Copy:** every answer checked against the promise table, and the battery answer only says what
  we've measured.

### 12. Become a tester + waitlist (revise the final CTA)

- **Purpose:** the main conversion. The tester call comes first (D2).
- **Content:**
  - title "YOUR TURF STARTS AT YOUR DOOR" (kept);
  - a tester block: what testers do ("record 3 outings, then a 30-minute chat with the founder"),
    who we're looking for (iPhone, walks the same streets weekly), and what they get (early access,
    a say in what's next);
  - one form, reusing `WaitlistForm`, with:
    - a new required radio, **"Walk, run or ride?"** (tests A6);
    - a new optional checkbox, **"I'd like to test the prototype"**.
- **Data:** both are new Brevo attributes (`ACTIVITY`, `TESTER`) on the existing double-opt-in form,
  with no new processor. The privacy line under the form gets one more purpose, "and, if you tick
  it, to invite you to test". A form field change means a Brevo dashboard change first; check it
  with a real signup on the deployed site.
- **Anchor:** `id="tester"`. The hero's buttons point here and to the strip (#2).
- **Files:**
  - `waitlist-form/` with constants for `BREVO_FIELDS`, and props for `variant='full' | 'compact'`
    (the strip stays compact);
  - `home-sections/final-cta.tsx`, messages, a story.

### 13. Footer (new)

The page has no footer today. Add one with:

- contact email (`WAITLIST.contactEmail`);
- the privacy policy link (once D5 lands);
- the GitHub / project link if public (D9);
- the language switcher (repeat);
- the OSM credit if the hero map ships;
- "© CityTurfer {year}".

Use `<footer>` with `contentinfo`.

---

## Measuring it

There's no analytics on the public pages, by design, so we count only what Brevo already has:

- confirmed signups per week;
- the share who ticked "tester";
- the answers to "Walk, run or ride?".

Read these at each founder review. The tester share is the number this page exists for.

## Slices

One PR per slice from `feat/web-homepage-<slice>` into `scope/v0.14.0`, titled
`city-turfer - feat/web-homepage-<slice>` (the `ship-branch` skill). Slices 1 and 3 are small enough
to go straight to scope if the founder prefers.

| #   | Slice                   | Sections       | Effort   | Depends on              |
| --- | ----------------------- | -------------- | -------- | ----------------------- |
| 0   | Decisions + copy        | all            | ½ day    | founder, brand-designer |
| 1   | Honesty                 | 1, 9, 10, 13   | 1 day    | D1, D4                  |
| 2   | Street-glow demo        | 3, 4           | 3–4 days | D3; spike first (½ day) |
| 3   | Audience and proof      | 5, 6, 8        | 2 days   | D7, D8                  |
| 4   | FAQ + SEO               | 11, JSON-LD    | 1 day    | slice 1 copy            |
| 5   | Tester call             | 12, form       | 1 day    | D2, D5, Brevo config    |
| 6   | Motion for new sections | 5, 6, 8, 10–12 | 1 day    | scroll-motion slice 1   |

Ship slice 1 first: it's small and fixes what the page says today, before the page gets bigger.
Slice 2 is the biggest win. Start it with the ½-day spike: one street, the generator, and the
build-time import question. `brand-designer` signs off the look before the full build.

## Verification, every slice (the `verify-change` skill)

- `pnpm run ci:quality`, which runs Prettier, ESLint, tsc, Jest, `audit:i18n`, `audit:brand` and
  `audit:logs`.
- `pnpm run build`, then `apps/web/tools/check-export.mjs`: no external URLs, no cookies.
- Playwright `apps/web/e2e/landing.spec.ts`, extended per slice:
  - every new `h2` is present in `/en` and `/pl`;
  - axe finds no violations;
  - reduced motion shows the final state;
  - the request log shows only our origin (plus the Brevo post on submit).
- Storybook story per new section. Run `pnpm run brand:snapshot` for the contact sheet.
- Lighthouse mobile on the built page: LCP, CLS and TBT no worse than before slice 1.
- Look at the page yourself at 390 px and 1440 px, in both languages.
- `product-manager` promise check on the final copy, and `data-privacy-reviewer` on sections 9
  and 12.

## Decisions for the founder

Each has a recommended default; slices wait only on the ones listed in their row.

| #   | Question                                                               | Recommended                     |
| --- | ---------------------------------------------------------------------- | ------------------------------- |
| D1  | Show the "Early prototype" badge and "account needed for now"?         | Yes                             |
| D2  | Tester call as the main call to action, ahead of the waitlist?         | Yes                             |
| D3  | Show the Gdańsk demo data publicly (labelled as an example)?           | Yes                             |
| D4  | Approve the new headlines (sections 3, 5, 8, 10, 11) in en and pl?     | brand-designer drafts, you pick |
| D5  | Write a privacy policy before slice 5 (it adds a purpose to the form)? | Yes, blocking slice 5           |
| D6  | Show the Android APK button now, with the beta note?                   | No, until A3 is tested          |
| D7  | Feature Apple Health while iOS is "coming soon"?                       | Yes, tagged iPhone              |
| D8  | Name Strava / CityStrides in section 8?                                | No; describe, don't name        |
| D9  | Footer: link the repository or company?                                | Your call                       |

## Risks

- **Page length:** 13 blocks. Mitigate with the one-screen cap per section and the cut order (7,
  then 8).
- **Demo honesty:** the demo uses the real formula, a caption marks it as example data, and the test
  pins its numbers to core.
- **Copy drift between en and pl:** `audit:i18n` catches missing keys but not meaning, so
  `brand-designer` reviews both languages in each slice.
- **Status going stale:** section 10 is a single constants file, and the docs pass checks it each
  release.
- **Brevo fields:** form changes break signups silently. Do a real signup on the preview deploy
  before merge.
