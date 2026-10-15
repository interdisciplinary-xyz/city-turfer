// DDD dependency rules (see .claude/skills/ddd-architecture/SKILL.md). Runs in `npm test`.
const ctx = '^src/contexts/([^/]+)/';
const notTests = '(__tests__|test-support)/';
module.exports = {
  forbidden: [
    {
      name: 'domain-is-pure',
      severity: 'error',
      comment: 'Domain and shared kernel: no frameworks, no infrastructure, no outer layers.',
      from: { path: '^src/(shared-kernel|contexts/[^/]+/domain)/', pathNot: notTests },
      to: {
        path: '^(node_modules/(react|react-native|expo[^/]*|zustand|h3-js|@maplibre|better-sqlite3)/|src/(platform|composition-root|wiring|app|ui-kit)|src/contexts/[^/]+/(application|infrastructure|ui)/)',
      },
    },
    {
      name: 'application-no-infra-or-ui',
      severity: 'error',
      from: { path: ctx + 'application/', pathNot: notTests },
      to: {
        path: '^(node_modules/(react|react-native|expo[^/]*|h3-js|@maplibre)/|src/contexts/[^/]+/(infrastructure|ui)/|src/(composition-root|wiring|app|ui-kit))',
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
    { name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    exclude: { path: '^tools' },
  },
};
