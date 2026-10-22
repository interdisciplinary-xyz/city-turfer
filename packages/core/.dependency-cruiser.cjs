// DDD dependency rules for @cityturfer/core (see .claude/skills/ddd-architecture/SKILL.md). The same
// layer rules as apps/mobile/.dependency-cruiser.cjs, plus: core is platform-free and only src/h3
// touches h3-js. Runs in `pnpm test` / `turbo run arch`.
const ctx = '^src/contexts/([^/]+)/';
const notTests = '(__tests__|test-support)/';
// Frameworks, native modules, SQLite drivers, UI packages and the apps: never in core.
const platform =
  '(^|/)node_modules/(react|react-native|react-native-[^/]+|react-native-nitro-modules|expo[^/]*|@expo|@maplibre|@kingstinct|@kingstinct/react-native-healthkit|@[^/]+/react-native-[^/]+|@react-native[^/]*/[^/]+|better-sqlite3|@cityturfer/(ui|brand))/|(^|/)packages/(ui|brand)/|(^|/)apps/';
module.exports = {
  forbidden: [
    {
      name: 'core-is-platform-free',
      severity: 'error',
      comment: 'Core runs on the phone and on the server: no React, Expo, native modules, UI or app code.',
      from: { path: '^src/' },
      to: { path: platform },
    },
    {
      name: 'h3-only-in-h3',
      severity: 'error',
      comment: 'h3-js is an adapter of the CellGrid port: only src/h3 (the @cityturfer/core/h3 entry) loads it.',
      from: { path: '^src/', pathNot: '^src/h3/' },
      to: { path: '(^|/)node_modules/h3-js/' },
    },
    {
      name: 'domain-is-pure',
      severity: 'error',
      comment: 'Domain and shared kernel: no frameworks, no adapters (src/h3), no outer layers.',
      from: { path: '^src/(shared-kernel|contexts/[^/]+/domain)/', pathNot: notTests },
      to: { path: '^src/(h3/|contexts/[^/]+/(application/|index\\.ts|ports\\.ts))' },
    },
    {
      name: 'application-no-infra-or-ui',
      severity: 'error',
      comment: 'Application layer: no adapters (src/h3); ports are interfaces it declares itself.',
      from: { path: ctx + 'application/', pathNot: notTests },
      to: { path: '^src/h3/' },
    },
    {
      name: 'contexts-only-via-public-api',
      severity: 'error',
      comment: "A context may not reach into another context's layers; use its index.ts / contract.ts.",
      from: { path: ctx, pathNot: notTests },
      to: { path: '^src/contexts/([^/]+)/(domain|application|test-support)/', pathNot: '^src/contexts/$1/' },
    },
    {
      name: 'constants-are-leaf',
      severity: 'error',
      comment: 'src/constants holds plain shared values: it imports nothing but other constants.',
      from: { path: '^src/constants/' },
      to: { pathNot: '^src/constants/' },
    },
    { name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
  },
};
