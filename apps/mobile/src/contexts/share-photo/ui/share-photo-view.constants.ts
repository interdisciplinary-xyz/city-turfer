import type { PickedPhoto, PlaceChoice, ShareCardActivity, ShareCardPlace } from '../index';

export type SharePhotoViewProps = {
  /** Only the facts the card shows: no track, no coordinates. */
  activity: ShareCardActivity;
  /** New Turf Cells of the activity's Claim; null while unknown. */
  newCells: number | null;
  /** Territory's place of the activity; undefined while loading. */
  place: ShareCardPlace | null | undefined;
  /** The photo picked on the activity screen, if any. */
  photo: PickedPhoto | null;
};

// eslint-disable-next-line @typescript-eslint/no-require-imports -- Metro asset; the app has no *.png type declarations.
export const WORDMARK = require('../../../../assets/brand/out/wordmark.png');

/** Room the controls and header take under and above the preview, so the card fits on one screen. */
export const CONTROLS_HEIGHT = 430;
/** The preview never gets narrower than this (small phones scroll instead). */
export const MIN_PREVIEW_WIDTH = 200;
export const STORY_ASPECT = 9 / 16;

export const PLACE_TEST_ID: Record<PlaceChoice, string> = {
  off: 'share-place-off',
  city: 'share-place-city',
  district: 'share-place-district',
};
export const PLACE_KEY = {
  off: 'screen.placeOff',
  city: 'screen.placeCity',
  district: 'screen.placeDistrict',
} as const;
export const LAYOUT_KEY = { top: 'screen.layoutTop', bottom: 'screen.layoutBottom' } as const;

/** The captured card's width in pixels: laid out at this size, so view-shot never resamples. */
export const CAPTURE_WIDTH_PX = 1080;
/** The captured card sits this far left of the screen: rendered, never seen. */
export const OFFSCREEN_X = -10000;
