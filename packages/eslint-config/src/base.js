/**
 * `base` — the lint floor for TypeScript source, shared by `apps/web` and
 * every `packages/*`.
 *
 *   typescript-eslint recommended · simple-import-sort · unused-imports ·
 *   `curly: all` · `no-console` (warn/error allowed) ·
 *   `local-rules/enforce-types-in-constants` · `local-rules/no-duplicate-imports`
 *
 * Settings and severities mirror what `apps/web/eslint.config.mjs` enforced
 * before the extraction, so the app's resolved config is unchanged.
 */

import js from '@eslint/js';
import pluginSimpleImportSort from 'eslint-plugin-simple-import-sort';
import pluginUnusedImports from 'eslint-plugin-unused-imports';
import tseslint from 'typescript-eslint';

import localRules, { withLocalRules } from './plugin.js';

/**
 * @typedef {object} BaseOptions
 * @property {'warn' | 'error'} [noConsole] Severity of `no-console`. The app
 *   warns; packages error (their pre-extraction setting). Default `'error'`.
 * @property {import('eslint').Linter.Config[]} [layers] Configs spliced in
 *   AFTER the recommended presets and BEFORE this preset's own rules — e.g.
 *   `eslint-config-prettier`, which turns `curly` off and so must not come
 *   after the block that turns it back on.
 * @property {Record<string, import('eslint').Rule.RuleModule>} [localRules]
 *   The consumer's own rules, registered under the same `local-rules` plugin
 *   key as the shared ones (so their ids are `local-rules/<name>`). Only
 *   registered — the consumer enables them in its own config.
 */

/**
 * @param {BaseOptions} [options]
 * @returns {import('eslint').Linter.Config[]}
 */
export default function base({ noConsole = 'error', layers = [], localRules: extraRules = {} } = {}) {
  const plugin = Object.keys(extraRules).length ? withLocalRules(extraRules) : localRules;

  return [
    js.configs.recommended,
    ...layers,
    ...tseslint.configs.recommended,
    {
      plugins: {
        'local-rules': plugin,
        'simple-import-sort': pluginSimpleImportSort,
        'unused-imports': pluginUnusedImports,
      },
      rules: {
        // Import sorting
        'simple-import-sort/imports': 'error',
        'simple-import-sort/exports': 'error',

        // Unused imports
        'unused-imports/no-unused-imports': 'error',

        // Project convention: component .tsx files hold only the component;
        // types + SCREAMING_SNAKE constants live in the colocated
        // `<name>.constants.ts`.
        'local-rules/enforce-types-in-constants': 'error',

        // One module, one import statement — including the `import type`
        // half, which folds in as an inline `type` specifier.
        'local-rules/no-duplicate-imports': 'error',

        // Code style
        curly: ['error', 'all'],
        'no-console': [noConsole, { allow: ['warn', 'error'] }],
      },
    },
  ];
}
