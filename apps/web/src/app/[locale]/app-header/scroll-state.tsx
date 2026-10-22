'use client';

import { useEffect, useRef } from 'react';

import { LOCKUP_SELECTOR, SCROLLED_ATTRIBUTE } from './scroll-state.constants';

/**
 * Sets `data-scrolled` on the enclosing header once the hero lockup has scrolled past the top of
 * the viewport. Renders nothing; the header itself stays a server component.
 */
export function ScrollState() {
  const anchor = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const header = anchor.current?.closest('header');
    const lockup = document.querySelector(LOCKUP_SELECTOR);
    if (!header || !lockup) {
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      const gone = !entry.isIntersecting && entry.boundingClientRect.bottom < 0;
      if (gone) {
        header.setAttribute(SCROLLED_ATTRIBUTE, '');
      } else {
        header.removeAttribute(SCROLLED_ATTRIBUTE);
      }
    });
    observer.observe(lockup);
    return () => {
      observer.disconnect();
    };
  }, []);

  return <span ref={anchor} hidden />;
}
