/**
 * ESLint rule: no-deep-domain-import
 *
 * A domain's public surface is its barrel: `@/domains/<domain>`. Code
 * outside that domain must import from the barrel, never from a file
 * inside it:
 *
 *   ✗ import type { FactorCategory } from '@/domains/survey/factors/types';
 *   ✓ import type { FactorCategory } from '@/domains/survey';
 *
 * Reaching past the barrel couples callers to a domain's internal layout,
 * so every move inside a domain becomes a cross-tree refactor, and it
 * hides the real dependency graph the DAG audit reads.
 *
 * A domain's own files may reach each other by self-alias
 * (`@/domains/survey/factors` from inside `survey/`) — the alternative is
 * `'../../../../factors'`, which is worse to read and breaks whenever a file
 * moves. What they must never do is import their own barrel: that is a cycle.
 *
 *   ✗ import { hasUserDnaSurvey } from '@/domains/survey';  // in survey/
 *   ✓ import { hasUserDnaSurvey } from '@/domains/survey/constants';
 *
 * Covers alias (`@/domains/…`) and relative (`../../survey/…`) specifiers, and
 * module-mocking calls (`vi.mock('@/domains/…')`), so the rule can't be
 * sidestepped by walking up the tree or by mocking a path nothing imports.
 *
 * Ported from empatalk (apps/web/eslint-local-rules). Opt-in: enable it in an
 * app with a `src/domains/` tree (CityTurfer: apps/web).
 */

import path from 'node:path';

const DOMAINS_SEGMENT = `${path.sep}src${path.sep}domains${path.sep}`;

/**
 * Domains that have no barrel and are not product code. `e2e` is the
 * home for Playwright specs + shared test fixtures, not a domain.
 */
const EXEMPT_DOMAINS = new Set(['e2e']);

/**
 * Public entrypoints a domain may expose alongside its barrel. None in this repo yet; empatalk uses
 * `server` (a Node-safe surface) and `register-modals` (a side-effect import).
 */
const EXEMPT_ENTRYPOINTS = new Set([]);

/** `@/domains/survey/factors/types` → `{ domain: 'survey', subPath: ['factors','types'] }`. */
const domainFromAlias = (source) => {
  const match = /^@\/domains\/([^/]+)(?:\/(.*))?$/.exec(source);
  if (!match) {
    return null;
  }
  return { domain: match[1], subPath: match[2] ? match[2].split('/') : [] };
};

/** Absolute file path → the domain it lives in, or null. */
const domainFromFilename = (filename) => {
  const index = filename.indexOf(DOMAINS_SEGMENT);
  if (index === -1) {
    return null;
  }
  const rest = filename.slice(index + DOMAINS_SEGMENT.length);
  return rest.split(path.sep)[0] || null;
};

/** Resolve a relative specifier against the importing file, then re-read its domain. */
const domainFromRelative = (source, filename) => {
  if (!source.startsWith('.')) {
    return null;
  }
  const resolved = path.resolve(path.dirname(filename), source);
  const domain = domainFromFilename(resolved);
  if (!domain) {
    return null;
  }
  const index = resolved.indexOf(DOMAINS_SEGMENT);
  const rest = resolved.slice(index + DOMAINS_SEGMENT.length);
  return { domain, subPath: rest.split(path.sep).slice(1) };
};

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require cross-domain imports to go through the domain barrel (`@/domains/<domain>`)',
    },
    messages: {
      deepImport: "Import from '@/domains/{{domain}}' instead — '{{source}}' reaches past the domain barrel.",
      selfBarrel:
        "A file inside `{{domain}}` cannot import its own barrel ('{{source}}') — that is a cycle. Import the defining module directly.",
    },
    // Deliberately not `fixable`: the barrel may not export the symbol yet,
    // and adding it is a choice about the domain's public surface.
    schema: [],
  },

  create(context) {
    const filename = context.filename ?? context.getFilename();
    const ownDomain = domainFromFilename(filename);

    const check = (node, source) => {
      if (typeof source !== 'string') {
        return;
      }
      // A stylesheet is a side-effect asset, not part of the domain's code API: a page may load a
      // unit's CSS (CityTurfer's portal layout loads the app header's) without its React tree.
      if (source.endsWith('.css')) {
        return;
      }

      const alias = domainFromAlias(source);

      // A file importing its own domain's barrel is a cycle. Deeper
      // self-aliases (`@/domains/survey/factors` from inside `survey/`) are
      // fine — they beat `'../../../../factors'` on both readability and
      // resilience to file moves.
      if (alias && alias.domain === ownDomain) {
        if (alias.subPath.length === 0) {
          context.report({
            node,
            messageId: 'selfBarrel',
            data: { domain: ownDomain, source },
          });
        }
        return;
      }

      const target = alias ?? domainFromRelative(source, filename);
      if (!target) {
        return;
      }
      // `'../..'` from inside a domain is its own barrel too: the same cycle by a relative path.
      if (target.domain === ownDomain && target.subPath.filter(Boolean).length === 0) {
        context.report({ node, messageId: 'selfBarrel', data: { domain: ownDomain, source } });
        return;
      }
      if (target.subPath.filter(Boolean).length === 0) {
        return;
      }
      if (EXEMPT_DOMAINS.has(target.domain) || target.domain === ownDomain) {
        return;
      }
      if (target.subPath.length === 1 && EXEMPT_ENTRYPOINTS.has(target.subPath[0])) {
        return;
      }

      context.report({
        node,
        messageId: 'deepImport',
        data: { domain: target.domain, source },
      });
    };

    // `vi.mock('@/domains/survey/factors')` names a module path just as an
    // import does, and a mock aimed at an internal file silently stops
    // intercepting the moment that file moves.
    const isModuleMockCall = (node) =>
      node.callee.type === 'MemberExpression' &&
      ['vi', 'jest'].includes(node.callee.object.name) &&
      ['mock', 'doMock', 'unmock'].includes(node.callee.property.name);

    return {
      ImportDeclaration: (node) => check(node.source, node.source.value),
      ExportNamedDeclaration: (node) => node.source && check(node.source, node.source.value),
      ExportAllDeclaration: (node) => check(node.source, node.source.value),
      ImportExpression: (node) => node.source.type === 'Literal' && check(node.source, node.source.value),
      CallExpression: (node) => {
        const [arg] = node.arguments;
        if (arg?.type === 'Literal' && isModuleMockCall(node)) {
          check(arg, arg.value);
        }
      },
    };
  },
};
