---
status: proposed
verified: 2026-11-01
owner: founder
scope:
  [
    'apps/web/src/app/[locale]',
    apps/web/src/app/globals.css,
    apps/web/messages,
    apps/web/e2e,
    apps/storybook/src/stories/website,
  ]
summary:
  Three-phase tidy-up of the landing page (bugs and one heading system, then fewer sections and one
  button/card grammar, then polish), approved by the founder on 2026-11-01
---

# Homepage tidy-up (2026-11-01)

The founder approved this plan after an audit of `/en` and `/pl` at 320, 390, 1024 and 1440 px. It
ships as three phases on one branch (`feat/web-homepage-tidy`), one PR per phase going into the
active scope.

## Phase 1: bugs and one heading system

- **B1** Overflow at 320 px: `.home-split` has no column template below 860 px, so it grows to the
  min-content of the dashboard figure (`scrollWidth` 326 px on `/en`, 339 px on `/pl`, hidden by
  `body{overflow-x:hidden}`). Fix, plus a 320 px no-horizontal-scroll test.
- **B2** The Polish header link fails axe `label-content-name-mismatch` (visible "Lista", name
  "Dołącz do listy"). Fix in markup (accessible name equals visible text) and in copy (one Polish
  call to action).
- **B3** The Apple Health claim differs between "What it does today" and "Where it stands". Works
  today: Apple Health import (iPhone). Being tested: saving to Apple Health (export is not checked
  on a device; `docs/product/product-brief.md`, section 10).
- **Idea 1** One section heading system: `Section` and `SectionHead` (eyebrow, h2 claim, optional
  lede), anchor ids for every section, the waitlist strip with a real `h2`.
- **Idea 2** Section links in the header from 1024 px (How it works, The app, Privacy, FAQ), the
  current section highlighted with an `IntersectionObserver`, a smaller pill call to action.

## Phase 2: "Tidier page"

- Merge 11 sections into 6.
- "How it works" before the glow demo.
- A calmer hero.
- One button system.
- A maximum content width.
- One card grammar.

## Phase 3: "More polish"

- Spacing rhythm and alternating light bands.
- One icon set.
- A real footer.
- Scroll-in glow motion.
- A compact tablet hero.
- A trust row near the final form.
- A font trim.
- 320 and 768 px tests.

## Decisions taken

- No header links on phones: logo, call to action and language only.
- Merge to 6 sections and cut "Your week".
- Drop the big hero icon and wordmark.
- Keep both waitlist forms (the strip under the hero and the final one).
- Alternating light bands with no new dark band, so
  `docs/decisions/brand-light-website-2026-10-29.md` is unchanged.
- One Polish call to action: "Zapisz się na listę", short "Zapisz się".
- No portal sign-in link in the footer. This stays an open founder decision.
