// Negative control for apps/web/.dependency-cruiser.cjs: runs depcruise with the real config over a
// tiny fixture tree that breaks each boundary rule once, so a typo in a rule's regex (0 violations
// forever) fails here instead of passing silently.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const web = path.resolve(import.meta.dirname, '../..');
const repo = path.resolve(web, '../..');
const config = path.join(web, '.dependency-cruiser.cjs');
const depcruise = path.resolve(
  path.dirname(fileURLToPath(import.meta.resolve('dependency-cruiser'))),
  '../../bin/dependency-cruiser.mjs'
);

/** Fixture files: path → source. Comments name the rule each import must trip (or must not). */
const FILES = {
  'src/app/[locale]/page.tsx': "import './account/page';\nexport default 1;\n", // marketing-not-portal
  'src/app/[locale]/fetcher.ts': "import '../../lib/api/client';\n", // marketing-not-api-client
  'src/app/[locale]/query.tsx': "import '@tanstack/react-query';\n", // portal-libraries-only-in-portal
  'src/app/[locale]/map.tsx': "import '@cityturfer/core/h3';\n", // core-h3-only-in-portal
  'src/app/[locale]/typo.ts': "import './no-such-file';\n", // not-to-unresolvable
  'src/app/[locale]/branding.ts': "import '@cityturfer/brand';\n", // resolves: no finding
  'src/app/[locale]/stats.ts': "import '@cityturfer/core/shared-kernel';\n", // marketing-not-core
  'src/app/[locale]/account/turf.ts': "import '@cityturfer/core/territory';\n", // portal-core-shared-kernel-only
  // The portal may use its libraries and h3 (no finding), but not GSAP (portal-no-gsap).
  'src/app/[locale]/account/page.tsx':
    "import '@tanstack/react-query';\nimport '@cityturfer/core/h3';\nimport '@cityturfer/core/shared-kernel';\nimport 'gsap';\nexport default 1;\n",
  'src/lib/api/client.ts': "import '../../app/[locale]/page';\n", // lib-is-infrastructure
  // Domains: an edge DOMAIN_EDGES does not allow, the base leaf importing a feature, the marketing
  // side importing a portal domain, and an undeclared domain folder.
  'src/domains/homepage/hero.ts': "import '../layout/header';\n", // domain-homepage
  'src/domains/layout/header.ts': "import '../homepage/sections';\nimport '../ui/icon';\n", // allowed: no finding
  'src/domains/homepage/sections.ts': 'export default 1;\n',
  'src/domains/ui/icon.ts': "import '../waitlist/form';\n", // domain-ui
  'src/domains/waitlist/form.ts': "import '../account/panel';\n", // domain-waitlist + marketing-not-portal
  'src/domains/account/panel.ts': 'export default 1;\n',
  'src/domains/stray/thing.ts': "import '../ui/icon';\n", // domain-declared
  // A portal route reaching the marketing chrome (layout → homepage → GSAP) and a portal domain
  // importing GSAP itself: both portal-no-gsap. A marketing route importing a portal domain.
  'src/app/[locale]/account/footer.tsx': "import '../../../domains/layout/header';\n", // portal-no-gsap
  'src/domains/activities/motion.ts': "import 'gsap';\n", // portal-no-gsap
  'src/app/[locale]/panel.tsx': "import '../../domains/account/panel';\n", // marketing-not-portal
  // The entry files outside src, cruised like `arch` does, and a dev tool server.mjs loads.
  'server.mjs': "import './tools/dev-route.mjs';\nimport './src/app/[locale]/account/page';\n", // marketing-not-portal
  'tools/dev-route.mjs': "import '../src/lib/api/client';\n", // marketing-not-api-client
  'next.config.ts': "import './src/lib/api/client';\nexport default {};\n", // marketing-not-api-client
};

/** The roots `arch` cruises (apps/web/package.json). */
const ROOTS = ['src', 'server.mjs', 'next.config.ts'];

/** Workspace and hoisted packages the fixture imports, linked into its own node_modules. */
const LINKS = {
  '@cityturfer/core': path.join(repo, 'packages/core'),
  '@cityturfer/brand': path.join(repo, 'packages/brand'),
  '@tanstack/react-query': path.join(repo, 'node_modules/@tanstack/react-query'),
  gsap: path.join(repo, 'node_modules/gsap'),
};

let dir;
let violations;

before(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'ct-web-arch-'));
  writeFileSync(
    path.join(dir, 'tsconfig.json'),
    JSON.stringify({ compilerOptions: { jsx: 'preserve', module: 'esnext', moduleResolution: 'bundler' } })
  );
  for (const [file, source] of Object.entries(FILES)) {
    mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    writeFileSync(path.join(dir, file), source);
  }
  for (const [name, target] of Object.entries(LINKS)) {
    const link = path.join(dir, 'node_modules', name);
    mkdirSync(path.dirname(link), { recursive: true });
    symlinkSync(target, link, 'dir');
  }
  const run = spawnSync(process.execPath, [depcruise, ...ROOTS, '--config', config, '--output-type', 'json'], {
    cwd: dir,
    encoding: 'utf8',
  });
  assert.ok(run.stdout, `depcruise printed nothing: ${run.stderr}`);
  violations = JSON.parse(run.stdout).summary.violations.map((v) => `${v.rule.name} ${v.from} -> ${v.to}`);
});

after(() => rmSync(dir, { recursive: true, force: true }));

/** Asserts exactly one violation of `rule` from `from`. */
function expectViolation(rule, from) {
  const hits = violations.filter((v) => v.startsWith(`${rule} ${from} -> `));
  assert.equal(hits.length, 1, `expected ${rule} from ${from}; got:\n${violations.join('\n')}`);
}

test('a landing page importing the portal fails marketing-not-portal', () => {
  expectViolation('marketing-not-portal', 'src/app/[locale]/page.tsx');
});

test('a landing module importing the API client fails marketing-not-api-client', () => {
  expectViolation('marketing-not-api-client', 'src/app/[locale]/fetcher.ts');
});

test('a landing module importing TanStack Query fails portal-libraries-only-in-portal', () => {
  expectViolation('portal-libraries-only-in-portal', 'src/app/[locale]/query.tsx');
});

test('a landing module importing @cityturfer/core/h3 fails core-h3-only-in-portal', () => {
  expectViolation('core-h3-only-in-portal', 'src/app/[locale]/map.tsx');
});

test('a landing module importing @cityturfer/core fails marketing-not-core', () => {
  expectViolation('marketing-not-core', 'src/app/[locale]/stats.ts');
});

test('the portal importing a core context (not the shared kernel) fails portal-core-shared-kernel-only', () => {
  expectViolation('portal-core-shared-kernel-only', 'src/app/[locale]/account/turf.ts');
});

test('an unresolvable import fails not-to-unresolvable', () => {
  expectViolation('not-to-unresolvable', 'src/app/[locale]/typo.ts');
});

test('GSAP on a portal page fails portal-no-gsap', () => {
  expectViolation('portal-no-gsap', 'src/app/[locale]/account/page.tsx');
});

test('the API client importing a page fails lib-is-infrastructure', () => {
  expectViolation('lib-is-infrastructure', 'src/lib/api/client.ts');
});

test('a domain importing one DOMAIN_EDGES does not allow fails its domain rule', () => {
  expectViolation('domain-homepage', 'src/domains/homepage/hero.ts');
  expectViolation('domain-ui', 'src/domains/ui/icon.ts');
  expectViolation('domain-waitlist', 'src/domains/waitlist/form.ts');
});

test('a marketing domain importing a portal domain fails marketing-not-portal', () => {
  expectViolation('marketing-not-portal', 'src/domains/waitlist/form.ts');
});

test('portal code importing the marketing chrome or GSAP fails portal-no-gsap', () => {
  expectViolation('portal-no-gsap', 'src/app/[locale]/account/footer.tsx');
  expectViolation('portal-no-gsap', 'src/domains/activities/motion.ts');
});

test('a marketing route importing a portal domain fails marketing-not-portal', () => {
  expectViolation('marketing-not-portal', 'src/app/[locale]/panel.tsx');
});

test('a folder in src/domains missing from DOMAIN_EDGES fails domain-declared', () => {
  expectViolation('domain-declared', 'src/domains/stray/thing.ts');
});

test('server.mjs importing the portal fails marketing-not-portal', () => {
  expectViolation('marketing-not-portal', 'server.mjs');
});

test('a dev tool loaded by server.mjs importing the API client fails marketing-not-api-client', () => {
  expectViolation('marketing-not-api-client', 'tools/dev-route.mjs');
});

test('next.config.ts importing the API client fails marketing-not-api-client', () => {
  expectViolation('marketing-not-api-client', 'next.config.ts');
});

test('allowed imports raise nothing: workspace packages resolve, the portal may use its libraries', () => {
  const from = (v) => v.split(' ')[1];
  const allowed = violations.filter(
    (v) =>
      from(v) === 'src/app/[locale]/branding.ts' ||
      from(v) === 'src/domains/layout/header.ts' ||
      (from(v) === 'src/app/[locale]/account/page.tsx' && !v.startsWith('portal-no-gsap '))
  );
  assert.deepEqual(allowed, []);
  assert.equal(violations.length, 20, violations.join('\n'));
});
