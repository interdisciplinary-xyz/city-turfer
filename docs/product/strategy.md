---
status: proposed
verified: 2026-10-23
owner: founder
scope: [docs/product, NOTEBOOK.md]
summary:
  Draft product strategy for the founder to accept or change — diagnosis, guiding policy,
  positioning options, beachhead candidates, North Star, Now/Next/Later and the decisions it needs
---

# Product strategy (draft)

🚧 **Proposed by the `product-manager` agent on 2026-10-20 from desk research only — no user
evidence yet.** Every claim below is an assumption until the discovery board
(`docs/product/discovery-board.md`) gives it an evidence id. The founder accepts, edits or rejects
each section; accepted sections move to `canonical`. Method: the `product-strategy` skill; market
facts: [market-landscape.md](market-landscape.md).

## 1. Diagnosis

Exploration and territory apps are crowded (completionist web tools, fog-of-war apps, a 2025–26 wave
of territory-capture games, including the Polish StreetSiege, launched 2026-10-07). CityTurfer has
no network effects and single-player fitness apps retain poorly (Health & Fitness D30 ~3–8 %). It
must win a specific group on two things others don't combine: **turf that is yours forever and glows
brighter with every return**, and **trust — nothing leaves the phone, no account**.

## 2. Guiding policy (proposal)

Be **the private map of your own city** that rewards the walks you already do. Never require an
account or an upload; never let anyone take your turf away; reward return as much as novelty.

## 3. Coherent actions (proposal — three, reinforcing)

1. **Day-one wow**: Apple Health back-import + a first-run that shows years of glowing turf in
   minutes (no login wall).
2. **Reasons to come back that pass the regret test**: visible strength changes, "new streets this
   week", city coverage once "100 %" is defined.
3. **A private sharing loop**: a share image of _your_ turf (no coordinates of home; start/end
   trimmed) — the cheapest growth engine that keeps the privacy promise.

DHM check: delight ✔ (glow), hard to copy — partly (trust + local-first is hard for Strava-style
backends; the mechanic alone is not), margin — one-off/lifetime pricing with no server cost. (Fact
check 2026-10-23: opt-in cloud backup and server turf now run on Vercel and Neon, so there is a
server cost for Turfers who turn backup on.)

## 4. Positioning options (test, don't pick by taste)

| #   | Frame                                                                                | Best-fit customers                                    | Main alternative it beats         |
| --- | ------------------------------------------------------------------------------------ | ----------------------------------------------------- | --------------------------------- |
| A   | "Your city, remembered" — a lifetime map of your streets that glows where you return | Urban Apple Watch walkers/runners, PL first           | Strava heatmap (paid), MoveMap    |
| B   | "Every street. No account. No rivals." — the private every-street map                | #everystreet completionists tired of web/Strava tools | CityStrides, Wandrer, Squadrats   |
| C   | "The walking game that rewards habit" — your daily walk makes the map brighter       | Everyday walkers (dog walkers, commuters, parents)    | Fogbreaker, Pikmin Bloom, nothing |

Test: website headline variants by time window + the waitlist question "Walk, run or ride? What do
you use today?" (the `product-discovery` skill). Current tagline "Surf your city. Own your streets."
fits A and C; "own" may read as territory-war next to capture games — check in interviews.

## 5. Beachhead candidates

1. **Polish urban iPhone / Apple Watch walkers and runners, 25–45** (Warsaw, Kraków, Wrocław,
   Poznań, Gdańsk) — instant value from Health import; no localised exploration app; but iOS is ~36
   % of Polish mobile.
2. **#everystreet completionists** — motivated, vocal, will pay ~$40/yr; need street-level
   completion stats we don't have.
3. **Privacy-conscious solo walkers** — trust as a moat; pay once; hardest to reach.

Recommendation: start with **1**, recruit interviewees from **2** and **3** to learn what transfers.

## 6. North Star (statement)

"Streets claimed or re-glowed per active Turfer per week." Inputs: activities recorded, new cells,
reinforced cells, weeks active. Measured via discovery methods until any opt-in, coordinate-free
telemetry exists.

## 7. Now / Next / Later

| When  | Outcome                                                                  | Candidate bets                                                                                            |
| ----- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Now   | Testers trust recording and understand turf (v0.8–0.9)                   | Record turf overlay (built in v0.8.0); first 5 interviews; Android on a real phone; remove login wall     |
| Next  | Testers come back weekly without nudging                                 | Strength-change moments, weekly new-streets recap, city coverage (after defining 100 %), share image      |
| Later | Strangers from the waitlist activate and invite others; launch readiness | TestFlight/Play beta, privacy policy, PL app copy (screens done in v0.10.0), pricing test, Health Connect |

## 8. Decisions this needs from the founder

0. **Sync and the privacy promise** (raised 2026-10-20): the v0.8.0 API decision
   (`docs/decisions/api-2026-10-20.md`) plans accounts and server sync of tracks. The guiding policy
   above ("never require an account or an upload") and the trust-based positioning only survive if
   sync is **opt-in, off by default, with local-only as a full mode**. Recommendation: decide this
   explicitly (decision record) before the sync client is built, and test with users whether
   backup/multi-device is wanted at all (assumption A10). Status 2026-10-23: decided 2026-10-22 as
   B1 (opt-in, off by default, local-only stays a full mode;
   `docs/plans/backend-plan-2026-10-22.md`). The sync client shipped in v0.8.0–v0.9.0; a way in
   without an account is not built yet, and A10 is still untested.

1. Accept / edit the guiding policy (§2).
2. Which beachhead to test first (§5).
3. Login model: remove the login entirely for launch? (recommended; see
   `docs/product/launch-readiness.md`)
4. Whether to run positioning variants on the website (§4).
5. Pricing direction to test later: one-off/lifetime vs freemium subscription.
