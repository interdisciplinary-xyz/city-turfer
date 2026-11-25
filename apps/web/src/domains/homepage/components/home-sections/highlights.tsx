import { useTranslations } from 'next-intl';

import { Icon } from '@/domains/homepage/components/icons';
import { TURF_DEMO } from '@/domains/homepage/components/turf-demo/turf-demo.constants';

import { HIGHLIGHTS } from './home-sections.constants';
import { Section, SectionHead } from './section';

/** What the app does today, one tile per feature; iPhone-only and not-yet-device-tested features carry a tag. */
export function Highlights() {
  const t = useTranslations('home.highlights');
  return (
    <Section name='app' band>
      <SectionHead name='app' eyebrow={t('eyebrow')} title={t('title')} lede={t('lede')} />
      <ul className='home-grid home-grid-highlights'>
        {HIGHLIGHTS.map(({ key, icon, tag }) => (
          <li key={key} className={`app-card home-highlight home-highlight-${key}`} data-reveal=''>
            <span className='icon-disc'>
              <Icon name={icon} size={24} />
            </span>
            <h3 className='app-card-title'>{t(`${key}.title`)}</h3>
            <p className='home-step-body'>{t(`${key}.body`, { count: TURF_DEMO.achievements })}</p>
            {tag ? <span className='home-tag'>{t(tag)}</span> : null}
          </li>
        ))}
      </ul>
    </Section>
  );
}
