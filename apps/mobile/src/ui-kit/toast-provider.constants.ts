import type { ToastVariant } from '@cityturfer/ui';
import type { ReactNode } from 'react';
import type { MessageKeys, NestedKeyOf } from 'use-intl/core';

import type { Messages } from '@/i18n';
import type { ErrorReporter } from '@/platform/error-reporter';

/** Any message in the catalogue as `<namespace>.<key>` ('common.toast.error.generic', 'backup.toast.backedUp'). */
export type MessageKey = MessageKeys<Messages, NestedKeyOf<Messages>>;

/** A message with its ICU values (counts, names), worded in the app language when it shows. */
export type ToastMessage = { key: MessageKey; values?: Record<string, string | number> };

/** A key alone, or a key with values. */
export type MessageRef = MessageKey | ToastMessage;

export type ToastRequest = { variant: ToastVariant; message: MessageRef };

/** A toast in the queue: worded once, when it was asked for. */
export type QueuedToast = { id: number; variant: ToastVariant; text: string };

export type ToastApi = {
  /** Queues a toast; one shows at a time, the same text already waiting is not queued twice. */
  show(request: ToastRequest): void;
  /** Where unexpected errors of user actions go (crash reporting; a no-op when it is off). */
  reporter: ErrorReporter;
};

export type ToastProviderProps = {
  /** The process-wide reporter (`crashReporting.reporter` in the app, a fake in tests). */
  reporter: ErrorReporter;
  children: ReactNode;
};

/** How long a toast stays, in ms: errors longer, they ask the Turfer to do something. */
export const TOAST_MS = { success: 3000, error: 5000 } as const;

/** Fade in and out, in ms (none with Reduce Motion on). */
export const TOAST_FADE_MS = 160;

/** At most this many wait behind the one on screen; older ones give way to newer. */
export const TOAST_QUEUE_MAX = 3;
