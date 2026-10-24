---
status: canonical
verified: 2026-10-23
owner: founder
scope: [docs/product]
summary:
  Competitors, pricing benchmarks, market facts (Poland first) and where CityTurfer is different —
  web research as of 2026-10-20, with sources and uncertainty marked
---

# Market landscape

Canonical for: who else is in the space, what they charge, and the market facts the product strategy
leans on. **Snapshot of 2026-10-20 web research.** Competitors move; re-check a row before quoting
it in copy or a pitch. **[U]** = single or secondary source, unverified. Several 2026 comparison
pages are SEO content written by competitors — directional only.

Used by: the `product-strategy` skill (positioning, pricing), the `product-manager` agent.

## 1. Three groups of competitors

- **A. Completionists** — every street / every tile, permanent, mostly web add-ons to Strava.
- **B. Fog of war / lifetime maps** — single-player, often private.
- **C. Territory-capture games** — multiplayer, steal-able turf; boomed 2025–26 (TikTok).
- **D. Platforms** that set expectations: Strava, Garmin, Apple, Komoot.

| App                    | Grp | Mechanic                                                                     | Platforms         | Price                                      | Note for us                                                                                               |
| ---------------------- | --- | ---------------------------------------------------------------------------- | ----------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| CityStrides            | A   | Street completion per city (OSM nodes)                                       | Web only          | Free; supporter $5/mo, $50/yr              | #everystreet hub; rejects rides; Strava-dependent; one maintainer                                         |
| Wandrer                | A   | Points for new road miles only                                               | Web (+ Karoo)     | Free last 50 activities; $40/yr (May 2026) | Price up 33 %; Strava API change hurt it                                                                  |
| Squadrats              | A   | ~1-mile tile hunting + small tiles                                           | iOS, Android, web | Free; Pro $39.99/yr                        | Most polished tile game; cyclist-leaning                                                                  |
| StatsHunters           | A   | Tiles, max square, badges                                                    | Web               | Free (donations)                           | —                                                                                                         |
| VeloViewer             | A   | Analytics + explorer tiles (origin of tile hunting)                          | Web               | £10–20/yr                                  | Cycling-centric                                                                                           |
| Fog of World           | B   | Lifetime fog-of-war map, no account                                          | iOS, Android      | ~$30 one-off                               | Proves people pay once for a private lifetime map; dated design, battery complaints [U]                   |
| Fogbreaker             | B   | Step counter + fog map; "every street you explored is permanently uncovered" | iOS, Android      | $3.99/wk … $39.99/yr, $89.99 lifetime [U]  | Same walker audience and permanence wording — closest copy threat                                         |
| MoveMap                | B   | All Apple Health routes on one map + street coverage                         | iOS               | Free 12 months; $9.99/yr, $24.99 lifetime  | Closest to our Apple Health import; no game layer                                                         |
| Kraina for Strava      | B   | Web fog of war over Strava routes                                            | Web               | [U]                                        | New 2026; demand signal                                                                                   |
| INTVL (AU)             | C   | Closed loops capture area; rivals retake; prizes                             | iOS, Android      | Free; Pro ~$79.99/yr [U]                   | 1M+ Play downloads; reviews worry about exposing run start/end points                                     |
| Konquo (EU)            | C   | **H3 hexes you pass** + loops; classes, clubs                                | iOS, Android      | Free; €39.99/yr                            | Most direct technical analogue (H3); RPG-heavy; self-reported scale                                       |
| StreetSiege (🇵🇱)       | C   | Closed loops own area; rivals retake; weekly/season rankings, crews          | iOS, Android      | Free, no ads; optional premium             | **Polish, public since 2026-10-07** — competes for the same local press and run groups                    |
| Stride (🇵🇱/UK team)    | C   | Hexes claimed by visits; 3–4 visits to retake; decay after 2 months idle     | iOS, Android      | 189.99 zł/yr                               | Visit-count mechanic closest to our strength; 2026 status unknown [U]                                     |
| Turf (SE)              | C   | Hold fixed zones; monthly reset                                              | iOS, Android      | Free; supporter tier                       | Long-lived Nordic community; resets wipe progress                                                         |
| Motera, RunWars, KYRO… | C   | Loop/hex capture variants                                                    | Mixed             | Free + VIP                                 | Category is crowded                                                                                       |
| Strava                 | D   | Social layer; personal heatmaps **subscriber-only**                          | All               | $79.99/yr                                  | 180M+ users; walking now its #2 activity; closed its API to third parties (Nov 2024); biggest copy threat |
| Garmin, Apple Fitness  | D   | No personal all-routes map [U]                                               | —                 | —                                          | Users ask for it; MoveMap exists because of the gap                                                       |
| Pokémon GO, Pikmin     | adj | Location games for mass-market walkers                                       | iOS, Android      | F2P                                        | Shows walkers will play; not about owning streets                                                         |

Polish context: Endomondo (very popular in Poland) shut down end of 2020; users moved to Strava,
Garmin and Samsung Health.

## 2. Market facts

- **Walking is the growth story**: walking became Strava's #2 activity in 2025; run clubs ×3.5; Gen
  Z fastest-growing.
- **Retention is brutal**: Health & Fitness apps keep roughly 3–4 % of users at day 30 (D1 ~20 %, D7
  ~7–8 %; top quartile D30 8–12 %). Benchmarks define retention differently [U].
- **Poland**: iOS ~36 % of mobile (StatCounter, Sept 2026), Android ~64 % — iOS-only reaches about a
  third. 43.7 % of Poles did sport/recreation (GUS 2025); **cycling is the most common**. Largest
  Polish marathons: 27,428 finishers in 2025, +20 % year on year.
- **#everystreet** (Rickey Gates; Salomon re-ran it in 2025) is small but engaged; CityStrides is
  its hub.

## 3. Pricing benchmarks

| Model                 | Examples                                             | What's paid                               |
| --------------------- | ---------------------------------------------------- | ----------------------------------------- |
| Free / donations      | StatsHunters, Turf, StreetSiege                      | Nothing or cosmetics                      |
| Freemium ~$40/yr      | Squadrats, Wandrer, Konquo+, Fogbreaker, CityStrides | Full history, hunting tools, leaderboards |
| Platform subscription | Strava $79.99/yr                                     | Heatmaps, analytics, routes               |
| One-off / lifetime    | Fog of World ~$30, MoveMap $24.99, Fogbreaker $89.99 | Full history, the whole map               |

**History depth** is the most common paywall. Single-player, private apps sell **one-off /
lifetime** well. CityTurfer's server cost is limited to Turfers who turn on the opt-in cloud backup
(Vercel and Neon since v0.8.0–v0.10.0), so a one-off price may still be viable. Untested inference;
see the `product-strategy` skill before using it.

## 4. Where CityTurfer is different (and weak)

Different:

1. **Permanent turf that glows brighter with repeat visits.** Territory games let rivals take it;
   Turf resets monthly; completionists count a street once. Only Stride rewards repeats. A daily dog
   walk counts here.
2. **Private by default.** Routes stay on the phone unless the Turfer turns on the opt-in backup; no
   analytics. Only Fog of World and MoveMap go further today: CityTurfer has a backend (v0.8.0+) and
   still asks every new user to sign in with an e-mailed code, which creates an account (a way in
   without one is decided, not built).
3. **Native recorder + Apple Health back-import**: years of turf on day one; no Strava dependency.
4. **Walk, run and ride equally**, with ~50 m street cells (short urban walks visibly fill in).

Weak:

- Single-player: no rivals, clubs or invites — the engines of INTVL's and Strava's growth.
- No sharing loop (a turf-map share image would be the cheapest one).
- iOS-first while Poland is ~64 % Android; no Health Connect import.
- Hex turf is no longer novel (Konquo uses H3; Fogbreaker sells permanent street reveal).
- "Turf" may read as "war game" next to the territory-capture hype.

Threats: Strava shipping fog of war or territory; StreetSiege owning Polish attention first;
Fogbreaker/MoveMap adding a strength layer; Apple/Garmin shipping a native all-routes map.

## 5. Sources

Competitors:
[appsforstrava exploration apps](https://appsforstrava.com/blog/strava-exploration-apps) ·
[CityStrides](https://citystrides.com/) ·
[Wandrer 2026](https://news.wandrer.earth/2026/04/11/onward-to-2026.html) ·
[DC Rainmaker on Strava API](https://dcrainmaker.com/2024/11/stravas-changes-to-kill-off-apps.html)
·
[We Love Cycling tile hunting](https://www.welovecycling.com/wide/2026/04/14/tile-hunting-which-platform-is-best-for-you/)
· [Fog of World](https://apps.apple.com/us/app/fog-of-world/id505367096) ·
[Fogbreaker](https://fog-breaker.com/en) · [MoveMap](https://getrunmap.com/) ·
[INTVL Play](https://play.google.com/store/apps/details?id=com.intvl.app&hl=en_US) ·
[Konquo territory apps](https://konquo.com/en/territory-capture-apps) ·
[StreetSiege launch](https://kawalec.eu/koniec-testow-streetsiege-jest-juz-w-google-play-i-app-store/)
·
[Stride](https://www.telepolis.pl/tech/aplikacje/stride-nowa-gra-terenowa-dla-aktywnych-zdobywaj-heksy-chodzac-lub-biegajac)
· [Turf](https://turfgame.com/) · [Strava subscribe](https://www.strava.com/subscribe)

Market:
[Strava Year in Sport 2025](https://the5krunner.com/2025/12/04/strava-2025-year-in-sport-report-apple-watch-coros-gen-z/)
· [Grand View fitness apps](https://www.grandviewresearch.com/industry-analysis/fitness-app-market)
· [Retention benchmarks](https://userpilot.com/blog/mobile-app-retention/) ·
[StatCounter Poland](https://gs.statcounter.com/os-market-share/mobile/poland) ·
[GUS sport 2025](https://stat.gov.pl/en/topics/culture-tourism-sport/sport/participation-in-sport-and-recreational-activities-in-2025,7,3.html)
·
[Polish race market 2025](https://biegowe.pl/2025/11/jak-wygladal-polski-rynek-imprez-biegowych-w-2025-roku.html)

Not verified: official user counts for CityStrides/Wandrer/Squadrats, INTVL Pro price, Apple Fitness
2026 map features, Strava's listing status.
