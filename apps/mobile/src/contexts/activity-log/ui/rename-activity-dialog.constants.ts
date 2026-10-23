import { ACTIVITY_NAME_MAX_LENGTH } from '@cityturfer/core/activity-log';

export type RenameActivityDialogProps = {
  visible: boolean;
  /** The current name: the field starts with it. */
  name: string;
  onClose: () => void;
  /** Saves through RenameActivity (Cloud Backup then sends the new name). */
  onSave: (name: string) => Promise<void>;
};

/** The `activity` message for each reason the name can't be saved yet (the domain's rule: 1–80 characters after trimming). */
export const NAME_PROBLEM_KEY = {
  empty: 'rename.empty',
  'too-long': 'rename.tooLong',
} as const;

/** "12/80" under the field. */
export const describeLength = (name: string) => `${name.trim().length}/${ACTIVITY_NAME_MAX_LENGTH}`;
