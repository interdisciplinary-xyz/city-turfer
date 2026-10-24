import type { Locale } from '@/i18n/routing';

import type { ActivityView } from '../activity-page/activity-page.constants';

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
