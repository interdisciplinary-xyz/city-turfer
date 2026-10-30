import { useTranslations } from 'next-intl';

import { DIFFERS } from './home-sections.constants';

/** How it differs, calmly: three facts, no competitor names. */
export function Differs() {
  const t = useTranslations('home.differs');
  return (
    <section className='home-section' aria-labelledby='differs-title'>
      <div className='wrap'>
        <p className='home-eyebrow'>{t('eyebrow')}</p>
        <h2 id='differs-title' className='home-title'>
          {t('title')}
        </h2>
        <dl className='home-grid home-grid-3 home-differs'>
          {DIFFERS.map((key) => (
            <div key={key} className='home-differ'>
              <dt className='app-card-title'>{t(`${key}.title`)}</dt>
              <dd className='home-step-body'>{t(`${key}.body`)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
