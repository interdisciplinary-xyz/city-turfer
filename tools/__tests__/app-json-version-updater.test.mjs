import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const updater = require('../release/app-json-version-updater.cjs');

const SAMPLE = `{
  "expo": {
    "name": "CityTurfer",
    "version": "0.3.0",
    "platforms": ["ios", "android"],
    "plugins": [["expo-location", { "text": "a \\u2014 b" }]],
    "extra": { "eas": { "version": "keep-me" } }
  }
}
`;

test('reads expo.version', () => {
  assert.equal(updater.readVersion(SAMPLE), '0.3.0');
});

test('writes only expo.version and keeps formatting and escapes byte for byte', () => {
  const out = updater.writeVersion(SAMPLE, '0.4.0');
  assert.equal(out, SAMPLE.replace('"version": "0.3.0"', '"version": "0.4.0"'));
  assert.equal(updater.readVersion(out), '0.4.0');
  assert.match(out, /"platforms": \["ios", "android"\]/);
  assert.match(out, /\\u2014/);
  assert.match(out, /"version": "keep-me"/);
});

test('fails loudly without expo.version', () => {
  assert.throws(() => updater.writeVersion('{ "expo": { "name": "x" } }\n', '1.0.0'), /no expo.version/);
});

test('the real app.json round-trips unchanged', () => {
  const real = readFileSync(new URL('../../apps/mobile/app.json', import.meta.url), 'utf8');
  const version = updater.readVersion(real);
  assert.equal(updater.writeVersion(real, version), real);
});
