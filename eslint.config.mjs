// ESLint flat config — modelled on empatalk's shared config (base + react presets),
// adapted for Expo/React Native (react-native-a11y instead of jsx-a11y, no Next.js).
import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import pluginReact from 'eslint-plugin-react';
import pluginReactHooks from 'eslint-plugin-react-hooks';
import pluginRnA11y from 'eslint-plugin-react-native-a11y';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import unusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: [
      '**/ios/**',
      '**/android/**',
      '**/.expo/**',
      '**/vendor/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/dist/**',
    ],
  },
  js.configs.recommended,
  eslintConfigPrettier, // before our rules on purpose: it disables `curly`, which we re-enable below
  ...tseslint.configs.recommended,
  pluginReact.configs.flat.recommended,
  pluginReact.configs.flat['jsx-runtime'],
  {
    files: ['**/*.{ts,tsx,js,mjs,cjs}'],
    languageOptions: { globals: { ...globals.node, __DEV__: 'readonly' } },
    settings: { react: { version: 'detect' } },
    plugins: {
      'react-hooks': pluginReactHooks,
      'react-native-a11y': pluginRnA11y,
      'simple-import-sort': simpleImportSort,
      'unused-imports': unusedImports,
    },
    rules: {
      ...pluginReactHooks.configs.recommended.rules,
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'unused-imports/no-unused-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      curly: ['error', 'multi-line'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'react/prop-types': 'off',
      'react/display-name': 'off',
      // Accessibility for React Native (empatalk uses jsx-a11y on the web)
      'react-native-a11y/has-valid-accessibility-role': 'error',
      'react-native-a11y/has-valid-accessibility-state': 'error',
      'react-native-a11y/has-accessibility-hint': 'off',
    },
  },
  {
    // Tests, config files and dev tools (CLI scripts print to stdout)
    files: ['**/__tests__/**', '**/src/test-support/**', '**/*.config.*', '**/*.cjs', '**/plugins/**', '**/tools/**'],
    rules: { '@typescript-eslint/no-require-imports': 'off', 'no-console': 'off' },
  },
];
