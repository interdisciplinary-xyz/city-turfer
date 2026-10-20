// Dev only: the website's dev toolbar (@interdisciplinary/dev-toolbar) on the Swagger page.
//
// The package is React + Tailwind built for Next and has no standalone entry, but its only Next
// dependency is `usePathname`. So the toolbar is bundled here with esbuild (aliasing next/navigation
// to ./swagger-toolbar-navigation.mjs) and its CSS compiled with the same Tailwind config and
// stylesheet the site uses. Nothing is written to disk and nothing reaches the static export.
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { build } from 'esbuild';

let assets;

/** `{ js, css }` for the toolbar (cached). `webRoot` is apps/web. */
export function toolbarAssets(webRoot) {
  assets ??= (async () => {
    const tools = import.meta.dirname;
    const bundle = await build({
      entryPoints: [path.join(tools, 'swagger-toolbar-entry.mjs')],
      bundle: true,
      write: false,
      format: 'iife',
      platform: 'browser',
      jsx: 'automatic',
      minify: true,
      logLevel: 'silent',
      define: { 'process.env.NODE_ENV': '"development"' },
      alias: { 'next/navigation': path.join(tools, 'swagger-toolbar-navigation.mjs') },
      absWorkingDir: webRoot,
    });
    const [{ default: postcss }, { default: tailwindcss }] = await Promise.all([
      import('postcss'),
      import('tailwindcss'),
    ]);
    const cssFile = path.join(webRoot, 'src/app/dev-toolbar-with-app/dev-toolbar.css');
    const css = await postcss([tailwindcss({ config: path.join(webRoot, 'tailwind.config.ts') })]).process(
      await readFile(cssFile, 'utf8'),
      { from: cssFile }
    );
    return { js: bundle.outputFiles[0].text, css: css.css };
  })();
  return assets;
}
