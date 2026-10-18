import packagePreset from './src/package.js';

/**
 * The config package lints itself with its own `package` preset — the same
 * R5 gate as every package (`no-restricted-imports` on static imports,
 * `no-restricted-syntax` on `import()` / `require()`). It holds no app
 * specifiers any more (the app-shaped rules live in
 * `apps/web/eslint-local-rules/`), so `audit:packages` text-scans all of it.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export default [
  // One tsconfig root per workspace: lint-staged lints several workspaces in one run.
  { languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } } },
  ...packagePreset(),
  {
    // Plain ESM run by Node (ESLint loads it without a TS loader).
    files: ['src/**/*.js'],
    languageOptions: {
      sourceType: 'module',
      globals: { console: 'readonly', process: 'readonly' },
    },
  },
];
