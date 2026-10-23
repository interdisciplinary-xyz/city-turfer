---
status: canonical
verified: 2026-10-23
owner: founder
scope: [apps/mobile/src/contexts/recording, apps/mobile/src/app, apps/mobile/messages]
summary:
  Manual physical-iPhone checklist before scope → release (screen-off walk, kill mid-run, OTA)
---

# Smoke test: iPhone checklist

Manual checks on a **physical iPhone** with a development or release build. Simulator runs and unit
tests do not prove background tracking (see `CLAUDE.md`). Run this before promoting `scope/vX.Y.Z`
to `release/vX.Y.Z`, and again on the OTA build before telling testers. Automated coverage is in
[`e2e.md`](./e2e.md).

Adapted from empatalk's smoke test (quality/SMOKE_TEST.md in that repo). Tick the boxes in a copy of
this list in the release PR, not in this file.

## 0. Setup

- [ ] Build under test noted (version, EAS update ID or commit): ________
- [ ] Location permission is "Always" and Precise Location is on (Settings, CityTurfer)
- [ ] Fresh install or `seed-demo` history available (Me, Info, developer tools, Seed demo history;
      or sign in as `demo@cityturfer.com` / `demo1234`, which fills Gdańsk demo data)
- [ ] Phone has a real GPS fix outdoors; battery above 30 percent, Low Power Mode off

## 1. Sign in

- [ ] Wrong password shows the error; `admin@cityturfer.com` / `admin1234` signs in
- [ ] Force-quit and reopen: still signed in

## 2. Screen-off walk (CP-3)

- [ ] Start a walk, lock the phone, put it in a pocket
- [ ] Walk about 10 minutes (at least 500 m), phone locked the whole time
- [ ] Unlock: the blue location pill or arrow was shown while walking, the live distance kept
      growing, no gap in the path
- [ ] Finish (hold to stop): distance within about 10 percent of what you walked, route continuous
      on the detail map, turf gained shown

## 3. Kill mid-run (CP-4)

- [ ] Start a run, move for about a minute, swipe the app away in the app switcher
- [ ] Keep walking for a minute, then reopen the app
- [ ] The recording is recovered: points from before and after the kill are in the session, the
      timer did not reset, Finish saves one activity (no duplicate, no lost segment)

## 4. Too short and discard

- [ ] Start and finish immediately: refused with Discard offered; Discard returns to the start state

## 5. Turf (CP-5, CP-6)

- [ ] Turf tab shows the new corridor; walking the same street again makes it brighter
- [ ] Delete that activity: confirmation shown, row gone from History, Turf map no longer shows the
      cells that only it covered (this is not covered by Maestro)

## 6. Sign-out refused while recording

- [ ] Start a recording, then Me, Account, Sign out: refused with "Recording in progress. Finish or
      discard your recording first."
- [ ] Finish the recording, sign out again: returns to the sign-in screen

## 7. OTA receipt

- [ ] After publishing the EAS Update on `production`: Me, Info, Check for updates reports the new
      update; after restart `app-version` and update ID match the published one
- [ ] The recording and turf from earlier steps are still present after the update (SQLite
      migrations ran, no data loss)

## 8. Dashboard and Me drawer (CP-7, CP-8)

- [ ] Dashboard greeting, this-week distance and recent activities render; achievements card opens
- [ ] Me tab opens the drawer; tapping outside closes it; Profile, Account and Info open

## 9. Language (CP-13)

- [ ] Me, Info, Language, Polish: Info, Dashboard, Stats and Record show Polish; plurals read right
      (1 / 2-4 / 5+ activities)
- [ ] Force-quit and reopen: still Polish; System brings English back (leave it on System)

## Result

Record device model, iOS version, build and any failure with a screenshot in the release PR. A
failure in sections 2, 3 or 6 blocks the release.
