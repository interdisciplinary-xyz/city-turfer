import { useTranslations } from 'next-intl';

import { STATUS_COLUMNS } from './home-sections.constants';

/** Where it stands, as a strip under the highlights: being tested, and not yet (STATUS_COLUMNS). */
export function WhereItStands() {
  const t = useTranslations('home.status');
  return (
    <div className='home-status-strip'>
      <h3 className='app-card-title'>{t('title')}</h3>
      <div className='home-status-columns'>
        {STATUS_COLUMNS.map((column) => (
          <div key={column.key} className={`home-status home-status-${column.key}`}>
            <h4 className='app-label'>{t(`${column.key}.title`)}</h4>
            <ul className='home-points'>
              {column.items.map((item) => (
                <li key={item}>{t(`${column.key}.${item}`)}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
