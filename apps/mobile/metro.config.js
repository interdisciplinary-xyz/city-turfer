// Learn more: https://docs.expo.dev/guides/customizing-metro
// Sentry's Expo config is Expo's default config plus debug IDs in the bundle and its source maps
// (crash reports symbolicate without matching release names) and Sentry frames collapsed in LogBox.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const config = getSentryExpoConfig(__dirname, { includeWebReplay: false });
// The local watchman install is broken (Homebrew libfmt mismatch); use Metro's node crawler.
config.resolver.useWatchman = false;

module.exports = config;
