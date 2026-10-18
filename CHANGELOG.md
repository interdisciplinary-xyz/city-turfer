# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0](https://github.com/interdisciplinary-xyz/city-turfer/compare/v0.1.0...v0.2.0) (2026-10-18)


### Features

* **achievements:** add getting started checklist to dashboard ([b00efe4](https://github.com/interdisciplinary-xyz/city-turfer/commit/b00efe4b58a2720f667665985183cc69e8ae1c32))
* **achievements:** list of achievements with progress ([8afe3b1](https://github.com/interdisciplinary-xyz/city-turfer/commit/8afe3b1e6e86e9c4373f818752afc04c7ca13a1b))
* **achievements:** summarize unlocked count and the next achievement within reach ([0c5e862](https://github.com/interdisciplinary-xyz/city-turfer/commit/0c5e8626fb31959c8c085811fc9bcda10def0f97))
* **activity-log:** setting to turn street estimates for gps gaps off ([901b9cb](https://github.com/interdisciplinary-xyz/city-turfer/commit/901b9cbfaa0b03e4c613eda196a345f28880901b))
* **app-shell:** dashboard as the start tab; history moves out of the tab bar ([74dae86](https://github.com/interdisciplinary-xyz/city-turfer/commit/74dae8619224eba0c7aba91fe21c3b24acdd473e))
* **app-shell:** open a menu from the me tab with profile, account and info ([a40a574](https://github.com/interdisciplinary-xyz/city-turfer/commit/a40a5746d396705407af48f52f1293cb8c974b9b))
* **app-shell:** open the me tab as a drawer with profile, account and info ([27c7b8e](https://github.com/interdisciplinary-xyz/city-turfer/commit/27c7b8e104a4dc8e7dcd3e01c4ec7e1343b6a695))
* **identity:** rename the mock account to admin@cityturfer.com ([2247afa](https://github.com/interdisciplinary-xyz/city-turfer/commit/2247afafd76e93918c6625993eb8635d5abbd37e))


### Bug Fixes

* **activity-log:** estimate only gps gaps, never manual pauses, and harden router use ([3d32c44](https://github.com/interdisciplinary-xyz/city-turfer/commit/3d32c445cbcc0ab0d71d3f22e018e69e0dd8cb29))
* **dev:** gate demo seeder behind dev tools and add demo data removal ([41a5f9d](https://github.com/interdisciplinary-xyz/city-turfer/commit/41a5f9df75b78111417c6b6e99ad44fe6b07be26))
* **identity:** move from email to password with the keyboard's next key ([44dd8bb](https://github.com/interdisciplinary-xyz/city-turfer/commit/44dd8bbab00107bdc93b8779d28b1105ebd63657))
* **platform:** dead-letter poisoned outbox events and prune recording data ([cc3f971](https://github.com/interdisciplinary-xyz/city-turfer/commit/cc3f971b595b2d5d7ed3114292cb8a5341680cb4))
* **recording:** keep recording through transient keychain errors in headless launches ([74a77ea](https://github.com/interdisciplinary-xyz/city-turfer/commit/74a77ea36f5606ddb5a2c8d0fa9fdce410810926))
* **recording:** make finish accessible and fix on-colour contrast ([99ebc7a](https://github.com/interdisciplinary-xyz/city-turfer/commit/99ebc7a19cc55387a452ee37c714ec17839c4132))
* **recording:** reconcile the merged race, auto-pause and retention fixes ([00b50e8](https://github.com/interdisciplinary-xyz/city-turfer/commit/00b50e890ef58f171696775c8c5eafe3225a458d)), closes [#29](https://github.com/interdisciplinary-xyz/city-turfer/issues/29) [#30](https://github.com/interdisciplinary-xyz/city-turfer/issues/30) [#31](https://github.com/interdisciplinary-xyz/city-turfer/issues/31) [#31](https://github.com/interdisciplinary-xyz/city-turfer/issues/31) [#30](https://github.com/interdisciplinary-xyz/city-turfer/issues/30) [#29](https://github.com/interdisciplinary-xyz/city-turfer/issues/29) [#30](https://github.com/interdisciplinary-xyz/city-turfer/issues/30) [#30](https://github.com/interdisciplinary-xyz/city-turfer/issues/30) [#29](https://github.com/interdisciplinary-xyz/city-turfer/issues/29)
* **recording:** resume auto-pause after long stops without doppler speed ([0a7dfae](https://github.com/interdisciplinary-xyz/city-turfer/commit/0a7dfae0e0755b32ecf9733095504f016ae665fe))
* **recording:** serialize recording commands and never revive an ended session ([e679c4a](https://github.com/interdisciplinary-xyz/city-turfer/commit/e679c4aeee78af50945d0d121e7cfa003773c320))
* **recording:** treat android zero speed and altitude as unknown in toFix ([eec1abc](https://github.com/interdisciplinary-xyz/city-turfer/commit/eec1abc8540f62870e19c9c1d6f7d98e3f86386f))
* stop tracking the node_modules symlink committed by a merge ([57e7a14](https://github.com/interdisciplinary-xyz/city-turfer/commit/57e7a1478db421923fc357a5d1df30b0d8c6f7b6)), closes [#33](https://github.com/interdisciplinary-xyz/city-turfer/issues/33)


### Documentation

* **engineering:** add the domain architecture and feature inventory ([44fcfe4](https://github.com/interdisciplinary-xyz/city-turfer/commit/44fcfe45b9163bac74b5d597a8b60941e149228d))
* **engineering:** record architecture decisions and the maplibre adr ([5ecb7a7](https://github.com/interdisciplinary-xyz/city-turfer/commit/5ecb7a742b10a5137cca8076d1dca1c557aac605))
* **engineering:** update decisions for the merged outbox, seeder and gap-route changes ([ea30871](https://github.com/interdisciplinary-xyz/city-turfer/commit/ea30871885a2e060d118f4e5a010df3bb58a3d14)), closes [#30](https://github.com/interdisciplinary-xyz/city-turfer/issues/30) [#33](https://github.com/interdisciplinary-xyz/city-turfer/issues/33) [#27](https://github.com/interdisciplinary-xyz/city-turfer/issues/27)
* make markdown readable in the IDE ([b04d186](https://github.com/interdisciplinary-xyz/city-turfer/commit/b04d1869961f2ab1e808db5ae07a776585eeca11))
* **operations:** add the incident runbook and the ota release procedure ([ef26456](https://github.com/interdisciplinary-xyz/city-turfer/commit/ef264569f02ddf62e1fa93582e408d534cc96991))
* **process:** add the notebook backlog and the session migration policy ([19305fd](https://github.com/interdisciplinary-xyz/city-turfer/commit/19305fd4aa21979bf3b51a91cdef6a2eff92fc44))
* **process:** adopt docs conventions, frontmatter and fix doc rot ([eb23295](https://github.com/interdisciplinary-xyz/city-turfer/commit/eb23295ef5e01bdb5da562905f7fdd8d4d33c864))
* **process:** bring the docs audit up to date with scope ([869b80c](https://github.com/interdisciplinary-xyz/city-turfer/commit/869b80cc6d4062871e8dacd76bb99f561f126fa7))
* **readme:** restructure the readme in the empatalk format ([a50882b](https://github.com/interdisciplinary-xyz/city-turfer/commit/a50882bc53d889acc3330164fd3a5608469d28dc))
* **readme:** update screens for the dashboard navigation ([c2c45e4](https://github.com/interdisciplinary-xyz/city-turfer/commit/c2c45e40bfee2471c432ea2d158692844e676ed2))
* **session:** bring the v0.2.0 log up to date after the v0.1.0 release ([f45638f](https://github.com/interdisciplinary-xyz/city-turfer/commit/f45638ff40185b8789f4c8b7df7bf78005efef86))
* **session:** start the v0.2.0 session log ([96ea9a7](https://github.com/interdisciplinary-xyz/city-turfer/commit/96ea9a70e42635a718bbe7ea2ae9cfb82dcb3d68))
* **tooling:** record node tool test baseline ([fd6a049](https://github.com/interdisciplinary-xyz/city-turfer/commit/fd6a0493b423a0cde5b2df2f49f54a881da69d39))


### Tests

* **e2e:** cover the dashboard and route history through it ([66fd6b4](https://github.com/interdisciplinary-xyz/city-turfer/commit/66fd6b44edcb4966d3650a7c41a4e640f29bfaff))
* **e2e:** dismiss the iOS save-password prompt after sign-in ([52e6a2f](https://github.com/interdisciplinary-xyz/city-turfer/commit/52e6a2f9e3bf1a88c6a9e3cac6a3b010ed59f384))
* **shared-kernel:** read oracle numbers from route-stats instead of hard-coding ([e4f1c52](https://github.com/interdisciplinary-xyz/city-turfer/commit/e4f1c52396147a1b8554acd9c7110e7170c14239))
* **territory:** pin turf strength and tiers to shared vectors ([73b4ea4](https://github.com/interdisciplinary-xyz/city-turfer/commit/73b4ea47f05447c9e1e08093d60cc71681d944b0))


### CI/CD

* run quality on every pull request and lint all commits ([ecc8db9](https://github.com/interdisciplinary-xyz/city-turfer/commit/ecc8db995010cf4045c9389564765b125ffd07fd))

## 0.1.0 (2026-10-17)


### Features

* **activity-log:** estimate recording gaps along streets ([f30bb5b](https://github.com/interdisciplinary-xyz/city-turfer/commit/f30bb5b44f657853f73a5241cad374aa658425ac))
* **activity-log:** record activities from finished sessions with history and detail ([a365e55](https://github.com/interdisciplinary-xyz/city-turfer/commit/a365e559507ccadfb0f8df54306df438cc45ad07))
* **app-shell:** reorder tabs to Turf, Stats, Record, History, Me ([2ffc74b](https://github.com/interdisciplinary-xyz/city-turfer/commit/2ffc74b10f1f2d1a3d3e23ab950a748ea5fd0c3b))
* **app-shell:** tab bar with raised Record button and a Stats tab ([bca462f](https://github.com/interdisciplinary-xyz/city-turfer/commit/bca462f4979f03a8fed1a8ef1112d11046bc74bc))
* **app:** screens, composition root, OTA update check and demo history ([7a95379](https://github.com/interdisciplinary-xyz/city-turfer/commit/7a953792d1b00af1b6e93093c3288389f3ac2fc2))
* **brand:** add the cityturfer identity, logo and icon pipeline ([bcef769](https://github.com/interdisciplinary-xyz/city-turfer/commit/bcef76996f92d2796cb13da6688a3d36a6be44af))
* **brand:** apply cityturfer icon, splash and app name ([cbce52c](https://github.com/interdisciplinary-xyz/city-turfer/commit/cbce52ca065beb23f2cdeb7ed1ab2bdaece031b1))
* **identity:** mock sign-in behind an AuthGateway port ([96857bb](https://github.com/interdisciplinary-xyz/city-turfer/commit/96857bbecd6bbd038a6b16ca847cce285d9b77b7))
* **platform:** shared kernel, SQLite platform and transactional outbox ([48d3dc0](https://github.com/interdisciplinary-xyz/city-turfer/commit/48d3dc0608d44693158f5a90fa7dbb050cffef73))
* **recording:** background GPS recording with fix filter, auto-pause and recovery ([06e1195](https://github.com/interdisciplinary-xyz/city-turfer/commit/06e119558e83e71be09e26b3407a066306b9a047))
* **territory:** permanent turf on an H3 grid with a glowing Turf map ([48a1a3c](https://github.com/interdisciplinary-xyz/city-turfer/commit/48a1a3c6d8849704474943b24c1aaeafd843db0e))


### Bug Fixes

* **app-shell:** keep Record as the start tab after the reorder ([e546173](https://github.com/interdisciplinary-xyz/city-turfer/commit/e546173044706b8d6c212c45abfd3d4a442bebf2))
* **recording:** hold an iOS background activity session while recording ([76d64c9](https://github.com/interdisciplinary-xyz/city-turfer/commit/76d64c976fb6e43667c05612335f0b293375c05e))
* **recording:** repair gap-bridged tracks and log background tracking state ([6680344](https://github.com/interdisciplinary-xyz/city-turfer/commit/6680344214a6d3906c81344ec528e92d0e08703f))
* **recording:** stream fixes from CLLocationUpdate.liveUpdates in a background session ([0e26f3c](https://github.com/interdisciplinary-xyz/city-turfer/commit/0e26f3c4af8818a98371291e6c69616377aaba5d))
* **ui:** draw recording gaps as dashed connectors so the whole route is visible ([5a48fe4](https://github.com/interdisciplinary-xyz/city-turfer/commit/5a48fe4d1335d655dbad2bfe657408ec904d58da))


### Refactoring

* move shared constants to src/constants ([6abd0ee](https://github.com/interdisciplinary-xyz/city-turfer/commit/6abd0ee92d7f8ce6e9a9aaa9b6df71dc8aa13d5f))
* rename files to kebab-case ([6188916](https://github.com/interdisciplinary-xyz/city-turfer/commit/6188916c5de7d4e65e9bfd179dd4a2382e9368fb))


### Documentation

* **session:** add v0.1.0 session log ([a550276](https://github.com/interdisciplinary-xyz/city-turfer/commit/a550276e21918c2c119341b8f12f5c021480717e))
* **session:** log day 2 — background tracking fix, tab bar, refactors ([2598465](https://github.com/interdisciplinary-xyz/city-turfer/commit/2598465d338befaf0a7d49a8d3b0c9822f14bbca))
* **session:** note branded build installed on device ([7723d44](https://github.com/interdisciplinary-xyz/city-turfer/commit/7723d44c98ce8776ea63ae1a42a5ed6d75e33b3f))


### Tests

* **e2e:** add maestro regression suite for v0.1.0 features ([9a0a4dc](https://github.com/interdisciplinary-xyz/city-turfer/commit/9a0a4dc7b7710e3123ea1207875a4f1e6a5118d8))

# Changelog

All notable changes to this project will be documented in this file.
