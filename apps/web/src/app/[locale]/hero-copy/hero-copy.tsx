import { NAME } from '@cityturfer/brand';
import mark from '@cityturfer/brand/svg/mark.svg';
import wordmark from '@cityturfer/brand/svg/wordmark-light.svg';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

/** Mark and wordmark in one row, then tagline and lede; the `data-anim` hooks are driven by HeroMotion. */
export function HeroCopy() {
  const t = useTranslations('hero');
  return (
    <div className='hero-copy'>
      <div className='hero-brand'>
        <Image className='mark' data-anim='mark' src={mark} alt='' priority width={132} height={132} />
        <Image className='wordmark' data-anim='wordmark' src={wordmark} alt={NAME} priority width={320} height={71} />
      </div>
      <h1>
        <span className='line' data-anim='line'>
          {t('taglineLead')}
        </span>{' '}
        <span className='line' data-anim='line'>
          {t('taglineRamp')}
        </span>
      </h1>
      <p className='lede' data-anim='copy'>
        {t('lede')}
      </p>
    </div>
  );
}
