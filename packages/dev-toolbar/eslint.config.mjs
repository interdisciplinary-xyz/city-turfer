import packagePreset from '@interdisciplinary/eslint-config/package';
import react from '@interdisciplinary/eslint-config/react';

/** @type {import("eslint").Linter.Config[]} */
export default [
  // One tsconfig root per workspace: lint-staged lints several workspaces in one run.
  { languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } } },
  ...packagePreset(),
  // React coverage for the `.tsx` half. A package holding .tsx must not lint
  // weaker than the app it came from.
  ...react({ files: ['**/*.{ts,tsx}'] }),
  {
    // The Node half + the protocol are plain ESM run by `node` (server.js).
    files: ['src/node/**/*.js', 'src/protocol.js'],
    languageOptions: {
      sourceType: 'module',
      globals: {
        console: 'readonly',
        globalThis: 'readonly',
        process: 'readonly',
        URL: 'readonly',
        performance: 'readonly',
        Response: 'readonly',
        setTimeout: 'readonly',
      },
    },
  },
];
