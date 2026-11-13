import type { PickedPhoto } from '../index';

export type SharePromptCardProps = {
  userId: string | null;
  /** The screen was opened straight from Finish (`justFinished=1`), never from History. */
  justFinished: boolean;
  onPicked: (photo: PickedPhoto) => void;
};
