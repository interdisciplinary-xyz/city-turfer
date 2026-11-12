import { Directory, File, Paths } from 'expo-file-system';

import type { CardFiles } from '../domain/ports';
import { isStaleCard } from './card-files';
import { cacheDirs } from './temp-paths';

/**
 * When the rendered card may be deleted, per platform. iOS: right after the share sheet closes (it
 * resolves once the chosen action has finished), and nothing to sweep. Android: the sheet resolves
 * when the chooser returns, before the target has read the file, so the card stays and is swept
 * once it is older than CARD_KEEP_MS: at app launch and on each return to the foreground, when the
 * share screen opens and before the next capture (never on close: a background transfer may still
 * be reading it). Cards are written to the internal cache; the external cache is swept too, for
 * cards an earlier test build (view-shot tmpfile) may have left there. Best effort, never throws,
 * never logs a path. Paths are read on each call: Paths needs the native module, never at import
 * time.
 */
export class ExpoCardFiles implements CardFiles {
  readonly deleteAfterShare: boolean;

  constructor(
    private readonly os: string,
    private readonly now: () => number = Date.now
  ) {
    this.deleteAfterShare = os !== 'android';
  }

  async sweep(): Promise<void> {
    if (this.os !== 'android') {
      return;
    }
    const now = this.now();
    let dirs: string[];
    try {
      dirs = cacheDirs(Paths.cache.uri);
    } catch {
      return;
    }
    for (const path of dirs) {
      try {
        const dir = new Directory(`file://${path}`);
        if (!dir.exists) {
          continue;
        }
        for (const entry of dir.list()) {
          if (entry instanceof File && isStaleCard(entry.name, entry.lastModified, now)) {
            entry.delete();
          }
        }
      } catch {
        // Best effort: the OS clears the cache anyway.
      }
    }
  }
}
