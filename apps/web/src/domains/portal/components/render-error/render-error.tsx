'use client';

import { useTranslations } from 'next-intl';

import { Notice } from '@/domains/portal/components/notice';

import type { RenderErrorProps } from './render-error.constants';

/**
 * A portal page that crashed while rendering: the generic error copy and a retry, without the
 * portal frame (the header may be what crashed). Says nothing about the error itself.
 */
export function RenderError({ onRetry }: RenderErrorProps) {
  const t = useTranslations('portal');
  return (
    <div className='portal'>
      <main id='portal-main' className='portal-main' tabIndex={-1}>
        <Notice tone='warning'>
          <p role='alert'>{t('errors.generic')}</p>
          <button className='portal-button portal-button-secondary' type='button' onClick={onRetry}>
            {t('common.retry')}
          </button>
        </Notice>
      </main>
    </div>
  );
}
