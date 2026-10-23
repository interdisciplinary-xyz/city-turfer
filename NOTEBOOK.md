**0.2.0** Navigation, Me drawer, achievements

Scope: `scope/v0.2.0` → `release/v0.2.0` (#18). Area prefixes are the commit scopes.

- [x] APP-SHELL: tabs Dashboard · Turf · Record · Stats · Me; History out of the tab bar (#23)
- [x] APP-SHELL: Me opens a drawer with Profile, Account and Info (#24)
- [x] ACHIEVEMENTS: twelve achievements with progress; Dashboard card with the next one in reach
- [x] IDENTITY: mock account `admin@cityturfer.com`; keyboard Next moves to password (#25)
- [x] RELEASE: pin `app.json` to 0.2.0 (f04bcf3)

- [ ] DOCS: docs conventions, frontmatter, generated index, `pnpm run audit:docs` (#38)
- [ ] DOCS: architecture decisions + MapLibre decision record (#39)
- [ ] DOCS: domain architecture and feature inventory (#40)
- [ ] DOCS: runbook and OTA release procedure (#41)
- [ ] DOCS: session log v0.2.0 — add the Dashboard, Me drawer and login rename (it is ❗ stale)
- [ ] APP-SHELL: onboarding checklist (#34, in review)
- [ ] RECORDING: in-review fixes — session concurrency (#29), headless container (#32), auto-pause
      resume (#31), record a11y (#26)
- [ ] PLATFORM: outbox and retention (#30, in review)
- [ ] ACTIVITY-LOG: gap-route semantics (#33, in review)
- [ ] APP-SHELL: gate the demo seeder (#27, in review)
- [ ] TOOLING: CI quality gates, secret guard, log audit (#28, #36, #37)
- [ ] E2E: audit the Maestro suite (#35); run the full suite (`pnpm run test:e2e`) on scope before
      scope → release
- [ ] RELEASE: native reinstall on the iPhone before **2026-10-23** (free Apple ID signing expires;
      runbook #7)

---

**0.3.0** Turf you can measure, faster with history

- [ ] TERRITORY: dashboard turf gauge — city coverage; decide what 100 % means first (streets
      covered, area, or district first)
- [ ] TERRITORY: turf read model — keep summary totals in SQLite instead of loading every cell into
      JS on each `GetTurfSummary`
- [ ] TERRITORY: decide whether estimated gap routes may claim turf (shown dimmer until really
      covered)
- [ ] ACTIVITY-LOG: shared activity cache + SQL aggregates — Dashboard, Stats, Profile, Achievements
      and Turf each load up to 500 activities and total them in memory; all-time undercounts past
      500
- [ ] ACTIVITY-LOG: rename activity in the detail screen (`RenameActivity` exists, no UI)
- [ ] ACTIVITY-LOG: history thumbnails
- [ ] RECORDING: incremental live track — append new points instead of re-reading the whole track
      after every batch (`GetLiveTrack`)
- [ ] RECORDING: native module lifecycle — start, stop and re-acquire the background session with
      the Recording Session instead of on every ingested batch
- [ ] RECORDING: dual-stream dedupe — drop duplicate fixes from the native and expo-location streams
      explicitly, then decide whether to switch the expo-location stream off (battery)
- [ ] RECORDING: Android on a real device — install the Android SDK, mid-range phone, Q1 and Q4
      field tests
- [ ] APP-SHELL: share card — share an activity's route and turf as an image
- [ ] APP-SHELL: feedback prompts — ask testers for feedback in the app
- [ ] ACHIEVEMENTS: unlock celebration, unlock dates (more tiers and groups: v0.10.0,
      `docs/decisions/achievements-list-2026-10-23.md`)
- [ ] TERRITORY: performance test with a year of history (Q4 budget)
- [ ] DOCS: PoC report (M6) with evidence per question
- [ ] DOCS: move `docs/poc-plan.md` into a folder; add `pnpm run audit:docs -- --strict` to
      `ci:quality`
- [ ] RELEASE: App Store — organisation vs individual developer account, final bundle id, no login
      vs Sign in with Apple
