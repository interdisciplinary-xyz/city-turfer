import { ACTIVITY_NAME_MAX_LENGTH } from '@cityturfer/core/activity-log';

export type RenameActivityDialogProps = {
  visible: boolean;
  /** The current name: the field starts with it. */
  name: string;
  onClose: () => void;
  /** Saves through RenameActivity (Cloud Backup then sends the new name). */
  onSave: (name: string) => Promise<void>;
};

export const RENAME_ACTION = 'Rename';
export const RENAME_TITLE = 'Rename activity';
export const RENAME_LABEL = 'Activity name';
export const RENAME_SAVE = 'Save';
export const RENAME_CANCEL = 'Cancel';
export const RENAME_FAILED = "Couldn't save the new name. Try again.";

/** Why the name can't be saved yet (the domain's rule: 1–80 characters after trimming). */
export const NAME_PROBLEM_TEXT = {
  empty: 'Give it a name.',
  'too-long': `Keep it to ${ACTIVITY_NAME_MAX_LENGTH} characters.`,
} as const;

/** "12/80" under the field. */
export const describeLength = (name: string) => `${name.trim().length}/${ACTIVITY_NAME_MAX_LENGTH}`;
