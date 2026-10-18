import base from '@interdisciplinary/eslint-config/base';
import react from '@interdisciplinary/eslint-config/react';
import pluginNext from '@next/eslint-plugin-next';
import eslintConfigPrettier from 'eslint-config-prettier';
import pluginReact from 'eslint-plugin-react';
import globals from 'globals';

/**
 * The shared floor (typescript-eslint, import sorting, unused imports, curly, no-console, the
 * shared `local-rules`) and React (react-hooks + jsx-a11y) come from
 * `@interdisciplinary/eslint-config`. Only Next.js specifics live here.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export default [
  // One tsconfig root per workspace: lint-staged lints several workspaces in one run.
  { languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } } },
  { ignores: ['.next/**', 'out/**', 'next-env.d.ts'] },
  // eslint-config-prettier turns `curly` off, so it goes in BEFORE the preset's rules turn it on.
  ...base({ noConsole: 'warn', layers: [eslintConfigPrettier] }),
  {
    ...pluginReact.configs.flat.recommended,
    languageOptions: { ...pluginReact.configs.flat.recommended.languageOptions, globals: { ...globals.browser } },
  },
  pluginReact.configs.flat['jsx-runtime'],
  {
    plugins: { '@next/next': pluginNext },
    rules: {
      ...pluginNext.configs.recommended.rules,
      ...pluginNext.configs['core-web-vitals'].rules,
      // App Router only: there is no pages/ directory to check links against.
      '@next/next/no-html-link-for-pages': 'off',
    },
  },
  ...react(),
  {
    settings: { react: { version: 'detect' } },
    rules: { 'react/prop-types': 'off' },
  },
  {
    files: ['*.config.*'],
    languageOptions: { globals: { ...globals.node } },
  },
];
