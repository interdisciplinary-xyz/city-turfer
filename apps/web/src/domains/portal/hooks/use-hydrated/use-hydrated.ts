'use client';

import { useEffect, useState } from 'react';

/**
 * False in the static HTML and until React has hydrated. Portal forms keep their submit buttons
 * disabled until then: a native submit before hydration would send the e-mail or code to the page
 * itself instead of through the API client (and never in a URL: the forms are also `method="post"`).
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
