import type { ReactNode } from 'react';

/**
 * Every page lives under `[locale]/`, whose layout renders `<html lang>`. This root layout only
 * passes through (next-intl's static-export pattern); `page.tsx` here redirects `/`.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
