import type { DailyGoalView } from '../contract';

export type GoalCardProps = {
  view: DailyGoalView;
  /** Open the editor from the offer. */
  onSet: () => void;
  /** Hide the offer for good. */
  onHide: () => void;
  /** Open the editor from the progress card. */
  onChange: () => void;
};

export type GoalEditorProps = {
  /** Saved or turned off: close the editor. */
  onDone: () => void;
};

/** Past midnight by this much before the card rolls over (timers can fire a hair early). */
export const MIDNIGHT_SLACK_MS = 1000;
/** Smallest touch target of the stepper buttons, in points (map-chip rule is 44; this is the main control). */
export const STEPPER_BUTTON_SIZE = 64;
