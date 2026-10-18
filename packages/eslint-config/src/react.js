/**
 * `react` — the React lint coverage: react-hooks recommended + jsx-a11y
 * recommended. Add it next to `base` / `package` in any workspace that holds
 * `.tsx` (the `monorepo-migration` scaffold rule: a package must not lint
 * React weaker than the app it came from).
 *
 * Framework-specific overrides (e.g. the app's `next/link` / `next/image`
 * jsx-a11y settings) stay in the consumer's config, after this preset.
 */

import pluginJsxA11y from 'eslint-plugin-jsx-a11y';
import pluginReactHooks from 'eslint-plugin-react-hooks';

/**
 * @typedef {object} ReactOptions
 * @property {string[]} [files] Limit the preset to these globs (packages use
 *   `['**\/*.{ts,tsx}']` so their plain-Node `.js` stays out). Default: every
 *   linted file, as in the app.
 */

/**
 * @param {ReactOptions} [options]
 * @returns {import('eslint').Linter.Config[]}
 */
export default function react({ files } = {}) {
  return [
    {
      ...(files ? { files } : {}),
      plugins: {
        // ICP commitment to neurodivergent users — `jsx-a11y` lints
        // accessibility patterns at compile time so regressions don't ship
        // silently (issue #205).
        'jsx-a11y': pluginJsxA11y,
        'react-hooks': pluginReactHooks,
      },
      rules: {
        ...pluginReactHooks.configs.recommended.rules,
        ...pluginJsxA11y.configs.recommended.rules,
      },
    },
  ];
}
