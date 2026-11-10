---
status: canonical
verified: 2026-11-10
owner: founder
scope:
  [
    apps/web/src,
    apps/web/.dependency-cruiser.cjs,
    apps/web/eslint.config.mjs,
    packages/eslint-config/src/rules/no-deep-domain-import.js,
  ]
summary:
  apps/web/src is split into domains like respect.click and empatalk.app — src/app holds routes
  only, components live in src/domains/<domain>, src/lib is infrastructure; depcruise checks which
  domain may import which, ESLint keeps imports between domains on the barrels
---

# apps/web: domain layout

The founder asked for the domain layout of the other web apps (respect.click, empatalk.app) in
`apps/web/src`. Before, every component sat in src/app/[locale]/ next to the routes and the portal's
in src/app/[locale]/account/\_portal/. This is the website's layout, not the app's DDD contexts
(`ddd-architecture` skill): there is no domain model here, only pieces of UI grouped by what they
are for.

## Layout

```
apps/web/src/
  app/                    routes only: page.tsx, layout.tsx, sitemap, globals.css, fonts; the dev-only
                          /branding page and dev toolbar stay route-local
  domains/<domain>/
    components/<unit>/    <unit>.tsx, <unit>.constants.ts, index.ts (and the unit's CSS and tests)
    hooks/<hook>/         one hook per folder
    utils/                pure helpers
    index.ts              the barrel: the domain's public surface
  lib/                    infrastructure, not a domain: api/ (the portal's API client), site URLs
  i18n/                   next-intl routing and request config
```

| Domain       | Holds                                                                                            | May import                |
| ------------ | ------------------------------------------------------------------------------------------------ | ------------------------- |
| `ui`         | language switcher, page loader, the motion boot script                                           | nothing (base leaf)       |
| `waitlist`   | the waitlist form and its configuration                                                          | `ui`                      |
| `homepage`   | hero (city map, copy, motion, phones), the sections, icons, turf demo, store buttons             | `ui`                      |
| `layout`     | app header, site footer                                                                          | `homepage`, `ui`          |
| `portal`     | the signed-in shell: frame, header, nav, session gate, notices, errors, formatting, backup state | `ui`                      |
| `auth`       | sign-in form and page                                                                            | `portal`, `ui`            |
| `account`    | account summary, backup status, devices, export, delete, privacy page                            | `portal`, `ui`            |
| `activities` | activity list, detail, filters, totals, route drawing                                            | `account`, `portal`, `ui` |

## Rules (enforced)

- **Allowed imports between domains:** `DOMAIN_EDGES` in `apps/web/.dependency-cruiser.cjs` is the
  source of truth; the table above mirrors it. Every folder in `apps/web/src/domains` must be listed
  (`domain-declared`). Change both in the same PR. `no-circular` still bans cycles.
- **Barrels:** code outside a domain imports `@/domains/<domain>`, never a file inside it
  (`local-rules/no-deep-domain-import`, ported from empatalk into
  `@interdisciplinary/eslint-config`, on in apps/web). Inside a domain, files import each other by
  path, never through their own barrel (that would be a cycle). Stylesheets are assets and may be
  imported by path.
- **`apps/web/src/lib` is infrastructure:** it imports no domain and no route
  (`lib-is-infrastructure`).
- **Public/portal boundary** (`docs/decisions/web-portal-2026-10-22.md`) now reads in domains: the
  portal is its routes plus `portal`, `auth`, `account`, `activities`; marketing code never imports
  them, `apps/web/src/lib/api` or their libraries, and the portal never loads GSAP or the `homepage`
  domain.
- **Barrels cost weight:** Turbopack keeps every client module a barrel re-exports, so a barrel
  import ships the whole domain. Keep shared bases light: `ui` holds only what the shared locale
  layout needs (boot scripts, loader, language switch; the icons and their CSS live in `homepage`),
  and logic two portal domains share lives in `portal` (the backup state), not in a page-sized
  domain.

## Not done

- No per-domain e2e folders (respect.click's `domains/<d>/e2e`): the Playwright specs stay in
  `apps/web/e2e`.
- Some portal logic tests still live in `apps/web/src/lib/api/__tests__` and import the domains
  through their barrels (Vitest inlines next-intl so the barrels load in node).
