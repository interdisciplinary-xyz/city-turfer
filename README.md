# CityTurfer

**Surf your city. Own your streets.** Record your walks, runs and rides — every street you cover becomes your turf, glowing brighter each time you come back.

> Status: **proof of concept (v0.1.0)**, iOS. Single demo account, data stays on the device.

![CityTurfer mark](assets/brand/out/icon.png)

## What works

- Mock sign-in (`admin@turftrack.com` / `admin1234`)
- Walk / run / ride recording with live map and stats, auto-pause, pause/resume, recording with the screen locked, recovery after the app is killed
- History and activity detail (map, stats, km splits, turf gained), delete
- **Turf map**: permanent turf on an H3 hexagon grid, strength grows with repeat visits, heatmap glow, walk/run/ride filter
- Over-the-air updates (EAS Update, channel `production`)

## Quick start

```bash
npm ci
tools/fetch-maplibre-ios.sh        # once: vendor MapLibre (Xcode SPM download hangs on some machines)
npx expo run:ios                   # dev build on a simulator (Xcode 26.4+)
npm run ci:quality                 # Prettier + ESLint + tsc + DDD dependency rules + Jest
npm run test:e2e                   # Maestro suite on the booted iOS Simulator
```

## Docs

- Architecture & plan: [`docs/poc-plan.md`](docs/poc-plan.md) (Domain-Driven Design: Identity, Recording, Activity Log, Territory)
- Branching, releases, changelog: [`docs/process/RELEASE_MANAGER.md`](docs/process/RELEASE_MANAGER.md)
- Brand: [`.claude/skills/brand-system/SKILL.md`](.claude/skills/brand-system/SKILL.md)
- Working with Claude Code in this repo: [`CLAUDE.md`](CLAUDE.md)
