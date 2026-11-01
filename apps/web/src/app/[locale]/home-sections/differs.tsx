import { useTranslations } from 'next-intl';

import { DIFFERS } from './home-sections.constants';
import { Section, SectionHead } from './section';

/** How it differs, calmly: three facts, no competitor names. */
export function Differs() {
  const t = useTranslations('home.differs');
  return (
    <Section name='different'>
      <SectionHead name='different' eyebrow={t('eyebrow')} title={t('title')} />
      <dl className='home-grid home-grid-3 home-differs'>
        {DIFFERS.map((key) => (
          <div key={key} className='home-differ'>
            <dt className='app-card-title'>{t(`${key}.title`)}</dt>
            <dd className='home-step-body'>{t(`${key}.body`)}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}
