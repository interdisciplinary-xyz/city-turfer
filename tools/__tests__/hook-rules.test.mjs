import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { newestScope } from '../harness/git-context.mjs';
import {
  allowedBases,
  bashFindings,
  brandHexFindings,
  contentAfter,
  dependencyFindings,
  editAllowed,
  expectedBase,
  importSpecifiers,
  parseShell,
  protectedFileFindings,
  readOnlyBashFindings,
  remindersFor,
  shellCommands,
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

test('domain stays free of native modules (HealthKit, Nitro, scoped react-native packages)', () => {
  const dom = 'apps/mobile/src/contexts/health-sync/domain/workout.ts';
  for (const spec of [
    '@kingstinct/react-native-healthkit',
    'react-native-nitro-modules',
    '@react-native-async-storage/async-storage',
  ]) {
    assert.deepEqual(rules(dependencyFindings(dom, '', `import x from '${spec}';`)), ['dependency-rule'], spec);
  }
  // false positives: the infrastructure adapter may use HealthKit; look-alike names are fine
  assert.deepEqual(
    dependencyFindings(
      'apps/mobile/src/contexts/health-sync/infrastructure/healthkit-store.ts',
      '',
      "import x from '@kingstinct/react-native-healthkit';"
    ),
    []
  );
  assert.deepEqual(dependencyFindings(dom, '', "import x from '@cityturfer/core/shared-kernel';"), []);
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
  assert.deepEqual(ids('packages/core/src/contexts/territory/domain/strength.ts'), ['turf-parity']);
  assert.deepEqual(ids('packages/core/src/shared-kernel/track-analyzer.ts'), ['geo-parity']);
  assert.deepEqual(ids('packages/core/src/shared-kernel/__tests__/geo.test.ts'), []);
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

test('a bare push after git switch/checkout in the same line targets the new branch', () => {
  const feat = { branch: 'feat/harness', activeScope: 'scope/v0.9.0' };
  for (const cmd of [
    'git checkout main && git push',
    'git switch main && git push',
    'git switch main && git pull && git merge --no-ff scope/v0.9.0 && git push',
    'git checkout main; git push origin HEAD',
    'git switch -c main && git push -u origin HEAD',
    'git checkout -B main origin/main && git push',
  ]) {
    assert.deepEqual(rules(bashFindings(cmd, feat)), ['push-main'], cmd);
  }
  assert.deepEqual(rules(bashFindings('git switch scope/v0.9.0 && git push --force', feat)), ['force-push']);
  assert.deepEqual(rules(bashFindings('git switch - && git push', feat)), ['push-main']);
  assert.deepEqual(rules(bashFindings('git checkout @{-1} && git push', feat)), ['push-main']);
  // false positives: switching to a feature branch, restoring files, naming the branch
  assert.deepEqual(bashFindings('git switch feat/x && git push', feat), []);
  assert.deepEqual(bashFindings('git checkout -b feat/y && git push -u origin feat/y', feat), []);
  assert.deepEqual(bashFindings('git switch -c feat/y origin/main && git push -u origin HEAD', feat), []);
  assert.deepEqual(bashFindings('git checkout main && git pull && git checkout feat/x && git push', feat), []);
  assert.deepEqual(bashFindings('git checkout -- apps/mobile/src/x.ts && git push', feat), []);
  assert.deepEqual(bashFindings('git checkout main -- package.json && git push', feat), []);
  assert.deepEqual(bashFindings('git checkout apps/mobile/src/x.ts && git push', feat), []);
  assert.deepEqual(bashFindings('git switch - && git push origin feat/harness', feat), []);
  assert.deepEqual(
    bashFindings('git switch -c feat/z && gh pr create --base scope/v0.9.0 --title "city-turfer - feat/z"', feat),
    []
  );
});

test('git push --all, --branches, --mirror and glob refspecs count as pushing main', () => {
  for (const cmd of [
    'git push --mirror origin',
    'git push --mirror',
    'git push origin --all --force',
    'git push --all origin',
    'git push --all -u origin',
    'git push --branches origin',
    'git push --mirr origin',
    "git push origin 'refs/heads/*:refs/heads/*'",
    'git push origin +refs/heads/*:refs/heads/*',
  ]) {
    assert.deepEqual(rules(bashFindings(cmd, CTX)), ['push-main'], cmd);
  }
  // false positives: one named branch, other options
  assert.deepEqual(bashFindings('git push --atomic origin feat/territory', CTX), []);
  assert.deepEqual(bashFindings('git push -u origin feat/all-the-things', CTX), []);
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

test('shell parsing: quotes, heredocs, operators, redirections and wrappers', () => {
  assert.deepEqual(shellCommands(`git commit -m "a; git push origin main" && echo 'x | y'`), [
    ['git', 'commit', '-m', 'a; git push origin main'],
    ['echo', 'x | y'],
  ]);
  assert.deepEqual(shellCommands('git push origin feat/x 2>&1 | tail -5 > /tmp/out'), [
    ['git', 'push', 'origin', 'feat/x'],
    ['tail', '-5'],
  ]);
  assert.deepEqual(shellCommands(`(cd apps && FOO=1 command git status)`), [
    ['cd', 'apps'],
    ['git', 'status'],
  ]);
  assert.deepEqual(shellCommands(`bash -c "git push origin main"`), [['git', 'push', 'origin', 'main']]);
  const body = `gh pr create --body "$(cat <<'EOF'\nUse "--base main" here (see #1\nEOF\n)" --base scope/v0.9.0`;
  const [cmd] = shellCommands(body);
  assert.equal(cmd.at(-1), 'scope/v0.9.0');
  assert.equal(cmd.length, 7);
  assert.deepEqual(shellCommands(`git commit -F- <<'EOF'\nfix: x; git push origin main\nEOF\ngit status`), [
    ['git', 'commit', '-F-'],
    ['git', 'status'],
  ]);
});

test('wrappers and global options do not hide a push to main', () => {
  for (const cmd of [
    'git -c color.ui=never push origin main',
    'git -C apps/mobile --no-pager push origin main',
    '(git push origin main)',
    'bash -c "git push origin main"',
    "sh -lc 'cd x && git push origin main'",
    'command git push origin main',
    'env GIT_TRACE=1 git push origin main',
    'eval "git push origin main"',
    '/usr/bin/git push origin main',
    // compound commands and wrappers that run the rest of the line
    'if true; then git push origin main; fi',
    'if false; then :; else git push origin main; fi',
    'while true; do git push origin main; break; done',
    'until false; do git push origin main; done',
    'for r in origin; do git push "$r" main; done',
    'timeout 120 git push origin main',
    'timeout -s KILL -k 5 120 git push origin main',
    'nice git push origin main',
    'nice -n 5 git push origin main',
    'xargs git push origin main',
    'echo origin | xargs -I{} git push {} main',
    'echo origin | xargs -n 1 git push origin main',
    'sudo -u me git push origin main',
  ]) {
    assert.deepEqual(rules(bashFindings(cmd, CTX)), ['push-main'], cmd);
  }
  // false positives: the words only appear as data
  assert.deepEqual(bashFindings('git commit -m "never git push origin main"', CTX), []);
  assert.deepEqual(bashFindings('git commit -m "then git push origin main"', CTX), []);
  assert.deepEqual(bashFindings('timeout 120 git push origin feat/territory', CTX), []);
  assert.deepEqual(bashFindings('if git diff --quiet; then echo clean; fi', CTX), []);
  assert.deepEqual(bashFindings('echo "git push origin main" > notes.txt', CTX), []);
  assert.deepEqual(bashFindings('grep -rn "git push origin main" docs', CTX), []);
});

test('no-verify: flag clusters count, the commit message does not; push --no-verify is denied', () => {
  assert.deepEqual(rules(bashFindings('git commit -nm "x"', CTX)), ['no-verify']);
  assert.deepEqual(rules(bashFindings('git commit -anm "x"', CTX)), ['no-verify']);
  assert.deepEqual(rules(bashFindings('git push --no-verify origin feat/territory', CTX)), ['no-verify']);
  assert.deepEqual(bashFindings('git commit -m "handle the -n flag"', CTX), []);
  assert.deepEqual(bashFindings('git commit -m "--no-verify is denied now"', CTX), []);
  assert.deepEqual(bashFindings('git commit -mnote', CTX), []);
  assert.deepEqual(bashFindings('git commit -am "x" --author "n <n@x>"', CTX), []);
  assert.deepEqual(bashFindings('git push -n origin feat/territory', CTX), []); // -n is --dry-run for push
});

test('no-verify: HUSKY=0 and core.hooksPath switch the hooks off too', () => {
  for (const cmd of [
    'HUSKY=0 git commit -m x',
    'HUSKY=0 git push origin feat/territory',
    'env HUSKY=0 git merge scope/v0.8.0',
    'export HUSKY=0; git commit -m x',
    'export HUSKY=0 && git commit -m x',
    'bash -c "HUSKY=0 git commit -m x"',
    'git -c core.hooksPath=/dev/null commit -m x',
    'git -c core.hookspath= push origin feat/territory',
    'git --config-env=core.hooksPath=EMPTY commit -m x',
    'GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.hooksPath GIT_CONFIG_VALUE_0=/dev/null git commit -m x',
    'git config core.hooksPath /dev/null',
    'git config --unset core.hooksPath',
    'git config set core.hooksPath /tmp/none',
  ]) {
    assert.deepEqual(rules(bashFindings(cmd, CTX)), ['no-verify'], cmd);
  }
  assert.deepEqual(rules(bashFindings('git -c core.hooksPath=/dev/null push origin main', CTX)), [
    'no-verify',
    'push-main',
  ]);
  // false positives: other env and config, reading hooksPath, HUSKY on other commands
  assert.deepEqual(bashFindings('HUSKY=1 git commit -m x', CTX), []);
  assert.deepEqual(bashFindings('GIT_TRACE=1 git commit -m "HUSKY=0 is denied"', CTX), []);
  assert.deepEqual(bashFindings('git -c user.name=x commit -m x', CTX), []);
  assert.deepEqual(bashFindings('git config core.hooksPath', CTX), []);
  assert.deepEqual(bashFindings('git config --get core.hooksPath', CTX), []);
  assert.deepEqual(bashFindings('HUSKY=0 pnpm install', CTX), []);
});

test('abbreviated long options count as the option (git accepts unambiguous prefixes)', () => {
  assert.deepEqual(rules(bashFindings('git commit --no-veri -m x', CTX)), ['no-verify']);
  assert.deepEqual(rules(bashFindings('git commit --no-v -m x', CTX)), ['no-verify']);
  assert.deepEqual(rules(bashFindings('git push --no-veri', CTX)), ['no-verify']);
  assert.deepEqual(rules(bashFindings('git push --del origin scope/v0.9.0', CTX)), ['delete-branch']);
  assert.deepEqual(rules(bashFindings('git push origin --dele release/v0.8.0', CTX)), ['delete-branch']);
  assert.deepEqual(rules(bashFindings('git branch --del main', CTX)), ['delete-branch']);
  assert.deepEqual(rules(bashFindings('git push --force-w origin scope/v0.9.0', CTX)), ['force-push']);
  assert.deepEqual(rules(bashFindings('git push --force-w=scope/v0.9.0 origin scope/v0.9.0', CTX)), ['force-push']);
  assert.deepEqual(rules(bashFindings('git push --forc origin release/v0.8.0', CTX)), ['force-push']);
  // false positives: other options sharing a few letters
  assert.deepEqual(bashFindings('git commit --no-edit --amend', CTX), []);
  assert.deepEqual(bashFindings('git push --follow-tags origin scope/v0.8.0', CTX), []);
  assert.deepEqual(bashFindings('git push --force-if-includes origin scope/v0.8.0', CTX), []);
  assert.deepEqual(bashFindings('git push --dry-run origin --delete feat/old', CTX), []);
  assert.deepEqual(bashFindings('git push --d origin feat/x', CTX), []); // ambiguous in git: it fails
});

test('integration branches are never deleted, locally or on the remote', () => {
  assert.deepEqual(rules(bashFindings('git push origin --delete scope/v0.8.0', CTX)), ['delete-branch']);
  assert.deepEqual(rules(bashFindings('git push origin -d release/v0.8.0', CTX)), ['delete-branch']);
  assert.deepEqual(rules(bashFindings('git push origin :release/v0.8.0', CTX)), ['delete-branch']);
  assert.deepEqual(rules(bashFindings('git push origin :main', CTX)), ['delete-branch']);
  assert.deepEqual(rules(bashFindings('git branch -D scope/v0.8.0', CTX)), ['delete-branch']);
  assert.deepEqual(rules(bashFindings('git branch --delete main', CTX)), ['delete-branch']);
  // false positives: feature branches, remote-tracking refs, listing
  assert.deepEqual(bashFindings('git push origin --delete feat/old', CTX), []);
  assert.deepEqual(bashFindings('git push origin :feat/old', CTX), []);
  assert.deepEqual(bashFindings('git branch -D feat/old', CTX), []);
  assert.deepEqual(bashFindings('git branch -dr origin/scope/v0.7.0', CTX), []);
  assert.deepEqual(bashFindings('git branch --list "scope/*"', CTX), []);
});

test('the release runs only in release.yml', () => {
  for (const cmd of [
    'pnpm run release',
    'pnpm release',
    'pnpm -w run release -- --release-as 0.9.0',
    'npm run release',
    'yarn release',
    'npx commit-and-tag-version',
    'pnpm exec commit-and-tag-version --release-as minor',
    'node_modules/.bin/commit-and-tag-version',
  ]) {
    assert.deepEqual(rules(bashFindings(cmd, CTX)), ['release'], cmd);
  }
  // false positives
  assert.deepEqual(bashFindings('pnpm run release -- --dry-run', CTX), []);
  assert.deepEqual(bashFindings('npx commit-and-tag-version --dry-run', CTX), []);
  assert.deepEqual(bashFindings('grep commit-and-tag-version package.json', CTX), []);
  assert.deepEqual(bashFindings('pnpm run release:notes', CTX), []);
  assert.deepEqual(bashFindings('git log release/v0.8.0', CTX), []);
});

test('gh pr: --fill, gh pr edit, and options inside the body', () => {
  assert.deepEqual(rules(bashFindings('gh pr create --fill --base scope/v0.8.0', CTX)), ['pr-title']);
  assert.deepEqual(
    bashFindings('gh pr create --fill --title "city-turfer - feat/territory" --base scope/v0.8.0', CTX),
    []
  );
  assert.deepEqual(
    bashFindings(
      'gh pr create --title "city-turfer - feat/territory" --body "see --base main" --base scope/v0.8.0',
      CTX
    ),
    []
  );
  assert.deepEqual(rules(bashFindings('gh pr edit --base main', CTX)), ['pr-base']);
  assert.deepEqual(rules(bashFindings('gh pr edit --title "turf overlay"', CTX)), ['pr-title']);
  assert.deepEqual(bashFindings('gh pr edit --title "city-turfer - feat/territory"', CTX), []);
  assert.deepEqual(rules(bashFindings('gh pr edit 101 --title "Turf"', CTX)), ['pr-title']);
  assert.deepEqual(bashFindings('gh pr edit 101 --title "city-turfer - feat/other"', CTX), []);
  assert.deepEqual(
    bashFindings('gh pr edit 101 --base scope/v0.8.0', CTX).map((f) => f.decision),
    ['ask']
  );
  assert.deepEqual(bashFindings('gh pr edit 101 --add-label docs', CTX), []);
  assert.deepEqual(bashFindings('gh pr view 101 --json title', CTX), []);
});

test('fix/ after promotion may target release; release and hotfix merge back down', () => {
  const fix = { branch: 'fix/gps-drop', activeScope: 'scope/v0.9.0' };
  assert.deepEqual(
    bashFindings('gh pr create --base release/v0.8.0 --title "city-turfer - fix/gps-drop" --body x', fix),
    []
  );
  assert.deepEqual(
    bashFindings('gh pr create --base scope/v0.9.0 --title "city-turfer - fix/gps-drop" --body x', fix),
    []
  );
  assert.deepEqual(rules(bashFindings('gh pr create --base main --title "city-turfer - fix/gps-drop" --body x', fix)), [
    'pr-base',
  ]);
  assert.deepEqual(
    rules(
      bashFindings('gh pr create --base release/v0.8.0 --title "city-turfer - feat/x" --body x', { branch: 'feat/x' })
    ),
    ['pr-base']
  );
  assert.deepEqual(allowedBases('release/v0.8.0'), ['main', 'scope/vX.Y.Z']);
  assert.deepEqual(allowedBases('hotfix/crash'), ['main', 'release/vX.Y.Z', 'scope/vX.Y.Z']);
  assert.deepEqual(expectedBase('fix/gps-drop', 'scope/v0.9.0'), ['scope/v0.9.0']);
});

test('a head outside the branch naming may only target a scope', () => {
  const agent = { branch: 'worktree-agent-abc', activeScope: 'scope/v0.9.0' };
  for (const cmd of [
    'gh pr create --base main --title "city-turfer - worktree-agent-abc"',
    'gh pr create --base release/v0.9.0 --title "city-turfer - worktree-agent-abc"',
    'gh pr create --title "city-turfer - worktree-agent-abc"',
    'gh pr create --head claude/x --base main --title "city-turfer - claude/x"',
    'gh pr edit --base main',
  ]) {
    assert.deepEqual(rules(bashFindings(cmd, agent)), ['pr-base'], cmd);
  }
  assert.match(
    bashFindings('gh pr create --base main --title "city-turfer - worktree-agent-abc"', agent)[0].message,
    /git branch -m/
  );
  // false positive: the active scope is a valid base for any head
  assert.deepEqual(
    bashFindings('gh pr create --base scope/v0.9.0 --title "city-turfer - worktree-agent-abc"', agent),
    []
  );
});

test('device data: copies ask, device listings do not', () => {
  assert.deepEqual(rules(bashFindings('idevicebackup2 backup /tmp/b', CTX)), ['device-data']);
  assert.deepEqual(bashFindings('idevice_id -l', CTX), []);
  assert.deepEqual(bashFindings('ideviceinfo -k DeviceName', CTX), []);
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
  const release = runHook('pre-bash.mjs', { tool_name: 'Bash', tool_input: { command: 'pnpm run release' } });
  assert.equal(release.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(release.hookSpecificOutput.permissionDecisionReason, /\[release\]/);
});

// --- agent-scoped guards ---------------------------------------------------

const blocked = (line) => readOnlyBashFindings(line).length > 0;

test('parseShell reports file redirections, not fd duplications', () => {
  assert.deepEqual(parseShell('git diff > /tmp/x 2>&1').redirects, [{ op: '>', target: '/tmp/x' }]);
  assert.deepEqual(parseShell("bash -c 'echo hi >> log'").redirects, [{ op: '>>', target: 'log' }]);
  assert.deepEqual(parseShell('cat a 2>/dev/null').redirects, [{ op: '2>', target: '/dev/null' }]);
});

test('read-only agents: inspection and test commands pass', () => {
  for (const line of [
    'git diff --stat origin/scope/v0.9.0...HEAD',
    'git log --oneline -20 && git show HEAD:CLAUDE.md | head -40',
    'git branch --list "feat/*"',
    'git branch -r --sort=-v:refname',
    'grep -rn "beforeId" apps/mobile/src 2>/dev/null | wc -l',
    "sed -n '1,40p' tools/harness/worker.mjs",
    "awk '$3 > 5 {print $1}' data.txt",
    'find apps/mobile/src -name "*.ts" | xargs grep -l useContainer',
    'pnpm -C apps/mobile exec jest src/contexts/territory',
    'pnpm --filter @cityturfer/core run arch',
    'pnpm exec turbo run typecheck test:unit --filter=@cityturfer/core',
    'pnpm exec prettier --check .claude',
    'pnpm run audit:harness',
    'node --test tools/__tests__/hook-rules.test.mjs',
    'node apps/mobile/tools/route-stats.mjs apps/mobile/tools/fixtures/run-5k.gpx --json',
    'gh pr view 115 --json files',
    'gh api repos/o/r/pulls/115/comments',
    'git diff > /private/tmp/claude-501/x/scratchpad/review.patch',
    'for f in a.ts b.ts; do echo "== $f"; cat -n "$f"; done',
    "grep -rnoE '`[^`]*src/[^` ]*`' .claude | sort -u",
    'npx tsc --noEmit 2>&1 | tail -5; npm run test:arch & wait',
    'timeout 300 npx vitest run',
    'find apps -name "*.ts" | xargs -n 20 grep -l useContainer',
    'if git diff --quiet; then echo clean; else git diff --stat; fi',
  ]) {
    assert.deepEqual(readOnlyBashFindings(line), [], line);
  }
});

test('read-only agents: anything that writes, mutates git or runs code is denied', () => {
  for (const line of [
    'git diff > review.patch',
    'git diff >> apps/mobile/src/x.ts',
    'cat <<EOF > notes.md\nhi\nEOF',
    'echo x | tee out.txt',
    "sed -i '' s/a/b/ file.ts",
    "sed -n 's/a/b/w out' f",
    'awk \'{print $1 > "out"}\' f',
    'git checkout -- apps/mobile/src/x.ts',
    'git stash',
    'git branch -D feat/x',
    'git commit -m x',
    'bash -c "git reset --hard"',
    'echo $(rm -rf build)',
    'find . -name "*.orig" -delete',
    'pnpm exec eslint --fix apps/mobile/src',
    'pnpm exec prettier --write .',
    'pnpm run audit:docs -- --write-index',
    'pnpm --filter @cityturfer/api run openapi',
    'pnpm add zod',
    "node -e \"require('fs').writeFileSync('x', '')\"",
    'gh pr comment 115 --body hi',
    'gh api -X POST repos/o/r/issues',
    'python3 fix.py',
    'npx jest -u',
    'for f in *.ts; do sed -i "" s/a/b/ "$f"; done',
    'echo "$(git checkout main)"',
    'if true; then rm -rf build; fi',
    'nice -n 5 rm x',
    'find . -name "*.orig" | xargs -n 1 rm',
  ]) {
    assert.ok(blocked(line), line);
  }
  assert.match(readOnlyBashFindings('rm x')[0].message, /read-only/);
});

test('edit allowlist: folders by trailing slash, files exactly, nothing outside the repo', () => {
  const allow = ['docs/product/', 'NOTEBOOK.md'];
  assert.ok(editAllowed('docs/product/brief.md', allow));
  assert.ok(editAllowed('NOTEBOOK.md', allow));
  assert.ok(!editAllowed('docs/productivity.md', allow));
  assert.ok(!editAllowed('NOTEBOOK.md.bak', allow));
  assert.ok(!editAllowed('../outside/docs/product/x.md', allow));
  assert.ok(!editAllowed('', allow));
});

function runAgentHook(script, args, payload) {
  const r = spawnSync('node', [resolve(ROOT, '.claude/hooks', script), ...args], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: ROOT },
  });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout ? JSON.parse(r.stdout).hookSpecificOutput.permissionDecision : 'allow';
}

test('read-only-bash and edit-allowlist hooks end to end', () => {
  const bash = (command) => runAgentHook('read-only-bash.mjs', [], { tool_name: 'Bash', tool_input: { command } });
  assert.equal(bash('git diff HEAD~1'), 'allow');
  assert.equal(bash('git diff > x.patch'), 'deny');

  const args = ['--allow', 'docs/product/,.claude/agent-memory/product-manager/', '--ask', 'NOTEBOOK.md'];
  const edit = (path) =>
    runAgentHook('edit-allowlist.mjs', args, {
      tool_name: 'Edit',
      cwd: ROOT,
      tool_input: { file_path: resolve(ROOT, path) },
    });
  assert.equal(edit('docs/product/product-brief.md'), 'allow');
  assert.equal(edit('.claude/agent-memory/product-manager/MEMORY.md'), 'allow');
  assert.equal(edit('NOTEBOOK.md'), 'ask');
  assert.equal(edit('apps/mobile/src/app/(tabs)/record.tsx'), 'deny');
  assert.equal(edit('.claude/agents/product-manager.md'), 'deny');
});
