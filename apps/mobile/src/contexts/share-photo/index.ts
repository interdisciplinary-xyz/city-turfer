// Public API of the Share Photo context: a photo with an activity's stats over it, handed to the
// system share sheet (docs/plans/share-photo-2026-11-11.md). App-only, nothing stored.
import {
  DiscardPhoto,
  PickPhoto,
  ShareCard,
  type SharePhotoDeps,
  SharePromptSetting,
  SweepCards,
} from './application/use-cases';

export function createSharePhotoApi(deps: SharePhotoDeps) {
  return {
    pickPhoto: new PickPhoto(deps),
    share: new ShareCard(deps),
    discardPhoto: new DiscardPhoto(deps),
    sweepCards: new SweepCards(deps),
    prompt: new SharePromptSetting(deps),
  };
}
export type SharePhotoApi = ReturnType<typeof createSharePhotoApi>;
export type { PhotoSourceKind, ShareCardResult, SharePhotoDeps } from './application/use-cases';
export type {
  CardFiles,
  CardRenderer,
  CardTarget,
  PhotoPick,
  PhotoSource,
  PickedPhoto,
  SharePromptFlag,
  ShareTarget,
  TempFiles,
} from './domain/ports';
export type {
  PlaceChoice,
  ShareCardActivity,
  ShareCardContent,
  ShareCardFormat,
  ShareCardOptions,
  ShareCardPlace,
  ShareLayout,
} from './domain/share-card';
export { hasNewTurf, placeChoices, placeLine, shareCardContent } from './domain/share-card';
export { showSharePrompt } from './domain/share-prompt';
