import * as ImagePicker from 'expo-image-picker';

import type { PhotoPick, PhotoSource } from '../domain/ports';

/** Recompressed on pick: a 48 MP original is slow to lay out; the card is 1080 × 1920 anyway. */
const QUALITY = 0.8;

const OPTIONS: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: QUALITY, exif: false };

function toPick(r: ImagePicker.ImagePickerResult): PhotoPick {
  const a = r.canceled ? null : r.assets[0];
  return a ? { uri: a.uri, width: a.width, height: a.height } : 'cancelled';
}

/**
 * ACL over expo-image-picker. The library goes through the system picker (PHPicker, Android Photo
 * Picker): no photo-library permission. The camera asks for its permission on first use only.
 */
export class ExpoPhotoSource implements PhotoSource {
  async takePhoto(): Promise<PhotoPick> {
    const current = await ImagePicker.getCameraPermissionsAsync();
    const permission =
      current.granted || !current.canAskAgain ? current : await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      return 'denied';
    }
    return toPick(await ImagePicker.launchCameraAsync(OPTIONS));
  }

  async pickPhoto(): Promise<PhotoPick> {
    return toPick(await ImagePicker.launchImageLibraryAsync(OPTIONS));
  }
}
