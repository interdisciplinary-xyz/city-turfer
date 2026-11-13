/** A photo the Turfer took or picked: a local file in the app's cache, never stored. */
export interface PickedPhoto {
  uri: string;
  width: number;
  height: number;
}

export type PhotoPick = PickedPhoto | 'cancelled' | 'denied';

/** Camera or the system photo picker (no library permission). */
export interface PhotoSource {
  /** 'denied': no camera permission (the UI offers Settings and the library). */
  takePhoto(): Promise<PhotoPick>;
  pickPhoto(): Promise<PhotoPick>;
}

/** Whatever the renderer captures (a mounted card view); opaque to the application. */
export type CardTarget = unknown;

/** Renders the composed card to a 1080 × 1920 JPEG temp file; resolves its uri. */
export interface CardRenderer {
  render(target: CardTarget): Promise<string>;
}

/** The system share sheet; resolves when it closes. */
export interface ShareTarget {
  isAvailable(): Promise<boolean>;
  share(uri: string): Promise<void>;
}

/** Deletes temp files we made (never anything outside the app's cache). Never throws. */
export interface TempFiles {
  delete(uri: string): Promise<void>;
}

/**
 * The rendered card files and when they may go. Where the share sheet resolves only after the
 * target has the file (iOS), the card is deleted right after sharing. Where it resolves before the
 * target has read it (Android: the chooser returns while Quick Share, Drive or Instagram still read
 * the file), the card stays and a later sweep deletes the cards old enough that no target still
 * needs them.
 */
export interface CardFiles {
  /** Whether a shared card can be deleted as soon as `ShareTarget.share` resolves. */
  readonly deleteAfterShare: boolean;
  /** Deletes our earlier, old card files (only ours, only in the app's cache). Never throws. */
  sweep(): Promise<void>;
}

/** Don't ask again for the after-Finish prompt, per user. */
export interface SharePromptFlag {
  isOff(userId: string): Promise<boolean>;
  turnOff(userId: string): Promise<void>;
  forget(userId: string): Promise<void>;
}
