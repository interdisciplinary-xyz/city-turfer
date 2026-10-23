// The brand mark from @cityturfer/brand as the admin's favicon (payload.config.ts meta.icons). Static:
// read once at build time, from apps/admin (the build's working directory), and served as a file,
// so the SVG is never copied into apps/admin.
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const dynamic = 'force-static';

export async function GET(): Promise<Response> {
  const svg = await readFile(path.join(process.cwd(), '../../packages/brand/svg/mark.svg'));
  return new Response(svg, {
    headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' },
  });
}
