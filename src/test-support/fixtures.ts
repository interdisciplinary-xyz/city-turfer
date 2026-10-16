import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Fix } from '@/contexts/recording/domain/fix';

/** Minimal GPX reader for test fixtures in tools/fixtures/. */
export function loadFixes(name: string): Fix[] {
  const xml = readFileSync(join(__dirname, '../../tools/fixtures', name), 'utf8');
  const fixes: Fix[] = [];
  const re = /<trkpt lat="([^"]+)" lon="([^"]+)">(?:<ele>([^<]+)<\/ele>)?<time>([^<]+)<\/time><\/trkpt>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    fixes.push({ lat: +m[1], lon: +m[2], alt: m[3] ? +m[3] : null, t: Date.parse(m[4]), accuracy: 8, speed: null });
  }
  return fixes;
}
