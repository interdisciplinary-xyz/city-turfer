import type {
  CardFiles,
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
  cards: CardFiles;
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
 * Share: sweep old cards, render the card to a JPEG and hand it to the share sheet. The card is
 * deleted when the sheet has closed where that means the target has it (`CardFiles.deleteAfterShare`),
 * otherwise left for a later sweep; on every failure it is deleted at once (no target has it). The
 * output is a fresh render, so the photo's EXIF never travels.
 */
export class ShareCard {
  constructor(private readonly d: SharePhotoDeps) {}
  async execute(target: CardTarget): Promise<ShareCardResult> {
    await this.d.cards.sweep().catch(() => undefined);
    let uri: string;
    try {
      uri = await this.d.renderer.render(target);
    } catch {
      return { kind: 'render-failed' };
    }
    let shared = false;
    try {
      if (!(await this.d.share.isAvailable())) {
        return { kind: 'share-failed' };
      }
      await this.d.share.share(uri);
      shared = true;
      return { kind: 'shared' };
    } catch {
      return { kind: 'share-failed' };
    } finally {
      if (!shared || this.d.cards.deleteAfterShare) {
        await this.d.files.delete(uri);
      }
    }
  }
}

/**
 * Delete cards kept from earlier shares that no target still reads: at app launch, on each return to
 * the foreground and when the share screen opens.
 */
export class SweepCards {
  constructor(private readonly d: SharePhotoDeps) {}
  execute(): Promise<void> {
    return this.d.cards.sweep().catch(() => undefined);
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
