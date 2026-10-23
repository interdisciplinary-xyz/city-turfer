import type { LinkShimProps } from './shims.constants';

/**
 * Stand-in for apps/web's `@/i18n/navigation` (next-intl's Link needs the Next router). Renders
 * the same anchor the static export does: `/<locale><href>`. Clicks stay inside the story.
 */
export function Link({ href, locale, children, ...props }: LinkShimProps) {
  // `prefetch` is next/link's switch, not an <a> attribute.
  const rest = { ...props };
  delete rest.prefetch;
  const path = `/${locale ?? 'en'}${href === '/' ? '' : href}`;
  return (
    <a href={path} onClick={(e) => e.preventDefault()} {...rest}>
      {children}
    </a>
  );
}
