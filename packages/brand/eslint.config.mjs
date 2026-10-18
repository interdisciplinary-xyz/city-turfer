import packagePreset from '@interdisciplinary/eslint-config/package';

/** A package never imports an app (`@/…`, `apps/*`). @type {import("eslint").Linter.Config[]} */
export default [
  // One tsconfig root per workspace: lint-staged lints several workspaces in one run.
  { languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } } },
  ...packagePreset(),
];
