import mark from '@cityturfer/brand/svg/mark.svg';
import Image from 'next/image';

/**
 * Full-page overlay for slow loads: hidden by default, shown by LOADER_BOOT_SCRIPT only if the page
 * and fonts are still not ready after a short delay, and faded out once they are. Decorative:
 * hidden from screen readers, which read the page underneath straight away (it is not inert).
 */
export function PageLoader() {
  return (
    <div className='page-loader' aria-hidden='true'>
      <Image className='page-loader-mark' src={mark} alt='' priority width={72} height={72} />
    </div>
  );
}
