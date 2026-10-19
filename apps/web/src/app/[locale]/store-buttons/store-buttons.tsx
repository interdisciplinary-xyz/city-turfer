import { useTranslations } from 'next-intl';

import type { StoreButtonsProps } from './store-buttons.constants';

/** Android APK download (when configured) and the App Store placeholder. */
export function StoreButtons({ apkUrl }: StoreButtonsProps) {
  const t = useTranslations('download');
  return (
    <div className='download' data-anim='copy'>
      <div className='store-buttons'>
        {apkUrl ? (
          <a className='store-btn store-btn-android' href={apkUrl} download>
            {t('cta')}
          </a>
        ) : (
          <span className='store-btn store-btn-off' role='link' aria-disabled='true'>
            {t('cta')}
            <span className='store-soon'>{t('soon')}</span>
          </span>
        )}
        <span className='store-btn store-btn-off' role='link' aria-disabled='true'>
          {t('appStore')}
          <span className='store-soon'>{t('soon')}</span>
        </span>
      </div>
      {apkUrl ? (
        <p className='download-note'>
          {t('note')}. {t('help')}
        </p>
      ) : null}
    </div>
  );
}
