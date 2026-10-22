'use client';

import { useEffect, useRef } from 'react';

import { LOCKUP_SELECTOR, SCROLLED_ATTRIBUTE, type ScrollStateProps } from './scroll-state.constants';

/**
 * Sets `data-scrolled` on the enclosing header once the page's lockup (its own big logo) has
 * scrolled past the top of the viewport; on a page without one, at once. Renders nothing; the
 * header itself stays a server component.
 */
export function ScrollState({ lockupSelector = LOCKUP_SELECTOR }: ScrollStateProps) {
  const anchor = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const header = anchor.current?.closest('header');
    if (!header) {
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
    const watch = () => {
      const lockup = document.querySelector(lockupSelector);
      if (lockup) {
        observer.observe(lockup);
      } else {
        header.setAttribute(SCROLLED_ATTRIBUTE, '');
      }
    };
    // On the dev pages the header renders before the rest of the body is parsed.
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', watch, { once: true });
    } else {
      watch();
    }
    return () => {
      document.removeEventListener('DOMContentLoaded', watch);
      observer.disconnect();
    };
  }, [lockupSelector]);

  return <span ref={anchor} hidden />;
}
