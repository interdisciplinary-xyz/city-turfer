// Runtime fingerprint (OTA compatibility, docs/operations/ota-release.md). package.json scripts are
// dev commands only (lint, tests, Maestro) and never change native code, so a script edit must not
// stop OTA updates reaching installed builds.
/** @type {import('expo/fingerprint').Config} */
const { SourceSkips } = require('expo/fingerprint');

module.exports = {
  sourceSkips: SourceSkips.PackageJsonScriptsAll,
};
