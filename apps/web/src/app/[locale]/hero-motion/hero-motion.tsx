'use client';

import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useRef } from 'react';

// Deep import on purpose: the folder's index also exports PageLoader, which would pull next/image
// into this client component.
import { PAGE_LOADED_CLASS, PAGE_LOADED_EVENT } from '../page-loader/page-loader.constants';
import { EASE, type HeroMotionProps, MAP_DRIFT_PX } from './hero-motion.constants';

gsap.registerPlugin(useGSAP);

/**
 * Entrance and ambient motion for the hero (`web-motion` skill):
 * - entrance: badge and headline lines → lede → buttons, phones rise alongside;
 * - the city map behind the hero fades in after the headline;
 * - on desktop with a mouse, the phones tilt a little towards the pointer and the map drifts away
 *   from it.
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
          const play = () => {
            tl.play();
          };
          if (html.classList.contains(PAGE_LOADED_CLASS)) {
            play();
          } else {
            window.addEventListener(PAGE_LOADED_EVENT, play, { once: true });
          }
          tl.fromTo(
            '[data-anim="line"]',
            { autoAlpha: 0, y: '0.45em' },
            { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.12 }
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
            )
            // The city's streets glow in behind everything, slowly, once the headline is up.
            .fromTo('[data-anim="map"]', { autoAlpha: 0, scale: 1.04 }, { autoAlpha: 1, scale: 1, duration: 1.2 }, 0.6);
          html.classList.add('motion-ready');

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
          // The map drifts a few pixels the other way, slower: depth behind the phones.
          const map = root.current.querySelector<HTMLElement>('[data-anim="map"]');
          const mapX = map ? gsap.quickTo(map, 'x', { duration: 1.6, ease: 'power3.out' }) : null;
          const mapY = map ? gsap.quickTo(map, 'y', { duration: 1.6, ease: 'power3.out' }) : null;
          const onMove = contextSafe!((e: PointerEvent) => {
            const nx = e.clientX / window.innerWidth - 0.5;
            const ny = e.clientY / window.innerHeight - 0.5;
            toY(nx * 8);
            toX(-ny * 6);
            mapX?.(-nx * MAP_DRIFT_PX);
            mapY?.(-ny * MAP_DRIFT_PX);
          });
          const onLeave = contextSafe!(() => {
            toY(0);
            toX(0);
            mapX?.(0);
            mapY?.(0);
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
