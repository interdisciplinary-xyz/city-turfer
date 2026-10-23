import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

type Rule = {
  name: string;
  from: { path?: string; pathNot?: string };
  to: { path?: string; dependencyTypes?: string[] };
};

const require = createRequire(import.meta.url);
const { forbidden } = require('../../.dependency-cruiser.cjs') as { forbidden: Rule[] };

const rule = (name: string) => {
  const r = forbidden.find((x) => x.name === name);
  expect(r, name).toBeDefined();
  return r!;
};

/** Does `rule` forbid an import from `from` that resolves to `to` (paths as depcruise reports them)? */
function fires(name: string, from: string, to: string): boolean {
  const r = rule(name);
  const fromOk = new RegExp(r.from.path ?? '').test(from) && !(r.from.pathNot && new RegExp(r.from.pathNot).test(from));
  return fromOk && new RegExp(r.to.path ?? '^$').test(to);
}

// A regex typo would make a rule match nothing and `arch` would stay green: pin each one.
describe('apps/admin dependency rules', () => {
  it('forbids other apps (depcruise reports them as ../<app>/…), not packages', () => {
    expect(fires('no-other-apps', 'src/x.ts', '../api/src/app.ts')).toBe(true);
    expect(fires('no-other-apps', 'src/x.ts', '../web/src/api/client.ts')).toBe(true);
    expect(fires('no-other-apps', 'src/x.ts', '../../packages/brand/src/index.ts')).toBe(false);
    expect(fires('no-other-apps', 'src/x.ts', '../../node_modules/next/index.js')).toBe(false);
  });

  it('forbids SQL clients, including Payload’s own drizzle', () => {
    for (const pkg of [
      'drizzle-orm/index.js',
      'pg/lib/index.js',
      '@neondatabase/serverless/index.mjs',
      '@payloadcms/drizzle/dist/index.js',
    ]) {
      expect(fires('no-database-drivers', 'src/x.ts', `../../node_modules/${pkg}`), pkg).toBe(true);
    }
  });

  it('lets only payload.config.ts and migrations wire the Postgres adapter', () => {
    const adapter = '../../node_modules/@payloadcms/db-postgres/dist/index.js';
    expect(fires('payload-db-adapter-only-in-config', 'src/brand/theme.ts', adapter)).toBe(true);
    expect(fires('payload-db-adapter-only-in-config', 'src/payload.config.ts', adapter)).toBe(false);
    expect(fires('payload-db-adapter-only-in-config', 'src/migrations/20261022_staff.ts', adapter)).toBe(false);
  });

  it('forbids React Native, the RN design system and h3-js', () => {
    expect(fires('no-react-native', 'src/x.ts', '../../node_modules/react-native/index.js')).toBe(true);
    expect(fires('no-react-native', 'src/x.ts', '../../packages/ui/src/index.ts')).toBe(true);
    expect(fires('no-react-native', 'src/x.ts', '../../node_modules/h3-js/dist/h3-js.js')).toBe(true);
  });

  it('refuses any package apps/admin does not declare (the hoisted install would allow it)', () => {
    expect(rule('no-undeclared-deps').to.dependencyTypes).toEqual(['npm-no-pkg', 'npm-unknown']);
  });
});
