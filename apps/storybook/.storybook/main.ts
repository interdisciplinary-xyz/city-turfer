import { fileURLToPath } from 'node:url';

import type { StorybookConfig } from '@storybook/react-native-web-vite';

const web = (path: string) => fileURLToPath(new URL(`../../web/src/${path}`, import.meta.url));
const shim = (file: string) => fileURLToPath(new URL(`../src/shims/${file}`, import.meta.url));

/**
 * One Storybook for both apps (`design-system` skill): @cityturfer/ui renders through
 * react-native-web; the website's components come straight from apps/web/src. Next.js-only
 * modules are swapped for small shims, since Storybook runs on Vite, not Next.
 */
const config: StorybookConfig = {
  framework: { name: '@storybook/react-native-web-vite', options: {} },
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs'],
  // The website's public files (phone screenshots) at the same URLs as on the site, and the brand
  // SVGs (sidebar logo, tab icon) under brand/.
  staticDirs: ['../../web/public', { from: '../../../packages/brand/svg', to: '/brand' }],
  core: { disableTelemetry: true },
  // Prop tables from the TS types; plain react-docgen can't follow React Native's imported types.
  typescript: { reactDocgen: 'react-docgen-typescript' },
  viteFinal(viteConfig) {
    const aliases = [
      { find: /^next\/image$/, replacement: shim('next-image.tsx') },
      { find: /^@\/i18n\/navigation$/, replacement: shim('i18n-navigation.tsx') },
      // apps/web's own `@/…` imports (e.g. '@/i18n/routing').
      { find: /^@\/(.*)$/, replacement: web('$1') },
    ];
    const existing = viteConfig.resolve?.alias;
    const kept = Array.isArray(existing)
      ? existing
      : Object.entries(existing ?? {}).map(([find, replacement]) => ({ find, replacement: String(replacement) }));
    return { ...viteConfig, resolve: { ...viteConfig.resolve, alias: [...aliases, ...kept] } };
  },
};

export default config;
