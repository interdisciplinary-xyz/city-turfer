import { File, Paths } from 'expo-file-system';

import type { TempFiles } from '../domain/ports';
import { isInside, normalisePath, tempRoots } from './temp-paths';

/**
 * Deletes the picked photo's copy and the rendered card, and only files in our temp folders: never
 * a file the app did not make. Best effort, never throws, never logs the path. Paths are read on
 * each call: Paths needs the native module, never at import time.
 */
export class ExpoTempFiles implements TempFiles {
  async delete(uri: string): Promise<void> {
    try {
      if (!isInside(uri, tempRoots(Paths.cache.uri, Paths.document.uri))) {
        return;
      }
      const file = new File(`file://${normalisePath(uri)}`);
      if (file.exists) {
        file.delete();
      }
    } catch {
      // Best effort: the OS clears cache and temp folders anyway.
    }
  }
}
