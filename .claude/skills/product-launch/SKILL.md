---
name: product-launch
description:
  Getting CityTurfer from a founder's-phone PoC to TestFlight, Google Play and the App Store — the
  launch-readiness checklist (developer accounts, D-U-N-S, DSA trader status, removing the mock
  login, privacy policy and terms, privacy manifest, App Privacy label and Play Data safety,
  background-location and foreground-service declarations, HealthKit 5.1.3), GDPR for location data,
  store listings and ASO in PL/EN, beta programmes, release notes, rating prompts and what to do in
  the first weeks after launch. Use when someone asks "can we ship to the App Store", "what blocks
  launch", "TestFlight", "Play closed test", "privacy policy", "privacy label", "store listing",
  "release notes", or plans a beta or launch.
---

# Product launch

The checklist and its live status are in `docs/product/launch-readiness.md`. This skill is how to
work it. Store and privacy rules change often: before acting on an item, re-open its source and
update the doc's `verified:` date only for what you re-checked.

## Principles

- **The privacy promise is stricter than the law.** "Your routes stay on your phone" must stay true
  in the policy, the App Privacy label and the Data safety form. List every flow that leaves the
  phone (the doc's table); if a new feature adds one, the policy and labels change in the same
  version.
- **Declare honestly, even when it costs the "Data Not Collected" badge.** If an external service
  logs coordinates (gap routing does), either declare it or remove the flow.
- **Location is high-risk personal data** (not automatically Article 9, but routes can reveal
  health, religion, home). Treat it that way in copy, notifications and anything shared.
- **Reviewers need to see why.** Background location: review notes plus a short video of starting a
  recording and the screen-off track. HealthKit: say exactly which types and why.
- **No dark patterns at launch either**: no forced rating, no notification spam, nothing sensitive
  (street names, places) in notification text.

## Order of work

1. Accounts: D-U-N-S → Apple and Google **organization** accounts → DSA trader status. Long lead
   time; start first.
2. Product changes that are launch blockers: remove the mock login (local-only, no accounts), make
   the app useful with location denied, add a prominent background-location disclosure before the OS
   prompt (Play requirement), decide gap routing (opt-in, self-host, or confirmed terms). These are
   features: spec them (the `product-strategy` pitch) and build them with the `add-feature` skill.
3. Paperwork: privacy policy and terms (PL + EN) on the website; privacy manifest in
   `apps/mobile/app.json`; decision record on Health data and device backup.
4. Beta: TestFlight external group; Play closed test. Recruit from the waitlist; brief testers with
   what to try and how to send feedback (the `product-discovery` skill for what to ask).
5. Listings: PL + EN; Health & Fitness; first screenshots show the glowing Turf Map; copy from the
   `brand-system` skill, never promising what isn't verified on device.
6. Launch, then the first-weeks loop below.

## Store listing rules of thumb

- App Store: name and subtitle ~30 chars, keywords 100 **bytes** (Polish diacritics are 2 bytes; no
  repeats of the name), promotional text 170, What's New on every update.
- Play: title 30, short description 80, full 4,000, feature graphic 1024×500.
- Promise only what is verified on a real device (Android background recording is not, today).
- One positioning per listing; test headline variants on the website first.

## Release notes

Short, specific, in the user's words, PL and EN: what they can now do, what got fixed that they
would have noticed. Never internal names (contexts, PR numbers). Source the facts from
`CHANGELOG.md` and the session log, then rewrite for people.

## First weeks after launch

- Weekly: store reviews and TestFlight feedback into the evidence log
  (`docs/product/discovery-board.md`), App Store Connect / Play vitals for crashes and retention
  cohorts, one or two interviews.
- Judge retention **weekly**, not D1: people walk a few times a week. Health & Fitness D30 is
  roughly 3–8 % in published benchmarks; know the bar before celebrating.
- Rating prompt only after a positive moment (first claimed street, a strength tier up), never on
  first launch or after an error; iOS shows it at most 3 times a year.
- Run the PMF survey once there are qualified users (≥2 weeks, ≥3 activities).
