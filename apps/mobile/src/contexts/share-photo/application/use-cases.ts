import type {
  CardRenderer,
  CardTarget,
  PhotoPick,
  PhotoSource,
  SharePromptFlag,
  ShareTarget,
  TempFiles,
} from '../domain/ports';

export interface SharePhotoDeps {
  photos: PhotoSource;
  renderer: CardRenderer;
  share: ShareTarget;
  files: TempFiles;
  prompt: SharePromptFlag;
}

export type PhotoSourceKind = 'camera' | 'library';

/** Take or pick a photo. A picker error counts as a cancel: nothing to show, nothing kept. */
export class PickPhoto {
  constructor(private readonly d: SharePhotoDeps) {}
  async execute(source: PhotoSourceKind): Promise<PhotoPick> {
    try {
      return await (source === 'camera' ? this.d.photos.takePhoto() : this.d.photos.pickPhoto());
    } catch {
      return 'cancelled';
    }
  }
}

export type ShareCardResult = { kind: 'shared' } | { kind: 'render-failed' } | { kind: 'share-failed' };

/**
 * Share: render the card to a JPEG, hand it to the share sheet, and delete the file once the sheet
 * has closed (or failed). The output is a fresh render, so the photo's EXIF never travels.
 */
export class ShareCard {
  constructor(private readonly d: SharePhotoDeps) {}
  async execute(target: CardTarget): Promise<ShareCardResult> {
    let uri: string;
    try {
      uri = await this.d.renderer.render(target);
    } catch {
      return { kind: 'render-failed' };
    }
    try {
      if (!(await this.d.share.isAvailable())) {
        return { kind: 'share-failed' };
      }
      await this.d.share.share(uri);
      return { kind: 'shared' };
    } catch {
      return { kind: 'share-failed' };
    } finally {
      await this.d.files.delete(uri);
    }
  }
}

/** The picked photo is no longer needed (changed, or the screen closed): delete our copy. */
export class DiscardPhoto {
  constructor(private readonly d: SharePhotoDeps) {}
  execute(uri: string): Promise<void> {
    return this.d.files.delete(uri);
  }
}

/** Don't ask again: the after-Finish prompt, per user (the Share photo button stays). */
export class SharePromptSetting {
  constructor(private readonly d: SharePhotoDeps) {}
  /** Unknown (keychain error) reads as off: never nag on a broken read. */
  isOff(userId: string): Promise<boolean> {
    return this.d.prompt.isOff(userId).catch(() => true);
  }
  turnOff(userId: string): Promise<void> {
    return this.d.prompt.turnOff(userId).catch(() => undefined);
  }
}
