import { useTranslations } from 'next-intl';

import { HIGHLIGHTS } from './home-sections.constants';

/** What the prototype does today, one tile per feature; iPhone-only features say so. */
export function Highlights() {
  const t = useTranslations('home.highlights');
  return (
    <section className='home-section' aria-labelledby='highlights-title'>
      <div className='wrap'>
        <p className='home-eyebrow'>{t('eyebrow')}</p>
        <h2 id='highlights-title' className='home-title'>
          {t('title')}
        </h2>
        <ul className='home-grid home-grid-highlights'>
          {HIGHLIGHTS.map(({ key, icon, iphone }) => (
            <li key={key} className={`app-card home-highlight home-highlight-${key}`}>
              <span className='home-highlight-icon' aria-hidden='true'>
                {icon}
              </span>
              <h3 className='app-card-title'>{t(`${key}.title`)}</h3>
              <p className='home-step-body'>{t(`${key}.body`)}</p>
              {iphone ? <span className='home-tag'>{t('iphone')}</span> : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
