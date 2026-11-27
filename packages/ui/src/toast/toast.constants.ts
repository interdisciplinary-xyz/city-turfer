/** Success: an action the Turfer started went through. Error: it did not (and nothing else says so). */
export type ToastVariant = 'success' | 'error';

export type ToastProps = {
  variant: ToastVariant;
  /** Already worded in the app language: one or two short sentences. */
  message: string;
  /** Tapping the toast closes it; omitted: it only closes by itself. */
  onDismiss?: () => void;
  /** What a screen reader says the tap does, e.g. "Close" (with `onDismiss`). */
  dismissHint?: string;
  testID?: string;
};

/** The mark beside the message: a check or an exclamation, so the variant never rests on colour alone. */
export const GLYPH: Record<ToastVariant, string> = { success: '✓', error: '!' };

/** The coloured edge on the leading side, in points. */
export const EDGE_WIDTH = 4;

/** The round mark's diameter, in points. */
export const MARK_SIZE = 24;

/** Tap target of a dismissable toast: never shorter than this (`mobile-ui-engineer`: ≥ 44 pt). */
export const MIN_HEIGHT = 48;

/** Toasts never grow past this, so on a tablet they stay a readable line (points). */
export const MAX_WIDTH = 480;
