# Changelog

All notable changes to this project will be documented in this file.

## [0.9.0](https://github.com/interdisciplinary-xyz/city-turfer/compare/v0.8.0...v0.9.0) (2026-10-22)


### Features

* **activity-log:** rename an activity from its detail screen ([c6f63dd](https://github.com/interdisciplinary-xyz/city-turfer/commit/c6f63dd3aa86f3732a9d83f08a51ed6e10decbaa))
* **api:** add user:find and user:delete support scripts ([6dc574a](https://github.com/interdisciplinary-xyz/city-turfer/commit/6dc574a59cbb8e32428e12ad39924e12b3527338))
* **api:** data export as an e-mailed one-time zip link ([5f245a4](https://github.com/interdisciplinary-xyz/city-turfer/commit/5f245a429c4a01239b034fd3ad80bb9040b5c0af))
* **api:** delete my account (DELETE /v1/me) ([d736095](https://github.com/interdisciplinary-xyz/city-turfer/commit/d7360950c558bc5db6b45e06660fc279426bbf3b))
* **api:** production boot guard, sanitised error log and daily retention cron ([83b20eb](https://github.com/interdisciplinary-xyz/city-turfer/commit/83b20ebfa3839327279852ce3f31c4914aa38c0b))
* **api:** rename activities with last write wins on renamedAt ([8e60ea9](https://github.com/interdisciplinary-xyz/city-turfer/commit/8e60ea9b2f91dcde5412900ccaa5af17cf6833c5))
* **api:** restore-ready feed and hardening (contract 0.4.0) ([342c6f5](https://github.com/interdisciplinary-xyz/city-turfer/commit/342c6f5b77a5faba1a2950796425ead18b901d1e))
* **api:** sign in with an e-mailed code (Better Auth) ([e4f82f8](https://github.com/interdisciplinary-xyz/city-turfer/commit/e4f82f8874f394182c6d92c441ebe5cc49704bb4))
* **api:** withdrawing a consent erases the server copy ([f892307](https://github.com/interdisciplinary-xyz/city-turfer/commit/f89230724de3227194dc1c43205bc5f84940400f))
* **app:** dark brand theme everywhere and Turf Map colours on the Record map ([78b37b0](https://github.com/interdisciplinary-xyz/city-turfer/commit/78b37b05e2eb40890fdbb5e8d71bb53f95e7a61a))
* **app:** email-code sign-in, restore prompt, account actions ([56e62fa](https://github.com/interdisciplinary-xyz/city-turfer/commit/56e62faf3376abb8688ab0b7d7e11b8716a0c402))
* **claude:** read-only Bash and edit-allowlist guards for agents ([2245fa7](https://github.com/interdisciplinary-xyz/city-turfer/commit/2245fa78e1d658bc8b4213de7ccc38a743ec9811))
* **cloud-backup:** restore from the backup onto a new phone ([877e9df](https://github.com/interdisciplinary-xyz/city-turfer/commit/877e9df5f431175b3ed87a0ae65b9a73d52f6ba2))
* **core:** rename event, restore import, chosenAt and kept time zones ([956a711](https://github.com/interdisciplinary-xyz/city-turfer/commit/956a71181db0d7b773961e62404dabada9c344d0))
* **identity:** demo account with Gdańsk history for screenshots ([7d010d3](https://github.com/interdisciplinary-xyz/city-turfer/commit/7d010d37436679a712dd42b02ddc47b2d0ba65c8))
* **identity:** sign in with an email code, account profiles, delete and export ([4424820](https://github.com/interdisciplinary-xyz/city-turfer/commit/44248207054224828e9f3d0bf8c10b7b0e5586b0))
* **tooling:** audit:harness checks agent tools, read-only guards and reports ([1fceb65](https://github.com/interdisciplinary-xyz/city-turfer/commit/1fceb6508d468b64f48708f08880da0187c72426))
* **web:** brand look for the Swagger API docs ([b2d6096](https://github.com/interdisciplinary-xyz/city-turfer/commit/b2d609623661770ca568ed3457f2e6a98744999a))
* **web:** dev pages answer only this machine ([39ce45f](https://github.com/interdisciplinary-xyz/city-turfer/commit/39ce45fa89aadb0d0ee157718101970d9955c9cc))
* **web:** dev toolbar links to Swagger and Storybook, no language switcher or API row ([0dc9df8](https://github.com/interdisciplinary-xyz/city-turfer/commit/0dc9df8cb4d8b7cee622fdd249bbe21f27440b38))
* **web:** dev toolbar on /branding and /storybook ([a412d04](https://github.com/interdisciplinary-xyz/city-turfer/commit/a412d041c10b50bdc42d1107a3808e73f4168013))
* **web:** ideal customer profile, fact checks and section nav on /branding ([305b787](https://github.com/interdisciplinary-xyz/city-turfer/commit/305b787b1a1734e479ca71c0081ef523932cdf2d))
* **web:** keep /branding out of the production export ([d0d160c](https://github.com/interdisciplinary-xyz/city-turfer/commit/d0d160c45c437af109ae39cc15f0ef6966d836b5))
* **web:** sticky app header, page loader and smooth scroll to the waitlist ([e8d190d](https://github.com/interdisciplinary-xyz/city-turfer/commit/e8d190dca0e2eaba37b82bd536c48621692e8539))
* **web:** swagger opens on Platform, guide moves to the end ([20b9893](https://github.com/interdisciplinary-xyz/city-turfer/commit/20b9893efe4eca104b964251e2c0ff642b9fab00))
* **web:** table of contents on the Swagger API docs ([9cb7fb7](https://github.com/interdisciplinary-xyz/city-turfer/commit/9cb7fb7651b09f58492346272210628e4ec754df))


### Bug Fixes

* **account:** ask to sign in again when the account token is missing ([73d7d54](https://github.com/interdisciplinary-xyz/city-turfer/commit/73d7d5466425c53dfe505a48aa1f276293ba6448))
* **activity-log:** only call a restored Activity invalid on a DomainError ([b450de6](https://github.com/interdisciplinary-xyz/city-turfer/commit/b450de6f2d3a7315290bb9083c138d5dd9c30f13))
* **activity-log:** retry the time-zone repair while the zone is unknown ([511f62b](https://github.com/interdisciplinary-xyz/city-turfer/commit/511f62b4a4165f97b996a6b26ce51bc414e54d20))
* **api:** accept only signed session tokens so a secret rotation revokes them ([2174c06](https://github.com/interdisciplinary-xyz/city-turfer/commit/2174c06c049ff0ff767f45a93de84498fc01d832))
* **api:** bucket IPv6 by /64 and count only failed sign-ins per IP ([833af05](https://github.com/interdisciplinary-xyz/city-turfer/commit/833af05018936ee69f51c1016d083d9af98ef28d))
* **api:** build summaries with the time zone and rename time core keeps ([3641c29](https://github.com/interdisciplinary-xyz/city-turfer/commit/3641c29c77dc23d54b43fed45fb7855eb2e66a20))
* **api:** cap sign-in codes and failed sign-ins per address per day ([67c905c](https://github.com/interdisciplinary-xyz/city-turfer/commit/67c905cce80e1b5f6c7c7b050550422a94fde6fc))
* **api:** fixed sign-in code only for the reserved test domain ([ff3e2c3](https://github.com/interdisciplinary-xyz/city-turfer/commit/ff3e2c3059938ce542bc1d6e638298b3ce2ad7a3))
* **api:** keep a withdrawn export withdrawn when its build finishes late ([fa34607](https://github.com/interdisciplinary-xyz/city-turfer/commit/fa34607bf99cd36273d7cec9fb79f3ccdb34c460))
* **api:** lock before consent, stale export leases, export size guard, keep tombstones ([3531b83](https://github.com/interdisciplinary-xyz/city-turfer/commit/3531b83062a780997fd0719b01171a922fce106c))
* **api:** refuse renamedAt from the future; test feed paging cuts ([2b7bcfe](https://github.com/interdisciplinary-xyz/city-turfer/commit/2b7bcfe27768bce5daa3a73f29ef4a0556e39f5d))
* **api:** stop code requests from voiding a user's pending code ([dac6cac](https://github.com/interdisciplinary-xyz/city-turfer/commit/dac6cac5712fd64e2163d642efd01dbd09494e1c))
* **api:** withdrawal erases exports; sturdier export delivery ([91720b3](https://github.com/interdisciplinary-xyz/city-turfer/commit/91720b35403b282967488a1bfc610b53d8a3fdf4))
* **app:** clearer delete-account and sign-in edge cases ([b559346](https://github.com/interdisciplinary-xyz/city-turfer/commit/b559346c180a60691c3433e58b09b2b532ab6381))
* **app:** make the dark theme stick on iOS and Android ([9b1e355](https://github.com/interdisciplinary-xyz/city-turfer/commit/9b1e355dc3c49c02b3a1bb7130ff5e5a07b64d54))
* **app:** point at the production api and drop the mock-auth crash guard ([0059aca](https://github.com/interdisciplinary-xyz/city-turfer/commit/0059acab003edf531ba3c78b1d0a8a53b46bc385))
* **app:** review nits for api url, rename dialog and cron bearer ([470be1f](https://github.com/interdisciplinary-xyz/city-turfer/commit/470be1fce479aaaf4376643a03b73013475e8f90))
* **claude:** close guard-hook gaps and false positives ([4ce0b34](https://github.com/interdisciplinary-xyz/city-turfer/commit/4ce0b347ba4207879714eadf3a6c6d31b527ad7a))
* **cloud-backup:** deliver pending withdrawals before switching account ([cfa1ca7](https://github.com/interdisciplinary-xyz/city-turfer/commit/cfa1ca7adc86ae168228f82ce32cb8c1aba1b8ff))
* **cloud-backup:** leave Apple Health off on a restored phone ([598c978](https://github.com/interdisciplinary-xyz/city-turfer/commit/598c9785b54251f190e70574af49326b7445d0ea))
* **cloud-backup:** let backups run while a restore is interrupted ([6c2d82c](https://github.com/interdisciplinary-xyz/city-turfer/commit/6c2d82cddd3c3d34718fd4f98c4353a948a5ed2a))
* **cloud-backup:** merge restores and keep backup on afterwards ([7f9c069](https://github.com/interdisciplinary-xyz/city-turfer/commit/7f9c0698dd3c9236712c1f66843769899b5d50ed))
* **cloud-backup:** never overwrite a newer rename from another phone ([4720e1b](https://github.com/interdisciplinary-xyz/city-turfer/commit/4720e1bdd1ba91d6e2b6465c78af25c718f6489c))
* **cloud-backup:** never restore an activity deleted here, across account switches ([857b86d](https://github.com/interdisciplinary-xyz/city-turfer/commit/857b86d299bda328ab3b6bda8da549d9d9eeb7ed))
* **cloud-backup:** reconcile changes made while off, per-account state, renames ([ad25bfe](https://github.com/interdisciplinary-xyz/city-turfer/commit/ad25bfef8caf7380b465602f98cff8909d396805))
* **cloud-backup:** restore never leaves a row without its activity ([7256f7f](https://github.com/interdisciplinary-xyz/city-turfer/commit/7256f7fe7cd8c1523aca04250427f6a4bef09ed8))
* **cloud-backup:** send the account session token only to the built-in server ([a0b3b8f](https://github.com/interdisciplinary-xyz/city-turfer/commit/a0b3b8fdb482fa791b6d24b8e8fc1e67c8cd52f0))
* **dev:** demo seed resumes with stable ids ([b1e2729](https://github.com/interdisciplinary-xyz/city-turfer/commit/b1e27293c733b6106912bd178edcc9a14f683bda))
* **harness:** allowlist the pnpm scripts read-only agents may run ([3c726df](https://github.com/interdisciplinary-xyz/city-turfer/commit/3c726df7f400ac8750999ee5535db1c37841ada5))
* **harness:** check the PR base for heads outside the branch naming ([c878145](https://github.com/interdisciplinary-xyz/city-turfer/commit/c8781456255bdefac397f7b5cfc7d7f486208c51))
* **harness:** deny gh release create/edit/delete and --squash=true merges ([464a61a](https://github.com/interdisciplinary-xyz/city-turfer/commit/464a61a3ab31f290226e65219ca362da4f4f9924))
* **harness:** deny git push --all, --branches, --mirror and glob refspecs ([7323c7a](https://github.com/interdisciplinary-xyz/city-turfer/commit/7323c7a098e258fbc3ec4d30428e47548654546c))
* **harness:** follow git switch and checkout before judging a bare push ([5f5d4e8](https://github.com/interdisciplinary-xyz/city-turfer/commit/5f5d4e8db9d3941eaf1c71fb2c5c2e40d2f6733c))
* **harness:** hold product-manager's Bash to its edit allowlist ([5e0500d](https://github.com/interdisciplinary-xyz/city-turfer/commit/5e0500da93d353e6da246097edb14772e8a78ed8))
* **harness:** match abbreviated long options in the git guards ([ff42a5d](https://github.com/interdisciplinary-xyz/city-turfer/commit/ff42a5debe7ed652967e402fed5b8b2d6c52bcc5))
* **harness:** read attached and clustered -X in read-only gh api and curl ([e907e2e](https://github.com/interdisciplinary-xyz/city-turfer/commit/e907e2eb732a17e9bacbeafb8898574e756547ae))
* **harness:** treat HUSKY=0 and core.hooksPath overrides as --no-verify ([c2da41c](https://github.com/interdisciplinary-xyz/city-turfer/commit/c2da41c3325810e5c2c0418a3409bbe15c98480c))
* **harness:** unwrap then/do/else and timeout, nice, xargs before the git guards ([3fea2cf](https://github.com/interdisciplinary-xyz/city-turfer/commit/3fea2cf8c669201ca170cef895dea177a90f00fd))
* **health-sync:** link Apple Health imports restored from the backup ([8c33fb2](https://github.com/interdisciplinary-xyz/city-turfer/commit/8c33fb2bb9c0c00941c62e1f60b5f0e183083274))
* **identity:** a 401 on delete changes nothing; keep the token only once a profile is chosen ([574a813](https://github.com/interdisciplinary-xyz/city-turfer/commit/574a8135a4eda2edd010a227d5286719e38b37bd))
* **identity:** adopted history stays closed to the mock password; delete always signs out ([5866690](https://github.com/interdisciplinary-xyz/city-turfer/commit/58666904943723e9c1c8660c5436667758a1ca9c))
* **identity:** finish a failed 'Delete from this phone' later and say so ([110237f](https://github.com/interdisciplinary-xyz/city-turfer/commit/110237f0646ae61e83a31c8541aa08ae7bc20f4b))
* **identity:** keep a deleted account's kept profile for its own email ([f4c1825](https://github.com/interdisciplinary-xyz/city-turfer/commit/f4c18253d0bfea6cac1e2333eadec5438bfe7f23))
* **product:** correct privacy and Apple Health claims on /branding and in the ICP ([6a5a576](https://github.com/interdisciplinary-xyz/city-turfer/commit/6a5a576f5c230af7003994a9e87b5abe09f1c409))
* **sign-in:** ignore a second submit while one is in flight ([d2e4a54](https://github.com/interdisciplinary-xyz/city-turfer/commit/d2e4a54979914339d3b288ada8db17ba57f8a52f))
* **territory:** keep the local Home City on a restored chosenAt tie ([63f8483](https://github.com/interdisciplinary-xyz/city-turfer/commit/63f8483835632fa6c8cb8c9ce7a3344116348b7b))
* **tooling:** harness and docs audits parse frontmatter as real YAML ([4d816c9](https://github.com/interdisciplinary-xyz/city-turfer/commit/4d816c96341688bb2f343f59a5baa630a1fb2b48))
* **tooling:** let commitlint skip the one merged README commit ([837f972](https://github.com/interdisciplinary-xyz/city-turfer/commit/837f9729eb11511504b2970ddc922dc9cff6fe49)), closes [#109](https://github.com/interdisciplinary-xyz/city-turfer/issues/109)
* **web:** clearer Polish waitlist link in the header ([b1b695b](https://github.com/interdisciplinary-xyz/city-turfer/commit/b1b695b91b6f3bb03c69e375e4dac6a5868e0fe9))
* **web:** make /branding a dev-only route instead of pruning the export ([3779c7a](https://github.com/interdisciplinary-xyz/city-turfer/commit/3779c7aafe2d8243e6acb2035787a4dfb181d3fc))
* **web:** page-root hydration warning, test CSS fallback matches the constant ([d9db8ac](https://github.com/interdisciplinary-xyz/city-turfer/commit/d9db8acfb53a0adda27365b2b25f2814b4706cee))
* **web:** product and brand review of /branding ([2bc2d78](https://github.com/interdisciplinary-xyz/city-turfer/commit/2bc2d78ec2e3e6da2af916b3616ea19c6aa8cf5d)), closes [#112](https://github.com/interdisciplinary-xyz/city-turfer/issues/112) [#112](https://github.com/interdisciplinary-xyz/city-turfer/issues/112)
* **web:** shorter page loader, content inert under it, ramp tween waits, boot script tests ([2d3b694](https://github.com/interdisciplinary-xyz/city-turfer/commit/2d3b694d0758decde0dfe966980fc246287d6a2a))
* **web:** show a compact waitlist link in the header on phones ([f7b8f8e](https://github.com/interdisciplinary-xyz/city-turfer/commit/f7b8f8e88b187a0703c8e9d1b3d77db2fdda4c1d))
* **web:** show the page loader only on slow loads and never make the page inert ([dfc1f9c](https://github.com/interdisciplinary-xyz/city-turfer/commit/dfc1f9c6d75fd19a78518f11c0d1f34a307cd31e))
* **web:** swagger contents follow the page, guide last ([274fa31](https://github.com/interdisciplinary-xyz/city-turfer/commit/274fa316b6b432be6932fca0c1004de661e61910))
* **web:** website stories mark the page loaded, add PageLoader story ([053625e](https://github.com/interdisciplinary-xyz/city-turfer/commit/053625ee4ffe75fcbc243ab8b94096faaba0901f))


### Documentation

* **api:** give the full path to AUTH_LIMITS in the api-design skill ([81dd8c3](https://github.com/interdisciplinary-xyz/city-turfer/commit/81dd8c35f9bac03664e70b486e2bd50ee81edd1c))
* **api:** point the Sync tag to the guide below ([baa5be2](https://github.com/interdisciplinary-xyz/city-turfer/commit/baa5be25458d9ad4e63e7cf802f54b0060544a49))
* **api:** production branch, migrate before merge, cron and support runbook ([4fa085f](https://github.com/interdisciplinary-xyz/city-turfer/commit/4fa085f6572bb04639489fba10a4f8939421c897))
* back-end plan for backup, accounts and restore ([b03fc88](https://github.com/interdisciplinary-xyz/city-turfer/commit/b03fc88316bc41c15855a114d75a7b1fee44524c))
* bring the readme up to v0.8.0 ([e9e869a](https://github.com/interdisciplinary-xyz/city-turfer/commit/e9e869ad53f31a75571701243e4ebc986a0674b8))
* **claude:** agents and skills reviewed against the v0.9.0 code ([d4512ff](https://github.com/interdisciplinary-xyz/city-turfer/commit/d4512ff5fc090edab0d08379a783f82c1e2afe81))
* **claude:** agents rewritten to the agent definition standard ([99715c9](https://github.com/interdisciplinary-xyz/city-turfer/commit/99715c9d81fb7156726903bc7d5d2701a894e606))
* **harness:** dark-only check in brand review and agent screenshots ([c8e6ae8](https://github.com/interdisciplinary-xyz/city-turfer/commit/c8e6ae82071fbab8dcc79bbae819c16429ffae31))
* **harness:** describe the tightened Bash guards in the ai-harness skill ([7c3c0c0](https://github.com/interdisciplinary-xyz/city-turfer/commit/7c3c0c0f53c11ee459e658f412435101443cb313))
* integration audit fixes in plan, session log, readme and skills ([3bda6c2](https://github.com/interdisciplinary-xyz/city-turfer/commit/3bda6c20e666660a37103fbe3199fe60b2275198))
* **product:** bring the back-end recommendation note to this branch ([f44519a](https://github.com/interdisciplinary-xyz/city-turfer/commit/f44519ab78a699aefbd98f253ec3b17a4c937f32)), closes [#112](https://github.com/interdisciplinary-xyz/city-turfer/issues/112)
* **product:** product-manager note on the no-account gap ([4089e45](https://github.com/interdisciplinary-xyz/city-turfer/commit/4089e45b356c78554e1a860854db9d9cf5783ec4))
* **product:** record the back-end recommendation and its founder outcome ([cc93e3e](https://github.com/interdisciplinary-xyz/city-turfer/commit/cc93e3ea9060fd75160db61b3220dce8523bce8f))
* refresh probe count after adding icp.md ([b5514ba](https://github.com/interdisciplinary-xyz/city-turfer/commit/b5514ba2448d499d0ee59e2907f823dbebf11893))
* **release:** bring the v0.9.0 session log up to date ([753576b](https://github.com/interdisciplinary-xyz/city-turfer/commit/753576bef042218574faec20aeea40a427aa9484)), closes [#119](https://github.com/interdisciplinary-xyz/city-turfer/issues/119) [#122](https://github.com/interdisciplinary-xyz/city-turfer/issues/122)
* **release:** describe the slow-load-only page loader in the v0.9.0 session log ([50e096d](https://github.com/interdisciplinary-xyz/city-turfer/commit/50e096d3e2b553285ef203cd2889b2ef3b01de30))
* v0.9.0 session log — dark app and Record map turf colours ([b8e68b4](https://github.com/interdisciplinary-xyz/city-turfer/commit/b8e68b4150ea0023277b6a1455b09ea239b6e0db))
* v0.9.0 session log — feat/backend-sync ([ffdcec0](https://github.com/interdisciplinary-xyz/city-turfer/commit/ffdcec0bc8b0c687d2fcc3667b6b639b357f14c8))
* v0.9.0 session log — link [#111](https://github.com/interdisciplinary-xyz/city-turfer/issues/111) ([b91dfda](https://github.com/interdisciplinary-xyz/city-turfer/commit/b91dfdab04c1fc421128ca66815cb1daa5ffa0f6))
* v0.9.0 session log — link [#112](https://github.com/interdisciplinary-xyz/city-turfer/issues/112) ([ddb2acb](https://github.com/interdisciplinary-xyz/city-turfer/commit/ddb2acba02e8b8bb26a22581b27484cd332c2e80))


### Tests

* **app:** live api test expects backup back on after a restore ([fc1049f](https://github.com/interdisciplinary-xyz/city-turfer/commit/fc1049f22e40938665342f4111b2e9283e1dc6e6))
* **e2e:** sign-in, backup and restore against a live local API ([f719b2e](https://github.com/interdisciplinary-xyz/city-turfer/commit/f719b2ee387dfa76669ac268ad55b24b9b3cd3cd))
* **tooling:** skip the branding check when the web build is older than its source ([001571a](https://github.com/interdisciplinary-xyz/city-turfer/commit/001571a6550f458ea165c1a317c9c389cae9fef9))

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
