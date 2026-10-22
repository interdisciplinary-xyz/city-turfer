// After `next build`: take the dev-only pages out of the static export. `/branding` is internal
// (pricing guesses, competitor notes, interview plan): it is served on the dev server only
// (tools/local-only-route.mjs) and must not ship to Vercel. Next has no per-route export switch, so
// the build drops what it wrote for those pages: `out/<name>.html`, `.txt`, the `out/<name>/` folder
// and the `out/__next.<name>*` segment files.
import { readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Top-level routes that exist in the app but not in the export. */
export const EXPORT_EXCLUDED_ROUTES = ['branding'];

/** Whether an entry of `out/` belongs to one of `routes`. */
export function isExcludedEntry(entry, routes = EXPORT_EXCLUDED_ROUTES) {
  return routes.some((route) => {
    const name = entry.replace(/^__next\./, '');
    return name === route || name.startsWith(`${route}.`);
  });
}

/** Removes the excluded routes from `outDir`; returns the entries it removed. */
export async function pruneLocalOnly(outDir, routes = EXPORT_EXCLUDED_ROUTES) {
  const removed = [];
  for (const entry of await readdir(outDir)) {
    if (isExcludedEntry(entry, routes)) {
      await rm(path.join(outDir, entry), { recursive: true, force: true });
      removed.push(entry);
    }
  }
  return removed.sort();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'out');
  const removed = await pruneLocalOnly(outDir);
  console.log(`prune-local-only: removed ${removed.length ? removed.join(', ') : 'nothing'} from out/`);
}
