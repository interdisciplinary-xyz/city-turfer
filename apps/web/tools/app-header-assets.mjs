// Dev only: the site's header on the local Storybook and Swagger pages (served by server.mjs).
//
// The header is the same React component as on /en (AppHeaderView), bundled here with esbuild, and
// its stylesheet is app-header.css (the header brings its own light variables inline). Nothing is written to disk
// and nothing reaches the static export.
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { build } from 'esbuild';

export const APP_HEADER_SCRIPT = '__app-header.js';
export const APP_HEADER_STYLES = '__app-header.css';

/** Waitlist settings the header reads (src/app/waitlist-config.ts), from .env* like Next does. */
const WAITLIST_ENV = ['NEXT_PUBLIC_WAITLIST_FORM_URL', 'NEXT_PUBLIC_WAITLIST_CONTROLLER', 'NEXT_PUBLIC_CONTACT_EMAIL'];

/** Mount point and script for a page. Goes first in <body>. */
export function appHeaderMarkup() {
  return `<div id="app-header-root"></div><script src="./${APP_HEADER_SCRIPT}"></script>`;
}

/** The stylesheet link for <head>. */
export const appHeaderStylesheet = () => `<link rel="stylesheet" href="./${APP_HEADER_STYLES}" />`;

let assets;

/** `{ js, css }` for the header (cached). `webRoot` is apps/web. */
export function appHeaderAssets(webRoot) {
  assets ??= (async () => {
    const { default: nextEnv } = await import('@next/env');
    const { loadEnvConfig } = nextEnv;
    const { combinedEnv } = loadEnvConfig(webRoot, true, { info: () => {}, error: () => {} });
    const define = { 'process.env.NODE_ENV': '"development"' };
    for (const name of WAITLIST_ENV) {
      define[`process.env.${name}`] = JSON.stringify(combinedEnv[name] ?? '');
    }
    const bundle = await build({
      entryPoints: [path.join(import.meta.dirname, 'app-header-entry.mjs')],
      bundle: true,
      write: false,
      format: 'iife',
      platform: 'browser',
      jsx: 'automatic',
      minify: true,
      logLevel: 'silent',
      loader: { '.svg': 'dataurl' },
      define,
      absWorkingDir: webRoot,
    });
    const stylesheet = await readFile(path.join(webRoot, 'src/app/[locale]/app-header/app-header.css'), 'utf8');
    // No variable block here: AppHeaderView sets the header's own scheme (HEADER_SCHEME) inline on
    // the <header>, so the host page's :root (Swagger's dark skin, Storybook) stays as it is.
    // Opaque on these pages, so the host page never shows through the bar: the header's white.
    const opaque = '#app-header-root .app-header {\n  background: var(--card);\n}\n';
    const css = `#app-header-root {\n  display: contents;\n}\n\n${stylesheet}\n${opaque}`;
    return { js: bundle.outputFiles[0].text, css };
  })();
  return assets;
}
