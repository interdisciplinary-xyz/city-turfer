import type { ActivityDetail, Track } from '@/api/schema';
import type { Locale } from '@/i18n/routing';

export type ActivityDetailViewProps = {
  activity: ActivityDetail;
  /** The full track; null while it loads or when it failed (the summary's preview is drawn instead). */
  track: Track | null;
  /** The track couldn't be loaded: say the shape is simplified. */
  trackFailed?: boolean;
  locale: Locale;
  /** The browser's zone (the activity's own is used for its time, H5); a parameter for stories. */
  browserZone?: string;
};
