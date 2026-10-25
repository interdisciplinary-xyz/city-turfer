---
name: design-system
description: >-
  Use when adding or changing a shared component or token, writing a story, running Storybook, or
  asking "is there a component for this?" / "will this still ship over the air?". Covers
  @cityturfer/brand tokens, @cityturfer/ui components and apps/storybook.
---

# Design system

Decision and reasons: `docs/decisions/design-system-2026-10-19.md`. Brand rules (voice, colours,
logo) stay in the `brand-system` skill; this skill is about the code that carries them.

## Where things live

| What                         | Where                                                   | Read by                                         |
| ---------------------------- | ------------------------------------------------------- | ----------------------------------------------- |
| Colours, copy                | `packages/brand/src/colors.ts`, `copy.ts`               | both apps                                       |
| Spacing, radii, type, themes | `packages/brand/src/tokens.ts`                          | `@cityturfer/ui` (TS), web via `cssVariables()` |
| RN components                | `packages/ui/src/<name>/<name>.tsx` + `.constants.ts`   | `apps/mobile` (via `ui-kit`), Storybook         |
| Stories                      | `apps/storybook/src/stories/{foundations,app,website}/` | Storybook                                       |

## Rules

1. **No native code in `@cityturfer/ui`.** Only `react`, `react-native` and `@cityturfer/brand`.
   ESLint bans `expo*`, `@expo/*`, `@maplibre/*`, `@kingstinct/*`, `react-native-*`, `h3-js` there.
   A component that needs one (map, symbols, haptics) takes it as `children` from the app (e.g. the
   Achievements screen, `apps/mobile/src/app/achievements.tsx`, passes an `expo-symbols`
   `SymbolView` into `Badge`), or stays in the app (`ui-kit/` or a context's `ui/`).
2. **Peer dependencies plus `@cityturfer/brand`** in `packages/ui/package.json`: `react` and
   `react-native` are peers; the only real dependency is `@cityturfer/brand` (pure TS workspace
   package). A real dependency with native code would be autolinked into the app and change the
   fingerprint. Keep **one react-native and one react** in the workspace: dev dependencies that peer
   on them (e.g. `@react-native/jest-preset`) must have the same version in every workspace, or pnpm
   nests a second copy (`tools/__tests__/single-react-native.test.mjs` catches it).
3. **Presentational components.** Strings arrive formatted; units convert in the app's
   `ui-kit/format.ts`, not in `@cityturfer/ui`. No domain types: a context maps its item to props
   (see `apps/mobile/src/contexts/activity-log/ui/activity-row.tsx`).
4. **Tokens, never literals.** Sizes from `SPACE`/`RADIUS`/`FONT_SIZE`, colours from `usePalette()`
   or brand colours. Hex lives only in `packages/brand`.
5. **The app imports through `@/ui-kit/components` and `@/ui-kit/theme`** (re-exports), so screens
   don't change when a component moves. Domain, shared kernel and application layers may not import
   `@cityturfer/ui` (dependency-cruiser).
6. **Website CSS uses variables** from `cssVariables(SITE_SCHEME)` (`--bg`, `--card`,
   `--accent-text`, `--walk-graphic`, `--space-lg`, `--radius-panel`, `--font-hero`…). The site is
   dark like the app: `SITE_SCHEME` is the only place the site's scheme is named. Add a token in
   `tokens.ts` and it appears on the site and in Storybook; never hand-copy values into
   `globals.css`.
7. Repo lint rules apply: props types and SCREAMING constants in `<name>.constants.ts`, one import
   per module, `curly: all`.

## Adding a component

1. `packages/ui/src/<name>/{<name>.tsx,<name>.constants.ts}`; export it and its props type from
   `packages/ui/src/index.ts`.
2. Test it in `packages/ui/src/__tests__/` (react-test-renderer; find native views by `testID` with
   the `host()` helper, presses with `pressable()`).
3. A story in `apps/storybook/src/stories/app/<name>.stories.tsx`: default and each state. Stories
   render in `SITE_SCHEME` (dark, like the app); the app itself is still checked on a device or
   simulator (`mobile-testing` skill), not through Storybook.
4. If the app should use it: re-export from `apps/mobile/src/ui-kit/components.tsx`, switch the
   screen, and prove "no visible change" (same sizes, colours, text, testIDs, accessibility labels).
5. Check the fingerprint (below).

## Storybook

```bash
pnpm --filter @cityturfer/storybook dev      # http://localhost:6006 (6006: Metro owns 8081)
pnpm --filter @cityturfer/storybook build    # apps/storybook/storybook-static (also in turbo build)
# The website dev server (`pnpm run web:dev`) serves that build at https://cityturfer.local/storybook
# (apps/web/tools/storybook-route.mjs, dev only). Rebuild to refresh it; live editing stays on 6006,
# because Storybook's dev server only works at the site root. From a git worktree portless adds the
# branch to the hostname; `npx portless alias cityturfer <port>` maps the plain name.
```

- Every story renders with `SITE_SCHEME` (dark), like the website and the app; there is no theme
  toolbar. Toolbar: **Language** (en/pl; website copy from `apps/web/messages`). A map inside a
  story sits on a night panel, as on the site.
- Website components come from `apps/web/src` through the `@/` alias. `next/image` and next-intl's
  `Link` are shimmed (`apps/storybook/src/shims/`); async server components can't render, so keep
  website pieces synchronous (`useTranslations`, not `await getTranslations`).
- Static files from `apps/web/public` are served at the same paths.
- Native-only UI (Turf Map, live recording, Apple Health) gets a `NativePlaceholder` story.
- **Coverage: every exported component has a story.** That means each `@cityturfer/ui` export, and
  each website piece in `apps/web/src/app/[locale]/` (plus `Website/Page`, which composes
  `page.tsx`, a server component that can't render here). Mobile screen components that read the
  container (`contexts/*/ui/`) are not in Storybook. They join when their presentational part moves
  to `packages/ui`.
- **Branded Storybook UI:** `.storybook/theme.ts` (`create()` from `storybook/theming`, colours from
  `@cityturfer/brand`: the `SITE_SCHEME` theme and `ACCENT`, never hex). It's used by `manager.ts`
  for the sidebar and toolbar, and by `parameters.docs.theme` for the docs pages. The sidebar logo
  is `brandTitle` HTML: the mark plus the "City/Turfer" wordmark. `manager-head.html` sets the tab
  icon. Brand SVGs are served at `brand/` (a `staticDirs` entry). Keep every URL relative, so it
  works under `/storybook`.
- **Docs pages:** `tags: ['autodocs']` in `preview.tsx` (`@storybook/addon-docs`). Each component's
  `parameters.docs.description.component` is its intro.
- Screenshots: serve `storybook-static` with a server that keeps query strings
  (`python3 -m http.server`; `serve` redirects `iframe.html?…` to `/iframe` and drops them) and load
  `iframe.html?id=<story-id>&viewMode=story` (add `&globals=locale:pl` for Polish) inside an iframe
  of the exact size (headless Chrome's viewport doesn't match `--window-size`; same trick as
  `apps/web/tools/viewports.mjs`).

## Shipping over the air

Nothing in the design system may change the runtime fingerprint. After any change to `packages/ui`,
`packages/brand`, `apps/storybook` or dependencies:

```bash
pnpm -C apps/mobile exec expo-updates fingerprint:generate --platform ios | jq -r .hash
pnpm -C apps/mobile exec expo-updates fingerprint:generate --platform android | jq -r .hash
```

Compare with the base fingerprint: run the same two commands on a checkout of the base (the active
`scope/v*` branch, or the latest release tag, `git tag --sort=-v:refname | head -1`), e.g. in a
temporary `git worktree` after `pnpm install`. Equal hashes mean the change ships over the air. Also
never bump `apps/mobile/app.json` `version` in a JS-only release: it is part of the fingerprint.
