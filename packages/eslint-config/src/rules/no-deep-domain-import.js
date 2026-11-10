/**
 * ESLint rule: no-deep-domain-import
 *
 * A domain's public surface is its barrel: `@/domains/<domain>`. Code
 * outside that domain must import from the barrel, never from a file
 * inside it:
 *
 *   ✗ import { SectionHead } from '@/domains/homepage/components/home-sections/section';
 *   ✓ import { SectionHead } from '@/domains/homepage';
 *
 * Reaching past the barrel couples callers to a domain's internal layout,
 * so every move inside a domain becomes a cross-tree refactor, and it
 * hides the real dependency graph between domains.
 *
 * A domain's own files may reach each other by self-alias
 * (`@/domains/homepage/components/icons` from inside `homepage/`) — the
 * alternative is `'../../../icons'`, which is worse to read and breaks
 * whenever a file moves. What they must never do is import their own barrel,
 * in any spelling (`@/domains/homepage`, `@/domains/homepage/`,
 * `@/domains/homepage/index`, `'../..'`, `'./index'`): that is a cycle.
 *
 * Options (all optional):
 *
 *   exemptDomains      folders under src/domains that are not domains and have no
 *                      barrel (default ['e2e']: Playwright specs and fixtures)
 *   exemptEntrypoints  extra public entries a domain may expose beside its barrel,
 *                      as `@/domains/<domain>/<entry>` (default []; CityTurfer uses
 *                      `logic`, a React-free surface; empatalk uses `server` and
 *                      `register-modals`)
 *
 * Covers alias (`@/domains/…`) and relative (`../../homepage/…`) specifiers, and
 * module-mocking calls (`vi.mock('@/domains/…')`), so the rule can't be
 * sidestepped by walking up the tree or by mocking a path nothing imports.
 * Stylesheets (`.css`) are assets, not code API, and are never reported.
 *
 * Ported from empatalk (apps/web/eslint-local-rules) and made configurable so both
 * apps can share this copy. Opt-in: enable it in an app with a `src/domains/` tree.
 */

import path from 'node:path';

const DOMAINS_SEGMENT = `${path.sep}src${path.sep}domains${path.sep}`;
const INDEX_FILE = /^index(\.[cm]?[jt]sx?)?$/;

/** Drops empty segments and a trailing `index` file: every spelling of the barrel becomes `[]`. */
const normalise = (segments) => {
  const parts = segments.filter((part) => part && part !== '.');
  return parts.length && INDEX_FILE.test(parts.at(-1)) ? parts.slice(0, -1) : parts;
};

/** `@/domains/homepage/components/icons` → `{ domain: 'homepage', subPath: ['components','icons'] }`. */
const domainFromAlias = (source) => {
  const match = /^@\/domains\/([^/]+)(?:\/(.*))?$/.exec(source);
  if (!match) {
    return null;
  }
  return { domain: match[1], subPath: normalise(match[2] ? match[2].split('/') : []) };
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
  return { domain, subPath: normalise(rest.split(path.sep).slice(1)) };
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
    schema: [
      {
        type: 'object',
        properties: {
          exemptDomains: { type: 'array', items: { type: 'string' }, uniqueItems: true },
          exemptEntrypoints: { type: 'array', items: { type: 'string' }, uniqueItems: true },
        },
        additionalProperties: false,
      },
    ],
  },

  create(context) {
    const options = context.options[0] ?? {};
    const exemptDomains = new Set(options.exemptDomains ?? ['e2e']);
    const exemptEntrypoints = new Set(options.exemptEntrypoints ?? []);
    const filename = context.filename ?? context.getFilename();
    const ownDomain = domainFromFilename(filename);

    const check = (node, source) => {
      if (typeof source !== 'string' || source.endsWith('.css')) {
        return;
      }
      const target = domainFromAlias(source) ?? domainFromRelative(source, filename);
      if (!target || exemptDomains.has(target.domain)) {
        return;
      }
      if (target.domain === ownDomain) {
        // Deeper self-imports are fine; the barrel itself, in any spelling, is a cycle.
        if (target.subPath.length === 0) {
          context.report({ node, messageId: 'selfBarrel', data: { domain: ownDomain, source } });
        }
        return;
      }
      if (target.subPath.length === 0) {
        return;
      }
      if (target.subPath.length === 1 && exemptEntrypoints.has(target.subPath[0])) {
        return;
      }
      context.report({ node, messageId: 'deepImport', data: { domain: target.domain, source } });
    };

    // `vi.mock('@/domains/homepage/components/icons')` names a module path just as an
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
