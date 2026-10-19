// commit-and-tag-version bump-file updater: keeps app.json `expo.version` in sync with package.json.
//
// writeVersion replaces only the version string, so the file keeps its Prettier formatting and its
// escapes. (Re-serialising with JSON.stringify reformatted the whole file in the v0.3.0 release
// commit and broke `pnpm run ci:quality` on main.)
const EXPO_VERSION = /("expo"\s*:\s*\{[\s\S]*?"version"\s*:\s*")([^"]*)(")/;

module.exports.readVersion = (contents) => JSON.parse(contents).expo.version;

module.exports.writeVersion = (contents, version) => {
  if (!EXPO_VERSION.test(contents)) {
    throw new Error('app.json: no expo.version to bump');
  }
  const next = contents.replace(EXPO_VERSION, `$1${version}$3`);
  if (JSON.parse(next).expo.version !== version) {
    throw new Error('app.json: version bump did not land on expo.version');
  }
  return next;
};
