import { CARD_FILE_PREFIX, CARD_KEEP_MS } from './card-files.constants';

/**
 * The Android card's file name, `<prefix><digits>.jpg`: the render time plus random digits, so two
 * cards rendered in the same millisecond never share a file.
 */
export function cardFileName(nowMs: number, random: () => number = Math.random): string {
  const salt = Math.floor(random() * 1_000_000)
    .toString()
    .padStart(6, '0');
  return `${CARD_FILE_PREFIX}${Math.max(0, Math.floor(nowMs))}${salt}.jpg`;
}

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
