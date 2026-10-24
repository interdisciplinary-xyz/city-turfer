/** The hero lockup whose departure from the viewport turns the header solid. */
export const LOCKUP_SELECTOR = '.hero-brand';

/** The attribute the header's CSS reads. */
export const SCROLLED_ATTRIBUTE = 'data-scrolled';

export type ScrollStateProps = {
  /** The page's lockup; defaults to the hero's. */
  lockupSelector?: string;
};
