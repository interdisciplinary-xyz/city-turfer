import { useTranslations } from 'next-intl';

import { STATUS_COLUMNS } from './home-sections.constants';
import { Section, SectionHead } from './section';

/** Where it stands: works today, being tested, not yet (STATUS_COLUMNS, updated per release). */
export function WhereItStands() {
  const t = useTranslations('home.status');
  return (
    <Section name='status'>
      <SectionHead name='status' eyebrow={t('eyebrow')} title={t('title')} lede={t('body')} />
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
    </Section>
  );
}
