// Learn more: https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// The local watchman install is broken (Homebrew libfmt mismatch); use Metro's node crawler.
config.resolver.useWatchman = false;

module.exports = config;
