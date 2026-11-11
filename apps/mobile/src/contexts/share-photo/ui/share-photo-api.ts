/*
 * Share Photo's wiring (app-wide, no user database): camera / photo picker, card capture, share
 * sheet, temp files and the per-user Don't ask again flag. Lives here, loaded by the UI only, not in
 * composition-root.ts: the headless background task imports the composition root and must never
 * load expo-image-picker, react-native-view-shot, expo-sharing or expo-file-system (arch rule
 * `background-task-no-share-natives`). Component tests replace this module with fakes.
 */
import { createSharePhotoApi } from '../index';
import { ExpoPhotoSource } from '../infrastructure/expo-photo-source';
import { ExpoShareTarget } from '../infrastructure/expo-share-target';
import { ExpoTempFiles } from '../infrastructure/expo-temp-files';
import { SecureStoreSharePromptFlag } from '../infrastructure/secure-store-share-prompt-flag';
import { ViewShotCardRenderer } from '../infrastructure/view-shot-card-renderer';

export const sharePhoto = createSharePhotoApi({
  photos: new ExpoPhotoSource(),
  renderer: new ViewShotCardRenderer(),
  share: new ExpoShareTarget(),
  files: new ExpoTempFiles(),
  prompt: new SecureStoreSharePromptFlag(),
});
