import type { AnchorHTMLAttributes, ImgHTMLAttributes } from 'react';

export type NextImageShimProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src: string | { src: string };
  alt: string;
  priority?: boolean;
};

export type LinkShimProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string;
  locale?: string;
};
