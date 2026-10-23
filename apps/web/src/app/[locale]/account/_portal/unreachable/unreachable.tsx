'use client';

import { useTranslations } from 'next-intl';

import { Notice } from '../notice';
import type { UnreachableProps } from './unreachable.constants';

/** The API didn't answer: say the phone is fine, offer a retry. */
export function Unreachable({ onRetry, retrying = false }: UnreachableProps) {
  const t = useTranslations('portal');
  return (
    <Notice tone='warning' title={t('unreachable.title')}>
      <p>{t('unreachable.body')}</p>
      <button className='portal-button portal-button-secondary' type='button' onClick={onRetry} disabled={retrying}>
        {t('common.retry')}
      </button>
    </Notice>
  );
}
