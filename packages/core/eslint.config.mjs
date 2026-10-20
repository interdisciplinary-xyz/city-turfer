import packagePreset from '@interdisciplinary/eslint-config/package';

/**
 * A package never imports an app (`@/…`, `apps/*`). On top of that, @cityturfer/core runs on the
 * phone and on the server: no React, Expo, React Native, maps, HealthKit, SQLite drivers or UI
 * packages. h3-js is allowed only in src/h3 (dependency-cruiser enforces that and the DDD layers).
 *
 * @type {import("eslint").Linter.Config[]}
 */
export default [
  // One tsconfig root per workspace: lint-staged lints several workspaces in one run.
  { languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } } },
  ...packagePreset({
    restrictedPatterns: [
      {
        group: [
          'react',
          'react-native',
          'react-native-*',
          'expo',
          'expo-*',
          '@expo/*',
          '@maplibre/*',
          '@kingstinct/*',
          'better-sqlite3',
          '@cityturfer/ui',
          '@cityturfer/brand',
        ],
        message:
          '@cityturfer/core is platform-free: frameworks, native modules and UI stay in the apps (ddd-architecture skill).',
      },
    ],
  }),
  {
    // Tests read fixture files with node:fs and require() test doubles like the app's tests do.
    files: ['**/__tests__/**', '**/test-support/**'],
    rules: { '@typescript-eslint/no-require-imports': 'off', 'no-console': 'off' },
  },
];
