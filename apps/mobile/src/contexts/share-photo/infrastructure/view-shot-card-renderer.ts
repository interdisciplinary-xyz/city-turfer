import { File, Paths } from 'expo-file-system';
import { PixelRatio, Platform } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import type { CardRenderer, CardTarget } from '../domain/ports';
import { cardFileName } from './card-files';

/** The story size in pixels and its JPEG quality (docs/plans/share-photo-2026-11-11.md). */
const OUTPUT = { width: 1080, height: 1920, quality: 0.9 } as const;

/**
 * Captures the mounted card view to a JPEG temp file. view-shot reads `width`/`height` as points on
 * iOS (drawn at the screen scale) and as pixels on Android, so iOS gets 1080 px through the pixel ratio.
 *
 * iOS: view-shot's tmpfile, in the app's own tmp folder (deleted right after sharing). Android: a
 * view-shot tmpfile may land in the external cache (it picks the folder with more free space),
 * readable by apps holding storage permission on Android 9 and older, and the card stays until a
 * sweep. So Android captures to base64 (in memory, no file) and writes the card into the app's
 * internal cache, named so the sweep finds ours and nothing else.
 */
export class ViewShotCardRenderer implements CardRenderer {
  async render(target: CardTarget): Promise<string> {
    const ios = Platform.OS === 'ios';
    const scale = ios ? PixelRatio.get() : 1;
    const ref = target as Parameters<typeof captureRef>[0];
    const size = { width: OUTPUT.width / scale, height: OUTPUT.height / scale };
    if (ios) {
      return captureRef(ref, { format: 'jpg', quality: OUTPUT.quality, ...size, result: 'tmpfile' });
    }
    const base64 = await captureRef(ref, { format: 'jpg', quality: OUTPUT.quality, ...size, result: 'base64' });
    const file = new File(Paths.cache, cardFileName(Date.now()));
    try {
      file.write(base64, { encoding: 'base64' });
    } catch (e) {
      // A half-written card is ours to remove at once: no target has it.
      try {
        if (file.exists) {
          file.delete();
        }
      } catch {
        // Best effort: the sweep or the OS clears the cache anyway.
      }
      throw e;
    }
    return file.uri;
  }
}
