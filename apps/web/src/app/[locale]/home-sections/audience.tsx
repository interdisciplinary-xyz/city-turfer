import { useTranslations } from 'next-intl';

import { HOME_TYPES, TYPE_CLASS, TYPE_GLYPH } from './home-sections.constants';

/** Who it's for, in the three type colours, and plainly who it isn't for. */
export function Audience() {
  const t = useTranslations('home.audience');
  const tt = useTranslations('home.types');
  return (
    <section className='home-section' aria-labelledby='audience-title'>
      <div className='wrap'>
        <p className='home-eyebrow'>{t('eyebrow')}</p>
        <h2 id='audience-title' className='home-title'>
          {t('title')}
        </h2>
        <ul className='home-grid home-grid-3'>
          {HOME_TYPES.map((type) => (
            <li key={type} className={`app-card home-type home-type-${TYPE_CLASS[type]}`}>
              <span className={`app-badge app-badge-${TYPE_CLASS[type]}`} aria-hidden='true'>
                {TYPE_GLYPH[type]}
              </span>
              <h3 className='app-card-title'>{tt(type)}</h3>
              <p className='home-step-body'>{t(type)}</p>
            </li>
          ))}
        </ul>
        <p className='home-lede home-not-for'>{t('notFor')}</p>
      </div>
    </section>
  );
}
