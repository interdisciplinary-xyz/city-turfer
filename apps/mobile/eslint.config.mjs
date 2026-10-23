import base from '@interdisciplinary/eslint-config/base';
import eslintConfigPrettier from 'eslint-config-prettier';
import pluginReact from 'eslint-plugin-react';
import pluginReactHooks from 'eslint-plugin-react-hooks';
import pluginRnA11y from 'eslint-plugin-react-native-a11y';
import globals from 'globals';

/**
 * The shared floor comes from `@interdisciplinary/eslint-config/base`. React Native specifics live
 * here: React + hooks, and react-native-a11y instead of jsx-a11y (there is no DOM).
 *
 * @type {import("eslint").Linter.Config[]}
 */
export default [
  // One tsconfig root per workspace: lint-staged lints several workspaces in one run.
  { languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } } },
  { ignores: ['ios/**', 'android/**', '.expo/**', 'vendor/**', 'coverage/**', 'dist/**', 'e2e-results/**'] },
  // eslint-config-prettier turns `curly` off, so it goes in BEFORE the preset's rules turn it on.
  ...base({ noConsole: 'warn', layers: [eslintConfigPrettier] }),
  pluginReact.configs.flat.recommended,
  pluginReact.configs.flat['jsx-runtime'],
  {
    languageOptions: { globals: { ...globals.node, __DEV__: 'readonly' } },
    settings: { react: { version: 'detect' } },
    plugins: { 'react-hooks': pluginReactHooks, 'react-native-a11y': pluginRnA11y },
    rules: {
      ...pluginReactHooks.configs.recommended.rules,
      'react/prop-types': 'off',
      'react/display-name': 'off',
      'react-native-a11y/has-valid-accessibility-role': 'error',
      'react-native-a11y/has-valid-accessibility-state': 'error',
      'react-native-a11y/has-accessibility-hint': 'off',
    },
  },
  {
    // Keep this repo's convention: a leading underscore marks a deliberately unused binding.
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // Expo Router turns every file in src/app/ into a route, so a screen cannot have a colocated
    // `<screen>.constants.ts` (it would become a bogus route). Screen constants stay in the screen.
    files: ['src/app/**'],
    rules: { 'local-rules/enforce-types-in-constants': 'off' },
  },
  {
    // User-facing text comes from the message catalogue (mobile-i18n skill). Off until the copy
    // migration: switched to 'error' in step 2 of docs/decisions/mobile-i18n-2026-10-23.md.
    rules: { 'local-rules/no-raw-text': 'off' },
  },
  {
    // Not translated: dev-only screens and seeders, tests, the developer card (founder-only).
    files: [
      'src/dev/**',
      '**/__tests__/**',
      'src/test-support/**',
      'src/contexts/cloud-backup/ui/backup-developer-card.tsx',
    ],
    rules: { 'local-rules/no-raw-text': 'off' },
  },
  {
    // Tests, config files, config plugins and dev tools (CLI scripts print to stdout)
    files: ['**/__tests__/**', 'src/test-support/**', '*.config.*', '*.cjs', 'plugins/**', 'tools/**'],
    rules: { '@typescript-eslint/no-require-imports': 'off', 'no-console': 'off' },
  },
];
