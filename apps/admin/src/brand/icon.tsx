import mark from '@cityturfer/brand/svg/mark.svg';
import Image from 'next/image';

/** Navigation icon (admin.components.graphics.Icon): the brand mark. */
export function Icon() {
  return <Image src={mark} alt='' width={24} height={24} />;
}
