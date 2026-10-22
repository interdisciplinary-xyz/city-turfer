import { NAME } from '@cityturfer/brand';
import wordmark from '@cityturfer/brand/svg/wordmark.svg';
import wordmarkLight from '@cityturfer/brand/svg/wordmark-light.svg';
import Image from 'next/image';

import { LOGO_WIDTH } from './logo.constants';

const heightOf = (svg: { width: number; height: number }) => Math.round((LOGO_WIDTH * svg.height) / svg.width);

/** Login page logo (admin.components.graphics.Logo): the wordmark for light or dark, as Payload's theme. */
export function Logo() {
  return (
    <>
      <Image
        className='ct-logo--light'
        src={wordmarkLight}
        alt={NAME}
        width={LOGO_WIDTH}
        height={heightOf(wordmarkLight)}
      />
      <Image className='ct-logo--dark' src={wordmark} alt={NAME} width={LOGO_WIDTH} height={heightOf(wordmark)} />
    </>
  );
}
