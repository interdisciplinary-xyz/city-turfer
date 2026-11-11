/**
 * The "Share a photo?" card after Finish: only when the activity screen was opened straight from
 * Finish (never from History), while the Turfer hasn't chosen Don't ask again (unknown while the
 * flag loads: not shown, so it never flashes), and until Not now or a choice on this visit.
 */
export function showSharePrompt(s: {
  justFinished: boolean;
  /** Don't ask again was chosen; null while loading. */
  neverAsk: boolean | null;
  /** Not now, Take photo or Choose from library on this visit. */
  handled: boolean;
}): boolean {
  return s.justFinished && s.neverAsk === false && !s.handled;
}
