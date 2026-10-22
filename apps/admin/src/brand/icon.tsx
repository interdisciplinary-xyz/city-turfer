import mark from '@cityturfer/brand/svg/mark.svg';
import Image from 'next/image';

/** Navigation icon (admin.components.graphics.Icon): the brand mark, rounded like the website's. */
export function Icon() {
  return <Image className='ct-mark' src={mark} alt='' width={24} height={24} />;
}
