/**
 * Smoke tests for the shared `local-rules` plugin: at least one valid + one
 * invalid case per rule a preset enables, plus the opt-in `no-raw-text`.
 * `enforce-tailwind-arbitrary` ships but is enabled nowhere, so it is not
 * covered here. Consumer-owned rules
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
      names.join(',') !==
      [
        'enforce-tailwind-arbitrary',
        'enforce-types-in-constants',
        'no-deep-domain-import',
        'no-duplicate-imports',
        'no-raw-text',
      ].join(',')
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

const raw = [{ messageId: 'rawText' }];

ruleTester.run('no-raw-text', plugin.rules['no-raw-text'], {
  valid: [
    // Translated text, and text without a letter: separators, numbers, symbols, whitespace.
    { code: "const a = <Text>{t('start')}</Text>;" },
    { code: 'const a = <Text> · </Text>;' },
    { code: 'const a = <Text>{distance} / {pace}</Text>;' },
    { code: 'const a = <Text>12 — 3</Text>;' },
    { code: 'const a = (\n  <View>\n    <Text>{label}</Text>\n  </View>\n);' },
    { code: "const a = <Text>{'·'}</Text>;" },
    { code: "const a = <View>{mode === 'paused' && <Badge />}</View>;" },
    // Props that are not user-facing, even with words in them.
    { code: 'const a = <View testID="start-button" style={s} />;' },
    { code: 'const a = <Icon name="arrow-left" accessibilityRole="button" />;' },
    { code: "const a = <Button title={t('start')} accessibilityLabel={t('startHint')} />;" },
    { code: 'const a = <Button label={`${count}`} />;' },
    { code: "const a = <Button title={paused ? t('resume') : t('pause')} />;" },
    // A string used for logic inside a child expression is not rendered text.
    { code: "const a = <Text>{type === 'walk' ? t('walk') : t('other')}</Text>;" },
    // Alert with translated text; other `.alert` calls are not React Native's Alert.
    { code: "Alert.alert(t('title'), t('body'), [{ text: t('ok') }]);" },
    { code: "window.alert('Hello');" },
    { code: "logger.alert('Disk full');" },
    // Option: a narrower prop list.
    { code: 'const a = <Screen title="Turf" />;', options: [{ props: ['label'] }] },
  ],
  invalid: [
    { code: 'const a = <Text>Start</Text>;', errors: raw },
    { code: 'const a = <Text>Zacznij spacer</Text>;', errors: raw },
    { code: 'const a = <Text>{distance} km</Text>;', errors: raw },
    { code: "const a = <Text>{'Start'}</Text>;", errors: raw },
    { code: "const a = <View>{gpsLost && 'GPS lost'}</View>;", errors: raw },
    { code: 'const a = <Text>{`Hi ${name}`}</Text>;', errors: raw },
    { code: 'const a = <>Hello</>;', errors: raw },
    { code: 'const a = <Button title="Start" />;', errors: raw },
    { code: "const a = <Button title={'Start'} />;", errors: raw },
    { code: 'const a = <Button accessibilityLabel={`Start ${type}`} />;', errors: raw },
    { code: "const a = <Button label={paused ? 'Resume' : t('pause')} />;", errors: raw },
    { code: "const a = <Input placeholder={value || 'Search cities'} />;", errors: raw },
    {
      code: 'const a = <Tabs.Screen options={{}} headerTitle="Turf" tabBarLabel="Map" accessibilityHint="Opens" />;',
      errors: [raw[0], raw[0], raw[0]],
    },
    { code: 'const a = <Screen title="Turf" label=\'x\' />;', options: [{ props: ['title'] }], errors: raw },
    { code: "Alert.alert('Delete activity?', `It is gone for good`);", errors: [raw[0], raw[0]] },
    {
      code: "Alert.alert(t('title'), undefined, [{ text: 'Cancel', style: 'cancel' }, { text: t('ok') }]);",
      errors: raw,
    },
  ],
});

ruleTester.run('no-deep-domain-import', plugin.rules['no-deep-domain-import'], {
  valid: [
    { filename: `${SRC}/domains/layout/components/x/x.tsx`, code: "import { a } from '@/domains/homepage';" },
    { filename: `${SRC}/app/page.tsx`, code: "import { a } from '@/domains/homepage';" },
    {
      // A domain's own deep self-alias is fine.
      filename: `${SRC}/domains/homepage/components/x/x.tsx`,
      code: "import { a } from '@/domains/homepage/components/y/y.constants';",
    },
    { filename: `${SRC}/lib/x.ts`, code: "import { a } from '@/lib/api/client';" },
    // An entrypoint the consumer exempts (CityTurfer: `logic`, React-free).
    {
      filename: `${SRC}/domains/layout/components/x/x.tsx`,
      code: "import { a } from '@/domains/homepage/logic';",
      options: [{ exemptEntrypoints: ['logic'] }],
    },
    // A folder listed in exemptDomains is not a domain.
    {
      filename: `${SRC}/app/page.tsx`,
      code: "import { a } from '@/domains/fixtures/x';",
      options: [{ exemptDomains: ['fixtures'] }],
    },
    // Stylesheets are assets, not code API.
    { filename: `${SRC}/app/layout.tsx`, code: "import '@/domains/layout/components/app-header/app-header.css';" },
  ],
  invalid: [
    {
      filename: `${SRC}/domains/layout/components/x/x.tsx`,
      code: "import { a } from '@/domains/homepage/components/y';",
      errors: [{ messageId: 'deepImport' }],
    },
    {
      filename: `${SRC}/app/page.tsx`,
      code: "export { a } from '../domains/homepage/components/y';",
      errors: [{ messageId: 'deepImport' }],
    },
    {
      filename: `${SRC}/domains/homepage/components/x/x.tsx`,
      code: "import { a } from '@/domains/homepage';",
      errors: [{ messageId: 'selfBarrel' }],
    },
    {
      filename: `${SRC}/domains/layout/components/x/x.tsx`,
      code: "import { a } from '../../../homepage/components/y';",
      errors: [{ messageId: 'deepImport' }],
    },
    {
      filename: `${SRC}/domains/homepage/components/x/x.tsx`,
      code: "import { a } from '../../';",
      errors: [{ messageId: 'selfBarrel' }],
    },
    // Every spelling of a domain's own barrel is the same cycle.
    ...["'@/domains/homepage/'", "'@/domains/homepage/index'", "'../../index'", "'../../index.ts'"].map((spec) => ({
      filename: `${SRC}/domains/homepage/components/x/x.tsx`,
      code: `import { a } from ${spec};`,
      errors: [{ messageId: 'selfBarrel' }],
    })),
    {
      filename: `${SRC}/domains/homepage/index.ts`,
      code: "export * from './index';",
      errors: [{ messageId: 'selfBarrel' }],
    },
    // Without the option, `logic` is just a deep path.
    {
      filename: `${SRC}/domains/layout/components/x/x.tsx`,
      code: "import { a } from '@/domains/homepage/logic';",
      errors: [{ messageId: 'deepImport' }],
    },
    {
      filename: `${SRC}/domains/layout/components/x/x.test.ts`,
      code: "vi.mock('@/domains/homepage/components/y');",
      errors: [{ messageId: 'deepImport' }],
    },
  ],
});
