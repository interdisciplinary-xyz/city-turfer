/**
 * Smoke tests for the shared `local-rules` plugin: at least one valid + one
 * invalid case per rule a preset enables. `enforce-tailwind-arbitrary` ships
 * but is enabled nowhere, so it is not covered here. Consumer-owned rules
 * (merged in through `base({ localRules })`) are tested where they live.
 */

import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { afterAll, describe, it } from 'vitest';

import plugin, { withLocalRules } from '../plugin.js';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;
RuleTester.afterAll = afterAll;

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

const SRC = '/repo/src';

describe('local-rules plugin', () => {
  it('exposes every rule under `rules`', () => {
    const names = Object.keys(plugin.rules).sort();
    if (
      names.join(',') !== ['enforce-tailwind-arbitrary', 'enforce-types-in-constants', 'no-duplicate-imports'].join(',')
    ) {
      throw new Error(`unexpected rule set: ${names.join(', ')}`);
    }
  });

  it('merges consumer rules into the same namespace', () => {
    const own = { meta: {}, create: () => ({}) };
    const merged = withLocalRules({ 'my-rule': own });
    if (
      merged.rules['my-rule'] !== own ||
      merged.rules['no-duplicate-imports'] !== plugin.rules['no-duplicate-imports']
    ) {
      throw new Error('consumer rules were not merged next to the shared ones');
    }
  });

  it('refuses a consumer rule that shadows a shared one', () => {
    let threw = false;
    try {
      withLocalRules({ 'no-duplicate-imports': {} });
    } catch {
      threw = true;
    }
    if (!threw) {
      throw new Error('a shadowing consumer rule was accepted');
    }
  });
});

ruleTester.run('enforce-types-in-constants', plugin.rules['enforce-types-in-constants'], {
  valid: [
    {
      filename: `${SRC}/domains/ui/components/card/card.tsx`,
      code: 'export const Card = () => null;',
    },
    {
      // `.ts` (e.g. the `.constants.ts` sibling itself) is out of scope.
      filename: `${SRC}/domains/ui/components/card/card.constants.ts`,
      code: 'export type CardProps = { a: string };\nexport const MAX_CARDS = 3;',
    },
    {
      filename: `${SRC}/domains/ui/components/card/card.test.tsx`,
      code: 'type Fixture = { a: string };',
    },
  ],
  invalid: [
    {
      filename: `${SRC}/domains/ui/components/card/card.tsx`,
      code: 'export type CardProps = { a: string };',
      errors: [{ messageId: 'moveType' }],
    },
    {
      filename: `${SRC}/domains/ui/components/card/card.tsx`,
      code: 'const MAX_CARDS = 3;',
      errors: [{ messageId: 'moveConstant' }],
    },
  ],
});

ruleTester.run('no-duplicate-imports', plugin.rules['no-duplicate-imports'], {
  valid: [
    { code: "import { a, type B } from 'm';" },
    // Side-effect imports bind nothing and are ignored.
    { code: "import 'm';\nimport 'm';" },
  ],
  invalid: [
    {
      code: "import type { B } from 'm';\nimport { a } from 'm';\n",
      output: "import { a, type B } from 'm';\n",
      errors: [{ messageId: 'duplicate' }],
    },
    {
      // A default binding is reported but never auto-merged.
      code: "import x from 'm';\nimport { a } from 'm';\n",
      output: null,
      errors: [{ messageId: 'duplicate' }],
    },
  ],
});
