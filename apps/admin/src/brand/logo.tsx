import { NAME } from '@cityturfer/brand';
import wordmark from '@cityturfer/brand/svg/wordmark.svg';
import wordmarkLight from '@cityturfer/brand/svg/wordmark-light.svg';
import Image from 'next/image';

/** Login page logo (admin.components.graphics.Logo): the wordmark for light or dark, as Payload's theme. */
export function Logo() {
  return (
    <>
      <Image className='ct-logo--light' src={wordmarkLight} alt={NAME} width={240} height={42} priority />
      <Image className='ct-logo--dark' src={wordmark} alt={NAME} width={240} height={42} priority />
    </>
  );
}
