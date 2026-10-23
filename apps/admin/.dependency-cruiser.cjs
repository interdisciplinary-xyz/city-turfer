// Dependency rules for apps/admin (the admin-portal skill). Runs in `pnpm test` / `turbo run arch`.
// Admin reaches user data only through the API: it may not import another app, a database driver
// (except Payload's own adapter, in payload.config.ts), or anything React Native.
module.exports = {
  forbidden: [
    {
      name: 'no-undeclared-deps',
      severity: 'error',
      comment:
        'The install is hoisted: every package in the repo resolves from here. Only what apps/admin/package.json declares may be imported (closes better-sqlite3, kysely and the like).',
      from: {},
      to: { dependencyTypes: ['npm-no-pkg', 'npm-unknown'] },
    },
    {
      name: 'no-other-apps',
      severity: 'error',
      comment: 'Admin is a client of the API like the phone and the web portal: never import an app.',
      from: { path: '^(src|scripts)/' },
      // depcruise reports paths relative to apps/admin: a sibling app is `../<app>/…`.
      to: { path: '^\\.\\./(?!admin/)[^./]|(^|/)apps/(?!admin/)' },
    },
    {
      name: 'no-database-drivers',
      severity: 'error',
      comment:
        "User tables are the API's. Admin has no SQL client; Payload's adapter is wired only in payload.config.ts.",
      from: { path: '^(src|scripts)/' },
      to: {
        path: '(^|/)node_modules/(drizzle-orm|drizzle-kit|pg|pg-[^/]+|postgres|@payloadcms/drizzle|@neondatabase/[^/]+|@electric-sql/pglite)/',
      },
    },
    {
      name: 'payload-db-adapter-only-in-config',
      severity: 'error',
      comment: "Only src/payload.config.ts wires Payload's Postgres adapter (admin's own database).",
      from: { path: '^(src|scripts)/', pathNot: '^src/(payload\\.config\\.ts|migrations/)' },
      to: { path: '(^|/)node_modules/@payloadcms/db-postgres/' },
    },
    {
      name: 'no-react-native',
      severity: 'error',
      comment: 'Admin is a web app: no React Native, no @cityturfer/ui, no h3-js (counts only, never cells).',
      from: { path: '^(src|scripts)/' },
      to: { path: '(^|/)node_modules/(react-native[^/]*|@cityturfer/ui|h3-js|expo[^/]*)/|(^|/)packages/ui/' },
    },
    {
      name: 'core-only-via-entries',
      severity: 'error',
      comment: 'Use @cityturfer/core through its entries (@cityturfer/core/<ctx>), never its internals.',
      from: { path: '^(src|scripts)/' },
      to: { path: '(^|/)packages/core/src/contexts/[^/]+/(domain|application|infrastructure)/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'require', 'node', 'default'] },
  },
};
