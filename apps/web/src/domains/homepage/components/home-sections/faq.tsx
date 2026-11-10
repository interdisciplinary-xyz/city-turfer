import { useTranslations } from 'next-intl';

import { FAQ_KEYS } from './home-sections.constants';
import { Section, SectionHead } from './section';

/**
 * Questions as native disclosure widgets (no script), plus FAQPage structured data built from the
 * same messages, so what search engines read is exactly what the page shows.
 */
export function Faq() {
  const t = useTranslations('home.faq');
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_KEYS.map((key) => ({
      '@type': 'Question',
      name: t(`${key}.q`),
      acceptedAnswer: { '@type': 'Answer', text: t(`${key}.a`) },
    })),
  };
  return (
    <Section name='faq'>
      <SectionHead name='faq' eyebrow={t('eyebrow')} title={t('title')} />
      <div className='home-faq'>
        {FAQ_KEYS.map((key) => (
          <details key={key} className='home-faq-item'>
            <summary>{t(`${key}.q`)}</summary>
            <p>{t(`${key}.a`)}</p>
          </details>
        ))}
      </div>
      <script
        type='application/ld+json'
        // JSON.stringify output with "<" escaped, so no message can close the script element.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
    </Section>
  );
}
