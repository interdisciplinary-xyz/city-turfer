---
status: canonical
verified: 2026-10-23
owner: founder
scope: [docs/product]
summary:
  The live state of product discovery — evidence log, assumption map, opportunity tree and the
  interview queue; every product claim cites an id from here
---

# Discovery board

Canonical for: what we have actually learned from people, and what we still assume. Method: the
`product-discovery` skill. Rules: pseudonyms only, no contact details, no locations finer than a
city; tag every source `friend | acquaintance | stranger`; never add an entry that didn't happen.

## Outcome we're working toward

Testers record **≥3 activities in weeks 2–4** without being nudged (self-reported or via a stats
export). Baseline: unknown.

## Evidence log

| Id  | Date | Source (type, segment, relation) | What happened / verbatim | Opportunities touched | Commitment |
| --- | ---- | -------------------------------- | ------------------------ | --------------------- | ---------- |

_Empty — no interviews, surveys or tester reports recorded yet (checked 2026-10-23). The founder's
own use of the app is real but counts as `founder`, not as market evidence._

## Assumption map

Importance and evidence are 1–5. Test high importance + low evidence first. All rows are
**assumptions** seeded from the product brief and market research.

| #   | Assumption                                                                           | Type         | Imp | Ev  | Cheapest test                                                        | Pre-registered criterion                          | Status |
| --- | ------------------------------------------------------------------------------------ | ------------ | --- | --- | -------------------------------------------------------------------- | ------------------------------------------------- | ------ |
| A1  | Seeing streets glow brighter on return is a reason to go out again                   | Desirability | 5   | 1   | 2–3 week diary study, 8 testers                                      | ≥5/8 mention turf/glow as a reason to go out      | open   |
| A2  | People understand the Turf Map without explanation                                   | Usability    | 5   | 1   | 5 hallway tests: "show me your streets and the ones you visit most"  | ≥4/5 succeed unaided                              | open   |
| A3  | Background recording is reliable on a mid-range Android phone                        | Feasibility  | 5   | 1   | 10 real outings on 2–3 Android phones, screen off                    | ≤1 gap >30 s per hour, no lost activity           | open   |
| A4  | Apple Health import creates a day-one "wow"                                          | Desirability | 4   | 2   | Watch 5 people with Watch history import and react                   | ≥4/5 react positively unprompted                  | open   |
| A5  | "Nothing leaves your phone / no account" is a reason to choose us                    | Desirability | 4   | 1   | Website headline variants (privacy vs glow) by time window           | Privacy variant signup rate ≥ glow variant        | open   |
| A6  | Walkers (not only runners/riders) are the best-fit segment                           | Desirability | 4   | 1   | Waitlist question "Walk, run or ride?" + interviews                  | Walkers ≥40 % of signups and most "very" answers  | open   |
| A7  | Someone would pay once (~€20–30) for CityTurfer                                      | Viability    | 3   | 0   | "Founding Turfer" fake door on the website (disclosed, no payment)   | ≥10 % of waitlist visitors click                  | later  |
| A8  | Permanent turf (no decay) keeps people engaged better than decay would               | Desirability | 3   | 1   | Interview probe on Turf/INTVL users' feelings about losing turf      | Pattern across ≥5 interviews                      | open   |
| A10 | Turfers want cloud backup / multi-device sync enough to accept an account and upload | Desirability | 5   | 0   | Interview probe + website fake door "Back up your turf" (disclosed)  | ≥3/5 interviewees raise loss/new-phone unprompted | open   |
| A9  | A share image of your turf brings new users without hurting privacy                  | Viability    | 3   | 0   | Concierge: founder makes images for 5 testers; count shares/sign-ups | ≥2 sign-ups attributed                            | later  |

A10 is untested although backup, accounts and restore shipped (v0.8.0–v0.9.0): the website has no
"Back up your turf" fake door yet and no interview has run.

## Opportunity tree

```text
Outcome: testers record ≥3 activities in weeks 2–4
- O1 "I want to see progress in my city"        [evidence: none yet]
  - glow/strength moments · new streets this week · city coverage %
- O2 "I don't know where to go next"            [evidence: none yet]
  - unclaimed streets nearby · route to new turf
- O3 "I don't trust apps with my location"      [evidence: none yet]
  - privacy page · export / delete everything · no login
```

## Interview queue

| Who (pseudonym, segment, relation) | Recruited via | Learning goal | Scheduled |
| ---------------------------------- | ------------- | ------------- | --------- |

_Empty. First goal: 5 interviews with non-friends from beachhead 1 (see `docs/product/strategy.md`
§5)._
