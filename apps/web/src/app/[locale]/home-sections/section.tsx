import './home-sections.css';

import type { SectionHeadProps, SectionProps } from './home-sections.constants';

/** One homepage section: `<section id=name aria-labelledby=name-title>`, with its `.wrap` inside. */
export function Section({ name, className, band, wrapClassName, children }: SectionProps) {
  return (
    <section
      id={name === 'cta' ? undefined : name}
      aria-labelledby={`${name}-title`}
      className={['home-section', band ? 'home-section-band' : '', className ?? ''].filter(Boolean).join(' ')}
    >
      <div className={wrapClassName ? `wrap ${wrapClassName}` : 'wrap'}>{children}</div>
    </section>
  );
}

/** The same heading in every section: the plain name (eyebrow), the claim (h2) and an optional lede. */
export function SectionHead({ name, eyebrow, title, lede, align = 'start' }: SectionHeadProps) {
  return (
    <div className={align === 'center' ? 'section-head section-head-center' : 'section-head'} data-reveal=''>
      <p className='section-eyebrow'>{eyebrow}</p>
      <h2 id={`${name}-title`} className='section-title'>
        {title}
      </h2>
      {lede ? <p className='section-lede'>{lede}</p> : null}
    </div>
  );
}
