'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';

import { CITY_STEP, STEP_MS, type TurfDemoLabels } from './turf-demo-player.constants';

/**
 * Steps the street-glow figure: plays once when it scrolls into view (unless the visitor prefers
 * reduced motion), and the step buttons pick a step by hand. The server renders the last step (the
 * whole city), so without JavaScript or with reduced motion the final frame shows.
 */
export function TurfDemoPlayer({ labels, children }: { labels: TurfDemoLabels; children: ReactNode }) {
  const [step, setStep] = useState<number>(CITY_STEP);
  const root = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  /** Set once the visitor picks a step or replays: autoplay never overrides their choice. */
  const picked = useRef(false);

  const stop = () => {
    window.clearInterval(timer.current);
    timer.current = undefined;
  };

  const play = () => {
    stop();
    setStep(0);
    let next = 0;
    timer.current = window.setInterval(() => {
      next += 1;
      setStep(next);
      if (next >= CITY_STEP) {
        stop();
      }
    }, STEP_MS);
  };

  useEffect(() => {
    const node = root.current;
    if (!node || !window.matchMedia('(prefers-reduced-motion: no-preference)').matches) {
      return stop;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          if (!picked.current) {
            play();
          }
        }
      },
      { threshold: 0.25 }
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      stop();
    };
    // play and stop only touch refs and the state setter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={root} className='turf-demo-player' data-step={step}>
      {children}
      <div className='turf-demo-steps' role='group' aria-label={labels.stepsLabel}>
        {labels.steps.map((label, index) => (
          <button
            key={label}
            type='button'
            className='turf-demo-step'
            data-tier={index}
            aria-pressed={step === index}
            onClick={() => {
              picked.current = true;
              stop();
              setStep(index);
            }}
          >
            {label}
          </button>
        ))}
        <button
          type='button'
          className='turf-demo-replay'
          onClick={() => {
            picked.current = true;
            play();
          }}
        >
          {labels.replay}
        </button>
      </div>
    </div>
  );
}
