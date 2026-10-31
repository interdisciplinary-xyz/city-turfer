import { useTranslations } from 'next-intl';

import { STATUS_COLUMNS } from './home-sections.constants';

/** Where it stands: works today, being tested, not yet (STATUS_COLUMNS, updated per release). */
export function WhereItStands() {
  const t = useTranslations('home.status');
  return (
    <section className='home-section' aria-labelledby='status-title'>
      <div className='wrap'>
        <p className='home-eyebrow'>{t('eyebrow')}</p>
        <h2 id='status-title' className='home-title'>
          {t('title')}
        </h2>
        <p className='home-lede'>{t('body')}</p>
        <div className='home-grid home-grid-3'>
          {STATUS_COLUMNS.map((column) => (
            <div key={column.key} className={`app-card home-status home-status-${column.key}`}>
              <h3 className='app-card-title'>{t(`${column.key}.title`)}</h3>
              <ul className='home-points'>
                {column.items.map((item) => (
                  <li key={item}>{t(`${column.key}.${item}`)}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
