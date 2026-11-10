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

/**
 * The one heading of every homepage section below the hero: the plain name (eyebrow), the claim and an
 * optional lede, always centred and alike everywhere. The hero has its own heading (HeroCopy).
 * A block inside a section (the street demo) uses it as an h3 with its own id.
 */
export function SectionHead({ name, eyebrow, title, lede, level = 2, titleId }: SectionHeadProps) {
  const Title = level === 3 ? 'h3' : 'h2';
  return (
    <div className='section-head' data-reveal=''>
      <p className='section-eyebrow'>{eyebrow}</p>
      <Title id={titleId ?? `${name}-title`} className='section-title'>
        {title}
      </Title>
      {lede ? <p className='section-lede'>{lede}</p> : null}
    </div>
  );
}
