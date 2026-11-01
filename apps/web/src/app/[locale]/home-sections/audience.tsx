import { useTranslations } from 'next-intl';

import { DIFFERS, HOME_TYPES, TYPE_CLASS, TYPE_GLYPH } from './home-sections.constants';
import { Section, SectionHead } from './section';

/**
 * Who it's for, in the three type colours; what makes it different, in two lines; and plainly who
 * it isn't for. (The third difference, privacy, is said once, in Privacy.)
 */
export function Audience() {
  const t = useTranslations('home.audience');
  const tt = useTranslations('home.types');
  const td = useTranslations('home.differs');
  return (
    <Section name='who'>
      <SectionHead name='who' eyebrow={t('eyebrow')} title={t('title')} />
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
      <ul className='home-points home-differs' aria-label={td('label')}>
        {DIFFERS.map((key) => (
          <li key={key}>
            <strong className='app-strong'>{td(`${key}.title`)}.</strong> {td(`${key}.body`)}
          </li>
        ))}
      </ul>
      <p className='home-lede home-not-for'>{t('notFor')}</p>
    </Section>
  );
}
