// Dev only: the site's header on the local Storybook and Swagger pages (served by server.mjs).
//
// The header is the same React component as on /en (AppHeaderView), bundled here with esbuild, and
// its stylesheet is app-header.css with the brand variables in front. Nothing is written to disk
// and nothing reaches the static export.
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { build } from 'esbuild';

import { loadBrand, rootVariablesCss } from './swagger-brand.mjs';

export const APP_HEADER_SCRIPT = '__app-header.js';
export const APP_HEADER_STYLES = '__app-header.css';

/** Waitlist settings the header reads (src/app/waitlist-config.ts), from .env* like Next does. */
const WAITLIST_ENV = ['NEXT_PUBLIC_WAITLIST_FORM_URL', 'NEXT_PUBLIC_WAITLIST_CONTROLLER', 'NEXT_PUBLIC_CONTACT_EMAIL'];

/**
 * Mount point and script for a page: `lockup` is the page's own logo (the header's logo shows once
 * it has scrolled away); without one the bar is solid at once. Goes first in <body>.
 */
export function appHeaderMarkup({ lockup } = {}) {
  const data = lockup ? ` data-lockup="${lockup.replaceAll('"', '&quot;')}"` : '';
  return `<div id="app-header-root"${data}></div><script src="./${APP_HEADER_SCRIPT}"></script>`;
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
    const { cssVariables } = await loadBrand(webRoot);
    const stylesheet = await readFile(path.join(webRoot, 'src/app/[locale]/app-header/app-header.css'), 'utf8');
    // Brand variables on the header only, so the host page's own :root stays as it is.
    const variables = rootVariablesCss(cssVariables('dark')).replace(':root', '.app-header');
    const css = `${variables}\n#app-header-root {\n  display: contents;\n}\n\n${stylesheet}`;
    return { js: bundle.outputFiles[0].text, css };
  })();
  return assets;
}
