/**
 * The `local-rules` ESLint plugin: the shared, app-agnostic hand-written rules
 * (`enforce-types-in-constants`, `no-duplicate-imports`,
 * `enforce-tailwind-arbitrary`, `no-raw-text`, `no-deep-domain-import`).
 *
 * Register it under the `local-rules` key — every rule id (config +
 * `eslint-disable` comments) is `local-rules/<name>`:
 *
 *   plugins: { 'local-rules': localRules }
 *
 * The `base` preset registers it for you. A consumer with rules of its own
 * (an app's layout-specific rules) passes them as `base({ localRules })`;
 * they are merged into the same `local-rules` namespace, so their ids stay
 * `local-rules/<name>`. `enforce-tailwind-arbitrary`, `no-raw-text` and
 * `no-deep-domain-import` ship but no preset enables them: a consumer opts in
 * (CityTurfer's apps/web enables `no-deep-domain-import` with its `logic` entry).
 */

import rules from './rules/index.js';

/** @type {import('eslint').ESLint.Plugin} */
const plugin = {
  meta: { name: '@interdisciplinary/eslint-config/plugin' },
  rules,
};

/**
 * `plugin` plus a consumer's own rules, under one `local-rules` namespace
 * (ESLint refuses to register two different plugin objects under one key).
 *
 * @param {Record<string, import('eslint').Rule.RuleModule>} extraRules
 * @returns {import('eslint').ESLint.Plugin}
 */
export function withLocalRules(extraRules) {
  const clash = Object.keys(extraRules).filter((name) => name in rules);
  if (clash.length) {
    throw new Error(`local-rules: a consumer rule shadows a shared rule: ${clash.join(', ')}`);
  }
  return {
    meta: { name: '@interdisciplinary/eslint-config/plugin+local' },
    rules: { ...rules, ...extraRules },
  };
}

export { rules };
export default plugin;
