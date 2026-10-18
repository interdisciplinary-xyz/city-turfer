/**
 * `package` — the preset for a `packages/*` workspace: `base` + the R5 ban
 * (a package never imports the app: `@/…`, `apps/*`).
 *
 * Extra bans per package (e.g. the survey engine's "no framework, no
 * product package") go through `restrictedPaths` / `restrictedPatterns`; they
 * are appended after the R5 pattern in the one `no-restricted-imports` entry,
 * because a later `no-restricted-imports` would replace, not extend, it.
 * Dynamic `import()` / `require()` of the app are banned via
 * `no-restricted-syntax` — a package config that sets its own
 * `no-restricted-syntax` replaces that entry, so it must re-add `R5_SYNTAX`.
 */

import base from './base.js';

/**
 * @typedef {{ name: string, message?: string, importNames?: string[] }} RestrictedPath
 * @typedef {{ group?: string[], regex?: string, message?: string }} RestrictedPattern
 *
 * @typedef {object} PackageOptions
 * @property {RestrictedPath[]} [restrictedPaths] Exact specifiers to ban.
 * @property {RestrictedPattern[]} [restrictedPatterns] Extra gitignore-style
 *   groups to ban, after R5's.
 * @property {'warn' | 'error'} [noConsole] See `base`. Default `'error'`.
 */

/** R5 — `docs/plans/turborepo-monorepo-2026-09-27.md` §3. */
const R5_MESSAGE = 'Packages never import the app (plan R5).';
const R5_PATTERN = {
  group: ['@/*', 'apps/*', '**/apps/*'],
  message: R5_MESSAGE,
};

/**
 * R5 for the forms `no-restricted-imports` cannot see: `import('…')`,
 * `require('…')` and TS `import x = require('…')`. Matches the same
 * specifiers as `R5_PATTERN` (`@/…`, `apps/…`, `…/apps/…`). A string literal
 * that merely CONTAINS such code (a RuleTester fixture) is not matched — only
 * the AST node of a real import is.
 */
const R5_SPECIFIER = '/^@[/]|(^|[/])apps[/]/';
const R5_SYNTAX = [
  `ImportExpression[source.value=${R5_SPECIFIER}]`,
  `CallExpression[callee.name='require'][arguments.0.value=${R5_SPECIFIER}]`,
  `TSExternalModuleReference[expression.value=${R5_SPECIFIER}]`,
].map((selector) => ({ selector, message: R5_MESSAGE }));

/**
 * The `no-restricted-imports` entry of the preset: R5 + the extra bans. Use it
 * directly for a per-directory block (`{ files, rules: { 'no-restricted-imports':
 * restrictedImports({ … }) } }`) — a later `no-restricted-imports` replaces the
 * earlier one, so each block must carry R5 again, which this does.
 *
 * @param {Pick<PackageOptions, 'restrictedPaths' | 'restrictedPatterns'>} [options]
 * @returns {import('eslint').Linter.RuleEntry}
 */
export function restrictedImports({ restrictedPaths = [], restrictedPatterns = [] } = {}) {
  return [
    'error',
    {
      ...(restrictedPaths.length ? { paths: restrictedPaths } : {}),
      patterns: [R5_PATTERN, ...restrictedPatterns],
    },
  ];
}

/**
 * @param {PackageOptions} [options]
 * @returns {import('eslint').Linter.Config[]}
 */
export default function packagePreset({ restrictedPaths = [], restrictedPatterns = [], noConsole = 'error' } = {}) {
  return [
    ...base({ noConsole }),
    {
      rules: {
        'no-restricted-imports': restrictedImports({
          restrictedPaths,
          restrictedPatterns,
        }),
        'no-restricted-syntax': ['error', ...R5_SYNTAX],
      },
    },
  ];
}
