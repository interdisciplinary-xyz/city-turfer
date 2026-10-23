import type { ReactNode } from 'react';

export type NoticeProps = {
  /** `info`: an empty state or a calm fact; `warning`: something didn't work. */
  tone?: 'info' | 'warning';
  title?: string;
  children: ReactNode;
  /** `status` for messages that appear after an action, so screen readers hear them. */
  role?: 'status';
};
