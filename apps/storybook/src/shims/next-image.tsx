import type { NextImageShimProps } from './shims.constants';

/**
 * Stand-in for `next/image` in Storybook (Vite, no Next image pipeline): a plain <img>. Static
 * imports arrive as URL strings from Vite, or `{ src }` objects in Next's shape. `priority` maps to
 * `fetchPriority`, as Next does.
 */
export default function Image({ src, priority, alt, ...rest }: NextImageShimProps) {
  const url = typeof src === 'string' ? src : src.src;
  return <img src={url} alt={alt} fetchPriority={priority ? 'high' : undefined} {...rest} />;
}
