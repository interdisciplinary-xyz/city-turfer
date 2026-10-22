---
status: proposed
verified: 2026-10-22
owner: founder
scope:
  [docs/product, apps/web/src/app/branding/page.constants.ts, apps/web/src/app/branding/page.tsx]
summary:
  Ideal customer profile (hypothesis) — the primary Turfer to win first, two segments to test, who
  it isn't for yet, fit signals and the assumptions that would prove or kill it
---

# Ideal customer profile (hypothesis)

🚧 **Proposed on 2026-10-22 from desk research and the product as built — no interviews yet.** The
evidence log in [discovery-board.md](discovery-board.md) is empty, so every line below is an
assumption. It sharpens beachhead 1 of [strategy.md](strategy.md) §5; market facts come from
[market-landscape.md](market-landscape.md) (dated snapshot). Shown on the website's `/branding` page
(`apps/web/src/app/branding/page.constants.ts` mirrors this doc: update both together).

## Primary: the Apple Watch city walker

| Field            | Hypothesis                                                                                                                                                                                                                  |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Who              | 25–45, lives in a Polish city (Warsaw, Kraków, Wrocław, Poznań, Tri-City), iPhone and often an Apple Watch. Walks, runs or rides several times a week, mostly the same streets                                              |
| Moment           | Years of workouts sit in Apple Health and nobody looks at them; a new neighbourhood; wanting a reason to take a different street on the usual loop                                                                          |
| Job              | "When I head out for my usual walk or run, I want to see my city fill in and my regular streets glow, so everyday movement feels like it adds up to something."                                                             |
| Uses today       | Apple Fitness or Strava (a list of workouts; Strava's personal heatmap is paid), Garmin Connect; nothing that rewards a repeated dog walk                                                                                   |
| Why CityTurfer   | Apple Health import shows years of turf on day one; return visits count, so the streets they live on blaze; nothing decays and no one takes it away; no account needed, routes stay on the phone unless they turn on backup |
| What puts it off | A login wall, rankings and rivals, turf that decays, battery drain, a map that shows where they live                                                                                                                        |
| Where to find    | Candidates to test: city subreddits and Facebook groups, run clubs and parkrun, Apple Watch communities, Polish running and cycling media                                                                                   |
| Would pay        | Once, like Fog of World (~$30) or MoveMap ($24.99 lifetime), not a subscription — assumption A7                                                                                                                             |

Context (market-landscape, dated): iOS is ~36 % of mobile in Poland (StatCounter, Sept 2026), so
this profile reaches about a third of the market until Android is proven; walking became Strava's #2
activity in 2025; cycling is Poland's most common sport (GUS 2025).

### Fit signals

- iPhone, with Apple Health history (ideally Apple Watch)
- Two or more outings a week, on repeated routes
- Lives and moves in one city most of the year
- Prefers private to social; doesn't post workouts publicly

### Not a fit (for this profile)

- Wants to compete, rank or take someone else's turf
- Trains by numbers: heart rate zones, power, plans
- Android only (no Health Connect import yet; Android recording unproven on a phone)
- Mostly drives, or moves between cities constantly

## Segments to test (recruit interviewees, don't build for them yet)

| Segment                    | Who and job                                                                                                                                                 | Gap or risk for us                                                                                                      |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| #everystreet completionist | Runner or rider who uses CityStrides, Wandrer or Squadrats; wants to finish every street of a city; pays ~$40/yr today; hurt by Strava's API closure (2024) | Needs street-completion %, which we don't have (what 100 % city coverage means is open question 1 in the product brief) |
| Privacy-first solo walker  | Avoids Strava because it's public; wants a lifetime map that stays on the phone; would pay once                                                             | Hardest to reach; trust needs a privacy policy and an honest line about opt-in backup                                   |

## Not for now

- **Territory-capture players** (StreetSiege, INTVL, Konquo): they want rivals, crews and seasons —
  our non-goals.
- **Performance athletes**: they want training analytics, not a map of their city.

## How we'll know

| Assumption (discovery board)                       | Test                                                  | Pass bar                                         |
| -------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------ |
| A4 Health import creates a day-one "wow"           | Watch 5 people with Watch history import and react    | ≥ 4/5 react positively unprompted                |
| A1 Glow on return is a reason to go out again      | 2–3 week diary study, 8 testers                       | ≥ 5/8 mention turf or glow as a reason to go out |
| A6 Walkers are the best-fit segment                | Waitlist question "Walk, run or ride?" and interviews | Walkers ≥ 40 % of sign-ups                       |
| A5 "No account, routes on your phone" wins choices | Website headline variants (privacy vs glow)           | Privacy variant sign-up rate ≥ glow variant      |

First step: 5 interviews with non-friends who match the fit signals (the `product-discovery` skill).
If A4 and A1 fail, revisit the profile before any launch spend.
