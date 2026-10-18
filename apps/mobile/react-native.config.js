// Apple Health is iOS only: keep its native code (and the Nitro runtime it needs) out of Android,
// so the Android app and its runtime fingerprint stay exactly as before.
module.exports = {
  dependencies: {
    '@kingstinct/react-native-healthkit': { platforms: { android: null } },
    '@react-native-healthkit/core': { platforms: { android: null } },
    'react-native-nitro-modules': { platforms: { android: null } },
  },
};
