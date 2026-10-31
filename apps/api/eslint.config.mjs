import base from '@interdisciplinary/eslint-config/base';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';

/**
 * The API runs on Node (Vercel Functions, local tsx). Shared floor from the base preset; no React.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export default [
  // One tsconfig root per workspace: lint-staged lints several workspaces in one run.
  { languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } } },
  // eslint-config-prettier turns `curly` off, so it goes in BEFORE the preset's rules turn it on.
  ...base({ layers: [eslintConfigPrettier] }),
  { languageOptions: { globals: { ...globals.node } } },
  {
    // The district boundaries (OSM, ODbL) are an app-only entry of core: the server ships none.
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@cityturfer/core/districts',
                '@cityturfer/core/districts/**',
                '@cityturfer/core/src/districts',
                '@cityturfer/core/src/districts/**',
                '**/packages/core/src/districts',
                '**/packages/core/src/districts/**',
              ],
              message: '@cityturfer/core/districts is app-only (OSM district boundaries); the API does not use it.',
            },
          ],
        },
      ],
    },
  },
  {
    // CLI scripts print to stdout.
    files: ['scripts/**'],
    rules: { 'no-console': 'off' },
  },
];
