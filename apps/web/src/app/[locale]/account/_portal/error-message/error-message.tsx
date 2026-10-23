'use client';

import { useTranslations } from 'next-intl';

import { describeWait } from '../format';
import type { ErrorMessageProps } from './error-message.constants';

/**
 * A failed call, in the user's words: the message for the problem `code`, a wait from
 * `Retry-After`, and the request id with the generic message. Never the API's title or detail.
 */
export function ErrorMessage({ error, overrideKey, className, hideWait = false }: ErrorMessageProps) {
  const t = useTranslations('portal');
  const wait = !hideWait && error.retryAfterSeconds !== null ? describeWait(error.retryAfterSeconds) : null;
  return (
    <p className={['portal-error', className].filter(Boolean).join(' ')} role='alert'>
      {t(overrideKey ?? error.messageKey)}
      {wait ? ` ${t(`common.${wait.key}`, { count: wait.count })}` : null}
      {error.code === 'generic' && error.requestId ? (
        <span className='portal-request-id'>{t('common.requestId', { id: error.requestId })}</span>
      ) : null}
    </p>
  );
}
