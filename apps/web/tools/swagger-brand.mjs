// Dev only: what makes the Swagger page look like CityTurfer.
//
// @cityturfer/brand is TypeScript source (extensionless imports), which plain Node can't load, so
// esbuild bundles it in memory on first use and the result is imported from a data: URL. The page's
// colours therefore come from the same `cssVariables(SITE_SCHEME)` as the website (light since v0.10.0,
// docs/decisions/brand-light-theme-2026-10-22.md), never from literals.
// The toolbar bundle works the same way (see ./swagger-toolbar.mjs).
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { build } from 'esbuild';

let brandModule;

/** `@cityturfer/brand` as a module object (cached). `root` is a folder that can resolve it. */
export function loadBrand(root) {
  brandModule ??= build({
    stdin: { contents: "export * from '@cityturfer/brand';", resolveDir: root, loader: 'js' },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
    logLevel: 'silent',
  }).then(
    ({ outputFiles }) => import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`)
  );
  return brandModule;
}

/** `:root { --bg: …; … }` for a set of CSS variables: the website's variables. */
export function rootVariablesCss(variables) {
  const lines = Object.entries(variables).map(([name, value]) => `  ${name}: ${value};`);
  return `:root {\n${lines.join('\n')}\n}\n`;
}

/** The whole stylesheet: the site scheme's brand variables first, then the skin that only uses them. */
export async function swaggerThemeCss(root) {
  const { cssVariables, SITE_SCHEME } = await loadBrand(root);
  const skin = await readFile(path.join(import.meta.dirname, 'swagger-theme.css'), 'utf8');
  return `${rootVariablesCss(cssVariables(SITE_SCHEME))}\n${skin}`;
}
