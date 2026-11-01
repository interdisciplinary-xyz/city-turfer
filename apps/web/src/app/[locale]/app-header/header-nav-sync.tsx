'use client';

import { useEffect } from 'react';

import {
  CURRENT_VALUE,
  FOOTER_SELECTOR,
  NAV_LINK_SELECTOR,
  READING_BAND_AIR_PX,
  READING_BAND_BOTTOM,
  SECTION_SELECTOR,
} from './header-nav-sync.constants';

/**
 * Marks the header link of the section being read with `aria-current="location"`. Renders nothing:
 * the links are server markup and work without this (plain anchors). One IntersectionObserver, no scroll
 * listener, nothing stored. The current link is the last one whose section starts at or before the
 * section in the reading band, so the hero (before every linked section) clears it, and the page bottom
 * (footer in view) marks the last link.
 */
export function HeaderNavSync() {
  useEffect(() => {
    const links = [...document.querySelectorAll<HTMLAnchorElement>(NAV_LINK_SELECTOR)];
    const sections = [...document.querySelectorAll<HTMLElement>(SECTION_SELECTOR)];
    const footer = document.querySelector(FOOTER_SELECTOR);
    if (links.length === 0 || sections.length === 0 || typeof IntersectionObserver === 'undefined') {
      return;
    }
    const linkOf = new Map<Element, HTMLAnchorElement>();
    for (const link of links) {
      const section = sections.find((candidate) => candidate.id === link.hash.slice(1));
      if (section) {
        linkOf.set(section, link);
      }
    }
    const headerHeight =
      Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 64;
    const inBand = new Set<Element>();
    let atBottom = false;

    const update = () => {
      let current: HTMLAnchorElement | undefined;
      if (atBottom) {
        current = links[links.length - 1];
      } else {
        let from = sections.length - 1;
        while (from >= 0 && !inBand.has(sections[from])) {
          from--;
        }
        for (let i = from; i >= 0 && !current; i--) {
          current = linkOf.get(sections[i]);
        }
      }
      for (const link of links) {
        if (link === current) {
          link.setAttribute('aria-current', CURRENT_VALUE);
        } else {
          link.removeAttribute('aria-current');
        }
      }
    };

    const sectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            inBand.add(entry.target);
          } else {
            inBand.delete(entry.target);
          }
        }
        update();
      },
      { rootMargin: `-${headerHeight + READING_BAND_AIR_PX}px 0px ${READING_BAND_BOTTOM} 0px` }
    );
    for (const section of sections) {
      sectionObserver.observe(section);
    }
    const footerObserver = new IntersectionObserver(
      ([entry]) => {
        atBottom = entry?.isIntersecting ?? false;
        update();
      },
      { threshold: 0.5 }
    );
    if (footer) {
      footerObserver.observe(footer);
    }
    return () => {
      sectionObserver.disconnect();
      footerObserver.disconnect();
      for (const link of links) {
        link.removeAttribute('aria-current');
      }
    };
  }, []);

  return null;
}
