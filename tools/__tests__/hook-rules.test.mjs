import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { newestScope } from '../harness/git-context.mjs';
import {
  bashFindings,
  brandHexFindings,
  contentAfter,
  dependencyFindings,
  expectedBase,
  importSpecifiers,
  protectedFileFindings,
  remindersFor,
} from '../harness/hook-rules.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const rules = (findings) => findings.map((f) => f.rule);
const CTX = { branch: 'feat/territory', activeScope: 'scope/v0.8.0' };

// --- contentAfter ----------------------------------------------------------

test('reconstructs the file after Edit, MultiEdit and Write', () => {
  assert.equal(contentAfter('Write', { content: 'x' }, 'old'), 'x');
  assert.equal(contentAfter('Edit', { old_string: 'a', new_string: 'b' }, 'a a'), 'b a');
  assert.equal(contentAfter('Edit', { old_string: 'a', new_string: 'b', replace_all: true }, 'a a'), 'b b');
  assert.equal(contentAfter('Edit', { old_string: 'a', new_string: '$&$&' }, 'a'), '$&$&');
  assert.equal(
    contentAfter(
      'MultiEdit',
      {
        edits: [
          { old_string: 'a', new_string: 'b' },
          { old_string: 'b', new_string: 'c' },
        ],
      },
      'a'
    ),
    'c'
  );
  assert.equal(contentAfter('Edit', { old_string: 'missing', new_string: 'x' }, 'a'), 'a');
});

// --- protected files -------------------------------------------------------

test('protects CHANGELOG, secret files and generated native folders', () => {
  assert.deepEqual(rules(protectedFileFindings('CHANGELOG.md')), ['changelog']);
  assert.deepEqual(rules(protectedFileFindings('exports/morning.gpx')), ['secret-file']);
  assert.deepEqual(rules(protectedFileFindings('apps/mobile/.env')), ['secret-file']);
  assert.deepEqual(rules(protectedFileFindings('apps/mobile/ios/Podfile')), ['generated-native']);
  assert.deepEqual(protectedFileFindings('apps/mobile/tools/fixtures/run-5k.gpx'), []);
  assert.deepEqual(protectedFileFindings('apps/mobile/.env.example'), []);
  assert.deepEqual(protectedFileFindings('docs/CHANGELOG-notes.md'), []);
});

// --- dependency rule -------------------------------------------------------

test('reads static, type, side-effect, dynamic and require imports', () => {
  const src = `import a from 'a';\nimport type { B } from "b";\nimport {\n  c,\n} from './c';\nimport 'd';\nexport * from '../e';\nconst f = await import('f');\nrequire('g');`;
  assert.deepEqual(importSpecifiers(src).sort(), ['../e', './c', 'a', 'b', 'd', 'f', 'g']);
});

test('domain and shared kernel stay free of frameworks and outer layers', () => {
  const file = 'apps/mobile/src/contexts/territory/domain/claim.ts';
  for (const imp of [
    "import React from 'react';",
    "import { View } from 'react-native';",
    "import * as Location from 'expo-location';",
    "import { latLngToCell } from 'h3-js';",
    "import { MapView } from '@maplibre/maplibre-react-native';",
    "import { Button } from '@cityturfer/ui';",
    "import { repo } from '../infrastructure/sqlite-claim-repository';",
    "import { useTurf } from '../ui/hooks';",
    "import { db } from '@/platform/database';",
    "import { root } from '../../../composition-root';",
  ]) {
    assert.deepEqual(rules(dependencyFindings(file, '', imp)), ['dependency-rule'], imp);
  }
  assert.deepEqual(
    dependencyFindings(file, '', "import { Claim } from './claim';\nimport { haversine } from '@/shared-kernel/geo';"),
    []
  );
  assert.equal(
    dependencyFindings('apps/mobile/src/shared-kernel/geo.ts', '', "import x from 'expo-crypto';").length,
    1
  );
});

test('only flags imports the edit introduces, and skips tests', () => {
  const file = 'apps/mobile/src/contexts/territory/domain/claim.ts';
  const legacy = "import React from 'react';";
  assert.deepEqual(dependencyFindings(file, legacy, `${legacy}\nconst x = 1;`), []);
  assert.deepEqual(
    dependencyFindings('apps/mobile/src/contexts/territory/domain/__tests__/claim.test.ts', '', legacy),
    []
  );
  assert.deepEqual(
    dependencyFindings('apps/mobile/src/test-support/node-database.ts', '', "import x from 'better-sqlite3';"),
    []
  );
});

test('application layer: no infrastructure, UI or React', () => {
  const file = 'apps/mobile/src/contexts/recording/application/ingest-fixes.ts';
  assert.equal(dependencyFindings(file, '', "import { useState } from 'react';").length, 1);
  assert.equal(dependencyFindings(file, '', "import { T } from '../infrastructure/background-task';").length, 1);
  assert.deepEqual(dependencyFindings(file, '', "import { RecordingSession } from '../domain/recording-session';"), []);
  assert.deepEqual(dependencyFindings(file, '', "import { Database } from '@/platform/database';"), []);
});

test('contexts talk through index.ts / contract.ts only', () => {
  const file = 'apps/mobile/src/contexts/territory/application/rebuild.ts';
  assert.equal(
    dependencyFindings(file, '', "import { Activity } from '@/contexts/activity-log/domain/activity';").length,
    1
  );
  assert.equal(
    dependencyFindings(file, '', "import { Activity } from '../../activity-log/domain/activity';").length,
    1
  );
  assert.deepEqual(
    dependencyFindings(file, '', "import { ActivityRecorded } from '@/contexts/activity-log/contract';"),
    []
  );
  assert.deepEqual(dependencyFindings(file, '', "import { x } from '@/contexts/activity-log';"), []);
});

test('screens use ui/ hooks; constants are a leaf', () => {
  assert.equal(
    dependencyFindings('apps/mobile/src/app/(tabs)/record.tsx', '', "import { db } from '@/platform/database';").length,
    1
  );
  assert.equal(
    dependencyFindings(
      'apps/mobile/src/app/(tabs)/record.tsx',
      '',
      "import { X } from '@/contexts/recording/application/x';"
    ).length,
    1
  );
  assert.deepEqual(
    dependencyFindings(
      'apps/mobile/src/app/(tabs)/record.tsx',
      '',
      "import { RecordView } from '@/contexts/recording/ui/record-view';"
    ),
    []
  );
  assert.equal(
    dependencyFindings('apps/mobile/src/constants/colors.ts', '', "import { x } from '@/ui-kit/theme';").length,
    1
  );
  assert.deepEqual(
    dependencyFindings('apps/mobile/src/constants/colors.ts', '', "import { palette } from '@cityturfer/brand';"),
    []
  );
});

test('ignores files outside apps/mobile/src and non-code files', () => {
  assert.deepEqual(dependencyFindings('packages/ui/src/button.tsx', '', "import x from 'react';"), []);
  assert.deepEqual(
    dependencyFindings('apps/mobile/src/contexts/territory/domain/notes.md', '', "import x from 'react';"),
    []
  );
});

// --- brand colours ---------------------------------------------------------

test('flags newly hard-coded brand hex in app sources only', () => {
  const brand = new Set(['#2BD48B', '#FFFFFF']);
  const file = 'apps/mobile/src/contexts/territory/ui/turf-map-view.tsx';
  assert.deepEqual(rules(brandHexFindings(file, '', "color: '#2bd48b'", brand)), ['brand-hex']);
  assert.deepEqual(brandHexFindings(file, "color: '#2BD48B'", "color: '#2BD48B', x: 1", brand), []);
  assert.deepEqual(brandHexFindings(file, '', "color: '#FFFFFF'", brand), []);
  assert.deepEqual(brandHexFindings(file, '', "color: '#123456'", brand), []);
  assert.deepEqual(brandHexFindings('packages/brand/src/colors.ts', '', "'#2BD48B'", brand), []);
});

test('reminders fire for parity-sensitive files', () => {
  const ids = (p) => remindersFor(p).map((r) => r.id);
  assert.deepEqual(ids('apps/mobile/src/contexts/territory/domain/turf-strength.ts'), ['turf-parity']);
  assert.deepEqual(ids('apps/mobile/src/shared-kernel/geo.ts'), ['geo-parity']);
  assert.deepEqual(ids('apps/mobile/app.json'), ['fingerprint']);
  assert.deepEqual(ids('packages/ui/src/button.tsx'), ['fingerprint']);
  assert.deepEqual(ids('apps/mobile/src/platform/migrations.ts'), ['migration']);
  assert.deepEqual(ids('apps/mobile/src/contexts/recording/infrastructure/background-task.ts'), ['background-task']);
  assert.deepEqual(ids('apps/mobile/src/contexts/health-sync/application/import.ts'), ['health-privacy']);
  assert.deepEqual(ids('apps/mobile/src/contexts/activity-log/ui/history.tsx'), []);
});

// --- bash policy -----------------------------------------------------------

test('git push: never to main, no force-push to integration branches', () => {
  assert.deepEqual(rules(bashFindings('git push origin main', CTX)), ['push-main']);
  assert.deepEqual(rules(bashFindings('git push', { branch: 'main' })), ['push-main']);
  assert.deepEqual(rules(bashFindings('git push origin HEAD', { branch: 'main' })), ['push-main']);
  assert.deepEqual(rules(bashFindings('git push origin feat/x:main', CTX)), ['push-main']);
  assert.deepEqual(rules(bashFindings('git push --force origin scope/v0.8.0', CTX)), ['force-push']);
  assert.deepEqual(rules(bashFindings('git push origin +release/v0.8.0', CTX)), ['force-push']);
  assert.deepEqual(bashFindings('git push -u origin feat/territory', CTX), []);
  assert.deepEqual(bashFindings('git push --force-with-lease origin feat/territory', CTX), []);
  assert.deepEqual(bashFindings('git push origin scope/v0.8.0', CTX), []);
  assert.deepEqual(rules(bashFindings('pnpm test && git push origin main', CTX)), ['push-main']);
});

test('git commit --no-verify and hand-made tags are denied', () => {
  assert.deepEqual(rules(bashFindings('git commit --no-verify -m "x"', CTX)), ['no-verify']);
  assert.deepEqual(rules(bashFindings('git commit -n -m "x"', CTX)), ['no-verify']);
  assert.deepEqual(bashFindings('git commit -m "feat(territory): x"', CTX), []);
  assert.deepEqual(rules(bashFindings('git tag v0.8.0', CTX)), ['tag']);
  assert.deepEqual(rules(bashFindings('git tag -a v0.8.0 -m x', CTX)), ['tag']);
  assert.deepEqual(bashFindings('git tag', CTX), []);
  assert.deepEqual(bashFindings('git tag -l "v0.*"', CTX), []);
  assert.deepEqual(bashFindings('git tag --contains HEAD', CTX), []);
});

test('gh pr create: title and base follow the branch flow', () => {
  const ok = 'gh pr create --base scope/v0.8.0 --title "city-turfer - feat/territory" --body x';
  assert.deepEqual(bashFindings(ok, CTX), []);
  assert.deepEqual(rules(bashFindings('gh pr create --base scope/v0.8.0 --title "feat: turf"', CTX)), ['pr-title']);
  assert.deepEqual(rules(bashFindings('gh pr create --base main --title "city-turfer - feat/territory"', CTX)), [
    'pr-base',
  ]);
  assert.deepEqual(rules(bashFindings('gh pr create --title "city-turfer - feat/territory"', CTX)), ['pr-base']);
  assert.deepEqual(
    bashFindings('gh pr create -B release/v0.8.0 -t "city-turfer - scope/v0.8.0" --draft', { branch: 'scope/v0.8.0' }),
    []
  );
  assert.deepEqual(
    rules(bashFindings('gh pr create -B main -t "city-turfer - scope/v0.8.0"', { branch: 'scope/v0.8.0' })),
    ['pr-base']
  );
  assert.deepEqual(
    bashFindings('gh pr create --base main --title "city-turfer - release/v0.8.0"', { branch: 'release/v0.8.0' }),
    []
  );
  assert.deepEqual(
    bashFindings("gh pr create --base scope/v0.8.0 --title 'city-turfer - fix/gap' ", {
      branch: 'fix/gap',
      activeScope: 'scope/v0.8.0',
    }),
    []
  );
});

test('gh pr create options after a multi-line body still count', () => {
  const cmd = `gh pr create --title "city-turfer - feat/territory" --body "$(cat <<'EOF'\n## Summary\nTurf overlay | record screen\nEOF\n)" --base scope/v0.8.0`;
  assert.deepEqual(bashFindings(cmd, CTX), []);
});

test('merges and device data need the user; squash is denied', () => {
  const pr = bashFindings('gh pr merge 90 --merge', CTX);
  assert.deepEqual(
    pr.map((f) => [f.rule, f.decision]),
    [['pr-merge', 'ask']]
  );
  assert.ok(
    bashFindings('gh pr merge 90 --squash', CTX).some((f) => f.rule === 'merge-style' && f.decision === 'deny')
  );
  assert.equal(
    bashFindings('xcrun devicectl device copy from --device X --source /a --destination /tmp/a', CTX)[0].decision,
    'ask'
  );
  assert.deepEqual(bashFindings('xcrun simctl get_app_container booted com.x data', CTX), []);
  assert.equal(bashFindings('git reset --hard origin/main', CTX)[0].decision, 'ask');
  assert.deepEqual(bashFindings('git status && git log --oneline -5', CTX), []);
});

test('expected PR base per branch type and newest scope', () => {
  assert.deepEqual(expectedBase('feat/recording', 'scope/v0.8.0'), ['scope/v0.8.0']);
  assert.deepEqual(expectedBase('scope/v0.8.0'), ['release/v0.8.0']);
  assert.deepEqual(expectedBase('release/v0.8.0'), ['main']);
  assert.equal(expectedBase('main'), null);
  assert.equal(newestScope(['origin/scope/v0.9.0', 'scope/v0.10.0', 'origin/scope/v0.8.1', 'feat/x']), 'scope/v0.10.0');
  assert.equal(newestScope([]), undefined);
});

// --- the hook scripts end to end ------------------------------------------

function runHook(script, payload) {
  const r = spawnSync('node', [resolve(ROOT, '.claude/hooks', script)], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: ROOT },
  });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout ? JSON.parse(r.stdout) : null;
}

test('pre-edit hook denies a framework import into the domain', () => {
  const out = runHook('pre-edit.mjs', {
    tool_name: 'Write',
    tool_input: {
      file_path: resolve(ROOT, 'apps/mobile/src/contexts/territory/domain/__hook-probe.ts'),
      content: "import x from 'react';\n",
    },
  });
  assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /dependency-rule/);
  assert.equal(
    runHook('pre-edit.mjs', {
      tool_name: 'Write',
      tool_input: { file_path: resolve(ROOT, 'docs/x.md'), content: 'hi' },
    }),
    null
  );
});

test('pre-bash hook denies pushing to main and ignores unrelated commands', () => {
  const out = runHook('pre-bash.mjs', { tool_name: 'Bash', tool_input: { command: 'git push origin main' } });
  assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
  assert.equal(runHook('pre-bash.mjs', { tool_name: 'Bash', tool_input: { command: 'pnpm test' } }), null);
});
