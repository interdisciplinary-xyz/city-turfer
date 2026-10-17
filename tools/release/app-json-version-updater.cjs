// commit-and-tag-version bump-file updater: keeps app.json `expo.version` in sync with package.json.
module.exports.readVersion = (contents) => JSON.parse(contents).expo.version;
module.exports.writeVersion = (contents, version) => {
  const json = JSON.parse(contents);
  json.expo.version = version;
  return JSON.stringify(json, null, 2) + '\n';
};
