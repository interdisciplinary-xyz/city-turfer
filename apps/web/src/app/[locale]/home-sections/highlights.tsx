import { useTranslations } from 'next-intl';

import { Icon } from '../icons';
import { TURF_DEMO } from '../turf-demo/turf-demo.constants';
import { HIGHLIGHTS } from './home-sections.constants';
import { Section, SectionHead } from './section';
import { WhereItStands } from './where-it-stands';

/** What the prototype does today, one tile per feature; iPhone-only features say so. */
export function Highlights() {
  const t = useTranslations('home.highlights');
  return (
    <Section name='app'>
      <SectionHead name='app' eyebrow={t('eyebrow')} title={t('title')} lede={t('lede')} />
      <ul className='home-grid home-grid-highlights'>
        {HIGHLIGHTS.map(({ key, icon, iphone }) => (
          <li key={key} className={`app-card home-highlight home-highlight-${key}`} data-reveal=''>
            <span className='icon-disc'>
              <Icon name={icon} size={24} />
            </span>
            <h3 className='app-card-title'>{t(`${key}.title`)}</h3>
            <p className='home-step-body'>{t(`${key}.body`, { count: TURF_DEMO.achievements })}</p>
            {iphone ? <span className='home-tag'>{t('iphone')}</span> : null}
          </li>
        ))}
      </ul>
      <WhereItStands />
    </Section>
  );
}
