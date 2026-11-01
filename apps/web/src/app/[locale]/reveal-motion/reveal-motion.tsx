'use client';

import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { EASE } from '../hero-motion/hero-motion.constants';
import { REVEAL_INTERVAL, REVEAL_RISE, REVEAL_SELECTOR, REVEAL_STAGGER, REVEAL_START } from './reveal-motion.constants';

gsap.registerPlugin(useGSAP, ScrollTrigger);

/**
 * Scroll-in for the section heads and cards (`web-motion` skill): each `[data-reveal]` rises a little and
 * fades in once, the first time it nears the viewport, in small batches. Renders nothing. CSS hides the
 * elements only while `<html>` has the `motion` class (the boot script sets it unless reduced motion is
 * on, and removes it after 2.5 s if the hero's script never ran), so a slow or missing script, reduced
 * motion and no JavaScript all leave everything visible. Elements already in view on load come in at
 * once. Only opacity and transform move. Reverted on unmount.
 */
export function RevealMotion() {
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      ScrollTrigger.batch(REVEAL_SELECTOR, {
        start: REVEAL_START,
        once: true,
        interval: REVEAL_INTERVAL,
        onEnter: (elements) =>
          gsap.fromTo(
            elements,
            { autoAlpha: 0, y: REVEAL_RISE },
            { autoAlpha: 1, y: 0, duration: 0.9, ease: EASE, stagger: REVEAL_STAGGER, overwrite: true }
          ),
      });
      // The page can reflow after the fonts arrive: measure again once everything is laid out.
      ScrollTrigger.refresh();
    });
    return () => mm.revert();
  }, []);
  return null;
}
