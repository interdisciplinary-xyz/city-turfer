import type React from 'react';

import { BRAND_THEME_CSS } from './brand-theme.constants';

/** Payload provider (payload.config.ts, admin.components.providers): the brand theme for every page. */
export function BrandTheme({ children }: { children?: React.ReactNode }) {
  return (
    <>
      <style>{BRAND_THEME_CSS}</style>
      {children}
    </>
  );
}
