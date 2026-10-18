// Next.js preset: base + React, hooks, jsx-a11y and Next's core-web-vitals rules.
import nextPlugin from '@next/eslint-plugin-next';
import pluginJsxA11y from 'eslint-plugin-jsx-a11y';
import pluginReact from 'eslint-plugin-react';
import pluginReactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

import base from './base.mjs';

export default [
  ...base,
  pluginReact.configs.flat.recommended,
  pluginReact.configs.flat['jsx-runtime'],
  pluginJsxA11y.flatConfigs.recommended,
  {
    files: ['**/*.{ts,tsx,js,mjs,cjs}'],
    languageOptions: { globals: { ...globals.browser } },
    settings: { react: { version: 'detect' } },
    plugins: { 'react-hooks': pluginReactHooks, '@next/next': nextPlugin },
    rules: {
      ...pluginReactHooks.configs.recommended.rules,
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      'react/prop-types': 'off',
      // App Router only: there is no pages/ directory to check links against.
      '@next/next/no-html-link-for-pages': 'off',
    },
  },
];
