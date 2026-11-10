---
status: proposed
verified: 2026-11-10
owner: founder
scope:
  [
    apps/mobile/src/contexts/goals,
    apps/mobile/src/app/goal.tsx,
    apps/mobile/src/app/(tabs)/index.tsx,
    packages/core/src/contexts/activity-log,
  ]
summary:
  The founder's Goals request as one opt-in Daily goal in minutes of moving time a day, shown on the
  Start tab with the last 7 days; team plan from product, architecture and brand.
---

# Daily goal (Goals v1)

Founder request (2026-11-10): "Goals", defined daily in minutes. Planned by product-manager,
rn-architect and brand-designer; this file records the decisions where they disagreed.

## Why

The app rewards covering and returning to streets, but nothing helps people go out regularly. A
small daily target in minutes supports the habit without becoming a fitness ring: no "missed" days,
no nudges. A day under the goal is a partly filled day, never a failure. Bet, not evidence: no
tester has asked for it yet (discovery board).

## Rules (v1)

| Question          | Decision                                                                                                                                                                                |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Name              | **Daily goal** / **Cel dnia** in the UI (one goal, not a system of "Goals"); context `goals` in code                                                                                    |
| What counts       | **Moving time** (`movingS`, recorded + estimated), the number Stats shows as "Time"                                                                                                     |
| Types             | walk, run, cycle equally; Apple Health imports count (they are Activities)                                                                                                              |
| Day               | Local calendar day of the device; an activity counts in full on the **day it started** (same rule as Stats and onboarding; a 23:40–00:20 walk counts for the first day)                 |
| Range             | 10–180 min, step 5, suggested 30                                                                                                                                                        |
| On by default?    | **Opt-in.** Until set, the Start tab shows a "Set a daily goal" offer the Turfer can hide                                                                                               |
| Changing the goal | Applies from today. Past days keep the goal in force then (log of changes, one row per day). Turning it off hides the card from today; past days keep their goal                        |
| Live recording    | Counts toward today in real time (live `movingS` added on screen, never stored)                                                                                                         |
| Week              | The last 7 days ending today                                                                                                                                                            |
| Met               | moving seconds ≥ goal × 60; minutes shown rounded down                                                                                                                                  |
| Colours           | `ACCENT` for progress and met (brand: tier colours mean turf only); `border` for the empty track, `borderControl` for empty day outlines; never red for a day under the goal            |
| Out of scope      | notifications, goal achievements, per-type or weekly goals, cloud backup / API / web portal, Apple Health goals, Record-screen overlay, history beyond 7 days, travel across time zones |

## Streak (founder decision, 2026-11-10)

Product and brand had left streaks out (guilt risk). The founder asked for them, inspired by a "121
Day Streak" screen: the card now leads with a flame and "N-day streak".

- A streak is the days in a row the goal was met, each day judged by the goal in force then.
- Today joins once met; until then a run ending yesterday stands ("Meet today's goal to keep it
  going"). Without a streak: "Meet your goal today to start a streak", no zero.
- A day under the goal, with the goal off or before the first goal ends the run. Read back to the
  first day a goal was set (`metBeforeWeek`), so it reaches past the 7 days shown.
- Kind copy still applies: no "missed", "lost" or "broken" wording; the flame is the brand accent.
- Risk to watch with testers: the regret test (guilt or pressure). Soften first if it shows up.

## Design

New app context `apps/mobile/src/contexts/goals` (not core: no server needs it in v1; its domain is
pure so it can move later).

- **Activity Log (core)** gains a query `movingTimeSince(from)` / repository
  `startsBetween(from, to)` returning `{ id, type, startedAt, movingS }` (SQL range on `started_at`,
  no 500 cap).
- **Migration 15** (14 is the Health Sync history switch; this branch carries the same migration 14
  so versions stay contiguous):

  ```sql
  CREATE TABLE goal_daily_targets (
    effective_from TEXT PRIMARY KEY,   -- 'YYYY-MM-DD', device-local
    minutes INTEGER NOT NULL CHECK (minutes >= 0), -- 0 = goal off from that day
    set_at INTEGER NOT NULL
  ) WITHOUT ROWID;
  CREATE TABLE goal_state (id INTEGER PRIMARY KEY CHECK (id = 1), offer_hidden INTEGER NOT NULL DEFAULT 0);
  ```

  Range lives in the domain, not SQL. Saving appends `DailyGoalSet` to the outbox in the same
  transaction (no handler yet).

- **Domain (pure):** `LocalDay`, `LocalCalendar` port (`dayOf`, `startOf`, `addDays`),
  `DailyGoalMinutes.of(n)` (DomainError outside range or off-step), `goalOn(day, history)`,
  `goalDays(starts, history, calendar, today)`, `addLiveMovingTime(view, movingS)`.
- **Public contract** (`contexts/goals/contract.ts`), which the UI codes against:

  ```ts
  type LocalDay = string; // 'YYYY-MM-DD'
  interface GoalDay {
    day: LocalDay;
    goalMinutes: number | null;
    movingS: number;
    met: boolean;
  }
  interface DailyGoalView {
    goalMinutes: number | null; // in force today; null = off or never set
    offerHidden: boolean;
    today: GoalDay;
    week: GoalDay[]; // 7 days, oldest first, last = today
  }
  ```

  `container.goals`: `view.execute(): Promise<DailyGoalView>`, `set.execute(minutes | null)`,
  `hideOffer.execute()`; `DAILY_GOAL_LIMITS = { min: 10, max: 180, step: 5, suggested: 30 }`.

- **UI:** Start tab card under the greeting / restore card, before "This week": offer state (Set,
  hide) or progress (`goal-today`, bar, 7-day strip `goal-day-0…6`, Change). Editor as a modal route
  `/goal` (stepper `goal-minus` / `goal-plus` / `goal-value`, `goal-save`, `goal-off`), also reached
  from a "Daily goal" row in the Me tab. Progress bar and day strip as plain-View components in
  `@cityturfer/ui` with stories (no native code, fingerprint unchanged). i18n namespace `goals` en +
  pl, full Polish plurals.

## Acceptance criteria

1. A new Turfer sees only a hideable offer; hiding persists for that user.
2. The goal can be set 10–180 min in 5-minute steps; 30 is suggested.
3. Today's minutes = sum of `movingS` of activities started today (local), all types, Health imports
   included.
4. A 23:40–00:20 activity counts in full for the day it started.
5. During a recording, today's minutes rise with moving time; finishing does not double-count.
6. Changing 30 → 45 on Wednesday leaves earlier days judged at 30.
7. Deleting an activity updates today and the strip.
8. The card rolls over at midnight with the app open.
9. en + pl copy passes `audit:i18n`; no "missed", "behind" or "lost".
10. The streak counts days in a row with the goal met, back past the 7 days shown; today joins once
    met and an open today never breaks it; a day under the goal or with the goal off ends it.
11. Stored per user in local SQLite, not in cloud backup, no coordinates.
12. Jest covers the pure functions and the SQLite adapter; Maestro flow `19-daily-goal` sets a goal
    and sees the card.
13. `ci:quality` passes; runtime fingerprint unchanged (ships over the air).

## Success

≥ 4 of 6 testers who turn it on report more days out per week after two weeks, and 0 of 6 describe
it as guilt or pressure. If guilt shows up, soften or cut before adding anything.
