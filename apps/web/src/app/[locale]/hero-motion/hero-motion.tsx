'use client';

import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useRef } from 'react';

// Deep import on purpose: the folder's index also exports PageLoader, which would pull next/image
// into this client component.
import { PAGE_LOADED_CLASS, PAGE_LOADED_EVENT } from '../page-loader/page-loader.constants';
import { EASE, type HeroMotionProps } from './hero-motion.constants';

gsap.registerPlugin(useGSAP);

/**
 * Entrance and ambient motion for the hero (`web-motion` skill):
 * - entrance: mark → wordmark → headline lines → lede → calls to action, phones rise alongside;
 * - the headline's ramp shimmers slowly;
 * - on desktop with a mouse, the phones tilt a little towards the pointer.
 * Only transform/opacity are animated (no layout shift). Reduced motion: everything is shown,
 * nothing moves. Elements opt in with `data-anim`.
 */
export function HeroMotion({ className, children }: HeroMotionProps) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    (_context, contextSafe) => {
      const html = document.documentElement;
      const mm = gsap.matchMedia();

      mm.add(
        {
          animate: '(prefers-reduced-motion: no-preference)',
          tilt: '(prefers-reduced-motion: no-preference) and (pointer: fine) and (min-width: 960px)',
        },
        (ctx) => {
          const { animate, tilt } = ctx.conditions ?? {};
          if (!animate) {
            gsap.set('[data-anim]', { autoAlpha: 1 });
            return;
          }

          // Paused until the page loader fades out, so the entrance is not played underneath it.
          const tl = gsap.timeline({ paused: true, defaults: { ease: EASE } });
          const rampTween = gsap.to('.ramp-text', {
            backgroundPosition: '100% 50%',
            duration: 6,
            ease: 'sine.inOut',
            repeat: -1,
            yoyo: true,
            paused: true,
          });
          const play = () => {
            tl.play();
            rampTween.play();
          };
          if (html.classList.contains(PAGE_LOADED_CLASS)) {
            play();
          } else {
            window.addEventListener(PAGE_LOADED_EVENT, play, { once: true });
          }
          tl.fromTo('[data-anim="mark"]', { autoAlpha: 0, scale: 0.7 }, { autoAlpha: 1, scale: 1, duration: 1 })
            .fromTo('[data-anim="wordmark"]', { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.7 }, '-=0.7')
            .fromTo(
              '[data-anim="line"]',
              { autoAlpha: 0, y: '0.45em' },
              { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.12 },
              '-=0.5'
            )
            .fromTo(
              '[data-anim="copy"]',
              { autoAlpha: 0, y: 16 },
              { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.08 },
              '-=0.5'
            )
            .fromTo(
              '[data-anim="phone"]',
              { autoAlpha: 0, y: 70, rotate: (i: number) => (i ? 4 : -4) },
              { autoAlpha: 1, y: 0, rotate: 0, duration: 1.2, stagger: 0.15 },
              0.25
            );
          html.classList.add('motion-ready');

          // The ramp in the headline drifts slowly, like turf glowing (rampTween, started with the entrance).

          const stopWaiting = () => window.removeEventListener(PAGE_LOADED_EVENT, play);
          if (!tilt || !root.current) {
            return stopWaiting;
          }
          const screens = root.current.querySelector<HTMLElement>('[data-anim-group="screens"]');
          if (!screens) {
            return stopWaiting;
          }
          gsap.set(screens, { transformPerspective: 1200 });
          const toY = gsap.quickTo(screens, 'rotationY', { duration: 0.8, ease: 'power3.out' });
          const toX = gsap.quickTo(screens, 'rotationX', { duration: 0.8, ease: 'power3.out' });
          const onMove = contextSafe!((e: PointerEvent) => {
            const nx = e.clientX / window.innerWidth - 0.5;
            const ny = e.clientY / window.innerHeight - 0.5;
            toY(nx * 8);
            toX(-ny * 6);
          });
          const onLeave = contextSafe!(() => {
            toY(0);
            toX(0);
          });
          window.addEventListener('pointermove', onMove);
          document.addEventListener('pointerleave', onLeave);
          return () => {
            stopWaiting();
            window.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerleave', onLeave);
          };
        }
      );

      return () => {
        mm.revert();
        html.classList.remove('motion-ready');
      };
    },
    { scope: root }
  );

  return (
    <div ref={root} className={className}>
      {children}
    </div>
  );
}
