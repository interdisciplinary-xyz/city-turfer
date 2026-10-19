'use client';

import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useRef } from 'react';

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

          const tl = gsap.timeline({ defaults: { ease: EASE } });
          tl.fromTo(
            '[data-anim="mark"]',
            { autoAlpha: 0, scale: 0.7, rotate: -10 },
            { autoAlpha: 1, scale: 1, rotate: 0, duration: 1 }
          )
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

          // The ramp in the headline drifts slowly, like turf glowing.
          gsap.to('.ramp-text', {
            backgroundPosition: '100% 50%',
            duration: 6,
            ease: 'sine.inOut',
            repeat: -1,
            yoyo: true,
          });

          if (!tilt || !root.current) {
            return;
          }
          const screens = root.current.querySelector<HTMLElement>('[data-anim-group="screens"]');
          if (!screens) {
            return;
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
