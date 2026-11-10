import type { ActivityView } from '@/domains/activities/components/activity-page/activity-page.constants';
import type { Locale } from '@/i18n/routing';

/** The detail page's states other than the activity itself and the redirects. */
export type ActivityStateView = Extract<
  ActivityView,
  { kind: 'loading' | 'not-found' | 'deleted' | 'unreachable' | 'error' }
>;

export type ActivityStateProps = {
  view: ActivityStateView;
  locale: Locale;
  /** Ask again (unreachable only). */
  onRetry: () => void;
  retrying?: boolean;
};
