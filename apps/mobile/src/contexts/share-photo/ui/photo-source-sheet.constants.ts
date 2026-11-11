import type { PhotoPicker } from './use-photo-picker';

export type PhotoSourceSheetProps = {
  picker: PhotoPicker;
};

/** Scrim behind the sheet, as the rename dialog and the Me drawer. */
export const BACKDROP = 'rgba(0,0,0,0.35)';
