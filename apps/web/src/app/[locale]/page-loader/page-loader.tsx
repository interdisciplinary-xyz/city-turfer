import mark from '@cityturfer/brand/svg/mark.svg';
import Image from 'next/image';

/**
 * Full-page overlay, visible from the first paint, that fades out once the page and fonts have
 * loaded (LOADER_BOOT_SCRIPT). Decorative: hidden from screen readers, which read the page
 * underneath straight away.
 */
export function PageLoader() {
  return (
    <div className='page-loader' aria-hidden='true'>
      <Image className='page-loader-mark' src={mark} alt='' priority width={72} height={72} />
    </div>
  );
}
