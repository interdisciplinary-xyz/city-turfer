/**
 * ESLint rule: no-duplicate-imports
 *
 * One module, one import statement — including the `import type` half:
 *
 *   ✗ import type { Plan } from './pricing';
 *     import { PricingGrid } from './pricing';
 *   ✓ import { type Plan, PricingGrid } from './pricing';
 *
 * Barrel imports make duplication easy to emit: once every symbol resolves to
 * one barrel (`./pricing`), a mechanical rewrite happily produces one statement per
 * symbol, and splitting them hides how much of a domain a file pulls in.
 *
 * Merging a type-only statement into the value one is emit-safe: the value
 * import already exists, and the folded specifiers keep an inline `type`
 * modifier, so TypeScript still erases them (`isolatedModules` is on).
 *
 * Statements carrying a default or namespace binding (`import x`,
 * `import * as x`) are reported but never auto-merged, since folding those
 * changes the binding form. Side-effect imports
 * (`import './register-modals'`) bind nothing and are ignored.
 */

const isMergeable = (node) => node.specifiers.length > 0 && node.specifiers.every((s) => s.type === 'ImportSpecifier');

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow importing the same module twice in one file',
    },
    messages: {
      duplicate: "'{{source}}' is imported more than once — merge the specifiers into a single import.",
    },
    fixable: 'code',
    schema: [],
  },

  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode();

    return {
      'Program:exit'(program) {
        const groups = new Map();

        for (const node of program.body) {
          // Side-effect imports name no bindings; a repeat is dead code, not a
          // merge candidate.
          if (node.type !== 'ImportDeclaration' || node.specifiers.length === 0) {
            continue;
          }
          const key = node.source.value;
          if (!groups.has(key)) {
            groups.set(key, []);
          }
          groups.get(key).push(node);
        }

        for (const [source, nodes] of groups) {
          if (nodes.length < 2) {
            continue;
          }

          // Merge into the value statement when there is one: folding value
          // specifiers into an `import type { … }` would be a syntax error.
          const target = nodes.find((n) => n.importKind !== 'type') ?? nodes[0];
          const canFix = nodes.every(isMergeable);

          for (const node of nodes) {
            if (node === target) {
              continue;
            }

            context.report({
              node,
              messageId: 'duplicate',
              data: { source },
              fix: canFix
                ? (fixer) => {
                    const needsTypeModifier = node.importKind === 'type' && target.importKind !== 'type';

                    const merged = node.specifiers
                      .map((s) => {
                        const text = sourceCode.getText(s);
                        // An already-inline `type X` keeps its modifier.
                        return needsTypeModifier && s.importKind !== 'type' ? `type ${text}` : text;
                      })
                      .join(', ');

                    const lastSpecifier = target.specifiers[target.specifiers.length - 1];

                    return [
                      fixer.insertTextAfter(lastSpecifier, `, ${merged}`),
                      // Consume the trailing newline so no blank line is left
                      // behind; prettier re-tidies the merged statement.
                      fixer.removeRange([node.range[0], node.range[1] + 1]),
                    ];
                  }
                : undefined,
            });
          }
        }
      },
    };
  },
};
