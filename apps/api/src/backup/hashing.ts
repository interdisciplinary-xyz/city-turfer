import { createHash } from 'node:crypto';

import type { CompactPoint } from './model';

const sha256Hex = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');

/**
 * The canonical track hash: SHA-256 (lowercase hex) of the UTF-8 bytes of `JSON.stringify(points)`,
 * where `points` is the uploaded array of `[lon, lat, t, segment, altitudeM | null]` in upload
 * order. JSON.stringify writes no whitespace and every number in ECMAScript's shortest round-trip
 * form (`21.0122`, `1760857920000`, `-0` → `0`), so a client that hashes `JSON.stringify` of the
 * array it sends gets the same hash as the server, which re-serialises the parsed array.
 */
export function trackHashOf(points: readonly CompactPoint[]): string {
  return sha256Hex(JSON.stringify(points));
}

/** Hash of everything the phone uploads: equal hashes mean the upload is a replay. */
export function contentHashOf(fields: {
  type: string;
  name: string;
  source: string;
  startedAt: number;
  endedAt: number;
  timeZone: string | null;
  resumedSegments: readonly number[] | null;
  trackHash: string;
}): string {
  const f = fields;
  return sha256Hex(
    JSON.stringify([f.type, f.name, f.source, f.startedAt, f.endedAt, f.timeZone, f.resumedSegments, f.trackHash])
  );
}
