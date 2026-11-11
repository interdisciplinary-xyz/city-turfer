import type { PickedPhoto } from '../index';

export type SharePhotoButtonProps = {
  /** A photo was taken or picked: open the share screen with it. */
  onPicked: (photo: PickedPhoto) => void;
};
