// Jest stand-in for `expo/virtual/env` (an ES module Metro serves in development). babel-preset-expo
// turns `process.env.EXPO_PUBLIC_*` into `env.EXPO_PUBLIC_*` from it outside production bundles.
export const env = process.env;
