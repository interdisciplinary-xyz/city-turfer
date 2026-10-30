import type { ReactNode } from 'react';

export type HeroMotionProps = {
  className?: string;
  children: ReactNode;
};

/**
 * Runs in <head> before the first paint: marks the page for the entrance animation unless the
 * visitor asked for reduced motion. CSS then hides `[data-anim]` until GSAP reveals it. If the
 * script bundle never runs, the class is removed after 2.5 s so nothing stays hidden.
 */
export const MOTION_BOOT_SCRIPT = `(()=>{try{if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;var d=document.documentElement;d.classList.add('motion');setTimeout(function(){if(!d.classList.contains('motion-ready'))d.classList.remove('motion')},2500)}catch(e){}})();`;

/** Brand motion: calm and glowing, never bouncy (`web-motion` skill). */
export const EASE = 'expo.out';

/** How far (px, at the window's edge) the hero's city map drifts against the pointer. */
export const MAP_DRIFT_PX = 20;
