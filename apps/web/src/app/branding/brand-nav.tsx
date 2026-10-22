'use client';

import { useEffect, useState } from 'react';

import type { BrandSection } from './page.constants';

/** Sticky section bar for /branding; marks the section in view with aria-current. */
export function BrandNav({ sections }: { sections: readonly BrandSection[] }) {
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            visible.set(e.target.id, e.boundingClientRect.top);
          } else {
            visible.delete(e.target.id);
          }
        }
        // The topmost section still on screen is the one being read.
        const top = sections.find((s) => visible.has(s.id));
        setCurrent(top ? top.id : null);
      },
      // Below the site header (up to 64px) and this bar.
      { rootMargin: '-128px 0px -55% 0px' }
    );
    for (const s of sections) {
      const el = document.getElementById(s.id);
      if (el) {
        observer.observe(el);
      }
    }
    return () => observer.disconnect();
  }, [sections]);

  useEffect(() => {
    if (current) {
      document
        .querySelector(`.brand-nav a[href="#${current}"]`)
        ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [current]);

  return (
    <nav className='brand-nav' aria-label='Sections'>
      <div className='brand-wrap brand-nav-inner'>
        {sections.map((s) => (
          <a key={s.id} href={`#${s.id}`} aria-current={current === s.id ? 'location' : undefined}>
            {s.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
