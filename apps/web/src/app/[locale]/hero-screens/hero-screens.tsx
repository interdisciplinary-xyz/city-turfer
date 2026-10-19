import Image from 'next/image';
import { useTranslations } from 'next-intl';

import { HERO_SCREENS, SCREEN_HEIGHT, SCREEN_WIDTH } from './hero-screens.constants';

/** The two phone screenshots with captions. */
export function HeroScreens() {
  const t = useTranslations('screens');
  return (
    <div className='screens' data-anim-group='screens'>
      {HERO_SCREENS.map(({ key, src }) => (
        <figure key={key} className='screen' data-anim='phone'>
          <div className='phone'>
            <Image src={src} alt={t(`${key}.alt`)} width={SCREEN_WIDTH} height={SCREEN_HEIGHT} priority />
          </div>
          <figcaption>
            <strong>{t(`${key}.title`)}</strong>
            {t(`${key}.body`)}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
