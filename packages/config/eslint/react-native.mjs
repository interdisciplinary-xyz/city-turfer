// React Native preset: base + React, hooks and react-native-a11y (the app's accessibility rules).
import pluginReact from 'eslint-plugin-react';
import pluginReactHooks from 'eslint-plugin-react-hooks';
import pluginRnA11y from 'eslint-plugin-react-native-a11y';

import base from './base.mjs';

export default [
  ...base,
  pluginReact.configs.flat.recommended,
  pluginReact.configs.flat['jsx-runtime'],
  {
    files: ['**/*.{ts,tsx,js,mjs,cjs}'],
    languageOptions: { globals: { __DEV__: 'readonly' } },
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
    files: ['**/__tests__/**', '**/test-support/**', '**/*.config.*', '**/*.cjs', '**/plugins/**', '**/tools/**'],
    rules: { '@typescript-eslint/no-require-imports': 'off', 'no-console': 'off' },
  },
];
