import { createPhotoHandoff } from './photo-handoff';
import { sharePhoto } from './share-photo-api';

/** The app's one photo handoff (activity screen → share screen); a dropped photo's cache file is deleted. */
export const pendingPhoto = createPhotoHandoff((photo) => void sharePhoto.discardPhoto.execute(photo.uri));
