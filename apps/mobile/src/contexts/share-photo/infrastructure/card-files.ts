import { CARD_FILE_PREFIX, CARD_KEEP_MS } from './card-files.constants';

/**
 * Whether a cache file is one of our rendered cards old enough to delete. An unknown modification
 * time, or one in the future (clock changed), keeps the file: never guess that a target is done.
 */
export function isStaleCard(name: string, modifiedMs: number | null, nowMs: number): boolean {
  if (!name.startsWith(CARD_FILE_PREFIX) || !name.endsWith('.jpg') || modifiedMs === null) {
    return false;
  }
  return nowMs - modifiedMs >= CARD_KEEP_MS;
}
