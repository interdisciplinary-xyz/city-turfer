// DDD dependency rules (see .claude/skills/ddd-architecture/SKILL.md). Runs in `pnpm test`.
const ctx = '^src/contexts/([^/]+)/';
const notTests = '(__tests__|test-support)/';
// @cityturfer/core (packages/core) is used through its published entry points only.
const coreSrc = '(^|/)packages/core/src/';
const coreEntry =
  coreSrc +
  '(constants/index|shared-kernel/index|h3/index|districts/index|demo/index|contexts/[^/]+/(index|ports))\\.ts$';
module.exports = {
  forbidden: [
    {
      name: 'domain-is-pure',
      severity: 'error',
      comment: 'Domain and shared kernel: no frameworks, no infrastructure, no outer layers.',
      from: { path: '^src/(shared-kernel|contexts/[^/]+/domain)/', pathNot: notTests },
      to: {
        path: '^((\\.\\./)*node_modules/(react|react-native|react-native-nitro-modules|@kingstinct/react-native-healthkit|@[^/]+/react-native-[^/]+|@react-native[^/]*|expo[^/]*|zustand|h3-js|@maplibre|better-sqlite3|@cityturfer/ui)/|(\\.\\./)*packages/ui/|@cityturfer/ui$|(\\.\\./)*packages/core/src/(h3|districts)/|src/(platform|composition-root|wiring|app|ui-kit)|src/contexts/[^/]+/(application|infrastructure|ui)/)',
      },
    },
    {
      name: 'application-no-infra-or-ui',
      severity: 'error',
      from: { path: ctx + 'application/', pathNot: notTests },
      to: {
        path: '^((\\.\\./)*node_modules/(react|react-native|expo[^/]*|h3-js|@maplibre|@cityturfer/ui)/|(\\.\\./)*packages/ui/|@cityturfer/ui$|(\\.\\./)*packages/core/src/(h3|districts)/|src/contexts/[^/]+/(infrastructure|ui)/|src/(composition-root|wiring|app|ui-kit))',
      },
    },
    {
      name: 'contexts-only-via-public-api',
      severity: 'error',
      comment: "A context may not reach into another context's layers; use its index.ts / contract.ts.",
      from: { path: ctx, pathNot: notTests },
      to: { path: '^src/contexts/([^/]+)/(domain|application|infrastructure|ui)/', pathNot: '^src/contexts/$1/' },
    },
    {
      name: 'screens-use-ui-layer',
      severity: 'error',
      comment: 'Screens talk to contexts through their ui/ hooks and public API only.',
      from: { path: '^src/app/' },
      to: { path: '^src/(contexts/[^/]+/(domain|application|infrastructure)/|platform/)' },
    },
    {
      name: 'constants-are-leaf',
      severity: 'error',
      comment:
        'src/constants holds plain shared values: it imports nothing but other constants and the shared brand tokens (@cityturfer/brand, plain values too), so any layer may use it.',
      from: { path: '^src/constants/', pathNot: notTests },
      to: {
        pathNot: [
          '^src/constants/',
          '^@cityturfer/brand$',
          '(^|/)packages/brand/',
          '(^|/)node_modules/@cityturfer/brand/',
          '(^|/)packages/core/src/constants/',
        ],
      },
    },
    {
      name: 'core-via-entry-points',
      severity: 'error',
      comment:
        'App code uses @cityturfer/core through its package entry points (@cityturfer/core/<entry>), never its internal files.',
      from: { path: '^src/' },
      to: { path: coreSrc, pathNot: coreEntry },
    },
    {
      name: 'core-ports-for-own-adapters',
      severity: 'error',
      comment:
        "@cityturfer/core/<ctx>/ports (repository ports, aggregates to rehydrate) is for that context's own adapters, test doubles and the composition root; everything else uses @/contexts/<ctx>.",
      from: {
        path: '^src/',
        pathNot:
          '^src/(contexts/[^/]+/(infrastructure|test-support|__tests__)/|wiring\\.ts$|composition-root\\.ts$|__tests__/|test-support/)',
      },
      to: { path: coreSrc + 'contexts/[^/]+/ports\\.ts$' },
    },
    {
      name: 'core-ports-only-of-own-context',
      severity: 'error',
      comment: "An adapter implements its own context's ports, never another context's.",
      from: { path: ctx },
      to: { path: coreSrc + 'contexts/([^/]+)/ports\\.ts$', pathNot: coreSrc + 'contexts/$1/ports\\.ts$' },
    },
    {
      name: 'background-task-stays-offline',
      severity: 'error',
      comment:
        'The background location task (and its batch handler) never talks to the server or reads account tokens: no Cloud Backup, no Identity network or keychain code, no fetch clients. It reaches the rest only through getContainer().',
      from: { path: '^src/contexts/recording/infrastructure/(background-task|location-batch-handler)\\.ts$' },
      to: {
        path: [
          '^src/contexts/cloud-backup/',
          '^src/contexts/identity/infrastructure/(api-auth-gateway|secure-store-credential-store)\\.ts$',
          '^src/contexts/[^/]+/infrastructure/(fetch-|api-|osm-)',
        ],
      },
    },
    { name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    // Resolve workspace packages through package.json "exports" (@cityturfer/core/<entry>).
    enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'require', 'node', 'default'] },
    exclude: { path: '^tools' },
  },
};
