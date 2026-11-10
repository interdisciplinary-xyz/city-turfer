import { useTranslations } from 'next-intl';
import { useId } from 'react';

import { STORED_ITEMS } from './what-we-store.constants';

/** What the server holds, in plain words (routes usually start at home: it says so). */
export function WhatWeStore() {
  const t = useTranslations('portal.privacy.stored');
  const id = useId();
  return (
    <section className='portal-card' aria-labelledby={id}>
      <h2 id={id} className='portal-card-title'>
        {t('title')}
      </h2>
      <ul className='portal-list'>
        {STORED_ITEMS.map((item) => (
          <li key={item}>{t(item)}</li>
        ))}
      </ul>
    </section>
  );
}
