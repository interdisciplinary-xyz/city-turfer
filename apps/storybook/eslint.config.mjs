import base from '@interdisciplinary/eslint-config/base';
import react from '@interdisciplinary/eslint-config/react';
import eslintConfigPrettier from 'eslint-config-prettier';
import pluginReact from 'eslint-plugin-react';
import globals from 'globals';

/**
 * Storybook: stories render @cityturfer/ui (React Native) and apps/web's components, so both the
 * React and the DOM accessibility rules apply.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export default [
  // One tsconfig root per workspace: lint-staged lints several workspaces in one run.
  { languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } } },
  { ignores: ['storybook-static/**'] },
  // eslint-config-prettier turns `curly` off, so it goes in BEFORE the preset's rules turn it on.
  ...base({ layers: [eslintConfigPrettier] }),
  ...react(),
  pluginReact.configs.flat.recommended,
  pluginReact.configs.flat['jsx-runtime'],
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    settings: { react: { version: 'detect' } },
    rules: { 'react/prop-types': 'off' },
  },
];
