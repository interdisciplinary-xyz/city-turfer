import { NAME, ON_TIER, PRIVACY_LINE, PROMO, TAGLINE, TIER_COLOR, TYPE_COLOR } from '@cityturfer/brand';
import mark from '@cityturfer/brand/svg/mark.svg';
import wordmark from '@cityturfer/brand/svg/wordmark.svg';
import Image from 'next/image';

import { TIERS } from './page.constants';

export default function Home() {
  const year = new Date().getFullYear();
  return (
    <>
      <a className='skip' href='#main'>
        Skip to content
      </a>
      <header className='hero'>
        <div className='wrap hero-grid'>
          <div className='hero-copy'>
            <Image className='mark' src={mark} alt='' priority width={132} height={132} />
            <Image className='wordmark' src={wordmark} alt={NAME} priority width={320} height={101} />
            <h1>
              Surf your city. <span className='ramp-text'>Own your streets.</span>
            </h1>
            <p className='lede'>{PROMO}</p>
            <p className='pill'>
              <span className='pill-dot' aria-hidden='true' />
              Coming soon to iPhone
            </p>
          </div>
          <div className='screens'>
            <figure className='screen'>
              <div className='phone'>
                <Image
                  src='/screens/turf-map.jpg'
                  alt='The Turf Map: glowing routes across Warsaw, with 3.02 km² of turf, 1530 cells and filters for walk, run and ride.'
                  width={720}
                  height={1565}
                  priority
                />
              </div>
              <figcaption>
                <strong>The Turf Map</strong>
                Every walk, run and ride on one dark map, glowing where you go most.
              </figcaption>
            </figure>
            <figure className='screen'>
              <div className='phone'>
                <Image
                  src='/screens/dashboard.jpg'
                  alt="The Dashboard: this week's distance, time and activities, recent activities and the next achievement."
                  width={720}
                  height={1565}
                  priority
                />
              </div>
              <figcaption>
                <strong>Your week at a glance</strong>
                Distance, time, recent activities and the next achievement within reach.
              </figcaption>
            </figure>
          </div>
        </div>
      </header>

      <main id='main'>
        <section aria-labelledby='how'>
          <div className='wrap'>
            <p className='eyebrow'>How turf works</p>
            <h2 id='how'>Every street you cover becomes yours.</h2>
            <ol className='steps'>
              <li className='step'>
                <span className='step-num' style={{ background: TIER_COLOR.faint, color: ON_TIER.faint }}>
                  1
                </span>
                <h3>Head out</h3>
                <p>Walk, run or ride with your phone in your pocket. Recording keeps going with the screen off.</p>
                <div className='types'>
                  <span className='chip' style={{ color: TYPE_COLOR.walk }}>
                    Walk
                  </span>
                  <span className='chip' style={{ color: TYPE_COLOR.run }}>
                    Run
                  </span>
                  <span className='chip' style={{ color: TYPE_COLOR.cycle }}>
                    Ride
                  </span>
                </div>
              </li>
              <li className='step'>
                <span className='step-num' style={{ background: TIER_COLOR.glowing, color: ON_TIER.glowing }}>
                  2
                </span>
                <h3>Claim your turf</h3>
                <p>
                  The streets you cover turn into a corridor of map cells. They&apos;re yours for good: turf never
                  fades.
                </p>
              </li>
              <li className='step'>
                <span className='step-num' style={{ background: TIER_COLOR.strong, color: ON_TIER.strong }}>
                  3
                </span>
                <h3>Watch it glow</h3>
                <p>Come back to the same streets and their cells glow brighter, from faint to blazing.</p>
                <div className='tiers' aria-label='Turf strength, from first visit to many'>
                  {TIERS.map((t) => (
                    <span key={t.label} className='tier' style={{ background: t.color, color: t.text }}>
                      {t.label}
                    </span>
                  ))}
                </div>
              </li>
            </ol>
          </div>
        </section>

        <section aria-labelledby='privacy'>
          <div className='wrap'>
            <div className='privacy'>
              <p className='eyebrow'>Privacy</p>
              <h2 id='privacy'>{PRIVACY_LINE}</h2>
              <ul>
                <li>Your activities and turf are stored on your phone. There&apos;s no account server.</li>
                <li>No analytics on your location, ever.</li>
                <li>This page sets no cookies and loads no trackers.</li>
              </ul>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className='wrap'>
          <div className='ramp-bar' aria-hidden='true' />
          <p>
            {NAME} · {TAGLINE}
          </p>
          <p>
            Coming soon. © {year} {NAME}
          </p>
        </div>
      </footer>
    </>
  );
}
