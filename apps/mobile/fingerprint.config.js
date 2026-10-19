// Runtime fingerprint (OTA compatibility, docs/operations/ota-release.md). Left out on purpose:
// - package.json scripts: dev commands only (lint, tests, Maestro); they never change native code.
// - eas.json: build profiles (channel, APK vs AAB, version codes managed by EAS); adding or editing
//   a profile must not stop OTA updates reaching builds already installed.
/** @type {import('expo/fingerprint').Config} */
const { SourceSkips } = require('expo/fingerprint');

module.exports = {
  sourceSkips: SourceSkips.PackageJsonScriptsAll,
  ignorePaths: ['eas.json'],
};
