// Root ESLint: the repo-wide tools in tools/. Each workspace has its own eslint.config.mjs.
import base from '@interdisciplinary/eslint-config/base';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';

/** @type {import("eslint").Linter.Config[]} */
export default [
  // One tsconfig root per workspace: lint-staged lints several workspaces in one run.
  { languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } } },
  ...base({ noConsole: 'warn', layers: [eslintConfigPrettier] }),
  {
    languageOptions: { globals: { ...globals.node } },
    rules: { 'no-console': 'off', '@typescript-eslint/no-require-imports': 'off' },
  },
];
