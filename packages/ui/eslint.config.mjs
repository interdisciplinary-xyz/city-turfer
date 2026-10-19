import packagePreset from '@interdisciplinary/eslint-config/package';
import pluginReact from 'eslint-plugin-react';
import pluginReactHooks from 'eslint-plugin-react-hooks';
import pluginRnA11y from 'eslint-plugin-react-native-a11y';

/**
 * A package never imports an app (`@/…`, `apps/*`). On top of that, @cityturfer/ui stays pure
 * React Native: no Expo modules, maps, HealthKit or other native libraries, so the app's runtime
 * fingerprint never depends on it and Storybook can render it with react-native-web.
 * React Native accessibility rules as in apps/mobile (there is no DOM, so no jsx-a11y).
 *
 * @type {import("eslint").Linter.Config[]}
 */
export default [
  // One tsconfig root per workspace: lint-staged lints several workspaces in one run.
  { languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } } },
  ...packagePreset({
    restrictedPatterns: [
      {
        group: ['expo', 'expo-*', '@expo/*', '@maplibre/*', '@kingstinct/*', 'react-native-*', 'h3-js'],
        message: '@cityturfer/ui is pure React Native: native modules stay in apps/mobile (design-system skill).',
      },
    ],
  }),
  pluginReact.configs.flat.recommended,
  pluginReact.configs.flat['jsx-runtime'],
  {
    settings: { react: { version: 'detect' } },
    plugins: { 'react-hooks': pluginReactHooks, 'react-native-a11y': pluginRnA11y },
    rules: {
      ...pluginReactHooks.configs.recommended.rules,
      'react/prop-types': 'off',
      'react-native-a11y/has-valid-accessibility-role': 'error',
      'react-native-a11y/has-valid-accessibility-state': 'error',
    },
  },
];
