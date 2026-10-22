# Changelog

All notable changes to this project will be documented in this file.

## [0.8.0](https://github.com/interdisciplinary-xyz/city-turfer/compare/v0.7.0...v0.8.0) (2026-10-20)


### Features

* **activity-log:** move Activity Log's domain and use cases into @cityturfer/core ([8bc6fb3](https://github.com/interdisciplinary-xyz/city-turfer/commit/8bc6fb3a885256126f0f0d1040d2d41785256deb))
* **api:** add the sync changes feed ([af02325](https://github.com/interdisciplinary-xyz/city-turfer/commit/af02325b68d9730858ebdcf8010c3585187f59db))
* **api:** apps/api with every v1 route declared and documented ([feeaa7f](https://github.com/interdisciplinary-xyz/city-turfer/commit/feeaa7ff4551fb509c42b45df9e32e3b51e7f266))
* **api:** async data export, erasure job and consents ([6b1d883](https://github.com/interdisciplinary-xyz/city-turfer/commit/6b1d88399a4797c7d4768c5263ba5346a8295967))
* **api:** live one-way backup on postgres with device tokens ([f2da76f](https://github.com/interdisciplinary-xyz/city-turfer/commit/f2da76f4824d1eeed39d29c7f5aa0a36c3fa5d9f))
* **api:** make the activity log contract sync-ready ([aefbd31](https://github.com/interdisciplinary-xyz/city-turfer/commit/aefbd3192a60cf635707d99c74cdd15f5bd3f2b0))
* **api:** move territory routes under /v1/turf and drop device-only ones ([31f6c97](https://github.com/interdisciplinary-xyz/city-turfer/commit/31f6c9766a69e926287ffd7284420279575f24f3))
* **api:** share contract pieces and show planned routes in swagger ([6ec2c38](https://github.com/interdisciplinary-xyz/city-turfer/commit/6ec2c3885f1ae47a0fd72f8d5ba8533db33da896))
* **app:** add the cloud backup card to the info screen ([1507df4](https://github.com/interdisciplinary-xyz/city-turfer/commit/1507df46ae0a9ef5c608947c900f21961f1c1ae9))
* **app:** apply the brand across the mobile screens ([bba0cb2](https://github.com/interdisciplinary-xyz/city-turfer/commit/bba0cb219c75bf6c3b2c53a56904062583d30fc3))
* **app:** archivo for titles and stats ([5db8d34](https://github.com/interdisciplinary-xyz/city-turfer/commit/5db8d343dff8cf7d928ce9f3caef8796ea1b6aa6))
* **brand:** archivo typeface, contrast check and brand asset templates ([9e206fc](https://github.com/interdisciplinary-xyz/city-turfer/commit/9e206fce115ddafd8cd91783744ea750f6af7432))
* **cloud-backup:** back up activities to the cityturfer api ([be2e22d](https://github.com/interdisciplinary-xyz/city-turfer/commit/be2e22d633cbc6b0bebae23621c101ef7a9fb872))
* **core:** add @cityturfer/core with the shared kernel and core constants ([ab1a514](https://github.com/interdisciplinary-xyz/city-turfer/commit/ab1a5142b359390d56349b6fa0e68e061c4c0f6c))
* **core:** add the activity archive and home city choice queries ([a40a9d5](https://github.com/interdisciplinary-xyz/city-turfer/commit/a40a9d5554742ee849e51c5849cda30ba4dba7b8))
* **core:** expose the catalogue city view for a home city id ([96d02ec](https://github.com/interdisciplinary-xyz/city-turfer/commit/96d02ec81aa58f4d0bc8d6c25bb7ed2993f72e86))
* **core:** list the activity timeline without loading tracks ([52c885e](https://github.com/interdisciplinary-xyz/city-turfer/commit/52c885ef8a508997d095c4af081c745b4632d72d))
* **core:** move Achievements and Identity into @cityturfer/core ([bbefe0d](https://github.com/interdisciplinary-xyz/city-turfer/commit/bbefe0d48108bde703438efdbd47eb0568b503d6))
* **platform:** add migration v8 for cloud backup state ([76b5ab2](https://github.com/interdisciplinary-xyz/city-turfer/commit/76b5ab26c37edf89df8bed9c7b73fa269fb6fa5e))
* **territory:** move Territory's domain and use cases into @cityturfer/core ([fecedd3](https://github.com/interdisciplinary-xyz/city-turfer/commit/fecedd37f06c5a555f3b756bda3101470bb64bde))
* **territory:** softer turf on the record map, chips in one column, reliable e2e taps ([c68fdc2](https://github.com/interdisciplinary-xyz/city-turfer/commit/c68fdc2c84e19ded917fafc5a32fb5aef296d532))
* **territory:** turf toggle on the record map (wip) ([df45d95](https://github.com/interdisciplinary-xyz/city-turfer/commit/df45d954ed1326939158b2cf393cc7c1dfdc7362))
* **ui:** stat unit off Archivo, activity row takes an icon ([f42cb07](https://github.com/interdisciplinary-xyz/city-turfer/commit/f42cb07b626eb45517395bf3f0ba73f0d5b0bf3b))
* **web:** /branding page with the brand definition ([952901a](https://github.com/interdisciplinary-xyz/city-turfer/commit/952901a41eb1094c3c677affa9648beaadb39370))
* **web:** archivo headlines and social share image ([1b6aa2d](https://github.com/interdisciplinary-xyz/city-turfer/commit/1b6aa2d161e00c2f9eff3137014a22f6e648f908))
* **web:** brand the swagger docs page and show the dev toolbar on it ([1d7fa2f](https://github.com/interdisciplinary-xyz/city-turfer/commit/1d7fa2f59e685d25cb2f88e53fee0ec71eecf048))
* **web:** swagger ui at /swagger and an /api proxy on the local site ([8306cad](https://github.com/interdisciplinary-xyz/city-turfer/commit/8306cad037734764741c27f64ab9ab35a646a9aa))


### Bug Fixes

* **web:** swagger header tagline that reads as api docs ([3632b39](https://github.com/interdisciplinary-xyz/city-turfer/commit/3632b3955579e5f145dd74b243c3d6098761b72c))


### Refactoring

* **api:** add seams for real implementations ([42e2d24](https://github.com/interdisciplinary-xyz/city-turfer/commit/42e2d244e7ec6ee0f743a7ab8b8f78d2bee67ee2))
* **core:** prepare the core-bound code for packages/core in place ([d5f0b82](https://github.com/interdisciplinary-xyz/city-turfer/commit/d5f0b827ac2ffa84d5cda155b3275c2b7ed12b96))


### Documentation

* api decision, api-design skill and api-engineer agent ([11dfd4d](https://github.com/interdisciplinary-xyz/city-turfer/commit/11dfd4dc95b6d950f2cec8c6ca948247847087a1))
* api-engineer becomes the back-end engineer agent ([d15c812](https://github.com/interdisciplinary-xyz/city-turfer/commit/d15c812992f86c893a47094ae6e78c3de84e377b))
* **api:** add the guide to swagger and guard the docs against drift ([fff303c](https://github.com/interdisciplinary-xyz/city-turfer/commit/fff303c93d1ee1ca17278625b145c92bc5c6a874))
* **api:** device tokens, migrations and the deploy runbook ([3110f4c](https://github.com/interdisciplinary-xyz/city-turfer/commit/3110f4c7b4bd506c047b1c683651f9df57c114e2))
* **api:** record the sync-first api contract ([a04c104](https://github.com/interdisciplinary-xyz/city-turfer/commit/a04c104f8bfdafdc94d4cf19084dfe041ba33818))
* **brand:** brand foundations, brand-system skill and brand-designer agent ([62098f9](https://github.com/interdisciplinary-xyz/city-turfer/commit/62098f9457ff5abf17305047447347304515522b))
* **cloud-backup:** describe the backup card, context and what leaves the phone ([9e0d8f9](https://github.com/interdisciplinary-xyz/city-turfer/commit/9e0d8f91b27c2e8e5105a1002601d2d12031e8dc))
* **cloud-backup:** say where location data may leave the phone now ([efb8500](https://github.com/interdisciplinary-xyz/city-turfer/commit/efb8500acef1f28e2b4f02cf86a4325895bfbb14))
* **core:** describe packages/core and point docs at the moved code ([c2c5556](https://github.com/interdisciplinary-xyz/city-turfer/commit/c2c55561b186d737f612c7d49655cf3b94cede3f))
* **product:** product brief, product-knowledge skill and product-manager agent ([127d767](https://github.com/interdisciplinary-xyz/city-turfer/commit/127d767f0701e5b2f3355af4228b5474ce3f89de))
* **product:** product owner persona with discovery, strategy and launch skills ([17d4678](https://github.com/interdisciplinary-xyz/city-turfer/commit/17d4678fc367abc95ae416fa9c8d3a74880b241c))
* v0.6.0 and v0.7.0 session logs ([09588bc](https://github.com/interdisciplinary-xyz/city-turfer/commit/09588bccf15d4ef5696893017616bf8bc3f5ca31))
* v0.8.0 session log ([b431fac](https://github.com/interdisciplinary-xyz/city-turfer/commit/b431fac7c490ae8fac8ad54babe0906d6377b95f)), closes [#89](https://github.com/interdisciplinary-xyz/city-turfer/issues/89) [#90](https://github.com/interdisciplinary-xyz/city-turfer/issues/90) [#88](https://github.com/interdisciplinary-xyz/city-turfer/issues/88)
* v0.8.0 session log — [#93](https://github.com/interdisciplinary-xyz/city-turfer/issues/93), [#94](https://github.com/interdisciplinary-xyz/city-turfer/issues/94) merged; [#95](https://github.com/interdisciplinary-xyz/city-turfer/issues/95), [#96](https://github.com/interdisciplinary-xyz/city-turfer/issues/96) open ([598f8ef](https://github.com/interdisciplinary-xyz/city-turfer/commit/598f8ef1537f99b321b1aa0b580f5ee13604ffaf))
* v0.8.0 session log — [#95](https://github.com/interdisciplinary-xyz/city-turfer/issues/95), [#96](https://github.com/interdisciplinary-xyz/city-turfer/issues/96), [#98](https://github.com/interdisciplinary-xyz/city-turfer/issues/98), [#99](https://github.com/interdisciplinary-xyz/city-turfer/issues/99) merged ([612c138](https://github.com/interdisciplinary-xyz/city-turfer/commit/612c1386e89b3596112d77e6fc469c40704410d8))
* v0.8.0 session log — core, cloud backup and brand rollout ([#100](https://github.com/interdisciplinary-xyz/city-turfer/issues/100)–[#106](https://github.com/interdisciplinary-xyz/city-turfer/issues/106)) ([244b030](https://github.com/interdisciplinary-xyz/city-turfer/commit/244b03054cc40948586b48aec9eb303b7286aa2e))
* v0.8.0 session log — turf overlay PR [#94](https://github.com/interdisciplinary-xyz/city-turfer/issues/94) ([cba7c0e](https://github.com/interdisciplinary-xyz/city-turfer/commit/cba7c0eaf668db3c201b4c9a6dbd60ea17efa593))


### Tests

* **api:** one pglite database per test file, emptied between tests ([2e72b45](https://github.com/interdisciplinary-xyz/city-turfer/commit/2e72b454bda70b3b7f3c48d2bca1c46c10a1c5d4))
* **brand:** pin the Archivo font-family CSS variables ([044bb1d](https://github.com/interdisciplinary-xyz/city-turfer/commit/044bb1dca4b09d84375d96ed217c991038649ae5))
* **brand:** track the white label on the danger button ([2188695](https://github.com/interdisciplinary-xyz/city-turfer/commit/21886958e370691dbbec3575bc9d457ca7ee4e3a))
* **e2e:** home city flow retries the record chip tap after a choice ([885f44e](https://github.com/interdisciplinary-xyz/city-turfer/commit/885f44eb5c7220c85a64948d9d597a47219199d4))

## [0.7.0](https://github.com/interdisciplinary-xyz/city-turfer/compare/v0.6.0...v0.7.0) (2026-10-20)


### Features

* **recording:** pick the home city from the top of the record tab ([a382d87](https://github.com/interdisciplinary-xyz/city-turfer/commit/a382d87844f52c51fb35c2112ca334181d6bc7ff))
* **territory:** city picker and turf map opening on the home city ([4830b6e](https://github.com/interdisciplinary-xyz/city-turfer/commit/4830b6e4705732900ed54b10711b17e692d9c49a))
* **territory:** home city, a catalogue city the turf map opens on ([0920814](https://github.com/interdisciplinary-xyz/city-turfer/commit/09208147cd197b7a073fa1025b3abfa54401e64a))


### Bug Fixes

* **territory:** turf map camera on ios and home city refresh from review ([e9dd6fa](https://github.com/interdisciplinary-xyz/city-turfer/commit/e9dd6fa9ecb244edc427a7324e12af92c45212e2))


### Documentation

* **territory:** home city decision, features, skill and e2e coverage ([1a95c48](https://github.com/interdisciplinary-xyz/city-turfer/commit/1a95c486cc1f68a7c7f843212e2c259d470a4465))

## [0.6.0](https://github.com/interdisciplinary-xyz/city-turfer/compare/v0.5.0...v0.6.0) (2026-10-19)


### Features

* **storybook:** cityturfer logo and colours, docs pages, stories for every website piece ([9d395bd](https://github.com/interdisciplinary-xyz/city-turfer/commit/9d395bdbc47a1ed8606006a86aaa45ac904f3d4f))
* **web:** serve the storybook build at /storybook on the local site ([594db00](https://github.com/interdisciplinary-xyz/city-turfer/commit/594db009c3f44ee08bb945add73a079ee1d69a4a))

## [0.5.0](https://github.com/interdisciplinary-xyz/city-turfer/compare/v0.4.0...v0.5.0) (2026-10-19)


### Features

* **brand:** spacing, radii, type scale, themes and CSS variables ([f046b1e](https://github.com/interdisciplinary-xyz/city-turfer/commit/f046b1eefb25d198bd32d30ab421b992ac42834b))
* **storybook:** one Storybook for the app and the website ([f1015e7](https://github.com/interdisciplinary-xyz/city-turfer/commit/f1015e7212c434a957d98b44449289f1213cc7f5))
* **ui:** @cityturfer/ui with Button, Card, Stat, Badge, ActivityRow, TurfLegend ([ab5a4ad](https://github.com/interdisciplinary-xyz/city-turfer/commit/ab5a4adabdf5fc441d688ab59734bc7bbac7be2a))


### Bug Fixes

* **brand:** legend outline, weight and tracking tokens from brand review ([0964b30](https://github.com/interdisciplinary-xyz/city-turfer/commit/0964b30f329d93fc8a0cd1a4bb1266a775deab42))
* **ui:** one react-native for the whole workspace ([12b4b59](https://github.com/interdisciplinary-xyz/city-turfer/commit/12b4b5937a91cc1f0065f0265704374dd1a848a4))


### Refactoring

* **app:** screens use @cityturfer/ui components ([f8ef251](https://github.com/interdisciplinary-xyz/city-turfer/commit/f8ef2513a94862f62beb32fde31c1023c3a2620e))
* **web:** split the hero into synchronous components ([8761638](https://github.com/interdisciplinary-xyz/city-turfer/commit/87616382983c63a4267fd3eb8ea1ddbb5fdcafac))


### Documentation

* design system decision, skill and v0.5.0 session log ([f70f1ac](https://github.com/interdisciplinary-xyz/city-turfer/commit/f70f1acd9bdab4f7d7134291bf9376848763105b))
* v0.5.0 session log with the PR numbers ([63d50bc](https://github.com/interdisciplinary-xyz/city-turfer/commit/63d50bcb06cb1757c31890a87bdccc3fad2f3022))

## [0.4.0](https://github.com/interdisciplinary-xyz/city-turfer/compare/v0.3.0...v0.4.0) (2026-10-19)


### Features

* **health:** apple health card, imported label, simulator seed tool and e2e flow ([1276972](https://github.com/interdisciplinary-xyz/city-turfer/commit/1276972402200534d1acf5de0c1998aaf32a7129))
* **health:** import apple health workouts and save recordings to health ([44e710c](https://github.com/interdisciplinary-xyz/city-turfer/commit/44e710c0395c7da9053ef6c60c98705ba0369ad4))
* **health:** show outings already in cityturfer; e2e accepts reruns ([48a95e6](https://github.com/interdisciplinary-xyz/city-turfer/commit/48a95e60e789372bb93eb4914dc7f1c3e3e76aff))
* **web:** android and app store buttons; app store disabled until launch ([5f9be82](https://github.com/interdisciplinary-xyz/city-turfer/commit/5f9be82bdff3617d68e030d717b8d57aa1b5efa0))
* **web:** android download button; script to publish the apk ([bb5cebf](https://github.com/interdisciplinary-xyz/city-turfer/commit/bb5cebf66a5994cf965149758f0a02fa61652321))
* **web:** buttons in their own row under the text and phones ([1449026](https://github.com/interdisciplinary-xyz/city-turfer/commit/14490269c93061eee24c0e9ce07fbdaa474b6330))
* **web:** centre the hero vertically; tune phone and landscape layouts ([b86e975](https://github.com/interdisciplinary-xyz/city-turfer/commit/b86e97565fdbe3ea7c1756bc13858397241e481d))
* **web:** dashboard screenshot greets Adam ([fe5e393](https://github.com/interdisciplinary-xyz/city-turfer/commit/fe5e39384799aa2b915683293890fdbbfd5ba1e3))
* **web:** gsap entrance and ambient motion; web-motion skill and web-engineer agent ([7062d82](https://github.com/interdisciplinary-xyz/city-turfer/commit/7062d820b006ec5cf25b7590d0b7a910ab76f1b5))
* **web:** waitlist as its own centred section under the hero ([939246a](https://github.com/interdisciplinary-xyz/city-turfer/commit/939246a7f8c45976e90cda5d123555a3bcf5f584))
* **web:** waitlist sign-up through brevo with double opt-in ([f845b96](https://github.com/interdisciplinary-xyz/city-turfer/commit/f845b96bf50278d175ccdd3bd738d72c99ec0d03))


### Bug Fixes

* **android:** crash on the first location update ([033c35c](https://github.com/interdisciplinary-xyz/city-turfer/commit/033c35c131f2d5a50d4de45dfc7e5cbca7a88fb4))
* **mobile:** light status bar on the always-dark screens ([6c18b77](https://github.com/interdisciplinary-xyz/city-turfer/commit/6c18b7735587b988eb7420939c5e7a733edab03d))
* **release:** bump app.json without reformatting it ([5d3cc20](https://github.com/interdisciplinary-xyz/city-turfer/commit/5d3cc20e2cda2560239e89f2ba454f72bc27170e))
* **web:** hero captions wrapped one word per line on short, wide windows ([a51ab5b](https://github.com/interdisciplinary-xyz/city-turfer/commit/a51ab5b82e59c59ef19aefeb70112529f8dab560))


### Documentation

* android e2e notes for the release apk ([ca611d2](https://github.com/interdisciplinary-xyz/city-turfer/commit/ca611d2e1dd628e44061960c22fd86cb7478fdb2))
* android release guide ([7934467](https://github.com/interdisciplinary-xyz/city-turfer/commit/79344676d5b22212109869ee9af32ef216a69e80))
* apple health design, skill and health-engineer agent ([73ab055](https://github.com/interdisciplinary-xyz/city-turfer/commit/73ab055b54f9ebbaae0c741ee6cea64a1bea8fd2))
* apple health in claude.md, architecture, features, e2e and device guide ([0753f0d](https://github.com/interdisciplinary-xyz/city-turfer/commit/0753f0d29a302d313771ac0ad7934a220e484f49))
* format session log ([7e345c3](https://github.com/interdisciplinary-xyz/city-turfer/commit/7e345c3e03f5417ac1f064154d7ae317e4ce9712))
* iphone on the apple health build ([68cbb2b](https://github.com/interdisciplinary-xyz/city-turfer/commit/68cbb2b72411ef1896df94efa28bb1d8ee3c6334))
* v0.4.0 session log ([6980f30](https://github.com/interdisciplinary-xyz/city-turfer/commit/6980f300e31f3525659059c84c9283e26903fae8))
* v0.4.0 session log — android apk, waitlist, motion ([d4d10de](https://github.com/interdisciplinary-xyz/city-turfer/commit/d4d10dea6e8787ef5a43709ffadf63c962d47af9))
* v0.4.0 session log — apple health, store buttons ([1248a18](https://github.com/interdisciplinary-xyz/city-turfer/commit/1248a18fa50324a78b256a15e17beebdac73e8bd))
* v0.4.0 session log — local test run, android exclusion, iphone import ([ca9a362](https://github.com/interdisciplinary-xyz/city-turfer/commit/ca9a362b1aa477841f7e4a9b2dd8ac27d39126f8))


### Tests

* **e2e:** back navigation that works on Android too ([12f3fc3](https://github.com/interdisciplinary-xyz/city-turfer/commit/12f3fc3bd323470675147fb6ee02c6a2ad537519))
* **e2e:** close the expo dev menu on android's first launch ([a6d4b69](https://github.com/interdisciplinary-xyz/city-turfer/commit/a6d4b69a24fca8ab54f03f11c7695fe94132b3c3))

## [0.3.0](https://github.com/interdisciplinary-xyz/city-turfer/compare/v0.2.0...v0.3.0) (2026-10-18)


### Features

* **web:** app screenshots in the hero; dev server through portless ([8333a31](https://github.com/interdisciplinary-xyz/city-turfer/commit/8333a31d0286802e536ad601874819578946cf1e))
* **web:** dev toolbar from empatalk; session log up to date ([d935cb4](https://github.com/interdisciplinary-xyz/city-turfer/commit/d935cb44582d08911020cd5e6612f62b1f8f9da1)), closes [#50](https://github.com/interdisciplinary-xyz/city-turfer/issues/50) [-#52](https://github.com/interdisciplinary-xyz/-/issues/52)
* **web:** hero-only landing page in English and Polish ([3dc88e3](https://github.com/interdisciplinary-xyz/city-turfer/commit/3dc88e32ca9f10fd993fe5688142a85f2f77ad16)), closes [#53](https://github.com/interdisciplinary-xyz/city-turfer/issues/53)
* **web:** landing page and shared brand and config packages ([84faeb6](https://github.com/interdisciplinary-xyz/city-turfer/commit/84faeb623fad7e56f31a088cc09923a180fb5fc7))


### Documentation

* apps/mobile paths in the v0.3.0 session log and monorepo decision ([ce9b56f](https://github.com/interdisciplinary-xyz/city-turfer/commit/ce9b56ff4d3af83337e8588856c91240f0cb7071))
* v0.3.0 session log and monorepo decision ([d8d547b](https://github.com/interdisciplinary-xyz/city-turfer/commit/d8d547b722221c1f3ac44de0d7fde155e6932d18))
* v0.3.0 session log, [#54](https://github.com/interdisciplinary-xyz/city-turfer/issues/54) merged and scope complete ([9122286](https://github.com/interdisciplinary-xyz/city-turfer/commit/9122286827d6fab20b5a18bcdf5c42389f400557))

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
