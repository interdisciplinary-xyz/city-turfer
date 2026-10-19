import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

// The app bundles @cityturfer/ui from its source. If a workspace gets its own nested copy of
// react-native or react (pnpm does that when a peer like @react-native/jest-preset differs between
// workspaces), Metro would put two React Natives in the app (`design-system` skill).
const ROOT = join(import.meta.dirname, '..', '..');
const SINGLETONS = ['react-native', 'react'];

test('no workspace has its own copy of react-native or react', () => {
  const nested = [];
  for (const group of ['apps', 'packages']) {
    for (const workspace of readdirSync(join(ROOT, group))) {
      for (const pkg of SINGLETONS) {
        const path = join(group, workspace, 'node_modules', pkg);
        if (existsSync(join(ROOT, path))) {
          nested.push(path);
        }
      }
    }
  }
  assert.deepEqual(nested, [], `nested copies (align the peer versions, then pnpm install): ${nested.join(', ')}`);
});
