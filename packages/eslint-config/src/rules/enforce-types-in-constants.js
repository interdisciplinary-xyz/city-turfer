/**
 * ESLint rule: enforce-types-in-constants
 *
 * Enforces the project convention that a component `.tsx` file contains
 * only the component + its render logic. Module-level **type/interface**
 * declarations and **screaming-snake-case constants** (e.g.
 * `LOADING_OVERRIDES`) belong in the colocated `<name>.constants.ts`
 * sibling instead.
 *
 * Reports (so they self-enforce going forward):
 *   - any top-level `type` / `interface` declaration in a `.tsx`
 *   - any top-level `const` declaration whose name is SCREAMING_SNAKE_CASE
 *
 * Skips test/story/spec `.tsx` files (their local types/fixtures are fine
 * to colocate). The `.constants.ts` sibling does NOT need to pre-exist —
 * the fix is to create it.
 */

import path from 'node:path';

const SCREAMING_SNAKE = /^[A-Z][A-Z0-9_]*$/;

const isColocatableFile = (filename) =>
  filename.endsWith('.tsx') &&
  !filename.endsWith('.test.tsx') &&
  !filename.endsWith('.spec.tsx') &&
  !filename.endsWith('.stories.tsx');

export default {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Enforce type definitions and module-level constants in .constants.ts files instead of .tsx files',
    },
    messages: {
      moveType: 'Type `{{name}}` should be defined in `{{constantsFile}}`, not this .tsx file.',
      moveConstant: 'Constant `{{name}}` should be defined in `{{constantsFile}}`, not this .tsx file.',
    },
    schema: [],
  },

  create(context) {
    const filename = context.getFilename();

    if (!isColocatableFile(filename)) {
      return {};
    }

    const baseName = path.basename(filename, '.tsx');
    const constantsFile = `${baseName}.constants.ts`;

    const reportType = (node, name) =>
      context.report({
        node,
        messageId: 'moveType',
        data: { name, constantsFile },
      });

    const reportConstant = (node, name) =>
      context.report({
        node,
        messageId: 'moveConstant',
        data: { name, constantsFile },
      });

    const handleDeclaration = (decl) => {
      if (!decl) {
        return;
      }
      if (decl.type === 'TSTypeAliasDeclaration' || decl.type === 'TSInterfaceDeclaration') {
        reportType(decl, decl.id.name);
        return;
      }
      // `const FOO = ...` / `const FOO = ..., BAR = ...`
      if (decl.type === 'VariableDeclaration' && decl.kind === 'const') {
        for (const d of decl.declarations) {
          if (d.id.type === 'Identifier' && SCREAMING_SNAKE.test(d.id.name)) {
            reportConstant(d, d.id.name);
          }
        }
      }
    };

    return {
      Program(program) {
        for (const node of program.body) {
          if (node.type === 'ExportNamedDeclaration') {
            handleDeclaration(node.declaration);
          } else {
            handleDeclaration(node);
          }
        }
      },
    };
  },
};
