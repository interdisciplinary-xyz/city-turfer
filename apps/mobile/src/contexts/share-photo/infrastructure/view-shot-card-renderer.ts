import { PixelRatio, Platform } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import type { CardRenderer, CardTarget } from '../domain/ports';

/** The story size in pixels and its JPEG quality (docs/plans/share-photo-2026-11-11.md). */
const OUTPUT = { width: 1080, height: 1920, quality: 0.9 } as const;

/**
 * Captures the mounted card view to a JPEG temp file. view-shot reads `width`/`height` as points on
 * iOS (drawn at the screen scale) and as pixels on Android, so iOS gets 1080 px through the pixel ratio.
 */
export class ViewShotCardRenderer implements CardRenderer {
  render(target: CardTarget): Promise<string> {
    const scale = Platform.OS === 'ios' ? PixelRatio.get() : 1;
    return captureRef(target as Parameters<typeof captureRef>[0], {
      format: 'jpg',
      quality: OUTPUT.quality,
      width: OUTPUT.width / scale,
      height: OUTPUT.height / scale,
      result: 'tmpfile',
    });
  }
}
