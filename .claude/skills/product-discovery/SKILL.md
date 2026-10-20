---
name: product-discovery
description:
  How CityTurfer learns what to build without analytics — Mom Test / Jobs-to-be-Done interview
  scripts, the evidence log, the Opportunity Solution Tree, assumption mapping and cheap tests (fake
  doors on the website, concierge, diary studies), the small-n Sean Ellis PMF survey, and
  privacy-safe measurement (no coordinates, opt-in, user-initiated). Use when planning or
  synthesising tester interviews or feedback, deciding whether an idea is worth building, writing a
  survey, designing an experiment, asking "do people want this?", "is this PMF?", "what did we
  learn?", or before any feature whose value is a guess.
---

# Product discovery

Discovery decides **what** to build; delivery (the `add-feature` skill) builds it right. CityTurfer
is pre-PMF, solo-founder, local-first and has **no analytics by design**, so conversations with
people and skin-in-the-game tests _are_ the data system. The live state of discovery is
`docs/product/discovery-board.md`: evidence log, assumption map and opportunity tree. Read it first;
update it after every learning.

## Hard rules

1. **Never fabricate evidence.** No invented quotes, personas-as-research, survey numbers or "users
   say…" without a source id from the evidence log. Everything is either `evidence: E-012` or
   `assumption`. Hypothetical quotes (e.g. in a PR-FAQ) are labelled _hypothetical_.
2. **Friends are not the market.** Tag every source `friend | acquaintance | stranger`. Report
   friend signal separately; compliments are not evidence, commitments are.
3. **Privacy beats insight.** Never propose collecting coordinates, device ids or Health data for
   learning. Default to: ask people, user-initiated non-spatial exports, opt-in coarse counters
   (disclosed on the privacy page), website-level counts. CLAUDE.md's location rules apply.
4. **The founder talks to people.** You draft scripts, recruit messages and syntheses; you never
   contact users or impersonate the founder.
5. **Pre-register the success criterion** before running a test ("≥5 of 8 testers …"). No moving
   goalposts afterwards.
6. **Every artifact ends in a decision or the next test.** No framework theatre.

## The loop (weekly, Torres-style)

```
outcome (one, measurable-ish) → opportunities (needs, pains, desires — heard, with evidence ids)
  → ≥3 candidate solutions each → riskiest assumption per solution → cheapest test → decide
```

Cadence the agent proposes to the founder: **1–2 interviews a week** (recruited from the waitlist
confirmation email, testers, running/cycling groups), evidence log updated the same day, assumption
map re-ranked weekly, one "learned / changed / next" note per week, a PMF survey per version once
there are qualified users.

## Interviews (Mom Test + JTBD switch)

Ask about their life and specific past events, not about the idea or the future. Talk less. Dig on
emotion and on what they already spent (time, money, workarounds). Script, 30 min:

```markdown
# Interview E-<nnn> — <pseudonym> — <date> — <walker|runner|rider|tile-hunter> — <friend|acquaintance|stranger>

Learning goal (one):

1. Tell me about the last time you went for a walk / run / ride. Where, and why that route?
2. What did you do with it afterwards? (app, photo, nothing) Show me.
3. Do you keep track of where you've been? How? Since when — what happened just before you started?
   (switch timeline: first thought → passive looking → active looking → deciding → using)
4. What annoys you about how you do it now? What have you tried to fix that?
5. Forces: what pushes you to change, what pulls you to something new, what worries you about it,
   what habit keeps you where you are?
6. (Only after min 25) Show CityTurfer, stay silent 2 min. "What do you think this is for?"
7. Commitment ask: record your next 3 outings and send me a screenshot of your map / intro to a
   friend / join the waitlist.

Within 1 h: 3 verbatim quotes · opportunities heard · assumptions moved · commitment (Y/N, which)
```

Recruiting message and synthesis go in the evidence log with the same id. Pseudonyms only; no
contact details, no locations finer than the city in the repo.

## Assumption map

Columns: assumption · type (Desirability / Viability / Feasibility / Usability / Ethics) ·
importance 1–5 · evidence 1–5 · test · pre-registered criterion · status. **Test high-importance,
low-evidence first.** Feasibility of background GPS is tested with the `mobile-testing` skill on
devices, never asserted from unit tests.

## Cheap tests that fit CityTurfer

| Test              | Use it for                         | Rules                                                                                                                                                       |
| ----------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Website fake door | Demand for an unbuilt feature/plan | Button explains immediately it isn't built, offers waitlist priority; never takes money; counts from the waitlist provider or time windows, no new trackers |
| Headline variants | Positioning (privacy vs turf vs …) | Compare signup rate per variant by time window; one change at a time                                                                                        |
| Waitlist question | Segment and current alternative    | One optional question at signup ("Walk, run or ride?", "What do you use today?")                                                                            |
| Concierge / Oz    | Value before code                  | Founder does it by hand (e.g. "3 unclaimed streets near you" by message)                                                                                    |
| Diary study       | Real retention and emotion         | 8–12 testers, 2–3 weeks: after each outing a map screenshot + "why did you go out?"                                                                         |
| Hallway usability | Usability risk                     | 5 people per round; task: "show me which streets are yours and which you visit most"                                                                        |
| Stats self-export | Behaviour with consent             | A user-reviewed, non-spatial text summary (counts, km, cells, days active, version) they choose to send                                                     |
| Commitment ledger | Real vs polite signal              | Log intros, screenshots sent, pre-orders, unprompted repeat use                                                                                             |

## PMF survey (Ellis / Vohra, small n)

Ask only people who used it meaningfully (≥2 weeks and ≥3 activities). Questions: how would you feel
if you could no longer use CityTurfer (very / somewhat / not disappointed / no longer use) · who
would benefit most · main benefit · how can we improve it · what would you use instead. Benchmark
≥40 % "very disappointed" — **directional only below n≈30**; report n and the friend share. Then
segment: what do the "very disappointed" love (double down), what holds back the "somewhat" who
share that love (fix). Split the next version roughly half and half.

## Measuring without analytics (HEART-lite)

| Dimension    | CityTurfer signal                                                        |
| ------------ | ------------------------------------------------------------------------ |
| Happiness    | PMF score, diary sentiment, store/TestFlight reviews (verbatim words)    |
| Engagement   | Activities per week from voluntary stats exports or diaries              |
| Adoption     | Waitlist → install → first activity, kept by hand in a cohort sheet      |
| Retention    | Testers still recording in weeks 2, 4, 8 (self-reported or export)       |
| Task success | Recording incidents per 10 activities (gaps, lost activity) from testers |

The de-facto activation definition is the in-app Getting started checklist
(`apps/mobile/src/contexts/achievements/domain/onboarding.ts`); ask testers how far they got.

## Ethics check for engagement ideas

Apply the **regret test**: would the user still want this if they knew everything we know about why
it's there? Decay, streaks, loss-framing and notification nudges must pass it and the brand rule
"glow, never casino" (the `brand-system` skill). Turf is permanent on purpose.

Sources and further templates: `.claude/skills/product-discovery/references.md`.
