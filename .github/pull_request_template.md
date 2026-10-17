<!-- PR title MUST be: "city-turfer - <branch-name>", e.g. "city-turfer - feat/recording" -->
<!-- Targets: feat/* → scope/vX.Y.Z → release/vX.Y.Z → main (merge commits, no squash) -->

## Summary

<!-- What and why. Closes # -->

## Test plan

<!-- Commands run and devices/simulators used. Recording changes need a simulator replay or a real-device run. -->

- [ ] `npm run ci:quality` clean locally
- [ ] `npm run test:e2e` (Maestro, iOS Simulator) — required for scope → release

## Out of scope

## Risk & rollback

<!-- Native change (needs reinstall / new runtime fingerprint) or JS-only (OTA)? -->

<details><summary>📦 Delivery checklist (scope / release PRs)</summary>

| Area                       | Status |
| -------------------------- | ------ |
| Identity                   | ⬜     |
| Recording                  | ⬜     |
| Activity Log               | ⬜     |
| Territory / Turf map       | ⬜     |
| Branding                   | ⬜     |
| 🙋 Manual / founder action | ⬜     |

Legend: ✅ done · 🚧 in progress · ⬜ not started · ⚠️ blocked

</details>

## Quality gate

- [ ] No new TODOs, `console.log`, or raw coordinates in logs
- [ ] DDD dependency rules pass (`npm run test:arch`)
- [ ] Every review thread addressed and resolved before merge
