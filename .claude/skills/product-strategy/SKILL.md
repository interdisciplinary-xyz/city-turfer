---
name: product-strategy
description: >-
  Use for "what is the next version for", "why would anyone switch", "what should we charge",
  "should we add leaderboards / sharing / Android", prioritising the backlog or writing a pitch:
  positioning, strategy kernel, North Star, Now/Next/Later, Shape Up pitches, pricing.
---

# Product strategy

State lives in `docs/product/strategy.md` (status `proposed` until the founder signs off a section);
the market is in `docs/product/market-landscape.md`; the backlog is `NOTEBOOK.md` (it may lag: the
newest `scope/v*` branch and `docs/sessions/` are what's really in flight). Competitors to position
against: Strava, CityStrides, Squadrats, INTVL, StreetSiege (Dunford canvas over completionist,
fog-of-war and territory-capture apps). Evidence comes from the `product-discovery` skill — strategy
without evidence ids is a hypothesis and must say so.

## Strategy kernel (Rumelt) — the one-pager

- **Diagnosis**: the crux challenge, in one or two sentences. Today's draft: exploration and
  territory apps are crowded; CityTurfer has no network effects, so it must win on emotional payoff
  (your city glows) and trust (local-only is a full mode; nothing leaves the phone unless you opt
  in) for a specific group first.
- **Guiding policy**: the rule that makes choices easy (e.g. "the best _private_ map of your own
  city; never require an account or an upload").
- **Coherent actions**: three, reinforcing each other. Everything else is a no.
- **DHM check** (Biddle): does it Delight, is it Hard to copy, does it have a Margin path?

Bad-strategy smells: goals posing as strategy ("grow users"), fluff, a list of features, not facing
the challenge (single-player retention, Android share in Poland).

## Positioning (Dunford, in this order)

1. **Competitive alternatives** — what they'd use if we didn't exist (Strava heatmap, CityStrides,
   Squadrats, Fog of World/MoveMap, territory games, nothing).
2. **Unique attributes** — permanent turf that brightens on return; local-only with no account as a
   full mode (accounts and cloud backup are opt-in); Apple Health back-import; walk/run/ride
   equally; ~50 m street cells.
3. **Value** — what those attributes let people feel or do.
4. **Best-fit customers** — who cares most about that value (candidate beachheads in
   `docs/product/strategy.md` §5; strengths and weaknesses in `docs/product/market-landscape.md`
   §4).
5. **Market category** — the frame that makes the value obvious ("private exploration map" vs
   "walking game" vs "every-street tracker"). Pick one and test it (headline variants, the
   `product-discovery` skill).

Guard the differentiation: don't copy leaderboards, rival steals or decay because others have them —
that moves CityTurfer into the most crowded group. A proposal that does needs a decision record.

## North Star (statement, not a dashboard)

Draft: **"streets claimed or re-glowed per active Turfer per week"** with inputs: activities
recorded, new cells, reinforced cells, weeks active. Measured through discovery methods until there
is opt-in, coordinate-free telemetry — never by adding analytics on coordinates.

## Roadmap: Now / Next / Later

Outcome-themed, dates only on Now. Each line: outcome · bets · evidence · open questions. Now maps
to the newest `scope/vX.Y.Z` branch and its session log (plus its `NOTEBOOK.md` block if there is
one — flag it if not); Next and Later are candidate opportunities, not promises.

## Prioritising

Use **ICE with evidence-weighted confidence** — no fake reach numbers:

| Confidence | Evidence behind it                                          |
| ---------- | ----------------------------------------------------------- |
| 0.2        | Opinion (including the founder's and yours)                 |
| 0.5        | 1–2 interviews or one tester report                         |
| 0.8        | Pattern across ≥5 people, or a skin-in-the-game test passed |
| 1.0        | Observed behaviour (exports, diaries, store data)           |

Flag **cost of delay**: spring running season, App Store review lead time, the free Apple ID signing
expiry, a competitor launch. Always also list what you recommend **not** doing.

## One pitch per version (Shape Up)

Pitch: `<name>` for `scope/vX.Y.Z` — sections, in order:

1. **Problem**, with evidence ids and quotes.
2. **Appetite**: 1 or 2 weeks (solo). **Circuit breaker**: cut or shelve if not shippable by a date.
3. **Solution sketch**: breadboard or fat-marker — screens and flow, not pixels.
4. **Rabbit holes** and how we avoid them.
5. **No-gos**: explicitly out.
6. **Four risks**: value · usability · feasibility · viability (+ privacy).
7. **Done means**: acceptance criteria, plus what we'll learn and how (the `product-discovery`
   skill).

Hand the shaped pitch to `rn-architect` (the `add-feature` skill) for the technical plan and to
`brand-designer` for copy.

## Pricing discovery (later, but keep viability visible)

- Ask one willingness-to-pay question in interviews; Van Westendorp only with n ≥ 30.
- Category anchors: free / ~$40 yr freemium / ~$25–30 one-off for private single-player maps
  (`docs/product/market-landscape.md` §3). Local-only use costs us nothing, but the opt-in cloud
  backup runs on our EU API (Vercel + Neon, `docs/decisions/api-2026-10-20.md`,
  `docs/decisions/api-sync-2026-10-20.md`, `docs/decisions/api-device-tokens-2026-10-20.md`,
  `apps/mobile/src/contexts/cloud-backup`), so server cost now exists: re-check one-off or lifetime
  pricing against per-user backup cost before proposing it.
- Test before building: a "Founding Turfer" fake door on the website (disclosed, no payment).
- Never paywall what the brand promises (your turf, your data, export).

## Engagement ethics

Every engagement idea passes the regret test and "glow, never casino" (the `product-discovery` and
`brand-system` skills). No guilt, streak loss, fake urgency or leaderboards in a single-player app.

Sources: `.claude/skills/product-discovery/references.md`.
